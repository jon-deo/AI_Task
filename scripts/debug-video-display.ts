#!/usr/bin/env tsx

async function debugVideoDisplay() {
  console.log('🔍 Debugging video display issues...\n');

  try {
    // Test 1: Check API response
    console.log('📡 Testing API response...');
    const apiUrl = 'http://localhost:3000/api/reels';
    const response = await fetch(apiUrl);
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      console.log('❌ API request failed');
      return;
    }

    const data = await response.json();
    console.log('✅ API response received');
    
    // Check data structure
    console.log('\n📊 Data structure analysis:');
    console.log('Raw response keys:', Object.keys(data));
    
    const reels = data?.data?.items || data?.data?.reels || data?.reels || [];
    console.log(`Found ${reels.length} reels`);
    
    if (reels.length === 0) {
      console.log('❌ No reels found in database');
      console.log('💡 Try running: npm run db:sample-reels');
      return;
    }

    // Analyze first reel
    const firstReel = reels[0];
    console.log('\n🎬 First reel analysis:');
    console.log('Reel keys:', Object.keys(firstReel));
    console.log('ID:', firstReel.id);
    console.log('Title:', firstReel.title);
    console.log('Video URL:', firstReel.videoUrl);
    console.log('Thumbnail URL:', firstReel.thumbnailUrl);
    console.log('Celebrity:', firstReel.celebrity?.name || 'No celebrity data');

    // Test video URL accessibility
    if (firstReel.videoUrl) {
      console.log('\n🎥 Testing video URL accessibility...');
      try {
        const videoResponse = await fetch(firstReel.videoUrl, { method: 'HEAD' });
        console.log(`Video URL status: ${videoResponse.status} ${videoResponse.statusText}`);
        
        if (videoResponse.ok) {
          console.log('✅ Video URL is accessible');
          console.log('Content-Type:', videoResponse.headers.get('content-type'));
          console.log('Content-Length:', videoResponse.headers.get('content-length'));
        } else {
          console.log('❌ Video URL is not accessible');
          console.log('This could be why videos aren\'t showing');
        }
      } catch (error) {
        console.log('❌ Failed to test video URL:', error);
      }
    } else {
      console.log('❌ No video URL found in reel data');
    }

    // Check for common issues
    console.log('\n🔧 Common issues check:');
    
    // Check if using old CloudFront domain
    if (firstReel.videoUrl?.includes('d2vakxa9lbd2lr.cloudfront.net')) {
      console.log('⚠️  Using old CloudFront domain (this was causing 403 errors)');
      console.log('💡 Videos may need to be regenerated with new CloudFront domain');
    } else if (firstReel.videoUrl?.includes('d2mrk9810fr0rz.cloudfront.net')) {
      console.log('✅ Using new CloudFront domain');
    } else if (firstReel.videoUrl?.includes('s3.amazonaws.com')) {
      console.log('ℹ️  Using direct S3 URLs');
    }

    // Check required fields
    const requiredFields = ['id', 'title', 'videoUrl', 'celebrity'];
    const missingFields = requiredFields.filter(field => !firstReel[field]);
    
    if (missingFields.length > 0) {
      console.log('❌ Missing required fields:', missingFields);
    } else {
      console.log('✅ All required fields present');
    }

    console.log('\n📋 Summary:');
    console.log(`• API Status: ${response.ok ? '✅ Working' : '❌ Failed'}`);
    console.log(`• Reels Count: ${reels.length}`);
    console.log(`• Video URL: ${firstReel.videoUrl ? '✅ Present' : '❌ Missing'}`);
    console.log(`• Video Accessible: ${firstReel.videoUrl ? 'Testing above' : '❌ No URL to test'}`);

    console.log('\n🔗 Next steps:');
    if (reels.length === 0) {
      console.log('1. Create sample reels: npm run db:sample-reels');
    } else if (!firstReel.videoUrl) {
      console.log('1. Check database schema and ensure videoUrl field is populated');
    } else if (firstReel.videoUrl.includes('d2vakxa9lbd2lr.cloudfront.net')) {
      console.log('1. Generate new videos with updated CloudFront domain');
      console.log('2. Or update existing video URLs in database');
    } else {
      console.log('1. Check browser console for JavaScript errors');
      console.log('2. Verify video player component is rendering correctly');
      console.log('3. Check if videos are being blocked by browser policies');
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

async function main() {
  await debugVideoDisplay();
}

if (require.main === module) {
  main();
}

export { debugVideoDisplay };
