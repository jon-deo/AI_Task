#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateVideoUrls() {
  console.log('🔄 Updating video URLs to use new CloudFront domain...');

  try {
    const oldDomain = 'd2vakxa9lbd2lr.cloudfront.net';
    const newDomain = 'd2mrk9810fr0rz.cloudfront.net';

    // Find all reels with old CloudFront domain
    const reelsToUpdate = await prisma.videoReel.findMany({
      where: {
        OR: [
          { videoUrl: { contains: oldDomain } },
          { thumbnailUrl: { contains: oldDomain } }
        ]
      },
      include: {
        celebrity: true
      }
    });

    console.log(`📊 Found ${reelsToUpdate.length} reels to update`);

    if (reelsToUpdate.length === 0) {
      console.log('✅ No reels need updating');
      
      // Show current reels
      const allReels = await prisma.videoReel.findMany({
        include: { celebrity: true },
        take: 5
      });
      
      console.log('\n📋 Current reels:');
      allReels.forEach((reel, index) => {
        console.log(`${index + 1}. ${reel.title}`);
        console.log(`   Celebrity: ${reel.celebrity.name}`);
        console.log(`   Video URL: ${reel.videoUrl}`);
        console.log(`   Public: ${reel.isPublic}`);
        console.log('');
      });
      
      return;
    }

    // Update each reel
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

      console.log(`✅ Updated: ${reel.title}`);
      console.log(`   Old: ${reel.videoUrl}`);
      console.log(`   New: ${newVideoUrl}`);
      console.log('');
    }

    console.log(`🎉 Successfully updated ${reelsToUpdate.length} reels!`);

    // Show updated reels
    const updatedReels = await prisma.videoReel.findMany({
      include: { celebrity: true },
      take: 3
    });

    console.log('\n📋 Sample updated reels:');
    updatedReels.forEach((reel, index) => {
      console.log(`${index + 1}. ${reel.title}`);
      console.log(`   Celebrity: ${reel.celebrity.name}`);
      console.log(`   Video URL: ${reel.videoUrl}`);
      console.log(`   Public: ${reel.isPublic}`);
      console.log('');
    });

    console.log('🔗 Next steps:');
    console.log('1. Refresh your browser at http://localhost:3000');
    console.log('2. Videos should now load with the new CloudFront domain');
    console.log('3. Check browser console for any remaining errors');

  } catch (error) {
    console.error('❌ Failed to update video URLs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  await updateVideoUrls();
}

if (require.main === module) {
  main();
}

export { updateVideoUrls };
