import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3';

import { config } from '@/config';

// S3 Client Configuration
const s3Config: S3ClientConfig = {
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
  // Performance optimizations
  maxAttempts: 3,
  retryMode: 'adaptive',
  requestHandler: {
    requestTimeout: 30000, // 30 seconds
    httpsAgent: {
      maxSockets: 50,
      keepAlive: true,
    },
  },
};

// Initialize S3 client
export const s3Client = new S3Client(s3Config);

// CloudFront client will be initialized when needed
export let cloudFrontClient: any = null;

// S3 Bucket Configuration
export const S3_CONFIG = {
  BUCKET_NAME: config.aws.s3.bucketName,
  REGION: config.aws.region,

  // Folder structure
  FOLDERS: {
    VIDEOS: 'videos/',
    THUMBNAILS: 'thumbnails/',
    IMAGES: 'images/',
    TEMP: 'temp/',
    PROCESSED: 'processed/',
  },

  // File naming conventions
  NAMING: {
    VIDEO_PREFIX: 'video_',
    THUMBNAIL_PREFIX: 'thumb_',
    IMAGE_PREFIX: 'img_',
    TEMP_PREFIX: 'temp_',
  },

  // Upload constraints
  CONSTRAINTS: {
    MAX_VIDEO_SIZE: 100 * 1024 * 1024, // 100MB
    MAX_IMAGE_SIZE: 10 * 1024 * 1024,  // 10MB
    ALLOWED_VIDEO_TYPES: [
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'video/x-msvideo',
    ],
    ALLOWED_IMAGE_TYPES: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ],
  },

  // CloudFront settings
  CLOUDFRONT: {
    DOMAIN: config.aws.s3.cloudFrontDomain,
    CACHE_BEHAVIORS: {
      VIDEOS: {
        cachePolicyId: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad', // Managed-CachingOptimized
        originRequestPolicyId: '88a5eaf4-2fd4-4709-b370-b4c650ea3fcf', // Managed-CORS-S3Origin
      },
      IMAGES: {
        cachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6', // Managed-CachingOptimizedForUncompressedObjects
      },
    },
  },
} as const;

// Utility functions for AWS configuration
export const getS3Url = (key: string): string => {
  return `https://${S3_CONFIG.BUCKET_NAME}.s3.${S3_CONFIG.REGION}.amazonaws.com/${key}`;
};

export const getCloudFrontUrl = (key: string): string => {
  if (S3_CONFIG.CLOUDFRONT.DOMAIN) {
    return `https://${S3_CONFIG.CLOUDFRONT.DOMAIN}/${key}`;
  }
  return getS3Url(key);
};

export const generateS3Key = (
  folder: keyof typeof S3_CONFIG.FOLDERS,
  filename: string,
  prefix?: string
): string => {
  const folderPath = S3_CONFIG.FOLDERS[folder];
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 15);

  if (prefix) {
    return `${folderPath}${prefix}${timestamp}_${randomId}_${filename}`;
  }

  return `${folderPath}${timestamp}_${randomId}_${filename}`;
};

export const parseS3Key = (key: string) => {
  const parts = key.split('/');
  const folder = parts[0];
  const filename = parts[parts.length - 1];

  return {
    folder,
    filename,
    fullPath: key,
  };
};

// Content type detection
export const getContentType = (filename: string): string => {
  const extension = filename.toLowerCase().split('.').pop();

  const contentTypes: Record<string, string> = {
    // Video formats
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',

    // Image formats
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',

    // Audio formats
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',

    // Document formats
    pdf: 'application/pdf',
    json: 'application/json',
    txt: 'text/plain',
  };

  return contentTypes[extension || ''] || 'application/octet-stream';
};

// Validate file constraints
export const validateFile = (
  file: { size: number; type: string; name: string },
  fileType: 'video' | 'image'
): { valid: boolean; error?: string } => {
  const constraints = S3_CONFIG.CONSTRAINTS;

  // Check file size
  const maxSize = fileType === 'video'
    ? constraints.MAX_VIDEO_SIZE
    : constraints.MAX_IMAGE_SIZE;

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size exceeds ${Math.round(maxSize / 1024 / 1024)}MB limit`,
    };
  }

  // Check file type
  const allowedTypes = fileType === 'video'
    ? constraints.ALLOWED_VIDEO_TYPES
    : constraints.ALLOWED_IMAGE_TYPES;

  if (!(allowedTypes as readonly string[]).includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} is not allowed`,
    };
  }

  return { valid: true };
};

// Error handling for AWS operations
export class AWSError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public retryable?: boolean
  ) {
    super(message);
    this.name = 'AWSError';
  }
}

export const handleAWSError = (error: any): AWSError => {
  const awsError = new AWSError(
    error.message || 'AWS operation failed',
    error.Code || error.code,
    error.$metadata?.httpStatusCode || error.statusCode,
    error.$retryable?.throttling || false
  );

  // Log error for monitoring
  console.error('AWS Error:', {
    message: awsError.message,
    code: awsError.code,
    statusCode: awsError.statusCode,
    retryable: awsError.retryable,
  });

  return awsError;
};

// Health check for AWS services
export const checkAWSHealth = async (): Promise<{
  s3: boolean;
  cloudfront: boolean;
  errors: string[];
}> => {
  const errors: string[] = [];
  let s3Healthy = false;
  let cloudfrontHealthy = false;

  try {
    // Test S3 connection
    const { HeadBucketCommand } = await import('@aws-sdk/client-s3');
    await s3Client.send(new HeadBucketCommand({
      Bucket: S3_CONFIG.BUCKET_NAME,
    }));
    s3Healthy = true;
  } catch (error) {
    errors.push(`S3 health check failed: ${error}`);
  }

  try {
    // Test CloudFront (if configured)
    if (S3_CONFIG.CLOUDFRONT.DOMAIN) {
      // CloudFront health check is optional - skip for now
      cloudfrontHealthy = true;
    } else {
      cloudfrontHealthy = true; // No CloudFront configured
    }
  } catch (error) {
    errors.push(`CloudFront health check failed: ${error}`);
  }

  return {
    s3: s3Healthy,
    cloudfront: cloudfrontHealthy,
    errors,
  };
};
