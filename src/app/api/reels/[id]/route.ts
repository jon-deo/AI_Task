import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { createRateLimitMiddleware, RATE_LIMITS } from '@/lib/rate-limiting';
import { cacheManager, CACHE_CONFIGS, CACHE_KEYS } from '@/lib/caching';

// Request validation schemas
const updateReelSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  thumbnailUrl: z.string().url().optional(),
  tags: z.array(z.string()).optional(),
  isPublished: z.boolean().optional(),
  featured: z.boolean().optional(),
  metaTitle: z.string().max(60).optional(),
  metaDescription: z.string().max(160).optional(),
});

const reelActionSchema = z.object({
  action: z.enum(['like', 'unlike', 'share', 'view']),
});

// Rate limiting middleware
const rateLimitMiddleware = createRateLimitMiddleware(RATE_LIMITS.PUBLIC);

/**
 * GET /api/reels/[id] - Get reel by ID or slug
 */
export async function GET(
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

    const { id } = params;

    // Generate cache key
    const cacheKey = CACHE_KEYS.reel(id);

    // Try to get from cache
    const cached = await cacheManager.get(cacheKey);
    if (cached) {
      const response = NextResponse.json({
        success: true,
        data: cached,
      });
      response.headers.set('X-Cache', 'HIT');
      response.headers.set('Cache-Control', 'public, max-age=1800, stale-while-revalidate=300');
      response.headers.set('ETag', `"${id}"`);
      return response;
    }

    // Find reel by ID or slug
    const reel = await prisma.reel.findFirst({
      where: {
        OR: [
          { id },
          { slug: id },
        ],
        isPublished: true,
      },
      include: {
        celebrity: {
          select: {
            id: true,
            name: true,
            sport: true,
            nationality: true,
            imageUrl: true,
            slug: true,
            isVerified: true,
          },
        },
        comments: {
          where: { isApproved: true },
          select: {
            id: true,
            content: true,
            authorName: true,
            authorEmail: true,
            likes: true,
            createdAt: true,
            replies: {
              where: { isApproved: true },
              select: {
                id: true,
                content: true,
                authorName: true,
                likes: true,
                createdAt: true,
              },
              orderBy: { createdAt: 'asc' },
              take: 5,
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            comments: {
              where: { isApproved: true },
            },
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

    // Get related reels from same celebrity
    const relatedReels = await prisma.reel.findMany({
      where: {
        celebrityId: reel.celebrityId,
        id: { not: reel.id },
        isPublished: true,
      },
      select: {
        id: true,
        title: true,
        thumbnailUrl: true,
        duration: true,
        views: true,
        likes: true,
        slug: true,
      },
      orderBy: { views: 'desc' },
      take: 6,
    });

    // Transform the response
    const responseData = {
      ...reel,
      commentsCount: reel._count.comments,
      relatedReels,
      _count: undefined,
    };

    // Cache the result
    await cacheManager.set(cacheKey, responseData, CACHE_CONFIGS.REEL);

    // Increment view count asynchronously
    prisma.reel.update({
      where: { id: reel.id },
      data: { views: { increment: 1 } },
    }).catch(console.error);

    // Update celebrity total views
    prisma.celebrity.update({
      where: { id: reel.celebrityId },
      data: { totalViews: { increment: 1 } },
    }).catch(console.error);

    // Return response with cache headers
    const response = NextResponse.json({
      success: true,
      data: responseData,
    });

    response.headers.set('X-Cache', 'MISS');
    response.headers.set('Cache-Control', 'public, max-age=1800, stale-while-revalidate=300');
    response.headers.set('ETag', `"${id}"`);
    response.headers.set('Vary', 'Accept-Language, Accept-Encoding');
    Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    console.error('Get reel error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch reel',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/reels/[id] - Update reel (Admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Apply stricter rate limiting for updates
    const rateLimitResult = await createRateLimitMiddleware(RATE_LIMITS.ADMIN)(request);
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

    // TODO: Add authentication middleware to verify admin role
    // const user = await verifyAdminAuth(request);

    const { id } = params;

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updateReelSchema.parse(body);

    // Check if reel exists
    const existingReel = await prisma.reel.findUnique({
      where: { id },
    });

    if (!existingReel) {
      return NextResponse.json(
        {
          success: false,
          error: 'Reel not found',
        },
        { status: 404 }
      );
    }

    // Update slug if title is being changed
    let updateData: any = { ...validatedData };
    if (validatedData.title && validatedData.title !== existingReel.title) {
      const newSlug = validatedData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      // Ensure unique slug
      let uniqueSlug = newSlug;
      let counter = 1;
      while (await prisma.reel.findFirst({ 
        where: { 
          slug: uniqueSlug,
          id: { not: id }
        } 
      })) {
        uniqueSlug = `${newSlug}-${counter}`;
        counter++;
      }

      updateData.slug = uniqueSlug;
    }

    // Update reel
    const updatedReel = await prisma.reel.update({
      where: { id },
      data: updateData,
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
      },
    });

    // Invalidate cache
    await cacheManager.delete(CACHE_KEYS.reel(id));
    await cacheManager.delete(CACHE_KEYS.reel(existingReel.slug));
    await cacheManager.invalidateByTag('reel');

    return NextResponse.json({
      success: true,
      data: updatedReel,
      message: 'Reel updated successfully',
    });
  } catch (error) {
    console.error('Update reel error:', error);

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
        error: 'Failed to update reel',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reels/[id] - Perform actions on reel (like, share, etc.)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Apply rate limiting for actions
    const rateLimitResult = await createRateLimitMiddleware(RATE_LIMITS.GENERAL)(request);
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

    const { id } = params;

    // Parse and validate request body
    const body = await request.json();
    const { action } = reelActionSchema.parse(body);

    // Find reel
    const reel = await prisma.reel.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
        isPublished: true,
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

    let updateData: any = {};
    let celebrityUpdateData: any = {};

    switch (action) {
      case 'like':
        updateData.likes = { increment: 1 };
        celebrityUpdateData.totalLikes = { increment: 1 };
        break;
      case 'unlike':
        updateData.likes = { decrement: 1 };
        celebrityUpdateData.totalLikes = { decrement: 1 };
        break;
      case 'share':
        updateData.shares = { increment: 1 };
        celebrityUpdateData.totalShares = { increment: 1 };
        break;
      case 'view':
        updateData.views = { increment: 1 };
        celebrityUpdateData.totalViews = { increment: 1 };
        break;
    }

    // Update reel and celebrity stats in parallel
    const [updatedReel] = await Promise.all([
      prisma.reel.update({
        where: { id: reel.id },
        data: updateData,
        select: {
          id: true,
          views: true,
          likes: true,
          shares: true,
        },
      }),
      prisma.celebrity.update({
        where: { id: reel.celebrityId },
        data: celebrityUpdateData,
      }),
    ]);

    // Invalidate cache for this reel
    await cacheManager.delete(CACHE_KEYS.reel(id));
    await cacheManager.delete(CACHE_KEYS.reel(reel.slug));

    return NextResponse.json({
      success: true,
      data: {
        action,
        reel: updatedReel,
      },
      message: `Reel ${action} successful`,
    });
  } catch (error) {
    console.error('Reel action error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid action',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to perform action',
      },
      { status: 500 }
    );
  }
}
