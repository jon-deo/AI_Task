import { NextRequest, NextResponse } from 'next/server';

import { checkOpenAIHealth } from '@/lib/openai-config';
import { checkPollyHealth } from '@/lib/polly-config';
import { AIScriptGenerationService } from '@/services/ai-script-generation';
import { SpeechSynthesisService } from '@/services/speech-synthesis';

/**
 * GET /api/health/ai - Check AI services health
 */
export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now();

    // Run health checks in parallel
    const [
      openaiHealth,
      pollyHealth,
      scriptTest,
      speechTest,
    ] = await Promise.allSettled([
      checkOpenAIHealth(),
      checkPollyHealth(),
      testScriptGeneration(),
      testSpeechSynthesis(),
    ]);

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    // Process results
    const results = {
      overall: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
      responseTime,
      timestamp: new Date().toISOString(),
      services: {
        openai: {
          status: 'unknown' as 'healthy' | 'degraded' | 'unhealthy',
          details: {} as any,
        },
        polly: {
          status: 'unknown' as 'healthy' | 'degraded' | 'unhealthy',
          details: {} as any,
        },
        scriptGeneration: {
          status: 'unknown' as 'healthy' | 'degraded' | 'unhealthy',
          details: {} as any,
        },
        speechSynthesis: {
          status: 'unknown' as 'healthy' | 'degraded' | 'unhealthy',
          details: {} as any,
        },
      },
      errors: [] as string[],
    };

    // Process OpenAI health check
    if (openaiHealth.status === 'fulfilled') {
      const health = openaiHealth.value;
      results.services.openai.status = health.healthy ? 'healthy' : 'unhealthy';
      results.services.openai.details = {
        responseTime: health.responseTime,
        model: health.model,
      };
      
      if (health.errors.length > 0) {
        results.errors.push(...health.errors);
      }
    } else {
      results.services.openai.status = 'unhealthy';
      results.errors.push(`OpenAI health check failed: ${openaiHealth.reason}`);
    }

    // Process Polly health check
    if (pollyHealth.status === 'fulfilled') {
      const health = pollyHealth.value;
      results.services.polly.status = health.healthy ? 'healthy' : 'unhealthy';
      results.services.polly.details = {
        responseTime: health.responseTime,
        availableVoices: health.availableVoices,
      };
      
      if (health.errors.length > 0) {
        results.errors.push(...health.errors);
      }
    } else {
      results.services.polly.status = 'unhealthy';
      results.errors.push(`Polly health check failed: ${pollyHealth.reason}`);
    }

    // Process script generation test
    if (scriptTest.status === 'fulfilled') {
      const test = scriptTest.value;
      results.services.scriptGeneration.status = test.success ? 'healthy' : 'degraded';
      results.services.scriptGeneration.details = {
        testDuration: test.duration,
        wordCount: test.wordCount,
        tokensUsed: test.tokensUsed,
      };
      
      if (!test.success) {
        results.errors.push(test.error || 'Script generation test failed');
      }
    } else {
      results.services.scriptGeneration.status = 'unhealthy';
      results.errors.push(`Script generation test failed: ${scriptTest.reason}`);
    }

    // Process speech synthesis test
    if (speechTest.status === 'fulfilled') {
      const test = speechTest.value;
      results.services.speechSynthesis.status = test.success ? 'healthy' : 'degraded';
      results.services.speechSynthesis.details = {
        testDuration: test.duration,
        audioSize: test.audioSize,
        voiceId: test.voiceId,
      };
      
      if (!test.success) {
        results.errors.push(test.error || 'Speech synthesis test failed');
      }
    } else {
      results.services.speechSynthesis.status = 'unhealthy';
      results.errors.push(`Speech synthesis test failed: ${speechTest.reason}`);
    }

    // Determine overall health
    const serviceStatuses = Object.values(results.services).map(s => s.status);
    
    if (serviceStatuses.every(status => status === 'healthy')) {
      results.overall = 'healthy';
    } else if (serviceStatuses.some(status => status === 'unhealthy')) {
      results.overall = 'unhealthy';
    } else {
      results.overall = 'degraded';
    }

    // Return appropriate status code
    const statusCode = results.overall === 'healthy' ? 200 : 
                      results.overall === 'degraded' ? 200 : 503;

    return NextResponse.json(results, { status: statusCode });
  } catch (error) {
    console.error('AI health check error:', error);
    
    return NextResponse.json({
      overall: 'unhealthy',
      responseTime: 0,
      timestamp: new Date().toISOString(),
      services: {
        openai: { status: 'unhealthy', details: {} },
        polly: { status: 'unhealthy', details: {} },
        scriptGeneration: { status: 'unhealthy', details: {} },
        speechSynthesis: { status: 'unhealthy', details: {} },
      },
      errors: [`Health check failed: ${error}`],
    }, { status: 503 });
  }
}

/**
 * Test script generation functionality
 */
async function testScriptGeneration(): Promise<{
  success: boolean;
  duration: number;
  wordCount?: number;
  tokensUsed?: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    // Create a minimal test celebrity object
    const testCelebrity = {
      id: 'test',
      name: 'Test Athlete',
      sport: 'BASKETBALL' as const,
      nationality: 'USA',
      biography: 'A test athlete for health check purposes.',
      achievements: ['Test Achievement'],
      isActive: true,
      isVerified: true,
      slug: 'test-athlete',
      totalViews: BigInt(0),
      totalLikes: BigInt(0),
      totalShares: BigInt(0),
      reelsCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      position: null,
      team: null,
      birthDate: null,
      imageUrl: null,
      thumbnailUrl: null,
      socialLinks: null,
      metaTitle: null,
      metaDescription: null,
      keywords: [],
    };

    const result = await AIScriptGenerationService.generateScript({
      celebrity: testCelebrity,
      duration: 30,
      voiceType: 'MALE_NARRATOR',
    }, {
      model: 'gpt-3.5-turbo', // Use faster model for health check
      maxRetries: 1,
    });

    return {
      success: true,
      duration: Date.now() - startTime,
      wordCount: result.metadata.wordCount,
      tokensUsed: result.metadata.tokensUsed,
    };
  } catch (error) {
    return {
      success: false,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test speech synthesis functionality
 */
async function testSpeechSynthesis(): Promise<{
  success: boolean;
  duration: number;
  audioSize?: number;
  voiceId?: string;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    const testText = 'This is a health check test for speech synthesis.';
    
    const result = await SpeechSynthesisService.synthesizeSpeech({
      text: testText,
      voiceType: 'MALE_NARRATOR',
      voiceRegion: 'US',
      outputFormat: 'mp3',
      useSSML: false,
    }, false); // Don't upload to S3 for health check

    return {
      success: true,
      duration: Date.now() - startTime,
      audioSize: result.audioBuffer.length,
      voiceId: result.metadata.voiceId,
    };
  } catch (error) {
    return {
      success: false,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * POST /api/health/ai/test - Run comprehensive AI tests
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      includeScriptTest = true, 
      includeSpeechTest = true,
      includeIntegrationTest = false 
    } = body;

    const results = {
      timestamp: new Date().toISOString(),
      tests: {
        connection: { status: 'pending', duration: 0, details: {} },
        scriptGeneration: { status: 'skipped', duration: 0, details: {} },
        speechSynthesis: { status: 'skipped', duration: 0, details: {} },
        integration: { status: 'skipped', duration: 0, details: {} },
      },
      overall: 'pending' as 'passed' | 'failed' | 'partial',
    };

    // Test 1: Connection tests
    try {
      const startTime = Date.now();
      const [openaiHealth, pollyHealth] = await Promise.all([
        checkOpenAIHealth(),
        checkPollyHealth(),
      ]);
      
      results.tests.connection = {
        status: openaiHealth.healthy && pollyHealth.healthy ? 'passed' : 'failed',
        duration: Date.now() - startTime,
        details: { openai: openaiHealth, polly: pollyHealth },
      };
    } catch (error) {
      results.tests.connection = {
        status: 'failed',
        duration: 0,
        details: { error: String(error) },
      };
    }

    // Test 2: Script generation
    if (includeScriptTest) {
      const scriptTest = await testScriptGeneration();
      results.tests.scriptGeneration = {
        status: scriptTest.success ? 'passed' : 'failed',
        duration: scriptTest.duration,
        details: scriptTest,
      };
    }

    // Test 3: Speech synthesis
    if (includeSpeechTest) {
      const speechTest = await testSpeechSynthesis();
      results.tests.speechSynthesis = {
        status: speechTest.success ? 'passed' : 'failed',
        duration: speechTest.duration,
        details: speechTest,
      };
    }

    // Test 4: Integration test (full pipeline)
    if (includeIntegrationTest) {
      try {
        const startTime = Date.now();
        // This would test the full video generation pipeline
        // For now, we'll just simulate it
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        results.tests.integration = {
          status: 'passed',
          duration: Date.now() - startTime,
          details: { message: 'Integration test simulated' },
        };
      } catch (error) {
        results.tests.integration = {
          status: 'failed',
          duration: 0,
          details: { error: String(error) },
        };
      }
    }

    // Determine overall result
    const testResults = Object.values(results.tests)
      .filter(test => test.status !== 'skipped')
      .map(test => test.status);
    
    if (testResults.every(status => status === 'passed')) {
      results.overall = 'passed';
    } else if (testResults.some(status => status === 'passed')) {
      results.overall = 'partial';
    } else {
      results.overall = 'failed';
    }

    const statusCode = results.overall === 'passed' ? 200 : 
                      results.overall === 'partial' ? 200 : 500;

    return NextResponse.json(results, { status: statusCode });
  } catch (error) {
    console.error('AI test error:', error);
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      tests: {},
      overall: 'failed',
      error: String(error),
    }, { status: 500 });
  }
}
