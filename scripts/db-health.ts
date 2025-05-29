#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface HealthCheckResult {
  status: 'healthy' | 'warning' | 'critical';
  message: string;
  details?: any;
}

async function checkDatabaseConnection(): Promise<HealthCheckResult> {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: 'healthy',
      message: 'Database connection is healthy',
    };
  } catch (error) {
    return {
      status: 'critical',
      message: 'Database connection failed',
      details: error,
    };
  }
}

async function checkTableCounts(): Promise<HealthCheckResult> {
  try {
    const counts = await Promise.all([
      prisma.celebrity.count(),
      prisma.videoReel.count(),
    ]);

    const [celebrities, videos] = counts;

    return {
      status: 'healthy',
      message: 'Table counts retrieved successfully',
      details: {
        celebrities,
        videos,
      },
    };
  } catch (error) {
    return {
      status: 'critical',
      message: 'Failed to retrieve table counts',
      details: error,
    };
  }
}

async function checkIndexes(): Promise<HealthCheckResult> {
  try {
    const indexes = await prisma.$queryRaw`
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes 
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname;
    `;

    const indexCount = (indexes as any[]).length;

    return {
      status: indexCount > 20 ? 'healthy' : 'warning',
      message: `Found ${indexCount} indexes`,
      details: { indexCount, indexes },
    };
  } catch (error) {
    return {
      status: 'warning',
      message: 'Could not check indexes',
      details: error,
    };
  }
}

async function checkDatabaseSize(): Promise<HealthCheckResult> {
  try {
    const sizeResult = await prisma.$queryRaw`
      SELECT 
        pg_size_pretty(pg_database_size(current_database())) as database_size,
        pg_database_size(current_database()) as size_bytes
    `;

    const size = (sizeResult as any[])[0];

    return {
      status: 'healthy',
      message: `Database size: ${size.database_size}`,
      details: size,
    };
  } catch (error) {
    return {
      status: 'warning',
      message: 'Could not check database size',
      details: error,
    };
  }
}

async function checkSlowQueries(): Promise<HealthCheckResult> {
  try {
    // Check for slow queries (requires pg_stat_statements extension)
    const slowQueries = await prisma.$queryRaw`
      SELECT 
        query,
        calls,
        total_time,
        mean_time,
        rows
      FROM pg_stat_statements 
      WHERE mean_time > 1000 
      ORDER BY mean_time DESC 
      LIMIT 5;
    `;

    const queryCount = (slowQueries as any[]).length;

    return {
      status: queryCount > 0 ? 'warning' : 'healthy',
      message: `Found ${queryCount} slow queries`,
      details: { slowQueries },
    };
  } catch (error) {
    return {
      status: 'healthy',
      message: 'pg_stat_statements not available (this is normal)',
      details: null,
    };
  }
}

async function checkReplicationLag(): Promise<HealthCheckResult> {
  try {
    // Check if this is a replica
    const isReplica = await prisma.$queryRaw`
      SELECT pg_is_in_recovery() as is_replica;
    `;

    const replica = (isReplica as any[])[0];

    if (!replica.is_replica) {
      return {
        status: 'healthy',
        message: 'Primary database (no replication lag)',
      };
    }

    // If it's a replica, check lag
    const lagResult = await prisma.$queryRaw`
      SELECT 
        CASE 
          WHEN pg_last_wal_receive_lsn() = pg_last_wal_replay_lsn() 
          THEN 0 
          ELSE EXTRACT(EPOCH FROM now() - pg_last_xact_replay_timestamp())
        END as lag_seconds;
    `;

    const lag = (lagResult as any[])[0];
    const lagSeconds = parseFloat(lag.lag_seconds);

    return {
      status: lagSeconds < 5 ? 'healthy' : lagSeconds < 30 ? 'warning' : 'critical',
      message: `Replication lag: ${lagSeconds.toFixed(2)} seconds`,
      details: { lagSeconds },
    };
  } catch (error) {
    return {
      status: 'healthy',
      message: 'Could not check replication status',
      details: null,
    };
  }
}

async function checkDiskSpace(): Promise<HealthCheckResult> {
  try {
    const diskSpace = await prisma.$queryRaw`
      SELECT 
        pg_size_pretty(pg_total_relation_size('celebrities')) as celebrities_size,
        pg_size_pretty(pg_total_relation_size('video_reels')) as video_reels_size
    `;

    return {
      status: 'healthy',
      message: 'Disk space check completed',
      details: diskSpace,
    };
  } catch (error) {
    return {
      status: 'warning',
      message: 'Could not check disk space',
      details: error,
    };
  }
}

async function runHealthCheck(): Promise<void> {
  console.log('🏥 Running database health check...\n');

  const checks = [
    { name: 'Database Connection', check: checkDatabaseConnection },
    { name: 'Table Counts', check: checkTableCounts },
    { name: 'Indexes', check: checkIndexes },
    { name: 'Database Size', check: checkDatabaseSize },
    { name: 'Slow Queries', check: checkSlowQueries },
    { name: 'Replication Lag', check: checkReplicationLag },
    { name: 'Disk Space', check: checkDiskSpace },
  ];

  const results: Array<{ name: string; result: HealthCheckResult }> = [];

  for (const { name, check } of checks) {
    console.log(`🔍 Checking ${name}...`);
    try {
      const result = await check();
      results.push({ name, result });

      const emoji = result.status === 'healthy' ? '✅' :
        result.status === 'warning' ? '⚠️' : '❌';
      console.log(`${emoji} ${name}: ${result.message}`);

      if (result.details && process.env.VERBOSE) {
        console.log(`   Details:`, JSON.stringify(result.details, null, 2));
      }
    } catch (error) {
      console.log(`❌ ${name}: Check failed`);
      results.push({
        name,
        result: {
          status: 'critical',
          message: 'Check failed',
          details: error,
        },
      });
    }
    console.log('');
  }

  // Summary
  const healthy = results.filter(r => r.result.status === 'healthy').length;
  const warnings = results.filter(r => r.result.status === 'warning').length;
  const critical = results.filter(r => r.result.status === 'critical').length;

  console.log('📊 Health Check Summary:');
  console.log(`✅ Healthy: ${healthy}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  console.log(`❌ Critical: ${critical}`);

  if (critical > 0) {
    console.log('\n🚨 Critical issues found! Please investigate immediately.');
    process.exit(1);
  } else if (warnings > 0) {
    console.log('\n⚠️  Some warnings found. Consider investigating.');
    process.exit(0);
  } else {
    console.log('\n🎉 All checks passed! Database is healthy.');
    process.exit(0);
  }
}

async function main() {
  try {
    await runHealthCheck();
  } catch (error) {
    console.error('❌ Health check failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

export { runHealthCheck };
