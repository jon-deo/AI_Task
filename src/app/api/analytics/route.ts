import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';

import { prisma } from '@/lib/prisma';
import { createRateLimitMiddleware, RATE_LIMITS } from '@/lib/rate-limiting';
import { cacheManager, CACHE_CONFIGS, CACHE_KEYS } from '@/lib/caching';

// Request validation schema
const analyticsSchema = z.object({
  type: z.enum(['overview', 'reels', 'celebrities', 'users', 'engagement']).optional().default('overview'),
  period: z.enum(['24h', '7d', '30d', '90d', '1y']).optional().default('7d'),
  granularity: z.enum(['hour', 'day', 'week', 'month']).optional().default('day'),
  entityId: z.string().optional(), // For specific reel or celebrity analytics
});

// Rate limiting middleware (stricter for analytics)
const rateLimitMiddleware = createRateLimitMiddleware({
  ...RATE_LIMITS.ADMIN,
  maxRequests: 100, // Stricter limit for analytics
});

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Prevent static optimization
export const fetchCache = 'force-no-store';
export const revalidate = 0;

/**
 * GET /api/analytics - Get analytics data (Admin only)
 */
export async function GET(request: NextRequest) {
  const headersList = headers();
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

    // TODO: Add authentication middleware to verify admin role
    // const user = await verifyAdminAuth(request);

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = {
      type: searchParams.get('type') as any || 'overview',
      period: searchParams.get('period') as any || '7d',
      granularity: searchParams.get('granularity') as any || 'day',
      entityId: searchParams.get('entityId') || undefined,
    };

    const validatedParams = analyticsSchema.parse(queryParams);

    // Generate cache key
    const cacheKey = CACHE_KEYS.analytics(
      validatedParams.type,
      `${validatedParams.period}-${validatedParams.granularity}-${validatedParams.entityId || 'all'}`
    );

    // Try to get from cache
    const cached = await cacheManager.get(cacheKey);
    if (cached) {
      const response = NextResponse.json({
        success: true,
        data: cached,
      });
      response.headers.set('X-Cache', 'HIT');
      response.headers.set('Cache-Control', 'private, max-age=300');
      return response;
    }

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    switch (validatedParams.period) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    let analyticsData: any = {};

    if (validatedParams.type === 'overview') {
      // Get overview analytics
      const [
        totalReels,
        totalCelebrities,
        totalUsers,
        recentViews,
        recentLikes,
        recentShares,
        topSports,
        recentReels,
      ] = await Promise.all([
        prisma.videoReel.count({ where: { isPublic: true } }),
        prisma.celebrity.count({ where: { isActive: true } }),
        prisma.user.count(),
        prisma.videoReel.aggregate({
          where: {
            isPublic: true,
            createdAt: { gte: startDate }
          },
          _sum: { views: true },
        }),
        prisma.videoReel.aggregate({
          where: {
            isPublic: true,
            createdAt: { gte: startDate }
          },
          _sum: { likes: true },
        }),
        prisma.videoReel.aggregate({
          where: {
            isPublic: true,
            createdAt: { gte: startDate }
          },
          _sum: { shares: true },
        }),
        prisma.celebrity.groupBy({
          by: ['sport'],
          where: { isActive: true },
          _count: { id: true },
          _sum: { totalViews: true },
          orderBy: { _sum: { totalViews: 'desc' } },
          take: 5,
        }),
        prisma.videoReel.findMany({
          where: {
            isPublic: true,
            createdAt: { gte: startDate }
          },
          include: {
            celebrity: {
              select: { name: true, sport: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ]);

      analyticsData = {
        overview: {
          totals: {
            reels: totalReels,
            celebrities: totalCelebrities,
            users: totalUsers,
          },
          period: {
            views: Number(recentViews._sum.views || 0),
            likes: Number(recentLikes._sum.likes || 0),
            shares: Number(recentShares._sum.shares || 0),
          },
          topSports: topSports.map(sport => ({
            sport: sport.sport,
            celebrityCount: sport._count.id,
            totalViews: Number(sport._sum.totalViews || 0),
          })),
          recentReels: recentReels.map(reel => ({
            id: reel.id,
            title: reel.title,
            celebrity: reel.celebrity.name,
            sport: reel.celebrity.sport,
            views: Number(reel.views),
            likes: Number(reel.likes),
            createdAt: reel.createdAt,
          })),
        },
        period: validatedParams.period,
        generatedAt: new Date().toISOString(),
      };
    } else if (validatedParams.type === 'reels') {
      // Get reel analytics
      const where = validatedParams.entityId
        ? { id: validatedParams.entityId, isPublic: true }
        : { isPublic: true, createdAt: { gte: startDate } };

      const [reelStats, topReels, viewsByDay] = await Promise.all([
        prisma.videoReel.aggregate({
          where,
          _count: { id: true },
          _sum: { views: true, likes: true, shares: true },
          _avg: { duration: true },
        }),
        prisma.videoReel.findMany({
          where,
          include: {
            celebrity: {
              select: { name: true, sport: true },
            },
          },
          orderBy: { views: 'desc' },
          take: 20,
        }),
        // This would need a proper analytics table in production
        prisma.videoReel.groupBy({
          by: ['createdAt'],
          where,
          _sum: { views: true },
          orderBy: { createdAt: 'asc' },
        }),
      ]);

      analyticsData = {
        reels: {
          stats: {
            totalReels: reelStats._count.id,
            totalViews: Number(reelStats._sum.views || 0),
            totalLikes: Number(reelStats._sum.likes || 0),
            totalShares: Number(reelStats._sum.shares || 0),
            avgDuration: reelStats._avg.duration || 0,
          },
          topReels: topReels.map(reel => ({
            id: reel.id,
            title: reel.title,
            celebrity: reel.celebrity.name,
            sport: reel.celebrity.sport,
            views: Number(reel.views),
            likes: Number(reel.likes),
            shares: Number(reel.shares),
            duration: reel.duration,
            createdAt: reel.createdAt,
          })),
          viewsByDay: viewsByDay.map(day => ({
            date: day.createdAt,
            views: Number(day._sum.views || 0),
          })),
        },
        period: validatedParams.period,
        entityId: validatedParams.entityId,
        generatedAt: new Date().toISOString(),
      };
    } else if (validatedParams.type === 'celebrities') {
      // Get celebrity analytics
      const where = validatedParams.entityId
        ? { id: validatedParams.entityId, isActive: true }
        : { isActive: true };

      const [celebrityStats, topCelebrities, sportDistribution] = await Promise.all([
        prisma.celebrity.aggregate({
          where,
          _count: { id: true },
          _sum: { totalViews: true, totalLikes: true, totalShares: true, reelsCount: true },
        }),
        prisma.celebrity.findMany({
          where,
          select: {
            id: true,
            name: true,
            sport: true,
            nationality: true,
            totalViews: true,
            totalLikes: true,
            totalShares: true,
            reelsCount: true,
            isVerified: true,
          },
          orderBy: { totalViews: 'desc' },
          take: 20,
        }),
        prisma.celebrity.groupBy({
          by: ['sport'],
          where,
          _count: { id: true },
          _sum: { totalViews: true, reelsCount: true },
          orderBy: { _sum: { totalViews: 'desc' } },
        }),
      ]);

      analyticsData = {
        celebrities: {
          stats: {
            totalCelebrities: celebrityStats._count.id,
            totalViews: Number(celebrityStats._sum.totalViews || 0),
            totalLikes: Number(celebrityStats._sum.totalLikes || 0),
            totalShares: Number(celebrityStats._sum.totalShares || 0),
            totalReels: celebrityStats._sum.reelsCount || 0,
          },
          topCelebrities: topCelebrities.map(celebrity => ({
            ...celebrity,
            totalViews: Number(celebrity.totalViews),
            totalLikes: Number(celebrity.totalLikes),
            totalShares: Number(celebrity.totalShares),
          })),
          sportDistribution: sportDistribution.map(sport => ({
            sport: sport.sport,
            count: sport._count.id,
            totalViews: Number(sport._sum.totalViews || 0),
            totalReels: sport._sum.reelsCount || 0,
          })),
        },
        period: validatedParams.period,
        entityId: validatedParams.entityId,
        generatedAt: new Date().toISOString(),
      };
    }

    // Cache the result
    await cacheManager.set(cacheKey, analyticsData, {
      ...CACHE_CONFIGS.ANALYTICS,
      tags: [...CACHE_CONFIGS.ANALYTICS.tags], // Convert readonly array to mutable
    });

    // Return response with cache headers
    const response = NextResponse.json({
      success: true,
      data: analyticsData,
    });

    response.headers.set('X-Cache', 'MISS');
    response.headers.set('Cache-Control', 'private, max-age=300');
    Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    console.error('Analytics error:', error);

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
        error: 'Failed to fetch analytics',
      },
      { status: 500 }
    );
  }
}
