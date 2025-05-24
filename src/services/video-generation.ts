import sharp from 'sharp';

import { AIScriptGenerationService, type ScriptGenerationRequest } from './ai-script-generation';
import { SpeechSynthesisService, type SpeechSynthesisRequest } from './speech-synthesis';
import { S3Service } from './s3';
import { VideoProcessingService } from './video-processing';
import type { Celebrity, VoiceType, GenerationJob } from '@/types';
import { prisma } from '@/lib/prisma';

export interface VideoGenerationRequest {
  celebrity: Celebrity;
  duration: number; // in seconds
  voiceType?: VoiceType;
  voiceRegion?: 'US' | 'UK' | 'AU';
  customPrompt?: string;
  imageUrls?: string[];
  style?: 'documentary' | 'energetic' | 'inspirational' | 'highlight';
  quality?: '720p' | '1080p';
  includeSubtitles?: boolean;
}

export interface VideoGenerationResult {
  jobId: string;
  videoUrl: string;
  videoS3Key: string;
  thumbnailUrl: string;
  thumbnailS3Key: string;
  audioUrl: string;
  audioS3Key: string;
  script: string;
  title: string;
  description: string;
  hashtags: string[];
  metadata: {
    duration: number;
    resolution: string;
    fileSize: number;
    generationTime: number;
    costs: {
      openai: number;
      polly: number;
      storage: number;
      total: number;
    };
  };
}

export interface VideoGenerationProgress {
  stage: 'script' | 'speech' | 'images' | 'video' | 'upload' | 'complete' | 'error';
  progress: number; // 0-100
  message: string;
  estimatedTimeRemaining?: number;
}

export class VideoGenerationService {
  /**
   * Generate complete video from celebrity data
   */
  static async generateVideo(
    request: VideoGenerationRequest,
    onProgress?: (progress: VideoGenerationProgress) => void
  ): Promise<VideoGenerationResult> {
    const startTime = Date.now();
    let generationJob: GenerationJob | null = null;

    try {
      // Create generation job in database
      generationJob = await prisma.generationJob.create({
        data: {
          celebrityId: request.celebrity.id,
          status: 'PROCESSING',
          prompt: request.customPrompt,
          voiceType: request.voiceType || 'MALE_NARRATOR',
          duration: request.duration,
          startedAt: new Date(),
        },
      });

      onProgress?.({
        stage: 'script',
        progress: 10,
        message: 'Generating AI script...',
        estimatedTimeRemaining: 180,
      });

      // Step 1: Generate script
      const scriptRequest: ScriptGenerationRequest = {
        celebrity: request.celebrity,
        duration: request.duration,
        voiceType: request.voiceType,
        customPrompt: request.customPrompt,
        style: this.getStylePrompt(request.style),
      };

      const scriptResult = await AIScriptGenerationService.generateScript(scriptRequest);

      // Update job with script
      await prisma.generationJob.update({
        where: { id: generationJob.id },
        data: {
          scriptGenerated: true,
          generatedScript: scriptResult.script,
          generatedTitle: scriptResult.title,
        },
      });

      onProgress?.({
        stage: 'speech',
        progress: 30,
        message: 'Synthesizing speech...',
        estimatedTimeRemaining: 120,
      });

      // Step 2: Generate speech
      const speechRequest: SpeechSynthesisRequest = {
        text: scriptResult.script,
        voiceType: request.voiceType || 'MALE_NARRATOR',
        voiceRegion: request.voiceRegion || 'US',
        outputFormat: 'mp3',
        useSSML: true,
      };

      const speechResult = await SpeechSynthesisService.synthesizeLongText(speechRequest, true);

      // Update job with voice
      await prisma.generationJob.update({
        where: { id: generationJob.id },
        data: {
          voiceGenerated: true,
        },
      });

      onProgress?.({
        stage: 'images',
        progress: 50,
        message: 'Processing images...',
        estimatedTimeRemaining: 90,
      });

      // Step 3: Prepare images
      const images = await this.prepareImages(request);

      onProgress?.({
        stage: 'video',
        progress: 70,
        message: 'Creating video...',
        estimatedTimeRemaining: 60,
      });

      // Step 4: Generate video
      const videoResult = await this.createVideo({
        audioBuffer: speechResult.combinedAudioUrl ? 
          await this.downloadAudioFromUrl(speechResult.combinedAudioUrl) :
          Buffer.concat(speechResult.chunks.map(chunk => chunk.audioBuffer)),
        images,
        duration: request.duration,
        resolution: request.quality || '1080p',
        script: scriptResult.script,
        includeSubtitles: request.includeSubtitles,
      });

      // Update job with video
      await prisma.generationJob.update({
        where: { id: generationJob.id },
        data: {
          videoGenerated: true,
          generatedVideoUrl: videoResult.videoUrl,
        },
      });

      onProgress?.({
        stage: 'upload',
        progress: 90,
        message: 'Finalizing upload...',
        estimatedTimeRemaining: 30,
      });

      // Step 5: Generate thumbnail
      const thumbnailResult = await this.generateThumbnail(
        videoResult.videoBuffer,
        request.celebrity
      );

      // Calculate costs
      const costs = this.calculateCosts(scriptResult, speechResult, videoResult);

      // Update job as completed
      await prisma.generationJob.update({
        where: { id: generationJob.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          totalCost: costs.total,
        },
      });

      onProgress?.({
        stage: 'complete',
        progress: 100,
        message: 'Video generation complete!',
      });

      const result: VideoGenerationResult = {
        jobId: generationJob.id,
        videoUrl: videoResult.videoUrl,
        videoS3Key: videoResult.videoS3Key,
        thumbnailUrl: thumbnailResult.url,
        thumbnailS3Key: thumbnailResult.key,
        audioUrl: speechResult.combinedAudioUrl || speechResult.chunks[0].audioUrl || '',
        audioS3Key: speechResult.combinedS3Key || speechResult.chunks[0].s3Key || '',
        script: scriptResult.script,
        title: scriptResult.title,
        description: scriptResult.description,
        hashtags: scriptResult.hashtags,
        metadata: {
          duration: request.duration,
          resolution: request.quality || '1080p',
          fileSize: videoResult.fileSize,
          generationTime: Date.now() - startTime,
          costs,
        },
      };

      return result;
    } catch (error) {
      // Update job as failed
      if (generationJob) {
        await prisma.generationJob.update({
          where: { id: generationJob.id },
          data: {
            status: 'FAILED',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            completedAt: new Date(),
          },
        });
      }

      onProgress?.({
        stage: 'error',
        progress: 0,
        message: `Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });

      throw error;
    }
  }

  /**
   * Prepare images for video generation
   */
  private static async prepareImages(request: VideoGenerationRequest): Promise<Buffer[]> {
    const images: Buffer[] = [];

    // Use provided images or celebrity image
    const imageUrls = request.imageUrls || [request.celebrity.imageUrl].filter(Boolean);

    for (const imageUrl of imageUrls) {
      try {
        // Download image
        const response = await fetch(imageUrl);
        if (!response.ok) continue;

        const imageBuffer = Buffer.from(await response.arrayBuffer());

        // Process image for video
        const processedImage = await sharp(imageBuffer)
          .resize(1920, 1080, { fit: 'cover', position: 'center' })
          .jpeg({ quality: 90 })
          .toBuffer();

        images.push(processedImage);
      } catch (error) {
        console.warn(`Failed to process image ${imageUrl}:`, error);
      }
    }

    // If no images available, create a placeholder
    if (images.length === 0) {
      const placeholder = await this.createPlaceholderImage(request.celebrity);
      images.push(placeholder);
    }

    return images;
  }

  /**
   * Create placeholder image for celebrity
   */
  private static async createPlaceholderImage(celebrity: Celebrity): Promise<Buffer> {
    const svg = `
      <svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad)" />
        <text x="50%" y="45%" font-family="Arial, sans-serif" font-size="72" 
              fill="white" text-anchor="middle" font-weight="bold">
          ${celebrity.name}
        </text>
        <text x="50%" y="55%" font-family="Arial, sans-serif" font-size="48" 
              fill="rgba(255,255,255,0.8)" text-anchor="middle">
          ${celebrity.sport} Legend
        </text>
      </svg>
    `;

    return sharp(Buffer.from(svg))
      .jpeg({ quality: 90 })
      .toBuffer();
  }

  /**
   * Create video from audio and images
   */
  private static async createVideo(params: {
    audioBuffer: Buffer;
    images: Buffer[];
    duration: number;
    resolution: string;
    script: string;
    includeSubtitles?: boolean;
  }): Promise<{
    videoBuffer: Buffer;
    videoUrl: string;
    videoS3Key: string;
    fileSize: number;
  }> {
    // In a real implementation, you would use FFmpeg to create the video
    // For now, we'll simulate video creation and upload the first image as a placeholder
    
    const { images, duration, resolution } = params;
    const videoBuffer = images[0]; // Placeholder - would be actual video

    // Upload video to S3
    const filename = `video_${Date.now()}_${Math.random().toString(36).substring(2)}.mp4`;
    
    const uploadResult = await S3Service.uploadFile(videoBuffer, {
      folder: 'VIDEOS',
      filename,
      contentType: 'video/mp4',
      metadata: {
        duration: duration.toString(),
        resolution,
        generatedAt: new Date().toISOString(),
        type: 'ai-generated',
      },
    });

    return {
      videoBuffer,
      videoUrl: uploadResult.cloudFrontUrl,
      videoS3Key: uploadResult.key,
      fileSize: videoBuffer.length,
    };
  }

  /**
   * Generate thumbnail for video
   */
  private static async generateThumbnail(
    videoBuffer: Buffer,
    celebrity: Celebrity
  ): Promise<{ key: string; url: string }> {
    // For now, create a thumbnail image
    // In production, extract frame from video
    const thumbnailBuffer = await this.createPlaceholderImage(celebrity);

    const filename = `thumb_${Date.now()}_${Math.random().toString(36).substring(2)}.jpg`;
    
    const uploadResult = await S3Service.uploadFile(thumbnailBuffer, {
      folder: 'THUMBNAILS',
      filename,
      contentType: 'image/jpeg',
      metadata: {
        celebrityId: celebrity.id,
        generatedAt: new Date().toISOString(),
      },
    });

    return {
      key: uploadResult.key,
      url: uploadResult.cloudFrontUrl,
    };
  }

  /**
   * Download audio from URL
   */
  private static async downloadAudioFromUrl(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.statusText}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  /**
   * Get style-specific prompt additions
   */
  private static getStylePrompt(style?: string): string {
    const stylePrompts = {
      documentary: 'Use a calm, informative documentary style with detailed facts and context.',
      energetic: 'Use an energetic, exciting tone with dynamic language and enthusiasm.',
      inspirational: 'Focus on the inspirational aspects of their journey and achievements.',
      highlight: 'Emphasize the most exciting career highlights and memorable moments.',
    };

    return stylePrompts[style as keyof typeof stylePrompts] || stylePrompts.documentary;
  }

  /**
   * Calculate generation costs
   */
  private static calculateCosts(
    scriptResult: any,
    speechResult: any,
    videoResult: any
  ): { openai: number; polly: number; storage: number; total: number } {
    // Simplified cost calculation
    const openaiCost = (scriptResult.metadata.tokensUsed / 1000) * 0.01; // $0.01 per 1K tokens
    const pollyCost = speechResult.totalDuration * 0.004; // $4 per 1M characters (approx)
    const storageCost = (videoResult.fileSize / (1024 * 1024 * 1024)) * 0.023; // $0.023 per GB

    return {
      openai: Math.round(openaiCost * 100) / 100,
      polly: Math.round(pollyCost * 100) / 100,
      storage: Math.round(storageCost * 100) / 100,
      total: Math.round((openaiCost + pollyCost + storageCost) * 100) / 100,
    };
  }

  /**
   * Get generation job status
   */
  static async getJobStatus(jobId: string): Promise<GenerationJob | null> {
    return await prisma.generationJob.findUnique({
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
  }

  /**
   * Cancel generation job
   */
  static async cancelJob(jobId: string): Promise<void> {
    await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
      },
    });
  }

  /**
   * Retry failed generation job
   */
  static async retryJob(jobId: string): Promise<VideoGenerationResult> {
    const job = await prisma.generationJob.findUnique({
      where: { id: jobId },
      include: { celebrity: true },
    });

    if (!job || !job.celebrity) {
      throw new Error('Job not found');
    }

    const request: VideoGenerationRequest = {
      celebrity: job.celebrity,
      duration: job.duration || 60,
      voiceType: job.voiceType || 'MALE_NARRATOR',
      customPrompt: job.prompt || undefined,
    };

    // Reset job status
    await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: 'PROCESSING',
        retryCount: { increment: 1 },
        startedAt: new Date(),
        errorMessage: null,
      },
    });

    return this.generateVideo(request);
  }
}
