import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { videoGenerationQueue } from '@/services/queue-manager';
import type { Job } from 'bullmq';

interface VideoMetadata {
  status?: string;
  [key: string]: any;
}

interface QueueJobRequest {
  videoId?: string;
  reelId?: string;
  celebrity?: {
    name: string;
  };
}

interface QueueJobProgress {
  stage?: string;
  [key: string]: any;
}

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
      const metadata = video.metadata as VideoMetadata;
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
    const queueJobs = await videoGenerationQueue.getJobs({ status: 'active' }) as unknown as Job<QueueJobRequest>[];
    const queueJob = queueJobs.find(job => {
      const request = job.data;
      return job.id === id || request.videoId === id || request.reelId === id;
    });

    if (queueJob) {
      const progress = queueJob.progress as QueueJobProgress;
      const status = queueJob.failedReason ? 'FAILED' :
                   progress?.stage === 'complete' ? 'COMPLETED' :
                   videoGenerationQueue.getStatus().processing ? 'PROCESSING' : 'PENDING';

      return NextResponse.json({
        success: true,
        data: {
          id: queueJob.id,
          status: status,
          progress: progress,
          error: queueJob.failedReason,
          attempts: queueJob.attemptsMade,
          maxAttempts: queueJob.opts?.attempts || 1,
          createdAt: queueJob.timestamp,
          celebrity: queueJob.data?.celebrity?.name,
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
