import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { createRateLimitMiddleware, RATE_LIMITS } from '@/lib/rate-limiting';
import { cacheManager, CACHE_CONFIGS, CACHE_KEYS } from '@/lib/caching';

// Request validation schemas
const updateCelebritySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  sport: z.enum(['FOOTBALL', 'BASKETBALL', 'BASEBALL', 'SOCCER', 'TENNIS', 'GOLF', 'HOCKEY', 'BOXING', 'MMA', 'CRICKET', 'RUGBY', 'VOLLEYBALL', 'SWIMMING', 'ATHLETICS', 'CYCLING', 'MOTORSPORT', 'OTHER']).optional(),
  nationality: z.string().min(1).max(50).optional(),
  biography: z.string().min(10).max(2000).optional(),
  achievements: z.array(z.string()).optional(),
  position: z.string().max(50).optional(),
  team: z.string().max(100).optional(),
  birthDate: z.string().datetime().optional(),
  imageUrl: z.string().url().optional(),
  socialLinks: z.object({
    twitter: z.string().url().optional(),
    instagram: z.string().url().optional(),
    facebook: z.string().url().optional(),
    youtube: z.string().url().optional(),
    website: z.string().url().optional(),
  }).optional(),
  metaTitle: z.string().max(60).optional(),
  metaDescription: z.string().max(160).optional(),
  keywords: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  isVerified: z.boolean().optional(),
});

// Rate limiting middleware
const rateLimitMiddleware = createRateLimitMiddleware(RATE_LIMITS.PUBLIC);

/**
 * GET /api/celebrities/[id] - Get celebrity by ID or slug
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
    const cacheKey = CACHE_KEYS.celebrity(id);

    // Try to get from cache
    const cached = await cacheManager.get(cacheKey);
    if (cached) {
      const response = NextResponse.json({
        success: true,
        data: cached,
      });
      response.headers.set('X-Cache', 'HIT');
      response.headers.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=300');
      response.headers.set('ETag', `"${id}"`);
      return response;
    }

    // Find celebrity by ID or slug
    const celebrity = await prisma.celebrity.findFirst({
      where: {
        OR: [
          { id },
          { slug: id },
        ],
        isActive: true,
      },
      include: {
        videoReels: {
          where: { isPublic: true },
          select: {
            id: true,
            title: true,
            thumbnailUrl: true,
            duration: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!celebrity) {
      return NextResponse.json(
        {
          success: false,
          error: 'Celebrity not found',
        },
        { status: 404 }
      );
    }

    // Transform the response
    const responseData = {
      ...celebrity,
      reelsCount: celebrity.videoReels?.length,
    };

    // Cache the result
    await cacheManager.set(cacheKey, responseData, {
      ...CACHE_CONFIGS.CELEBRITY,
      tags: [...CACHE_CONFIGS.CELEBRITY.tags],
      vary: [...CACHE_CONFIGS.CELEBRITY.vary],
    });

    // Return response with cache headers
    const response = NextResponse.json({
      success: true,
      data: responseData,
    });

    response.headers.set('X-Cache', 'MISS');
    response.headers.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=300');
    response.headers.set('ETag', `"${id}"`);
    response.headers.set('Vary', 'Accept-Language');
    Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    console.error('Get celebrity error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch celebrity',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/celebrities/[id] - Update celebrity (Admin only)
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
    const validatedData = updateCelebritySchema.parse(body);

    // Check if celebrity exists
    const existingCelebrity = await prisma.celebrity.findUnique({
      where: { id },
    });

    if (!existingCelebrity) {
      return NextResponse.json(
        {
          success: false,
          error: 'Celebrity not found',
        },
        { status: 404 }
      );
    }

    // Update slug if name is being changed
    let updateData: any = { ...validatedData };
    if (validatedData.name && validatedData.name !== existingCelebrity.name) {
      const newSlug = validatedData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      // Check if new slug conflicts with existing celebrity
      const conflictingCelebrity = await prisma.celebrity.findFirst({
        where: {
          slug: newSlug,
          id: { not: id },
        },
      });

      if (conflictingCelebrity) {
        return NextResponse.json(
          {
            success: false,
            error: 'Celebrity with this name already exists',
          },
          { status: 409 }
        );
      }

      updateData.slug = newSlug;
    }

    // Handle birthDate conversion
    if (validatedData.birthDate) {
      updateData.birthDate = new Date(validatedData.birthDate);
    }

    // Update celebrity
    const updatedCelebrity = await prisma.celebrity.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        sport: true,
        nationality: true,
        biography: true,
        position: true,
        team: true,
        slug: true,
        isActive: true,
        isVerified: true,
        imageUrl: true,
        socialLinks: true,
        metaTitle: true,
        metaDescription: true,
        keywords: true,
        updatedAt: true,
      },
    });

    // Invalidate cache
    await cacheManager.delete(CACHE_KEYS.celebrity(id));
    await cacheManager.delete(CACHE_KEYS.celebrity(existingCelebrity.slug));
    await cacheManager.invalidateByTag('celebrity');

    return NextResponse.json({
      success: true,
      data: updatedCelebrity,
      message: 'Celebrity updated successfully',
    });
  } catch (error) {
    console.error('Update celebrity error:', error);

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
        error: 'Failed to update celebrity',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/celebrities/[id] - Delete celebrity (Admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Apply stricter rate limiting for deletion
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

    // Check if celebrity exists
    const celebrity = await prisma.celebrity.findUnique({
      where: { id },
      include: {
        videoReels: true,
      },
    });

    if (!celebrity) {
      return NextResponse.json(
        {
          success: false,
          error: 'Celebrity not found',
        },
        { status: 404 }
      );
    }

    // Check if celebrity has reels (soft delete instead)
    if (celebrity.videoReels && celebrity.videoReels.length > 0) {
      // Soft delete by setting isActive to false
      await prisma.celebrity.update({
        where: { id },
        data: { isActive: false },
      });

      // Invalidate cache
      await cacheManager.delete(CACHE_KEYS.celebrity(id));
      await cacheManager.delete(CACHE_KEYS.celebrity(celebrity.slug));
      await cacheManager.invalidateByTag('celebrity');

      return NextResponse.json({
        success: true,
        message: 'Celebrity deactivated successfully (has associated reels)',
      });
    }

    // Hard delete if no reels
    await prisma.celebrity.delete({
      where: { id },
    });

    // Invalidate cache
    await cacheManager.delete(CACHE_KEYS.celebrity(id));
    await cacheManager.delete(CACHE_KEYS.celebrity(celebrity.slug));
    await cacheManager.invalidateByTag('celebrity');

    return NextResponse.json({
      success: true,
      message: 'Celebrity deleted successfully',
    });
  } catch (error) {
    console.error('Delete celebrity error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete celebrity',
      },
      { status: 500 }
    );
  }
}
