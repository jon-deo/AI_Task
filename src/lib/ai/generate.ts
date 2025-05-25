import OpenAI from 'openai';
import { PollyClient, StartSpeechSynthesisTaskCommand } from '@aws-sdk/client-polly';
import { s3Client } from '../aws/config';

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
  const prompt = `Create a short, engaging script about ${celebrity}'s sports career highlights. Focus on their most memorable moments, achievements, and impact on the sport. Keep it concise and engaging, suitable for a 30-second video.`;

  const completion = await openai.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "gpt-4",
    max_tokens: 150,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Failed to generate script content');
  }
  return content;
}

export async function generateSpeech(text: string) {
  const command = new StartSpeechSynthesisTaskCommand({
    Text: text,
    OutputFormat: 'mp3',
    VoiceId: 'Matthew',
    OutputS3BucketName: process.env.AWS_S3_BUCKET,
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