import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { createRateLimitMiddleware, RATE_LIMITS } from '@/lib/rate-limiting';

const viewSchema = z.object({
  watchDuration: z.number().min(0), // in seconds
  completionRate: z.number().min(0).max(100), // percentage
  deviceType: z.enum(['mobile', 'tablet', 'desktop']).optional(),
  viewSource: z.enum(['organic', 'recommended', 'search', 'shared']).optional(),
});

const rateLimitMiddleware = createRateLimitMiddleware(RATE_LIMITS.PUBLIC);

/**
 * POST /api/reels/[id]/view - Track a view on a reel
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimitMiddleware(request);
    if (!rateLimitResult.allowed) {
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: rateLimitResult.retryAfter,
        }),
        {
          status: 429,
          headers: rateLimitResult.headers,
        }
      );
    }

    const reelId = params.id;

    // Parse and validate request body
    const body = await request.json();
    const { watchDuration, completionRate, deviceType, viewSource } = viewSchema.parse(body);

    // Validate reel exists
    const reel = await prisma.videoReel.findUnique({
      where: { id: reelId },
    });

    if (!reel) {
      return NextResponse.json(
        {
          success: false,
          error: 'Reel not found',
        },
        { status: 404 }
      );
    }

    // For now, we'll simulate user interaction without authentication
    // In production, you would get the user ID from the authenticated session
    const userId = 'anonymous-user'; // This should come from auth

    // Check if this is a valid view (minimum watch time)
    const isValidView = watchDuration >= 3; // At least 3 seconds
    const isCompleted = completionRate >= 80; // 80% completion rate

    // Record the view
    await prisma.userVideoView.create({
      data: {
        userId,
        videoId: reelId,
        watchDuration,
        completionRate,
        isCompleted,
        deviceType,
        viewSource,
      },
    });

    let updatedReel = reel;

    // Only increment view count for valid views
    if (isValidView) {
      updatedReel = await prisma.videoReel.update({
        where: { id: reelId },
        data: {
          views: {
            increment: 1,
          },
        },
        include: {
          celebrity: {
            select: {
              id: true,
              name: true,
              sport: true,
              imageUrl: true,
              slug: true,
            },
          },
          _count: {
            select: {
              userLikes: true,
              userShares: true,
              userViews: true,
              videoComments: true,
            },
          },
        },
      });

      // Update celebrity total views
      await prisma.celebrity.update({
        where: { id: reel.celebrityId },
        data: {
          totalViews: {
            increment: 1,
          },
        },
      });

      // Create or update daily analytics
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await prisma.videoAnalytics.upsert({
        where: {
          videoId_date: {
            videoId: reelId,
            date: today,
          },
        },
        update: {
          views: {
            increment: 1,
          },
          uniqueViews: {
            increment: 1, // This should be more sophisticated in production
          },
          avgWatchTime: watchDuration, // This should be calculated properly
          completionRate: completionRate,
          // Update device breakdown
          ...(deviceType === 'mobile' && { mobileViews: { increment: 1 } }),
          ...(deviceType === 'tablet' && { tabletViews: { increment: 1 } }),
          ...(deviceType === 'desktop' && { desktopViews: { increment: 1 } }),
        },
        create: {
          videoId: reelId,
          date: today,
          views: 1,
          uniqueViews: 1,
          avgWatchTime: watchDuration,
          completionRate: completionRate,
          mobileViews: deviceType === 'mobile' ? 1 : 0,
          tabletViews: deviceType === 'tablet' ? 1 : 0,
          desktopViews: deviceType === 'desktop' ? 1 : 0,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        viewCounted: isValidView,
        viewsCount: Number(updatedReel.views),
        watchDuration,
        completionRate,
        isCompleted,
      },
      message: isValidView ? 'View recorded successfully' : 'View tracked (not counted)',
    });
  } catch (error) {
    console.error('Track view error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to track view',
      },
      { status: 500 }
    );
  }
}
