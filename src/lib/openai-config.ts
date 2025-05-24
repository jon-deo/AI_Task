import OpenAI from 'openai';

import { config } from '@/config';

// OpenAI Client Configuration
export const openai = new OpenAI({
  apiKey: config.openai.apiKey,
  organization: config.openai.organizationId,
  maxRetries: 3,
  timeout: 60000, // 60 seconds
});

// AI Generation Configuration
export const AI_CONFIG = {
  // Model settings
  MODELS: {
    TEXT_GENERATION: 'gpt-4-turbo-preview',
    TEXT_GENERATION_FAST: 'gpt-3.5-turbo',
    EMBEDDING: 'text-embedding-3-small',
  },
  
  // Generation parameters
  GENERATION: {
    MAX_TOKENS: 2000,
    TEMPERATURE: 0.7,
    TOP_P: 0.9,
    FREQUENCY_PENALTY: 0.1,
    PRESENCE_PENALTY: 0.1,
  },
  
  // Script generation settings
  SCRIPT: {
    MIN_DURATION: 15, // seconds
    MAX_DURATION: 120, // seconds
    TARGET_WPM: 150, // words per minute for speech
    PARAGRAPH_BREAK_SECONDS: 1, // pause between paragraphs
  },
  
  // Content guidelines
  CONTENT: {
    TONE: 'engaging and informative',
    STYLE: 'conversational yet professional',
    TARGET_AUDIENCE: 'sports fans and general audience',
    AVOID_TOPICS: ['controversial politics', 'personal scandals', 'unverified claims'],
  },
} as const;

// Prompt templates for different content types
export const PROMPT_TEMPLATES = {
  SCRIPT_GENERATION: `Create an engaging {duration}-second script about {celebrityName}, a professional {sport} player.

Context:
- Sport: {sport}
- Position: {position}
- Team: {team}
- Nationality: {nationality}
- Biography: {biography}
- Key Achievements: {achievements}

Requirements:
- Duration: Exactly {duration} seconds when spoken at 150 words per minute
- Tone: {tone}
- Style: {style}
- Target audience: {targetAudience}
- Include specific statistics and achievements
- Make it engaging and shareable
- Avoid: {avoidTopics}

Structure:
1. Hook (first 5 seconds) - grab attention immediately
2. Background (next 20-30% of time) - brief personal/career background
3. Achievements (middle 40-50% of time) - major accomplishments and records
4. Impact/Legacy (final 20-30% of time) - influence on sport and culture
5. Call to action (last 3 seconds) - encourage engagement

Output format:
- Plain text script only
- Natural speech patterns
- Include [PAUSE] markers for dramatic effect
- Mark emphasis with *asterisks*
- End with engaging question or statement

Script:`,

  TITLE_GENERATION: `Generate a compelling, click-worthy title for a sports reel about {celebrityName}.

Context:
- Celebrity: {celebrityName}
- Sport: {sport}
- Key achievement/focus: {focusPoint}
- Target audience: Sports fans and social media users

Requirements:
- Maximum 60 characters
- Engaging and shareable
- Include action words or emotional triggers
- Avoid clickbait that misleads
- Make it specific and intriguing

Examples of good titles:
- "How LeBron Changed Basketball Forever"
- "Serena's Secret to 23 Grand Slams"
- "The Goal That Made Messi a Legend"

Title:`,

  DESCRIPTION_GENERATION: `Write a compelling description for a sports reel about {celebrityName}.

Context:
- Celebrity: {celebrityName}
- Sport: {sport}
- Script summary: {scriptSummary}
- Duration: {duration} seconds

Requirements:
- Maximum 150 characters
- Include relevant hashtags
- Encourage engagement (likes, shares, comments)
- Mention key achievement or interesting fact
- Call to action

Description:`,

  HASHTAG_GENERATION: `Generate relevant hashtags for a sports reel about {celebrityName}.

Context:
- Celebrity: {celebrityName}
- Sport: {sport}
- Content focus: {contentFocus}

Requirements:
- 8-12 hashtags
- Mix of popular and niche tags
- Include sport-specific hashtags
- Include general sports hashtags
- Include trending hashtags if relevant
- Format as comma-separated list

Hashtags:`,
} as const;

// Token estimation utilities
export function estimateTokens(text: string): number {
  // Rough estimation: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
}

export function estimateWordsFromTokens(tokens: number): number {
  // Rough estimation: 1 token ≈ 0.75 words
  return Math.ceil(tokens * 0.75);
}

export function estimateDurationFromWords(words: number, wpm: number = AI_CONFIG.SCRIPT.TARGET_WPM): number {
  return Math.ceil((words / wpm) * 60); // Convert to seconds
}

export function calculateTargetWords(durationSeconds: number, wpm: number = AI_CONFIG.SCRIPT.TARGET_WPM): number {
  return Math.ceil((durationSeconds / 60) * wpm);
}

// Content validation
export function validateScriptContent(script: string): {
  valid: boolean;
  issues: string[];
  wordCount: number;
  estimatedDuration: number;
} {
  const issues: string[] = [];
  const words = script.trim().split(/\s+/).length;
  const estimatedDuration = estimateDurationFromWords(words);

  // Check minimum length
  if (words < 20) {
    issues.push('Script is too short (minimum 20 words)');
  }

  // Check maximum length
  if (words > 300) {
    issues.push('Script is too long (maximum 300 words)');
  }

  // Check for inappropriate content markers
  const inappropriatePatterns = [
    /\b(scandal|controversy|arrest|lawsuit)\b/i,
    /\b(allegedly|rumor|unconfirmed)\b/i,
    /\b(hate|discrimination|offensive)\b/i,
  ];

  inappropriatePatterns.forEach((pattern, index) => {
    if (pattern.test(script)) {
      issues.push(`Content may contain inappropriate material (pattern ${index + 1})`);
    }
  });

  // Check for required elements
  if (!script.includes('*') && !script.includes('[PAUSE]')) {
    issues.push('Script lacks emphasis markers or pause indicators');
  }

  return {
    valid: issues.length === 0,
    issues,
    wordCount: words,
    estimatedDuration,
  };
}

// Error handling for OpenAI API
export class OpenAIError extends Error {
  constructor(
    message: string,
    public code?: string,
    public type?: string,
    public retryable?: boolean
  ) {
    super(message);
    this.name = 'OpenAIError';
  }
}

export function handleOpenAIError(error: any): OpenAIError {
  let retryable = false;
  let code = 'unknown';
  let type = 'unknown';

  if (error.status) {
    code = error.status.toString();
    
    // Determine if error is retryable
    if (error.status >= 500 || error.status === 429) {
      retryable = true;
    }
    
    // Set error type
    if (error.status === 401) {
      type = 'authentication';
    } else if (error.status === 403) {
      type = 'authorization';
    } else if (error.status === 429) {
      type = 'rate_limit';
    } else if (error.status >= 500) {
      type = 'server_error';
    } else if (error.status === 400) {
      type = 'invalid_request';
    }
  }

  const openAIError = new OpenAIError(
    error.message || 'OpenAI API request failed',
    code,
    type,
    retryable
  );

  // Log error for monitoring
  console.error('OpenAI Error:', {
    message: openAIError.message,
    code: openAIError.code,
    type: openAIError.type,
    retryable: openAIError.retryable,
  });

  return openAIError;
}

// Health check for OpenAI service
export async function checkOpenAIHealth(): Promise<{
  healthy: boolean;
  responseTime: number;
  model: string;
  errors: string[];
}> {
  const startTime = Date.now();
  const errors: string[] = [];
  let healthy = false;
  let model = '';

  try {
    // Test with a simple completion
    const response = await openai.chat.completions.create({
      model: AI_CONFIG.MODELS.TEXT_GENERATION_FAST,
      messages: [
        {
          role: 'user',
          content: 'Say "OpenAI health check successful" in exactly those words.',
        },
      ],
      max_tokens: 10,
      temperature: 0,
    });

    const content = response.choices[0]?.message?.content?.trim();
    model = response.model;
    
    if (content?.includes('OpenAI health check successful')) {
      healthy = true;
    } else {
      errors.push('Unexpected response from OpenAI API');
    }
  } catch (error) {
    errors.push(`OpenAI health check failed: ${error}`);
  }

  return {
    healthy,
    responseTime: Date.now() - startTime,
    model,
    errors,
  };
}
