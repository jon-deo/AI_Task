import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { videoGenerationQueue } from '@/services/queue-manager';
import { VideoGenerationService } from '@/services/video-generation';
import { CelebrityService } from '@/services/database';
import type { VideoGenerationRequest } from '@/services/video-generation';
import { generateVideo } from '@/lib/ai/generate';
import { prisma } from '@/lib/db/prisma';
import { SimpleVideoComposer } from '@/services/simple-video-composer';
import { AIScriptGenerationService } from '@/services/ai-script-generation';
import { SpeechSynthesisService } from '@/services/speech-synthesis';
import { S3Service } from '@/services/s3';
import { VoiceType, type GenerationJob } from '@/types';

// Request validation schema
const generateVideoRequestSchema = z.object({
  celebrityId: z.string().min(1),
  duration: z.number().min(15).max(120),
  voiceType: z.nativeEnum(VoiceType).optional(),
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
 * Generate REAL MP4 video using FFmpeg (simplified, working version)
 */
async function generateRealVideo(celebrityName: string) {
  try {
    // Get celebrity from database
    const celebrity = await prisma.celebrity.findFirst({
      where: { name: celebrityName },
    });

    if (!celebrity) {
      throw new Error('Celebrity not found');
    }

    // Step 1: Generate AI script
    console.log('📝 Generating AI script...');
    const scriptResult = await AIScriptGenerationService.generateScript({
      celebrity,
      duration: 30,
      voiceType: VoiceType.MALE_NARRATOR,
      customPrompt: '',
      style: 'Create an engaging highlight reel script',
    });
    console.log('✅ Script generated successfully');

    // Step 2: Generate speech
    console.log('🎵 Generating speech...');
    const speechResult = await SpeechSynthesisService.synthesizeLongText({
      text: scriptResult.script,
      voiceType: VoiceType.MALE_NARRATOR,
      voiceRegion: 'US',
      outputFormat: 'mp3',
      useSSML: true,
    }, true);
    console.log('✅ Speech generated successfully');

    // Step 3: Create REAL MP4 video with FFmpeg (simplified approach)
    console.log('🎥 Creating real MP4 video with FFmpeg...');

    let audioBuffer: Buffer;
    let audioUrl = '';
    try {
      // Prioritize using audio buffers directly instead of downloading from URLs
      if (speechResult.chunks && speechResult.chunks.length > 0) {
        // Filter out any chunks without audioBuffer and ensure we have valid chunks
        const validChunks = speechResult.chunks.filter(chunk => chunk && chunk.audioBuffer);
        if (validChunks.length === 0) {
          throw new Error('No valid audio chunks generated from speech synthesis');
        }
        // Combine all valid chunks
        audioBuffer = Buffer.concat(validChunks.map(chunk => chunk.audioBuffer));
        // Get the first valid chunk's URL (if available)
        audioUrl = validChunks[0]?.audioUrl || '';
        console.log(`📊 Using combined audio buffer from ${validChunks.length} chunks`);
      } else if (speechResult.combinedAudioUrl) {
        // Only try to download if no audio buffers are available
        console.log(`📊 Attempting to download audio from URL: ${speechResult.combinedAudioUrl}`);
        audioBuffer = await downloadAudioFromUrl(speechResult.combinedAudioUrl);
        audioUrl = speechResult.combinedAudioUrl;
      } else {
        throw new Error('No audio data available from speech synthesis');
      }

      if (!audioBuffer || audioBuffer.length === 0) {
        throw new Error('Generated audio buffer is empty');
      }

      console.log(`📊 Audio buffer size: ${audioBuffer.length} bytes`);
    } catch (error) {
      console.error('Error processing audio:', error);
      throw new Error(`Audio processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const compositionResult = await SimpleVideoComposer.createSimpleVideo({
      audioBuffer,
      duration: 30,
      celebrityName,
      script: scriptResult.script,
    });

    console.log(`✅ FFmpeg composition complete! Video size: ${compositionResult.videoBuffer.length} bytes`);

    // Step 5: Upload REAL MP4 video to S3
    console.log('☁️  Uploading real MP4 video to S3...');

    const filename = `video_${Date.now()}_${Math.random().toString(36).substring(2)}.mp4`;
    const uploadResult = await S3Service.uploadFile(compositionResult.videoBuffer, {
      folder: 'VIDEOS',
      filename,
      contentType: 'video/mp4',
      metadata: {
        duration: '30',
        resolution: compositionResult.metadata.resolution,
        generatedAt: new Date().toISOString(),
        type: 'ai-generated-real-mp4', // Mark as real MP4
        celebrity: celebrityName,
        ffmpegGenerated: 'true',
      },
    });

    console.log(`✅ Real MP4 video uploaded to S3: ${uploadResult.url}`);

    // Cleanup temp files
    await SimpleVideoComposer.cleanup(compositionResult.tempFiles);

    return {
      title: scriptResult.title,
      description: scriptResult.description,
      script: scriptResult.script,
      videoUrl: uploadResult.url,
      videoS3Key: uploadResult.key,
      thumbnailUrl: uploadResult.url, // Use video URL as thumbnail for now
      audioUrl: audioUrl,
      metadata: {
        duration: 30,
        resolution: compositionResult.metadata.resolution,
        fileSize: compositionResult.metadata.fileSize,
        costs: {
          script: 0.01,
          speech: 0.05,
          video: 0.02,
          total: 0.08,
        },
      },
    };
  } catch (error) {
    console.error('Simplified video generation failed:', error);
    throw new Error(`Video generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Download audio from URL
 */
async function downloadAudioFromUrl(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download audio: ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

/**
 * POST /api/generate - Generate AI video with real FFmpeg composition
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Handle simple celebrity name input (for backward compatibility)
    if (typeof body === 'string' || body.celebrity) {
      let celebrityName: string;

      if (typeof body === 'string') {
        celebrityName = body;
      } else if (typeof body.celebrity === 'string') {
        celebrityName = body.celebrity;
      } else if (typeof body.celebrity === 'object' && body.celebrity.name) {
        // Handle celebrity object with name property
        celebrityName = body.celebrity.name;
      } else {
        return NextResponse.json(
          { error: 'Celebrity name is required' },
          { status: 400 }
        );
      }

      if (!celebrityName || typeof celebrityName !== 'string') {
        return NextResponse.json(
          { error: 'Celebrity name must be a valid string' },
          { status: 400 }
        );
      }

      console.log(`🎬 Starting REAL video generation for: ${celebrityName}`);

      // Generate REAL MP4 video using FFmpeg
      const result = await generateRealVideo(celebrityName);

      console.log(`✅ Real video generated: ${result.videoUrl}`);

      // Create video record in database with the REAL video URL
      const video = await prisma.video.create({
        data: {
          title: result.title,
          description: result.description,
          s3Url: result.videoUrl, // This is now the REAL MP4 video URL
          metadata: {
            celebrity: celebrityName,
            script: result.script,
            status: 'COMPLETED',
            videoS3Key: result.videoS3Key,
            thumbnailUrl: result.thumbnailUrl,
            audioUrl: result.audioUrl,
            duration: result.metadata.duration,
            resolution: result.metadata.resolution,
            fileSize: result.metadata.fileSize,
            costs: result.metadata.costs,
          },
        },
      });

      // Get celebrity from database for VideoReel creation
      const celebrity = await prisma.celebrity.findFirst({
        where: { name: celebrityName },
      });

      if (!celebrity) {
        return NextResponse.json(
          { success: false, error: 'Celebrity not found' },
          { status: 404 }
        );
      }

      // Also create a corresponding VideoReel record for API compatibility
      const slug = result.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      // Ensure unique slug
      let uniqueSlug = slug;
      let counter = 1;
      while (await prisma.videoReel.findFirst({ where: { slug: uniqueSlug } })) {
        uniqueSlug = `${slug}-${counter}`;
        counter++;
      }

      try {
        console.log('Creating VideoReel with data:', {
          title: result.title,
          celebrityId: celebrity.id,
          videoUrl: result.videoUrl,
          duration: result.metadata.duration,
          slug: uniqueSlug,
        });

        const videoReel = await prisma.videoReel.create({
          data: {
            // Let Prisma generate a new ID for the VideoReel
            title: result.title,
            description: result.description,
            celebrityId: celebrity.id,
            videoUrl: result.videoUrl,
            thumbnailUrl: result.thumbnailUrl,
            duration: result.metadata.duration,
            script: result.script,
            slug: uniqueSlug,
            isPublic: true, // Make generated reels public for testing
            isFeatured: false,
            views: BigInt(0),
            likes: BigInt(0),
            shares: BigInt(0),
            comments: BigInt(0),
            fileSize: BigInt(result.metadata.fileSize),
            resolution: result.metadata.resolution,
            bitrate: '2000',
            format: 'mp4',
            status: 'COMPLETED',
            s3Key: result.videoS3Key,
            s3Bucket: 'your-bucket-name', // You might want to make this configurable
          },
        });

        console.log('VideoReel created successfully with ID:', videoReel.id);

        return NextResponse.json({
          success: true,
          id: videoReel.id, // Return the VideoReel ID so it can be accessed via /api/reels/[id]
          data: video,
        });
      } catch (videoReelError) {
        console.error('Failed to create VideoReel:', videoReelError);
        // Return the video ID as fallback
        return NextResponse.json({
          success: true,
          id: video.id,
          data: video,
        });
      }
    }

    // Handle full request object (for advanced usage)
    const validatedData = generateVideoRequestSchema.parse(body);

    // Rate limiting
    const clientId = req.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(clientId)) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    // Get celebrity from database
    const celebrity = await prisma.celebrity.findUnique({
      where: { id: validatedData.celebrityId },
      include: {
        videoReels: true,
      },
    });

    if (!celebrity) {
      return NextResponse.json(
        { success: false, error: 'Celebrity not found' },
        { status: 404 }
      );
    }

    const request: VideoGenerationRequest = {
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

    if (validatedData.useQueue) {
      // Add to queue for background processing
      const jobId = await videoGenerationQueue.addJob(request, validatedData.priority || 3);

      return NextResponse.json({
        success: true,
        data: {
          jobId,
          status: 'queued',
          message: 'Video generation job added to queue',
        },
      });
    } else {
      // Generate immediately
      const result = await VideoGenerationService.generateVideo(request);

      return NextResponse.json({
        success: true,
        data: result,
      });
    }
  } catch (error) {
    console.error('Error in video generation:', error);

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
    const dbJob = await prisma.generationJob.findUnique({
      where: { id: jobId },
      include: {
        celebrity: {
          select: {
            id: true,
            name: true,
            sport: true,
          },
        },
      },
    });

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
