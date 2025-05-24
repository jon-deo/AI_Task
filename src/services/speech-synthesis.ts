import { SynthesizeSpeechCommand } from '@aws-sdk/client-polly';

import {
  pollyClient,
  POLLY_CONFIG,
  getVoiceConfig,
  convertToSSML,
  validateSSML,
  estimateAudioDuration,
  handlePollyError,
  type VoiceType,
  type VoiceRegion,
} from '@/lib/polly-config';
import { S3Service } from './s3';

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
  audioUrl?: string;
  s3Key?: string;
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
  /**
   * Synthesize speech from text
   */
  static async synthesizeSpeech(
    request: SpeechSynthesisRequest,
    uploadToS3: boolean = false
  ): Promise<SpeechSynthesisResult> {
    const startTime = Date.now();
    
    try {
      const {
        text,
        voiceType,
        voiceRegion = 'US',
        outputFormat = 'mp3',
        sampleRate = '24000',
        useSSML = true,
      } = request;

      // Get voice configuration
      const voiceConfig = getVoiceConfig(voiceType, voiceRegion);

      // Prepare text/SSML
      let processedText = text;
      let isSSML = false;

      if (useSSML) {
        processedText = convertToSSML(text, voiceType, voiceRegion);
        const validation = validateSSML(processedText);
        
        if (!validation.valid) {
          console.warn('SSML validation failed, falling back to plain text:', validation.errors);
          processedText = text;
        } else {
          isSSML = true;
        }
      }

      // Apply speed, pitch, volume modifications if specified
      if ((request.speed || request.pitch || request.volume) && isSSML) {
        processedText = this.applyProsodyModifications(processedText, request);
      }

      // Validate text length
      const maxLength = isSSML ? POLLY_CONFIG.AUDIO.MAX_SSML_LENGTH : POLLY_CONFIG.AUDIO.MAX_TEXT_LENGTH;
      if (processedText.length > maxLength) {
        throw new Error(`Text too long: ${processedText.length} characters (max: ${maxLength})`);
      }

      // Synthesize speech
      const command = new SynthesizeSpeechCommand({
        Text: processedText,
        TextType: isSSML ? 'ssml' : 'text',
        VoiceId: voiceConfig.id,
        Engine: voiceConfig.engine as 'standard' | 'neural',
        OutputFormat: outputFormat,
        SampleRate: sampleRate,
      });

      const response = await pollyClient.send(command);

      if (!response.AudioStream) {
        throw new Error('No audio stream received from Polly');
      }

      // Convert stream to buffer
      const audioBuffer = Buffer.from(await response.AudioStream.transformToByteArray());

      // Estimate duration
      const estimatedDuration = estimateAudioDuration(text, voiceType);

      let audioUrl: string | undefined;
      let s3Key: string | undefined;

      // Upload to S3 if requested
      if (uploadToS3) {
        const filename = `speech_${Date.now()}_${Math.random().toString(36).substring(2)}.${outputFormat}`;
        
        const uploadResult = await S3Service.uploadFile(audioBuffer, {
          folder: 'PROCESSED',
          filename,
          contentType: `audio/${outputFormat}`,
          metadata: {
            voiceId: voiceConfig.id,
            voiceEngine: voiceConfig.engine,
            voiceType,
            textLength: text.length.toString(),
            estimatedDuration: estimatedDuration.toString(),
            generatedAt: new Date().toISOString(),
          },
        });

        audioUrl = uploadResult.cloudFrontUrl;
        s3Key = uploadResult.key;
      }

      const result: SpeechSynthesisResult = {
        audioBuffer,
        audioUrl,
        s3Key,
        metadata: {
          voiceId: voiceConfig.id,
          voiceEngine: voiceConfig.engine,
          outputFormat,
          sampleRate,
          duration: estimatedDuration,
          textLength: text.length,
          ssmlLength: isSSML ? processedText.length : undefined,
          synthesisTime: Date.now() - startTime,
          audioSize: audioBuffer.length,
        },
      };

      return result;
    } catch (error) {
      throw handlePollyError(error);
    }
  }

  /**
   * Apply prosody modifications to SSML
   */
  private static applyProsodyModifications(
    ssml: string,
    request: SpeechSynthesisRequest
  ): string {
    let modifiedSSML = ssml;

    // Extract content between <speak> tags
    const speakMatch = modifiedSSML.match(/<speak>(.*)<\/speak>/s);
    if (!speakMatch) return ssml;

    let content = speakMatch[1];

    // Apply prosody modifications
    const prosodyAttributes: string[] = [];

    if (request.speed) {
      const speedValue = request.speed < 0.5 ? 'x-slow' :
                        request.speed < 0.8 ? 'slow' :
                        request.speed < 1.2 ? 'medium' :
                        request.speed < 1.5 ? 'fast' : 'x-fast';
      prosodyAttributes.push(`rate="${speedValue}"`);
    }

    if (request.pitch) {
      const pitchValue = request.pitch < 0.8 ? 'low' :
                        request.pitch < 1.2 ? 'medium' : 'high';
      prosodyAttributes.push(`pitch="${pitchValue}"`);
    }

    if (request.volume) {
      const volumeValue = request.volume < 0.5 ? 'soft' :
                         request.volume < 1.2 ? 'medium' : 'loud';
      prosodyAttributes.push(`volume="${volumeValue}"`);
    }

    if (prosodyAttributes.length > 0) {
      content = `<prosody ${prosodyAttributes.join(' ')}>${content}</prosody>`;
    }

    return `<speak>${content}</speak>`;
  }

  /**
   * Batch synthesize multiple texts
   */
  static async batchSynthesize(
    batchRequest: BatchSynthesisRequest
  ): Promise<Array<{
    request: SpeechSynthesisRequest;
    result?: SpeechSynthesisResult;
    error?: Error;
  }>> {
    const {
      requests,
      uploadToS3 = false,
      concurrency = 3,
    } = batchRequest;

    const results: Array<{
      request: SpeechSynthesisRequest;
      result?: SpeechSynthesisResult;
      error?: Error;
    }> = [];

    // Process in batches to avoid rate limits
    for (let i = 0; i < requests.length; i += concurrency) {
      const batch = requests.slice(i, i + concurrency);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (request) => {
          try {
            const result = await this.synthesizeSpeech(request, uploadToS3);
            return { request, result };
          } catch (error) {
            return { request, error: error as Error };
          }
        })
      );

      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({ request: batch[0], error: result.reason });
        }
      });

      // Rate limiting delay between batches
      if (i + concurrency < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Split long text into chunks for synthesis
   */
  static splitTextForSynthesis(
    text: string,
    maxLength: number = POLLY_CONFIG.AUDIO.MAX_TEXT_LENGTH
  ): string[] {
    if (text.length <= maxLength) {
      return [text];
    }

    const chunks: string[] = [];
    const sentences = text.split(/(?<=[.!?])\s+/);
    let currentChunk = '';

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length <= maxLength) {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = sentence;
        } else {
          // Single sentence is too long, split by words
          const words = sentence.split(' ');
          let wordChunk = '';
          
          for (const word of words) {
            if ((wordChunk + word).length <= maxLength) {
              wordChunk += (wordChunk ? ' ' : '') + word;
            } else {
              if (wordChunk) {
                chunks.push(wordChunk);
                wordChunk = word;
              } else {
                // Single word is too long, truncate
                chunks.push(word.substring(0, maxLength));
              }
            }
          }
          
          if (wordChunk) {
            currentChunk = wordChunk;
          }
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * Synthesize long text by splitting into chunks
   */
  static async synthesizeLongText(
    request: SpeechSynthesisRequest,
    uploadToS3: boolean = false
  ): Promise<{
    chunks: SpeechSynthesisResult[];
    combinedAudioUrl?: string;
    combinedS3Key?: string;
    totalDuration: number;
  }> {
    const chunks = this.splitTextForSynthesis(request.text);
    
    if (chunks.length === 1) {
      const result = await this.synthesizeSpeech(request, uploadToS3);
      return {
        chunks: [result],
        combinedAudioUrl: result.audioUrl,
        combinedS3Key: result.s3Key,
        totalDuration: result.metadata.duration,
      };
    }

    // Synthesize each chunk
    const chunkResults: SpeechSynthesisResult[] = [];
    let totalDuration = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunkRequest = { ...request, text: chunks[i] };
      const result = await this.synthesizeSpeech(chunkRequest, false); // Don't upload individual chunks
      chunkResults.push(result);
      totalDuration += result.metadata.duration;

      // Small delay between chunks to avoid rate limits
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    let combinedAudioUrl: string | undefined;
    let combinedS3Key: string | undefined;

    // Combine audio chunks if uploading to S3
    if (uploadToS3) {
      const combinedBuffer = Buffer.concat(chunkResults.map(chunk => chunk.audioBuffer));
      const filename = `speech_combined_${Date.now()}.${request.outputFormat || 'mp3'}`;
      
      const uploadResult = await S3Service.uploadFile(combinedBuffer, {
        folder: 'PROCESSED',
        filename,
        contentType: `audio/${request.outputFormat || 'mp3'}`,
        metadata: {
          voiceType: request.voiceType,
          chunkCount: chunks.length.toString(),
          totalDuration: totalDuration.toString(),
          generatedAt: new Date().toISOString(),
        },
      });

      combinedAudioUrl = uploadResult.cloudFrontUrl;
      combinedS3Key = uploadResult.key;
    }

    return {
      chunks: chunkResults,
      combinedAudioUrl,
      combinedS3Key,
      totalDuration,
    };
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
