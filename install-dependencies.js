#!/usr/bin/env node

/**
 * Installation script for Sports Celebrity Reels
 * This script installs all required dependencies and sets up the project
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Sports Celebrity Reels...\n');

// Check if package.json exists
if (!fs.existsSync('package.json')) {
  console.error('❌ package.json not found. Please run this script from the project root.');
  process.exit(1);
}

try {
  // Install dependencies
  console.log('📦 Installing dependencies...');
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ Dependencies installed successfully!\n');

  // Generate Prisma types (if Prisma is configured)
  if (fs.existsSync('prisma/schema.prisma')) {
    console.log('🔧 Generating Prisma types...');
    try {
      execSync('npx prisma generate', { stdio: 'inherit' });
      console.log('✅ Prisma types generated successfully!\n');
    } catch (error) {
      console.log('⚠️  Prisma generation skipped (database not configured yet)\n');
    }
  }

  // Create .env.local if it doesn't exist
  if (!fs.existsSync('.env.local')) {
    console.log('📝 Creating .env.local file...');
    const envContent = `# Sports Celebrity Reels Environment Variables
# Copy this file to .env.local and fill in your values

# Database
DATABASE_URL="postgresql://username:password@localhost:5432/sports_reels"

# AWS S3
AWS_ACCESS_KEY_ID="your_aws_access_key"
AWS_SECRET_ACCESS_KEY="your_aws_secret_key"
AWS_REGION="us-east-1"
AWS_S3_BUCKET="sports-reels-bucket"

# OpenAI
OPENAI_API_KEY="your_openai_api_key"

# Next.js
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Rate Limiting
UPSTASH_REDIS_REST_URL="your_redis_url"
UPSTASH_REDIS_REST_TOKEN="your_redis_token"
`;
    fs.writeFileSync('.env.local', envContent);
    console.log('✅ .env.local created successfully!\n');
  }

  console.log('🎉 Setup complete! Next steps:\n');
  console.log('1. Configure your environment variables in .env.local');
  console.log('2. Set up your database and run: npx prisma db push');
  console.log('3. Start the development server: npm run dev');
  console.log('\n📚 See SETUP_INSTRUCTIONS.md for detailed setup guide');
  console.log('\n🚀 Ready to build amazing sports reels!');

} catch (error) {
  console.error('❌ Installation failed:', error.message);
  console.log('\n🔧 Manual installation steps:');
  console.log('1. Run: npm install');
  console.log('2. Run: npx prisma generate');
  console.log('3. Configure .env.local with your environment variables');
  console.log('4. Run: npm run dev');
  process.exit(1);
}
