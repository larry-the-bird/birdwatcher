import { BrowserExecutor } from '../utils/browser-executor';
import { BaseLLM } from '../../llm/base-llm';
import { Task, Step, ExplorationResult } from '../../types';

interface ReactStep {
  thought: string;
  action: {
    type: 'navigate' | 'click' | 'type' | 'extract' | 'complete';
    selector?: string;
    url?: string;
    value?: string;
  };
  expectation: string;
}

interface ExploreOptions {
  maxSteps?: number;
  maxRetries?: number;
}

export class ReactAgent {
  constructor(
    private browser: BrowserExecutor,
    private llm: BaseLLM
  ) {}

  async explorePath(task: Task, options: ExploreOptions = {}): Promise<ExplorationResult> {
    const { maxSteps = 10, maxRetries = 3 } = options;
    const successfulSteps: Step[] = [];
    let extractedData: any = {};
    let currentRetry = 0;

    console.log(`🔍 Starting ReAct exploration for task: ${task.id}`);

    try {
      // Navigate to the initial URL
      await this.browser.navigate(task.url);
      
      for (let stepCount = 0; stepCount < maxSteps; stepCount++) {
        // Get current browser state
        const browserState = await this.getBrowserState();
        
        // Generate next action using ReAct approach
        const reactStep = await this.generateNextAction(
          task,
          browserState,
          successfulSteps,
          extractedData
        );

        // Validate the response
        if (!reactStep || !reactStep.action || !reactStep.action.type) {
          console.log('❌ Invalid ReAct step response:', reactStep);
          throw new Error('Invalid ReAct step: missing action or action.type');
        }

        console.log(`💭 Step ${stepCount + 1}: ${reactStep.thought}`);
        console.log(`🎯 Action: ${reactStep.action.type} ${reactStep.action.selector || ''}`);

        // Check if task is complete
        if (reactStep.action.type === 'complete') {
          console.log('✅ Task completed successfully');
          return {
            success: true,
            path: successfulSteps,
            extractedData
          };
        }

        // Execute the action
        try {
          const result = await this.executeAction(reactStep.action);
          console.log(`✅ Action succeeded, result:`, result);
          
          // Record successful step (excluding complete action)
          const step: Step = {
            action: reactStep.action.type as 'navigate' | 'click' | 'type' | 'extract',
            ...(reactStep.action.selector && { selector: reactStep.action.selector }),
            ...(reactStep.action.url && { url: reactStep.action.url }),
            ...(reactStep.action.value && { value: reactStep.action.value })
          };
          
          successfulSteps.push(step);

          // Collect extracted data
          if (reactStep.action.type === 'extract' && result) {
            // Handle string results from browser extraction generically
            if (typeof result === 'string') {
              // Use a generic key or derive from selector
              const key = `extracted_${Object.keys(extractedData).length + 1}`;
              extractedData[key] = result;
            } else {
              extractedData = { ...extractedData, ...result };
            }
            console.log(`📊 Extracted data:`, extractedData);
          }

          currentRetry = 0; // Reset retry counter on success
        } catch (error) {
          console.error(`❌ Action failed: ${(error as Error).message}`);
          currentRetry++;

          if (currentRetry >= maxRetries) {
            throw new Error(`Max retries (${maxRetries}) exceeded for action`);
          }

          console.log(`🔄 Retrying with different approach (${currentRetry}/${maxRetries})`);
        }
      }

      // Max steps reached without completion
      throw new Error(`Max steps (${maxSteps}) reached without completing task`);

    } catch (error) {
      console.error('❌ Exploration failed:', error);
      return {
        success: false,
        path: [],
        error: error as Error
      };
    }
  }

  private async getBrowserState(): Promise<string> {
    // Get minimal page info and only the most relevant text
    const pageData = await this.browser.evaluate(() => {
      // Look specifically for date-related content
      const relevantText: string[] = [];
      
      // Search for elements containing roasting date patterns
      document.querySelectorAll('*').forEach((el) => {
        if (relevantText.length >= 3) return; // Limit to 3 most relevant items
        
        const text = el.textContent?.trim() || '';
        const element = el as HTMLElement;
        
        // Only look at leaf elements (no child elements with text)
        const hasTextChildren = Array.from(el.children).some(child => 
          (child as HTMLElement).textContent?.trim()
        );
        
        if (text.length > 5 && text.length < 100 && element.offsetParent !== null && !hasTextChildren) {
          // Look for any potentially extractable content (dates, numbers, meaningful text)
          const hasExtractableContent = 
            text.match(/\d{4}-\d{2}-\d{2}/) ||                                    // ISO dates
            text.match(/\d{1,2}\/\d{1,2}\/\d{4}/) ||                            // US dates  
            text.match(/\d{1,2}\.\d{1,2}\.\d{4}/) ||                            // EU dates
            text.match(/\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}/i) || // Text dates
            text.match(/\$\d+/) ||                                              // Prices
            text.match(/€\d+/) ||                                               // Euro prices
            text.match(/\d+\s*(kg|g|lb|oz|ml|l)/i) ||                          // Weights/volumes
            (text.length > 20 && text.length < 80);                            // Descriptive text
          
          if (hasExtractableContent) {
            // Create a more specific selector
            let selector = '';
            if (el.id) {
              selector = `#${el.id}`;
            } else if (el.className && el.className.trim()) {
              selector = `.${el.className.split(' ')[0]}`;
            } else {
              // Create path-based selector
              let path = el.tagName.toLowerCase();
              let parent = el.parentElement;
              let depth = 0;
              while (parent && depth < 3) {
                if (parent.id) {
                  path = `#${parent.id} ${path}`;
                  break;
                } else if (parent.className) {
                  path = `.${parent.className.split(' ')[0]} ${path}`;
                  break;
                }
                parent = parent.parentElement;
                depth++;
              }
              selector = path;
            }
            
            relevantText.push(`${selector}: "${text}"`);
          }
        }
      });
      
      return {
        title: document.title.substring(0, 100), // Limit title length
        relevantText
      };
    });
    
    if (pageData.relevantText.length === 0) {
      return `Page: ${pageData.title}\nNo extractable content found on visible elements.`;
    }
    
    // Format for AI to understand the selectors vs content
    const selectorInfo = pageData.relevantText.map((item: string) => {
      const [selector, text] = item.split(': "');
      const cleanText = text?.replace('"', '') || '';
      return `Selector: ${selector}\nContent: ${cleanText}`;
    }).join('\n\n');
    
    return `Page: ${pageData.title}\n\nEXTRACTABLE CONTENT FOUND:\n${selectorInfo}\n\nUse the "Selector" value for extraction.`;
  }

  private async generateNextAction(
    task: Task,
    browserState: string,
    completedSteps: Step[],
    currentData: any
  ): Promise<ReactStep> {
    // Keep the prompt very short to avoid context length issues
    const hasData = Object.keys(currentData).length > 0;
    const prompt = `Task: ${task.instruction}

${browserState}

Completed steps: ${completedSteps.length}
Current data: ${hasData ? JSON.stringify(currentData) : 'None'}

${hasData ? 'TASK COMPLETE! Data extracted successfully. Use action type "complete".' : 'No data yet. Extract using available selector.'}

JSON response:
{
  "thought": "Brief reason",
  "action": {"type": "${hasData ? 'complete' : 'extract'}", ${hasData ? '' : '"selector": "selector from above"'}},
  "expectation": "Expected outcome"
}`;

    try {
      const response = await this.llm.generateStructuredOutput<ReactStep>(prompt, {
        thought: 'string',
        action: {
          type: 'string',
          selector: 'string?',
          url: 'string?',
          value: 'string?'
        },
        expectation: 'string'
      } as any);
      
      // Validate the response
      if (!response || !response.action || !response.action.type) {
        console.log('❌ LLM returned invalid response:', response);
        throw new Error('LLM returned invalid ReAct step structure');
      }
      
      return response;
    } catch (error) {
      console.error('❌ Failed to generate ReAct step:', error);
      throw error;
    }
  }

  private async executeAction(action: ReactStep['action']): Promise<any> {
    switch (action.type) {
      case 'navigate':
        if (!action.url) throw new Error('Navigate action requires URL');
        return await this.browser.navigate(action.url);
        
      case 'click':
        if (!action.selector) throw new Error('Click action requires selector');
        return await this.browser.click(action.selector);
        
      case 'type':
        if (!action.selector || !action.value) {
          throw new Error('Type action requires selector and value');
        }
        return await this.browser.type(action.selector, action.value);
        
      case 'extract':
        if (!action.selector) throw new Error('Extract action requires selector');
        return await this.browser.extract(action.selector);
        
      case 'complete':
        return null;
        
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }
}