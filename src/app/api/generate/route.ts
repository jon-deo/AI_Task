import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { videoGenerationQueue } from '@/services/queue-manager';
import { VideoGenerationService } from '@/services/video-generation';
import { CelebrityService } from '@/services/database';
import type { VideoGenerationRequest } from '@/services/video-generation';

// Request validation schema
const generateVideoRequestSchema = z.object({
  celebrityId: z.string().min(1),
  duration: z.number().min(15).max(120),
  voiceType: z.enum(['MALE_NARRATOR', 'FEMALE_NARRATOR', 'SPORTS_COMMENTATOR', 'DOCUMENTARY_STYLE', 'ENERGETIC_HOST', 'CALM_NARRATOR']).optional(),
  voiceRegion: z.enum(['US', 'UK', 'AU']).optional(),
  customPrompt: z.string().optional(),
  imageUrls: z.array(z.string().url()).optional(),
  style: z.enum(['documentary', 'energetic', 'inspirational', 'highlight']).optional(),
  quality: z.enum(['720p', '1080p']).optional(),
  includeSubtitles: z.boolean().optional(),
  priority: z.number().min(1).max(5).optional(),
  useQueue: z.boolean().optional(),
});

// Rate limiting (simple in-memory implementation)
const generateAttempts = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const maxAttempts = 5; // 5 generations per hour

  const attempts = generateAttempts.get(clientId);
  
  if (!attempts || now > attempts.resetTime) {
    generateAttempts.set(clientId, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (attempts.count >= maxAttempts) {
    return false;
  }

  attempts.count++;
  return true;
}

/**
 * POST /api/generate - Generate AI video
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = request.ip || 'unknown';
    if (!checkRateLimit(clientId)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Rate limit exceeded. Maximum 5 generations per hour.' 
        },
        { status: 429 }
      );
    }

    // Parse and validate request
    const body = await request.json();
    const validatedData = generateVideoRequestSchema.parse(body);

    // Get celebrity data
    const celebrity = await CelebrityService.getById(validatedData.celebrityId);
    if (!celebrity) {
      return NextResponse.json(
        { success: false, error: 'Celebrity not found' },
        { status: 404 }
      );
    }

    // Build generation request
    const generationRequest: VideoGenerationRequest = {
      celebrity,
      duration: validatedData.duration,
      voiceType: validatedData.voiceType,
      voiceRegion: validatedData.voiceRegion,
      customPrompt: validatedData.customPrompt,
      imageUrls: validatedData.imageUrls,
      style: validatedData.style,
      quality: validatedData.quality,
      includeSubtitles: validatedData.includeSubtitles,
    };

    // Check if should use queue or process immediately
    const useQueue = validatedData.useQueue !== false; // Default to true

    if (useQueue) {
      // Add to queue
      const jobId = await videoGenerationQueue.addJob(
        generationRequest,
        validatedData.priority || 3
      );

      return NextResponse.json({
        success: true,
        data: {
          jobId,
          status: 'queued',
          message: 'Video generation job added to queue',
          estimatedWaitTime: videoGenerationQueue.getMetrics().averageProcessingTime,
        },
      });
    } else {
      // Process immediately (for testing or high-priority requests)
      const result = await VideoGenerationService.generateVideo(generationRequest);

      return NextResponse.json({
        success: true,
        data: {
          ...result,
          status: 'completed',
        },
      });
    }
  } catch (error) {
    console.error('Video generation error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request parameters',
          details: error.errors 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Video generation failed' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/generate/status - Get generation job status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // Check queue first
    const queueJob = videoGenerationQueue.getJob(jobId);
    if (queueJob) {
      return NextResponse.json({
        success: true,
        data: {
          jobId,
          status: queueJob.error ? 'failed' : 
                 queueJob.progress?.stage === 'complete' ? 'completed' :
                 videoGenerationQueue.getStatus().processing ? 'processing' : 'queued',
          progress: queueJob.progress,
          error: queueJob.error,
          attempts: queueJob.attempts,
          maxAttempts: queueJob.maxAttempts,
          createdAt: queueJob.createdAt,
        },
      });
    }

    // Check database for completed/failed jobs
    const dbJob = await VideoGenerationService.getJobStatus(jobId);
    if (dbJob) {
      return NextResponse.json({
        success: true,
        data: {
          jobId,
          status: dbJob.status.toLowerCase(),
          celebrity: dbJob.celebrity,
          createdAt: dbJob.createdAt,
          startedAt: dbJob.startedAt,
          completedAt: dbJob.completedAt,
          error: dbJob.errorMessage,
          retryCount: dbJob.retryCount,
          videoUrl: dbJob.generatedVideoUrl,
          script: dbJob.generatedScript,
          title: dbJob.generatedTitle,
          totalCost: dbJob.totalCost,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Job not found' },
      { status: 404 }
    );
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Status check failed' 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/generate - Cancel generation job
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // Try to remove from queue first
    const removed = await videoGenerationQueue.removeJob(jobId);
    
    if (!removed) {
      // Try to cancel in database
      await VideoGenerationService.cancelJob(jobId);
    }

    return NextResponse.json({
      success: true,
      message: 'Job cancelled successfully',
    });
  } catch (error) {
    console.error('Job cancellation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Job cancellation failed' 
      },
      { status: 500 }
    );
  }
}
