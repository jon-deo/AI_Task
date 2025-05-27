#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkReels() {
  console.log('🔍 Checking reels in database...\n');

  try {
    const reels = await prisma.videoReel.findMany({
      include: {
        celebrity: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`📊 Found ${reels.length} reels total\n`);

    if (reels.length === 0) {
      console.log('❌ No reels found! Run: npm run create:test-reels');
      return;
    }

    reels.forEach((reel, index) => {
      console.log(`${index + 1}. ${reel.title}`);
      console.log(`   ID: ${reel.id}`);
      console.log(`   Celebrity: ${reel.celebrity.name}`);
      console.log(`   Status: ${reel.status}`);
      console.log(`   Public: ${reel.isPublic}`);
      console.log(`   Video URL: ${reel.videoUrl ? 'Present' : 'Missing'}`);
      if (reel.videoUrl) {
        console.log(`   URL: ${reel.videoUrl.slice(0, 60)}...`);
      }
      console.log(`   Created: ${reel.createdAt.toISOString()}`);
      console.log('');
    });

    console.log('🔗 Next steps:');
    console.log('1. Refresh browser at http://localhost:3000');
    console.log('2. Try scrolling down to see the second reel');
    console.log('3. Check browser console for scroll detection logs');
    console.log('4. Look for "Active: YES/NO" in debug info on each reel');

  } catch (error) {
    console.error('❌ Failed to check reels:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  await checkReels();
}

if (require.main === module) {
  main();
}

export { checkReels };
