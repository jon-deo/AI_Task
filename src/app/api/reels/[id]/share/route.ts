import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { createRateLimitMiddleware, RATE_LIMITS } from '@/lib/rate-limiting';

const shareSchema = z.object({
  platform: z.enum([
    'TWITTER',
    'FACEBOOK', 
    'INSTAGRAM',
    'LINKEDIN',
    'WHATSAPP',
    'TELEGRAM',
    'TIKTOK',
    'YOUTUBE',
    'REDDIT',
    'DISCORD',
    'EMAIL',
    'COPY_LINK',
    'OTHER'
  ]),
});

const rateLimitMiddleware = createRateLimitMiddleware(RATE_LIMITS.PUBLIC);

/**
 * POST /api/reels/[id]/share - Share a reel
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
    const { platform } = shareSchema.parse(body);

    // Validate reel exists
    const reel = await prisma.videoReel.findUnique({
      where: { id: reelId },
      include: {
        celebrity: {
          select: {
            id: true,
            name: true,
            sport: true,
          },
        },
      },
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

    // Record the share
    await prisma.userVideoShare.create({
      data: {
        userId,
        videoId: reelId,
        platform,
      },
    });

    // Update reel shares count
    const updatedReel = await prisma.videoReel.update({
      where: { id: reelId },
      data: {
        shares: {
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
            comments: true,
          },
        },
      },
    });

    // Update celebrity total shares
    await prisma.celebrity.update({
      where: { id: reel.celebrityId },
      data: {
        totalShares: {
          increment: 1,
        },
      },
    });

    // Generate share URL
    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reel/${reelId}`;
    
    // Generate share text
    const shareText = `Check out this amazing ${reel.celebrity.sport} reel about ${reel.celebrity.name}! ${reel.title}`;

    return NextResponse.json({
      success: true,
      data: {
        reel: updatedReel,
        shareUrl,
        shareText,
        sharesCount: Number(updatedReel.shares),
        platform,
      },
      message: 'Reel shared successfully',
    });
  } catch (error) {
    console.error('Share reel error:', error);

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
        error: 'Failed to share reel',
      },
      { status: 500 }
    );
  }
}
