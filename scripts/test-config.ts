#!/usr/bin/env tsx

import { config, validateConfig } from '../src/config';
import { checkAWSHealth } from '../src/lib/aws-config';

async function testConfiguration() {
  console.log('🧪 Testing application configuration...\n');

  // Test 1: Configuration validation
  console.log('1. Validating configuration...');
  const validation = validateConfig();
  
  if (validation.valid) {
    console.log('✅ Configuration is valid');
  } else {
    console.log('❌ Configuration validation failed:');
    validation.errors.forEach(error => console.log(`   - ${error}`));
  }

  // Test 2: Environment check
  console.log('\n2. Environment information:');
  console.log(`   - Environment: ${config.app.environment}`);
  console.log(`   - Port: ${config.app.port}`);
  console.log(`   - Base URL: ${config.app.baseUrl}`);
  console.log(`   - AWS Region: ${config.aws.region}`);
  console.log(`   - S3 Bucket: ${config.aws.s3.bucketName}`);

  // Test 3: AWS credentials check
  console.log('\n3. AWS credentials check:');
  const hasAwsCredentials = config.aws.accessKeyId && config.aws.secretAccessKey;
  console.log(`   - AWS Access Key: ${config.aws.accessKeyId ? '✅ Set' : '❌ Missing'}`);
  console.log(`   - AWS Secret Key: ${config.aws.secretAccessKey ? '✅ Set' : '❌ Missing'}`);

  // Test 4: OpenAI credentials check
  console.log('\n4. OpenAI credentials check:');
  console.log(`   - OpenAI API Key: ${config.openai.apiKey ? '✅ Set' : '❌ Missing'}`);
  console.log(`   - OpenAI Org ID: ${config.openai.organizationId ? '✅ Set' : '❌ Missing'}`);

  // Test 5: AWS health check (if credentials are available)
  if (hasAwsCredentials) {
    console.log('\n5. AWS health check:');
    try {
      const awsHealth = await checkAWSHealth();
      console.log(`   - S3 Health: ${awsHealth.s3 ? '✅ Healthy' : '❌ Unhealthy'}`);
      console.log(`   - CloudFront Health: ${awsHealth.cloudfront ? '✅ Healthy' : '❌ Unhealthy'}`);
      
      if (awsHealth.errors.length > 0) {
        console.log('   - Errors:');
        awsHealth.errors.forEach(error => console.log(`     - ${error}`));
      }
    } catch (error) {
      console.log(`   - ❌ AWS health check failed: ${error}`);
    }
  } else {
    console.log('\n5. AWS health check: ⏭️ Skipped (no credentials)');
  }

  // Test 6: Required packages check
  console.log('\n6. Required packages check:');
  const requiredPackages = [
    '@aws-sdk/client-s3',
    '@aws-sdk/client-polly',
    'openai',
    '@prisma/client',
    'sharp',
  ];

  for (const pkg of requiredPackages) {
    try {
      await import(pkg);
      console.log(`   - ${pkg}: ✅ Available`);
    } catch (error) {
      console.log(`   - ${pkg}: ❌ Missing`);
    }
  }

  console.log('\n🎉 Configuration test completed!');
}

if (require.main === module) {
  testConfiguration().catch(console.error);
}

export { testConfiguration };
