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

    // Parse request body
    const body = await request.json();
    const userId = body.userId;

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'User ID is required',
        },
        { status: 400 }
      );
    }

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
            videoComments: true,
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

    // Transform BigInt fields to strings for JSON serialization
    const transformedReel = {
      ...updatedReel,
      views: updatedReel.views.toString(),
      likes: updatedReel.likes.toString(),
      shares: updatedReel.shares.toString(),
      comments: updatedReel.comments.toString(),
      fileSize: updatedReel.fileSize.toString(),
    };

    return NextResponse.json({
      success: true,
      data: {
        reel: transformedReel,
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
