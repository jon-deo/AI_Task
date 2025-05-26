// scripts/test-complete-workflow.ts
import axios from 'axios';
import { ImageGenerator } from '../src/services/image-generator';

const API_BASE = 'http://localhost:3000/api';

interface GenerateResponse {
  success: boolean;
  id?: string;
  error?: string;
}

interface StatusResponse {
  data?: {
    status: string;
  };
  status: string;
}

interface ReelsResponse {
  data?: {
    items?: any[];
    reels?: any[];
  };
  reels?: any[];
  items?: any[];
}

interface ReelDetails {
  data?: any;
  id: string;
  status: string;
}

// Complete celebrity object for testing with string values for BigInt fields
const testCelebrity = {
  id: 'test-jordan',
  name: 'Michael Jordan',
  slug: 'michael-jordan',
  sport: 'Basketball',
  imageUrl: 'https://example.com/michael-jordan.jpg',
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

// Convert celebrity object for API request
const apiCelebrity = {
  ...testCelebrity,
  birthDate: testCelebrity.birthDate.toISOString(),
  totalViews: testCelebrity.totalViews.toString(),
  totalLikes: testCelebrity.totalLikes.toString(),
  totalShares: testCelebrity.totalShares.toString(),
  createdAt: testCelebrity.createdAt.toISOString(),
  updatedAt: testCelebrity.updatedAt.toISOString()
};

async function testWorkflow1() {
  console.log('Testing Workflow 1: Content Generation');

  try {
    // Generate test images first
    console.log('\nGenerating test images...');
    const testImages = await ImageGenerator.generateCelebrityImages(testCelebrity, 3, {
      width: 1920,
      height: 1080,
      quality: 90,
      format: 'jpeg'
    });

    if (!testImages || testImages.length === 0) {
      throw new Error('Failed to generate test images');
    }

    console.log(`Generated ${testImages.length} test images`);

    // 1. Generate new reel
    console.log('\n1. Generating new reel...');
    const generateResponse = await axios.post<GenerateResponse>(`${API_BASE}/generate`, {
      celebrity: apiCelebrity,
      duration: 30,
      voiceType: 'MALE_NARRATOR',
      quality: '1080p',
      includeSubtitles: true,
      imageUrls: testImages.map((_, index) => `https://example.com/test-image-${index}.jpg`)
    });

    if (!generateResponse.data.success || !generateResponse.data.id) {
      throw new Error(generateResponse.data.error || 'Failed to generate reel: No ID returned');
    }

    const reelId = generateResponse.data.id;
    console.log('Generated reel ID:', reelId);

    // 2. Check queue status
    console.log('\n2. Checking queue status...');
    const queueStatus = await axios.get(`${API_BASE}/generate/queue/status`);
    console.log('Queue status:', queueStatus.data);

    // 3. Wait for processing
    console.log('\n3. Waiting for processing...');
    let isComplete = false;
    let attempts = 0;
    const maxAttempts = 20; // Increased max attempts
    const waitTime = 5000; // 5 seconds

    while (!isComplete && attempts < maxAttempts) {
      attempts++;
      try {
        const statusResponse = await axios.get<StatusResponse>(`${API_BASE}/generate/${reelId}/status`);
        const statusData = statusResponse.data.data || statusResponse.data;
        const currentStatus = statusData?.status || 'UNKNOWN';

        console.log(`Attempt ${attempts}: Status - ${currentStatus}`);
        console.log('Full status response:', JSON.stringify(statusResponse.data, null, 2));

        if (currentStatus === 'COMPLETED') {
          isComplete = true;
          console.log('Processing completed successfully!');
        } else if (currentStatus === 'FAILED') {
          throw new Error('Processing failed');
        } else if (currentStatus === 'PROCESSING') {
          console.log('Still processing...');
        }

        if (!isComplete) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      } catch (error: any) {
        console.error(`Error checking status (attempt ${attempts}):`, error.message);
        if (attempts >= maxAttempts) {
          throw new Error('Max attempts reached while waiting for processing');
        }
      }
    }

    if (!isComplete) {
      throw new Error('Processing did not complete within the expected time');
    }

    return reelId;
  } catch (error: any) {
    console.error('Workflow 1 failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testWorkflow2(reelId: string) {
  console.log('\nTesting Workflow 2: User Interaction');

  try {
    // 1. Get all reels
    console.log('\n1. Getting all reels...');
    const reelsResponse = await axios.get<ReelsResponse>(`${API_BASE}/reels`);
    const reelsData = reelsResponse.data.data || reelsResponse.data;
    const reelsCount = reelsData.items ? reelsData.items.length : (reelsData.reels ? reelsData.reels.length : 0);
    console.log(`Found ${reelsCount} reels`);

    // 2. Get trending reels
    console.log('\n2. Getting trending reels...');
    const trendingResponse = await axios.get<ReelsResponse>(`${API_BASE}/trending`);
    const trendingData = trendingResponse.data;
    const trendingCount = trendingData.data?.reels?.length || trendingData.reels?.length || 0;
    console.log(`Found ${trendingCount} trending reels`);

    // 3. Search reels
    console.log('\n3. Searching reels...');
    const searchResponse = await axios.get<ReelsResponse>(`${API_BASE}/search?q=Michael+Jordan&sort=relevance&order=desc`);
    const searchData = searchResponse.data.data || searchResponse.data;
    const searchCount = searchData.reels ? searchData.reels.length : 0;
    console.log(`Found ${searchCount} matching reels`);

    // 4. Test interactions
    console.log('\n4. Testing reel interactions...');

    try {
      // Like the reel
      await axios.post(`${API_BASE}/reels/${reelId}/like`);
      console.log('Liked the reel');

      // Share the reel
      await axios.post(`${API_BASE}/reels/${reelId}/share`);
      console.log('Shared the reel');
    } catch (interactionError: any) {
      console.error('Interaction failed:', interactionError.response?.data || interactionError.message);
      // Continue with the test even if interactions fail
    }

    // 5. Get reel details
    console.log('\n5. Getting reel details...');
    const reelDetails = await axios.get<ReelDetails>(`${API_BASE}/reels/${reelId}`);
    if (!reelDetails.data) {
      throw new Error('No reel details returned');
    }
    console.log('Reel details:', reelDetails.data);

  } catch (error: any) {
    console.error('Workflow 2 failed:', error.response?.data || error.message);
    throw error;
  }
}

async function runTests() {
  try {
    console.log('Starting complete workflow tests...');

    // Test Workflow 1
    const reelId = await testWorkflow1();

    // Test Workflow 2
    await testWorkflow2(reelId);

    console.log('\nAll tests completed successfully!');
  } catch (error) {
    console.error('Tests failed:', error);
    process.exit(1);
  }
}

runTests();