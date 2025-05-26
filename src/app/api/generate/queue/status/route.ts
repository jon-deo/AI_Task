import { NextRequest, NextResponse } from 'next/server';
import { videoGenerationQueue } from '@/services/queue-manager';

/**
 * GET /api/generate/queue/status - Get queue status
 */
export async function GET(request: NextRequest) {
  try {
    // Get queue status
    const queueStatus = videoGenerationQueue.getStatus();
    const queueMetrics = videoGenerationQueue.getMetrics();

    return NextResponse.json({
      success: true,
      data: {
        status: queueStatus,
        metrics: queueMetrics,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error getting queue status:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get queue status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
