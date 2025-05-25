import { generateVideo } from '../src/lib/ai/generate';

async function testVideoGeneration() {
  try {
    const celebrity = 'Michael Jordan';
    console.log(`Generating video for ${celebrity}...`);

    const result = await generateVideo(celebrity);
    console.log('Generated video details:');
    console.log('Script:', result.script);
    console.log('Audio URL:', result.audioUrl);

    console.log('Video generation test completed successfully');
  } catch (error) {
    console.error('Error testing video generation:', error);
    process.exit(1);
  }
}

testVideoGeneration(); 