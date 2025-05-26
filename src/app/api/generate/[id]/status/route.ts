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

    // First, try to find the video in the simple Video table (used by /api/generate)
    const video = await prisma.video.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        status: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
        s3Url: true,
      },
    });

    if (video) {
      // Extract status from metadata if available
      const metadata = video.metadata as any;
      const status = metadata?.status || video.status || 'UNKNOWN';

      return NextResponse.json({
        success: true,
        data: {
          id: video.id,
          status: status,
          title: video.title,
          videoUrl: video.s3Url,
          createdAt: video.createdAt,
          updatedAt: video.updatedAt,
          metadata: metadata,
        },
      });
    }

    // Try to find in VideoReel table
    const videoReel = await prisma.videoReel.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        status: true,
        videoUrl: true,
        createdAt: true,
        updatedAt: true,
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
          createdAt: videoReel.createdAt,
          updatedAt: videoReel.updatedAt,
          celebrity: videoReel.celebrity,
        },
      });
    }

    // If not found in database, check if it's in the queue
    const queueJobs = videoGenerationQueue.getJobs({});
    const queueJob = queueJobs.find(job =>
      job.id === id ||
      job.request?.videoId === id ||
      job.request?.reelId === id
    );

    if (queueJob) {
      const status = queueJob.error ? 'FAILED' :
                   queueJob.progress?.stage === 'complete' ? 'COMPLETED' :
                   videoGenerationQueue.getStatus().processing ? 'PROCESSING' : 'PENDING';

      return NextResponse.json({
        success: true,
        data: {
          id: queueJob.id,
          status: status,
          progress: queueJob.progress,
          error: queueJob.error,
          attempts: queueJob.attempts,
          maxAttempts: queueJob.maxAttempts,
          createdAt: queueJob.createdAt,
          celebrity: queueJob.request?.celebrity?.name,
        },
      });
    }

    // Not found anywhere
    return NextResponse.json(
      { success: false, error: 'Video/reel not found' },
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
