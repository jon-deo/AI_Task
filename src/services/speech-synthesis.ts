import { PollyClient, SynthesizeSpeechCommand, VoiceId, OutputFormat } from '@aws-sdk/client-polly';
import { s3Client } from '@/lib/aws-config';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import {
  POLLY_CONFIG,
  getVoiceConfig,
  type VoiceRegion,
} from '@/lib/polly-config';
import { VoiceType } from '@/types';
import { S3Service } from '@/services/s3';

export interface SpeechSynthesisRequest {
  text: string;
  voiceType: VoiceType;
  voiceRegion?: VoiceRegion;
  outputFormat?: 'mp3' | 'ogg_vorbis' | 'pcm';
  sampleRate?: string;
  speed?: number;
  pitch?: number;
  volume?: number;
  useSSML?: boolean;
}

export interface SpeechSynthesisResult {
  audioBuffer: Buffer;
  audioUrl: string | undefined;
  s3Key: string | undefined;
  metadata: {
    voiceId: string;
    voiceEngine: string;
    outputFormat: string;
    sampleRate: string;
    duration: number;
    textLength: number;
    ssmlLength?: number;
    synthesisTime: number;
    audioSize: number;
  };
}

export interface BatchSynthesisRequest {
  requests: SpeechSynthesisRequest[];
  uploadToS3?: boolean;
  s3Folder?: 'TEMP' | 'PROCESSED';
  concurrency?: number;
}

export class SpeechSynthesisService {
  private static pollyClient: PollyClient;

  private static getClient(): PollyClient {
    if (!this.pollyClient) {
      this.pollyClient = new PollyClient({
        region: 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });
    }
    return this.pollyClient;
  }

  /**
   * Synthesize speech from text
   */
  static async synthesizeSpeech(
    request: SpeechSynthesisRequest,
    uploadToS3: boolean = true
  ): Promise<SpeechSynthesisResult> {
    try {
      const client = this.getClient();
      const voiceConfig = getVoiceConfig(request.voiceType, request.voiceRegion);
      
      const command = new SynthesizeSpeechCommand({
        Engine: 'neural',
        LanguageCode: 'en-US',
        OutputFormat: 'mp3',
        Text: request.text,
        VoiceId: request.voiceType === VoiceType.MALE_NARRATOR ? 'Matthew' : 'Joanna',
        TextType: 'text',
      });

      const startTime = Date.now();
      const response = await client.send(command);
      
      if (!response.AudioStream) {
        throw new Error('No audio stream received from Polly');
      }

      // Convert the audio stream to a buffer
      const audioArray = await response.AudioStream.transformToByteArray();
      const audioBuffer = Buffer.from(audioArray);
      const endTime = Date.now();

      let audioUrl: string | undefined;
      let s3Key: string | undefined;

      if (uploadToS3) {
        try {
          // Generate a unique filename
          const filename = `voice_${Date.now()}_${Math.random().toString(36).substring(2)}.${request.outputFormat || 'mp3'}`;
          
          // Upload to S3 using S3Service
          const uploadResult = await S3Service.uploadFile(audioBuffer, {
            folder: 'TEMP',
            filename,
            contentType: `audio/${request.outputFormat || 'mp3'}`,
            metadata: {
              voiceType: request.voiceType,
              voiceRegion: request.voiceRegion || 'US',
              textLength: request.text.length.toString(),
              generatedAt: new Date().toISOString(),
            },
          });

          audioUrl = uploadResult.url;
          s3Key = uploadResult.key;
        } catch (uploadError) {
          console.error('Failed to upload audio to S3:', uploadError);
          // Continue without S3 upload - the audio buffer is still available
        }
      }

      // Calculate approximate duration (rough estimate)
      const duration = Math.ceil(request.text.length / 10);

      return {
        audioBuffer,
        audioUrl,
        s3Key,
        metadata: {
          voiceId: voiceConfig.id,
          voiceEngine: voiceConfig.engine,
          outputFormat: request.outputFormat || 'mp3',
          sampleRate: request.sampleRate || '24000',
          duration,
          textLength: request.text.length,
          synthesisTime: endTime - startTime,
          audioSize: audioBuffer.length,
        },
      };
    } catch (error) {
      console.error('Speech synthesis error:', error);
      throw new Error(`Speech synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Synthesize long text by splitting into chunks
   */
  static async synthesizeLongText(
    request: SpeechSynthesisRequest,
    uploadToS3: boolean = true
  ): Promise<{
    chunks: SpeechSynthesisResult[];
    combinedAudioUrl?: string;
    combinedS3Key?: string;
  }> {
    try {
      // Split text into chunks (max 3000 characters per chunk)
      const chunks = request.text.match(/.{1,3000}[.!?]?/g) || [request.text];
      const results: SpeechSynthesisResult[] = [];

      // Synthesize each chunk
      for (const chunk of chunks) {
        const result = await this.synthesizeSpeech({
          ...request,
          text: chunk,
        }, uploadToS3);
        
        // Ensure we have a valid audio buffer
        if (!result.audioBuffer) {
          throw new Error('Failed to generate audio buffer for chunk');
        }
        
        results.push(result);
      }

      // Ensure we have at least one valid result
      if (results.length === 0) {
        throw new Error('No valid speech synthesis results');
      }

      // Always combine the audio buffers
      const validBuffers = results
        .filter(r => r.audioBuffer && r.audioBuffer.length > 0)
        .map(r => r.audioBuffer);

      if (validBuffers.length === 0) {
        throw new Error('No valid audio buffers to combine');
      }

      const combinedBuffer = Buffer.concat(validBuffers);

      // If S3 upload is enabled, try to upload the combined audio
      if (uploadToS3) {
        try {
          const filename = `voice_combined_${Date.now()}_${Math.random().toString(36).substring(2)}.${request.outputFormat || 'mp3'}`;
          
          const uploadResult = await S3Service.uploadFile(combinedBuffer, {
            folder: 'TEMP',
            filename,
            contentType: `audio/${request.outputFormat || 'mp3'}`,
            metadata: {
              voiceType: request.voiceType,
              voiceRegion: request.voiceRegion || 'US',
              textLength: request.text.length.toString(),
              generatedAt: new Date().toISOString(),
              isCombined: 'true',
              chunkCount: chunks.length.toString(),
            },
          });
          
          return {
            chunks: results,
            combinedAudioUrl: uploadResult.url,
            combinedS3Key: uploadResult.key,
          };
        } catch (uploadError) {
          console.error('Failed to upload combined audio to S3:', uploadError);
          // Continue without S3 upload - we still have the combined buffer
        }
      }

      // If we get here, either S3 upload is disabled or it failed
      // Add the combined buffer to the first chunk's result
      if (results.length > 0) {
        results[0].audioBuffer = combinedBuffer;
      }

      return { chunks: results };
    } catch (error) {
      console.error('Long text synthesis error:', error);
      throw new Error(`Long text synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get available voices for a voice type
   */
  static getAvailableVoices(voiceType: VoiceType): Array<{
    region: VoiceRegion;
    voiceId: string;
    engine: string;
  }> {
    const voices = POLLY_CONFIG.VOICES[voiceType];
    return Object.entries(voices).map(([region, config]) => ({
      region: region as VoiceRegion,
      voiceId: config.id,
      engine: config.engine,
    }));
  }

  /**
   * Preview voice with sample text
   */
  static async previewVoice(
    voiceType: VoiceType,
    voiceRegion: VoiceRegion = 'US',
    sampleText: string = 'Hello, this is a preview of the selected voice for your sports reel.'
  ): Promise<Buffer> {
    const request: SpeechSynthesisRequest = {
      text: sampleText,
      voiceType,
      voiceRegion,
      outputFormat: 'mp3',
      useSSML: false,
    };

    const result = await this.synthesizeSpeech(request, false);
    return result.audioBuffer;
  }
}
