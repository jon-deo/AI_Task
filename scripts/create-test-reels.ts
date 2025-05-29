#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import { VideoStatus } from '@/types';

const prisma = new PrismaClient();

async function createTestReels() {
  console.log('🎬 Creating test reels for video display...');

  try {
    // First, check if we have any celebrities
    let celebrities = await prisma.celebrity.findMany();

    if (celebrities.length === 0) {
      console.log('📝 Creating test celebrities...');

      // Create some test celebrities
      const testCelebrities = [
        {
          name: 'Michael Jordan',
          sport: 'Basketball',
          nationality: 'American',
          imageUrl: 'https://d2mrk9810fr0rz.cloudfront.net/images/jordan.jpg',
          slug: 'michael-jordan',
          isVerified: true,
          biography: 'An iconic basketball player.',
        },
        {
          name: 'Lionel Messi',
          sport: 'Football',
          nationality: 'Argentinian',
          imageUrl: 'https://d2mrk9810fr0rz.cloudfront.net/images/messi.jpg',
          slug: 'lionel-messi',
          isVerified: true,
          biography: 'A legendary football player.',
        },
        {
          name: 'Serena Williams',
          sport: 'Tennis',
          nationality: 'American',
          imageUrl: 'https://d2mrk9810fr0rz.cloudfront.net/images/serena.jpg',
          slug: 'serena-williams',
          isVerified: true,
          biography: 'A dominant force in tennis.',
        },
      ];

      for (const celebrity of testCelebrities) {
        await prisma.celebrity.create({ data: celebrity as any });
      }

      celebrities = await prisma.celebrity.findMany();
      console.log(`✅ Created ${celebrities.length} test celebrities`);
    }

    // Check if we already have reels
    const existingReels = await prisma.videoReel.count();
    console.log(`📊 Found ${existingReels} existing reels`);

    if (existingReels > 0) {
      console.log('🔄 Updating existing reels with new CloudFront domain...');

      // Update existing reels to use new CloudFront domain
      const oldDomain = 'd2vakxa9lbd2lr.cloudfront.net';
      const newDomain = 'd2mrk9810fr0rz.cloudfront.net';

      const reelsToUpdate = await prisma.videoReel.findMany({
        where: {
          videoUrl: {
            contains: oldDomain
          }
        }
      });

      console.log(`🔧 Updating ${reelsToUpdate.length} reels with old CloudFront domain...`);

      for (const reel of reelsToUpdate) {
        const newVideoUrl = reel.videoUrl.replace(oldDomain, newDomain);
        const newThumbnailUrl = reel.thumbnailUrl?.replace(oldDomain, newDomain);

        await prisma.videoReel.update({
          where: { id: reel.id },
          data: {
            videoUrl: newVideoUrl,
            thumbnailUrl: newThumbnailUrl,
          }
        });
      }

      console.log('✅ Updated existing reels with new CloudFront domain');
    }

    // Create some test reels with working video URLs
    console.log('🎥 Creating test reels with sample video URLs...');

    const testReels = [
      {
        title: "Jordan's Greatest Moments",
        description: "Relive the legendary basketball moments of Michael Jordan",
        celebrityId: celebrities.find(c => c.name.includes('Jordan'))?.id || celebrities[0].id,
        videoUrl: 'https://d2mrk9810fr0rz.cloudfront.net/videos/sample-basketball.mp4',
        thumbnailUrl: 'https://d2mrk9810fr0rz.cloudfront.net/thumbnails/sample-basketball.jpg',
        duration: 45,
        script: 'Michael Jordan dominated basketball with his incredible skills...',
        slug: 'jordan-greatest-moments',
        isPublic: true,
        isFeatured: true,
        views: BigInt(1500),
        likes: BigInt(89),
        shares: BigInt(23),
        comments: BigInt(12),
        fileSize: BigInt(15000000),
        resolution: '1080p',
        bitrate: '2000',
        format: 'mp4',
        status: VideoStatus.COMPLETED,
        s3Key: 'videos/sample-basketball.mp4',
        s3Bucket: 'essentially-sports-task',
        tags: ['basketball', 'legend', 'nba'],
      },
      {
        title: "Messi's Magic on the Field",
        description: "Watch Lionel Messi's most incredible football moments",
        celebrityId: celebrities.find(c => c.name.includes('Messi'))?.id || celebrities[0].id,
        videoUrl: 'https://d2mrk9810fr0rz.cloudfront.net/videos/sample-football.mp4',
        thumbnailUrl: 'https://d2mrk9810fr0rz.cloudfront.net/thumbnails/sample-football.jpg',
        duration: 38,
        script: 'Lionel Messi has redefined football with his extraordinary talent...',
        slug: 'messi-magic-field',
        isPublic: true,
        isFeatured: false,
        views: BigInt(2100),
        likes: BigInt(156),
        shares: BigInt(45),
        comments: BigInt(28),
        fileSize: BigInt(18000000),
        resolution: '1080p',
        bitrate: '2000',
        format: 'mp4',
        status: VideoStatus.COMPLETED,
        s3Key: 'videos/sample-football.mp4',
        s3Bucket: 'essentially-sports-task',
        tags: ['football', 'soccer', 'goat'],
      },
      {
        title: "Serena's Tennis Dominance",
        description: "The unstoppable force of Serena Williams in tennis",
        celebrityId: celebrities.find(c => c.name.includes('Serena'))?.id || celebrities[0].id,
        videoUrl: 'https://d2mrk9810fr0rz.cloudfront.net/videos/sample-tennis.mp4',
        thumbnailUrl: 'https://d2mrk9810fr0rz.cloudfront.net/thumbnails/sample-tennis.jpg',
        duration: 42,
        script: 'Serena Williams has dominated tennis courts worldwide...',
        slug: 'serena-tennis-dominance',
        isPublic: true,
        isFeatured: true,
        views: BigInt(980),
        likes: BigInt(67),
        shares: BigInt(18),
        comments: BigInt(9),
        fileSize: BigInt(16500000),
        resolution: '1080p',
        bitrate: '2000',
        format: 'mp4',
        status: VideoStatus.COMPLETED,
        s3Key: 'videos/sample-tennis.mp4',
        s3Bucket: 'essentially-sports-task',
        tags: ['tennis', 'champion', 'wimbledon'],
      },
    ];

    // Create reels only if we don't have enough
    const currentReelCount = await prisma.videoReel.count();
    if (currentReelCount < 3) {
      for (const reelData of testReels) {
        // Check if reel with this slug already exists
        const existingReel = await prisma.videoReel.findFirst({
          where: { slug: reelData.slug }
        });

        if (!existingReel) {
          await prisma.videoReel.create({ data: reelData as any });
          console.log(`✅ Created reel: ${reelData.title}`);
        } else {
          console.log(`⏭️  Skipped existing reel: ${reelData.title}`);
        }
      }
    }

    // Final count
    const finalReelCount = await prisma.videoReel.count();
    console.log(`\n🎉 Setup complete! Total reels: ${finalReelCount}`);

    // Show sample reel info
    const sampleReel = await prisma.videoReel.findFirst({
      include: {
        celebrity: true
      }
    });

    if (sampleReel) {
      console.log('\n📋 Sample reel info:');
      console.log(`• Title: ${sampleReel.title}`);
      console.log(`• Celebrity: ${sampleReel.celebrity.name}`);
      console.log(`• Video URL: ${sampleReel.videoUrl}`);
      console.log(`• Status: ${sampleReel.status}`);
      console.log(`• Public: ${sampleReel.isPublic}`);
    }

    console.log('\n🔗 Next steps:');
    console.log('1. Refresh your browser at http://localhost:3000');
    console.log('2. Videos should now appear (they may show loading state if URLs don\'t exist)');
    console.log('3. Generate real videos: npm run test:video');

  } catch (error) {
    console.error('❌ Failed to create test reels:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  await createTestReels();
}

if (require.main === module) {
  main();
}

export { createTestReels };
