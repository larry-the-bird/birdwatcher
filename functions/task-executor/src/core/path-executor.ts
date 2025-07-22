import { BrowserExecutor } from '../utils/browser-executor';
import { ExecutionPath, PathExecutionResult, Step } from '../../types';

export class PathExecutor {
  constructor(private browser: BrowserExecutor) {}

  async executePath(path: ExecutionPath): Promise<PathExecutionResult> {
    console.log(`🚀 Executing saved path for task: ${path.taskId}`);
    
    let extractedData: any = {};
    
    try {
      for (let i = 0; i < path.steps.length; i++) {
        const step = path.steps[i];
        console.log(`📍 Step ${i + 1}/${path.steps.length}: ${step.action}`);
        
        try {
          const result = await this.executeStep(step);
          
          // Collect extracted data
          if (step.action === 'extract' && result) {
            // Handle string results properly
            if (typeof result === 'string') {
              const key = `extracted_${Object.keys(extractedData).length + 1}`;
              extractedData[key] = result;
            } else {
              extractedData = { ...extractedData, ...result };
            }
          }
        } catch (error) {
          console.error(`❌ Step ${i + 1} failed:`, error);
          return {
            success: false,
            error: error as Error,
            failedAtStep: i
          };
        }
      }
      
      console.log('✅ Path execution completed successfully');
      return {
        success: true,
        extractedData
      };
      
    } catch (error) {
      console.error('❌ Path execution failed:', error);
      return {
        success: false,
        error: error as Error
      };
    }
  }

  private async executeStep(step: Step): Promise<any> {
    // Wait for selector if needed
    if (step.waitBeforeAction && step.selector) {
      console.log(`⏳ Waiting for selector: ${step.selector}`);
      await this.browser.waitForSelector(step.selector, { timeout: 30000 });
    }

    switch (step.action) {
      case 'navigate':
        if (!step.url) throw new Error('Navigate step requires URL');
        console.log(`🌐 Navigating to: ${step.url}`);
        return await this.browser.navigate(step.url);
        
      case 'click':
        if (!step.selector) throw new Error('Click step requires selector');
        console.log(`🖱️ Clicking: ${step.selector}`);
        return await this.browser.click(step.selector);
        
      case 'type':
        if (!step.selector || step.value === undefined) {
          throw new Error('Type step requires selector and value');
        }
        console.log(`⌨️ Typing into ${step.selector}: ${step.value}`);
        return await this.browser.type(step.selector, step.value);
        
      case 'extract':
        if (!step.selector) throw new Error('Extract step requires selector');
        console.log(`📊 Extracting data from: ${step.selector}`);
        return await this.browser.extract(step.selector);
        
      default:
        throw new Error(`Unknown step action: ${step.action}`);
    }
  }
}