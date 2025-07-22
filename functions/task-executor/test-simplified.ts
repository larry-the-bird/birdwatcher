import { SimplifiedTaskHandler } from './src/handlers/simplified-handler';
import { Task } from './types';

async function testSimplifiedFlow() {
  console.log('🧪 Testing Simplified ReAct Flow\n');
  
  const handler = new SimplifiedTaskHandler('./test-paths');
  
  // Test task
  const task: Task = {
    id: 'coffee-price-check',
    url: 'https://www.google.com',
    instruction: 'Search for "coffee prices stockholm" and extract the first result'
  };
  
  // First execution - should use AI to explore
  console.log('=== FIRST EXECUTION (AI Exploration) ===\n');
  const firstRun = await handler.executeTask(task);
  console.log('First run result:', {
    success: firstRun.success,
    usedSavedPath: firstRun.usedSavedPath,
    hasData: !!firstRun.extractedData
  });
  
  if (firstRun.success) {
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Second execution - should use saved path
    console.log('\n=== SECOND EXECUTION (Saved Path) ===\n');
    const secondRun = await handler.executeTask(task);
    console.log('Second run result:', {
      success: secondRun.success,
      usedSavedPath: secondRun.usedSavedPath,
      hasData: !!secondRun.extractedData
    });
    
    // List saved paths
    console.log('\n=== SAVED PATHS ===');
    const savedPaths = await handler.listSavedPaths();
    console.log('Currently saved paths:', savedPaths);
    
    // Clear the path
    console.log('\n=== CLEARING PATH ===');
    await handler.clearPath(task.id);
    
    // Third execution - should use AI again
    console.log('\n=== THIRD EXECUTION (AI Exploration Again) ===\n');
    const thirdRun = await handler.executeTask(task);
    console.log('Third run result:', {
      success: thirdRun.success,
      usedSavedPath: thirdRun.usedSavedPath,
      hasData: !!thirdRun.extractedData
    });
  }
  
  console.log('\n✅ Test completed');
}

// Run the test
if (require.main === module) {
  testSimplifiedFlow().catch(console.error);
}