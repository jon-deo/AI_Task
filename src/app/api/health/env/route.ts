import { NextResponse } from 'next/server';

export async function GET() {
  // Only show non-sensitive information
  const envInfo = {
    AWS_REGION: process.env.AWS_REGION,
    AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME,
    NODE_ENV: process.env.NODE_ENV,
    // Check if credentials are set (without showing them)
    AWS_CREDENTIALS_SET: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
  };

  return NextResponse.json(envInfo);
} 