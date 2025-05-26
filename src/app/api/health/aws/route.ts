import { NextRequest, NextResponse } from 'next/server';

import { checkAWSHealth } from '@/lib/aws-config';
import { S3Service } from '@/services/s3';
import { CloudFrontService } from '@/services/cloudfront';

/**
 * GET /api/health/aws - Check AWS services health
 */
export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now();

    // Run health check
    const health = await checkAWSHealth();

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    // Process results
    const results = {
      overall: health.s3 && health.cloudfront ? 'healthy' : 'unhealthy',
      responseTime,
      timestamp: new Date().toISOString(),
      services: {
        s3: {
          status: health.s3 ? 'healthy' : 'unhealthy',
          details: {},
        },
        cloudfront: {
          status: health.cloudfront ? 'healthy' : 'unhealthy',
          details: {},
        },
      },
      errors: health.errors,
    };

    // Return appropriate status code
    const statusCode = results.overall === 'healthy' ? 200 : 503;

    return NextResponse.json(results, { status: statusCode });
  } catch (error) {
    console.error('AWS health check error:', error);
    
    return NextResponse.json({
      overall: 'unhealthy',
      responseTime: 0,
      timestamp: new Date().toISOString(),
      services: {
        s3: { status: 'unhealthy', details: {} },
        cloudfront: { status: 'unhealthy', details: {} },
      },
      errors: [`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
    }, { status: 503 });
  }
}

/**
 * Test basic S3 operations
 */
async function testS3Operations(): Promise<{
  canList: boolean;
  fileCount: number;
  duration: number;
}> {
  const startTime = Date.now();
  
  try {
    // Test listing files in videos folder
    const result = await S3Service.listFiles('VIDEOS', { maxKeys: 10 });
    
    return {
      canList: true,
      fileCount: result.files.length,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      canList: false,
      fileCount: 0,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * POST /api/health/aws/test - Run comprehensive AWS tests
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { includeUploadTest = false, includeDownloadTest = false } = body;

    const results = {
      timestamp: new Date().toISOString(),
      tests: {
        connection: { status: 'pending', duration: 0, details: {} },
        list: { status: 'pending', duration: 0, details: {} },
        upload: { status: 'skipped', duration: 0, details: {} },
        download: { status: 'skipped', duration: 0, details: {} },
        cleanup: { status: 'skipped', duration: 0, details: {} },
      },
      overall: 'pending' as 'passed' | 'failed' | 'partial',
    };

    // Test 1: Connection
    try {
      const startTime = Date.now();
      const health = await checkAWSHealth();
      results.tests.connection = {
        status: health.s3 && health.cloudfront ? 'passed' : 'failed',
        duration: Date.now() - startTime,
        details: health,
      };
    } catch (error) {
      results.tests.connection = {
        status: 'failed',
        duration: 0,
        details: { error: String(error) },
      };
    }

    // Test 2: List operations
    try {
      const startTime = Date.now();
      const listResult = await S3Service.listFiles('VIDEOS', { maxKeys: 5 });
      results.tests.list = {
        status: 'passed',
        duration: Date.now() - startTime,
        details: {
          fileCount: listResult.files.length,
          isTruncated: listResult.isTruncated,
        },
      };
    } catch (error) {
      results.tests.list = {
        status: 'failed',
        duration: 0,
        details: { error: String(error) },
      };
    }

    // Test 3: Upload (if requested)
    let testKey: string | undefined;
    if (includeUploadTest) {
      try {
        const startTime = Date.now();
        const testContent = Buffer.from('AWS health check test file');
        const uploadResult = await S3Service.uploadFile(testContent, {
          folder: 'TEMP',
          filename: `health-check-${Date.now()}.txt`,
          contentType: 'text/plain',
          prefix: 'test_',
        });
        
        testKey = uploadResult.key;
        results.tests.upload = {
          status: 'passed',
          duration: Date.now() - startTime,
          details: {
            key: uploadResult.key,
            size: testContent.length,
            url: uploadResult.url,
          },
        };
      } catch (error) {
        results.tests.upload = {
          status: 'failed',
          duration: 0,
          details: { error: String(error) },
        };
      }
    }

    // Test 4: Download (if upload succeeded and requested)
    if (includeDownloadTest && testKey) {
      try {
        const startTime = Date.now();
        const downloadResult = await S3Service.downloadFile(testKey);
        results.tests.download = {
          status: 'passed',
          duration: Date.now() - startTime,
          details: {
            contentLength: downloadResult.contentLength,
            contentType: downloadResult.contentType,
          },
        };
      } catch (error) {
        results.tests.download = {
          status: 'failed',
          duration: 0,
          details: { error: String(error) },
        };
      }
    }

    // Test 5: Cleanup (if test file was created)
    if (testKey) {
      try {
        const startTime = Date.now();
        await S3Service.deleteFile(testKey);
        results.tests.cleanup = {
          status: 'passed',
          duration: Date.now() - startTime,
          details: { deletedKey: testKey },
        };
      } catch (error) {
        results.tests.cleanup = {
          status: 'failed',
          duration: 0,
          details: { error: String(error), key: testKey },
        };
      }
    }

    // Determine overall result
    const testResults = Object.values(results.tests)
      .filter(test => test.status !== 'skipped')
      .map(test => test.status);
    
    if (testResults.every(status => status === 'passed')) {
      results.overall = 'passed';
    } else if (testResults.some(status => status === 'passed')) {
      results.overall = 'partial';
    } else {
      results.overall = 'failed';
    }

    const statusCode = results.overall === 'passed' ? 200 : 
                      results.overall === 'partial' ? 200 : 500;

    return NextResponse.json(results, { status: statusCode });
  } catch (error) {
    console.error('AWS test error:', error);
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      tests: {},
      overall: 'failed',
      error: String(error),
    }, { status: 500 });
  }
}
