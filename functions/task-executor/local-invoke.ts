#!/usr/bin/env tsx

import 'dotenv/config';
import { handler } from './index';
import { TaskInput } from './types';

/**
 * Local lambda function invocation for testing
 * Usage: npm run invoke [payload-file] or tsx local-invoke.ts [payload-file]
 */

// Sample payloads for testing
const samplePayloads = {
  simple: {
    instruction: 'Extract the title of the page',
    url: 'https://example.com',
    options: {
      timeout: 30000,
      screenshot: true,
    },
  } as TaskInput,

  ecommerce: {
    instruction: 'Find the price and availability of the main product',
    url: 'https://www.apple.com/iphone-15-pro/',
    options: {
      timeout: 45000,
      screenshot: true,
      viewport: {
        width: 1920,
        height: 1080,
      },
    },
  } as TaskInput,

  search: {
    instruction: 'Search for "TypeScript" and get the top 3 results',
    url: 'https://www.google.com',
    options: {
      timeout: 60000,
      screenshot: true,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  } as TaskInput,

  news: {
    instruction: 'Extract the main headline and first 3 article titles',
    url: 'https://news.ycombinator.com',
    options: {
      timeout: 30000,
      screenshot: false,
    },
  } as TaskInput,

  apiGateway: {
    body: JSON.stringify({
      instruction: 'Extract product information from this page',
      url: 'https://httpbin.org/html',
      options: {
        timeout: 20000,
        screenshot: true,
      },
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    httpMethod: 'POST',
    path: '/execute',
    requestContext: {
      requestId: 'local-test-123',
    },
  },
};

async function invokeLocal(payloadName?: string) {
  console.log('🚀 Local Lambda Invocation Started');
  console.log('=====================================');

  // Validate environment
  const requiredEnvVars = ['DATABASE_URL'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.warn('⚠️  Missing environment variables:', missingVars.join(', '));
    console.warn('   Some functionality may not work properly.');
  }

  // Determine which payload to use
  const availablePayloads = Object.keys(samplePayloads);
  
  if (payloadName && !availablePayloads.includes(payloadName)) {
    console.error(`❌ Unknown payload: ${payloadName}`);
    console.log('Available payloads:', availablePayloads.join(', '));
    process.exit(1);
  }

  const selectedPayload = payloadName || 'simple';
  const payload = samplePayloads[selectedPayload as keyof typeof samplePayloads];

  console.log(`📦 Using payload: ${selectedPayload}`);
  console.log('📋 Payload:', JSON.stringify(payload, null, 2));
  console.log('');

  try {
    const startTime = Date.now();
    console.log('⏳ Invoking lambda handler...');
    
    const result = await handler(payload);
    
    const executionTime = Date.now() - startTime;
    
    console.log('✅ Lambda execution completed');
    console.log(`⏱️  Execution time: ${executionTime}ms`);
    console.log('📄 Response:');
    console.log('=====================================');
    
    // Pretty print the response
    if (result.body) {
      try {
        const parsedBody = JSON.parse(result.body);
        console.log('Status Code:', result.statusCode);
        console.log('Headers:', JSON.stringify(result.headers, null, 2));
        console.log('Body:', JSON.stringify(parsedBody, null, 2));
        
        // Additional analysis
        if (parsedBody.success) {
          console.log('\n🎉 Execution successful!');
          if (parsedBody.extractedData) {
            console.log('📊 Extracted Data Keys:', Object.keys(parsedBody.extractedData));
          }
          if (parsedBody.metrics) {
            console.log('📈 Metrics:');
            console.log(`   - Steps: ${parsedBody.metrics.stepsCompleted}/${parsedBody.metrics.stepsTotal}`);
            console.log(`   - Execution Time: ${parsedBody.metrics.executionTime}ms`);
            console.log(`   - Retries: ${parsedBody.metrics.retryCount}`);
            if (parsedBody.metrics.cacheHit !== undefined) {
              console.log(`   - Cache Hit: ${parsedBody.metrics.cacheHit}`);
            }
          }
        } else {
          console.log('\n❌ Execution failed');
          if (parsedBody.error) {
            console.log('Error:', parsedBody.error.message);
            if (parsedBody.error.step) {
              console.log('Failed Step:', parsedBody.error.step);
            }
          }
        }
      } catch (parseError) {
        console.log('Raw Response Body:', result.body);
      }
    } else {
      console.log('Raw Result:', JSON.stringify(result, null, 2));
    }

  } catch (error) {
    console.error('❌ Lambda execution failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Handle command line arguments
const payloadName = process.argv[2];

if (payloadName === '--help' || payloadName === '-h') {
  console.log('Local Lambda Invocation Tool');
  console.log('=============================');
  console.log('Usage: npm run invoke [payload-name]');
  console.log('       tsx local-invoke.ts [payload-name]');
  console.log('');
  console.log('Available payloads:');
  Object.keys(samplePayloads).forEach(name => {
    console.log(`  - ${name}`);
  });
  console.log('');
  console.log('Examples:');
  console.log('  npm run invoke simple');
  console.log('  npm run invoke ecommerce');
  console.log('  tsx local-invoke.ts news');
  process.exit(0);
}

// Run the invocation
invokeLocal(payloadName).catch(console.error);