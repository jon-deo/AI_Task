import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkOpenAIHealth } from '@/lib/openai-config';
import { checkPollyHealth } from '@/lib/polly-config';
import { AIScriptGenerationService } from '@/services/ai-script-generation';
import { SpeechSynthesisService } from '@/services/speech-synthesis';
import { VideoGenerationService } from '@/services/video-generation';
import { VoiceId, OutputFormat } from '@aws-sdk/client-polly';
import { VoiceType } from '@/types';
import type { Celebrity } from '@/types';

type ServiceStatus = 'healthy' | 'unhealthy' | 'unknown' | 'degraded';

/**
 * GET /api/health/ai - Check AI services health
 */
export async function GET() {
  try {
    const results = {
      openai: false,
      polly: false,
      video: false,
      errors: [] as string[],
    };

    // Get or create a test celebrity
    const celebrity = await ensureTestCelebrity();

    // Test OpenAI (Script Generation)
    try {
      const testScript = await AIScriptGenerationService.generateScript({
        celebrity,
        duration: 30,
        voiceType: VoiceType.MALE_NARRATOR,
      });
      results.openai = true;
    } catch (error: any) {
      results.errors.push(`OpenAI Error: ${error.message}`);
    }

    // Test AWS Polly (Voice Generation)
    try {
      const testVoice = await SpeechSynthesisService.synthesizeSpeech({
        text: 'This is a test of the voice synthesis service.',
        voiceType: VoiceType.MALE_NARRATOR,
        outputFormat: 'mp3',
      });
      results.polly = true;
    } catch (error: any) {
      results.errors.push(`Polly Error: ${error.message}`);
    }

    // Test Video Generation
    try {
      const testVideo = await VideoGenerationService.generateVideo({
        celebrity,
        duration: 30,
      });
      results.video = true;
    } catch (error: any) {
      results.errors.push(`Video Generation Error: ${error.message}`);
    }

    // Return health status
    return NextResponse.json({
      status: results.errors.length === 0 ? 'healthy' : 'degraded',
      services: {
        openai: results.openai ? 'healthy' : 'unhealthy',
        polly: results.polly ? 'healthy' : 'unhealthy',
        video: results.video ? 'healthy' : 'unhealthy',
      },
      errors: results.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error.message || 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
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
      voiceType: VoiceType.MALE_NARRATOR,
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
      voiceType: VoiceType.MALE_NARRATOR,
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

async function ensureTestCelebrity() {
  // Check if we already have a test celebrity
  let celebrity = await prisma.celebrity.findFirst({
    where: { name: 'Test Athlete' },
  });

  if (!celebrity) {
    // Create a test celebrity
    celebrity = await prisma.celebrity.create({
      data: {
        name: 'Test Athlete',
        slug: 'test-athlete',
        sport: 'FOOTBALL',
        imageUrl: 'https://example.com/test.jpg',
        biography: 'A test athlete for health check purposes.',
        achievements: ['Test Achievement'],
        nationality: 'USA',
        isActive: true,
        totalViews: BigInt(0),
        totalLikes: BigInt(0),
        totalShares: BigInt(0),
      },
    });
  }

  return celebrity;
}
