import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { createRateLimitMiddleware, RATE_LIMITS } from '@/lib/rate-limiting';

const rateLimitMiddleware = createRateLimitMiddleware(RATE_LIMITS.PUBLIC);

/**
 * POST /api/reels/[id]/like - Like/unlike a reel
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

    // Check if user already liked this reel
    const existingLike = await prisma.userVideoLike.findUnique({
      where: {
        userId_videoId: {
          userId,
          videoId: reelId,
        },
      },
    });

    let isLiked = false;
    let likesChange = 0;

    if (existingLike) {
      // Unlike the reel
      await prisma.userVideoLike.delete({
        where: {
          id: existingLike.id,
        },
      });
      likesChange = -1;
      isLiked = false;
    } else {
      // Like the reel
      await prisma.userVideoLike.create({
        data: {
          userId,
          videoId: reelId,
        },
      });
      likesChange = 1;
      isLiked = true;
    }

    // Update reel likes count
    const updatedReel = await prisma.videoReel.update({
      where: { id: reelId },
      data: {
        likes: {
          increment: likesChange,
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

    // Update celebrity total likes
    await prisma.celebrity.update({
      where: { id: reel.celebrityId },
      data: {
        totalLikes: {
          increment: likesChange,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        reel: updatedReel,
        isLiked,
        likesCount: Number(updatedReel.likes),
      },
      message: isLiked ? 'Reel liked successfully' : 'Reel unliked successfully',
    });
  } catch (error) {
    console.error('Like reel error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to like/unlike reel',
      },
      { status: 500 }
    );
  }
}
