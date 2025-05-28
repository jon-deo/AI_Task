import sharp from 'sharp';

import { AIScriptGenerationService, type ScriptGenerationRequest } from './ai-script-generation';
import { SpeechSynthesisService, type SpeechSynthesisRequest } from './speech-synthesis';
import { VideoComposer } from './video-composer';
import { ImageGenerator } from './image-generator';
import { S3Service } from './s3';
import type { Celebrity } from '@/types';
import { VoiceType } from '@/types';
import { prisma } from '@/lib/prisma';
import type { GenerationJob, GenerationStatus } from '@prisma/client';

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

export interface VideoProcessingOptions {
  generateThumbnail?: boolean;
  thumbnailTimestamp?: number; // seconds
  compressionLevel?: 'low' | 'medium' | 'high';
  targetResolution?: '480p' | '720p' | '1080p';
  targetBitrate?: string;
}

export interface VideoProcessingResult {
  videoUrl: string;
  videoS3Key: string;
  cloudFrontUrl: string;
  thumbnailUrl: string | undefined;
  thumbnailS3Key: string | undefined;
  thumbnailCloudFrontUrl: string | undefined;
  metadata: {
    duration: number;
    resolution: string;
    fileSize: number;
    format: string;
    bitrate: string;
    codec: string;
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
    let generationJob: { id: string } | null = null;

    try {
      // Create generation job in database
      const job = await prisma.generationJob.create({
        data: {
          celebrityId: request.celebrity.id,
          status: 'PROCESSING',
          prompt: request.customPrompt || null,
          voiceType: request.voiceType || VoiceType.MALE_NARRATOR,
          duration: request.duration,
          startedAt: new Date(),
        },
      });
      generationJob = { id: job.id };

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
        voiceType: request.voiceType || VoiceType.MALE_NARRATOR,
        customPrompt: request.customPrompt || '',
        style: this.getStylePrompt(request.style),
      };

      const scriptResult = await AIScriptGenerationService.generateScript(scriptRequest);

      // Update job with script
      if (generationJob) {
        await prisma.generationJob.update({
          where: { id: generationJob.id },
          data: {
            scriptGenerated: true,
            generatedScript: scriptResult.script,
            generatedTitle: scriptResult.title,
          },
        });
      }

      onProgress?.({
        stage: 'speech',
        progress: 30,
        message: 'Synthesizing speech...',
        estimatedTimeRemaining: 120,
      });

      // Step 2: Generate speech
      const speechRequest: SpeechSynthesisRequest = {
        text: scriptResult.script,
        voiceType: request.voiceType || VoiceType.MALE_NARRATOR,
        voiceRegion: request.voiceRegion || 'US',
        outputFormat: 'mp3',
        useSSML: true,
      };

      const speechResult = await SpeechSynthesisService.synthesizeLongText(speechRequest, true);

      // Update job with voice
      if (generationJob) {
        await prisma.generationJob.update({
          where: { id: generationJob.id },
          data: {
            voiceGenerated: true,
          },
        });
      }

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
        includeSubtitles: request.includeSubtitles || false,
      });

      // Update job with video
      if (generationJob) {
        await prisma.generationJob.update({
          where: { id: generationJob.id },
          data: {
            videoGenerated: true,
            generatedVideoUrl: videoResult.videoUrl,
          },
        });
      }

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
      if (generationJob) {
        await prisma.generationJob.update({
          where: { id: generationJob.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            totalCost: costs.total,
          },
        });
      }

      onProgress?.({
        stage: 'complete',
        progress: 100,
        message: 'Video generation complete!',
      });

      const result: VideoGenerationResult = {
        jobId: generationJob?.id || '',
        videoUrl: videoResult.videoUrl,
        videoS3Key: videoResult.videoS3Key,
        thumbnailUrl: thumbnailResult.url,
        thumbnailS3Key: thumbnailResult.key,
        audioUrl: speechResult.combinedAudioUrl || speechResult.chunks[0]?.audioUrl || '',
        audioS3Key: speechResult.combinedS3Key || speechResult.chunks[0]?.s3Key || '',
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
    } catch (error: any) {
      if (generationJob) {
        await prisma.generationJob.update({
          where: { id: generationJob.id },
          data: {
            status: 'FAILED',
            errorMessage: error.message || 'Unknown error',
          },
        });
      }

      throw error;
    }
  }

  /**
   * Process and upload video with optional thumbnail generation
   */
  static async processAndUploadVideo(
    videoBuffer: Buffer,
    filename: string,
    options: VideoProcessingOptions = {}
  ): Promise<VideoProcessingResult> {
    try {
      // Generate unique filename
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 15);
      const videoFilename = `${timestamp}_${randomId}_${filename}`;

      // Upload original video
      const videoUploadResult = await S3Service.uploadFile(videoBuffer, {
        folder: 'VIDEOS',
        filename: videoFilename,
        contentType: 'video/mp4',
        metadata: {
          originalFilename: filename,
          processedAt: new Date().toISOString(),
          compressionLevel: options.compressionLevel || 'medium',
        },
      });

      // Extract video metadata (simplified - in production use ffprobe)
      const metadata = await this.extractVideoMetadata(videoBuffer);

      let thumbnailKey: string | undefined;
      let thumbnailUrl: string | undefined;
      let thumbnailCloudFrontUrl: string | undefined;

      // Generate thumbnail if requested
      if (options.generateThumbnail) {
        const thumbnailResult = await this.generateAndUploadThumbnail(
          videoBuffer,
          videoFilename,
          {
            timestamp: options.thumbnailTimestamp || 0,
            width: 640,
            height: 360,
            quality: 80,
            format: 'jpeg',
          }
        );

        thumbnailKey = thumbnailResult.key;
        thumbnailUrl = thumbnailResult.url;
        thumbnailCloudFrontUrl = thumbnailResult.cloudFrontUrl;
      }

      return {
        videoUrl: videoUploadResult.url,
        videoS3Key: videoUploadResult.key,
        cloudFrontUrl: videoUploadResult.url,
        thumbnailUrl,
        thumbnailS3Key: thumbnailKey,
        thumbnailCloudFrontUrl,
        metadata,
      };
    } catch (error: any) {
      console.error('Video processing error:', error);
      throw new Error(`Video processing failed: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Generate and upload thumbnail from video
   */
  private static async generateAndUploadThumbnail(
    videoBuffer: Buffer,
    videoFilename: string,
    options: {
      timestamp?: number;
      width?: number;
      height?: number;
      quality?: number;
      format?: 'jpeg' | 'png';
    } = {}
  ): Promise<{
    key: string;
    url: string;
    cloudFrontUrl: string;
  }> {
    try {
      // In a real implementation, you would use ffmpeg to extract frame
      // For now, we'll create a placeholder thumbnail
      const thumbnailBuffer = await this.createPlaceholderThumbnail(
        options.width || 640,
        options.height || 360,
        options.quality || 80
      );

      const thumbnailFilename = videoFilename.replace(/\.[^/.]+$/, '_thumb.jpg');

      const uploadResult = await S3Service.uploadFile(thumbnailBuffer, {
        folder: 'THUMBNAILS',
        filename: thumbnailFilename,
        contentType: 'image/jpeg',
        metadata: {
          sourceVideo: videoFilename,
          timestamp: (options.timestamp || 0).toString(),
          generatedAt: new Date().toISOString(),
        },
      });

      return {
        key: uploadResult.key,
        url: uploadResult.url,
        cloudFrontUrl: uploadResult.url,
      };
    } catch (error) {
      console.error('Thumbnail generation failed:', error);
      throw new Error(`Thumbnail generation failed: ${error}`);
    }
  }

  /**
   * Extract video metadata
   */
  private static async extractVideoMetadata(videoBuffer: Buffer): Promise<{
    duration: number;
    resolution: string;
    fileSize: number;
    format: string;
    bitrate: string;
    codec: string;
  }> {
    // In a real implementation, use ffprobe to extract metadata
    // For now, return placeholder data
    return {
      duration: 0,
      resolution: '1920x1080',
      fileSize: videoBuffer.length,
      format: 'mp4',
      bitrate: '0',
      codec: 'h264',
    };
  }

  /**
   * Create placeholder thumbnail
   */
  private static async createPlaceholderThumbnail(
    width: number,
    height: number,
    quality: number
  ): Promise<Buffer> {
    // Create a simple gradient background
    return sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .jpeg({ quality })
      .toBuffer();
  }

  /**
   * Prepare images for video generation
   */
  private static async prepareImages(request: VideoGenerationRequest): Promise<Buffer[]> {
    const images: Buffer[] = [];

    // Use provided images or celebrity image
    const imageUrls = (request.imageUrls || [request.celebrity.imageUrl]).filter((url): url is string => Boolean(url));

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

    // If no images available, generate celebrity images
    if (images.length === 0) {
      const generatedImages = await ImageGenerator.generateCelebrityImages(
        request.celebrity,
        3, // Generate 3 images for variety
        {
          width: 1920,
          height: 1080,
          quality: 90,
          format: 'jpeg',
        }
      );
      images.push(...generatedImages);
    }

    return images;
  }

  /**
   * Create placeholder image for celebrity
   */
  private static async createPlaceholderImage(celebrity: Celebrity): Promise<Buffer> {
    // Create a simple gradient background with text
    return sharp({
      create: {
        width: 1920,
        height: 1080,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .jpeg({ quality: 90 })
      .toBuffer();
  }

  /**
   * Create video from audio and images using FFmpeg
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
    const { audioBuffer, images, duration, resolution, script, includeSubtitles } = params;

    try {
      // Use VideoComposer to create the actual video
      const compositionResult = await VideoComposer.composeVideo({
        audioBuffer,
        images,
        duration,
        resolution: resolution as '480p' | '720p' | '1080p',
        script,
        includeSubtitles: includeSubtitles || false,
        fps: 30,
        bitrate: resolution === '1080p' ? '3000k' : resolution === '720p' ? '2000k' : '1000k',
        backgroundColor: '#000000',
        transitionDuration: 0.5,
      });

      // Upload the composed video to S3
      const filename = `video_${Date.now()}_${Math.random().toString(36).substring(2)}.mp4`;
      const uploadResult = await S3Service.uploadFile(compositionResult.videoBuffer, {
        folder: 'VIDEOS',
        filename,
        contentType: 'video/mp4',
        metadata: {
          duration: duration.toString(),
          resolution: compositionResult.metadata.resolution,
          generatedAt: new Date().toISOString(),
          type: 'ai-generated',
          fps: compositionResult.metadata.fps.toString(),
          bitrate: compositionResult.metadata.bitrate,
          fileSize: compositionResult.metadata.fileSize.toString(),
        },
      });

      // Cleanup temporary files
      await VideoComposer.cleanup(compositionResult.tempFiles);

      return {
        videoBuffer: compositionResult.videoBuffer,
        videoUrl: uploadResult.url,
        videoS3Key: uploadResult.key,
        fileSize: compositionResult.metadata.fileSize,
      };
    } catch (error) {
      console.error('Video creation failed:', error);
      throw new Error(`Failed to create video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate thumbnail for video
   */
  private static async generateThumbnail(
    videoBuffer: Buffer,
    celebrity: Celebrity
  ): Promise<{ key: string; url: string }> {
    // Generate a thumbnail image using ImageGenerator
    // In production, you could extract frame from video
    const thumbnailImages = await ImageGenerator.generateCelebrityImages(
      celebrity,
      1, // Just one thumbnail
      {
        width: 1280,
        height: 720,
        quality: 85,
        format: 'jpeg',
      }
    );
    const thumbnailBuffer = thumbnailImages[0];

    if (!thumbnailBuffer) {
      throw new Error('Failed to generate thumbnail image');
    }

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
      url: uploadResult.url,
    };
  }

  /**
   * Download audio from URL
   */
  private static async downloadAudioFromUrl(url: string): Promise<Buffer> {
    try {
      // Extract the key from the S3 or CloudFront URL
      const key = url.replace(/^https?:\/\/[^/]+\//, '');
      console.log('[VideoGenerationService] Attempting to download audio from S3 with key:', key);
      if (!key) {
        throw new Error('Invalid S3/CloudFront URL format');
      }

      // Use S3Service to download the file
      return await S3Service.downloadFile(key);
    } catch (error) {
      console.error('Error downloading audio:', error);
      throw new Error(`Failed to download audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate costs for generation
   */
  private static calculateCosts(
    scriptResult: any,
    speechResult: any,
    videoResult: any
  ): {
    openai: number;
    polly: number;
    storage: number;
    total: number;
  } {
    // In a real implementation, calculate actual costs
    // For now, return placeholder costs
    return {
      openai: 0.01,
      polly: 0.02,
      storage: 0.001,
      total: 0.031,
    };
  }

  /**
   * Get style prompt for script generation
   */
  private static getStylePrompt(style?: string): string {
    switch (style) {
      case 'documentary':
        return 'Create a documentary-style narration that focuses on the athlete\'s career highlights and achievements.';
      case 'energetic':
        return 'Create an energetic and exciting narration that captures the athlete\'s most thrilling moments.';
      case 'inspirational':
        return 'Create an inspirational narration that highlights the athlete\'s journey and impact.';
      case 'highlight':
        return 'Create a highlight reel narration that showcases the athlete\'s best plays and achievements.';
      default:
        return 'Create a balanced narration that covers the athlete\'s career highlights and achievements.';
    }
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
        status: 'CANCELLED' as GenerationStatus,
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
      voiceType: (job.voiceType as VoiceType) || VoiceType.MALE_NARRATOR,
      customPrompt: job.prompt || '',
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
