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
const getCelebritiesSchema = z.object({
  page: z.number().min(1).optional(),
  limit: z.number().min(1).max(100).optional(),
  sort: z.enum(['name', 'sport', 'totalViews', 'totalLikes', 'reelsCount', 'createdAt', 'updatedAt']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  search: z.string().optional(),
  sport: z.string().optional(),
  isActive: z.boolean().optional(),
  isVerified: z.boolean().optional(),
});

const createCelebritySchema = z.object({
  name: z.string().min(1).max(100),
  sport: z.enum(['FOOTBALL', 'BASKETBALL', 'BASEBALL', 'SOCCER', 'TENNIS', 'GOLF', 'HOCKEY', 'BOXING', 'MMA', 'CRICKET', 'RUGBY', 'VOLLEYBALL', 'SWIMMING', 'ATHLETICS', 'CYCLING', 'MOTORSPORT', 'OTHER']),
  nationality: z.string().min(1).max(50),
  biography: z.string().min(10).max(2000),
  achievements: z.array(z.string()).min(1),
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
});

// Rate limiting middleware
const rateLimitMiddleware = createRateLimitMiddleware(RATE_LIMITS.PUBLIC);

/**
 * GET /api/celebrities - Get paginated list of celebrities
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
      sort: searchParams.get('sort') as any,
      order: searchParams.get('order') as any,
      search: searchParams.get('search') || undefined,
      sport: searchParams.get('sport') || undefined,
      isActive: searchParams.get('isActive') ? searchParams.get('isActive') === 'true' : undefined,
      isVerified: searchParams.get('isVerified') ? searchParams.get('isVerified') === 'true' : undefined,
    };

    const validatedParams = getCelebritiesSchema.parse(queryParams);

    // Parse pagination parameters
    const paginationParams = parsePaginationParams(request, PAGINATION_CONFIGS.CELEBRITIES);

    // Generate cache key
    const cacheKey = CACHE_KEYS.celebrityList(JSON.stringify(paginationParams));

    // Try to get from cache
    const cached = await cacheManager.get(cacheKey);
    if (cached) {
      const response = NextResponse.json({
        success: true,
        data: cached,
      });
      response.headers.set('X-Cache', 'HIT');
      response.headers.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=300');
      return response;
    }

    // Build Prisma query
    const where = buildPrismaWhere(paginationParams, ['name', 'biography']);
    const orderBy = buildPrismaOrderBy(paginationParams);

    // Add specific filters
    if (validatedParams.sport) {
      where.sport = validatedParams.sport;
    }
    if (validatedParams.isActive !== undefined) {
      where.isActive = validatedParams.isActive;
    }
    if (validatedParams.isVerified !== undefined) {
      where.isVerified = validatedParams.isVerified;
    }

    // Execute queries in parallel
    const [celebrities, total] = await Promise.all([
      prisma.celebrity.findMany({
        where,
        orderBy,
        skip: paginationParams.offset,
        take: paginationParams.limit,
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
          isActive: true,
          isVerified: true,
          totalViews: true,
          totalLikes: true,
          totalShares: true,
          reelsCount: true,
          createdAt: true,
          updatedAt: true,
          slug: true,
          metaTitle: true,
          metaDescription: true,
        },
      }),
      prisma.celebrity.count({ where }),
    ]);

    // Create pagination result
    const result = createPaginationResult(celebrities, total, paginationParams);

    // Cache the result
    await cacheManager.set(cacheKey, result, CACHE_CONFIGS.CELEBRITY);

    // Return response with cache headers
    const response = NextResponse.json({
      success: true,
      data: result,
    });

    response.headers.set('X-Cache', 'MISS');
    response.headers.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=300');
    response.headers.set('Vary', 'Accept-Language');
    Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    console.error('Get celebrities error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch celebrities',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/celebrities - Create new celebrity (Admin only)
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
    const validatedData = createCelebritySchema.parse(body);

    // Generate slug from name
    const slug = validatedData.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Check if celebrity with same name or slug already exists
    const existingCelebrity = await prisma.celebrity.findFirst({
      where: {
        OR: [
          { name: validatedData.name },
          { slug },
        ],
      },
    });

    if (existingCelebrity) {
      return NextResponse.json(
        {
          success: false,
          error: 'Celebrity with this name already exists',
        },
        { status: 409 }
      );
    }

    // Create celebrity
    const celebrity = await prisma.celebrity.create({
      data: {
        ...validatedData,
        slug,
        birthDate: validatedData.birthDate ? new Date(validatedData.birthDate) : null,
        isActive: true,
        isVerified: false,
        totalViews: BigInt(0),
        totalLikes: BigInt(0),
        totalShares: BigInt(0),
        reelsCount: 0,
      },
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
        createdAt: true,
        updatedAt: true,
      },
    });

    // Invalidate celebrity cache
    await cacheManager.invalidateByTag('celebrity');

    return NextResponse.json(
      {
        success: true,
        data: celebrity,
        message: 'Celebrity created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create celebrity error:', error);

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
        error: 'Failed to create celebrity',
      },
      { status: 500 }
    );
  }
}
