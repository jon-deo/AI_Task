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
    const reel = await prisma.videoReel.findFirst({
      where: {
        OR: [
          { id },
          { slug: id },
        ],
        isPublic: true,
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
    const relatedReels = await prisma.videoReel.findMany({
      where: {
        celebrityId: reel.celebrityId,
        id: { not: reel.id },
        isPublic: true,
      },
      select: {
        id: true,
        title: true,
        thumbnailUrl: true,
        duration: true,
        slug: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });

    // Transform the response
    const responseData = {
      ...reel,
      // Convert BigInt fields to strings for JSON serialization
      fileSize: reel.fileSize.toString(),
      relatedReels,
    };

    // Cache the result
    await cacheManager.set(cacheKey, responseData, {
      ...CACHE_CONFIGS.REEL,
      tags: [...CACHE_CONFIGS.REEL.tags],
      vary: [...CACHE_CONFIGS.REEL.vary],
    });

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
    console.error('Error fetching reel:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/reels/[id] - Update reel
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    // Validate request body
    const validatedData = updateReelSchema.parse(body);

    // Update reel
    const updatedReel = await prisma.videoReel.update({
      where: { id },
      data: validatedData,
      include: {
        celebrity: {
          select: {
            id: true,
            name: true,
            sport: true,
            nationality: true,
            imageUrl: true,
            slug: true,
          },
        },
      },
    });

    // Invalidate cache
    await cacheManager.delete(CACHE_KEYS.reel(id));

    return NextResponse.json({
      success: true,
      data: {
        ...updatedReel,
        fileSize: updatedReel.fileSize.toString(),
      },
    });
  } catch (error) {
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

    console.error('Error updating reel:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
