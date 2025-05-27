#!/usr/bin/env tsx

import {
  CloudFrontClient,
  CreateDistributionCommand,
  GetDistributionCommand,
  CreateOriginAccessControlCommand,
  GetOriginAccessControlCommand,
  ListDistributionsCommand,
  CreateInvalidationCommand,
} from '@aws-sdk/client-cloudfront';

import { config } from '../src/config';

const BUCKET_NAME = config.aws.s3Bucket;
const REGION = config.aws.region;
const ACCOUNT_ID = process.env.AWS_ACCOUNT_ID;

const cloudFrontClient = new CloudFrontClient({
  region: 'us-east-1', // CloudFront is always in us-east-1
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});

interface CloudFrontSetupResult {
  distributionId: string;
  distributionDomain: string;
  originAccessControlId: string;
}

async function createOriginAccessControl(): Promise<string> {
  console.log('🔐 Creating Origin Access Control...');
  
  try {
    const command = new CreateOriginAccessControlCommand({
      OriginAccessControlConfig: {
        Name: `${BUCKET_NAME}-oac`,
        Description: `Origin Access Control for ${BUCKET_NAME} S3 bucket`,
        OriginAccessControlOriginType: 's3',
        SigningBehavior: 'always',
        SigningProtocol: 'sigv4',
      },
    });

    const result = await cloudFrontClient.send(command);
    const oacId = result.OriginAccessControl?.Id;
    
    if (!oacId) {
      throw new Error('Failed to create Origin Access Control');
    }

    console.log(`✅ Origin Access Control created: ${oacId}`);
    return oacId;
  } catch (error: any) {
    if (error.name === 'OriginAccessControlAlreadyExists') {
      console.log('⚠️  Origin Access Control already exists, using existing one');
      // You might want to list and find the existing OAC here
      throw new Error('Please manually get the existing OAC ID or delete the existing one');
    }
    throw error;
  }
}

async function createCloudFrontDistribution(originAccessControlId: string): Promise<CloudFrontSetupResult> {
  console.log('☁️  Creating CloudFront distribution...');

  const distributionConfig = {
    CallerReference: `${BUCKET_NAME}-${Date.now()}`,
    Comment: `Distribution for ${BUCKET_NAME} - Sports Celebrity Reels`,
    DefaultRootObject: 'index.html',
    Enabled: true,
    PriceClass: 'PriceClass_All',
    
    Origins: {
      Quantity: 1,
      Items: [
        {
          Id: `${BUCKET_NAME}-origin`,
          DomainName: `${BUCKET_NAME}.s3.${REGION}.amazonaws.com`,
          OriginAccessControlId: originAccessControlId,
          S3OriginConfig: {
            OriginAccessIdentity: '', // Empty for OAC
          },
        },
      ],
    },

    DefaultCacheBehavior: {
      TargetOriginId: `${BUCKET_NAME}-origin`,
      ViewerProtocolPolicy: 'redirect-to-https',
      AllowedMethods: {
        Quantity: 7,
        Items: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'POST', 'PATCH', 'DELETE'],
        CachedMethods: {
          Quantity: 2,
          Items: ['GET', 'HEAD'],
        },
      },
      ForwardedValues: {
        QueryString: false,
        Cookies: {
          Forward: 'none',
        },
        Headers: {
          Quantity: 0,
        },
      },
      TrustedSigners: {
        Enabled: false,
        Quantity: 0,
      },
      MinTTL: 0,
      DefaultTTL: 86400, // 1 day
      MaxTTL: 31536000, // 1 year
      Compress: true,
    },

    CacheBehaviors: {
      Quantity: 3,
      Items: [
        {
          PathPattern: 'videos/*',
          TargetOriginId: `${BUCKET_NAME}-origin`,
          ViewerProtocolPolicy: 'redirect-to-https',
          AllowedMethods: {
            Quantity: 2,
            Items: ['GET', 'HEAD'],
            CachedMethods: {
              Quantity: 2,
              Items: ['GET', 'HEAD'],
            },
          },
          ForwardedValues: {
            QueryString: false,
            Cookies: { Forward: 'none' },
          },
          TrustedSigners: {
            Enabled: false,
            Quantity: 0,
          },
          MinTTL: 0,
          DefaultTTL: 31536000, // 1 year for videos (immutable)
          MaxTTL: 31536000,
          Compress: false, // Don't compress videos
        },
        {
          PathPattern: 'thumbnails/*',
          TargetOriginId: `${BUCKET_NAME}-origin`,
          ViewerProtocolPolicy: 'redirect-to-https',
          AllowedMethods: {
            Quantity: 2,
            Items: ['GET', 'HEAD'],
            CachedMethods: {
              Quantity: 2,
              Items: ['GET', 'HEAD'],
            },
          },
          ForwardedValues: {
            QueryString: false,
            Cookies: { Forward: 'none' },
          },
          TrustedSigners: {
            Enabled: false,
            Quantity: 0,
          },
          MinTTL: 0,
          DefaultTTL: 2592000, // 30 days for thumbnails
          MaxTTL: 31536000,
          Compress: true,
        },
        {
          PathPattern: 'images/*',
          TargetOriginId: `${BUCKET_NAME}-origin`,
          ViewerProtocolPolicy: 'redirect-to-https',
          AllowedMethods: {
            Quantity: 2,
            Items: ['GET', 'HEAD'],
            CachedMethods: {
              Quantity: 2,
              Items: ['GET', 'HEAD'],
            },
          },
          ForwardedValues: {
            QueryString: false,
            Cookies: { Forward: 'none' },
          },
          TrustedSigners: {
            Enabled: false,
            Quantity: 0,
          },
          MinTTL: 0,
          DefaultTTL: 2592000, // 30 days for images
          MaxTTL: 31536000,
          Compress: true,
        },
      ],
    },

    CustomErrorResponses: {
      Quantity: 2,
      Items: [
        {
          ErrorCode: 403,
          ResponseCode: 404,
          ResponsePagePath: '/404.html',
          ErrorCachingMinTTL: 300,
        },
        {
          ErrorCode: 404,
          ResponseCode: 404,
          ResponsePagePath: '/404.html',
          ErrorCachingMinTTL: 300,
        },
      ],
    },
  };

  try {
    const command = new CreateDistributionCommand({
      DistributionConfig: distributionConfig,
    });

    const result = await cloudFrontClient.send(command);
    const distribution = result.Distribution;
    
    if (!distribution?.Id || !distribution?.DomainName) {
      throw new Error('Failed to create CloudFront distribution');
    }

    console.log(`✅ CloudFront distribution created: ${distribution.Id}`);
    console.log(`🌐 Distribution domain: ${distribution.DomainName}`);

    return {
      distributionId: distribution.Id,
      distributionDomain: distribution.DomainName,
      originAccessControlId,
    };
  } catch (error) {
    console.error('❌ Failed to create CloudFront distribution:', error);
    throw error;
  }
}

async function waitForDistributionDeployment(distributionId: string): Promise<void> {
  console.log('⏳ Waiting for distribution deployment...');
  console.log('   This may take 10-15 minutes...');

  let attempts = 0;
  const maxAttempts = 60; // 30 minutes max
  
  while (attempts < maxAttempts) {
    try {
      const command = new GetDistributionCommand({ Id: distributionId });
      const result = await cloudFrontClient.send(command);
      
      if (result.Distribution?.Status === 'Deployed') {
        console.log('✅ Distribution deployed successfully!');
        return;
      }
      
      console.log(`   Status: ${result.Distribution?.Status} (attempt ${attempts + 1}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
      attempts++;
    } catch (error) {
      console.error('Error checking distribution status:', error);
      attempts++;
    }
  }
  
  console.log('⚠️  Distribution deployment is taking longer than expected.');
  console.log('   You can check the status in the AWS Console.');
}

async function setupCloudFront(): Promise<CloudFrontSetupResult> {
  console.log('🚀 Setting up CloudFront distribution for Sports Celebrity Reels...');
  console.log('📦 S3 Bucket:', BUCKET_NAME);
  console.log('🌍 Region:', REGION);

  try {
    // Step 1: Create Origin Access Control
    const originAccessControlId = await createOriginAccessControl();

    // Step 2: Create CloudFront Distribution
    const result = await createCloudFrontDistribution(originAccessControlId);

    // Step 3: Wait for deployment (optional, can be skipped for faster setup)
    console.log('\n⚠️  Note: Distribution deployment can take 10-15 minutes.');
    console.log('   You can continue with other setup tasks while it deploys.');
    
    const shouldWait = process.argv.includes('--wait');
    if (shouldWait) {
      await waitForDistributionDeployment(result.distributionId);
    }

    console.log('\n🎉 CloudFront setup completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   • Distribution ID: ${result.distributionId}`);
    console.log(`   • Distribution Domain: ${result.distributionDomain}`);
    console.log(`   • Origin Access Control ID: ${result.originAccessControlId}`);
    console.log(`   • S3 Bucket: ${BUCKET_NAME}`);

    console.log('\n🔗 Next steps:');
    console.log('   1. Update your .env.local file with the distribution domain');
    console.log('   2. Test video access through CloudFront');
    console.log('   3. Configure custom domain (optional)');
    console.log('\n💡 Add this to your .env.local:');
    console.log(`AWS_CLOUDFRONT_DOMAIN="${result.distributionDomain}"`);

    return result;
  } catch (error) {
    console.error('❌ CloudFront setup failed:', error);
    throw error;
  }
}

async function main() {
  try {
    await setupCloudFront();
  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { setupCloudFront, createOriginAccessControl, createCloudFrontDistribution };
