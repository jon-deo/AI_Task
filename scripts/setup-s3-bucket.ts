#!/usr/bin/env tsx

import {
  CreateBucketCommand,
  PutBucketCorsCommand,
  PutBucketPolicyCommand,
  PutBucketVersioningCommand,
  PutBucketLifecycleConfigurationCommand,
  GetBucketPolicyCommand,
  S3Client,
  BucketLocationConstraint,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

import { config } from '../src/config';

const FOLDERS = {
  VIDEOS: 'videos/',
  THUMBNAILS: 'thumbnails/',
  IMAGES: 'images/',
  TEMP: 'temp/',
  PROCESSED: 'processed/',
} as const;

const BUCKET_NAME = config.aws.s3Bucket;
const REGION = config.aws.region;

const s3Client = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});

async function setupS3Bucket() {
  console.log('🚀 Setting up S3 bucket for Sports Celebrity Reels...');
  console.log('📦 Bucket:', BUCKET_NAME);
  console.log('🌍 Region:', REGION);

  try {
    // Check if bucket exists
    try {
      await s3Client.send(new GetBucketPolicyCommand({
        Bucket: BUCKET_NAME,
      }));
      console.log('✅ Bucket already exists');
    } catch (error) {
      // Create bucket if it doesn't exist
      await s3Client.send(new CreateBucketCommand({
        Bucket: BUCKET_NAME,
        CreateBucketConfiguration: {
          LocationConstraint: REGION as BucketLocationConstraint,
        },
      }));
      console.log('✅ Bucket created');
    }

    // Configure CORS
    console.log('🔧 Configuring CORS...');
    await s3Client.send(new PutBucketCorsCommand({
      Bucket: BUCKET_NAME,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ['*'],
            AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
            AllowedOrigins: ['*'],
            ExposeHeaders: ['ETag'],
            MaxAgeSeconds: 3000,
          },
        ],
      },
    }));
    console.log('✅ CORS configured');

    // Configure bucket policy for CloudFront and authenticated access
    console.log('🔐 Configuring bucket policy...');
    const bucketPolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'AllowAuthenticatedAccess',
          Effect: 'Allow',
          Principal: {
            AWS: `arn:aws:iam::${process.env.AWS_ACCOUNT_ID}:root`,
          },
          Action: [
            's3:GetObject',
            's3:PutObject',
            's3:DeleteObject',
            's3:ListBucket',
          ],
          Resource: [
            `arn:aws:s3:::${BUCKET_NAME}`,
            `arn:aws:s3:::${BUCKET_NAME}/*`,
          ],
        },
        {
          Sid: 'AllowCloudFrontServicePrincipal',
          Effect: 'Allow',
          Principal: {
            Service: 'cloudfront.amazonaws.com'
          },
          Action: 's3:GetObject',
          Resource: `arn:aws:s3:::${BUCKET_NAME}/*`,
          Condition: {
            StringEquals: {
              'AWS:SourceAccount': process.env.AWS_ACCOUNT_ID
            }
          }
        },
        {
          Sid: 'AllowPublicReadForVideos',
          Effect: 'Allow',
          Principal: '*',
          Action: 's3:GetObject',
          Resource: [
            `arn:aws:s3:::${BUCKET_NAME}/videos/*`,
            `arn:aws:s3:::${BUCKET_NAME}/thumbnails/*`,
            `arn:aws:s3:::${BUCKET_NAME}/images/*`
          ]
        }
      ],
    };

    await s3Client.send(new PutBucketPolicyCommand({
      Bucket: BUCKET_NAME,
      Policy: JSON.stringify(bucketPolicy),
    }));
    console.log('✅ Bucket policy configured for CloudFront and public access');

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
            Prefix: 'temp/',
            Expiration: {
              Days: 1
            }
          }
        ]
      }
    });
    await s3Client.send(lifecycleCommand);
    console.log('✅ Lifecycle rules configured');

    // Create folder structure
    console.log('📁 Creating folder structure...');
    const folders = Object.values(FOLDERS);

    for (const folder of folders) {
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: folder,
        Body: ' ',
        ContentType: 'text/plain'
      }));
    }
    console.log('✅ Folder structure created');

    // Test upload, download, and delete
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
    const { GetObjectCommand, DeleteObjectCommand } = await import('@aws-sdk/client-s3');

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
  setupS3Bucket();
}

export { setupS3Bucket, testBucketSetup };
