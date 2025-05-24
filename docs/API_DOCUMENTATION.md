# Sports Celebrity Reels API Documentation

## Overview

The Sports Celebrity Reels API provides comprehensive endpoints for managing celebrities, video reels, and user interactions. Built with Next.js 14 App Router, it features advanced caching, rate limiting, and pagination for high-traffic scenarios.

## Base URL

```
Production: https://your-domain.com/api
Development: http://localhost:3000/api
```

## Authentication

Most endpoints require authentication via Bearer token:

```http
Authorization: Bearer <your-jwt-token>
```

## Rate Limiting

All endpoints are rate-limited to ensure fair usage:

- **General API**: 1000 requests per 15 minutes
- **Search**: 60 requests per minute
- **Authentication**: 5 requests per 15 minutes
- **Admin**: 100 requests per 15 minutes
- **Public Content**: 300 requests per minute

Rate limit headers are included in all responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in window
- `X-RateLimit-Reset`: When the rate limit resets

## Caching

Responses are cached for optimal performance:
- **Celebrity Data**: 1 hour cache with 5-minute stale-while-revalidate
- **Reel Data**: 30 minutes cache with 5-minute stale-while-revalidate
- **Search Results**: 10 minutes cache with 1-minute stale-while-revalidate

Cache status is indicated by the `X-Cache` header (`HIT` or `MISS`).

## Pagination

List endpoints support pagination with the following parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number (1-based) |
| `limit` | integer | 20 | Items per page (max 100) |
| `sort` | string | varies | Sort field |
| `order` | string | desc | Sort order (`asc` or `desc`) |

Pagination response format:
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false,
    "nextPage": 2
  }
}
```

## Error Handling

All errors follow a consistent format:

```json
{
  "success": false,
  "error": "Error message",
  "details": {...} // Optional additional details
}
```

Common HTTP status codes:
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `409`: Conflict
- `429`: Rate Limit Exceeded
- `500`: Internal Server Error

## Endpoints

### Celebrities

#### Get All Celebrities
```http
GET /api/celebrities
```

**Query Parameters:**
- `page` (integer): Page number
- `limit` (integer): Items per page (max 100)
- `sort` (string): Sort by `name`, `sport`, `totalViews`, `totalLikes`, `reelsCount`, `createdAt`, `updatedAt`
- `order` (string): `asc` or `desc`
- `search` (string): Search in name and biography
- `sport` (string): Filter by sport
- `isActive` (boolean): Filter by active status
- `isVerified` (boolean): Filter by verified status

**Response:**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "celebrity_123",
        "name": "LeBron James",
        "sport": "BASKETBALL",
        "nationality": "USA",
        "biography": "Professional basketball player...",
        "position": "Forward",
        "team": "Los Angeles Lakers",
        "imageUrl": "https://...",
        "thumbnailUrl": "https://...",
        "isActive": true,
        "isVerified": true,
        "totalViews": "1500000",
        "totalLikes": "250000",
        "totalShares": "50000",
        "reelsCount": 45,
        "slug": "lebron-james",
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-01-15T12:00:00Z"
      }
    ],
    "pagination": {...}
  }
}
```

#### Get Celebrity by ID/Slug
```http
GET /api/celebrities/{id}
```

**Parameters:**
- `id` (string): Celebrity ID or slug

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "celebrity_123",
    "name": "LeBron James",
    "sport": "BASKETBALL",
    "nationality": "USA",
    "biography": "Professional basketball player...",
    "achievements": ["4x NBA Champion", "4x NBA Finals MVP"],
    "position": "Forward",
    "team": "Los Angeles Lakers",
    "birthDate": "1984-12-30T00:00:00Z",
    "imageUrl": "https://...",
    "socialLinks": {
      "twitter": "https://twitter.com/kingjames",
      "instagram": "https://instagram.com/kingjames"
    },
    "reels": [
      {
        "id": "reel_456",
        "title": "LeBron's Greatest Dunks",
        "thumbnailUrl": "https://...",
        "duration": 60,
        "views": "50000",
        "likes": "5000",
        "createdAt": "2024-01-10T00:00:00Z"
      }
    ],
    "reelsCount": 45,
    "totalViews": "1500000",
    "totalLikes": "250000",
    "isVerified": true,
    "slug": "lebron-james"
  }
}
```

#### Create Celebrity (Admin Only)
```http
POST /api/celebrities
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Stephen Curry",
  "sport": "BASKETBALL",
  "nationality": "USA",
  "biography": "Professional basketball player known for his three-point shooting...",
  "achievements": ["4x NBA Champion", "2x NBA MVP"],
  "position": "Point Guard",
  "team": "Golden State Warriors",
  "birthDate": "1988-03-14T00:00:00Z",
  "imageUrl": "https://...",
  "socialLinks": {
    "twitter": "https://twitter.com/stephencurry30",
    "instagram": "https://instagram.com/stephencurry30"
  },
  "metaTitle": "Stephen Curry - NBA Superstar",
  "metaDescription": "Watch the best Stephen Curry highlights and moments",
  "keywords": ["stephen curry", "basketball", "nba", "warriors"]
}
```

### Reels

#### Get All Reels
```http
GET /api/reels
```

**Query Parameters:**
- `page` (integer): Page number
- `limit` (integer): Items per page (max 50)
- `sort` (string): Sort by `createdAt`, `views`, `likes`, `shares`, `duration`, `title`
- `order` (string): `asc` or `desc`
- `search` (string): Search in title and description
- `celebrityId` (string): Filter by celebrity
- `sport` (string): Filter by sport
- `featured` (boolean): Filter featured reels
- `minDuration` (integer): Minimum duration in seconds
- `maxDuration` (integer): Maximum duration in seconds

**Response:**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "reel_456",
        "title": "LeBron's Greatest Dunks",
        "description": "A compilation of LeBron James' most spectacular dunks",
        "videoUrl": "https://...",
        "thumbnailUrl": "https://...",
        "duration": 60,
        "views": "50000",
        "likes": "5000",
        "shares": "500",
        "tags": ["dunks", "highlights", "basketball"],
        "isPublished": true,
        "featured": false,
        "celebrity": {
          "id": "celebrity_123",
          "name": "LeBron James",
          "sport": "BASKETBALL",
          "imageUrl": "https://...",
          "slug": "lebron-james"
        },
        "commentsCount": 150,
        "slug": "lebron-greatest-dunks",
        "createdAt": "2024-01-10T00:00:00Z"
      }
    ],
    "pagination": {...}
  }
}
```

#### Get Reel by ID/Slug
```http
GET /api/reels/{id}
```

**Response includes:**
- Full reel details
- Celebrity information
- Recent comments (10 most recent)
- Related reels (6 from same celebrity)

#### Reel Actions
```http
POST /api/reels/{id}
Content-Type: application/json
```

**Request Body:**
```json
{
  "action": "like" // "like", "unlike", "share", "view"
}
```

### Search

#### Search Content
```http
GET /api/search?q={query}
```

**Query Parameters:**
- `q` (string, required): Search query
- `type` (string): `all`, `celebrities`, `reels` (default: `all`)
- `page` (integer): Page number
- `limit` (integer): Items per page (max 50)
- `sort` (string): `relevance`, `createdAt`, `views`, `likes`
- `sport` (string): Filter by sport
- `minDuration` (integer): Min duration for reels
- `maxDuration` (integer): Max duration for reels

**Response:**
```json
{
  "success": true,
  "data": {
    "query": "lebron james",
    "type": "all",
    "celebrities": [...],
    "reels": [...],
    "totalResults": 25
  }
}
```

#### Search Suggestions
```http
POST /api/search
Content-Type: application/json
```

**Request Body:**
```json
{
  "q": "lebr"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "celebrities": [
      {
        "id": "celebrity_123",
        "name": "LeBron James",
        "sport": "BASKETBALL",
        "imageUrl": "https://...",
        "slug": "lebron-james"
      }
    ],
    "popularSearches": [
      {
        "query": "lebron james highlights",
        "count": 150
      }
    ]
  }
}
```

### Trending

#### Get Trending Content
```http
GET /api/trending
```

**Query Parameters:**
- `type` (string): `reels`, `celebrities`, `sports` (default: `reels`)
- `period` (string): `24h`, `7d`, `30d`, `all` (default: `7d`)
- `limit` (integer): Items to return (max 50)
- `sport` (string): Filter by sport

**Response:**
```json
{
  "success": true,
  "data": {
    "type": "reels",
    "period": "7d",
    "data": [...],
    "metadata": {
      "totalCount": 20,
      "sport": "BASKETBALL"
    }
  }
}
```

#### Get Featured Content
```http
POST /api/trending
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reels": [...],
    "celebrities": [...],
    "lastUpdated": "2024-01-15T12:00:00Z"
  }
}
```

### Analytics (Admin Only)

#### Get Analytics Data
```http
GET /api/analytics
Authorization: Bearer <admin-token>
```

**Query Parameters:**
- `type` (string): `overview`, `reels`, `celebrities`, `users`, `engagement`
- `period` (string): `24h`, `7d`, `30d`, `90d`, `1y`
- `granularity` (string): `hour`, `day`, `week`, `month`
- `entityId` (string): Specific entity ID for detailed analytics

**Response varies by type:**

**Overview:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totals": {
        "reels": 1250,
        "celebrities": 150,
        "users": 50000
      },
      "period": {
        "views": 2500000,
        "likes": 150000,
        "shares": 25000
      },
      "topSports": [...],
      "recentReels": [...]
    },
    "period": "7d",
    "generatedAt": "2024-01-15T12:00:00Z"
  }
}
```

## SDKs and Examples

### JavaScript/TypeScript
```typescript
// Example API client usage
const api = new SportsReelsAPI('https://your-domain.com/api');

// Get celebrities with pagination
const celebrities = await api.celebrities.list({
  page: 1,
  limit: 20,
  sport: 'BASKETBALL',
  sort: 'totalViews',
  order: 'desc'
});

// Search for content
const searchResults = await api.search('lebron james', {
  type: 'all',
  sport: 'BASKETBALL'
});

// Get trending reels
const trending = await api.trending.reels({
  period: '7d',
  limit: 10
});
```

### cURL Examples
```bash
# Get celebrities
curl -X GET "https://your-domain.com/api/celebrities?sport=BASKETBALL&limit=10" \
  -H "Accept: application/json"

# Search content
curl -X GET "https://your-domain.com/api/search?q=lebron%20james&type=all" \
  -H "Accept: application/json"

# Like a reel
curl -X POST "https://your-domain.com/api/reels/reel_456" \
  -H "Content-Type: application/json" \
  -d '{"action": "like"}'
```

## Performance Considerations

1. **Caching**: Responses are heavily cached. Use appropriate cache headers.
2. **Pagination**: Always use pagination for list endpoints to avoid large responses.
3. **Rate Limiting**: Implement exponential backoff for rate limit handling.
4. **Compression**: API supports gzip compression for reduced bandwidth.
5. **CDN**: Static assets are served via CloudFront CDN for global performance.

## Webhooks (Coming Soon)

Webhook endpoints for real-time notifications:
- New reel published
- Celebrity verified
- Trending content updates
- User engagement milestones

## Support

For API support and questions:
- Documentation: https://docs.your-domain.com
- Support Email: api-support@your-domain.com
- Status Page: https://status.your-domain.com
