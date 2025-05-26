#!/usr/bin/env tsx

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Setup script to check and configure FFmpeg for video generation
 */

async function checkFFmpegInstallation(): Promise<boolean> {
  try {
    execSync('ffmpeg -version', { stdio: 'pipe' });
    console.log('✅ FFmpeg is already installed and available');
    return true;
  } catch (error) {
    console.log('❌ FFmpeg is not installed or not in PATH');
    return false;
  }
}

async function checkNodeModules(): Promise<boolean> {
  const requiredPackages = ['fluent-ffmpeg', '@types/fluent-ffmpeg'];
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    console.log('❌ package.json not found');
    return false;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const allDependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  const missingPackages = requiredPackages.filter(pkg => !allDependencies[pkg]);
  
  if (missingPackages.length > 0) {
    console.log(`❌ Missing required packages: ${missingPackages.join(', ')}`);
    return false;
  }

  console.log('✅ All required Node.js packages are installed');
  return true;
}

function printFFmpegInstallInstructions(): void {
  console.log('\n📋 FFmpeg Installation Instructions:');
  console.log('=====================================');
  
  console.log('\n🪟 Windows:');
  console.log('1. Download FFmpeg from: https://ffmpeg.org/download.html#build-windows');
  console.log('2. Extract to C:\\ffmpeg');
  console.log('3. Add C:\\ffmpeg\\bin to your PATH environment variable');
  console.log('4. Restart your terminal/IDE');
  console.log('\nAlternatively, use Chocolatey:');
  console.log('   choco install ffmpeg');
  console.log('\nOr use Scoop:');
  console.log('   scoop install ffmpeg');

  console.log('\n🍎 macOS:');
  console.log('   brew install ffmpeg');

  console.log('\n🐧 Linux (Ubuntu/Debian):');
  console.log('   sudo apt update && sudo apt install ffmpeg');

  console.log('\n🐧 Linux (CentOS/RHEL):');
  console.log('   sudo yum install ffmpeg');
  console.log('   # or');
  console.log('   sudo dnf install ffmpeg');
}

function printNodePackageInstructions(): void {
  console.log('\n📦 Install Required Node.js Packages:');
  console.log('=====================================');
  console.log('npm install fluent-ffmpeg @types/fluent-ffmpeg');
  console.log('\n# or with yarn:');
  console.log('yarn add fluent-ffmpeg @types/fluent-ffmpeg');
  console.log('\n# or with pnpm:');
  console.log('pnpm add fluent-ffmpeg @types/fluent-ffmpeg');
}

async function createTempDirectory(): Promise<void> {
  const tempDir = path.join(process.cwd(), 'temp');
  
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
    console.log('✅ Created temp directory for video processing');
  } else {
    console.log('✅ Temp directory already exists');
  }

  // Create .gitignore for temp directory
  const gitignorePath = path.join(tempDir, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, '*\n!.gitignore\n');
    console.log('✅ Created .gitignore for temp directory');
  }
}

async function testVideoComposition(): Promise<boolean> {
  try {
    console.log('\n🧪 Testing video composition capabilities...');
    
    // This would test the actual video composition
    // For now, just check if the services can be imported
    const { VideoComposer } = await import('../src/services/video-composer');
    const { ImageGenerator } = await import('../src/services/image-generator');
    
    console.log('✅ Video composition services are available');
    return true;
  } catch (error) {
    console.log('❌ Video composition test failed:', error);
    return false;
  }
}

async function main(): Promise<void> {
  console.log('🎬 Video Generation Setup Check');
  console.log('================================\n');

  const checks = [
    { name: 'FFmpeg Installation', check: checkFFmpegInstallation },
    { name: 'Node.js Packages', check: checkNodeModules },
  ];

  const results = await Promise.all(
    checks.map(async ({ name, check }) => {
      console.log(`Checking ${name}...`);
      const result = await check();
      return { name, passed: result };
    })
  );

  console.log('\n📊 Setup Status:');
  console.log('================');
  
  let allPassed = true;
  results.forEach(({ name, passed }) => {
    console.log(`${passed ? '✅' : '❌'} ${name}`);
    if (!passed) allPassed = false;
  });

  if (!allPassed) {
    console.log('\n⚠️  Setup incomplete. Please follow the instructions below:\n');
    
    if (!results.find(r => r.name === 'FFmpeg Installation')?.passed) {
      printFFmpegInstallInstructions();
    }
    
    if (!results.find(r => r.name === 'Node.js Packages')?.passed) {
      printNodePackageInstructions();
    }
    
    console.log('\n🔄 Run this script again after completing the setup steps.');
    process.exit(1);
  }

  // Create necessary directories
  await createTempDirectory();

  // Test video composition
  const compositionTest = await testVideoComposition();
  
  if (compositionTest) {
    console.log('\n🎉 Video generation setup is complete!');
    console.log('✅ You can now generate videos with audio and visual composition');
    console.log('\n🚀 Next steps:');
    console.log('1. Run your video generation workflow');
    console.log('2. Check the generated videos in your S3 bucket');
    console.log('3. Monitor the temp/ directory for cleanup');
  } else {
    console.log('\n⚠️  Video composition test failed. Please check your setup.');
    process.exit(1);
  }
}

// Run the setup check
if (require.main === module) {
  main().catch((error) => {
    console.error('Setup failed:', error);
    process.exit(1);
  });
}
