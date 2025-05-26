import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';

export interface SimpleVideoOptions {
  audioBuffer: Buffer;
  duration: number; // in seconds
  celebrityName: string;
  script: string;
}

export interface SimpleVideoResult {
  videoBuffer: Buffer;
  tempFiles: string[]; // for cleanup
  metadata: {
    duration: number;
    resolution: string;
    fileSize: number;
  };
}

export class SimpleVideoComposer {
  private static tempDir = path.join(process.cwd(), 'temp');

  /**
   * Initialize temp directory
   */
  static async init(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create temp directory:', error);
    }
  }

  /**
   * Create a simple video with audio and a single background image
   */
  static async createSimpleVideo(options: SimpleVideoOptions): Promise<SimpleVideoResult> {
    console.log('🎬 Creating simple video with FFmpeg...');

    await this.init();

    const {
      audioBuffer,
      duration,
      celebrityName,
      script,
    } = options;

    console.log(`📊 Video parameters:
    - Duration: ${duration}s
    - Audio size: ${audioBuffer.length} bytes
    - Celebrity: ${celebrityName}`);

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
      console.log(`💾 Audio saved to: ${audioPath}`);

      // 2. Create a simple background image
      const imagePath = path.join(this.tempDir, `image_${timestamp}_${randomId}.jpg`);
      const imageBuffer = await this.createSimpleBackground(celebrityName);
      await fs.writeFile(imagePath, imageBuffer);
      tempFiles.push(imagePath);
      console.log(`🖼️  Background image created: ${imagePath}`);

      // 3. Create video using FFmpeg
      const videoPath = path.join(this.tempDir, `video_${timestamp}_${randomId}.mp4`);
      tempFiles.push(videoPath);

      await this.combineImageAndAudio({
        imagePath,
        audioPath,
        outputPath: videoPath,
        duration,
      });

      console.log(`🎥 Video created: ${videoPath}`);

      // 4. Read video as buffer
      const videoBuffer = await fs.readFile(videoPath);
      const stats = await fs.stat(videoPath);

      console.log(`✅ Video composition complete! Size: ${videoBuffer.length} bytes`);

      return {
        videoBuffer,
        tempFiles,
        metadata: {
          duration,
          resolution: '1280x720',
          fileSize: stats.size,
        },
      };
    } catch (error) {
      // Cleanup on error
      await this.cleanup(tempFiles);
      throw new Error(`Simple video creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a simple background image with celebrity name
   */
  private static async createSimpleBackground(celebrityName: string): Promise<Buffer> {
    try {
      // Create a simple gradient background with text
      const width = 1280;
      const height = 720;

      // Create a gradient background
      const svg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#1a1a1a;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#000000;stop-opacity:1" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#grad)"/>
          <text x="50%" y="50%" font-family="Arial" font-size="48" fill="white" text-anchor="middle">
            ${celebrityName}
          </text>
        </svg>
      `;

      // Convert SVG to PNG using sharp
      return sharp(Buffer.from(svg))
        .png()
        .toBuffer();
    } catch (error) {
      console.error('Failed to create background:', error);
      // Fallback to a simple black background
      return sharp({
        create: {
          width: 1280,
          height: 720,
          channels: 3,
          background: { r: 0, g: 0, b: 0 }
        }
      })
        .png()
        .toBuffer();
    }
  }

  /**
   * Combine image and audio into video using FFmpeg
   */
  private static async combineImageAndAudio(params: {
    imagePath: string;
    audioPath: string;
    outputPath: string;
    duration: number;
  }): Promise<void> {
    const { imagePath, audioPath, outputPath, duration } = params;

    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(imagePath)
        .inputOptions(['-loop', '1'])  // Apply loop to the image input
        .input(audioPath)
        .outputOptions([
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-pix_fmt', 'yuv420p',
          '-shortest',
          '-t', duration.toString(),
        ])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  }

  /**
   * Cleanup temporary files
   */
  static async cleanup(tempFiles: string[]): Promise<void> {
    console.log(`🧹 Cleaning up ${tempFiles.length} temp files...`);
    for (const file of tempFiles) {
      try {
        await fs.unlink(file);
        console.log(`🗑️  Deleted: ${file}`);
      } catch (error) {
        console.warn(`⚠️  Failed to cleanup temp file ${file}:`, error);
      }
    }
  }
}