import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { createRateLimitMiddleware, RATE_LIMITS } from '@/lib/rate-limiting';
import { cacheManager, CACHE_CONFIGS, CACHE_KEYS } from '@/lib/caching';
import { 
  parsePaginationParams, 
  createPaginationResult, 
  PAGINATION_CONFIGS 
} from '@/lib/pagination';

// Request validation schema
const searchSchema = z.object({
  q: z.string().min(1).max(100),
  type: z.enum(['all', 'celebrities', 'reels']).optional().default('all'),
  page: z.number().min(1).optional(),
  limit: z.number().min(1).max(50).optional(),
  sort: z.enum(['relevance', 'createdAt', 'views', 'likes']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  sport: z.string().optional(),
  minDuration: z.number().min(1).optional(),
  maxDuration: z.number().max(300).optional(),
});

// Rate limiting middleware
const rateLimitMiddleware = createRateLimitMiddleware(RATE_LIMITS.SEARCH);

/**
 * GET /api/search - Search celebrities and reels
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
      q: searchParams.get('q') || '',
      type: searchParams.get('type') as any || 'all',
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
      sort: searchParams.get('sort') as any,
      order: searchParams.get('order') as any,
      sport: searchParams.get('sport') || undefined,
      minDuration: searchParams.get('minDuration') ? parseInt(searchParams.get('minDuration')!) : undefined,
      maxDuration: searchParams.get('maxDuration') ? parseInt(searchParams.get('maxDuration')!) : undefined,
    };

    const validatedParams = searchSchema.parse(queryParams);

    // Parse pagination parameters
    const paginationParams = parsePaginationParams(request, PAGINATION_CONFIGS.SEARCH);

    // Generate cache key
    const cacheKey = CACHE_KEYS.search(
      validatedParams.q,
      JSON.stringify({ ...validatedParams, ...paginationParams })
    );

    // Try to get from cache
    const cached = await cacheManager.get(cacheKey);
    if (cached) {
      const response = NextResponse.json({
        success: true,
        data: cached,
      });
      response.headers.set('X-Cache', 'HIT');
      response.headers.set('Cache-Control', 'public, max-age=600, stale-while-revalidate=60');
      return response;
    }

    const searchTerm = validatedParams.q.toLowerCase();
    const results: any = {
      query: validatedParams.q,
      type: validatedParams.type,
      celebrities: [],
      reels: [],
      pagination: null,
      totalResults: 0,
    };

    // Search celebrities
    if (validatedParams.type === 'all' || validatedParams.type === 'celebrities') {
      const celebrityWhere: any = {
        isActive: true,
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { biography: { contains: searchTerm, mode: 'insensitive' } },
          { team: { contains: searchTerm, mode: 'insensitive' } },
          { position: { contains: searchTerm, mode: 'insensitive' } },
        ],
      };

      if (validatedParams.sport) {
        celebrityWhere.sport = validatedParams.sport;
      }

      const [celebrities, celebrityCount] = await Promise.all([
        prisma.celebrity.findMany({
          where: celebrityWhere,
          select: {
            id: true,
            name: true,
            sport: true,
            nationality: true,
            biography: true,
            position: true,
            team: true,
            imageUrl: true,
            thumbnailUrl: true,
            slug: true,
            isVerified: true,
            totalViews: true,
            totalLikes: true,
            reelsCount: true,
          },
          orderBy: validatedParams.sort === 'relevance' 
            ? [{ totalViews: 'desc' }, { totalLikes: 'desc' }]
            : { [paginationParams.sort]: paginationParams.order },
          skip: validatedParams.type === 'celebrities' ? paginationParams.offset : 0,
          take: validatedParams.type === 'celebrities' ? paginationParams.limit : 10,
        }),
        prisma.celebrity.count({ where: celebrityWhere }),
      ]);

      results.celebrities = celebrities;
      if (validatedParams.type === 'celebrities') {
        results.pagination = createPaginationResult(celebrities, celebrityCount, paginationParams).pagination;
        results.totalResults = celebrityCount;
      }
    }

    // Search reels
    if (validatedParams.type === 'all' || validatedParams.type === 'reels') {
      const reelWhere: any = {
        isPublished: true,
        OR: [
          { title: { contains: searchTerm, mode: 'insensitive' } },
          { description: { contains: searchTerm, mode: 'insensitive' } },
          { tags: { has: searchTerm } },
          { celebrity: { name: { contains: searchTerm, mode: 'insensitive' } } },
        ],
      };

      if (validatedParams.sport) {
        reelWhere.celebrity = { 
          ...reelWhere.celebrity,
          sport: validatedParams.sport 
        };
      }

      if (validatedParams.minDuration || validatedParams.maxDuration) {
        reelWhere.duration = {};
        if (validatedParams.minDuration) {
          reelWhere.duration.gte = validatedParams.minDuration;
        }
        if (validatedParams.maxDuration) {
          reelWhere.duration.lte = validatedParams.maxDuration;
        }
      }

      const [reels, reelCount] = await Promise.all([
        prisma.reel.findMany({
          where: reelWhere,
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
                comments: {
                  where: { isApproved: true },
                },
              },
            },
          },
          orderBy: validatedParams.sort === 'relevance' 
            ? [{ views: 'desc' }, { likes: 'desc' }]
            : { [paginationParams.sort]: paginationParams.order },
          skip: validatedParams.type === 'reels' ? paginationParams.offset : 0,
          take: validatedParams.type === 'reels' ? paginationParams.limit : 10,
        }),
        prisma.reel.count({ where: reelWhere }),
      ]);

      // Transform reels
      results.reels = reels.map(reel => ({
        ...reel,
        commentsCount: reel._count.comments,
        _count: undefined,
      }));

      if (validatedParams.type === 'reels') {
        results.pagination = createPaginationResult(results.reels, reelCount, paginationParams).pagination;
        results.totalResults = reelCount;
      }
    }

    // For 'all' type, combine counts
    if (validatedParams.type === 'all') {
      results.totalResults = results.celebrities.length + results.reels.length;
    }

    // Cache the result
    await cacheManager.set(cacheKey, results, CACHE_CONFIGS.SEARCH);

    // Log search query for analytics
    prisma.searchQuery.create({
      data: {
        query: validatedParams.q,
        type: validatedParams.type,
        resultsCount: results.totalResults,
        filters: {
          sport: validatedParams.sport,
          minDuration: validatedParams.minDuration,
          maxDuration: validatedParams.maxDuration,
        },
        userAgent: request.headers.get('user-agent') || '',
        ip: request.ip || request.headers.get('x-forwarded-for') || '',
      },
    }).catch(console.error);

    // Return response with cache headers
    const response = NextResponse.json({
      success: true,
      data: results,
    });

    response.headers.set('X-Cache', 'MISS');
    response.headers.set('Cache-Control', 'public, max-age=600, stale-while-revalidate=60');
    response.headers.set('Vary', 'Accept-Language');
    Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    console.error('Search error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid search parameters',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Search failed',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/search/suggestions - Get search suggestions
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

    const body = await request.json();
    const { q } = z.object({ q: z.string().min(1).max(50) }).parse(body);

    const searchTerm = q.toLowerCase();

    // Generate cache key for suggestions
    const cacheKey = `search:suggestions:${searchTerm}`;

    // Try to get from cache
    const cached = await cacheManager.get(cacheKey);
    if (cached) {
      return NextResponse.json({
        success: true,
        data: cached,
      });
    }

    // Get celebrity suggestions
    const celebritySuggestions = await prisma.celebrity.findMany({
      where: {
        isActive: true,
        name: { contains: searchTerm, mode: 'insensitive' },
      },
      select: {
        id: true,
        name: true,
        sport: true,
        imageUrl: true,
        slug: true,
      },
      orderBy: { totalViews: 'desc' },
      take: 5,
    });

    // Get popular search terms
    const popularSearches = await prisma.searchQuery.groupBy({
      by: ['query'],
      where: {
        query: { contains: searchTerm, mode: 'insensitive' },
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
      },
      _count: { query: true },
      orderBy: { _count: { query: 'desc' } },
      take: 5,
    });

    const suggestions = {
      celebrities: celebritySuggestions,
      popularSearches: popularSearches.map(item => ({
        query: item.query,
        count: item._count.query,
      })),
    };

    // Cache suggestions for 1 hour
    await cacheManager.set(cacheKey, suggestions, { ttl: 3600, tags: ['search'] });

    return NextResponse.json({
      success: true,
      data: suggestions,
    });
  } catch (error) {
    console.error('Search suggestions error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get suggestions',
      },
      { status: 500 }
    );
  }
}
