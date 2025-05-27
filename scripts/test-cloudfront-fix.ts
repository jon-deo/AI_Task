#!/usr/bin/env tsx

import { config } from '../src/config';

const BUCKET_NAME = config.aws.s3Bucket;
const REGION = config.aws.region;
const CLOUDFRONT_DOMAIN = process.env.AWS_CLOUDFRONT_DOMAIN;

async function testVideoAccess() {
  console.log('🧪 Testing CloudFront fix for video access...\n');

  // Test video that was causing 403 error
  const testVideoKey = 'videos/video_1748260179305_g3x3ez6tykn.mp4';
  
  const s3Url = `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${testVideoKey}`;
  const cloudFrontUrl = CLOUDFRONT_DOMAIN ? `https://${CLOUDFRONT_DOMAIN}/${testVideoKey}` : null;

  console.log('📋 Test Configuration:');
  console.log(`   • S3 Bucket: ${BUCKET_NAME}`);
  console.log(`   • Region: ${REGION}`);
  console.log(`   • CloudFront Domain: ${CLOUDFRONT_DOMAIN || 'Not configured'}`);
  console.log(`   • Test Video: ${testVideoKey}\n`);

  // Test 1: Direct S3 access
  console.log('🔍 Test 1: Direct S3 Access');
  console.log(`   URL: ${s3Url}`);
  
  try {
    const response = await fetch(s3Url, { method: 'HEAD' });
    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      console.log('   ✅ Direct S3 access working!');
      console.log(`   Content-Type: ${response.headers.get('content-type')}`);
      console.log(`   Content-Length: ${response.headers.get('content-length')}`);
    } else {
      console.log('   ❌ Direct S3 access failed');
      console.log(`   Error: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.log('   ❌ Direct S3 access failed');
    console.log(`   Error: ${error}`);
  }

  console.log('');

  // Test 2: CloudFront access
  if (cloudFrontUrl) {
    console.log('🔍 Test 2: CloudFront Access');
    console.log(`   URL: ${cloudFrontUrl}`);
    
    try {
      const response = await fetch(cloudFrontUrl, { method: 'HEAD' });
      console.log(`   Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        console.log('   ✅ CloudFront access working!');
        console.log(`   Content-Type: ${response.headers.get('content-type')}`);
        console.log(`   Content-Length: ${response.headers.get('content-length')}`);
        console.log(`   Cache Status: ${response.headers.get('x-cache') || 'Not available'}`);
      } else {
        console.log('   ❌ CloudFront access failed');
        console.log(`   Error: ${response.status} ${response.statusText}`);
        
        if (response.status === 403) {
          console.log('   💡 This might be normal if CloudFront is still deploying (10-15 minutes)');
        }
      }
    } catch (error) {
      console.log('   ❌ CloudFront access failed');
      console.log(`   Error: ${error}`);
    }
  } else {
    console.log('🔍 Test 2: CloudFront Access');
    console.log('   ⚠️  CloudFront domain not configured in .env.local');
  }

  console.log('');

  // Test 3: API endpoint
  console.log('🔍 Test 3: API Endpoint Test');
  try {
    const apiUrl = 'http://localhost:3000/api/reels';
    console.log(`   URL: ${apiUrl}`);
    
    const response = await fetch(apiUrl);
    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      const reels = data?.data?.items || data?.data?.reels || data?.reels || [];
      console.log(`   ✅ API working! Found ${reels.length} reels`);
      
      if (reels.length > 0) {
        const firstReel = reels[0];
        console.log(`   Sample video URL: ${firstReel.videoUrl}`);
        
        // Check if the URL uses the new CloudFront domain
        if (firstReel.videoUrl.includes(CLOUDFRONT_DOMAIN)) {
          console.log('   ✅ Using new CloudFront domain');
        } else if (firstReel.videoUrl.includes('d2vakxa9lbd2lr.cloudfront.net')) {
          console.log('   ⚠️  Still using old CloudFront domain');
          console.log('   💡 You may need to regenerate videos or update the database');
        } else {
          console.log('   ℹ️  Using direct S3 URLs');
        }
      }
    } else {
      console.log('   ❌ API failed');
      console.log(`   Error: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.log('   ❌ API failed');
    console.log(`   Error: ${error}`);
    console.log('   💡 Make sure the development server is running: npm run dev');
  }

  console.log('\n📋 Summary:');
  console.log('   The 403 Forbidden error should now be fixed!');
  console.log('   If CloudFront is still returning 403, wait 10-15 minutes for deployment.');
  console.log('\n🔗 Next steps:');
  console.log('   1. Test your application in the browser');
  console.log('   2. If videos still don\'t load, check the browser console for errors');
  console.log('   3. Consider regenerating videos to use the new CloudFront domain');
}

async function main() {
  try {
    await testVideoAccess();
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { testVideoAccess };
