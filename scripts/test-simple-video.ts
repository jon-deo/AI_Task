#!/usr/bin/env tsx

import axios from 'axios';

const API_BASE = 'http://localhost:3000/api';

async function testSimpleVideoGeneration() {
  console.log('🎬 Testing Simple Video Generation');
  console.log('==================================\n');

  try {
    console.log('1. Testing simple celebrity video generation...');
    
    const response = await axios.post(`${API_BASE}/generate`, {
      celebrity: 'Michael Jordan'
    });

    console.log('✅ Video generation successful!');
    console.log('Response:', JSON.stringify(response.data, null, 2));

    if (response.data.s3Url) {
      console.log('\n🎥 Video URL:', response.data.s3Url);
    }

    if (response.data.metadata?.thumbnailUrl) {
      console.log('🖼️  Thumbnail URL:', response.data.metadata.thumbnailUrl);
    }

    console.log('\n🎉 Test completed successfully!');
    
  } catch (error: any) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.response?.data?.error) {
      console.error('Error details:', error.response.data.error);
    }
    
    process.exit(1);
  }
}

testSimpleVideoGeneration();
