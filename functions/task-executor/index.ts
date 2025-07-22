import 'dotenv/config';
import { SimplifiedTaskHandler } from './src/handlers/simplified-handler';
import { Task } from './types';

/**
 * Simplified Lambda handler for ReAct-based task execution
 * 
 * Flow:
 * 1. First run: AI explores using ReAct to find working path, saves it
 * 2. Subsequent runs: Execute saved path without AI
 * 3. On failure: Delete saved path and re-explore with AI
 */
export async function handler(event: any): Promise<any> {
  const startTime = Date.now();
  
  try {
    // Parse input
    const task: Task = {
      id: event.taskId || event.id,
      url: event.url,
      instruction: event.instruction
    };

    // Validate required fields
    if (!task.id || !task.url || !task.instruction) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Missing required fields: id, url, instruction'
        })
      };
    }

    console.log('='.repeat(60));
    console.log('SIMPLIFIED REACT TASK EXECUTOR');
    console.log('='.repeat(60));

    // Execute task using simplified handler
    const handler = new SimplifiedTaskHandler();
    const result = await handler.executeTask(task);

    const executionTime = Date.now() - startTime;

    return {
      statusCode: result.success ? 200 : 500,
      body: JSON.stringify({
        ...result,
        executionTime: `${executionTime}ms`,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Fatal error:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: (error as Error).message || 'Internal server error',
        timestamp: new Date().toISOString()
      })
    };
  }
}

// For local testing
if (require.main === module) {
  (async () => {
    const testEvent = {
      id: 'test-google-search',
      url: 'https://www.google.com',
      instruction: 'Search for "OpenAI GPT-4" and extract the first search result title'
    };

    console.log('Running local test...\n');
    const result = await handler(testEvent);
    console.log('\nResult:', JSON.stringify(JSON.parse(result.body), null, 2));
  })();
}