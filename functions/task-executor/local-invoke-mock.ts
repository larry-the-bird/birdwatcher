#!/usr/bin/env tsx

import 'dotenv/config';
import { TaskInput, ExecutionResult, ExecutionPlan } from './types';

/**
 * Mock local lambda invocation without external dependencies
 * This bypasses database and LLM calls for pure local testing
 */

// Mock execution plans for testing
const mockPlans: Record<string, ExecutionPlan> = {
  simple: {
    id: 'mock-plan-simple',
    taskSignature: 'simple-test',
    instruction: 'Extract the title of the page',
    url: 'https://example.com',
    steps: [
      {
        id: 'step-1',
        type: 'navigate',
        description: 'Navigate to the target page',
        value: 'https://example.com',
      },
      {
        id: 'step-2',
        type: 'extract',
        description: 'Extract page title',
        selector: 'title',
      },
    ],
    expectedResults: ['page title'],
    errorHandling: {
      retryCount: 3,
      timeoutMs: 30000,
    },
    validation: {
      successCriteria: ['Title extracted successfully'],
      failureCriteria: ['Page not found', 'Title not found'],
    },
    metadata: {
      createdAt: new Date(),
      llmModel: 'mock-gpt-4',
      confidence: 0.95,
      estimatedDuration: 8000,
    },
  },
  ecommerce: {
    id: 'mock-plan-ecommerce',
    taskSignature: 'ecommerce-test',
    instruction: 'Find product price and availability',
    url: 'https://shop.example.com',
    steps: [
      {
        id: 'step-1',
        type: 'navigate',
        description: 'Navigate to product page',
        value: 'https://shop.example.com',
      },
      {
        id: 'step-2',
        type: 'waitForSelector',
        description: 'Wait for page to load',
        selector: '.product-container',
      },
      {
        id: 'step-3',
        type: 'extract',
        description: 'Extract product price',
        selector: '.price',
      },
      {
        id: 'step-4',
        type: 'extract',
        description: 'Extract availability status',
        selector: '.availability',
      },
    ],
    expectedResults: ['price', 'availability'],
    errorHandling: {
      retryCount: 3,
      timeoutMs: 45000,
    },
    validation: {
      successCriteria: ['Price found', 'Availability found'],
      failureCriteria: ['Product not found', 'Page error'],
    },
    metadata: {
      createdAt: new Date(),
      llmModel: 'mock-gpt-4',
      confidence: 0.88,
      estimatedDuration: 15000,
    },
  },
};

// Mock browser execution results
const mockExecutionResults: Record<string, ExecutionResult> = {
  simple: {
    planId: 'mock-plan-simple',
    status: 'success',
    extractedData: {
      title: 'Example Domain',
      pageContent: 'This domain is for use in illustrative examples in documents.',
    },
    screenshots: ['mock-screenshot-base64-data'],
    logs: [
      {
        timestamp: new Date(),
        level: 'info',
        message: 'Navigation completed successfully',
        stepId: 'step-1',
      },
      {
        timestamp: new Date(),
        level: 'info',
        message: 'Title extracted: "Example Domain"',
        stepId: 'step-2',
        data: { extractedText: 'Example Domain' },
      },
    ],
    metrics: {
      executionTime: 7500,
      stepsCompleted: 2,
      stepsTotal: 2,
      retryCount: 0,
    },
    createdAt: new Date(),
  },
  ecommerce: {
    planId: 'mock-plan-ecommerce',
    status: 'success',
    extractedData: {
      price: '$299.99',
      availability: 'In Stock',
      productName: 'Premium Widget',
      rating: '4.5 stars',
    },
    screenshots: ['mock-ecommerce-screenshot-data'],
    logs: [
      {
        timestamp: new Date(),
        level: 'info',
        message: 'Navigated to product page',
        stepId: 'step-1',
      },
      {
        timestamp: new Date(),
        level: 'info',
        message: 'Page loaded successfully',
        stepId: 'step-2',
      },
      {
        timestamp: new Date(),
        level: 'info',
        message: 'Price extracted: $299.99',
        stepId: 'step-3',
        data: { price: '$299.99' },
      },
      {
        timestamp: new Date(),
        level: 'info',
        message: 'Availability extracted: In Stock',
        stepId: 'step-4',
        data: { availability: 'In Stock' },
      },
    ],
    metrics: {
      executionTime: 12300,
      stepsCompleted: 4,
      stepsTotal: 4,
      retryCount: 0,
    },
    createdAt: new Date(),
  },
  error: {
    planId: 'mock-plan-error',
    status: 'failed',
    error: {
      message: 'Element not found: .non-existent-selector',
      stack: 'BrowserExecutionError: Element not found...',
      step: 'step-2',
    },
    logs: [
      {
        timestamp: new Date(),
        level: 'info',
        message: 'Navigation completed',
        stepId: 'step-1',
      },
      {
        timestamp: new Date(),
        level: 'error',
        message: 'Failed to find selector: .non-existent-selector',
        stepId: 'step-2',
        data: { selector: '.non-existent-selector', retryAttempts: 3 },
      },
    ],
    metrics: {
      executionTime: 18500,
      stepsCompleted: 1,
      stepsTotal: 2,
      retryCount: 3,
    },
    createdAt: new Date(),
  },
  timeout: {
    planId: 'mock-plan-timeout',
    status: 'timeout',
    error: {
      message: 'Execution timed out after 30000ms',
      step: 'step-2',
    },
    extractedData: {
      partialData: 'Some data extracted before timeout',
    },
    logs: [
      {
        timestamp: new Date(),
        level: 'info',
        message: 'Navigation started',
        stepId: 'step-1',
      },
      {
        timestamp: new Date(),
        level: 'warn',
        message: 'Page loading slowly',
        stepId: 'step-2',
      },
      {
        timestamp: new Date(),
        level: 'error',
        message: 'Timeout reached',
        stepId: 'step-2',
      },
    ],
    metrics: {
      executionTime: 30000,
      stepsCompleted: 1,
      stepsTotal: 3,
      retryCount: 0,
    },
    createdAt: new Date(),
  },
};

async function mockHandler(input: TaskInput | any): Promise<any> {
  console.log('🤖 Mock Lambda Handler (No External Dependencies)');
  
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));
  
  // Parse input
  let taskInput: TaskInput;
  
  if (input.body) {
    // API Gateway format
    try {
      taskInput = JSON.parse(input.body);
    } catch (error) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: {
            message: 'Invalid JSON in request body',
            type: 'ValidationError',
          },
        }),
      };
    }
  } else {
    taskInput = input;
  }
  
  // Validate input
  if (!taskInput.instruction || !taskInput.url) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: {
          message: 'Missing required fields: instruction and url',
          type: 'ValidationError',
        },
      }),
    };
  }
  
  // Determine mock scenario based on instruction
  let scenario = 'simple';
  if (taskInput.instruction.toLowerCase().includes('price') || 
      taskInput.instruction.toLowerCase().includes('product')) {
    scenario = 'ecommerce';
  } else if (taskInput.instruction.toLowerCase().includes('error')) {
    scenario = 'error';
  } else if (taskInput.instruction.toLowerCase().includes('timeout')) {
    scenario = 'timeout';
  }
  
  const executionResult = mockExecutionResults[scenario];
  const plan = mockPlans[scenario] || mockPlans.simple;
  
  // Simulate cache behavior
  const cacheHit = Math.random() > 0.3; // 70% cache hit rate
  
  const response = {
    statusCode: executionResult.status === 'success' ? 200 : 422,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': `mock-${Date.now()}`,
    },
    body: JSON.stringify({
      success: executionResult.status === 'success',
      planId: plan.id,
      taskId: taskInput.taskId || undefined,
      status: executionResult.status,
      extractedData: executionResult.extractedData || undefined,
      screenshots: executionResult.screenshots?.length || 0,
      error: executionResult.error || undefined,
      metrics: {
        ...executionResult.metrics,
        totalTime: executionResult.metrics.executionTime + (cacheHit ? 0 : 2000),
        cacheHit,
        planGenerationTime: cacheHit ? 0 : 2000,
      },
      logs: executionResult.logs.slice(0, 3), // Limit logs for readability
    }),
  };
  
  return response;
}

// Sample payloads for mock testing
const mockPayloads = {
  simple: {
    instruction: 'Extract the page title and main heading',
    url: 'https://example.com',
    options: { timeout: 30000, screenshot: true },
  } as TaskInput,
  
  ecommerce: {
    instruction: 'Find the product price and availability status',
    url: 'https://shop.example.com/product/123',
    options: { timeout: 45000, screenshot: true },
  } as TaskInput,
  
  error: {
    instruction: 'Test error handling with invalid selector',
    url: 'https://example.com',
    options: { timeout: 20000 },
  } as TaskInput,
  
  timeout: {
    instruction: 'Test timeout scenario with slow loading',
    url: 'https://slow.example.com',
    options: { timeout: 30000 },
  } as TaskInput,
  
  apiGateway: {
    body: JSON.stringify({
      instruction: 'Extract metadata from API Gateway format',
      url: 'https://api.example.com/data',
      options: { timeout: 25000 },
    }),
    headers: { 'Content-Type': 'application/json' },
    httpMethod: 'POST',
    requestContext: { requestId: 'mock-api-123' },
  },
};

async function invokeMock(scenario?: string) {
  console.log('🧪 Mock Lambda Function Testing');
  console.log('==============================');
  console.log('ℹ️  This bypasses all external dependencies (DB, LLM, Browser)');
  console.log('');
  
  const availableScenarios = Object.keys(mockPayloads);
  
  if (scenario && !availableScenarios.includes(scenario)) {
    console.error(`❌ Unknown scenario: ${scenario}`);
    console.log('Available scenarios:', availableScenarios.join(', '));
    process.exit(1);
  }
  
  const selectedScenario = scenario || 'simple';
  const payload = mockPayloads[selectedScenario as keyof typeof mockPayloads];
  
  console.log(`📦 Testing scenario: ${selectedScenario}`);
  console.log('📋 Payload:', JSON.stringify(payload, null, 2));
  console.log('');
  
  try {
    const startTime = Date.now();
    console.log('⏳ Invoking mock handler...');
    
    const result = await mockHandler(payload);
    const executionTime = Date.now() - startTime;
    
    console.log('✅ Mock execution completed');
    console.log(`⏱️  Execution time: ${executionTime}ms`);
    console.log('📄 Response:');
    console.log('==============================');
    
    console.log('Status Code:', result.statusCode);
    console.log('Headers:', JSON.stringify(result.headers, null, 2));
    
    const body = JSON.parse(result.body);
    console.log('Body:', JSON.stringify(body, null, 2));
    
    // Analysis
    if (body.success) {
      console.log('\n🎉 Mock execution successful!');
      if (body.extractedData) {
        console.log('📊 Mock Data Extracted:', Object.keys(body.extractedData));
      }
      if (body.metrics) {
        console.log('📈 Mock Metrics:');
        console.log(`   - Steps: ${body.metrics.stepsCompleted}/${body.metrics.stepsTotal}`);
        console.log(`   - Execution Time: ${body.metrics.executionTime}ms`);
        console.log(`   - Cache Hit: ${body.metrics.cacheHit}`);
      }
    } else {
      console.log('\n❌ Mock execution failed (as expected for error scenarios)');
      if (body.error) {
        console.log('Error Type:', body.error.type || 'Unknown');
        console.log('Error Message:', body.error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Mock execution error:', error);
  }
}

// Handle command line arguments
const scenario = process.argv[2];

if (scenario === '--help' || scenario === '-h') {
  console.log('Mock Lambda Invocation Tool');
  console.log('===========================');
  console.log('Usage: tsx local-invoke-mock.ts [scenario]');
  console.log('       npm run invoke:mock [scenario]');
  console.log('');
  console.log('Available scenarios:');
  Object.keys(mockPayloads).forEach(name => {
    console.log(`  - ${name}`);
  });
  process.exit(0);
}

// Run the mock invocation
invokeMock(scenario).catch(console.error);