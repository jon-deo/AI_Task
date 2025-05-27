# CloudFront 403 Forbidden Error Fix

## Problem Description

You're experiencing a **403 Forbidden** error when trying to access videos through CloudFront:

```
Request URL: https://d2vakxa9lbd2lr.cloudfront.net/videos/video_1748260179305_g3x3ez6tykn.mp4
Status Code: 403 Forbidden
```

## Root Cause

The issue is caused by incorrect S3 bucket policy configuration. Your current S3 bucket policy only allows access from your AWS account root, but CloudFront needs specific permissions to serve files publicly.

## Solution Overview

We need to:

1. **Update S3 bucket policy** to allow CloudFront and public access for media files
2. **Configure CloudFront distribution** with proper Origin Access Control (OAC)
3. **Update environment variables** with the correct CloudFront domain

## Quick Fix (Recommended)

### Step 1: Fix S3 Bucket Policy

Run this command to update your S3 bucket policy:

```bash
npm run aws:fix-policy
```

This will:
- Allow CloudFront service principal access
- Enable public read access for videos, thumbnails, and images
- Keep other folders private
- Maintain your existing authenticated access

### Step 2: Set Up CloudFront Distribution

If you don't have a CloudFront distribution yet:

```bash
npm run aws:setup-cloudfront
```

Or if you want to wait for deployment to complete:

```bash
npm run aws:setup-cloudfront-wait
```

### Step 3: Update Environment Variables

After CloudFront setup, update your `.env.local` file:

```env
AWS_CLOUDFRONT_DOMAIN="your-new-cloudfront-domain.cloudfront.net"
```

## Manual Fix (Alternative)

If you prefer to fix this manually through AWS Console:

### 1. Update S3 Bucket Policy

Go to AWS S3 Console → Your Bucket → Permissions → Bucket Policy and replace with:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowAuthenticatedAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::556840369454:root"
      },
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::essentially-sports-task",
        "arn:aws:s3:::essentially-sports-task/*"
      ]
    },
    {
      "Sid": "AllowCloudFrontServicePrincipal",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::essentially-sports-task/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceAccount": "556840369454"
        }
      }
    },
    {
      "Sid": "AllowPublicReadForMediaFiles",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": [
        "arn:aws:s3:::essentially-sports-task/videos/*",
        "arn:aws:s3:::essentially-sports-task/thumbnails/*",
        "arn:aws:s3:::essentially-sports-task/images/*"
      ]
    }
  ]
}
```

### 2. Update Public Access Block

In S3 Console → Your Bucket → Permissions → Block public access:

- ✅ Block public ACLs
- ✅ Ignore public ACLs  
- ❌ Block public bucket policies (UNCHECK)
- ❌ Restrict public buckets (UNCHECK)

### 3. CloudFront Distribution Setup

If you need to create a CloudFront distribution manually:

1. Go to CloudFront Console → Create Distribution
2. **Origin Domain**: `essentially-sports-task.s3.eu-north-1.amazonaws.com`
3. **Origin Access**: Origin Access Control (OAC)
4. **Viewer Protocol Policy**: Redirect HTTP to HTTPS
5. **Cache Behaviors**:
   - `videos/*`: Cache for 1 year
   - `thumbnails/*`: Cache for 30 days
   - `images/*`: Cache for 30 days

## Testing the Fix

### 1. Test Direct S3 Access

```bash
curl -I https://essentially-sports-task.s3.eu-north-1.amazonaws.com/videos/your-video.mp4
```

Should return `200 OK` for existing videos.

### 2. Test CloudFront Access

```bash
curl -I https://your-cloudfront-domain.cloudfront.net/videos/your-video.mp4
```

Should return `200 OK` after CloudFront deployment completes.

### 3. Test in Browser

Open your application and check if videos load without 403 errors.

## Troubleshooting

### Still Getting 403 Errors?

1. **Check CloudFront deployment status**:
   - Go to CloudFront Console
   - Ensure distribution status is "Deployed"
   - This can take 10-15 minutes

2. **Verify S3 bucket policy**:
   ```bash
   aws s3api get-bucket-policy --bucket essentially-sports-task
   ```

3. **Check file existence**:
   ```bash
   aws s3 ls s3://essentially-sports-task/videos/
   ```

4. **Clear CloudFront cache**:
   ```bash
   aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"
   ```

### Common Issues

- **"Access Denied" in S3**: Public access block settings are too restrictive
- **"Distribution not found"**: CloudFront distribution hasn't finished deploying
- **"Origin not accessible"**: S3 bucket policy doesn't allow CloudFront access

## Security Notes

This configuration:
- ✅ Allows public read access only for media files (videos, thumbnails, images)
- ✅ Keeps temp and other folders private
- ✅ Maintains full authenticated access for your application
- ✅ Uses CloudFront for better performance and security

## Next Steps

After fixing the 403 error:

1. **Monitor CloudFront metrics** in AWS Console
2. **Set up custom domain** (optional) for branded URLs
3. **Configure CloudFront security headers** for additional protection
4. **Set up CloudFront logging** for analytics

## Support

If you continue experiencing issues:

1. Check AWS CloudTrail logs for detailed error information
2. Verify your AWS credentials have sufficient permissions
3. Ensure your `.env.local` file has the correct CloudFront domain
4. Test with a simple HTML file first before testing videos
