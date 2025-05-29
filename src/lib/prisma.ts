import { PrismaClient } from '@prisma/client';

import { config } from '@/config';

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: config.nodeEnv === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: config.database.url,
    },
  },
});

if (config.nodeEnv === 'development') globalForPrisma.prisma = prisma;

// Database connection helper
export async function connectToDatabase() {
  try {
    await prisma.$connect();
    console.log('✅ Connected to database');
    return true;
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    return false;
  }
}

// Database disconnection helper
export async function disconnectFromDatabase() {
  try {
    await prisma.$disconnect();
    console.log('✅ Disconnected from database');
    return true;
  } catch (error) {
    console.error('❌ Failed to disconnect from database:', error);
    return false;
  }
}

// Health check for database
export async function checkDatabaseHealth() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { healthy: true, message: 'Database is healthy' };
  } catch (error) {
    return {
      healthy: false,
      message: `Database health check failed: ${error}`
    };
  }
}

// Database transaction helper
export async function withTransaction<T>(
  callback: (tx: PrismaTransactionClient) => Promise<T>
): Promise<T> {
  return await prisma.$transaction(callback);
}

// Soft delete helper
export async function softDelete(
  model: string,
  id: string,
  deletedField: string = 'isDeleted'
) {
  return await (prisma as any)[model].update({
    where: { id },
    data: { [deletedField]: true },
  });
}

// Bulk operations helper
export async function bulkUpsert<T>(
  model: string,
  data: T[],
  uniqueField: keyof T
) {
  const operations = data.map((item) =>
    (prisma as any)[model].upsert({
      where: { [uniqueField as string]: item[uniqueField] },
      update: item,
      create: item,
    })
  );

  return await Promise.all(operations);
}

// Search helper with full-text search
export async function searchContent(
  query: string,
  models: string[] = ['celebrity', 'videoReel']
) {
  const results = await Promise.all(
    models.map(async (model) => {
      try {
        return await (prisma as any)[model].findMany({
          where: {
            OR: [
              { name: { search: query } },
              { title: { search: query } },
              { description: { search: query } },
              { biography: { search: query } },
            ].filter(Boolean),
          },
          take: 10,
        });
      } catch (error) {
        console.warn(`Search failed for model ${model}:`, error);
        return [];
      }
    })
  );

  return results.flat();
}

// Performance monitoring
export async function logSlowQuery(
  query: string,
  duration: number,
  threshold: number = 1000
) {
  if (duration > threshold) {
    console.warn(`🐌 Slow query detected (${duration}ms):`, query);

    // In production, you might want to send this to a monitoring service
    if (config.nodeEnv === 'production') {
      // await sendToMonitoringService({ query, duration, timestamp: new Date() });
    }
  }
}

// Database seeding helper
export async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');

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
          biography: 'One of the greatest basketball players of all time...',
          achievements: ['4x NBA Champion', '4x NBA Finals MVP', '19x NBA All-Star'],
          imageUrl: 'https://example.com/lebron.jpg',
          isActive: true,
          isVerified: true,
        },
        {
          name: 'Serena Williams',
          slug: 'serena-williams',
          sport: 'TENNIS',
          nationality: 'USA',
          biography: 'Legendary tennis player with 23 Grand Slam singles titles...',
          achievements: ['23x Grand Slam Singles Champion', '4x Olympic Gold Medalist'],
          imageUrl: 'https://example.com/serena.jpg',
          isActive: false,
          isVerified: true,
        },
        {
          name: 'Cristiano Ronaldo',
          slug: 'cristiano-ronaldo',
          sport: 'SOCCER',
          position: 'Forward',
          team: 'Al Nassr',
          nationality: 'Portugal',
          biography: 'Portuguese professional footballer, one of the greatest of all time...',
          achievements: ['5x Ballon d\'Or', '5x Champions League Winner', '800+ Career Goals'],
          imageUrl: 'https://example.com/ronaldo.jpg',
          isActive: true,
          isVerified: true,
        },
      ],
      skipDuplicates: true,
    });

    console.log(`✅ Created ${celebrities.count} celebrities`);

    // Create sample users
    // const users = await prisma.user.createMany({
    //   data: [
    //     {
    //       email: 'demo@example.com',
    //       username: 'demo_user',
    //       displayName: 'Demo User',
    //       isActive: true,
    //     },
    //   ],
    //   skipDuplicates: true,
    // });

    // console.log(`✅ Created ${users.count} users`);
    console.log('🎉 Database seeding completed!');

    return true;
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    return false;
  }
}

// Export types for better TypeScript support
export type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export default prisma;
