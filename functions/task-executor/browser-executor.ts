import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { 
  ExecutionPlan, 
  ExecutionStep, 
  ExecutionResult, 
  ExecutionLog,
  BrowserConfig,
  BrowserExecutionError
} from './types';

export class BrowserExecutor {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: BrowserConfig;
  private logs: ExecutionLog[] = [];

  constructor(config: Partial<BrowserConfig> = {}) {
    this.config = {
      headless: config.headless ?? true,
      viewport: config.viewport ?? { width: 1920, height: 1080 },
      userAgent: config.userAgent,
      timeout: config.timeout ?? 30000,
      screenshots: config.screenshots ?? true,
    };
  }

  /**
   * Execute a complete automation plan
   */
  async executePlan(plan: ExecutionPlan, options: { skipCleanup?: boolean } = {}): Promise<ExecutionResult> {
    const startTime = Date.now();
    let stepsCompleted = 0;
    let retryCount = 0;
    const extractedData: Record<string, any> = {};
    const screenshots: string[] = [];

    try {
      this.log('info', `🚀 Executing plan: ${plan.id}`);
      
      // Initialize browser
      await this.initializeBrowser();
      
      // Execute each step
      for (const step of plan.steps) {
        try {
          await this.executeStep(step, extractedData, screenshots, plan);
          stepsCompleted++;
          
          this.log('info', `✅ ${step.type}: ${step.description}`, step.id);
          
        } catch (error) {
          const stepError = error as BrowserExecutionError;
          this.log('error', `Step failed: ${stepError.message}`, step.id, { error: stepError.details });
          
          // Handle step failure
          if (step.optional) {
            this.log('warn', `Optional step failed, continuing: ${step.description}`, step.id);
            continue;
          }
          
          // Retry logic
          if (retryCount < (step.retries || 3)) {
            retryCount++;
            this.log('info', `Retrying step ${retryCount}/${step.retries}: ${step.description}`, step.id);
            
            // Wait before retry
            await this.page?.waitForTimeout(1000 * retryCount);
            
            try {
              await this.executeStep(step, extractedData, screenshots, plan);
              stepsCompleted++;
              retryCount = 0; // Reset retry count on success
              continue;
            } catch (retryError) {
              this.log('error', `Retry ${retryCount} failed: ${retryError}`, step.id);
            }
          }
          
          // If we get here, step failed after retries
          throw new BrowserExecutionError(
            `Step failed after ${retryCount} retries: ${step.description}`,
            step.id,
            { originalError: stepError.message }
          );
        }
      }
      
      // Validate success criteria
      const validationResult = await this.validateExecution(plan, extractedData);
      
      const result: ExecutionResult = {
        planId: plan.id,
        status: validationResult.success ? 'success' : 'failed',
        extractedData,
        screenshots,
        logs: this.logs,
        metrics: {
          executionTime: Date.now() - startTime,
          stepsCompleted,
          stepsTotal: plan.steps.length,
          retryCount
        },
        createdAt: new Date()
      };
      
      if (!validationResult.success) {
        result.error = {
          message: 'Execution validation failed',
          step: 'validation',
        };
        this.log('error', `Validation failed: ${validationResult.reason}`);
      }
      
      this.log('info', `🎯 Plan ${result.status}: ${stepsCompleted}/${plan.steps.length} steps`);
      return result;
      
    } catch (error) {
      const executionError = error as BrowserExecutionError;
      this.log('error', `Plan execution failed: ${executionError.message}`, undefined, { error: executionError.details });
      
      return {
        planId: plan.id,
        status: 'error',
        extractedData,
        screenshots,
        logs: this.logs,
        error: {
          message: executionError.message,
          step: executionError.stepId,
          stack: executionError.stack
        },
        metrics: {
          executionTime: Date.now() - startTime,
          stepsCompleted,
          stepsTotal: plan.steps.length,
          retryCount
        },
        createdAt: new Date()
      };
    } finally {
      if (!options.skipCleanup) {
        await this.cleanup();
      }
    }
  }

  /**
   * Execute a single step
   */
  private async executeStep(
    step: ExecutionStep, 
    extractedData: Record<string, any>, 
    screenshots: string[],
    plan?: ExecutionPlan
  ): Promise<void> {
    if (!this.page) {
      throw new BrowserExecutionError('Browser page not initialized', step.id);
    }

    // Check step condition if provided
    if (step.condition) {
      const conditionResult = await this.evaluateCondition(step.condition);
      if (!conditionResult) {
        this.log('info', `Step condition not met, skipping: ${step.description}`, step.id);
        return;
      }
    }

    // Set timeout for this step
    const timeout = step.options?.timeout || this.config.timeout;
    this.page.setDefaultTimeout(timeout);

    switch (step.type) {
      case 'navigate':
        const navigateUrl = step.value as string || step.options?.url || plan?.url;
        if (!navigateUrl) {
          throw new BrowserExecutionError('Navigate step requires URL in value, options.url, or plan.url', step.id);
        }
        await this.page.goto(navigateUrl);
        break;

      case 'click':
        if (!step.selector) throw new BrowserExecutionError('Click step requires selector', step.id);
        await this.page.click(step.selector, step.options);
        break;

      case 'type':
        if (!step.selector) throw new BrowserExecutionError('Type step requires selector', step.id);
        await this.page.fill(step.selector, step.value as string);
        break;

      case 'wait':
        await this.page.waitForTimeout(step.waitTime || (step.value as number) || 1000);
        break;

      case 'waitForElement':
      case 'waitForSelector':
        if (!step.selector) throw new BrowserExecutionError('WaitForSelector step requires selector', step.id);
        
        // Special handling for title elements which are not visually visible
        if (step.selector.includes('title')) {
          // For title elements, just check if they exist in the DOM (don't require visibility)
          await this.page.waitForSelector(step.selector, { 
            timeout: step.options?.timeout || this.config.timeout,
            state: 'attached' // Just wait for element to be in DOM, not visible
          });
        } else {
          await this.page.waitForSelector(step.selector, { 
            timeout: step.options?.timeout || this.config.timeout 
          });
        }
        break;

      case 'extract':
      case 'extractText':
        if (!step.selector) throw new BrowserExecutionError('Extract step requires selector', step.id);
        
        // Special handling for title extraction
        if (step.selector.includes('title')) {
          const title = await this.page.evaluate(() => document.title);
          extractedData[step.id] = title;
          extractedData.page_title = title; // Also store with semantic key
        } else {
          const text = await this.page.textContent(step.selector);
          extractedData[step.id] = text;
        }
        break;

      case 'scroll':
        await this.page.evaluate((options) => {
          window.scrollBy(options?.x || 0, options?.y || 500);
        }, step.options || {});
        break;

      case 'screenshot':
        if (this.config.screenshots) {
          const screenshot = await this.page.screenshot({ 
            fullPage: step.options?.fullPage || false
          });
          screenshots.push(screenshot.toString('base64'));
        }
        break;

      case 'evaluate':
        if (!step.value) throw new BrowserExecutionError('Evaluate step requires JavaScript code', step.id);
        await this.page.evaluate(step.value as string);
        break;

      case 'select':
        if (!step.selector) throw new BrowserExecutionError('Select step requires selector', step.id);
        await this.page.selectOption(step.selector, step.value as string);
        break;

      case 'hover':
        if (!step.selector) throw new BrowserExecutionError('Hover step requires selector', step.id);
        await this.page.hover(step.selector);
        break;

      case 'keyPress':
        await this.page.keyboard.press(step.value as string);
        break;

      case 'reload':
        await this.page.reload();
        break;

      case 'goBack':
        await this.page.goBack();
        break;

      case 'goForward':
        await this.page.goForward();
        break;

      default:
        throw new BrowserExecutionError(`Unknown step type: ${step.type}`, step.id);
    }

    // Wait after step if specified
    if (step.waitTime) {
      await this.page.waitForTimeout(step.waitTime);
    }
  }

  /**
   * Extract data from the page
   */
  private async extractData(step: ExecutionStep): Promise<any> {
    if (!this.page || !step.selector) {
      throw new BrowserExecutionError('Extract requires page and selector', step.id);
    }

    const extractType = step.options?.type || 'text';
    const multiple = step.options?.multiple || false;

    switch (extractType) {
      case 'text':
        if (multiple) {
          return await this.page.$$eval(step.selector, (elements) => 
            elements.map(el => el.textContent?.trim()).filter(Boolean)
          );
        } else {
          return await this.page.textContent(step.selector);
        }

      case 'attribute':
        const attribute = step.options?.attribute || 'href';
        if (multiple) {
          return await this.page.$$eval(step.selector, (elements, attr) => 
            elements.map(el => el.getAttribute(attr)).filter(Boolean), attribute
          );
        } else {
          return await this.page.getAttribute(step.selector, attribute);
        }

      case 'html':
        if (multiple) {
          return await this.page.$$eval(step.selector, (elements) => 
            elements.map(el => el.innerHTML)
          );
        } else {
          return await this.page.innerHTML(step.selector);
        }

      case 'value':
        if (multiple) {
          return await this.page.$$eval(step.selector, (elements) => 
            elements.map((el: any) => el.value).filter(Boolean)
          );
        } else {
          return await this.page.inputValue(step.selector);
        }

      default:
        throw new BrowserExecutionError(`Unknown extract type: ${extractType}`, step.id);
    }
  }

  /**
   * Evaluate a condition expression
   */
  private async evaluateCondition(condition: string): Promise<boolean> {
    if (!this.page) return false;
    
    try {
      return await this.page.evaluate(`(() => { return ${condition}; })()`);
    } catch (error) {
      this.log('warn', `Condition evaluation failed: ${condition}`, undefined, { error });
      return false;
    }
  }

  /**
   * Validate execution against success criteria
   */
  private async validateExecution(plan: ExecutionPlan, extractedData: Record<string, any>): Promise<{ success: boolean; reason?: string }> {
    if (!this.page) return { success: false, reason: 'No page available for validation' };

    // Check success criteria
    for (const criterion of plan.validation.successCriteria) {
      try {
        const result = await this.page.evaluate(`(() => { return ${criterion}; })()`);
        if (!result) {
          return { success: false, reason: `Success criterion failed: ${criterion}` };
        }
      } catch (error) {
        return { success: false, reason: `Success criterion error: ${criterion}` };
      }
    }

    // Check failure criteria
    for (const criterion of plan.validation.failureCriteria) {
      try {
        const result = await this.page.evaluate(`(() => { return ${criterion}; })()`);
        if (result) {
          return { success: false, reason: `Failure criterion triggered: ${criterion}` };
        }
      } catch (error) {
        // If failure criterion can't be evaluated, we ignore it
        continue;
      }
    }

    return { success: true };
  }

  /**
   * Initialize browser and context
   */
  async initializeBrowser(): Promise<void> {
    // Skip initialization if browser is already initialized
    if (this.browser && this.context && this.page) {
      // Browser already initialized
      return;
    }

    try {
      this.browser = await chromium.launch({
        headless: this.config.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920,1080'
        ]
      });

      this.context = await this.browser.newContext({
        viewport: this.config.viewport,
        userAgent: this.config.userAgent,
      });

      this.page = await this.context.newPage();
      
      // Set default timeout
      this.page.setDefaultTimeout(this.config.timeout);
      
      // Browser initialized successfully
    } catch (error) {
      throw new BrowserExecutionError('Failed to initialize browser', undefined, { error });
    }
  }

  /**
   * Cleanup browser resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      
      this.page = null;
      // Browser cleanup completed
    } catch (error) {
      this.log('error', `Cleanup failed: ${error}`);
    }
  }

  /**
   * Log execution events
   */
  private log(level: 'info' | 'warn' | 'error' | 'debug', message: string, stepId?: string, data?: Record<string, any>): void {
    const logEntry: ExecutionLog = {
      timestamp: new Date(),
      level,
      message,
      stepId,
      data
    };
    
    this.logs.push(logEntry);
    
    // Also log to console for debugging
    console.log(`[${level.toUpperCase()}] ${message}`, { stepId, data });
  }

  /**
   * Get current page content for context
   */
  async getPageContent(): Promise<string | null> {
    if (!this.page) {
      return null;
    }

    try {
      // Get the page's text content, limited to first 3000 characters
      const content = await this.page.evaluate(() => {
        // Remove script and style elements
        const scripts = document.querySelectorAll('script, style');
        scripts.forEach(script => script.remove());
        
        // Get the main content
        const body = document.body || document.documentElement;
        const text = body.innerText || body.textContent || '';
        
        // Clean up the text and limit length
        return text.replace(/\s+/g, ' ').trim().substring(0, 3000);
      });
      
      return content;
    } catch (error) {
      console.error('Failed to get page content:', error);
      return null;
    }
  }

  /**
   * Take a screenshot of the current page
   * @returns Base64 encoded screenshot or null if screenshots are disabled or failed
   */
  async takeScreenshot(): Promise<string | null> {
    if (!this.page) {
      console.warn('Cannot take screenshot: Browser page not initialized');
      return null;
    }

    if (!this.config.screenshots) {
      return null;
    }

    try {
      const screenshot = await this.page.screenshot({
        type: 'jpeg',
        quality: 80, // Optimized for LLM processing
        fullPage: false, // Viewport only for better performance
      });
      
      return `data:image/jpeg;base64,${screenshot.toString('base64')}`;
    } catch (error) {
      console.error('Failed to take screenshot:', error);
      return null;
    }
  }

  /**
   * Get the full DOM content of the current page
   * @returns HTML string of the current page
   */
  async getDOM(): Promise<string> {
    if (!this.page) {
      console.warn('Cannot get DOM: Browser page not initialized');
      return '';
    }

    try {
      const html = await this.page.content();
      
      // Limit DOM size for LLM context (roughly 100KB limit)
      const maxSize = 100000;
      if (html.length > maxSize) {
        // Try to get just the body content first
        const bodyContent = await this.page.evaluate(() => {
          const body = document.body;
          return body ? body.outerHTML : document.documentElement.outerHTML;
        });
        
        if (bodyContent.length <= maxSize) {
          return bodyContent;
        }
        
        // If still too large, truncate with indication
        return html.substring(0, maxSize) + '\n<!-- DOM truncated for LLM context -->';
      }
      
      return html;
    } catch (error) {
      console.error('Failed to get DOM:', error);
      return '';
    }
  }

  /**
   * Get the current page URL
   * @returns Current page URL or empty string if not available
   */
  getCurrentUrl(): string {
    if (!this.page) {
      console.warn('Cannot get URL: Browser page not initialized');
      return '';
    }

    try {
      return this.page.url();
    } catch (error) {
      console.error('Failed to get current URL:', error);
      return '';
    }
  }

  /**
   * Get the current viewport dimensions
   * @returns Viewport dimensions or default if not available
   */
  getViewport(): { width: number; height: number } {
    if (!this.page) {
      console.warn('Cannot get viewport: Browser page not initialized');
      return this.config.viewport;
    }

    try {
      const viewport = this.page.viewportSize();
      return viewport || this.config.viewport;
    } catch (error) {
      console.error('Failed to get viewport:', error);
      return this.config.viewport;
    }
  }
} 