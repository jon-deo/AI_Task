import { NextRequest, NextResponse } from 'next/server';

// Cache configuration interface
export interface CacheConfig {
  ttl: number; // Time to live in seconds
  staleWhileRevalidate?: number; // SWR time in seconds
  tags?: string[]; // Cache tags for invalidation
  vary?: string[]; // Headers to vary cache by
  private?: boolean; // Whether cache is private
}

// Cache store interface
export interface CacheStore {
  get(key: string): Promise<CacheEntry | null>;
  set(key: string, value: CacheEntry, ttl: number): Promise<void>;
  delete(key: string): Promise<void>;
  deleteByTag(tag: string): Promise<void>;
  clear(): Promise<void>;
}

// Cache entry interface
export interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  tags?: string[];
  etag?: string;
  headers?: Record<string, string>;
}

// In-memory cache store (for development)
class MemoryCacheStore implements CacheStore {
  private store = new Map<string, CacheEntry>();
  private tagIndex = new Map<string, Set<string>>();

  async get(key: string): Promise<CacheEntry | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() > entry.timestamp + entry.ttl * 1000) {
      this.store.delete(key);
      this.removeFromTagIndex(key, entry.tags);
      return null;
    }

    return entry;
  }

  async set(key: string, value: CacheEntry, ttl: number): Promise<void> {
    // Remove old entry from tag index
    const oldEntry = this.store.get(key);
    if (oldEntry) {
      this.removeFromTagIndex(key, oldEntry.tags);
    }

    // Set new entry
    this.store.set(key, { ...value, ttl, timestamp: Date.now() });

    // Update tag index
    if (value.tags) {
      for (const tag of value.tags) {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag)!.add(key);
      }
    }

    // Auto cleanup after TTL
    setTimeout(() => {
      this.store.delete(key);
      this.removeFromTagIndex(key, value.tags);
    }, ttl * 1000);
  }

  async delete(key: string): Promise<void> {
    const entry = this.store.get(key);
    this.store.delete(key);
    if (entry) {
      this.removeFromTagIndex(key, entry.tags);
    }
  }

  async deleteByTag(tag: string): Promise<void> {
    const keys = this.tagIndex.get(tag);
    if (keys) {
      for (const key of keys) {
        this.store.delete(key);
      }
      this.tagIndex.delete(tag);
    }
  }

  async clear(): Promise<void> {
    this.store.clear();
    this.tagIndex.clear();
  }

  private removeFromTagIndex(key: string, tags?: string[]): void {
    if (tags) {
      for (const tag of tags) {
        const tagKeys = this.tagIndex.get(tag);
        if (tagKeys) {
          tagKeys.delete(key);
          if (tagKeys.size === 0) {
            this.tagIndex.delete(tag);
          }
        }
      }
    }
  }
}

// Redis cache store (for production)
class RedisCacheStore implements CacheStore {
  constructor(private redisClient: any) {}

  async get(key: string): Promise<CacheEntry | null> {
    try {
      const data = await this.redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Redis cache get error:', error);
      return null;
    }
  }

  async set(key: string, value: CacheEntry, ttl: number): Promise<void> {
    try {
      await this.redisClient.setex(key, ttl, JSON.stringify(value));
      
      // Update tag index
      if (value.tags) {
        for (const tag of value.tags) {
          await this.redisClient.sadd(`tag:${tag}`, key);
          await this.redisClient.expire(`tag:${tag}`, ttl);
        }
      }
    } catch (error) {
      console.error('Redis cache set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      // Get entry to remove from tag index
      const entry = await this.get(key);
      await this.redisClient.del(key);
      
      if (entry?.tags) {
        for (const tag of entry.tags) {
          await this.redisClient.srem(`tag:${tag}`, key);
        }
      }
    } catch (error) {
      console.error('Redis cache delete error:', error);
    }
  }

  async deleteByTag(tag: string): Promise<void> {
    try {
      const keys = await this.redisClient.smembers(`tag:${tag}`);
      if (keys.length > 0) {
        await this.redisClient.del(...keys);
        await this.redisClient.del(`tag:${tag}`);
      }
    } catch (error) {
      console.error('Redis cache deleteByTag error:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      await this.redisClient.flushdb();
    } catch (error) {
      console.error('Redis cache clear error:', error);
    }
  }
}

// Cache manager class
export class CacheManager {
  private store: CacheStore;

  constructor(store?: CacheStore) {
    this.store = store || new MemoryCacheStore();
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = await this.store.get(key);
    return entry ? entry.data : null;
  }

  async set<T>(key: string, data: T, config: CacheConfig): Promise<void> {
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      ttl: config.ttl,
      tags: config.tags,
      etag: this.generateETag(data),
      headers: this.generateCacheHeaders(config),
    };

    await this.store.set(key, entry, config.ttl);
  }

  async delete(key: string): Promise<void> {
    await this.store.delete(key);
  }

  async invalidateByTag(tag: string): Promise<void> {
    await this.store.deleteByTag(tag);
  }

  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    config: CacheConfig
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await fetcher();
    await this.set(key, data, config);
    return data;
  }

  private generateETag(data: any): string {
    // Simple ETag generation based on content hash
    const content = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `"${Math.abs(hash).toString(16)}"`;
  }

  private generateCacheHeaders(config: CacheConfig): Record<string, string> {
    const headers: Record<string, string> = {};

    if (config.private) {
      headers['Cache-Control'] = `private, max-age=${config.ttl}`;
    } else {
      let cacheControl = `public, max-age=${config.ttl}`;
      if (config.staleWhileRevalidate) {
        cacheControl += `, stale-while-revalidate=${config.staleWhileRevalidate}`;
      }
      headers['Cache-Control'] = cacheControl;
    }

    if (config.vary) {
      headers['Vary'] = config.vary.join(', ');
    }

    return headers;
  }
}

// Predefined cache configurations
export const CACHE_CONFIGS = {
  // Short-term cache for frequently changing data
  SHORT: {
    ttl: 300, // 5 minutes
    staleWhileRevalidate: 60,
  },

  // Medium-term cache for semi-static data
  MEDIUM: {
    ttl: 3600, // 1 hour
    staleWhileRevalidate: 300,
  },

  // Long-term cache for static data
  LONG: {
    ttl: 86400, // 24 hours
    staleWhileRevalidate: 3600,
  },

  // Celebrity data cache
  CELEBRITY: {
    ttl: 3600, // 1 hour
    staleWhileRevalidate: 300,
    tags: ['celebrity'],
    vary: ['Accept-Language'],
  },

  // Video reel cache
  REEL: {
    ttl: 1800, // 30 minutes
    staleWhileRevalidate: 300,
    tags: ['reel'],
    vary: ['Accept-Encoding'],
  },

  // Search results cache
  SEARCH: {
    ttl: 600, // 10 minutes
    staleWhileRevalidate: 60,
    tags: ['search'],
  },

  // Analytics cache
  ANALYTICS: {
    ttl: 300, // 5 minutes
    staleWhileRevalidate: 60,
    tags: ['analytics'],
    private: true,
  },

  // User-specific cache
  USER: {
    ttl: 1800, // 30 minutes
    staleWhileRevalidate: 300,
    private: true,
  },
} as const;

// Cache key generators
export const CACHE_KEYS = {
  celebrity: (id: string) => `celebrity:${id}`,
  celebrityList: (params: string) => `celebrities:${params}`,
  reel: (id: string) => `reel:${id}`,
  reelList: (params: string) => `reels:${params}`,
  search: (query: string, filters: string) => `search:${query}:${filters}`,
  analytics: (type: string, period: string) => `analytics:${type}:${period}`,
  user: (id: string) => `user:${id}`,
  userReels: (id: string, params: string) => `user:${id}:reels:${params}`,
};

// Global cache manager instance
export const cacheManager = new CacheManager();

// Cache middleware for API routes
export function withCache<T>(
  config: CacheConfig,
  keyGenerator: (request: NextRequest) => string
) {
  return async (
    request: NextRequest,
    handler: (request: NextRequest) => Promise<NextResponse>
  ): Promise<NextResponse> => {
    const cacheKey = keyGenerator(request);

    // Check for conditional requests
    const ifNoneMatch = request.headers.get('if-none-match');
    
    // Try to get from cache
    const cached = await cacheManager.store.get(cacheKey);
    
    if (cached) {
      // Check ETag for conditional requests
      if (ifNoneMatch && cached.etag === ifNoneMatch) {
        return new NextResponse(null, { status: 304 });
      }

      // Return cached response
      const response = NextResponse.json(cached.data);
      
      // Add cache headers
      if (cached.headers) {
        Object.entries(cached.headers).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      }
      
      if (cached.etag) {
        response.headers.set('ETag', cached.etag);
      }
      
      response.headers.set('X-Cache', 'HIT');
      return response;
    }

    // Execute handler
    const response = await handler(request);
    
    // Cache successful responses
    if (response.status === 200) {
      const data = await response.clone().json();
      await cacheManager.set(cacheKey, data, config);
      
      // Add cache headers to response
      const headers = cacheManager['generateCacheHeaders'](config);
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      
      response.headers.set('X-Cache', 'MISS');
    }

    return response;
  };
}

// Cache invalidation helpers
export const cacheInvalidation = {
  celebrity: (id?: string) => {
    if (id) {
      cacheManager.delete(CACHE_KEYS.celebrity(id));
    }
    cacheManager.invalidateByTag('celebrity');
  },

  reel: (id?: string) => {
    if (id) {
      cacheManager.delete(CACHE_KEYS.reel(id));
    }
    cacheManager.invalidateByTag('reel');
  },

  search: () => {
    cacheManager.invalidateByTag('search');
  },

  analytics: () => {
    cacheManager.invalidateByTag('analytics');
  },

  all: () => {
    cacheManager.store.clear();
  },
};
