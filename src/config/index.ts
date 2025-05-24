import { z } from 'zod';

// Environment variables schema
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // AWS Configuration
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_S3_BUCKET_NAME: z.string().min(1),
  AWS_CLOUDFRONT_DOMAIN: z.string().optional(),

  // OpenAI Configuration
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_ORGANIZATION_ID: z.string().optional(),

  // Next.js Configuration
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(1).optional(),

  // API Configuration
  API_BASE_URL: z.string().url().default('http://localhost:3000/api'),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100'),
  RATE_LIMIT_WINDOW_MS: z.string().default('900000'),

  // Video Processing
  MAX_VIDEO_DURATION_SECONDS: z.string().default('60'),
  VIDEO_QUALITY: z.string().default('720p'),
  VIDEO_BITRATE: z.string().default('1000k'),

  // Cache Configuration
  REDIS_URL: z.string().url().optional(),
  CACHE_TTL_SECONDS: z.string().default('3600'),

  // Monitoring
  VERCEL_ANALYTICS_ID: z.string().optional(),
  SENTRY_DSN: z.string().url().optional(),

  // Development
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  ANALYZE: z.string().default('false'),
});

// Parse and validate environment variables
const env = envSchema.parse(process.env);

// Application configuration
export const config = {
  // Environment
  env: env.NODE_ENV,
  isDev: env.NODE_ENV === 'development',
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',

  // Database
  database: {
    url: env.DATABASE_URL,
  },

  // AWS
  aws: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    region: env.AWS_REGION,
    s3: {
      bucketName: env.AWS_S3_BUCKET_NAME,
      cloudFrontDomain: env.AWS_CLOUDFRONT_DOMAIN,
    },
  },

  // OpenAI
  openai: {
    apiKey: env.OPENAI_API_KEY,
    organizationId: env.OPENAI_ORGANIZATION_ID,
  },

  // API
  api: {
    baseUrl: env.API_BASE_URL,
    rateLimit: {
      maxRequests: parseInt(env.RATE_LIMIT_MAX_REQUESTS),
      windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS),
    },
  },

  // Video Processing
  video: {
    maxDurationSeconds: parseInt(env.MAX_VIDEO_DURATION_SECONDS),
    quality: env.VIDEO_QUALITY,
    bitrate: env.VIDEO_BITRATE,
    allowedFormats: ['mp4', 'webm', 'mov'],
    maxFileSizeMB: 100,
  },

  // Cache
  cache: {
    redisUrl: env.REDIS_URL,
    ttlSeconds: parseInt(env.CACHE_TTL_SECONDS),
  },

  // Monitoring
  monitoring: {
    vercelAnalyticsId: env.VERCEL_ANALYTICS_ID,
    sentryDsn: env.SENTRY_DSN,
  },

  // Pagination
  pagination: {
    defaultLimit: 10,
    maxLimit: 50,
  },

  // AI Generation
  ai: {
    maxRetries: 3,
    timeoutMs: 30000,
    models: {
      textGeneration: 'gpt-4-turbo-preview',
      voiceGeneration: 'polly',
    },
  },

  // Security
  security: {
    corsOrigins: env.isDev 
      ? ['http://localhost:3000', 'http://localhost:3001']
      : ['https://your-domain.com'],
    rateLimitBypassTokens: env.isDev ? ['dev-bypass-token'] : [],
  },

  // Features
  features: {
    enableAnalytics: env.isProd,
    enableErrorReporting: env.isProd,
    enableVideoPreloading: true,
    enableInfiniteScroll: true,
    enableOfflineMode: false,
  },
} as const;

// Type-safe configuration access
export type Config = typeof config;

// Validation helpers
export const validateConfig = () => {
  try {
    envSchema.parse(process.env);
    return { valid: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
      };
    }
    return { valid: false, errors: ['Unknown configuration error'] };
  }
};

// Export individual config sections for convenience
export const {
  env: environment,
  database,
  aws,
  openai,
  api,
  video,
  cache,
  monitoring,
  pagination,
  ai,
  security,
  features,
} = config;
