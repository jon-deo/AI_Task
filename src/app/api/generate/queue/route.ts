import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { videoGenerationQueue } from '@/services/queue-manager';

// Request validation schemas
const queueActionSchema = z.object({
  action: z.enum(['pause', 'resume', 'clear']),
});

const queueFilterSchema = z.object({
  status: z.enum(['pending', 'active', 'completed', 'failed']).optional(),
  priority: z.number().min(1).max(5).optional(),
  limit: z.number().min(1).max(100).optional(),
});

/**
 * GET /api/generate/queue - Get queue status and jobs
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const filterParams = {
      status: searchParams.get('status'),
      priority: searchParams.get('priority') ? parseInt(searchParams.get('priority')!) : undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
    };

    // Validate filter parameters
    const validatedFilter = queueFilterSchema.parse(filterParams);

    // Get queue status
    const queueStatus = videoGenerationQueue.getStatus();
    const queueMetrics = videoGenerationQueue.getMetrics();

    // Get jobs with filtering
    const jobs = videoGenerationQueue.getJobs(validatedFilter);

    return NextResponse.json({
      success: true,
      data: {
        status: queueStatus,
        metrics: queueMetrics,
        jobs: jobs.map(job => ({
          id: job.id,
          celebrityName: job.request.celebrity.name,
          celebritySport: job.request.celebrity.sport,
          duration: job.request.duration,
          priority: job.priority,
          attempts: job.attempts,
          maxAttempts: job.maxAttempts,
          createdAt: job.createdAt,
          progress: job.progress,
          error: job.error,
          status: job.error ? 'failed' : 
                 job.progress?.stage === 'complete' ? 'completed' :
                 queueStatus.processing && queueStatus.activeJobs > 0 ? 'processing' : 'pending',
        })),
      },
    });
  } catch (error) {
    console.error('Queue status error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid query parameters',
          details: error.errors 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Queue status check failed' 
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/generate/queue - Queue management actions
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = queueActionSchema.parse(body);

    let result: any = {};

    switch (action) {
      case 'pause':
        videoGenerationQueue.pause();
        result = { message: 'Queue paused successfully' };
        break;

      case 'resume':
        videoGenerationQueue.resume();
        result = { message: 'Queue resumed successfully' };
        break;

      case 'clear':
        await videoGenerationQueue.clear();
        result = { message: 'Queue cleared successfully' };
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Queue action error:', error);
    
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
        error: error instanceof Error ? error.message : 'Queue action failed' 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/generate/queue - Remove specific job from queue
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

    const removed = await videoGenerationQueue.removeJob(jobId);

    if (!removed) {
      return NextResponse.json(
        { success: false, error: 'Job not found or cannot be removed' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Job removed from queue successfully',
    });
  } catch (error) {
    console.error('Queue job removal error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Job removal failed' 
      },
      { status: 500 }
    );
  }
}
