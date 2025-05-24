# Database Schema Documentation

## Overview

The Sports Celebrity Reels application uses PostgreSQL with Prisma ORM for data management. The database is designed for high performance with proper indexing and optimized for handling large-scale traffic.

## Schema Design

### Core Entities

#### 1. Celebrity
Stores information about sports celebrities.

**Key Features:**
- Full-text search on name and biography
- Slug-based URLs for SEO
- Social media links storage (JSON)
- Comprehensive statistics tracking
- Verification system

**Performance Optimizations:**
- Composite index on `(sport, isActive)`
- Full-text search index on `(name, biography)`
- Partial index for active celebrities

#### 2. VideoReel
Central entity for video content.

**Key Features:**
- Complete video metadata storage
- AI generation tracking
- Engagement metrics (views, likes, shares)
- Content moderation flags
- SEO optimization fields

**Performance Optimizations:**
- Composite index on `(celebrityId, status, isPublic)`
- Partial index for public completed videos
- Full-text search on title and description

#### 3. User
User management with anonymous support.

**Key Features:**
- Email/username authentication
- Anonymous user support via deviceId
- User preferences (JSON storage)
- Activity tracking

#### 4. User Interactions
Comprehensive tracking of user engagement.

**Tables:**
- `UserVideoLike` - Video likes with unique constraints
- `UserVideoShare` - Share tracking by platform
- `UserVideoView` - Detailed view analytics
- `UserCelebrityLike` - Celebrity following

### Analytics & Reporting

#### VideoAnalytics
Daily aggregated metrics per video.

**Metrics Tracked:**
- Views, unique views, likes, shares, comments
- Engagement rates and completion rates
- Device breakdown (mobile, tablet, desktop)
- Geographic data (top countries)

#### SystemAnalytics
Platform-wide daily metrics.

**Metrics Tracked:**
- User growth and activity
- Content creation rates
- Performance metrics (load time, error rate)
- Resource usage (storage, bandwidth, AI costs)

### Content Generation

#### GenerationJob
Tracks AI content generation processes.

**Features:**
- Multi-stage generation tracking
- Error handling and retry logic
- Cost tracking for AI services
- Processing time monitoring

## Indexing Strategy

### Primary Indexes
All tables have optimized primary keys using `cuid()` for better distribution.

### Performance Indexes

#### Composite Indexes
```sql
-- Video discovery
CREATE INDEX idx_video_reels_celebrity_status_public 
ON video_reels (celebrityId, status, isPublic);

-- Trending content
CREATE INDEX idx_video_reels_created_views 
ON video_reels (createdAt DESC, views DESC);

-- Celebrity browsing
CREATE INDEX idx_celebrities_sport_active_views 
ON celebrities (sport, isActive, totalViews DESC);
```

#### Partial Indexes
```sql
-- Active content only
CREATE INDEX idx_video_reels_public_completed 
ON video_reels (createdAt DESC) 
WHERE isPublic = true AND status = 'COMPLETED';

-- Active celebrities only
CREATE INDEX idx_celebrities_active 
ON celebrities (totalViews DESC) 
WHERE isActive = true;
```

#### Full-Text Search
```sql
-- Celebrity search
CREATE INDEX idx_celebrities_name_biography_fts 
ON celebrities USING gin(to_tsvector('english', name || ' ' || biography));

-- Video search
CREATE INDEX idx_video_reels_title_description_fts 
ON video_reels USING gin(to_tsvector('english', title || ' ' || description));
```

## Database Functions & Triggers

### Automatic Statistics Updates
```sql
-- Updates celebrity reel count when videos are added/removed
CREATE TRIGGER trigger_update_celebrity_stats
AFTER INSERT OR DELETE ON video_reels
FOR EACH ROW EXECUTE FUNCTION update_celebrity_stats();
```

### Engagement Rate Calculation
```sql
-- Calculates engagement rate for any video
SELECT calculate_engagement_rate('video_id');
```

## Performance Considerations

### Query Optimization
1. **Pagination**: Uses cursor-based pagination for large datasets
2. **Eager Loading**: Includes related data in single queries
3. **Selective Fields**: Only fetches required fields
4. **Connection Pooling**: Configured for high concurrency

### Caching Strategy
1. **Query Results**: Cached at application level
2. **Aggregated Data**: Daily analytics pre-computed
3. **Static Data**: Celebrity profiles cached with long TTL

### Scaling Considerations
1. **Read Replicas**: Schema supports read-only replicas
2. **Partitioning**: Analytics tables can be partitioned by date
3. **Archiving**: Old data can be moved to separate tables

## Data Integrity

### Constraints
- Foreign key constraints with CASCADE deletes
- Unique constraints on critical fields
- Check constraints for data validation

### Soft Deletes
- Videos use status-based soft deletes
- Comments have `isDeleted` flag
- Users can be deactivated vs. deleted

## Monitoring & Health Checks

### Health Check Script
```bash
npm run db:health
```

Checks:
- Database connectivity
- Table counts and sizes
- Index effectiveness
- Slow query detection
- Replication lag (if applicable)

### Performance Monitoring
- Slow query logging
- Connection pool monitoring
- Index usage statistics
- Query execution plans

## Migration Strategy

### Development
```bash
npm run db:migrate        # Create and apply migration
npm run db:push           # Push schema changes (dev only)
```

### Production
```bash
npm run db:migrate:deploy # Apply migrations safely
```

### Rollback Strategy
- All migrations are reversible
- Database backups before major changes
- Blue-green deployment support

## Security

### Access Control
- Row-level security policies (if needed)
- Database user permissions
- Connection encryption (SSL)

### Data Protection
- Sensitive data encryption at rest
- PII handling compliance
- Audit logging for sensitive operations

## Backup & Recovery

### Automated Backups
- Daily full backups
- Point-in-time recovery capability
- Cross-region backup replication

### Disaster Recovery
- RTO: < 4 hours
- RPO: < 1 hour
- Automated failover procedures

## Development Workflow

### Local Setup
```bash
# Setup database
npm run db:setup

# Generate Prisma client
npm run db:generate

# Apply schema changes
npm run db:push

# Seed sample data
npm run db:seed
```

### Schema Changes
1. Modify `prisma/schema.prisma`
2. Generate migration: `npm run db:migrate`
3. Test migration on staging
4. Deploy to production: `npm run db:migrate:deploy`

## Best Practices

### Query Performance
- Use `include` for related data instead of separate queries
- Implement proper pagination
- Use database functions for complex calculations
- Monitor query performance regularly

### Data Modeling
- Normalize where appropriate, denormalize for performance
- Use appropriate data types
- Consider future scaling needs
- Document all schema changes

### Maintenance
- Regular VACUUM and ANALYZE operations
- Index maintenance and optimization
- Statistics updates
- Connection pool tuning
