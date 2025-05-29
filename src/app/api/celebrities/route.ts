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
    console.log('Starting GET /api/celebrities request');

    // Try a simple query first without pagination
    const celebrities = await prisma.celebrity.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        sport: true,
      },
    });

    console.log('Found celebrities:', celebrities);

    return NextResponse.json({
      success: true,
      data: {
        items: celebrities,
        total: celebrities.length,
        page: 1,
        limit: celebrities.length,
      },
    });

  } catch (error: unknown) {
    console.error('Get celebrities error:', error);

    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch celebrities',
        details: error instanceof Error ? error.message : 'Unknown error'
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
        sport: validatedData.sport as any, // Cast to any to bypass type mismatch
        slug,
        birthDate: validatedData.birthDate ? new Date(validatedData.birthDate) : null,
        isActive: true,
        isVerified: false,
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

    console.log('✅ Created celebrity:', celebrity);

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
