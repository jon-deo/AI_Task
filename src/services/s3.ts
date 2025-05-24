import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  ListObjectsV2Command,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import {
  s3Client,
  S3_CONFIG,
  generateS3Key,
  getCloudFrontUrl,
  getContentType,
  validateFile,
  handleAWSError,
  AWSError,
} from '@/lib/aws-config';

export interface UploadOptions {
  folder: keyof typeof S3_CONFIG.FOLDERS;
  filename: string;
  contentType?: string;
  metadata?: Record<string, string>;
  cacheControl?: string;
  acl?: 'private' | 'public-read';
  prefix?: string;
}

export interface UploadResult {
  key: string;
  url: string;
  cloudFrontUrl: string;
  etag: string;
  size: number;
  contentType: string;
}

export interface PresignedUrlOptions {
  key?: string;
  folder: keyof typeof S3_CONFIG.FOLDERS;
  filename: string;
  contentType: string;
  expiresIn?: number;
  metadata?: Record<string, string>;
}

export interface MultipartUploadOptions extends UploadOptions {
  partSize?: number;
  maxConcurrency?: number;
}

export class S3Service {
  /**
   * Upload a file to S3
   */
  static async uploadFile(
    buffer: Buffer,
    options: UploadOptions
  ): Promise<UploadResult> {
    try {
      const key = generateS3Key(options.folder, options.filename, options.prefix);
      const contentType = options.contentType || getContentType(options.filename);

      const command = new PutObjectCommand({
        Bucket: S3_CONFIG.BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: options.metadata,
        CacheControl: options.cacheControl || this.getDefaultCacheControl(options.folder),
        ACL: options.acl || 'public-read',
        ServerSideEncryption: 'AES256',
      });

      const result = await s3Client.send(command);

      return {
        key,
        url: `https://${S3_CONFIG.BUCKET_NAME}.s3.${S3_CONFIG.REGION}.amazonaws.com/${key}`,
        cloudFrontUrl: getCloudFrontUrl(key),
        etag: result.ETag || '',
        size: buffer.length,
        contentType,
      };
    } catch (error) {
      throw handleAWSError(error);
    }
  }

  /**
   * Generate presigned URL for direct upload
   */
  static async generatePresignedUploadUrl(
    options: PresignedUrlOptions
  ): Promise<{
    uploadUrl: string;
    key: string;
    fields: Record<string, string>;
  }> {
    try {
      const key = options.key || generateS3Key(options.folder, options.filename);
      const expiresIn = options.expiresIn || 3600; // 1 hour default

      const command = new PutObjectCommand({
        Bucket: S3_CONFIG.BUCKET_NAME,
        Key: key,
        ContentType: options.contentType,
        Metadata: options.metadata,
        CacheControl: this.getDefaultCacheControl(options.folder),
        ACL: 'public-read',
        ServerSideEncryption: 'AES256',
      });

      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });

      return {
        uploadUrl,
        key,
        fields: {
          'Content-Type': options.contentType,
          'Cache-Control': this.getDefaultCacheControl(options.folder),
          'x-amz-server-side-encryption': 'AES256',
          'x-amz-acl': 'public-read',
        },
      };
    } catch (error) {
      throw handleAWSError(error);
    }
  }

  /**
   * Generate presigned URL for download
   */
  static async generatePresignedDownloadUrl(
    key: string,
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: S3_CONFIG.BUCKET_NAME,
        Key: key,
      });

      return await getSignedUrl(s3Client, command, { expiresIn });
    } catch (error) {
      throw handleAWSError(error);
    }
  }

  /**
   * Download file from S3
   */
  static async downloadFile(key: string): Promise<{
    body: Buffer;
    contentType: string;
    contentLength: number;
    lastModified: Date;
  }> {
    try {
      const command = new GetObjectCommand({
        Bucket: S3_CONFIG.BUCKET_NAME,
        Key: key,
      });

      const result = await s3Client.send(command);

      if (!result.Body) {
        throw new AWSError('File body is empty', 'EmptyBody');
      }

      const body = Buffer.from(await result.Body.transformToByteArray());

      return {
        body,
        contentType: result.ContentType || 'application/octet-stream',
        contentLength: result.ContentLength || body.length,
        lastModified: result.LastModified || new Date(),
      };
    } catch (error) {
      throw handleAWSError(error);
    }
  }

  /**
   * Delete file from S3
   */
  static async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: S3_CONFIG.BUCKET_NAME,
        Key: key,
      });

      await s3Client.send(command);
    } catch (error) {
      throw handleAWSError(error);
    }
  }

  /**
   * Delete multiple files from S3
   */
  static async deleteFiles(keys: string[]): Promise<{
    deleted: string[];
    errors: Array<{ key: string; error: string }>;
  }> {
    const deleted: string[] = [];
    const errors: Array<{ key: string; error: string }> = [];

    await Promise.all(
      keys.map(async (key) => {
        try {
          await this.deleteFile(key);
          deleted.push(key);
        } catch (error) {
          errors.push({
            key,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      })
    );

    return { deleted, errors };
  }

  /**
   * Check if file exists
   */
  static async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: S3_CONFIG.BUCKET_NAME,
        Key: key,
      });

      await s3Client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw handleAWSError(error);
    }
  }

  /**
   * Get file metadata
   */
  static async getFileMetadata(key: string): Promise<{
    size: number;
    contentType: string;
    lastModified: Date;
    etag: string;
    metadata: Record<string, string>;
  }> {
    try {
      const command = new HeadObjectCommand({
        Bucket: S3_CONFIG.BUCKET_NAME,
        Key: key,
      });

      const result = await s3Client.send(command);

      return {
        size: result.ContentLength || 0,
        contentType: result.ContentType || 'application/octet-stream',
        lastModified: result.LastModified || new Date(),
        etag: result.ETag || '',
        metadata: result.Metadata || {},
      };
    } catch (error) {
      throw handleAWSError(error);
    }
  }

  /**
   * Copy file within S3
   */
  static async copyFile(
    sourceKey: string,
    destinationKey: string,
    options?: {
      metadata?: Record<string, string>;
      cacheControl?: string;
    }
  ): Promise<void> {
    try {
      const command = new CopyObjectCommand({
        Bucket: S3_CONFIG.BUCKET_NAME,
        CopySource: `${S3_CONFIG.BUCKET_NAME}/${sourceKey}`,
        Key: destinationKey,
        MetadataDirective: options?.metadata ? 'REPLACE' : 'COPY',
        Metadata: options?.metadata,
        CacheControl: options?.cacheControl,
        ACL: 'public-read',
        ServerSideEncryption: 'AES256',
      });

      await s3Client.send(command);
    } catch (error) {
      throw handleAWSError(error);
    }
  }

  /**
   * List files in a folder
   */
  static async listFiles(
    folder: keyof typeof S3_CONFIG.FOLDERS,
    options?: {
      maxKeys?: number;
      continuationToken?: string;
      prefix?: string;
    }
  ): Promise<{
    files: Array<{
      key: string;
      size: number;
      lastModified: Date;
      etag: string;
    }>;
    nextContinuationToken?: string;
    isTruncated: boolean;
  }> {
    try {
      const folderPrefix = S3_CONFIG.FOLDERS[folder];
      const prefix = options?.prefix
        ? `${folderPrefix}${options.prefix}`
        : folderPrefix;

      const command = new ListObjectsV2Command({
        Bucket: S3_CONFIG.BUCKET_NAME,
        Prefix: prefix,
        MaxKeys: options?.maxKeys || 1000,
        ContinuationToken: options?.continuationToken,
      });

      const result = await s3Client.send(command);

      const files = (result.Contents || []).map((object) => ({
        key: object.Key || '',
        size: object.Size || 0,
        lastModified: object.LastModified || new Date(),
        etag: object.ETag || '',
      }));

      return {
        files,
        nextContinuationToken: result.NextContinuationToken,
        isTruncated: result.IsTruncated || false,
      };
    } catch (error) {
      throw handleAWSError(error);
    }
  }

  /**
   * Get default cache control based on folder
   */
  private static getDefaultCacheControl(folder: keyof typeof S3_CONFIG.FOLDERS): string {
    const cacheControls = {
      VIDEOS: 'public, max-age=31536000, immutable', // 1 year
      THUMBNAILS: 'public, max-age=2592000', // 30 days
      IMAGES: 'public, max-age=2592000', // 30 days
      TEMP: 'public, max-age=3600', // 1 hour
      PROCESSED: 'public, max-age=31536000, immutable', // 1 year
    };

    return cacheControls[folder] || 'public, max-age=86400'; // 1 day default
  }

  /**
   * Multipart upload for large files
   */
  static async multipartUpload(
    buffer: Buffer,
    options: MultipartUploadOptions
  ): Promise<UploadResult> {
    const key = generateS3Key(options.folder, options.filename, options.prefix);
    const contentType = options.contentType || getContentType(options.filename);
    const partSize = options.partSize || 5 * 1024 * 1024; // 5MB default
    const maxConcurrency = options.maxConcurrency || 3;

    let uploadId: string;

    try {
      // Initialize multipart upload
      const createCommand = new CreateMultipartUploadCommand({
        Bucket: S3_CONFIG.BUCKET_NAME,
        Key: key,
        ContentType: contentType,
        Metadata: options.metadata,
        CacheControl: options.cacheControl || this.getDefaultCacheControl(options.folder),
        ACL: options.acl || 'public-read',
        ServerSideEncryption: 'AES256',
      });

      const createResult = await s3Client.send(createCommand);
      uploadId = createResult.UploadId!;

      // Split buffer into parts
      const parts: Array<{ PartNumber: number; ETag: string }> = [];
      const totalParts = Math.ceil(buffer.length / partSize);

      // Upload parts with concurrency control
      const uploadPromises: Promise<void>[] = [];
      let activeUploads = 0;

      for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
        const start = (partNumber - 1) * partSize;
        const end = Math.min(start + partSize, buffer.length);
        const partBuffer = buffer.slice(start, end);

        const uploadPart = async () => {
          activeUploads++;
          try {
            const uploadCommand = new UploadPartCommand({
              Bucket: S3_CONFIG.BUCKET_NAME,
              Key: key,
              PartNumber: partNumber,
              UploadId: uploadId,
              Body: partBuffer,
            });

            const uploadResult = await s3Client.send(uploadCommand);
            parts[partNumber - 1] = {
              PartNumber: partNumber,
              ETag: uploadResult.ETag!,
            };
          } finally {
            activeUploads--;
          }
        };

        uploadPromises.push(uploadPart());

        // Control concurrency
        if (activeUploads >= maxConcurrency) {
          await Promise.race(uploadPromises);
        }
      }

      // Wait for all uploads to complete
      await Promise.all(uploadPromises);

      // Complete multipart upload
      const completeCommand = new CompleteMultipartUploadCommand({
        Bucket: S3_CONFIG.BUCKET_NAME,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
        },
      });

      const completeResult = await s3Client.send(completeCommand);

      return {
        key,
        url: `https://${S3_CONFIG.BUCKET_NAME}.s3.${S3_CONFIG.REGION}.amazonaws.com/${key}`,
        cloudFrontUrl: getCloudFrontUrl(key),
        etag: completeResult.ETag || '',
        size: buffer.length,
        contentType,
      };
    } catch (error) {
      // Abort multipart upload on error
      if (uploadId!) {
        try {
          const abortCommand = new AbortMultipartUploadCommand({
            Bucket: S3_CONFIG.BUCKET_NAME,
            Key: key,
            UploadId: uploadId,
          });
          await s3Client.send(abortCommand);
        } catch (abortError) {
          console.error('Failed to abort multipart upload:', abortError);
        }
      }
      throw handleAWSError(error);
    }
  }

  /**
   * Validate file before upload
   */
  static validateFileForUpload(
    file: { size: number; type: string; name: string },
    fileType: 'video' | 'image'
  ): { valid: boolean; error?: string } {
    return validateFile(file, fileType);
  }
}
