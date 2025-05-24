#!/usr/bin/env tsx

interface TestResult {
  endpoint: string;
  method: string;
  status: number;
  success: boolean;
  responseTime: number;
  error?: string;
  cacheStatus?: string;
  rateLimitRemaining?: number;
}

class APITester {
  private baseUrl: string;
  private results: TestResult[] = [];

  constructor(baseUrl: string = 'http://localhost:3000/api') {
    this.baseUrl = baseUrl;
  }

  async testEndpoint(
    endpoint: string,
    method: string = 'GET',
    body?: any,
    headers?: Record<string, string>
  ): Promise<TestResult> {
    const startTime = Date.now();
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        ...(body && { body: JSON.stringify(body) }),
      });

      const responseTime = Date.now() - startTime;
      const data = await response.json();

      const result: TestResult = {
        endpoint,
        method,
        status: response.status,
        success: data.success || response.ok,
        responseTime,
        ...(response.headers.get('x-cache') && { cacheStatus: response.headers.get('x-cache')! }),
        ...(response.headers.get('x-ratelimit-remaining') && {
          rateLimitRemaining: parseInt(response.headers.get('x-ratelimit-remaining')!)
        }),
      };

      if (!result.success) {
        result.error = data.error || 'Unknown error';
      }

      this.results.push(result);
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const result: TestResult = {
        endpoint,
        method,
        status: 0,
        success: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Network error',
      };

      this.results.push(result);
      return result;
    }
  }

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting API endpoint tests...\n');

    // Test 1: Celebrity endpoints
    console.log('📊 Testing Celebrity Endpoints:');
    await this.testCelebrityEndpoints();

    // Test 2: Reel endpoints
    console.log('\n🎬 Testing Reel Endpoints:');
    await this.testReelEndpoints();

    // Test 3: Search endpoints
    console.log('\n🔍 Testing Search Endpoints:');
    await this.testSearchEndpoints();

    // Test 4: Trending endpoints
    console.log('\n📈 Testing Trending Endpoints:');
    await this.testTrendingEndpoints();

    // Test 5: Analytics endpoints
    console.log('\n📊 Testing Analytics Endpoints:');
    await this.testAnalyticsEndpoints();

    // Test 6: Rate limiting
    console.log('\n⏱️ Testing Rate Limiting:');
    await this.testRateLimiting();

    // Test 7: Caching
    console.log('\n💾 Testing Caching:');
    await this.testCaching();

    // Print summary
    this.printSummary();
  }

  private async testCelebrityEndpoints(): Promise<void> {
    // Get all celebrities
    const result1 = await this.testEndpoint('/celebrities');
    this.logResult('GET /celebrities', result1);

    // Get celebrities with pagination
    const result2 = await this.testEndpoint('/celebrities?page=1&limit=5&sort=totalViews&order=desc');
    this.logResult('GET /celebrities (paginated)', result2);

    // Get celebrities with filters
    const result3 = await this.testEndpoint('/celebrities?sport=BASKETBALL&isVerified=true');
    this.logResult('GET /celebrities (filtered)', result3);

    // Search celebrities
    const result4 = await this.testEndpoint('/celebrities?search=james');
    this.logResult('GET /celebrities (search)', result4);

    // Get specific celebrity (this will likely 404 in test, but tests the endpoint)
    const result5 = await this.testEndpoint('/celebrities/test-celebrity-id');
    this.logResult('GET /celebrities/:id', result5);
  }

  private async testReelEndpoints(): Promise<void> {
    // Get all reels
    const result1 = await this.testEndpoint('/reels');
    this.logResult('GET /reels', result1);

    // Get reels with pagination
    const result2 = await this.testEndpoint('/reels?page=1&limit=10&sort=views&order=desc');
    this.logResult('GET /reels (paginated)', result2);

    // Get reels with filters
    const result3 = await this.testEndpoint('/reels?sport=BASKETBALL&featured=true');
    this.logResult('GET /reels (filtered)', result3);

    // Get reels by duration
    const result4 = await this.testEndpoint('/reels?minDuration=30&maxDuration=120');
    this.logResult('GET /reels (duration filter)', result4);

    // Get specific reel
    const result5 = await this.testEndpoint('/reels/test-reel-id');
    this.logResult('GET /reels/:id', result5);

    // Test reel action (like)
    const result6 = await this.testEndpoint('/reels/test-reel-id', 'POST', { action: 'like' });
    this.logResult('POST /reels/:id (like)', result6);
  }

  private async testSearchEndpoints(): Promise<void> {
    // Basic search
    const result1 = await this.testEndpoint('/search?q=basketball');
    this.logResult('GET /search (basic)', result1);

    // Search with type filter
    const result2 = await this.testEndpoint('/search?q=james&type=celebrities');
    this.logResult('GET /search (celebrities only)', result2);

    // Search with pagination
    const result3 = await this.testEndpoint('/search?q=highlights&type=reels&page=1&limit=5');
    this.logResult('GET /search (paginated)', result3);

    // Search suggestions
    const result4 = await this.testEndpoint('/search', 'POST', { q: 'lebr' });
    this.logResult('POST /search (suggestions)', result4);

    // Empty search query (should fail)
    const result5 = await this.testEndpoint('/search?q=');
    this.logResult('GET /search (empty query)', result5);
  }

  private async testTrendingEndpoints(): Promise<void> {
    // Trending reels
    const result1 = await this.testEndpoint('/trending?type=reels&period=7d');
    this.logResult('GET /trending (reels)', result1);

    // Trending celebrities
    const result2 = await this.testEndpoint('/trending?type=celebrities&period=30d');
    this.logResult('GET /trending (celebrities)', result2);

    // Trending sports
    const result3 = await this.testEndpoint('/trending?type=sports&period=24h');
    this.logResult('GET /trending (sports)', result3);

    // Featured content
    const result4 = await this.testEndpoint('/trending', 'POST');
    this.logResult('POST /trending (featured)', result4);
  }

  private async testAnalyticsEndpoints(): Promise<void> {
    // Overview analytics (will likely require auth)
    const result1 = await this.testEndpoint('/analytics?type=overview&period=7d');
    this.logResult('GET /analytics (overview)', result1);

    // Reel analytics
    const result2 = await this.testEndpoint('/analytics?type=reels&period=30d');
    this.logResult('GET /analytics (reels)', result2);

    // Celebrity analytics
    const result3 = await this.testEndpoint('/analytics?type=celebrities&period=7d');
    this.logResult('GET /analytics (celebrities)', result3);
  }

  private async testRateLimiting(): Promise<void> {
    console.log('   Testing rate limiting with rapid requests...');

    const promises = Array.from({ length: 10 }, (_, i) =>
      this.testEndpoint(`/celebrities?test=${i}`)
    );

    const results = await Promise.all(promises);
    const rateLimited = results.filter(r => r.status === 429);

    console.log(`   Made 10 rapid requests, ${rateLimited.length} were rate limited`);

    if (results.length > 0) {
      const lastResult = results[results.length - 1];
      console.log(`   Rate limit remaining: ${lastResult?.rateLimitRemaining || 'N/A'}`);
    }
  }

  private async testCaching(): Promise<void> {
    console.log('   Testing cache behavior...');

    // First request (should be MISS)
    const result1 = await this.testEndpoint('/celebrities?limit=5');
    console.log(`   First request: ${result1.cacheStatus || 'No cache header'} (${result1.responseTime}ms)`);

    // Second request (should be HIT)
    const result2 = await this.testEndpoint('/celebrities?limit=5');
    console.log(`   Second request: ${result2.cacheStatus || 'No cache header'} (${result2.responseTime}ms)`);

    if (result1.cacheStatus === 'MISS' && result2.cacheStatus === 'HIT') {
      console.log('   ✅ Caching working correctly');
    } else {
      console.log('   ⚠️ Caching may not be working as expected');
    }
  }

  private logResult(description: string, result: TestResult): void {
    const statusIcon = result.success ? '✅' : '❌';
    const cacheInfo = result.cacheStatus ? ` [${result.cacheStatus}]` : '';
    const rateLimitInfo = result.rateLimitRemaining !== undefined ? ` (${result.rateLimitRemaining} remaining)` : '';

    console.log(`   ${statusIcon} ${description}: ${result.status}${cacheInfo}${rateLimitInfo} (${result.responseTime}ms)`);

    if (result.error) {
      console.log(`      Error: ${result.error}`);
    }
  }

  private printSummary(): void {
    console.log('\n📋 Test Summary:');
    console.log('================');

    const totalTests = this.results.length;
    const successfulTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - successfulTests;

    console.log(`Total tests: ${totalTests}`);
    console.log(`Successful: ${successfulTests} (${((successfulTests / totalTests) * 100).toFixed(1)}%)`);
    console.log(`Failed: ${failedTests} (${((failedTests / totalTests) * 100).toFixed(1)}%)`);

    // Average response time
    const avgResponseTime = this.results.reduce((sum, r) => sum + r.responseTime, 0) / totalTests;
    console.log(`Average response time: ${avgResponseTime.toFixed(0)}ms`);

    // Status code breakdown
    const statusCodes = this.results.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    console.log('\nStatus code breakdown:');
    Object.entries(statusCodes).forEach(([status, count]) => {
      console.log(`  ${status}: ${count} requests`);
    });

    // Cache performance
    const cacheHits = this.results.filter(r => r.cacheStatus === 'HIT').length;
    const cacheMisses = this.results.filter(r => r.cacheStatus === 'MISS').length;

    if (cacheHits + cacheMisses > 0) {
      console.log('\nCache performance:');
      console.log(`  Cache hits: ${cacheHits}`);
      console.log(`  Cache misses: ${cacheMisses}`);
      console.log(`  Cache hit ratio: ${((cacheHits / (cacheHits + cacheMisses)) * 100).toFixed(1)}%`);
    }

    // Failed tests details
    const failedResults = this.results.filter(r => !r.success);
    if (failedResults.length > 0) {
      console.log('\n❌ Failed tests:');
      failedResults.forEach(result => {
        console.log(`  ${result.method} ${result.endpoint}: ${result.status} - ${result.error}`);
      });
    }

    console.log('\n🎉 API testing completed!');
  }
}

async function main() {
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000/api';

  console.log(`Testing API endpoints at: ${baseUrl}`);
  console.log('Make sure your development server is running!\n');

  const tester = new APITester(baseUrl);
  await tester.runAllTests();
}

if (require.main === module) {
  main().catch(console.error);
}

export { APITester };
