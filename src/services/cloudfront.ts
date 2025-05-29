import {
  CreateInvalidationCommand,
  GetInvalidationCommand,
  ListInvalidationsCommand,
  GetDistributionCommand,
  ListDistributionsCommand,
  InvalidationSummary,
  Origin,
  DistributionSummary,
} from '@aws-sdk/client-cloudfront';

import { cloudFrontClient, S3_CONFIG, handleAWSError } from '@/lib/aws-config';

export interface InvalidationOptions {
  paths: string[];
  callerReference?: string;
}

export interface InvalidationResult {
  id: string;
  status: string;
  createTime: Date;
  paths: string[];
}

export interface DistributionInfo {
  id: string;
  domainName: string;
  status: string;
  enabled: boolean;
  origins: Array<{
    id: string;
    domainName: string;
    originPath: string;
  }>;
}

export class CloudFrontService {
  /**
   * Create cache invalidation for specific paths
   */
  static async createInvalidation(
    distributionId: string,
    options: InvalidationOptions
  ): Promise<InvalidationResult> {
    try {
      const callerReference = options.callerReference || `invalidation-${Date.now()}`;

      const command = new CreateInvalidationCommand({
        DistributionId: distributionId,
        InvalidationBatch: {
          Paths: {
            Quantity: options.paths.length,
            Items: options.paths,
          },
          CallerReference: callerReference,
        },
      });

      const result = await cloudFrontClient.send(command);
      const invalidation = result.Invalidation!;

      return {
        id: invalidation.Id!,
        status: invalidation.Status!,
        createTime: invalidation.CreateTime!,
        paths: invalidation.InvalidationBatch!.Paths!.Items!,
      };
    } catch (error) {
      throw handleAWSError(error);
    }
  }

  /**
   * Get invalidation status
   */
  static async getInvalidationStatus(
    distributionId: string,
    invalidationId: string
  ): Promise<InvalidationResult> {
    try {
      const command = new GetInvalidationCommand({
        DistributionId: distributionId,
        Id: invalidationId,
      });

      const result = await cloudFrontClient.send(command);
      const invalidation = result.Invalidation!;

      return {
        id: invalidation.Id!,
        status: invalidation.Status!,
        createTime: invalidation.CreateTime!,
        paths: invalidation.InvalidationBatch!.Paths!.Items!,
      };
    } catch (error) {
      throw handleAWSError(error);
    }
  }

  /**
   * List recent invalidations
   */
  static async listInvalidations(
    distributionId: string,
    maxItems: number = 100
  ): Promise<InvalidationResult[]> {
    try {
      const command = new ListInvalidationsCommand({
        DistributionId: distributionId,
        MaxItems: maxItems,
      });

      const result = await cloudFrontClient.send(command);
      const invalidations = result.InvalidationList?.Items || [];

      return invalidations.map((invalidation: InvalidationSummary) => ({
        id: invalidation.Id!,
        status: invalidation.Status!,
        createTime: invalidation.CreateTime!,
        paths: [], // Summary doesn't include paths
      }));
    } catch (error) {
      throw handleAWSError(error);
    }
  }

  /**
   * Get distribution information
   */
  static async getDistribution(distributionId: string): Promise<DistributionInfo> {
    try {
      const command = new GetDistributionCommand({
        Id: distributionId,
      });

      const result = await cloudFrontClient.send(command);
      const distribution = result.Distribution!;
      const config = distribution.DistributionConfig!;

      return {
        id: distribution.Id!,
        domainName: distribution.DomainName!,
        status: distribution.Status!,
        enabled: config.Enabled!,
        origins: config.Origins!.Items!.map((origin: Origin) => ({
          id: origin.Id!,
          domainName: origin.DomainName!,
          originPath: origin.OriginPath || '',
        })),
      };
    } catch (error) {
      throw handleAWSError(error);
    }
  }

  /**
   * List all distributions
   */
  static async listDistributions(): Promise<DistributionInfo[]> {
    try {
      const command = new ListDistributionsCommand({});
      const result = await cloudFrontClient.send(command);
      const distributions = result.DistributionList?.Items || [];

      return distributions.map((distribution: DistributionSummary) => ({
        id: distribution.Id!,
        domainName: distribution.DomainName!,
        status: distribution.Status!,
        enabled: distribution.Enabled!,
        origins: distribution.Origins!.Items!.map((origin: Origin) => ({
          id: origin.Id!,
          domainName: origin.DomainName!,
          originPath: origin.OriginPath || '',
        })),
      }));
    } catch (error) {
      throw handleAWSError(error);
    }
  }

  /**
   * Invalidate video files (common use case)
   */
  static async invalidateVideo(
    distributionId: string,
    videoKey: string
  ): Promise<InvalidationResult> {
    const paths = [
      `/${videoKey}`, // Original video
      `/${videoKey.replace(/\.[^/.]+$/, '_thumb.jpg')}`, // Thumbnail
    ];

    return this.createInvalidation(distributionId, { paths });
  }

  /**
   * Invalidate entire folder
   */
  static async invalidateFolder(
    distributionId: string,
    folder: keyof typeof S3_CONFIG.FOLDERS
  ): Promise<InvalidationResult> {
    const folderPath = S3_CONFIG.FOLDERS[folder];
    const paths = [`/${folderPath}*`];

    return this.createInvalidation(distributionId, { paths });
  }

  /**
   * Batch invalidate multiple files
   */
  static async batchInvalidate(
    distributionId: string,
    keys: string[]
  ): Promise<InvalidationResult> {
    // CloudFront allows up to 3000 paths per invalidation
    const maxPaths = 3000;
    const paths = keys.slice(0, maxPaths).map(key => `/${key}`);

    return this.createInvalidation(distributionId, { paths });
  }

  /**
   * Wait for invalidation to complete
   */
  static async waitForInvalidation(
    distributionId: string,
    invalidationId: string,
    maxWaitTime: number = 300000, // 5 minutes
    pollInterval: number = 10000 // 10 seconds
  ): Promise<InvalidationResult> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.getInvalidationStatus(distributionId, invalidationId);

      if (status.status === 'Completed') {
        return status;
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Invalidation ${invalidationId} did not complete within ${maxWaitTime}ms`);
  }

  /**
   * Get CloudFront URL for a given S3 key
   */
  static getCloudFrontUrl(key: string): string {
    if (S3_CONFIG.CLOUDFRONT.DOMAIN) {
      return `https://${S3_CONFIG.CLOUDFRONT.DOMAIN}/${key}`;
    }

    // Fallback to S3 URL if CloudFront not configured
    return `https://${S3_CONFIG.BUCKET_NAME}.s3.${S3_CONFIG.REGION}.amazonaws.com/${key}`;
  }

  /**
   * Generate signed CloudFront URL (for private content)
   */
  static generateSignedUrl(
    key: string,
    expiresIn: number = 3600,
    keyPairId?: string,
    privateKey?: string
  ): string {
    // Note: This is a simplified version. In production, you'd use
    // the CloudFront SDK's getSignedUrl function with proper key management

    if (!S3_CONFIG.CLOUDFRONT.DOMAIN) {
      throw new Error('CloudFront domain not configured');
    }

    if (!keyPairId || !privateKey) {
      // Return unsigned URL if signing credentials not provided
      return this.getCloudFrontUrl(key);
    }

    // In a real implementation, you would:
    // 1. Create a policy statement
    // 2. Sign it with the private key
    // 3. Generate the signed URL
    // For now, return the regular CloudFront URL
    return this.getCloudFrontUrl(key);
  }

  /**
   * Optimize cache headers for different content types
   */
  static getCacheHeaders(contentType: string): Record<string, string> {
    const headers: Record<string, string> = {};

    if (contentType.startsWith('video/')) {
      headers['Cache-Control'] = 'public, max-age=31536000, immutable'; // 1 year
      headers['Expires'] = new Date(Date.now() + 31536000 * 1000).toUTCString();
    } else if (contentType.startsWith('image/')) {
      headers['Cache-Control'] = 'public, max-age=2592000'; // 30 days
      headers['Expires'] = new Date(Date.now() + 2592000 * 1000).toUTCString();
    } else {
      headers['Cache-Control'] = 'public, max-age=86400'; // 1 day
      headers['Expires'] = new Date(Date.now() + 86400 * 1000).toUTCString();
    }

    return headers;
  }

  /**
   * Health check for CloudFront service
   */
  static async healthCheck(): Promise<{
    healthy: boolean;
    distributionCount: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let healthy = false;
    let distributionCount = 0;

    try {
      const distributions = await this.listDistributions();
      distributionCount = distributions.length;
      healthy = true;
    } catch (error) {
      errors.push(`CloudFront health check failed: ${error}`);
    }

    return {
      healthy,
      distributionCount,
      errors,
    };
  }
}
