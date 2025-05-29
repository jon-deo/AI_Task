import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import type {
  Celebrity,
  VideoReel,
  VideoStatus,
  Sport,
  VoiceType,
  PaginationInfo,
} from '@/types';

// ================================
// CELEBRITY SERVICES
// ================================

export class CelebrityService {
  static async getAll(params: {
    page?: number;
    limit?: number;
    sport?: Sport;
    isActive?: boolean;
    search?: string;
  } = {}) {
    const { page = 1, limit = 10, sport, isActive, search } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.CelebrityWhereInput = {
      ...(sport && { sport }),
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { biography: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [celebrities, total] = await Promise.all([
      prisma.celebrity.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.celebrity.count({ where }),
    ]);

    const pagination: PaginationInfo = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    };

    return { celebrities, pagination };
  }

  static async getById(id: string) {
    return await prisma.celebrity.findUnique({
      where: { id },
      include: {
        videoReels: {
          where: { status: 'COMPLETED', isPublic: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
  }

  static async getBySlug(slug: string) {
    return await prisma.celebrity.findUnique({
      where: { slug },
      include: {
        videoReels: {
          where: { status: 'COMPLETED', isPublic: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  static async create(data: Prisma.CelebrityCreateInput) {
    return await prisma.celebrity.create({
      data,
    });
  }

  static async update(id: string, data: Prisma.CelebrityUpdateInput) {
    return await prisma.celebrity.update({
      where: { id },
      data,
    });
  }
}

// ================================
// VIDEO REEL SERVICES
// ================================

export class VideoReelService {
  static async getAll(params: {
    page?: number;
    limit?: number;
    status?: VideoStatus;
    celebrityId?: string;
    isPublic?: boolean;
    isFeatured?: boolean;
    sortBy?: 'createdAt';
    sortOrder?: 'asc' | 'desc';
  } = {}) {
    const {
      page = 1,
      limit = 10,
      status,
      celebrityId,
      isPublic,
      isFeatured,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.VideoReelWhereInput = {
      ...(status && { status }),
      ...(celebrityId && { celebrityId }),
      ...(isPublic !== undefined && { isPublic }),
      ...(isFeatured !== undefined && { isFeatured }),
    };

    const [reels, total] = await Promise.all([
      prisma.videoReel.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          celebrity: {
            select: {
              id: true,
              name: true,
              slug: true,
              sport: true,
              imageUrl: true,
            },
          },
        },
      }),
      prisma.videoReel.count({ where }),
    ]);

    const pagination: PaginationInfo = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    };

    return { reels, pagination };
  }

  static async getById(id: string) {
    return await prisma.videoReel.findUnique({
      where: { id },
      include: {
        celebrity: {
          select: {
            id: true,
            name: true,
            slug: true,
            sport: true,
            imageUrl: true,
          },
        },
      },
    });
  }

  static async create(data: Prisma.VideoReelCreateInput) {
    return await prisma.videoReel.create({
      data,
    });
  }

  static async update(id: string, data: Prisma.VideoReelUpdateInput) {
    return await prisma.videoReel.update({
      where: { id },
      data,
    });
  }

  static async getFeaturedReels(limit: number = 5) {
    return await prisma.videoReel.findMany({
      where: {
        isFeatured: true,
        isPublic: true,
        status: 'COMPLETED',
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        celebrity: {
          select: {
            id: true,
            name: true,
            slug: true,
            sport: true,
            imageUrl: true,
          },
        },
      },
    });
  }
}
