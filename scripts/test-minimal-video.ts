#!/usr/bin/env tsx

/**
 * Minimal test to create a real MP4 video using just the old simple logic
 * but with a real video file instead of placeholder
 */

import { generateVideo } from '../src/lib/ai/generate';
import { prisma } from '../src/lib/db/prisma';

async function testMinimalVideo() {
  console.log('🎬 Testing Minimal Real Video Generation');
  console.log('=======================================\n');

  try {
    const celebrityName = 'Michael Jordan';
    
    console.log(`1. Generating script and audio for ${celebrityName}...`);
    
    // Use the existing simple generation (script + audio)
    const { script, audioUrl } = await generateVideo(celebrityName);
    
    console.log('✅ Script and audio generated successfully');
    console.log('📝 Script:', script.substring(0, 100) + '...');
    console.log('🎵 Audio URL:', audioUrl);

    // Create video record in database with the audio URL
    // This time we'll mark it as a real video (even though it's just audio for now)
    const video = await prisma.video.create({
      data: {
        title: `${celebrityName}'s Career Highlights`,
        description: script,
        s3Url: audioUrl, // For now, this is the audio URL
        metadata: {
          celebrity: celebrityName,
          script,
          status: 'COMPLETED',
          type: 'audio-only', // Mark as audio-only for now
          generatedAt: new Date().toISOString(),
        },
      },
    });

    console.log('\n✅ Video record created in database:');
    console.log('🆔 ID:', video.id);
    console.log('📺 S3 URL:', video.s3Url);
    console.log('📊 Metadata:', JSON.stringify(video.metadata, null, 2));

    console.log('\n🎉 Minimal test completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. This proves the basic workflow works');
    console.log('2. Now we need to add real video composition');
    console.log('3. The audio is already in S3 and ready to use');

    return video;
    
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

testMinimalVideo();
