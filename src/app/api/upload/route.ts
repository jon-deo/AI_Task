import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { S3Service } from '@/services/s3';
import { VideoProcessingService } from '@/services/video-processing';
import { validateFile } from '@/lib/aws-config';
import { config } from '@/config';

// Request validation schemas
const uploadRequestSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  fileSize: z.number().positive(),
  folder: z.enum(['VIDEOS', 'IMAGES', 'THUMBNAILS']),
  generateThumbnail: z.boolean().optional(),
  processImage: z.boolean().optional(),
});

const presignedUrlRequestSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  fileSize: z.number().positive(),
  folder: z.enum(['VIDEOS', 'IMAGES', 'THUMBNAILS']),
});

// Rate limiting (simple in-memory implementation)
const uploadAttempts = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 10;

  const attempts = uploadAttempts.get(clientId);
  
  if (!attempts || now > attempts.resetTime) {
    uploadAttempts.set(clientId, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (attempts.count >= maxAttempts) {
    return false;
  }

  attempts.count++;
  return true;
}

/**
 * POST /api/upload - Direct file upload
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = request.ip || 'unknown';
    if (!checkRateLimit(clientId)) {
      return NextResponse.json(
        { success: false, error: 'Too many upload attempts. Please try again later.' },
        { status: 429 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file
    const fileType = file.type.startsWith('video/') ? 'video' : 'image';
    const validation = validateFile(
      { size: file.size, type: file.type, name: file.name },
      fileType
    );

    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Process based on file type
    if (fileType === 'video') {
      const result = await VideoProcessingService.processAndUploadVideo(
        buffer,
        file.name,
        {
          generateThumbnail: true,
          compressionLevel: 'medium',
        }
      );

      return NextResponse.json({
        success: true,
        data: {
          type: 'video',
          video: {
            key: result.videoKey,
            url: result.videoUrl,
            cloudFrontUrl: result.videoCloudFrontUrl,
          },
          thumbnail: result.thumbnailKey ? {
            key: result.thumbnailKey,
            url: result.thumbnailUrl,
            cloudFrontUrl: result.thumbnailCloudFrontUrl,
          } : undefined,
          metadata: result.metadata,
        },
      });
    } else {
      const result = await VideoProcessingService.processAndUploadImage(
        buffer,
        file.name,
        {
          resize: { width: 1920, height: 1080 },
          quality: 85,
          format: 'jpeg',
          generateWebP: true,
        }
      );

      return NextResponse.json({
        success: true,
        data: {
          type: 'image',
          image: {
            key: result.key,
            url: result.url,
            cloudFrontUrl: result.cloudFrontUrl,
          },
          webp: result.webpKey ? {
            key: result.webpKey,
            url: result.webpUrl,
            cloudFrontUrl: result.webpCloudFrontUrl,
          } : undefined,
        },
      });
    }
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Upload failed' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/upload/presigned - Generate presigned upload URL
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse and validate query parameters
    const params = {
      filename: searchParams.get('filename'),
      contentType: searchParams.get('contentType'),
      fileSize: parseInt(searchParams.get('fileSize') || '0'),
      folder: searchParams.get('folder'),
    };

    const validatedParams = presignedUrlRequestSchema.parse(params);

    // Validate file constraints
    const fileType = validatedParams.contentType.startsWith('video/') ? 'video' : 'image';
    const validation = validateFile(
      { 
        size: validatedParams.fileSize, 
        type: validatedParams.contentType, 
        name: validatedParams.filename 
      },
      fileType
    );

    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    // Generate presigned URL
    const result = await S3Service.generatePresignedUploadUrl({
      folder: validatedParams.folder,
      filename: validatedParams.filename,
      contentType: validatedParams.contentType,
      expiresIn: 3600, // 1 hour
    });

    return NextResponse.json({
      success: true,
      data: {
        uploadUrl: result.uploadUrl,
        key: result.key,
        fields: result.fields,
        expiresIn: 3600,
      },
    });
  } catch (error) {
    console.error('Presigned URL generation error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid parameters',
          details: error.errors 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to generate upload URL' 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/upload - Delete uploaded file
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json(
        { success: false, error: 'File key is required' },
        { status: 400 }
      );
    }

    // Check if file exists
    const exists = await S3Service.fileExists(key);
    if (!exists) {
      return NextResponse.json(
        { success: false, error: 'File not found' },
        { status: 404 }
      );
    }

    // Delete file
    await S3Service.deleteFile(key);

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Delete failed' 
      },
      { status: 500 }
    );
  }
}
