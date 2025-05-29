import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { createRateLimitMiddleware, RATE_LIMITS } from '@/lib/rate-limiting';
import { cacheManager, CACHE_CONFIGS, CACHE_KEYS } from '@/lib/caching';
import {
  parsePaginationParams,
  createPaginationResult,
  buildPrismaOrderBy,
  buildPrismaWhere,
  PAGINATION_CONFIGS
} from '@/lib/pagination';

// Request validation schemas
const getReelsSchema = z.object({
  page: z.number().min(1).optional(),
  limit: z.number().min(1).max(50).optional(),
  sort: z.enum(['createdAt', 'updatedAt', 'duration', 'title']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  search: z.string().optional(),
  celebrityId: z.string().optional(),
  sport: z.string().optional(),
  isPublished: z.boolean().optional(),
  featured: z.boolean().optional(),
  minDuration: z.number().min(1).optional(),
  maxDuration: z.number().max(300).optional(),
});

const createReelSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  celebrityId: z.string().min(1),
  videoUrl: z.string().url(),
  thumbnailUrl: z.string().url(),
  duration: z.number().min(1).max(300),
  tags: z.array(z.string()).optional(),
  isPublished: z.boolean().optional(),
  featured: z.boolean().optional(),
  metaTitle: z.string().max(60).optional(),
  metaDescription: z.string().max(160).optional(),
});

// Rate limiting middleware
const rateLimitMiddleware = createRateLimitMiddleware(RATE_LIMITS.PUBLIC);

/**
 * GET /api/reels - Get paginated list of reels
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
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
      sort: (searchParams.get('sort') as any) || 'createdAt',
      order: (searchParams.get('order') as any) || 'desc',
      search: searchParams.get('search') || undefined,
      celebrityId: searchParams.get('celebrityId') || undefined,
      sport: searchParams.get('sport') || undefined,
      isPublished: searchParams.get('isPublished') ? searchParams.get('isPublished') === 'true' : undefined,
      featured: searchParams.get('featured') ? searchParams.get('featured') === 'true' : undefined,
      minDuration: searchParams.get('minDuration') ? parseInt(searchParams.get('minDuration')!) : undefined,
      maxDuration: searchParams.get('maxDuration') ? parseInt(searchParams.get('maxDuration')!) : undefined,
    };

    const validatedParams = getReelsSchema.parse(queryParams);

    // Parse pagination parameters
    const paginationParams = parsePaginationParams(request, {
      ...PAGINATION_CONFIGS.REELS,
      allowedSortFields: [...PAGINATION_CONFIGS.REELS.allowedSortFields],
      allowedSortOrders: [...PAGINATION_CONFIGS.REELS.allowedSortOrders],
    });

    // Generate cache key
    const cacheKey = CACHE_KEYS.reelList(JSON.stringify(paginationParams));

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

    // Build Prisma query
    const where = buildPrismaWhere(paginationParams, ['title', 'description']);
    const orderBy = buildPrismaOrderBy(paginationParams);

    // Add specific filters
    if (validatedParams.celebrityId) {
      where.celebrityId = validatedParams.celebrityId;
    }
    if (validatedParams.sport) {
      where.celebrity = { sport: validatedParams.sport };
    }
    if (validatedParams.isPublished !== undefined) {
      where.isPublic = validatedParams.isPublished;
    } else {
      // Default to published reels for public API
      where.isPublic = true;
    }
    if (validatedParams.featured !== undefined) {
      where.isFeatured = validatedParams.featured;
    }
    if (validatedParams.minDuration || validatedParams.maxDuration) {
      where.duration = {};
      if (validatedParams.minDuration) {
        where.duration.gte = validatedParams.minDuration;
      }
      if (validatedParams.maxDuration) {
        where.duration.lte = validatedParams.maxDuration;
      }
    }

    // Execute queries in parallel
    const [reels, total] = await Promise.all([
      prisma.videoReel.findMany({
        where,
        orderBy,
        skip: paginationParams.offset,
        take: paginationParams.limit,
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
      }),
      prisma.videoReel.count({ where }),
    ]);

    // Transform the response
    const transformedReels = reels.map((reel: any) => ({
      ...reel,
      // Convert BigInt fields to strings for JSON serialization
      fileSize: reel.fileSize.toString(),
    }));

    // Create pagination result
    const result = createPaginationResult(transformedReels, total, paginationParams);

    // Cache the result
    await cacheManager.set(cacheKey, result, {
      ...CACHE_CONFIGS.REEL,
      tags: ["reel"],
      vary: [...CACHE_CONFIGS.REEL.vary],
    });

    // Return response with cache headers
    const response = NextResponse.json({
      success: true,
      data: result,
    });

    response.headers.set('X-Cache', 'MISS');
    response.headers.set('Cache-Control', 'public, max-age=1800, stale-while-revalidate=300');
    response.headers.set('Vary', 'Accept-Language, Accept-Encoding');
    Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    console.error('Error fetching reels:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch reels',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reels - Create new reel (Admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // Apply stricter rate limiting for creation
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

    // Parse and validate request body
    const body = await request.json();
    const validatedData = createReelSchema.parse(body);

    // Verify celebrity exists
    const celebrity = await prisma.celebrity.findUnique({
      where: { id: validatedData.celebrityId },
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

    // Generate slug from title
    const slug = validatedData.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Ensure unique slug
    let uniqueSlug = slug;
    let counter = 1;
    while (await prisma.videoReel.findFirst({ where: { slug: uniqueSlug } })) {
      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }

    // Create reel
    const { isPublished, featured, ...reelData } = validatedData;
    const reel = await prisma.videoReel.create({
      data: {
        title: reelData.title,
        description: reelData.description || '',
        celebrityId: reelData.celebrityId,
        videoUrl: reelData.videoUrl,
        thumbnailUrl: reelData.thumbnailUrl,
        duration: reelData.duration,
        tags: reelData.tags || [],
        slug: uniqueSlug,
        isPublic: isPublished ?? false,
        isFeatured: featured ?? false,
        script: '', // Required field
        fileSize: BigInt(0), // Required field
        resolution: '1080p', // Required field
        bitrate: '2000', // Required field
        format: 'mp4', // Required field
        status: 'PROCESSING', // Required field
        s3Key: '', // Required field
        s3Bucket: '', // Required field
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
      },
    });

    // Invalidate cache
    await cacheManager.invalidateByTag('reel');
    await cacheManager.invalidateByTag('celebrity');

    // Transform BigInt fields to strings for JSON serialization
    const transformedReel = {
      ...reel,
      fileSize: reel.fileSize.toString(),
    };

    return NextResponse.json(
      {
        success: true,
        data: transformedReel,
        message: 'Reel created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create reel error:', error);

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
        error: 'Failed to create reel',
      },
      { status: 500 }
    );
  }
}
