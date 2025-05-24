#!/usr/bin/env tsx

import {
  CreateBucketCommand,
  PutBucketCorsCommand,
  PutBucketPolicyCommand,
  PutBucketVersioningCommand,
  PutBucketLifecycleConfigurationCommand,

  HeadBucketCommand,
} from '@aws-sdk/client-s3';

import { s3Client, S3_CONFIG } from '../src/lib/aws-config';

const BUCKET_NAME = S3_CONFIG.BUCKET_NAME;
const REGION = S3_CONFIG.REGION;

async function setupS3Bucket() {
  try {
    console.log('🚀 Setting up S3 bucket for Sports Celebrity Reels...');
    console.log(`📦 Bucket: ${BUCKET_NAME}`);
    console.log(`🌍 Region: ${REGION}`);

    // Check if bucket already exists
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
      console.log('✅ Bucket already exists');
    } catch (error: any) {
      if (error.name === 'NotFound') {
        console.log('📦 Creating bucket...');

        // Create bucket
        const createCommand = new CreateBucketCommand({
          Bucket: BUCKET_NAME,
          CreateBucketConfiguration: REGION !== 'us-east-1' ? {
            LocationConstraint: REGION as any,
          } : undefined,
        });

        await s3Client.send(createCommand);
        console.log('✅ Bucket created successfully');
      } else {
        throw error;
      }
    }

    // Configure CORS
    console.log('🔧 Configuring CORS...');
    const corsCommand = new PutBucketCorsCommand({
      Bucket: BUCKET_NAME,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ['*'],
            AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
            AllowedOrigins: [
              'http://localhost:3000',
              'http://localhost:3001',
              'https://*.vercel.app',
              'https://your-domain.com', // Replace with your actual domain
            ],
            ExposeHeaders: ['ETag', 'x-amz-meta-*'],
            MaxAgeSeconds: 3000,
          },
        ],
      },
    });
    await s3Client.send(corsCommand);
    console.log('✅ CORS configured');

    // Configure bucket policy for public read access
    console.log('🔐 Configuring bucket policy...');
    const bucketPolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'PublicReadGetObject',
          Effect: 'Allow',
          Principal: '*',
          Action: 's3:GetObject',
          Resource: `arn:aws:s3:::${BUCKET_NAME}/videos/*`,
        },
        {
          Sid: 'PublicReadGetThumbnails',
          Effect: 'Allow',
          Principal: '*',
          Action: 's3:GetObject',
          Resource: `arn:aws:s3:::${BUCKET_NAME}/thumbnails/*`,
        },
        {
          Sid: 'PublicReadGetImages',
          Effect: 'Allow',
          Principal: '*',
          Action: 's3:GetObject',
          Resource: `arn:aws:s3:::${BUCKET_NAME}/images/*`,
        },
      ],
    };

    const policyCommand = new PutBucketPolicyCommand({
      Bucket: BUCKET_NAME,
      Policy: JSON.stringify(bucketPolicy),
    });
    await s3Client.send(policyCommand);
    console.log('✅ Bucket policy configured');

    // Enable versioning
    console.log('📝 Enabling versioning...');
    const versioningCommand = new PutBucketVersioningCommand({
      Bucket: BUCKET_NAME,
      VersioningConfiguration: {
        Status: 'Enabled',
      },
    });
    await s3Client.send(versioningCommand);
    console.log('✅ Versioning enabled');

    // Configure lifecycle rules
    console.log('♻️  Configuring lifecycle rules...');
    const lifecycleCommand = new PutBucketLifecycleConfigurationCommand({
      Bucket: BUCKET_NAME,
      LifecycleConfiguration: {
        Rules: [
          {
            ID: 'DeleteTempFiles',
            Status: 'Enabled',
            Filter: {
              Prefix: 'temp/',
            },
            Expiration: {
              Days: 1, // Delete temp files after 1 day
            },
          },
          {
            ID: 'TransitionToIA',
            Status: 'Enabled',
            Filter: {
              Prefix: 'videos/',
            },
            Transitions: [
              {
                Days: 30,
                StorageClass: 'STANDARD_IA', // Move to Infrequent Access after 30 days
              },
              {
                Days: 90,
                StorageClass: 'GLACIER', // Move to Glacier after 90 days
              },
            ],
          },
          {
            ID: 'DeleteIncompleteMultipartUploads',
            Status: 'Enabled',
            AbortIncompleteMultipartUpload: {
              DaysAfterInitiation: 7, // Clean up incomplete uploads after 7 days
            },
          },
          {
            ID: 'DeleteOldVersions',
            Status: 'Enabled',
            NoncurrentVersionExpiration: {
              NoncurrentDays: 30, // Delete old versions after 30 days
            },
          },
        ],
      },
    });
    await s3Client.send(lifecycleCommand);
    console.log('✅ Lifecycle rules configured');

    // Create folder structure
    console.log('📁 Creating folder structure...');
    const folders = Object.values(S3_CONFIG.FOLDERS);

    for (const folder of folders) {
      try {
        // Create a placeholder file to ensure folder exists
        const { PutObjectCommand } = await import('@aws-sdk/client-s3');
        const putCommand = new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: `${folder}.gitkeep`,
          Body: '',
          ContentType: 'text/plain',
        });
        await s3Client.send(putCommand);
        console.log(`✅ Created folder: ${folder}`);
      } catch (error) {
        console.warn(`⚠️  Failed to create folder ${folder}:`, error);
      }
    }

    console.log('\n🎉 S3 bucket setup completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   • Bucket: ${BUCKET_NAME}`);
    console.log(`   • Region: ${REGION}`);
    console.log('   • CORS: Configured for web access');
    console.log('   • Policy: Public read access for media files');
    console.log('   • Versioning: Enabled');
    console.log('   • Lifecycle: Configured for cost optimization');
    console.log('   • Folders: Created for organized storage');

    console.log('\n🔗 Next steps:');
    console.log('   1. Set up CloudFront distribution (optional but recommended)');
    console.log('   2. Configure your domain in CORS settings');
    console.log('   3. Test file uploads using the API');

  } catch (error) {
    console.error('❌ S3 bucket setup failed:', error);
    process.exit(1);
  }
}

async function createCloudFrontDistribution() {
  console.log('\n☁️  CloudFront distribution setup...');
  console.log('⚠️  Note: CloudFront setup requires additional configuration.');
  console.log('   Please set up CloudFront manually or use AWS CDK/Terraform.');

  console.log('\n📋 Recommended CloudFront settings:');
  console.log(`   • Origin: ${BUCKET_NAME}.s3.${REGION}.amazonaws.com`);
  console.log('   • Viewer Protocol Policy: Redirect HTTP to HTTPS');
  console.log('   • Allowed HTTP Methods: GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE');
  console.log('   • Cache Behaviors:');
  console.log('     - videos/*: Cache for 1 year (immutable content)');
  console.log('     - thumbnails/*: Cache for 30 days');
  console.log('     - images/*: Cache for 30 days');
  console.log('   • Compress Objects Automatically: Yes');
  console.log('   • Price Class: Use All Edge Locations (for best performance)');
}

async function testBucketSetup() {
  try {
    console.log('\n🧪 Testing bucket setup...');

    // Test upload
    const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = await import('@aws-sdk/client-s3');

    const testKey = 'temp/test-file.txt';
    const testContent = 'S3 bucket test file';

    // Upload test file
    const putCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: testKey,
      Body: testContent,
      ContentType: 'text/plain',
    });
    await s3Client.send(putCommand);
    console.log('✅ Upload test passed');

    // Download test file
    const getCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: testKey,
    });
    const getResult = await s3Client.send(getCommand);
    const downloadedContent = await getResult.Body?.transformToString();

    if (downloadedContent === testContent) {
      console.log('✅ Download test passed');
    } else {
      throw new Error('Downloaded content does not match uploaded content');
    }

    // Delete test file
    const deleteCommand = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: testKey,
    });
    await s3Client.send(deleteCommand);
    console.log('✅ Delete test passed');

    console.log('🎉 All tests passed! Bucket is ready for use.');

  } catch (error) {
    console.error('❌ Bucket test failed:', error);
    throw error;
  }
}

async function main() {
  try {
    await setupS3Bucket();
    await createCloudFrontDistribution();
    await testBucketSetup();
  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { setupS3Bucket, testBucketSetup };
