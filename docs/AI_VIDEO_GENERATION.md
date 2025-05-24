# AI-Powered Video Generation System

## Overview

The Sports Celebrity Reels application features a sophisticated AI-powered video generation system that creates engaging sports content automatically. The system combines OpenAI's GPT models for script generation, Amazon Polly for speech synthesis, and advanced video processing to create professional-quality sports reels.

## Architecture

### Core Components

1. **Script Generation** (OpenAI GPT-4)
   - Intelligent sports content creation
   - Celebrity-specific storytelling
   - Customizable tone and style
   - SEO-optimized titles and descriptions

2. **Speech Synthesis** (Amazon Polly)
   - Neural voice generation
   - Multiple voice types and accents
   - SSML support for enhanced speech
   - Optimized for sports commentary

3. **Video Processing**
   - Image-to-video conversion
   - Automatic thumbnail generation
   - Multiple resolution support
   - Subtitle integration

4. **Queue Management**
   - Concurrent processing control
   - Priority-based scheduling
   - Automatic retry logic
   - Real-time progress tracking

## Features

### 🤖 AI Script Generation

**Intelligent Content Creation:**
- Celebrity-specific narratives
- Sport-specific terminology
- Achievement highlighting
- Engaging storytelling structure

**Customization Options:**
- Duration control (15-120 seconds)
- Style selection (documentary, energetic, inspirational)
- Custom prompts and focus points
- Tone and audience targeting

**Quality Assurance:**
- Content validation and filtering
- Fact-checking integration
- Appropriate language enforcement
- SEO optimization

### 🎙️ Advanced Speech Synthesis

**Voice Options:**
- Male/Female narrators
- Sports commentator styles
- Documentary voices
- Regional accents (US, UK, AU)

**Speech Enhancement:**
- SSML markup support
- Emphasis and pause control
- Speed and pitch adjustment
- Natural pronunciation

**Audio Processing:**
- High-quality MP3 output
- Optimized compression
- Noise reduction
- Volume normalization

### 🎬 Video Generation

**Visual Processing:**
- Celebrity image integration
- Dynamic background generation
- Text overlay support
- Thumbnail creation

**Format Support:**
- 720p and 1080p resolution
- MP4 output format
- Mobile-optimized encoding
- Subtitle integration

**Performance Optimization:**
- Efficient processing pipeline
- Parallel task execution
- Resource management
- Quality control

## API Endpoints

### Video Generation

#### Start Generation
```http
POST /api/generate
Content-Type: application/json

{
  "celebrityId": "celebrity_123",
  "duration": 60,
  "voiceType": "SPORTS_COMMENTATOR",
  "voiceRegion": "US",
  "style": "energetic",
  "quality": "1080p",
  "priority": 3,
  "useQueue": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "job_1234567890_abc123",
    "status": "queued",
    "message": "Video generation job added to queue",
    "estimatedWaitTime": 120000
  }
}
```

#### Check Status
```http
GET /api/generate/status?jobId=job_1234567890_abc123
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "job_1234567890_abc123",
    "status": "processing",
    "progress": {
      "stage": "speech",
      "progress": 45,
      "message": "Synthesizing speech...",
      "estimatedTimeRemaining": 75
    }
  }
}
```

#### Cancel Generation
```http
DELETE /api/generate?jobId=job_1234567890_abc123
```

### Queue Management

#### Get Queue Status
```http
GET /api/generate/queue?status=active&limit=10
```

#### Queue Actions
```http
POST /api/generate/queue
Content-Type: application/json

{
  "action": "pause"
}
```

### Health Monitoring

#### AI Services Health
```http
GET /api/health/ai
```

**Response:**
```json
{
  "overall": "healthy",
  "responseTime": 1250,
  "services": {
    "openai": {
      "status": "healthy",
      "details": {
        "responseTime": 800,
        "model": "gpt-4-turbo-preview"
      }
    },
    "polly": {
      "status": "healthy",
      "details": {
        "responseTime": 450,
        "availableVoices": 12
      }
    }
  }
}
```

## React Integration

### useVideoGeneration Hook

```typescript
import { useVideoGeneration } from '@/hooks/use-video-generation';

function VideoGenerator() {
  const { 
    generateVideo, 
    isGenerating, 
    progress, 
    result, 
    error,
    cancelGeneration 
  } = useVideoGeneration({
    onProgress: (progress) => {
      console.log(`${progress.stage}: ${progress.progress}%`);
    },
    onSuccess: (result) => {
      console.log('Video generated:', result.videoUrl);
    },
    onError: (error) => {
      console.error('Generation failed:', error);
    },
  });

  const handleGenerate = async () => {
    await generateVideo({
      celebrityId: 'lebron-james',
      duration: 60,
      voiceType: 'SPORTS_COMMENTATOR',
      style: 'energetic',
    });
  };

  return (
    <div>
      <button onClick={handleGenerate} disabled={isGenerating}>
        {isGenerating ? 'Generating...' : 'Generate Video'}
      </button>
      
      {isGenerating && (
        <div>
          <div>Stage: {progress?.stage}</div>
          <div>Progress: {progress?.progress}%</div>
          <div>Message: {progress?.message}</div>
          <button onClick={cancelGeneration}>Cancel</button>
        </div>
      )}
      
      {result && (
        <div>
          <h3>{result.title}</h3>
          <video src={result.videoUrl} controls />
          <p>{result.description}</p>
          <div>Hashtags: {result.hashtags.join(' ')}</div>
        </div>
      )}
      
      {error && <div>Error: {error}</div>}
    </div>
  );
}
```

### Multiple Generation Management

```typescript
import { useMultipleVideoGeneration } from '@/hooks/use-video-generation';

function BatchGenerator() {
  const { 
    generations, 
    addGeneration, 
    startGeneration,
    isAnyGenerating 
  } = useMultipleVideoGeneration();

  const handleAddGeneration = (celebrity: Celebrity) => {
    const id = `gen_${Date.now()}`;
    addGeneration(id, {
      celebrityId: celebrity.id,
      duration: 60,
      voiceType: 'MALE_NARRATOR',
    });
  };

  return (
    <div>
      <h2>Batch Video Generation</h2>
      {generations.map(gen => (
        <div key={gen.id}>
          <h3>{gen.request.celebrity.name}</h3>
          <div>Status: {gen.isGenerating ? 'Processing' : 'Pending'}</div>
          {gen.progress && (
            <div>Progress: {gen.progress.progress}%</div>
          )}
          {!gen.isGenerating && !gen.result && (
            <button onClick={() => startGeneration(gen.id)}>
              Start Generation
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
```

## Configuration

### Environment Variables

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-...
OPENAI_ORGANIZATION_ID=org-...

# AWS Configuration (for Polly)
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1

# Generation Settings
AI_MAX_RETRIES=3
AI_TIMEOUT=60000
QUEUE_MAX_CONCURRENCY=3
QUEUE_MAX_RETRIES=3
```

### AI Model Configuration

```typescript
// src/lib/openai-config.ts
export const AI_CONFIG = {
  MODELS: {
    TEXT_GENERATION: 'gpt-4-turbo-preview',
    TEXT_GENERATION_FAST: 'gpt-3.5-turbo',
  },
  GENERATION: {
    MAX_TOKENS: 2000,
    TEMPERATURE: 0.7,
    TOP_P: 0.9,
  },
  SCRIPT: {
    MIN_DURATION: 15,
    MAX_DURATION: 120,
    TARGET_WPM: 150,
  },
};
```

### Voice Configuration

```typescript
// src/lib/polly-config.ts
export const POLLY_CONFIG = {
  VOICES: {
    MALE_NARRATOR: {
      US: { id: 'Matthew', engine: 'neural' },
      UK: { id: 'Brian', engine: 'neural' },
      AU: { id: 'Russell', engine: 'neural' },
    },
    SPORTS_COMMENTATOR: {
      US: { id: 'Justin', engine: 'neural' },
      UK: { id: 'Brian', engine: 'neural' },
    },
  },
};
```

## Performance Optimization

### Queue Management

**Concurrency Control:**
- Maximum 3 concurrent generations
- Priority-based scheduling
- Resource allocation optimization
- Automatic load balancing

**Retry Logic:**
- Exponential backoff strategy
- Intelligent error classification
- Selective retry conditions
- Maximum attempt limits

**Progress Tracking:**
- Real-time status updates
- Stage-based progress reporting
- Time estimation algorithms
- User notification system

### Caching Strategy

**Script Caching:**
- Similar request detection
- Template-based optimization
- Celebrity-specific caching
- TTL-based invalidation

**Voice Caching:**
- Audio segment reuse
- Voice model optimization
- Regional voice caching
- Quality-based storage

**Resource Management:**
- Memory usage optimization
- Temporary file cleanup
- Connection pooling
- Rate limit management

## Error Handling

### Error Classification

**User Errors:**
- Invalid parameters
- Missing celebrity data
- Quota exceeded
- Permission denied

**System Errors:**
- Service unavailable
- Processing timeout
- Resource exhaustion
- Internal failures

**External Errors:**
- OpenAI API failures
- Polly service issues
- Network connectivity
- Rate limit exceeded

### Recovery Strategies

**Automatic Retry:**
- Transient error detection
- Exponential backoff
- Circuit breaker pattern
- Fallback mechanisms

**Graceful Degradation:**
- Reduced quality options
- Alternative voice selection
- Simplified processing
- User notification

**Error Reporting:**
- Detailed error logging
- User-friendly messages
- Support ticket integration
- Performance monitoring

## Monitoring & Analytics

### Performance Metrics

**Generation Metrics:**
- Success/failure rates
- Average processing time
- Queue wait times
- Resource utilization

**Quality Metrics:**
- Script validation scores
- Audio quality ratings
- Video processing metrics
- User satisfaction

**Cost Metrics:**
- OpenAI token usage
- Polly character costs
- Storage expenses
- Processing overhead

### Health Monitoring

**Service Health:**
- API availability checks
- Response time monitoring
- Error rate tracking
- Capacity planning

**System Health:**
- CPU and memory usage
- Disk space monitoring
- Network performance
- Database health

**Alert System:**
- Threshold-based alerts
- Escalation procedures
- Notification channels
- Recovery automation

## Best Practices

### Content Quality

1. **Script Validation:**
   - Fact-checking integration
   - Appropriate content filtering
   - Grammar and style checking
   - SEO optimization

2. **Voice Selection:**
   - Celebrity-appropriate voices
   - Regional preference matching
   - Quality consistency
   - Performance optimization

3. **Video Quality:**
   - Resolution optimization
   - Compression efficiency
   - Loading performance
   - Mobile compatibility

### Performance

1. **Resource Management:**
   - Efficient memory usage
   - Connection pooling
   - Temporary file cleanup
   - Rate limit compliance

2. **Scalability:**
   - Horizontal scaling support
   - Load balancing
   - Database optimization
   - Caching strategies

3. **Reliability:**
   - Error handling
   - Retry mechanisms
   - Monitoring systems
   - Backup procedures

This AI video generation system provides enterprise-grade capabilities for creating engaging sports content at scale, with robust error handling, comprehensive monitoring, and optimized performance for high-traffic applications.
