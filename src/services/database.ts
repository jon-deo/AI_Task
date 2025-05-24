import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import type {
  Celebrity,
  VideoReel,
  User,
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
        orderBy: { totalViews: 'desc' },
        include: {
          _count: {
            select: { videoReels: true },
          },
        },
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
        _count: {
          select: { videoReels: true, userLikes: true },
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
          orderBy: { views: 'desc' },
        },
        _count: {
          select: { videoReels: true, userLikes: true },
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

  static async incrementViews(id: string, count: number = 1) {
    return await prisma.celebrity.update({
      where: { id },
      data: {
        totalViews: { increment: count },
      },
    });
  }

  static async getTopCelebrities(limit: number = 10) {
    return await prisma.celebrity.findMany({
      where: { isActive: true },
      orderBy: { totalViews: 'desc' },
      take: limit,
      include: {
        _count: {
          select: { videoReels: true },
        },
      },
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
    sortBy?: 'createdAt' | 'views' | 'likes';
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
          _count: {
            select: {
              userLikes: true,
              userShares: true,
              comments: true,
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
        celebrity: true,
        _count: {
          select: {
            userLikes: true,
            userShares: true,
            userViews: true,
            comments: true,
          },
        },
      },
    });
  }

  static async create(data: Prisma.VideoReelCreateInput) {
    return await prisma.videoReel.create({
      data,
      include: {
        celebrity: true,
      },
    });
  }

  static async update(id: string, data: Prisma.VideoReelUpdateInput) {
    return await prisma.videoReel.update({
      where: { id },
      data,
    });
  }

  static async incrementViews(id: string, count: number = 1) {
    return await prisma.videoReel.update({
      where: { id },
      data: {
        views: { increment: count },
      },
    });
  }

  static async incrementLikes(id: string, count: number = 1) {
    return await prisma.videoReel.update({
      where: { id },
      data: {
        likes: { increment: count },
      },
    });
  }

  static async incrementShares(id: string, count: number = 1) {
    return await prisma.videoReel.update({
      where: { id },
      data: {
        shares: { increment: count },
      },
    });
  }

  static async getFeaturedReels(limit: number = 5) {
    return await prisma.videoReel.findMany({
      where: {
        isFeatured: true,
        isPublic: true,
        status: 'COMPLETED',
      },
      orderBy: { views: 'desc' },
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

  static async getTrendingReels(limit: number = 10) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    return await prisma.videoReel.findMany({
      where: {
        isPublic: true,
        status: 'COMPLETED',
        createdAt: { gte: oneDayAgo },
      },
      orderBy: [
        { views: 'desc' },
        { likes: 'desc' },
      ],
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

// ================================
// USER SERVICES
// ================================

export class UserService {
  static async getById(id: string) {
    return await prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            videoLikes: true,
            videoShares: true,
            comments: true,
          },
        },
      },
    });
  }

  static async getByEmail(email: string) {
    return await prisma.user.findUnique({
      where: { email },
    });
  }

  static async getByUsername(username: string) {
    return await prisma.user.findUnique({
      where: { username },
    });
  }

  static async create(data: Prisma.UserCreateInput) {
    return await prisma.user.create({
      data,
    });
  }

  static async update(id: string, data: Prisma.UserUpdateInput) {
    return await prisma.user.update({
      where: { id },
      data,
    });
  }

  static async updateLastActive(id: string) {
    return await prisma.user.update({
      where: { id },
      data: {
        lastActiveAt: new Date(),
      },
    });
  }
}

// ================================
// USER INTERACTION SERVICES
// ================================

export class UserInteractionService {
  static async likeVideo(userId: string, videoId: string) {
    try {
      const like = await prisma.userVideoLike.create({
        data: { userId, videoId },
      });

      // Increment video likes count
      await VideoReelService.incrementLikes(videoId);

      return like;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error('Video already liked by user');
        }
      }
      throw error;
    }
  }

  static async unlikeVideo(userId: string, videoId: string) {
    const deleted = await prisma.userVideoLike.delete({
      where: {
        userId_videoId: { userId, videoId },
      },
    });

    // Decrement video likes count
    await VideoReelService.incrementLikes(videoId, -1);

    return deleted;
  }

  static async shareVideo(
    userId: string,
    videoId: string,
    platform: string
  ) {
    const share = await prisma.userVideoShare.create({
      data: {
        userId,
        videoId,
        platform: platform as any,
      },
    });

    // Increment video shares count
    await VideoReelService.incrementShares(videoId);

    return share;
  }

  static async recordVideoView(
    userId: string,
    videoId: string,
    watchDuration: number,
    completionRate: number,
    deviceType?: string
  ) {
    const view = await prisma.userVideoView.create({
      data: {
        userId,
        videoId,
        watchDuration,
        completionRate,
        isCompleted: completionRate >= 80,
        deviceType,
      },
    });

    // Increment video views count
    await VideoReelService.incrementViews(videoId);

    return view;
  }

  static async getUserLikedVideos(userId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    return await prisma.userVideoLike.findMany({
      where: { userId },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        video: {
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
        },
      },
    });
  }

  static async isVideoLikedByUser(userId: string, videoId: string) {
    const like = await prisma.userVideoLike.findUnique({
      where: {
        userId_videoId: { userId, videoId },
      },
    });

    return !!like;
  }
}
