import { NextRequest } from 'next/server';

// Pagination configuration
export interface PaginationConfig {
  defaultLimit: number;
  maxLimit: number;
  defaultSort: string;
  allowedSortFields: string[];
  allowedSortOrders: ('asc' | 'desc')[];
}

// Pagination parameters
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
  sort: string;
  order: 'asc' | 'desc';
  search?: string;
  filters?: Record<string, any>;
}

// Pagination result
export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
    nextPage?: number;
    prevPage?: number;
  };
  meta?: {
    sort: string;
    order: string;
    search?: string;
    filters?: Record<string, any>;
  };
}

// Cursor-based pagination for high-performance scenarios
export interface CursorPaginationParams {
  limit: number;
  cursor?: string;
  sort: string;
  order: 'asc' | 'desc';
  search?: string;
  filters?: Record<string, any>;
}

export interface CursorPaginationResult<T> {
  data: T[];
  pagination: {
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
    nextCursor?: string;
    prevCursor?: string;
  };
  meta?: {
    sort: string;
    order: string;
    search?: string;
    filters?: Record<string, any>;
  };
}

// Parse pagination parameters from request
export function parsePaginationParams(
  request: NextRequest,
  config: PaginationConfig
): PaginationParams {
  const { searchParams } = new URL(request.url);

  // Parse page and limit
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(
    config.maxLimit,
    Math.max(1, parseInt(searchParams.get('limit') || config.defaultLimit.toString()))
  );
  const offset = (page - 1) * limit;

  // Parse sort and order
  const sort = searchParams.get('sort') || config.defaultSort;
  const order = (searchParams.get('order') || 'desc') as 'asc' | 'desc';

  // Validate sort field
  const validSort = config.allowedSortFields.includes(sort) ? sort : config.defaultSort;
  const validOrder = config.allowedSortOrders.includes(order) ? order : 'desc';

  // Parse search
  const search = searchParams.get('search') || undefined;

  // Parse filters
  const filters: Record<string, any> = {};
  for (const [key, value] of searchParams.entries()) {
    if (!['page', 'limit', 'sort', 'order', 'search'].includes(key)) {
      // Handle different filter types
      if (value === 'true' || value === 'false') {
        filters[key] = value === 'true';
      } else if (!isNaN(Number(value))) {
        filters[key] = Number(value);
      } else {
        filters[key] = value;
      }
    }
  }

  return {
    page,
    limit,
    offset,
    sort: validSort,
    order: validOrder,
    search,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
  };
}

// Parse cursor-based pagination parameters
export function parseCursorPaginationParams(
  request: NextRequest,
  config: PaginationConfig
): CursorPaginationParams {
  const { searchParams } = new URL(request.url);

  const limit = Math.min(
    config.maxLimit,
    Math.max(1, parseInt(searchParams.get('limit') || config.defaultLimit.toString()))
  );
  const cursor = searchParams.get('cursor') || undefined;
  const sort = searchParams.get('sort') || config.defaultSort;
  const order = (searchParams.get('order') || 'desc') as 'asc' | 'desc';

  const validSort = config.allowedSortFields.includes(sort) ? sort : config.defaultSort;
  const validOrder = config.allowedSortOrders.includes(order) ? order : 'desc';

  const search = searchParams.get('search') || undefined;

  const filters: Record<string, any> = {};
  for (const [key, value] of searchParams.entries()) {
    if (!['limit', 'cursor', 'sort', 'order', 'search'].includes(key)) {
      if (value === 'true' || value === 'false') {
        filters[key] = value === 'true';
      } else if (!isNaN(Number(value))) {
        filters[key] = Number(value);
      } else {
        filters[key] = value;
      }
    }
  }

  return {
    limit,
    cursor,
    sort: validSort,
    order: validOrder,
    search,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
  };
}

// Create pagination result
export function createPaginationResult<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginationResult<T> {
  const totalPages = Math.ceil(total / params.limit);
  const hasNext = params.page < totalPages;
  const hasPrev = params.page > 1;

  return {
    data,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages,
      hasNext,
      hasPrev,
      nextPage: hasNext ? params.page + 1 : undefined,
      prevPage: hasPrev ? params.page - 1 : undefined,
    },
    meta: {
      sort: params.sort,
      order: params.order,
      search: params.search,
      filters: params.filters,
    },
  };
}

// Create cursor-based pagination result
export function createCursorPaginationResult<T>(
  data: T[],
  params: CursorPaginationParams,
  getCursor: (item: T) => string
): CursorPaginationResult<T> {
  const hasNext = data.length === params.limit;
  const hasPrev = !!params.cursor;

  return {
    data,
    pagination: {
      limit: params.limit,
      hasNext,
      hasPrev,
      nextCursor: hasNext && data.length > 0 ? getCursor(data[data.length - 1]) : undefined,
      prevCursor: hasPrev ? params.cursor : undefined,
    },
    meta: {
      sort: params.sort,
      order: params.order,
      search: params.search,
      filters: params.filters,
    },
  };
}

// Predefined pagination configurations
export const PAGINATION_CONFIGS = {
  // Default configuration
  DEFAULT: {
    defaultLimit: 20,
    maxLimit: 100,
    defaultSort: 'createdAt',
    allowedSortFields: ['createdAt', 'updatedAt', 'name', 'id'],
    allowedSortOrders: ['asc', 'desc'] as const,
  },

  // Celebrity pagination
  CELEBRITIES: {
    defaultLimit: 24,
    maxLimit: 100,
    defaultSort: 'totalViews',
    allowedSortFields: [
      'name',
      'sport',
      'totalViews',
      'totalLikes',
      'reelsCount',
      'createdAt',
      'updatedAt',
    ],
    allowedSortOrders: ['asc', 'desc'] as const,
  },

  // Reel pagination
  REELS: {
    defaultLimit: 20,
    maxLimit: 50,
    defaultSort: 'createdAt',
    allowedSortFields: [
      'createdAt',
      'updatedAt',
      'views',
      'likes',
      'shares',
      'duration',
      'title',
    ],
    allowedSortOrders: ['asc', 'desc'] as const,
  },

  // Search results pagination
  SEARCH: {
    defaultLimit: 15,
    maxLimit: 50,
    defaultSort: 'relevance',
    allowedSortFields: ['relevance', 'createdAt', 'views', 'likes'],
    allowedSortOrders: ['asc', 'desc'] as const,
  },

  // Analytics pagination
  ANALYTICS: {
    defaultLimit: 50,
    maxLimit: 200,
    defaultSort: 'timestamp',
    allowedSortFields: ['timestamp', 'value', 'metric'],
    allowedSortOrders: ['asc', 'desc'] as const,
  },

  // Comments pagination
  COMMENTS: {
    defaultLimit: 10,
    maxLimit: 50,
    defaultSort: 'createdAt',
    allowedSortFields: ['createdAt', 'likes', 'replies'],
    allowedSortOrders: ['asc', 'desc'] as const,
  },
} as const;

// Build Prisma orderBy from pagination params
export function buildPrismaOrderBy(params: PaginationParams): Record<string, 'asc' | 'desc'> {
  return { [params.sort]: params.order };
}

// Build Prisma where clause from filters
export function buildPrismaWhere(
  params: PaginationParams,
  searchFields?: string[]
): Record<string, any> {
  const where: Record<string, any> = {};

  // Add search conditions
  if (params.search && searchFields && searchFields.length > 0) {
    where.OR = searchFields.map(field => ({
      [field]: {
        contains: params.search,
        mode: 'insensitive',
      },
    }));
  }

  // Add filter conditions
  if (params.filters) {
    Object.entries(params.filters).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        where[key] = { in: value };
      } else if (typeof value === 'string' && value.includes(',')) {
        where[key] = { in: value.split(',') };
      } else {
        where[key] = value;
      }
    });
  }

  return where;
}

// Build cursor-based Prisma query
export function buildCursorPrismaQuery(
  params: CursorPaginationParams,
  searchFields?: string[]
): {
  where: Record<string, any>;
  orderBy: Record<string, 'asc' | 'desc'>;
  take: number;
  cursor?: Record<string, any>;
  skip?: number;
} {
  const where = buildPrismaWhere(
    {
      ...params,
      page: 1,
      limit: params.limit,
      offset: 0,
    },
    searchFields
  );

  const orderBy = { [params.sort]: params.order };

  const query: any = {
    where,
    orderBy,
    take: params.limit,
  };

  if (params.cursor) {
    try {
      const cursorData = JSON.parse(Buffer.from(params.cursor, 'base64').toString());
      query.cursor = cursorData;
      query.skip = 1; // Skip the cursor item
    } catch (error) {
      console.warn('Invalid cursor:', error);
    }
  }

  return query;
}

// Generate cursor from item
export function generateCursor(item: any, sortField: string): string {
  const cursorData = {
    id: item.id,
    [sortField]: item[sortField],
  };
  return Buffer.from(JSON.stringify(cursorData)).toString('base64');
}

// Pagination middleware
export function withPagination(config: PaginationConfig) {
  return (request: NextRequest) => {
    const params = parsePaginationParams(request, config);
    return params;
  };
}

// Cursor pagination middleware
export function withCursorPagination(config: PaginationConfig) {
  return (request: NextRequest) => {
    const params = parseCursorPaginationParams(request, config);
    return params;
  };
}
