#!/usr/bin/env tsx

import { execSync } from 'child_process';
import { VideoGenerationService } from '../src/services/video-generation';
import { VideoComposer } from '../src/services/video-composer';
import { AIScriptGenerationService } from '../src/services/ai-script-generation';
import { SpeechSynthesisService } from '../src/services/speech-synthesis';
import { ImageGenerator } from '../src/services/image-generator';
import { S3Service } from '../src/services/s3';
import { VoiceType, Celebrity } from '../src/types';
import path from 'path';
import fs from 'fs/promises';

async function testFFmpeg(): Promise<void> {
  console.log('🎬 Testing Video Generation Setup');
  console.log('=================================\n');

  // Test 1: Check FFmpeg installation
  console.log('1. Checking FFmpeg installation...');
  try {
    const ffmpegVersion = execSync('ffmpeg -version', { encoding: 'utf8', stdio: 'pipe' });
    console.log('✅ FFmpeg is installed');
    console.log('Version:', ffmpegVersion.split('\n')[0]);
  } catch (error) {
    console.log('❌ FFmpeg is not installed or not in PATH');
    console.log('\n📋 Installation Instructions:');
    console.log('Windows: Download from https://ffmpeg.org/download.html');
    console.log('macOS: brew install ffmpeg');
    console.log('Linux: sudo apt install ffmpeg');
    return;
  }

  // Test 2: Check Node.js packages
  console.log('\n2. Checking Node.js packages...');
  try {
    require('fluent-ffmpeg');
    console.log('✅ fluent-ffmpeg package is available');
  } catch (error) {
    console.log('❌ fluent-ffmpeg package not found');
    console.log('Run: npm install fluent-ffmpeg @types/fluent-ffmpeg');
    return;
  }

  // Test 3: Check our video services
  console.log('\n3. Checking video services...');
  try {
    const { VideoComposer } = await import('../src/services/video-composer');
    const { ImageGenerator } = await import('../src/services/image-generator');
    console.log('✅ Video composition services are available');
  } catch (error) {
    console.log('❌ Video services failed to load:', error);
    return;
  }

  // Test 4: Create temp directory
  console.log('\n4. Setting up temp directory...');
  const fs = await import('fs');
  const path = await import('path');
  
  const tempDir = path.join(process.cwd(), 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
    console.log('✅ Created temp directory');
  } else {
    console.log('✅ Temp directory exists');
  }

  console.log('\n🎉 Video generation setup is ready!');
  console.log('\n🚀 You can now:');
  console.log('1. Generate videos with real FFmpeg composition');
  console.log('2. Create dynamic celebrity images');
  console.log('3. Combine audio with visual slideshows');
  console.log('4. Add subtitles to videos');
  console.log('\n💡 Try running: npm run test:workflows');
}

async function testVideoGeneration() {
  console.log('🧪 Starting video generation test...');

  try {
    // 1. Test temp directory
    console.log('\n1. Testing temp directory...');
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    console.log('✅ Temp directory created/verified');

    // 2. Test FFmpeg
    console.log('\n2. Testing FFmpeg...');
    const ffmpeg = require('fluent-ffmpeg');
    const ffmpegPath = require('ffmpeg-static');
    ffmpeg.setFfmpegPath(ffmpegPath);
    console.log('✅ FFmpeg configured');

    // 3. Test image generation
    console.log('\n3. Testing image generation...');
    const testCelebrity: Celebrity = {
      id: 'test',
      name: 'Michael Jordan',
      slug: 'michael-jordan',
      sport: 'Basketball',
      imageUrl: null,
      biography: 'Legendary basketball player',
      achievements: ['6x NBA Champion', '5x MVP'],
      birthDate: new Date('1963-02-17'),
      nationality: 'USA',
      isActive: false,
      totalViews: BigInt(0),
      totalLikes: BigInt(0),
      totalShares: BigInt(0),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const testImages = await ImageGenerator.generateCelebrityImages(testCelebrity, 1);
    console.log('✅ Test image generated');

    // 4. Test script generation
    console.log('\n4. Testing script generation...');
    const scriptResult = await AIScriptGenerationService.generateScript({
      celebrity: testCelebrity,
      duration: 30,
      voiceType: VoiceType.MALE_NARRATOR,
    });
    console.log('✅ Script generated:', scriptResult.script.substring(0, 100) + '...');

    // 5. Test speech synthesis
    console.log('\n5. Testing speech synthesis...');
    const speechResult = await SpeechSynthesisService.synthesizeLongText({
      text: scriptResult.script,
      voiceType: VoiceType.MALE_NARRATOR,
      voiceRegion: 'US',
      outputFormat: 'mp3',
    });
    console.log('✅ Speech synthesized');

    if (!speechResult.chunks[0]?.audioBuffer) {
      throw new Error('No audio buffer generated from speech synthesis');
    }

    // 6. Test video composition
    console.log('\n6. Testing video composition...');
    const videoResult = await VideoComposer.composeVideo({
      audioBuffer: speechResult.chunks[0].audioBuffer,
      images: testImages,
      duration: 30,
      resolution: '1080p',
      script: scriptResult.script,
      includeSubtitles: true,
    });
    console.log('✅ Video composed');

    // 7. Test S3 upload
    console.log('\n7. Testing S3 upload...');
    const s3Result = await S3Service.uploadFile(
      videoResult.videoBuffer,
      {
        folder: 'VIDEOS',
        filename: 'test-video.mp4',
        contentType: 'video/mp4'
      }
    );
    console.log('✅ Video uploaded to S3:', s3Result.url);

    console.log('\n🎉 All tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

testFFmpeg().catch(console.error);
testVideoGeneration();
