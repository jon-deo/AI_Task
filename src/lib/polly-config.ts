import {
  PollyClient,
  SynthesizeSpeechCommand,
  DescribeVoicesCommand,
  Voice,
} from '@aws-sdk/client-polly';

import { config } from '@/config';

// Polly Client Configuration
export const pollyClient = new PollyClient({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
  maxAttempts: 3,
  retryMode: 'adaptive',
});

// Voice Configuration
export const POLLY_CONFIG = {
  // Default settings
  DEFAULT_ENGINE: 'neural' as const,
  DEFAULT_OUTPUT_FORMAT: 'mp3' as const,
  DEFAULT_SAMPLE_RATE: '24000',
  
  // Voice mappings by type and language
  VOICES: {
    MALE_NARRATOR: {
      US: { id: 'Matthew', engine: 'neural' },
      UK: { id: 'Brian', engine: 'neural' },
      AU: { id: 'Russell', engine: 'neural' },
    },
    FEMALE_NARRATOR: {
      US: { id: 'Joanna', engine: 'neural' },
      UK: { id: 'Emma', engine: 'neural' },
      AU: { id: 'Olivia', engine: 'neural' },
    },
    SPORTS_COMMENTATOR: {
      US: { id: 'Justin', engine: 'neural' },
      UK: { id: 'Brian', engine: 'neural' },
      AU: { id: 'Russell', engine: 'neural' },
    },
    DOCUMENTARY_STYLE: {
      US: { id: 'Matthew', engine: 'neural' },
      UK: { id: 'Arthur', engine: 'neural' },
      AU: { id: 'Russell', engine: 'neural' },
    },
    ENERGETIC_HOST: {
      US: { id: 'Joey', engine: 'neural' },
      UK: { id: 'Brian', engine: 'neural' },
      AU: { id: 'Russell', engine: 'neural' },
    },
    CALM_NARRATOR: {
      US: { id: 'Matthew', engine: 'neural' },
      UK: { id: 'Arthur', engine: 'neural' },
      AU: { id: 'Russell', engine: 'neural' },
    },
  },
  
  // SSML settings for enhanced speech
  SSML: {
    PAUSE_SHORT: '<break time="0.5s"/>',
    PAUSE_MEDIUM: '<break time="1s"/>',
    PAUSE_LONG: '<break time="2s"/>',
    EMPHASIS_STRONG: '<emphasis level="strong">',
    EMPHASIS_MODERATE: '<emphasis level="moderate">',
    EMPHASIS_END: '</emphasis>',
    SPEED_SLOW: '<prosody rate="slow">',
    SPEED_MEDIUM: '<prosody rate="medium">',
    SPEED_FAST: '<prosody rate="fast">',
    SPEED_END: '</prosody>',
    VOLUME_LOUD: '<prosody volume="loud">',
    VOLUME_MEDIUM: '<prosody volume="medium">',
    VOLUME_SOFT: '<prosody volume="soft">',
    VOLUME_END: '</prosody>',
  },
  
  // Audio processing settings
  AUDIO: {
    MAX_TEXT_LENGTH: 3000, // characters
    MAX_SSML_LENGTH: 6000, // characters
    SUPPORTED_FORMATS: ['mp3', 'ogg_vorbis', 'pcm'],
    SAMPLE_RATES: {
      mp3: ['8000', '16000', '22050', '24000'],
      ogg_vorbis: ['8000', '16000', '22050'],
      pcm: ['8000', '16000'],
    },
  },
} as const;

// Voice type mapping
export type VoiceType = keyof typeof POLLY_CONFIG.VOICES;
export type VoiceRegion = 'US' | 'UK' | 'AU';

// Get voice configuration
export function getVoiceConfig(
  voiceType: VoiceType,
  region: VoiceRegion = 'US'
): { id: string; engine: string } {
  return POLLY_CONFIG.VOICES[voiceType][region] || POLLY_CONFIG.VOICES[voiceType].US;
}

// Text preprocessing for better speech synthesis
export function preprocessTextForSpeech(text: string): string {
  let processedText = text;

  // Replace common abbreviations with full words
  const abbreviations: Record<string, string> = {
    'NBA': 'N B A',
    'NFL': 'N F L',
    'MLB': 'M L B',
    'NHL': 'N H L',
    'FIFA': 'F I F A',
    'UFC': 'U F C',
    'WWE': 'W W E',
    'ESPN': 'E S P N',
    'MVP': 'M V P',
    'CEO': 'C E O',
    'USA': 'U S A',
    'UK': 'U K',
    'vs': 'versus',
    '&': 'and',
    '%': 'percent',
    '$': 'dollars',
    '#': 'number',
  };

  Object.entries(abbreviations).forEach(([abbr, full]) => {
    const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
    processedText = processedText.replace(regex, full);
  });

  // Handle numbers and years
  processedText = processedText.replace(/\b(\d{4})\b/g, (match) => {
    const year = parseInt(match);
    if (year >= 1900 && year <= 2100) {
      return match; // Keep years as numbers
    }
    return match;
  });

  // Handle scores (e.g., "24-7" -> "24 to 7")
  processedText = processedText.replace(/(\d+)-(\d+)/g, '$1 to $2');

  // Clean up extra whitespace
  processedText = processedText.replace(/\s+/g, ' ').trim();

  return processedText;
}

// Convert text with markers to SSML
export function convertToSSML(
  text: string,
  voiceType: VoiceType,
  region: VoiceRegion = 'US'
): string {
  const voiceConfig = getVoiceConfig(voiceType, region);
  let ssml = preprocessTextForSpeech(text);

  // Replace custom markers with SSML
  ssml = ssml.replace(/\[PAUSE\]/g, POLLY_CONFIG.SSML.PAUSE_MEDIUM);
  ssml = ssml.replace(/\[PAUSE_SHORT\]/g, POLLY_CONFIG.SSML.PAUSE_SHORT);
  ssml = ssml.replace(/\[PAUSE_LONG\]/g, POLLY_CONFIG.SSML.PAUSE_LONG);

  // Handle emphasis markers
  ssml = ssml.replace(/\*([^*]+)\*/g, (match, content) => {
    return `${POLLY_CONFIG.SSML.EMPHASIS_STRONG}${content}${POLLY_CONFIG.SSML.EMPHASIS_END}`;
  });

  // Handle speed markers
  ssml = ssml.replace(/\[FAST\]([^[]+)\[\/FAST\]/g, (match, content) => {
    return `${POLLY_CONFIG.SSML.SPEED_FAST}${content}${POLLY_CONFIG.SSML.SPEED_END}`;
  });

  ssml = ssml.replace(/\[SLOW\]([^[]+)\[\/SLOW\]/g, (match, content) => {
    return `${POLLY_CONFIG.SSML.SPEED_SLOW}${content}${POLLY_CONFIG.SSML.SPEED_END}`;
  });

  // Wrap in SSML speak tag
  ssml = `<speak>${ssml}</speak>`;

  return ssml;
}

// Validate SSML
export function validateSSML(ssml: string): {
  valid: boolean;
  errors: string[];
  length: number;
} {
  const errors: string[] = [];
  
  // Check length
  if (ssml.length > POLLY_CONFIG.AUDIO.MAX_SSML_LENGTH) {
    errors.push(`SSML too long: ${ssml.length} characters (max: ${POLLY_CONFIG.AUDIO.MAX_SSML_LENGTH})`);
  }

  // Check for unclosed tags
  const openTags = ssml.match(/<[^/][^>]*>/g) || [];
  const closeTags = ssml.match(/<\/[^>]*>/g) || [];
  
  if (openTags.length !== closeTags.length) {
    errors.push('Unclosed SSML tags detected');
  }

  // Check for invalid characters
  const invalidChars = /[<>&"']/g;
  const textContent = ssml.replace(/<[^>]*>/g, '');
  if (invalidChars.test(textContent)) {
    errors.push('Invalid characters found in SSML text content');
  }

  return {
    valid: errors.length === 0,
    errors,
    length: ssml.length,
  };
}

// Estimate audio duration from text
export function estimateAudioDuration(
  text: string,
  voiceType: VoiceType,
  wpm: number = 150
): number {
  const words = text.replace(/<[^>]*>/g, '').split(/\s+/).length;
  let baseDuration = (words / wpm) * 60; // seconds

  // Adjust for voice type
  const speedMultipliers: Record<VoiceType, number> = {
    MALE_NARRATOR: 1.0,
    FEMALE_NARRATOR: 1.0,
    SPORTS_COMMENTATOR: 1.2, // Faster, more energetic
    DOCUMENTARY_STYLE: 0.9, // Slower, more deliberate
    ENERGETIC_HOST: 1.3, // Fastest
    CALM_NARRATOR: 0.8, // Slowest
  };

  baseDuration *= speedMultipliers[voiceType];

  // Add time for pauses
  const pauseCount = (text.match(/\[PAUSE\]|\[PAUSE_SHORT\]|\[PAUSE_LONG\]|<break/g) || []).length;
  baseDuration += pauseCount * 1; // Average 1 second per pause

  return Math.ceil(baseDuration);
}

// Error handling for Polly API
export class PollyError extends Error {
  constructor(
    message: string,
    public code?: string,
    public retryable?: boolean
  ) {
    super(message);
    this.name = 'PollyError';
  }
}

export function handlePollyError(error: any): PollyError {
  let retryable = false;
  let code = 'unknown';

  if (error.$metadata?.httpStatusCode) {
    code = error.$metadata.httpStatusCode.toString();
    
    // Determine if error is retryable
    if (error.$metadata.httpStatusCode >= 500 || error.$metadata.httpStatusCode === 429) {
      retryable = true;
    }
  }

  const pollyError = new PollyError(
    error.message || 'Polly API request failed',
    code,
    retryable
  );

  // Log error for monitoring
  console.error('Polly Error:', {
    message: pollyError.message,
    code: pollyError.code,
    retryable: pollyError.retryable,
  });

  return pollyError;
}

// Health check for Polly service
export async function checkPollyHealth(): Promise<{
  healthy: boolean;
  responseTime: number;
  availableVoices: number;
  errors: string[];
}> {
  const startTime = Date.now();
  const errors: string[] = [];
  let healthy = false;
  let availableVoices = 0;

  try {
    // Test by listing available voices
    const command = new DescribeVoicesCommand({
      Engine: 'neural',
      LanguageCode: 'en-US',
    });

    const response = await pollyClient.send(command);
    availableVoices = response.Voices?.length || 0;
    
    if (availableVoices > 0) {
      healthy = true;
    } else {
      errors.push('No voices available from Polly');
    }
  } catch (error) {
    errors.push(`Polly health check failed: ${error}`);
  }

  return {
    healthy,
    responseTime: Date.now() - startTime,
    availableVoices,
    errors,
  };
}
