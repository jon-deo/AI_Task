import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { videoGenerationQueue } from '@/services/queue-manager';

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET /api/generate/[id]/status - Get generation status by reel/video ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID is required' },
        { status: 400 }
      );
    }

    // Try to find in VideoReel table
    const videoReel = await prisma.videoReel.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        status: true,
        videoUrl: true,
        thumbnailUrl: true,
        createdAt: true,
        updatedAt: true,
        duration: true,
        fileSize: true,
        resolution: true,
        bitrate: true,
        format: true,
        s3Key: true,
        s3Bucket: true,
        cloudFrontUrl: true,
        celebrity: {
          select: {
            name: true,
            sport: true,
          },
        },
      },
    });

    if (videoReel) {
      return NextResponse.json({
        success: true,
        data: {
          id: videoReel.id,
          status: videoReel.status,
          title: videoReel.title,
          videoUrl: videoReel.videoUrl,
          thumbnailUrl: videoReel.thumbnailUrl,
          duration: videoReel.duration,
          fileSize: videoReel.fileSize?.toString(),
          resolution: videoReel.resolution,
          bitrate: videoReel.bitrate,
          format: videoReel.format,
          s3Key: videoReel.s3Key,
          s3Bucket: videoReel.s3Bucket,
          cloudFrontUrl: videoReel.cloudFrontUrl,
          createdAt: videoReel.createdAt,
          updatedAt: videoReel.updatedAt,
          celebrity: videoReel.celebrity,
        },
      });
    }

    // If not found in database, check if it's in the queue (GenerationJob)
    const generationJob = await prisma.generationJob.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        progress: true,
        error: true,
        voiceType: true,
        createdAt: true,
        updatedAt: true,
        celebrity: {
          select: {
            name: true,
            sport: true,
          },
        },
      } as any,
    });

    if (generationJob) {
      return NextResponse.json({
        success: true,
        data: {
          id: generationJob.id,
          status: generationJob.status,
          title: `Generation Job for ${(generationJob.celebrity as any)?.name || 'Unknown Celebrity'}`,
          videoUrl: null,
          progress: generationJob.progress,
          errorMessage: generationJob.error,
          createdAt: generationJob.createdAt,
          updatedAt: generationJob.updatedAt,
          celebrity: generationJob.celebrity,
          voiceType: generationJob.voiceType,
        } as any,
      });
    }

    // Not found anywhere
    return NextResponse.json(
      { success: false, error: 'Video/reel or generation job not found' },
      { status: 404 }
    );
  } catch (error) {
    console.error('Error getting generation status:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get generation status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
