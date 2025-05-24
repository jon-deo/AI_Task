import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createRateLimitMiddleware, RateLimitConfig } from './rate-limiting';
import { cacheManager, CacheConfig } from './caching';
import { logError, classifyError } from './error-handling';

// API Response interface
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  details?: any;
  pagination?: any;
  meta?: any;
}

// Middleware configuration
export interface ApiMiddlewareConfig {
  rateLimit?: RateLimitConfig;
  cache?: CacheConfig & { keyGenerator?: (request: NextRequest) => string };
  auth?: {
    required: boolean;
    roles?: string[];
  };
  validation?: {
    query?: z.ZodSchema;
    body?: z.ZodSchema;
    params?: z.ZodSchema;
  };
  cors?: {
    origins?: string[];
    methods?: string[];
    headers?: string[];
  };
}

// Request context interface
export interface RequestContext {
  user?: any;
  rateLimitHeaders: Record<string, string>;
  cacheHit: boolean;
  validatedQuery?: any;
  validatedBody?: any;
  validatedParams?: any;
}

// API Handler type
export type ApiHandler = (
  request: NextRequest,
  context: RequestContext,
  params?: any
) => Promise<NextResponse>;

/**
 * Create API middleware with comprehensive functionality
 */
export function createApiMiddleware(config: ApiMiddlewareConfig = {}) {
  return function withMiddleware(handler: ApiHandler) {
    return async (request: NextRequest, params?: any): Promise<NextResponse> => {
      const context: RequestContext = {
        rateLimitHeaders: {},
        cacheHit: false,
      };

      try {
        // 1. CORS handling
        if (config.cors) {
          const corsResponse = handleCors(request, config.cors);
          if (corsResponse) return corsResponse;
        }

        // 2. Rate limiting
        if (config.rateLimit) {
          const rateLimitMiddleware = createRateLimitMiddleware(config.rateLimit);
          const rateLimitResult = await rateLimitMiddleware(request);
          
          context.rateLimitHeaders = rateLimitResult.headers;
          
          if (!rateLimitResult.allowed) {
            return createErrorResponse(
              'Rate limit exceeded',
              429,
              { retryAfter: rateLimitResult.retryAfter },
              rateLimitResult.headers
            );
          }
        }

        // 3. Authentication
        if (config.auth?.required) {
          const authResult = await handleAuthentication(request, config.auth);
          if (!authResult.success) {
            return createErrorResponse(authResult.error!, 401);
          }
          context.user = authResult.user;
        }

        // 4. Input validation
        if (config.validation) {
          const validationResult = await handleValidation(request, config.validation, params);
          if (!validationResult.success) {
            return createErrorResponse(
              'Validation failed',
              400,
              validationResult.errors
            );
          }
          context.validatedQuery = validationResult.query;
          context.validatedBody = validationResult.body;
          context.validatedParams = validationResult.params;
        }

        // 5. Cache check (for GET requests)
        if (request.method === 'GET' && config.cache) {
          const cacheKey = config.cache.keyGenerator 
            ? config.cache.keyGenerator(request)
            : generateDefaultCacheKey(request);

          const cached = await cacheManager.get(cacheKey);
          if (cached) {
            context.cacheHit = true;
            return createSuccessResponse(cached, {
              'X-Cache': 'HIT',
              'Cache-Control': generateCacheControlHeader(config.cache),
              ...context.rateLimitHeaders,
            });
          }
        }

        // 6. Execute handler
        const response = await handler(request, context, params);

        // 7. Cache response (for successful GET requests)
        if (
          request.method === 'GET' && 
          config.cache && 
          response.status === 200 &&
          !context.cacheHit
        ) {
          const cacheKey = config.cache.keyGenerator 
            ? config.cache.keyGenerator(request)
            : generateDefaultCacheKey(request);

          const responseData = await response.clone().json();
          if (responseData.success) {
            await cacheManager.set(cacheKey, responseData.data, config.cache);
          }

          response.headers.set('X-Cache', 'MISS');
          response.headers.set('Cache-Control', generateCacheControlHeader(config.cache));
        }

        // 8. Add common headers
        Object.entries(context.rateLimitHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });

        return response;
      } catch (error) {
        // Error handling and logging
        const errorInfo = classifyError(error as Error);
        
        logError(
          error as Error,
          {
            url: request.url,
            method: request.method,
            userAgent: request.headers.get('user-agent'),
            ip: request.ip || request.headers.get('x-forwarded-for'),
          },
          context.user?.id,
          request.headers.get('x-request-id') || undefined
        );

        return createErrorResponse(
          errorInfo.userMessage,
          errorInfo.severity === 'low' ? 400 : 500,
          process.env.NODE_ENV === 'development' ? { stack: (error as Error).stack } : undefined
        );
      }
    };
  };
}

/**
 * Handle CORS
 */
function handleCors(request: NextRequest, corsConfig: NonNullable<ApiMiddlewareConfig['cors']>) {
  const origin = request.headers.get('origin');
  const method = request.method;

  // Handle preflight requests
  if (method === 'OPTIONS') {
    const headers = new Headers();
    
    if (corsConfig.origins?.includes(origin || '') || corsConfig.origins?.includes('*')) {
      headers.set('Access-Control-Allow-Origin', origin || '*');
    }
    
    if (corsConfig.methods) {
      headers.set('Access-Control-Allow-Methods', corsConfig.methods.join(', '));
    }
    
    if (corsConfig.headers) {
      headers.set('Access-Control-Allow-Headers', corsConfig.headers.join(', '));
    }
    
    headers.set('Access-Control-Max-Age', '86400');
    
    return new NextResponse(null, { status: 200, headers });
  }

  return null;
}

/**
 * Handle authentication
 */
async function handleAuthentication(
  request: NextRequest, 
  authConfig: NonNullable<ApiMiddlewareConfig['auth']>
): Promise<{ success: boolean; user?: any; error?: string }> {
  // TODO: Implement actual authentication logic
  // This is a placeholder implementation
  
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { success: false, error: 'Missing or invalid authorization header' };
  }

  const token = authHeader.substring(7);
  
  // TODO: Verify JWT token and get user
  // const user = await verifyJwtToken(token);
  // if (!user) {
  //   return { success: false, error: 'Invalid token' };
  // }

  // TODO: Check user roles if specified
  // if (authConfig.roles && !authConfig.roles.some(role => user.roles.includes(role))) {
  //   return { success: false, error: 'Insufficient permissions' };
  // }

  // Placeholder user for now
  const user = { id: 'user_123', roles: ['user'] };
  
  return { success: true, user };
}

/**
 * Handle input validation
 */
async function handleValidation(
  request: NextRequest,
  validationConfig: NonNullable<ApiMiddlewareConfig['validation']>,
  params?: any
): Promise<{
  success: boolean;
  query?: any;
  body?: any;
  params?: any;
  errors?: any;
}> {
  try {
    const result: any = { success: true };

    // Validate query parameters
    if (validationConfig.query) {
      const { searchParams } = new URL(request.url);
      const queryObject: any = {};
      
      for (const [key, value] of searchParams.entries()) {
        // Handle array parameters
        if (queryObject[key]) {
          if (Array.isArray(queryObject[key])) {
            queryObject[key].push(value);
          } else {
            queryObject[key] = [queryObject[key], value];
          }
        } else {
          queryObject[key] = value;
        }
      }
      
      result.query = validationConfig.query.parse(queryObject);
    }

    // Validate request body
    if (validationConfig.body && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
      const body = await request.json();
      result.body = validationConfig.body.parse(body);
    }

    // Validate route parameters
    if (validationConfig.params && params) {
      result.params = validationConfig.params.parse(params);
    }

    return result;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        })),
      };
    }

    return {
      success: false,
      errors: [{ message: 'Validation failed' }],
    };
  }
}

/**
 * Generate default cache key
 */
function generateDefaultCacheKey(request: NextRequest): string {
  const url = new URL(request.url);
  return `api:${url.pathname}:${url.search}`;
}

/**
 * Generate Cache-Control header
 */
function generateCacheControlHeader(cacheConfig: CacheConfig): string {
  let cacheControl = cacheConfig.private ? 'private' : 'public';
  cacheControl += `, max-age=${cacheConfig.ttl}`;
  
  if (cacheConfig.staleWhileRevalidate) {
    cacheControl += `, stale-while-revalidate=${cacheConfig.staleWhileRevalidate}`;
  }
  
  return cacheControl;
}

/**
 * Create success response
 */
export function createSuccessResponse<T>(
  data: T,
  headers?: Record<string, string>,
  message?: string
): NextResponse {
  const response: ApiResponse<T> = {
    success: true,
    data,
    ...(message && { message }),
  };

  return NextResponse.json(response, { headers });
}

/**
 * Create error response
 */
export function createErrorResponse(
  error: string,
  status: number = 500,
  details?: any,
  headers?: Record<string, string>
): NextResponse {
  const response: ApiResponse = {
    success: false,
    error,
    ...(details && { details }),
  };

  return NextResponse.json(response, { status, headers });
}

/**
 * Create paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  pagination: any,
  meta?: any,
  headers?: Record<string, string>
): NextResponse {
  const response: ApiResponse<T[]> = {
    success: true,
    data,
    pagination,
    ...(meta && { meta }),
  };

  return NextResponse.json(response, { headers });
}
