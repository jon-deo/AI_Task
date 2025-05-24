import { NextRequest } from 'next/server';

// Rate limiting configuration
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (request: NextRequest) => string;
  onLimitReached?: (request: NextRequest) => void;
}

// Rate limit store interface
export interface RateLimitStore {
  get(key: string): Promise<{ count: number; resetTime: number } | null>;
  set(key: string, value: { count: number; resetTime: number }, ttl: number): Promise<void>;
  increment(key: string, ttl: number): Promise<{ count: number; resetTime: number }>;
}

// In-memory rate limit store (for development)
class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, { count: number; resetTime: number }>();

  async get(key: string): Promise<{ count: number; resetTime: number } | null> {
    const data = this.store.get(key);
    if (!data) return null;
    
    // Clean up expired entries
    if (Date.now() > data.resetTime) {
      this.store.delete(key);
      return null;
    }
    
    return data;
  }

  async set(key: string, value: { count: number; resetTime: number }, ttl: number): Promise<void> {
    this.store.set(key, value);
    
    // Auto cleanup after TTL
    setTimeout(() => {
      this.store.delete(key);
    }, ttl);
  }

  async increment(key: string, ttl: number): Promise<{ count: number; resetTime: number }> {
    const now = Date.now();
    const existing = await this.get(key);
    
    if (!existing) {
      const newData = { count: 1, resetTime: now + ttl };
      await this.set(key, newData, ttl);
      return newData;
    }
    
    const updatedData = { ...existing, count: existing.count + 1 };
    await this.set(key, updatedData, existing.resetTime - now);
    return updatedData;
  }
}

// Redis rate limit store (for production)
class RedisRateLimitStore implements RateLimitStore {
  constructor(private redisClient: any) {}

  async get(key: string): Promise<{ count: number; resetTime: number } | null> {
    try {
      const data = await this.redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  async set(key: string, value: { count: number; resetTime: number }, ttl: number): Promise<void> {
    try {
      await this.redisClient.setex(key, Math.ceil(ttl / 1000), JSON.stringify(value));
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  async increment(key: string, ttl: number): Promise<{ count: number; resetTime: number }> {
    const now = Date.now();
    const resetTime = now + ttl;
    
    try {
      const multi = this.redisClient.multi();
      multi.incr(key);
      multi.expire(key, Math.ceil(ttl / 1000));
      const results = await multi.exec();
      
      const count = results[0][1];
      return { count, resetTime };
    } catch (error) {
      console.error('Redis increment error:', error);
      // Fallback to memory store
      return this.fallbackIncrement(key, ttl);
    }
  }

  private async fallbackIncrement(key: string, ttl: number): Promise<{ count: number; resetTime: number }> {
    const memoryStore = new MemoryRateLimitStore();
    return memoryStore.increment(key, ttl);
  }
}

// Rate limiter class
export class RateLimiter {
  private store: RateLimitStore;

  constructor(store?: RateLimitStore) {
    this.store = store || new MemoryRateLimitStore();
  }

  async checkLimit(request: NextRequest, config: RateLimitConfig): Promise<{
    allowed: boolean;
    limit: number;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
  }> {
    const key = config.keyGenerator ? config.keyGenerator(request) : this.getDefaultKey(request);
    const { count, resetTime } = await this.store.increment(key, config.windowMs);

    const allowed = count <= config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - count);

    if (!allowed && config.onLimitReached) {
      config.onLimitReached(request);
    }

    return {
      allowed,
      limit: config.maxRequests,
      remaining,
      resetTime,
      retryAfter: allowed ? undefined : Math.ceil((resetTime - Date.now()) / 1000),
    };
  }

  private getDefaultKey(request: NextRequest): string {
    // Use IP address as default key
    const ip = request.ip || 
               request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 
               'unknown';
    return `rate_limit:${ip}`;
  }
}

// Predefined rate limit configurations
export const RATE_LIMITS = {
  // General API access
  GENERAL: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000,
    skipSuccessfulRequests: false,
  },

  // Authentication endpoints
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    skipSuccessfulRequests: false,
  },

  // Video upload endpoints
  UPLOAD: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
    skipSuccessfulRequests: true,
  },

  // Video generation endpoints
  GENERATION: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5,
    skipSuccessfulRequests: true,
  },

  // Search endpoints
  SEARCH: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
    skipSuccessfulRequests: true,
  },

  // Public content serving
  PUBLIC: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 300,
    skipSuccessfulRequests: true,
  },

  // Admin endpoints
  ADMIN: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    skipSuccessfulRequests: true,
  },
} as const;

// Rate limiting middleware
export function createRateLimitMiddleware(config: RateLimitConfig) {
  const rateLimiter = new RateLimiter();

  return async (request: NextRequest) => {
    const result = await rateLimiter.checkLimit(request, config);

    return {
      allowed: result.allowed,
      headers: {
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
        ...(result.retryAfter && { 'Retry-After': result.retryAfter.toString() }),
      },
      retryAfter: result.retryAfter,
    };
  };
}

// User-based rate limiting
export function createUserRateLimit(userId: string): (request: NextRequest) => string {
  return () => `rate_limit:user:${userId}`;
}

// IP-based rate limiting with user fallback
export function createIPUserRateLimit(request: NextRequest): string {
  const userId = request.headers.get('x-user-id');
  const ip = request.ip || 
             request.headers.get('x-forwarded-for')?.split(',')[0] || 
             request.headers.get('x-real-ip') || 
             'unknown';
  
  return userId ? `rate_limit:user:${userId}` : `rate_limit:ip:${ip}`;
}

// Endpoint-specific rate limiting
export function createEndpointRateLimit(endpoint: string): (request: NextRequest) => string {
  return (request: NextRequest) => {
    const baseKey = createIPUserRateLimit(request);
    return `${baseKey}:${endpoint}`;
  };
}

// Global rate limiter instance
export const globalRateLimiter = new RateLimiter();

// Rate limit response helper
export function createRateLimitResponse(retryAfter: number) {
  return new Response(
    JSON.stringify({
      success: false,
      error: 'Rate limit exceeded',
      message: `Too many requests. Please try again in ${retryAfter} seconds.`,
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
      },
    }
  );
}
