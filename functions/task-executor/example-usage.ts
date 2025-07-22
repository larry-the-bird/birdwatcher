import 'dotenv/config';
import { SimplifiedTaskHandler } from './src/handlers/simplified-handler';
import { Task } from './types';

/**
 * Example usage of the simplified ReAct task executor
 * 
 * This demonstrates the complete flow:
 * 1. First run uses AI to explore and find a working path
 * 2. Second run uses the saved path (no AI)
 * 3. If the saved path fails, it automatically re-explores with AI
 */
async function runExample() {
  console.log('🚀 Simplified ReAct Task Executor Example\n');
  
  const handler = new SimplifiedTaskHandler('./example-paths');
  
  // Define a simple task
  const searchTask: Task = {
    id: 'coffee-roasting-date',
    url: 'https://www.kaffecompagniet.se/kaffe/kaffebonor-pods-kapslar/kaffebonor-pods/single-estate-brygg-espr/gringo-etiopien-guji-organic-250-g-102685',
    instruction: 'Extract the roasting date from the coffee product page'
  };
  
  console.log('Task Details:');
  console.log(`- ID: ${searchTask.id}`);
  console.log(`- URL: ${searchTask.url}`);
  console.log(`- Instruction: ${searchTask.instruction}\n`);
  
  try {
    // First run - AI exploration
    console.log('=== FIRST RUN (AI Exploration) ===\n');
    const firstResult = await handler.executeTask(searchTask);
    
    console.log('First run result:');
    console.log(JSON.stringify(firstResult, null, 2));
    console.log('\n' + '='.repeat(50) + '\n');
    
    if (firstResult.success) {
      // Wait a moment before second run
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Second run - should use saved path
      console.log('=== SECOND RUN (Using Saved Path) ===\n');
      const secondResult = await handler.executeTask(searchTask);
      
      console.log('Second run result:');
      console.log(JSON.stringify(secondResult, null, 2));
      console.log('\n' + '='.repeat(50) + '\n');
      
      // List all saved paths
      console.log('=== SAVED PATHS ===');
      const savedPaths = await handler.listSavedPaths();
      console.log('Currently saved paths:', savedPaths);
      
      // Demonstrate clearing a path
      console.log('\n=== CLEARING PATH ===');
      await handler.clearPath(searchTask.id);
      console.log(`Cleared path for task: ${searchTask.id}`);
      
      // Verify path is cleared
      const remainingPaths = await handler.listSavedPaths();
      console.log('Remaining paths:', remainingPaths);
    }
    
  } catch (error) {
    console.error('Example failed:', error);
  }
}

// Additional example with a different task
async function runEcommerceExample() {
  console.log('\n\n🛒 E-commerce Example\n');
  
  const handler = new SimplifiedTaskHandler('./example-paths');
  
  const ecommerceTask: Task = {
    id: 'amazon-product-price',
    url: 'https://www.amazon.com/dp/B08N5WRWNW',  // Echo Dot product page
    instruction: 'Extract the product title and current price'
  };
  
  console.log('E-commerce Task:');
  console.log(`- ID: ${ecommerceTask.id}`);
  console.log(`- URL: ${ecommerceTask.url}`);
  console.log(`- Instruction: ${ecommerceTask.instruction}\n`);
  
  const result = await handler.executeTask(ecommerceTask);
  
  console.log('Result:');
  console.log(JSON.stringify(result, null, 2));
}

// Run examples
if (require.main === module) {
  (async () => {
    try {
      await runExample();
      // Uncomment to run e-commerce example
      // await runEcommerceExample();
    } catch (error) {
      console.error('Fatal error:', error);
      process.exit(1);
    }
  })();
}