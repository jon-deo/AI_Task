import OpenAI from 'openai';
import { PollyClient, StartSpeechSynthesisTaskCommand } from '@aws-sdk/client-polly';
import { s3Client } from '../aws/config';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

if (!process.env.AWS_REGION) {
  throw new Error('AWS_REGION is not defined');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const pollyClient = new PollyClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function generateCelebrityScript(celebrity: string) {
  // For testing without OpenAI API
  const testScripts = {
    'Michael Jordan': 'Michael Jordan, the greatest basketball player of all time. Six NBA championships, five MVP awards, and countless unforgettable moments. His Airness soared above the competition, redefining what was possible on the court.',
    'Lionel Messi': 'Lionel Messi, the Argentine maestro who revolutionized football. Eight Ballon d\'Or awards, World Cup glory, and mesmerizing skills that left defenders in awe. A true legend of the beautiful game.',
    'Serena Williams': 'Serena Williams, the queen of tennis. 23 Grand Slam singles titles, Olympic gold medals, and a career that inspired generations. Her power, grace, and determination made her one of the greatest athletes ever.'
  };

  // Return test script if available, otherwise a generic one
  return testScripts[celebrity as keyof typeof testScripts] || 
    `${celebrity} is one of the greatest athletes in their sport. Their dedication, skill, and achievements have inspired millions around the world.`;
}

export async function generateSpeech(text: string) {
  const command = new StartSpeechSynthesisTaskCommand({
    Text: text,
    OutputFormat: 'mp3',
    VoiceId: 'Matthew',
    OutputS3BucketName: process.env.AWS_S3_BUCKET_NAME,
    OutputS3KeyPrefix: 'speech/',
  });

  const response = await pollyClient.send(command);
  const outputUri = response.SynthesisTask?.OutputUri;
  if (!outputUri) {
    throw new Error('Failed to get speech output URI');
  }
  return { outputUri };
}

export async function generateVideo(celebrity: string) {
  try {
    // Generate script
    const script = await generateCelebrityScript(celebrity);
    if (!script) throw new Error('Failed to generate script');

    // Generate speech
    const { outputUri } = await generateSpeech(script);
    if (!outputUri) throw new Error('Failed to generate speech');

    return {
      script,
      audioUrl: outputUri,
    };
  } catch (error) {
    console.error('Error generating video:', error);
    throw error;
  }
} 