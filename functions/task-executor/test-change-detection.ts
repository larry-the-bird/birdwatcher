#!/usr/bin/env tsx

import 'dotenv/config';
import { SimplifiedTaskHandler } from './src/handlers/simplified-handler';
import { Task } from './types';

/**
 * Test Change Detection
 * 
 * This script demonstrates change detection by simulating different roasting dates
 * to show how the system detects changes between executions.
 */

async function testChangeDetection() {
  console.log('🔍 Testing Change Detection');
  console.log('=' .repeat(50));

  const handler = new SimplifiedTaskHandler();
  
  // First execution with original date
  console.log('\n🔄 Execution 1: Running with current data...');
  
  const task1: Task = {
    id: 'coffee-change-test',
    url: 'https://www.kaffecompagniet.se/kaffe/bolivien-la-merced-honey',
    instruction: 'Extract the roasting date and return as JSON with field "roastingDate"'
  };

  try {
    const result1 = await handler.executeTask(task1);
    console.log('Result 1:', JSON.stringify(result1.extractedData, null, 2));
    console.log('Changes detected:', result1.changesDetected);
    
    // Wait a moment, then simulate a different extraction result
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('\n🔄 Execution 2: Simulating changed data...');
    
    // Simulate changed data by manually calling the database service
    const fakeChangedData = {
      roastingDate: '2025-07-23',  // Different date
      availability: 'in stock',    // Additional field
      price: '149 kr'             // Additional field
    };
    
    // Create a new execution result with different data
    const executionId2 = await handler['db'].saveExecutionResult({
      taskId: 'coffee-change-test',
      status: 'success',
      result: fakeChangedData,
      executionTime: 1500
    });
    
    const changeResult = await handler['handleMonitoringAndChangeDetection'](
      task1, 
      fakeChangedData, 
      executionId2
    );
    
    console.log('Result 2:', JSON.stringify(fakeChangedData, null, 2));
    console.log('Changes detected:', changeResult.changesDetected);
    if (changeResult.changeDetails) {
      console.log('Change details:', JSON.stringify(changeResult.changeDetails, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

if (require.main === module) {
  testChangeDetection()
    .then(() => {
      console.log('\n✅ Change detection test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test failed:', error);
      process.exit(1);
    });
}