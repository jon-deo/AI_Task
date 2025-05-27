#!/usr/bin/env tsx

import {
  S3Client,
  PutBucketPolicyCommand,
  GetBucketPolicyCommand,
  PutPublicAccessBlockCommand,
} from '@aws-sdk/client-s3';

import { config } from '../src/config';

const BUCKET_NAME = config.aws.s3Bucket;
const REGION = config.aws.region;
const ACCOUNT_ID = process.env.AWS_ACCOUNT_ID;

const s3Client = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});

async function updateS3BucketPolicy() {
  console.log('🔧 Updating S3 bucket policy for CloudFront access...');
  console.log('📦 Bucket:', BUCKET_NAME);
  console.log('🆔 Account ID:', ACCOUNT_ID);

  if (!ACCOUNT_ID) {
    throw new Error('AWS_ACCOUNT_ID environment variable is required');
  }

  try {
    // First, update public access block settings to allow public read for specific paths
    console.log('🔓 Updating public access block settings...');
    await s3Client.send(new PutPublicAccessBlockCommand({
      Bucket: BUCKET_NAME,
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        IgnorePublicAcls: true,
        BlockPublicPolicy: false, // Allow public bucket policies
        RestrictPublicBuckets: false, // Allow public bucket policies
      },
    }));
    console.log('✅ Public access block updated');

    // Create the new bucket policy
    const bucketPolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'AllowAuthenticatedAccess',
          Effect: 'Allow',
          Principal: {
            AWS: `arn:aws:iam::${ACCOUNT_ID}:root`,
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
              'AWS:SourceAccount': ACCOUNT_ID
            }
          }
        },
        {
          Sid: 'AllowPublicReadForMediaFiles',
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

    // Get current policy to compare
    try {
      const currentPolicy = await s3Client.send(new GetBucketPolicyCommand({
        Bucket: BUCKET_NAME,
      }));
      console.log('📄 Current bucket policy found, updating...');
    } catch (error: any) {
      if (error.name === 'NoSuchBucketPolicy') {
        console.log('📄 No existing bucket policy, creating new one...');
      } else {
        throw error;
      }
    }

    // Apply the new policy
    await s3Client.send(new PutBucketPolicyCommand({
      Bucket: BUCKET_NAME,
      Policy: JSON.stringify(bucketPolicy, null, 2),
    }));

    console.log('✅ Bucket policy updated successfully!');
    console.log('\n📋 New policy allows:');
    console.log('   • Full access for your AWS account');
    console.log('   • CloudFront service access for all files');
    console.log('   • Public read access for videos, thumbnails, and images');
    console.log('   • Private access for temp and other folders');

    return true;
  } catch (error) {
    console.error('❌ Failed to update bucket policy:', error);
    throw error;
  }
}

async function testBucketAccess() {
  console.log('\n🧪 Testing bucket access...');
  
  try {
    // Test if we can still access the bucket with our credentials
    const policy = await s3Client.send(new GetBucketPolicyCommand({
      Bucket: BUCKET_NAME,
    }));
    
    console.log('✅ Bucket policy is accessible');
    
    // Parse and validate the policy
    const policyDoc = JSON.parse(policy.Policy || '{}');
    const statements = policyDoc.Statement || [];
    
    const hasAuthAccess = statements.some((stmt: any) => 
      stmt.Sid === 'AllowAuthenticatedAccess'
    );
    const hasCloudFrontAccess = statements.some((stmt: any) => 
      stmt.Sid === 'AllowCloudFrontServicePrincipal'
    );
    const hasPublicAccess = statements.some((stmt: any) => 
      stmt.Sid === 'AllowPublicReadForMediaFiles'
    );
    
    console.log(`   • Authenticated access: ${hasAuthAccess ? '✅' : '❌'}`);
    console.log(`   • CloudFront access: ${hasCloudFrontAccess ? '✅' : '❌'}`);
    console.log(`   • Public media access: ${hasPublicAccess ? '✅' : '❌'}`);
    
    if (hasAuthAccess && hasCloudFrontAccess && hasPublicAccess) {
      console.log('🎉 All access policies are correctly configured!');
      return true;
    } else {
      console.log('⚠️  Some access policies may not be configured correctly');
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to test bucket access:', error);
    return false;
  }
}

async function main() {
  try {
    console.log('🚀 Fixing S3 bucket policy for CloudFront access...\n');
    
    await updateS3BucketPolicy();
    await testBucketAccess();
    
    console.log('\n🎉 S3 bucket policy fix completed!');
    console.log('\n🔗 Next steps:');
    console.log('   1. Set up CloudFront distribution: npm run setup:cloudfront');
    console.log('   2. Update your .env.local with the CloudFront domain');
    console.log('   3. Test video access through CloudFront URLs');
    console.log('\n💡 Your videos should now be accessible via:');
    console.log(`   • Direct S3: https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/videos/your-video.mp4`);
    console.log(`   • CloudFront: https://your-cloudfront-domain.cloudfront.net/videos/your-video.mp4`);
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { updateS3BucketPolicy, testBucketAccess };
