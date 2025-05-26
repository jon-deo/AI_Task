import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { createRateLimitMiddleware, RATE_LIMITS } from '@/lib/rate-limiting';
import { cacheManager, CACHE_CONFIGS } from '@/lib/caching';

// Request validation schema
const trendingSchema = z.object({
  type: z.enum(['reels', 'celebrities', 'sports']).optional().default('reels'),
  period: z.enum(['24h', '7d', '30d', 'all']).optional().default('7d'),
  limit: z.number().min(1).max(50).optional().default(20),
  sport: z.string().optional(),
});

// Rate limiting middleware
const rateLimitMiddleware = createRateLimitMiddleware(RATE_LIMITS.PUBLIC);

/**
 * GET /api/trending - Get trending content
 */
export async function GET(request: NextRequest) {
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

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = {
      type: searchParams.get('type') as any || 'reels',
      period: searchParams.get('period') as any || '7d',
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20,
      sport: searchParams.get('sport') || undefined,
    };

    const validatedParams = trendingSchema.parse(queryParams);

    // Generate cache key
    const cacheKey = `trending:${validatedParams.type}:${validatedParams.period}:${validatedParams.limit}:${validatedParams.sport || 'all'}`;

    // Try to get from cache
    const cached = await cacheManager.get(cacheKey);
    if (cached) {
      const response = NextResponse.json({
        success: true,
        data: cached,
      });
      response.headers.set('X-Cache', 'HIT');
      response.headers.set('Cache-Control', 'public, max-age=1800, stale-while-revalidate=300');
      return response;
    }

    // Calculate date filter based on period
    let dateFilter: Date | undefined;
    const now = new Date();
    switch (validatedParams.period) {
      case '24h':
        dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
      default:
        dateFilter = undefined;
        break;
    }

    let results: any = {};

    if (validatedParams.type === 'reels') {
      // Get trending reels
      const where: any = {
        isPublic: true,
        ...(dateFilter && { createdAt: { gte: dateFilter } }),
        ...(validatedParams.sport && {
          celebrity: { sport: validatedParams.sport }
        }),
      };

      const trendingReels = await prisma.videoReel.findMany({
        where,
        include: {
          celebrity: {
            select: {
              id: true,
              name: true,
              sport: true,
              imageUrl: true,
              slug: true,
              isVerified: true,
            },
          },
          _count: {
            select: {
              videoComments: {
                where: { isApproved: true },
              },
            },
          },
        },
        orderBy: [
          { views: 'desc' },
          { likes: 'desc' },
          { shares: 'desc' },
        ],
        take: validatedParams.limit,
      });

      results = {
        type: 'reels',
        period: validatedParams.period,
        data: trendingReels.map(reel => ({
          ...reel,
          commentsCount: reel._count.videoComments,
          _count: undefined,
        })),
        metadata: {
          totalCount: trendingReels.length,
          sport: validatedParams.sport,
        },
      };
    } else if (validatedParams.type === 'celebrities') {
      // Get trending celebrities
      const where: any = {
        isActive: true,
        ...(validatedParams.sport && { sport: validatedParams.sport }),
      };

      const trendingCelebrities = await prisma.celebrity.findMany({
        where,
        select: {
          id: true,
          name: true,
          sport: true,
          nationality: true,
          imageUrl: true,
          thumbnailUrl: true,
          slug: true,
          isVerified: true,
          totalViews: true,
          totalLikes: true,
          totalShares: true,
          reelsCount: true,
          position: true,
          team: true,
        },
        orderBy: [
          { totalViews: 'desc' },
          { totalLikes: 'desc' },
          { reelsCount: 'desc' },
        ],
        take: validatedParams.limit,
      });

      results = {
        type: 'celebrities',
        period: validatedParams.period,
        data: trendingCelebrities,
        metadata: {
          totalCount: trendingCelebrities.length,
          sport: validatedParams.sport,
        },
      };
    } else if (validatedParams.type === 'sports') {
      // Get trending sports (based on view counts)
      const sportStats = await prisma.celebrity.groupBy({
        by: ['sport'],
        where: {
          isActive: true,
          ...(dateFilter && {
            videoReels: {
              some: {
                createdAt: { gte: dateFilter },
                isPublic: true
              }
            }
          }),
        },
        _sum: {
          totalViews: true,
          totalLikes: true,
          reelsCount: true,
        },
        _count: {
          id: true,
        },
        orderBy: {
          _sum: {
            totalViews: 'desc',
          },
        },
        take: validatedParams.limit,
      });

      results = {
        type: 'sports',
        period: validatedParams.period,
        data: sportStats.map(stat => ({
          sport: stat.sport,
          totalViews: stat._sum.totalViews || 0,
          totalLikes: stat._sum.totalLikes || 0,
          totalReels: stat._sum.reelsCount || 0,
          celebrityCount: stat._count.id,
        })),
        metadata: {
          totalCount: sportStats.length,
        },
      };
    }

    // Cache the result
    await cacheManager.set(cacheKey, results, CACHE_CONFIGS.MEDIUM);

    // Return response with cache headers
    const response = NextResponse.json({
      success: true,
      data: results,
    });

    response.headers.set('X-Cache', 'MISS');
    response.headers.set('Cache-Control', 'public, max-age=1800, stale-while-revalidate=300');
    response.headers.set('Vary', 'Accept-Language');
    Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    console.error('Trending content error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid parameters',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch trending content',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/trending/featured - Get featured content
 */
export async function POST(request: NextRequest) {
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

    // Generate cache key for featured content
    const cacheKey = 'featured:content';

    // Try to get from cache
    const cached = await cacheManager.get(cacheKey);
    if (cached) {
      return NextResponse.json({
        success: true,
        data: cached,
      });
    }

    // Get featured reels
    const featuredReels = await prisma.videoReel.findMany({
      where: {
        isPublic: true,
        isFeatured: true,
      },
      include: {
        celebrity: {
          select: {
            id: true,
            name: true,
            sport: true,
            imageUrl: true,
            slug: true,
            isVerified: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Get featured celebrities
    const featuredCelebrities = await prisma.celebrity.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        sport: true,
        nationality: true,
        imageUrl: true,
        thumbnailUrl: true,
        slug: true,
        isVerified: true,
        totalViews: true,
        totalLikes: true,
        reelsCount: true,
      },
      orderBy: { totalViews: 'desc' },
      take: 8,
    });

    const featuredContent = {
      reels: featuredReels,
      celebrities: featuredCelebrities,
      lastUpdated: new Date().toISOString(),
    };

    // Cache featured content for 2 hours
    await cacheManager.set(cacheKey, featuredContent, {
      ttl: 7200,
      tags: ['featured', 'reel', 'celebrity']
    });

    return NextResponse.json({
      success: true,
      data: featuredContent,
    });
  } catch (error) {
    console.error('Featured content error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch featured content',
      },
      { status: 500 }
    );
  }
}
