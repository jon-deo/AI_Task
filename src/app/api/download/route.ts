import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { S3Service } from '@/services/s3';
import { CloudFrontService } from '@/services/cloudfront';
import { S3_CONFIG } from '@/lib/aws-config';

interface S3FileData {
  body: Buffer;
  contentType: string;
  contentLength: number;
  lastModified: Date;
  metadata: Record<string, string>;
}

// Request validation schema
const downloadRequestSchema = z.object({
  key: z.string().min(1),
  download: z.boolean().optional(),
  expiresIn: z.number().min(60).max(86400).optional(), // 1 minute to 24 hours
});

/**
 * GET /api/download - Generate download URL or stream file
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse and validate query parameters
    const params = {
      key: searchParams.get('key'),
      download: searchParams.get('download') === 'true',
      expiresIn: parseInt(searchParams.get('expiresIn') || '3600'),
    };

    const validatedParams = downloadRequestSchema.parse(params);

    // Check if file exists
    const exists = await S3Service.fileExists(validatedParams.key);
    if (!exists) {
      return NextResponse.json(
        { success: false, error: 'File not found' },
        { status: 404 }
      );
    }

    // Get file metadata
    const metadata = await S3Service.getFileMetadata(validatedParams.key);

    // If download=true, generate presigned download URL
    if (validatedParams.download) {
      const downloadUrl = await S3Service.generatePresignedDownloadUrl(
        validatedParams.key,
        validatedParams.expiresIn
      );

      return NextResponse.json({
        success: true,
        data: {
          downloadUrl,
          filename: validatedParams.key.split('/').pop(),
          contentType: metadata.contentType,
          size: metadata.size,
          expiresIn: validatedParams.expiresIn,
        },
      });
    }

    // For public files, return CloudFront URL
    if (S3_CONFIG.CLOUDFRONT.DOMAIN) {
      const cloudFrontUrl = CloudFrontService.getCloudFrontUrl(validatedParams.key);
      
      return NextResponse.json({
        success: true,
        data: {
          url: cloudFrontUrl,
          directUrl: `https://${S3_CONFIG.BUCKET_NAME}.s3.${S3_CONFIG.REGION}.amazonaws.com/${validatedParams.key}`,
          contentType: metadata.contentType,
          size: metadata.size,
          lastModified: metadata.lastModified,
        },
      });
    }

    // Fallback to S3 direct URL
    const s3Url = `https://${S3_CONFIG.BUCKET_NAME}.s3.${S3_CONFIG.REGION}.amazonaws.com/${validatedParams.key}`;
    
    return NextResponse.json({
      success: true,
      data: {
        url: s3Url,
        contentType: metadata.contentType,
        size: metadata.size,
        lastModified: metadata.lastModified,
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    
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
        error: error instanceof Error ? error.message : 'Download failed' 
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/download/stream - Stream file directly
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key } = body;

    if (!key || typeof key !== 'string') {
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

    // Download file from S3
    const fileData = (await S3Service.downloadFile(key)) as unknown as S3FileData;

    // Set appropriate headers
    const headers = new Headers();
    headers.set('Content-Type', fileData.contentType);
    headers.set('Content-Length', fileData.contentLength.toString());
    headers.set('Last-Modified', fileData.lastModified.toUTCString());
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    
    // Set filename for download
    const filename = key.split('/').pop() || 'download';
    headers.set('Content-Disposition', `inline; filename="${filename}"`);

    return new NextResponse(fileData.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Stream error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Stream failed' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/download/metadata - Get file metadata
 */
export async function HEAD(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return new NextResponse(null, { status: 400 });
    }

    // Check if file exists and get metadata
    const exists = await S3Service.fileExists(key);
    if (!exists) {
      return new NextResponse(null, { status: 404 });
    }

    const metadata = await S3Service.getFileMetadata(key);

    // Return metadata in headers
    const headers = new Headers();
    headers.set('Content-Type', metadata.contentType);
    headers.set('Content-Length', metadata.size.toString());
    headers.set('Last-Modified', metadata.lastModified.toUTCString());
    headers.set('ETag', metadata.etag);
    
    // Add custom metadata as headers
    Object.entries(metadata.metadata).forEach(([key, value]) => {
      headers.set(`X-Metadata-${key}`, value);
    });

    return new NextResponse(null, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Metadata error:', error);
    return new NextResponse(null, { status: 500 });
  }
}
