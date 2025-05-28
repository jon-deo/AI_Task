import { openai, AI_CONFIG, PROMPT_TEMPLATES, handleOpenAIError, validateScriptContent, calculateTargetWords } from '@/lib/openai-config';
import { VoiceType } from '@/types';
import type { Celebrity } from '@/types';

// Update Celebrity interface to include optional fields
interface ExtendedCelebrity extends Celebrity {
  position?: string | null;
  team?: string | null;
}

export interface ScriptGenerationRequest {
  celebrity: ExtendedCelebrity;
  duration: number; // in seconds
  voiceType?: VoiceType;
  customPrompt?: string;
  tone?: string;
  style?: string;
  focusPoints?: string[];
}

export interface ScriptGenerationResult {
  script: string;
  title: string;
  description: string;
  hashtags: string[];
  metadata: {
    wordCount: number;
    estimatedDuration: number;
    targetDuration: number;
    voiceType: VoiceType;
    generationTime: number;
    model: string;
    tokensUsed: number;
  };
  validation: {
    valid: boolean;
    issues: string[];
  };
}

export interface GenerationOptions {
  maxRetries?: number;
  temperature?: number;
  model?: string;
  includeHashtags?: boolean;
  includeTitle?: boolean;
  includeDescription?: boolean;
}

export class AIScriptGenerationService {
  /**
   * Generate complete script package for a celebrity
   */
  static async generateScript(
    request: ScriptGenerationRequest,
    options: GenerationOptions = {}
  ): Promise<ScriptGenerationResult> {
    const startTime = Date.now();
    const {
      maxRetries = 3,
      temperature = AI_CONFIG.GENERATION.TEMPERATURE,
      model = AI_CONFIG.MODELS.TEXT_GENERATION,
      includeHashtags = true,
      includeTitle = true,
      includeDescription = true,
    } = options;

    try {
      // Generate main script
      const script = await this.generateMainScript(request, {
        maxRetries,
        temperature,
        model,
      });

      // Generate supporting content in parallel
      const [title, description, hashtags] = await Promise.all([
        includeTitle ? this.generateTitle(request.celebrity, script) : Promise.resolve(''),
        includeDescription ? this.generateDescription(request.celebrity, script, request.duration) : Promise.resolve(''),
        includeHashtags ? this.generateHashtags(request.celebrity, script) : Promise.resolve([]),
      ]);

      // Validate script
      const validation = validateScriptContent(script);

      const result: ScriptGenerationResult = {
        script,
        title,
        description,
        hashtags,
        metadata: {
          wordCount: validation.wordCount,
          estimatedDuration: validation.estimatedDuration,
          targetDuration: request.duration,
          voiceType: request.voiceType ?? VoiceType.MALE_NARRATOR,
          generationTime: Date.now() - startTime,
          model,
          tokensUsed: this.estimateTokensUsed(script, title, description, hashtags),
        },
        validation,
      };

      return result;
    } catch (error) {
      throw handleOpenAIError(error);
    }
  }

  /**
   * Generate main script content
   */
  private static async generateMainScript(
    request: ScriptGenerationRequest,
    options: { maxRetries: number; temperature: number; model: string }
  ): Promise<string> {
    const { celebrity, duration, customPrompt, tone, style, focusPoints } = request;
    const targetWords = calculateTargetWords(duration);

    // Build context for the prompt
    const context: Record<string, string> = {
      celebrityName: celebrity.name,
      sport: celebrity.sport,
      position: celebrity.position ?? 'Player',
      team: celebrity.team ?? 'Various teams',
      nationality: celebrity.nationality ?? 'Unknown',
      biography: celebrity.biography,
      achievements: celebrity.achievements.join(', '),
      duration: duration.toString(),
      targetWords: targetWords.toString(),
      tone: tone || AI_CONFIG.CONTENT.TONE,
      style: style || AI_CONFIG.CONTENT.STYLE,
      targetAudience: AI_CONFIG.CONTENT.TARGET_AUDIENCE,
      avoidTopics: AI_CONFIG.CONTENT.AVOID_TOPICS.join(', '),
      focusPoints: focusPoints?.join(', ') || 'career highlights and achievements',
    };

    // Use custom prompt or template
    const prompt = customPrompt || this.buildPromptFromTemplate(
      PROMPT_TEMPLATES.SCRIPT_GENERATION,
      context
    );

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
      try {
        const response = await openai.chat.completions.create({
          model: options.model,
          messages: [
            {
              role: 'system',
              content: `You are a professional sports content creator. Create a ${duration}-second script about ${celebrity.name}, a ${celebrity.sport} player. Focus on their achievements and impact on the sport.`,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: options.temperature,
          max_tokens: targetWords * 2, // Estimate tokens based on target word count
        });

        const script = response.choices[0]?.message?.content?.trim();
        
        if (!script) {
          throw new Error('Empty script generated');
        }

        // Validate script meets requirements
        const validation = validateScriptContent(script);
        
        if (!validation.valid && attempt < options.maxRetries) {
          console.warn(`Script validation failed on attempt ${attempt}:`, validation.issues);
          continue;
        }

        return script;
      } catch (error) {
        lastError = error as Error;
        console.warn(`Script generation attempt ${attempt} failed:`, error);
        
        if (attempt < options.maxRetries) {
          // Wait before retry with exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError || new Error('Script generation failed after all retries');
  }

  /**
   * Generate title for the script
   */
  private static async generateTitle(celebrity: Celebrity, script: string): Promise<string> {
    const focusPoint = this.extractFocusPoint(script);
    
    const prompt = this.buildPromptFromTemplate(
      PROMPT_TEMPLATES.TITLE_GENERATION,
      {
        celebrityName: celebrity.name,
        sport: celebrity.sport,
        focusPoint,
      }
    );

    try {
      const response = await openai.chat.completions.create({
        model: AI_CONFIG.MODELS.TEXT_GENERATION_FAST,
        messages: [
          {
            role: 'system',
            content: 'You are an expert at creating engaging, click-worthy titles for sports content. Keep titles under 60 characters.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 50,
        temperature: 0.8,
      });

      return response.choices[0]?.message?.content?.trim() || `${celebrity.name}: Sports Legend`;
    } catch (error) {
      console.warn('Title generation failed:', error);
      return `${celebrity.name}: ${celebrity.sport} Legend`;
    }
  }

  /**
   * Generate description for the script
   */
  private static async generateDescription(
    celebrity: Celebrity,
    script: string,
    duration: number
  ): Promise<string> {
    const scriptSummary = script.substring(0, 200) + '...';
    
    const prompt = this.buildPromptFromTemplate(
      PROMPT_TEMPLATES.DESCRIPTION_GENERATION,
      {
        celebrityName: celebrity.name,
        sport: celebrity.sport,
        scriptSummary,
        duration: duration.toString(),
      }
    );

    try {
      const response = await openai.chat.completions.create({
        model: AI_CONFIG.MODELS.TEXT_GENERATION_FAST,
        messages: [
          {
            role: 'system',
            content: 'You are an expert at creating engaging social media descriptions. Keep descriptions under 150 characters and include relevant hashtags.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 100,
        temperature: 0.7,
      });

      return response.choices[0]?.message?.content?.trim() || `Amazing ${celebrity.sport} story! #${celebrity.sport} #Sports`;
    } catch (error) {
      console.warn('Description generation failed:', error);
      return `Discover the incredible story of ${celebrity.name}! #${celebrity.sport} #Sports #Legend`;
    }
  }

  /**
   * Generate hashtags for the script
   */
  private static async generateHashtags(celebrity: Celebrity, script: string): Promise<string[]> {
    const contentFocus = this.extractFocusPoint(script);
    
    const prompt = this.buildPromptFromTemplate(
      PROMPT_TEMPLATES.HASHTAG_GENERATION,
      {
        celebrityName: celebrity.name,
        sport: celebrity.sport,
        contentFocus,
      }
    );

    try {
      const response = await openai.chat.completions.create({
        model: AI_CONFIG.MODELS.TEXT_GENERATION_FAST,
        messages: [
          {
            role: 'system',
            content: 'You are an expert at creating relevant hashtags for sports content. Generate 8-12 hashtags as a comma-separated list.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 100,
        temperature: 0.6,
      });

      const hashtagString = response.choices[0]?.message?.content?.trim() || '';
      const hashtags = hashtagString
        .split(',')
        .map(tag => tag.trim().replace(/^#/, ''))
        .filter(tag => tag.length > 0)
        .map(tag => `#${tag}`);

      return hashtags.length > 0 ? hashtags : [`#${celebrity.sport}`, '#Sports', '#Legend'];
    } catch (error) {
      console.warn('Hashtag generation failed:', error);
      return [`#${celebrity.sport}`, '#Sports', '#Legend', `#${celebrity.name.replace(/\s+/g, '')}`];
    }
  }

  /**
   * Build prompt from template with context substitution
   */
  private static buildPromptFromTemplate(template: string, context: Record<string, string>): string {
    let prompt = template;
    
    Object.entries(context).forEach(([key, value]) => {
      const placeholder = `{${key}}`;
      prompt = prompt.replace(new RegExp(placeholder, 'g'), value);
    });

    return prompt;
  }

  /**
   * Extract main focus point from script
   */
  private static extractFocusPoint(script: string): string {
    // Simple extraction of key phrases
    const sentences = script.split(/[.!?]+/);
    const keyPhrases = sentences
      .filter(sentence => sentence.length > 20)
      .map(sentence => sentence.trim())
      .slice(0, 2);

    return keyPhrases.join('. ') || 'career achievements';
  }

  /**
   * Estimate total tokens used across all generations
   */
  private static estimateTokensUsed(
    script: string,
    title: string,
    description: string,
    hashtags: string[]
  ): number {
    const totalText = [script, title, description, ...hashtags].join(' ');
    return Math.ceil(totalText.length / 4); // Rough estimation
  }

  /**
   * Batch generate scripts for multiple celebrities
   */
  static async batchGenerateScripts(
    requests: ScriptGenerationRequest[],
    options: GenerationOptions & { concurrency?: number } = {}
  ): Promise<Array<{ request: ScriptGenerationRequest; result?: ScriptGenerationResult; error?: Error }>> {
    const { concurrency = 3 } = options;
    const results: Array<{ request: ScriptGenerationRequest; result?: ScriptGenerationResult; error?: Error }> = [];

    // Process in batches to avoid rate limits
    for (let i = 0; i < requests.length; i += concurrency) {
      const batch = requests.slice(i, i + concurrency);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (request) => {
          try {
            const result = await this.generateScript(request, options);
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
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return results;
  }

  /**
   * Regenerate script with feedback
   */
  static async regenerateWithFeedback(
    originalRequest: ScriptGenerationRequest,
    feedback: string,
    options: GenerationOptions = {}
  ): Promise<ScriptGenerationResult> {
    const enhancedRequest = {
      ...originalRequest,
      customPrompt: `${originalRequest.customPrompt || PROMPT_TEMPLATES.SCRIPT_GENERATION}

Previous feedback to incorporate:
${feedback}

Please address the feedback while maintaining the original requirements.`,
    };

    return this.generateScript(enhancedRequest, options);
  }
}
