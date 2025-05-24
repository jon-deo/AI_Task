# AWS S3 Integration Documentation

## Overview

The Sports Celebrity Reels application uses AWS S3 for scalable video and image storage, with CloudFront CDN for optimal global content delivery. This integration is designed to handle high traffic loads and provide sub-second video loading times.

## Architecture

### Storage Structure
```
sports-celebrity-reels-bucket/
├── videos/           # Processed video files
├── thumbnails/       # Video thumbnails (multiple sizes)
├── images/           # Celebrity photos and other images
├── temp/             # Temporary files (auto-deleted after 24h)
└── processed/        # AI-generated content
```

### CDN Integration
- **CloudFront Distribution** for global content delivery
- **Edge Locations** for reduced latency worldwide
- **Intelligent Caching** with content-type specific policies
- **Automatic Compression** for bandwidth optimization

## Features

### 🚀 High-Performance Upload
- **Multipart Upload** for files > 5MB
- **Presigned URLs** for direct browser-to-S3 uploads
- **Progress Tracking** with real-time updates
- **Concurrent Upload** support with rate limiting

### 📊 Intelligent Processing
- **Automatic Thumbnail Generation** from videos
- **Multiple Image Formats** (JPEG, WebP, PNG)
- **Responsive Image Sizes** for different devices
- **Video Metadata Extraction** (duration, resolution, bitrate)

### 🔒 Security & Access Control
- **Public Read Access** for media files
- **Private Upload Endpoints** with authentication
- **CORS Configuration** for web browser access
- **Bucket Policies** for fine-grained permissions

### ♻️ Cost Optimization
- **Lifecycle Policies** for automatic storage class transitions
- **Temporary File Cleanup** (24-hour retention)
- **Old Version Management** (30-day retention)
- **Incomplete Upload Cleanup** (7-day cleanup)

## Setup Instructions

### 1. AWS Configuration
```bash
# Set environment variables
export AWS_ACCESS_KEY_ID="your_access_key"
export AWS_SECRET_ACCESS_KEY="your_secret_key"
export AWS_REGION="us-east-1"
export AWS_S3_BUCKET_NAME="sports-celebrity-reels"
```

### 2. Bucket Setup
```bash
# Run automated setup script
npm run aws:setup

# Or manually configure using AWS CLI
aws s3 mb s3://sports-celebrity-reels --region us-east-1
```

### 3. CloudFront Setup (Optional but Recommended)
```bash
# Create CloudFront distribution
aws cloudfront create-distribution --distribution-config file://cloudfront-config.json
```

## API Endpoints

### Upload Endpoints

#### Direct Upload
```http
POST /api/upload
Content-Type: multipart/form-data

file: [File]
```

**Response:**
```json
{
  "success": true,
  "data": {
    "type": "video",
    "video": {
      "key": "videos/1234567890_abc123_video.mp4",
      "url": "https://bucket.s3.amazonaws.com/videos/...",
      "cloudFrontUrl": "https://cdn.domain.com/videos/..."
    },
    "thumbnail": {
      "key": "thumbnails/1234567890_abc123_thumb.jpg",
      "url": "https://bucket.s3.amazonaws.com/thumbnails/...",
      "cloudFrontUrl": "https://cdn.domain.com/thumbnails/..."
    },
    "metadata": {
      "duration": 60,
      "resolution": "1920x1080",
      "bitrate": "1000k",
      "format": "mp4",
      "size": 15728640
    }
  }
}
```

#### Presigned URL Upload
```http
GET /api/upload/presigned?filename=video.mp4&contentType=video/mp4&fileSize=15728640&folder=VIDEOS
```

**Response:**
```json
{
  "success": true,
  "data": {
    "uploadUrl": "https://bucket.s3.amazonaws.com/...",
    "key": "videos/1234567890_abc123_video.mp4",
    "fields": {
      "Content-Type": "video/mp4",
      "Cache-Control": "public, max-age=31536000, immutable"
    },
    "expiresIn": 3600
  }
}
```

### Download Endpoints

#### Get File URL
```http
GET /api/download?key=videos/1234567890_abc123_video.mp4
```

#### Stream File
```http
POST /api/download/stream
Content-Type: application/json

{
  "key": "videos/1234567890_abc123_video.mp4"
}
```

### Health Check
```http
GET /api/health/aws
```

## React Hooks

### useFileUpload Hook
```typescript
import { useFileUpload } from '@/hooks/use-file-upload';

function VideoUploader() {
  const { upload, isUploading, progress, error, result } = useFileUpload({
    onProgress: (progress) => console.log(`${progress.percentage}%`),
    onSuccess: (result) => console.log('Upload successful:', result),
    onError: (error) => console.error('Upload failed:', error),
  });

  const handleFileSelect = async (file: File) => {
    await upload(file);
  };

  return (
    <div>
      <input type="file" onChange={(e) => handleFileSelect(e.target.files[0])} />
      {isUploading && <div>Progress: {progress?.percentage}%</div>}
      {error && <div>Error: {error}</div>}
      {result && <div>Success! Video URL: {result.video?.cloudFrontUrl}</div>}
    </div>
  );
}
```

### Multiple File Upload
```typescript
import { useMultipleFileUpload } from '@/hooks/use-file-upload';

function MultipleUploader() {
  const { uploads, addUpload, uploadAll, isUploading } = useMultipleFileUpload();

  const handleFilesSelect = (files: FileList) => {
    Array.from(files).forEach(file => addUpload(file));
  };

  return (
    <div>
      <input 
        type="file" 
        multiple 
        onChange={(e) => handleFilesSelect(e.target.files)} 
      />
      <button onClick={uploadAll} disabled={isUploading}>
        Upload All ({uploads.length} files)
      </button>
      {uploads.map(upload => (
        <div key={upload.id}>
          {upload.file.name}: {upload.progress?.percentage || 0}%
        </div>
      ))}
    </div>
  );
}
```

## Service Classes

### S3Service
```typescript
import { S3Service } from '@/services/s3';

// Upload file
const result = await S3Service.uploadFile(buffer, {
  folder: 'VIDEOS',
  filename: 'video.mp4',
  contentType: 'video/mp4',
});

// Generate presigned URL
const presignedUrl = await S3Service.generatePresignedUploadUrl({
  folder: 'VIDEOS',
  filename: 'video.mp4',
  contentType: 'video/mp4',
});

// Delete file
await S3Service.deleteFile('videos/video.mp4');
```

### VideoProcessingService
```typescript
import { VideoProcessingService } from '@/services/video-processing';

// Process and upload video with thumbnail
const result = await VideoProcessingService.processAndUploadVideo(
  videoBuffer,
  'video.mp4',
  {
    generateThumbnail: true,
    compressionLevel: 'medium',
  }
);

// Process and upload image
const imageResult = await VideoProcessingService.processAndUploadImage(
  imageBuffer,
  'image.jpg',
  {
    resize: { width: 1920, height: 1080 },
    quality: 85,
    generateWebP: true,
  }
);
```

### CloudFrontService
```typescript
import { CloudFrontService } from '@/services/cloudfront';

// Invalidate cache
const invalidation = await CloudFrontService.createInvalidation(
  'DISTRIBUTION_ID',
  { paths: ['/videos/video.mp4'] }
);

// Get CloudFront URL
const cdnUrl = CloudFrontService.getCloudFrontUrl('videos/video.mp4');
```

## Performance Optimizations

### Caching Strategy
- **Videos**: 1 year cache (immutable content)
- **Thumbnails**: 30 days cache
- **Images**: 30 days cache
- **Temporary files**: 1 hour cache

### Upload Optimization
- **Multipart uploads** for files > 5MB
- **Concurrent part uploads** (max 3 simultaneous)
- **Retry logic** with exponential backoff
- **Progress tracking** for user feedback

### Download Optimization
- **CloudFront edge locations** for global delivery
- **Gzip compression** for text-based metadata
- **Range requests** for video streaming
- **Intelligent caching** based on content type

## Monitoring & Analytics

### Health Checks
```bash
# Check AWS services health
npm run aws:health

# Comprehensive test
curl -X POST http://localhost:3000/api/health/aws/test \
  -H "Content-Type: application/json" \
  -d '{"includeUploadTest": true, "includeDownloadTest": true}'
```

### Metrics Tracked
- Upload success/failure rates
- Average upload times
- File size distributions
- CDN cache hit rates
- Error rates by operation type

## Security Best Practices

### Access Control
- **IAM roles** with minimal required permissions
- **Bucket policies** for public read access only
- **CORS configuration** for allowed origins
- **Presigned URL expiration** (1 hour default)

### Data Protection
- **Server-side encryption** (AES-256)
- **In-transit encryption** (HTTPS only)
- **Access logging** for audit trails
- **Versioning** for data recovery

## Cost Management

### Storage Classes
- **Standard**: Active content (0-30 days)
- **Standard-IA**: Older content (30-90 days)
- **Glacier**: Archive content (90+ days)

### Lifecycle Policies
- Temporary files deleted after 24 hours
- Old versions deleted after 30 days
- Incomplete uploads cleaned after 7 days
- Automatic storage class transitions

## Troubleshooting

### Common Issues

#### Upload Failures
```bash
# Check bucket permissions
aws s3api get-bucket-policy --bucket sports-celebrity-reels

# Test upload manually
aws s3 cp test-file.txt s3://sports-celebrity-reels/temp/
```

#### CORS Errors
```bash
# Update CORS configuration
aws s3api put-bucket-cors --bucket sports-celebrity-reels --cors-configuration file://cors.json
```

#### CloudFront Issues
```bash
# Check distribution status
aws cloudfront get-distribution --id DISTRIBUTION_ID

# Create invalidation
aws cloudfront create-invalidation --distribution-id DISTRIBUTION_ID --paths "/*"
```

### Error Codes
- **403 Forbidden**: Check bucket policy and IAM permissions
- **404 Not Found**: Verify bucket name and region
- **413 Payload Too Large**: File exceeds size limits
- **429 Too Many Requests**: Rate limiting in effect

## Production Deployment

### Environment Variables
```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=sports-celebrity-reels-prod
AWS_CLOUDFRONT_DOMAIN=cdn.yourdomain.com
```

### Scaling Considerations
- **Multiple buckets** for different regions
- **Cross-region replication** for disaster recovery
- **CloudFront distributions** per region
- **Load balancing** for upload endpoints

This integration provides enterprise-grade file storage and delivery capabilities, designed to handle the scale and performance requirements of a platform serving 30M+ monthly users.
