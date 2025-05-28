# Vercel Deployment Guide

This guide will walk you through the process of deploying your AI Video Generation project to Vercel from scratch.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Project Setup](#project-setup)
3. [Environment Configuration](#environment-configuration)
4. [Database Setup](#database-setup)
5. [AWS S3 Configuration](#aws-s3-configuration)
6. [Vercel Deployment](#vercel-deployment)
7. [Post-Deployment](#post-deployment)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

Before starting the deployment process, ensure you have:

- A [GitHub](https://github.com) account
- A [Vercel](https://vercel.com) account
- An [AWS](https://aws.amazon.com) account (for S3)
- A database provider (e.g., [Vercel Postgres](https://vercel.com/storage/postgres) or [PlanetScale](https://planetscale.com))

## Project Setup

1. **Clone and Prepare Your Repository**
   ```bash
   git clone <your-repository-url>
   cd <your-project-directory>
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Create Required Configuration Files**

   Create a `vercel.json` file in your project root:
   ```json
   {
     "version": 2,
     "buildCommand": "prisma generate && next build",
     "installCommand": "npm install",
     "framework": "nextjs",
     "regions": ["iad1"],
     "env": {
       "NODE_ENV": "production"
     }
   }
   ```

## Environment Configuration

1. **Create Environment Variables File**
   Create a `.env` file in your project root:
   ```env
   # Database
   DATABASE_URL="your-database-connection-string"

   # AWS Configuration
   AWS_ACCESS_KEY_ID="your-aws-access-key"
   AWS_SECRET_ACCESS_KEY="your-aws-secret-key"
   AWS_REGION="your-aws-region"
   AWS_S3_BUCKET="your-bucket-name"

   # Application
   NEXTAUTH_URL="your-production-url"
   NEXTAUTH_SECRET="your-nextauth-secret"

   # Optional: Analytics
   ANALYTICS_ID="your-analytics-id"
   ```

2. **Update Next.js Configuration**
   Modify your `next.config.js` to include production settings:
   ```javascript
   const nextConfig = {
     // ... existing config ...
     
     api: {
       responseLimit: '8mb',
     },
     
     images: {
       domains: [
         'localhost',
         's3.amazonaws.com',
         'your-bucket-name.s3.amazonaws.com',
         'your-production-domain.com',
       ],
     },
   };
   ```

## Database Setup

1. **Choose a Database Provider**
   - Option 1: Vercel Postgres
     - Go to Vercel Dashboard → Storage → Create Database
     - Choose Postgres
     - Select your preferred region
     - Note down the connection string

   - Option 2: PlanetScale
     - Create a new database
     - Get the connection string
     - Enable Prisma support

2. **Run Database Migrations**
   ```bash
   npx prisma generate
   npx prisma migrate deploy
   ```

## AWS S3 Configuration

1. **Create an S3 Bucket**
   - Go to AWS Console → S3
   - Create a new bucket
   - Enable CORS:
   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
       "AllowedOrigins": ["*"],
       "ExposeHeaders": []
     }
   ]
   ```

2. **Create IAM User**
   - Go to AWS Console → IAM
   - Create a new user with programmatic access
   - Attach the following policy:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:PutObject",
           "s3:GetObject",
           "s3:DeleteObject",
           "s3:ListBucket"
         ],
         "Resource": [
           "arn:aws:s3:::your-bucket-name",
           "arn:aws:s3:::your-bucket-name/*"
         ]
       }
     ]
   }
   ```

## Vercel Deployment

1. **Connect to Vercel**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository

2. **Configure Project Settings**
   - Framework Preset: Next.js
   - Build Command: `prisma generate && next build`
   - Output Directory: `.next`
   - Install Command: `npm install`

3. **Set Environment Variables**
   In Vercel Dashboard → Project Settings → Environment Variables, add:
   - All variables from your `.env` file
   - Production-specific variables

4. **Deploy**
   - Click "Deploy"
   - Wait for the build process to complete
   - Note down your production URL

## Post-Deployment

1. **Verify Deployment**
   - Check if the application is accessible
   - Test all API routes
   - Verify video generation functionality
   - Test database connections
   - Check S3 uploads

2. **Set Up Monitoring**
   - Enable Vercel Analytics
   - Set up error tracking
   - Configure performance monitoring

3. **Configure Custom Domain**
   - Go to Vercel Dashboard → Project Settings → Domains
   - Add your custom domain
   - Configure DNS settings
   - Enable HTTPS

## Troubleshooting

### Common Issues and Solutions

1. **Build Failures**
   - Check build logs in Vercel Dashboard
   - Verify all dependencies are in `package.json`
   - Ensure environment variables are set correctly

2. **Database Connection Issues**
   - Verify DATABASE_URL is correct
   - Check database provider's status
   - Ensure IP allowlist includes Vercel's IPs

3. **S3 Upload Failures**
   - Verify AWS credentials
   - Check bucket permissions
   - Ensure CORS is configured correctly

4. **API Route Issues**
   - Check function timeout settings
   - Verify response size limits
   - Monitor serverless function logs

### Getting Help

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3)

## Maintenance

1. **Regular Updates**
   - Keep dependencies updated
   - Monitor for security patches
   - Update environment variables as needed

2. **Backup Strategy**
   - Regular database backups
   - S3 bucket versioning
   - Environment variable backups

3. **Performance Monitoring**
   - Monitor API response times
   - Track resource usage
   - Optimize as needed

## Security Considerations

1. **Environment Variables**
   - Never commit `.env` files
   - Rotate secrets regularly
   - Use different values for development and production

2. **API Security**
   - Implement rate limiting
   - Use proper authentication
   - Enable CORS protection

3. **Data Protection**
   - Encrypt sensitive data
   - Implement proper access controls
   - Regular security audits

---

For additional support or questions, please refer to the project's documentation or create an issue in the repository. 