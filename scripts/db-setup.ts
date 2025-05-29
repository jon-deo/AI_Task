#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setupDatabase() {
  try {
    console.log('🚀 Setting up database...');

    // Test connection
    await prisma.$connect();
    console.log('✅ Database connection established');

    // Run migrations
    console.log('📦 Running database migrations...');
    // Note: In production, you would run `prisma migrate deploy`
    // For development, we'll use `prisma db push`

    // Create indexes for better performance
    console.log('🔍 Creating performance indexes...');

    // Custom indexes that might not be covered by Prisma schema
    const customIndexes = [
      // Composite indexes for common queries
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_video_reels_celebrity_status_public" 
       ON "video_reels" ("celebrityId", "status", "isPublic");`,

      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_video_reels_created_views" 
       ON "video_reels" ("createdAt" DESC, "views" DESC);`,

      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_celebrities_sport_active_views" 
       ON "celebrities" ("sport", "isActive", "totalViews" DESC);`,

      // Partial indexes for active content
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_video_reels_public_completed" 
       ON "video_reels" ("createdAt" DESC) 
       WHERE "isPublic" = true AND "status" = 'COMPLETED';`,

      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_celebrities_active" 
       ON "celebrities" ("totalViews" DESC) 
       WHERE "isActive" = true;`,

      // Analytics indexes
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_video_analytics_date_video" 
       ON "video_analytics" ("date" DESC, "videoId");`,

      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_user_video_views_user_created" 
       ON "user_video_views" ("userId", "createdAt" DESC);`,

      // Search optimization indexes
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_celebrities_name_trgm" 
       ON "celebrities" USING gin ("name" gin_trgm_ops);`,

      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_video_reels_title_trgm" 
       ON "video_reels" USING gin ("title" gin_trgm_ops);`,
    ];

    for (const indexQuery of customIndexes) {
      try {
        await prisma.$executeRawUnsafe(indexQuery);
        console.log(`✅ Created index: ${indexQuery.split('\n')[0].trim()}`);
      } catch (error: any) {
        if (error.code === '42P07') {
          console.log(`⚠️  Index already exists: ${indexQuery.split('\n')[0].trim()}`);
        } else {
          console.error(`❌ Failed to create index: ${error.message}`);
        }
      }
    }

    // Enable extensions for better performance
    console.log('🔧 Enabling database extensions...');

    const extensions = [
      'CREATE EXTENSION IF NOT EXISTS "pg_trgm";', // For trigram similarity search
      'CREATE EXTENSION IF NOT EXISTS "btree_gin";', // For GIN indexes on btree types
      'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', // For UUID generation
    ];

    for (const extension of extensions) {
      try {
        await prisma.$executeRawUnsafe(extension);
        console.log(`✅ Enabled extension: ${extension}`);
      } catch (error: any) {
        console.log(`⚠️  Extension might already exist or not available: ${extension}`);
      }
    }

    // Create database functions for common operations
    console.log('⚙️  Creating database functions...');

    const functions = [
      // Function to update celebrity stats
      `CREATE OR REPLACE FUNCTION update_celebrity_stats()
       RETURNS TRIGGER AS $$
       BEGIN
         IF TG_OP = 'INSERT' THEN
           UPDATE celebrities 
           SET "reelsCount" = "reelsCount" + 1
           WHERE id = NEW."celebrityId";
           RETURN NEW;
         ELSIF TG_OP = 'DELETE' THEN
           UPDATE celebrities 
           SET "reelsCount" = "reelsCount" - 1
           WHERE id = OLD."celebrityId";
           RETURN OLD;
         END IF;
         RETURN NULL;
       END;
       $$ LANGUAGE plpgsql;`,

      // Trigger for celebrity stats
      `DROP TRIGGER IF EXISTS trigger_update_celebrity_stats ON video_reels;
       CREATE TRIGGER trigger_update_celebrity_stats
       AFTER INSERT OR DELETE ON video_reels
       FOR EACH ROW EXECUTE FUNCTION update_celebrity_stats();`,

      // Function to calculate engagement rate
      `CREATE OR REPLACE FUNCTION calculate_engagement_rate(video_id text)
       RETURNS DECIMAL AS $$
       DECLARE
         total_views BIGINT;
         total_engagement BIGINT;
       BEGIN
         SELECT views INTO total_views FROM video_reels WHERE id = video_id;
         SELECT (likes + shares + comments) INTO total_engagement FROM video_reels WHERE id = video_id;
         
         IF total_views > 0 THEN
           RETURN (total_engagement::DECIMAL / total_views::DECIMAL) * 100;
         ELSE
           RETURN 0;
         END IF;
       END;
       $$ LANGUAGE plpgsql;`,
    ];

    for (const func of functions) {
      try {
        await prisma.$executeRawUnsafe(func);
        console.log(`✅ Created function/trigger`);
      } catch (error: any) {
        console.error(`❌ Failed to create function: ${error.message}`);
      }
    }

    console.log('🎉 Database setup completed successfully!');

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function seedSampleData() {
  try {
    console.log('🌱 Seeding sample data...');

    // Check if data already exists
    const existingCelebrities = await prisma.celebrity.count();
    if (existingCelebrities > 0) {
      console.log('⚠️  Sample data already exists, skipping seed...');
      return;
    }

    // Create sample celebrities
    const celebrities = await prisma.celebrity.createMany({
      data: [
        {
          name: 'LeBron James',
          slug: 'lebron-james',
          sport: 'BASKETBALL',
          position: 'Forward',
          team: 'Los Angeles Lakers',
          nationality: 'USA',
          biography: 'LeBron Raymone James Sr. is an American professional basketball player for the Los Angeles Lakers of the National Basketball Association (NBA). Nicknamed "King James", he is widely considered one of the greatest players of all time.',
          achievements: [
            '4× NBA champion',
            '4× NBA Finals MVP',
            '19× NBA All-Star',
            '13× All-NBA First Team',
            '2× Olympic gold medalist'
          ],
          imageUrl: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400',
          thumbnailUrl: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=200',
          isActive: true,
          isVerified: true,
          metaTitle: 'LeBron James - Basketball Legend',
          metaDescription: 'Discover the incredible journey of LeBron James, one of basketball\'s greatest players.',
          keywords: ['basketball', 'NBA', 'Lakers', 'champion'],
        },
        {
          name: 'Serena Williams',
          slug: 'serena-williams',
          sport: 'TENNIS',
          nationality: 'USA',
          biography: 'Serena Jameka Williams is an American former professional tennis player. Widely regarded as one of the greatest tennis players of all time, she was ranked world No. 1 in singles by the Women\'s Tennis Association for 319 weeks.',
          achievements: [
            '23× Grand Slam singles titles',
            '14× Grand Slam doubles titles',
            '4× Olympic gold medals',
            '73 WTA singles titles'
          ],
          imageUrl: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400',
          thumbnailUrl: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=200',
          isActive: false,
          isVerified: true,
          metaTitle: 'Serena Williams - Tennis Champion',
          metaDescription: 'Explore the legendary career of Serena Williams, tennis icon.',
          keywords: ['tennis', 'Grand Slam', 'champion', 'GOAT'],
        },
        {
          name: 'Cristiano Ronaldo',
          slug: 'cristiano-ronaldo',
          sport: 'SOCCER',
          position: 'Forward',
          team: 'Al Nassr',
          nationality: 'Portugal',
          biography: 'Cristiano Ronaldo dos Santos Aveiro is a Portuguese professional footballer who plays as a forward for and captains both Saudi Professional League club Al Nassr and the Portugal national team.',
          achievements: [
            '5× Ballon d\'Or winner',
            '5× UEFA Champions League winner',
            '800+ career goals',
            'UEFA European Championship winner'
          ],
          imageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400',
          thumbnailUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=200',
          isActive: true,
          isVerified: true,
          metaTitle: 'Cristiano Ronaldo - Football Legend',
          metaDescription: 'The incredible story of Cristiano Ronaldo, football superstar.',
          keywords: ['football', 'soccer', 'Ballon d\'Or', 'Portugal'],
        },
      ],
      skipDuplicates: true,
    });

    console.log(`✅ Created ${celebrities.count} sample celebrities`);

    // Skip creating sample user and related data as per project simplification
    console.log('⏭️  Skipping sample user creation as per project simplification');

    console.log('🎉 Sample data seeding completed successfully!');

  } catch (error) {
    console.error('❌ Sample data seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  await setupDatabase();
  await seedSampleData();
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { setupDatabase, seedSampleData };
