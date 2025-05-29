import sharp from 'sharp';

import { S3Service } from './s3';
import { CloudFrontService } from './cloudfront';
import { S3_CONFIG } from '@/lib/aws-config';
import { config } from '@/config';

export interface VideoProcessingOptions {
  generateThumbnail?: boolean;
  thumbnailTimestamp?: number; // seconds
  compressionLevel?: 'low' | 'medium' | 'high';
  targetResolution?: '480p' | '720p' | '1080p';
  targetBitrate?: string;
}

export interface VideoProcessingResult {
  videoKey: string;
  videoUrl: string;
  videoCloudFrontUrl: string;
  thumbnailKey?: string;
  thumbnailUrl?: string;
  thumbnailCloudFrontUrl?: string;
  metadata: {
    duration: number;
    resolution: string;
    bitrate: string;
    format: string;
    size: number;
  };
}

export interface ThumbnailOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

export class VideoProcessingService {
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
        cacheControl: 'public, max-age=31536000, immutable',
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
        videoKey: videoUploadResult.key,
        videoUrl: videoUploadResult.url,
        videoCloudFrontUrl: videoUploadResult.cloudFrontUrl || '',
        thumbnailKey,
        thumbnailUrl,
        thumbnailCloudFrontUrl,
        metadata: {
          duration: metadata.duration,
          resolution: metadata.resolution,
          bitrate: metadata.bitrate,
          format: metadata.format,
          size: videoBuffer.length,
        },
      };
    } catch (error) {
      console.error('Video processing failed:', error);
      throw new Error(`Video processing failed: ${error}`);
    }
  }

  /**
   * Generate and upload thumbnail from video
   */
  static async generateAndUploadThumbnail(
    videoBuffer: Buffer,
    videoFilename: string,
    options: ThumbnailOptions & { timestamp?: number } = {}
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
        cacheControl: 'public, max-age=2592000',
      });

      return {
        key: uploadResult.key,
        url: uploadResult.url,
        cloudFrontUrl: uploadResult.cloudFrontUrl || '',
      };
    } catch (error) {
      console.error('Thumbnail generation failed:', error);
      throw new Error(`Thumbnail generation failed: ${error}`);
    }
  }

  /**
   * Create placeholder thumbnail (replace with ffmpeg in production)
   */
  private static async createPlaceholderThumbnail(
    width: number,
    height: number,
    quality: number
  ): Promise<Buffer> {
    // Create a simple gradient placeholder
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad)" />
        <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="24" 
              fill="white" text-anchor="middle" dy=".3em">
          Video Thumbnail
        </text>
      </svg>
    `;

    return sharp(Buffer.from(svg))
      .jpeg({ quality })
      .toBuffer();
  }

  /**
   * Extract video metadata (simplified version)
   */
  private static async extractVideoMetadata(videoBuffer: Buffer): Promise<{
    duration: number;
    resolution: string;
    bitrate: string;
    format: string;
  }> {
    // In production, use ffprobe to extract real metadata
    // For now, return mock data
    return {
      duration: 60, // seconds
      resolution: '1920x1080',
      bitrate: '1000k',
      format: 'mp4',
    };
  }

  /**
   * Generate multiple thumbnail sizes
   */
  static async generateMultipleThumbnails(
    videoBuffer: Buffer,
    videoFilename: string,
    sizes: Array<{ width: number; height: number; suffix: string }>
  ): Promise<Array<{
    key: string;
    url: string;
    cloudFrontUrl: string;
    size: string;
  }>> {
    const results = [];

    for (const size of sizes) {
      const thumbnailBuffer = await this.createPlaceholderThumbnail(
        size.width,
        size.height,
        80
      );

      const thumbnailFilename = videoFilename.replace(
        /\.[^/.]+$/,
        `_thumb_${size.suffix}.jpg`
      );

      const uploadResult = await S3Service.uploadFile(thumbnailBuffer, {
        folder: 'THUMBNAILS',
        filename: thumbnailFilename,
        contentType: 'image/jpeg',
        metadata: {
          sourceVideo: videoFilename,
          size: `${size.width}x${size.height}`,
          generatedAt: new Date().toISOString(),
        },
      });

      results.push({
        key: uploadResult.key,
        url: uploadResult.url,
        cloudFrontUrl: uploadResult.cloudFrontUrl || '',
        size: `${size.width}x${size.height}`,
      });
    }

    return results;
  }

  /**
   * Process image and upload
   */
  static async processAndUploadImage(
    imageBuffer: Buffer,
    filename: string,
    options: {
      resize?: { width?: number; height?: number };
      quality?: number;
      format?: 'jpeg' | 'png' | 'webp';
      generateWebP?: boolean;
    } = {}
  ): Promise<{
    key: string;
    url: string;
    cloudFrontUrl: string;
    webpKey?: string;
    webpUrl?: string;
    webpCloudFrontUrl?: string;
  }> {
    try {
      let processedBuffer = imageBuffer;

      // Process image with Sharp
      let sharpInstance = sharp(imageBuffer);

      // Resize if specified
      if (options.resize) {
        sharpInstance = sharpInstance.resize(
          options.resize.width,
          options.resize.height,
          { fit: 'cover', position: 'center' }
        );
      }

      // Convert format and set quality
      const format = options.format || 'jpeg';
      const quality = options.quality || 80;

      if (format === 'jpeg') {
        sharpInstance = sharpInstance.jpeg({ quality });
      } else if (format === 'png') {
        sharpInstance = sharpInstance.png({ quality });
      } else if (format === 'webp') {
        sharpInstance = sharpInstance.webp({ quality });
      }

      processedBuffer = await sharpInstance.toBuffer();

      // Upload main image
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 15);
      const processedFilename = `${timestamp}_${randomId}_${filename}`;

      const uploadResult = await S3Service.uploadFile(processedBuffer, {
        folder: 'IMAGES',
        filename: processedFilename,
        contentType: `image/${format}`,
        metadata: {
          originalFilename: filename,
          processedAt: new Date().toISOString(),
          format,
          quality: quality.toString(),
        },
      });

      let webpKey: string | undefined;
      let webpUrl: string | undefined;
      let webpCloudFrontUrl: string | undefined;

      // Generate WebP version if requested
      if (options.generateWebP && format !== 'webp') {
        const webpBuffer = await sharp(imageBuffer)
          .resize(options.resize?.width, options.resize?.height, {
            fit: 'cover',
            position: 'center',
          })
          .webp({ quality })
          .toBuffer();

        const webpFilename = processedFilename.replace(/\.[^/.]+$/, '.webp');

        const webpUploadResult = await S3Service.uploadFile(webpBuffer, {
          folder: 'IMAGES',
          filename: webpFilename,
          contentType: 'image/webp',
          metadata: {
            originalFilename: filename,
            processedAt: new Date().toISOString(),
            format: 'webp',
            quality: quality.toString(),
          },
        });

        webpKey = webpUploadResult.key;
        webpUrl = webpUploadResult.url;
        webpCloudFrontUrl = webpUploadResult.cloudFrontUrl;
      }

      return {
        key: uploadResult.key,
        url: uploadResult.url,
        cloudFrontUrl: uploadResult.cloudFrontUrl || '',
        webpKey,
        webpUrl,
        webpCloudFrontUrl,
      };
    } catch (error) {
      console.error('Image processing failed:', error);
      throw new Error(`Image processing failed: ${error}`);
    }
  }

  /**
   * Clean up temporary files
   */
  static async cleanupTempFiles(keys: string[]): Promise<void> {
    try {
      await S3Service.deleteFiles(keys);
    } catch (error) {
      console.error('Cleanup failed:', error);
      // Don't throw error for cleanup failures
    }
  }

  /**
   * Invalidate CDN cache for processed files
   */
  static async invalidateCache(
    distributionId: string,
    keys: string[]
  ): Promise<void> {
    try {
      if (S3_CONFIG.CLOUDFRONT.DOMAIN) {
        await CloudFrontService.batchInvalidate(distributionId, keys);
      }
    } catch (error) {
      console.error('Cache invalidation failed:', error);
      // Don't throw error for cache invalidation failures
    }
  }
}
