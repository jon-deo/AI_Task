import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs/promises';
import { createWriteStream, createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import sharp from 'sharp';

export interface VideoCompositionOptions {
  audioBuffer: Buffer;
  images: Buffer[];
  duration: number; // in seconds
  resolution: '720p' | '1080p' | '480p';
  script: string;
  includeSubtitles?: boolean;
  fps?: number;
  bitrate?: string;
  backgroundColor?: string;
  transitionDuration?: number; // seconds between images
}

export interface VideoCompositionResult {
  videoBuffer: Buffer;
  tempFiles: string[]; // for cleanup
  metadata: {
    duration: number;
    resolution: string;
    fileSize: number;
    fps: number;
    bitrate: string;
  };
}

export class VideoComposer {
  private static tempDir = path.join(process.cwd(), 'temp');

  /**
   * Initialize temp directory
   */
  static async init(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      console.log(`✅ Temp directory initialized at: ${this.tempDir}`);
    } catch (error) {
      console.error('Failed to create temp directory:', error);
      throw new Error(`Failed to initialize temp directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Compose video from audio and images using FFmpeg
   */
  static async composeVideo(options: VideoCompositionOptions): Promise<VideoCompositionResult> {
    console.log('🎬 Starting video composition with FFmpeg...');

    await this.init();

    const {
      audioBuffer,
      images,
      duration,
      resolution,
      script,
      includeSubtitles = false,
      fps = 30,
      bitrate = '2000k',
      backgroundColor = '#000000',
      transitionDuration = 0.5,
    } = options;

    console.log(`📊 Composition parameters:
    - Images: ${images.length}
    - Duration: ${duration}s
    - Resolution: ${resolution}
    - Audio size: ${audioBuffer.length} bytes
    - Include subtitles: ${includeSubtitles}`);

    if (!images || images.length === 0) {
      throw new Error('No images provided for video composition');
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('No audio buffer provided for video composition');
    }

    const tempFiles: string[] = [];
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);

    try {
      // 1. Save audio to temp file
      const audioPath = path.join(this.tempDir, `audio_${timestamp}_${randomId}.mp3`);
      await fs.writeFile(audioPath, audioBuffer);
      tempFiles.push(audioPath);

      // 2. Process and save images
      const processedImages = await this.processImages(images, resolution, timestamp, randomId);
      tempFiles.push(...processedImages);

      // 3. Create video slideshow
      const videoPath = path.join(this.tempDir, `video_${timestamp}_${randomId}.mp4`);
      tempFiles.push(videoPath);

      await this.createVideoSlideshow({
        imagePaths: processedImages,
        audioPath,
        outputPath: videoPath,
        duration,
        resolution,
        fps,
        bitrate,
        backgroundColor,
        transitionDuration,
      });

      // 4. Add subtitles if requested
      let finalVideoPath = videoPath;
      if (includeSubtitles && script) {
        const subtitledVideoPath = path.join(this.tempDir, `subtitled_${timestamp}_${randomId}.mp4`);
        tempFiles.push(subtitledVideoPath);

        await this.addSubtitles({
          inputPath: videoPath,
          outputPath: subtitledVideoPath,
          script,
          duration,
        });

        finalVideoPath = subtitledVideoPath;
      }

      // 5. Read final video as buffer
      const videoBuffer = await fs.readFile(finalVideoPath);
      const stats = await fs.stat(finalVideoPath);

      return {
        videoBuffer,
        tempFiles,
        metadata: {
          duration,
          resolution: this.getResolutionDimensions(resolution),
          fileSize: stats.size,
          fps,
          bitrate,
        },
      };
    } catch (error) {
      // Cleanup on error
      await this.cleanup(tempFiles);
      throw new Error(`Video composition failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process images to consistent format and size
   */
  private static async processImages(
    images: Buffer[],
    resolution: string,
    timestamp: number,
    randomId: string
  ): Promise<string[]> {
    if (!images || images.length === 0) {
      throw new Error('No images provided for processing');
    }

    const { width, height } = this.parseResolution(resolution);
    const processedPaths: string[] = [];

    try {
      for (let i = 0; i < images.length; i++) {
        if (!images[i] || images[i].length === 0) {
          console.warn(`Skipping empty image at index ${i}`);
          continue;
        }

        const imagePath = path.join(this.tempDir, `image_${timestamp}_${randomId}_${i}.jpg`);
        console.log(`Processing image ${i + 1}/${images.length} to: ${imagePath}`);

        // Resize and format image using Sharp
        await sharp(images[i])
          .resize(width, height, {
            fit: 'cover',
            position: 'center',
          })
          .jpeg({ quality: 90 })
          .toFile(imagePath);

        processedPaths.push(imagePath);
      }

      if (processedPaths.length === 0) {
        throw new Error('No images were successfully processed');
      }

      return processedPaths;
    } catch (error) {
      console.error('Image processing failed:', error);
      throw new Error(`Failed to process images: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create video slideshow from images and audio
   */
  private static async createVideoSlideshow(params: {
    imagePaths: string[];
    audioPath: string;
    outputPath: string;
    duration: number;
    resolution: string;
    fps: number;
    bitrate: string;
    backgroundColor: string;
    transitionDuration: number;
  }): Promise<void> {
    const {
      imagePaths,
      audioPath,
      outputPath,
      duration,
      resolution,
      fps,
      bitrate,
      backgroundColor,
      transitionDuration,
    } = params;

    const { width, height } = this.parseResolution(resolution);
    const imageDuration = imagePaths.length > 1 ? duration / imagePaths.length : duration;

    return new Promise((resolve, reject) => {
      let command = ffmpeg();

      // Add images as inputs
      imagePaths.forEach((imagePath) => {
        command = command.input(imagePath);
      });

      // Add audio input
      command = command.input(audioPath);

      // Create complex filter for slideshow with transitions
      const filterComplex = this.buildFilterComplex(
        imagePaths.length,
        imageDuration,
        transitionDuration,
        width,
        height,
        backgroundColor
      );

      command
        .complexFilter(filterComplex)
        .outputOptions([
          '-map', '[final]',
          '-map', `${imagePaths.length}:a`, // Audio from last input
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-b:v', bitrate,
          '-b:a', '128k',
          '-r', fps.toString(),
          '-pix_fmt', 'yuv420p',
          '-shortest', // End when shortest stream ends
        ])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  }

  /**
   * Build FFmpeg filter complex for slideshow with transitions
   */
  private static buildFilterComplex(
    imageCount: number,
    imageDuration: number,
    transitionDuration: number,
    width: number,
    height: number,
    backgroundColor: string
  ): string {
    console.log(`🔧 Building filter complex for ${imageCount} images`);

    if (imageCount === 0) {
      throw new Error('No images provided for video composition');
    }

    if (imageCount === 1) {
      // Single image - just loop it
      const filter = `[0:v]scale=${width}:${height},loop=loop=-1:size=1:start=0[final]`;
      console.log(`📝 Single image filter: ${filter}`);
      return filter;
    }

    const filters: string[] = [];

    // Scale all images
    for (let i = 0; i < imageCount; i++) {
      filters.push(`[${i}:v]scale=${width}:${height}[img${i}]`);
    }

    // Create transitions between images
    let currentStream = 'img0';
    for (let i = 1; i < imageCount; i++) {
      const nextStream = `transition${i}`;
      const offset = (imageDuration - transitionDuration) * i;

      filters.push(
        `[${currentStream}][img${i}]xfade=transition=fade:duration=${transitionDuration}:offset=${offset}[${nextStream}]`
      );

      currentStream = nextStream;
    }

    filters.push(`[${currentStream}]format=yuv420p[final]`);

    const filterString = filters.join(';');
    console.log(`📝 Multi-image filter: ${filterString}`);

    return filterString;
  }

  /**
   * Add subtitles to video
   */
  private static async addSubtitles(params: {
    inputPath: string;
    outputPath: string;
    script: string;
    duration: number;
  }): Promise<void> {
    const { inputPath, outputPath, script, duration } = params;

    // Create simple SRT subtitle file
    const srtPath = inputPath.replace('.mp4', '.srt');
    const srtContent = this.generateSRT(script, duration);
    await fs.writeFile(srtPath, srtContent);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-vf', `subtitles=${srtPath}:force_style='FontSize=24,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=2'`,
          '-c:a', 'copy',
        ])
        .output(outputPath)
        .on('end', () => {
          // Clean up SRT file
          fs.unlink(srtPath).catch(console.error);
          resolve();
        })
        .on('error', (err) => reject(err))
        .run();
    });
  }

  /**
   * Generate SRT subtitle content
   */
  private static generateSRT(script: string, duration: number): string {
    if (!script || typeof script !== 'string') {
      console.warn('Invalid script provided for SRT generation');
      return '';
    }

    const words = script.split(' ').filter(word => word.trim().length > 0);
    if (words.length === 0) {
      console.warn('No words found in script for SRT generation');
      return '';
    }

    const wordsPerSecond = 2; // Adjust reading speed
    const wordsPerSubtitle = Math.ceil(wordsPerSecond * 3); // 3 seconds per subtitle

    let srt = '';
    let subtitleIndex = 1;

    for (let i = 0; i < words.length; i += wordsPerSubtitle) {
      const subtitleWords = words.slice(i, i + wordsPerSubtitle);

      if (!subtitleWords || subtitleWords.length === 0) {
        continue;
      }

      const startTime = (i / wordsPerSecond);
      const endTime = Math.min(((i + wordsPerSubtitle) / wordsPerSecond), duration);

      srt += `${subtitleIndex}\n`;
      srt += `${this.formatSRTTime(startTime)} --> ${this.formatSRTTime(endTime)}\n`;
      srt += `${subtitleWords.join(' ')}\n\n`;

      subtitleIndex++;
    }

    return srt;
  }

  /**
   * Format time for SRT format (HH:MM:SS,mmm)
   */
  private static formatSRTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
  }

  /**
   * Parse resolution string to width and height
   */
  private static parseResolution(resolution: string): { width: number; height: number } {
    switch (resolution) {
      case '1080p':
        return { width: 1920, height: 1080 };
      case '720p':
        return { width: 1280, height: 720 };
      case '480p':
        return { width: 854, height: 480 };
      default:
        throw new Error(`Unsupported resolution: ${resolution}`);
    }
  }

  /**
   * Get resolution dimensions as string
   */
  private static getResolutionDimensions(resolution: string): string {
    const { width, height } = this.parseResolution(resolution);
    return `${width}x${height}`;
  }

  /**
   * Cleanup temporary files
   */
  static async cleanup(tempFiles: string[]): Promise<void> {
    for (const file of tempFiles) {
      try {
        await fs.unlink(file);
      } catch (error) {
        console.warn(`Failed to cleanup temp file ${file}:`, error);
      }
    }
  }
}
