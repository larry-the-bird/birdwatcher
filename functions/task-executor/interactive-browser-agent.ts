import { BrowserExecutor } from './browser-executor';
import { BaseLLM } from './llm/base-llm';
import { createLLMFromEnv } from './llm/llm-factory';
import { PromptManager, PromptTemplateVars } from './prompts/prompt-manager';
import { 
  TaskInput, 
  ExecutionPlan, 
  ExecutionStep,
  ExecutionStepType 
} from './types';

/**
 * Browser state captured at each step
 */
export interface BrowserState {
  screenshot: string | null;
  dom: string;
  url: string;
  timestamp: Date;
  viewport: { width: number; height: number };
  error?: Error;
}

/**
 * Action decided by LLM based on current browser state
 */
export interface InteractiveAction {
  type: ExecutionStepType;
  selector?: string;
  value?: string | number | boolean;
  waitTime?: number;
  reasoning: string;
}

/**
 * Progress evaluation using gradient descent-like approach
 */
export interface ProgressEvaluation {
  score: number; // 0-1, where 1 means task complete
  reasoning: string;
  isComplete: boolean;
}

/**
 * Single step in interactive execution
 */
export interface InteractiveStep {
  stepNumber: number;
  browserState: BrowserState;
  action: InteractiveAction;
  executionResult: {
    success: boolean;
    result?: any;
    error?: Error;
    duration: number;
  };
  progressScore: number;
  isComplete: boolean;
  reasoning: string;
}

/**
 * Result of interactive execution
 */
export interface InteractiveExecutionResult {
  success: boolean;
  steps: InteractiveStep[];
  generatedPlan: ExecutionPlan | null;
  escalatedToHuman: boolean;
  escalationReason?: string;
  progressImprovement?: number;
  totalDuration: number;
  extractedData?: Record<string, any>; // Add extracted data from successful steps
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    llmCalls: number;
  };
  metadata: {
    maxStepsReached: boolean;
    stagnationDetected: boolean;
    averageProgressScore: number;
  };
}

/**
 * Configuration for the Interactive Browser Agent
 */
export interface InteractiveBrowserAgentConfig {
  browserExecutor?: BrowserExecutor;
  llm?: BaseLLM;
  promptManager?: PromptManager;
  maxSteps?: number;
  progressThreshold?: number;
  stagnationLimit?: number;
  enableScreenshots?: boolean;
  enableDOMCapture?: boolean;
}

/**
 * LLM Response format for interactive decisions
 */
interface LLMInteractiveResponse {
  action: InteractiveAction;
  progressEvaluation: ProgressEvaluation;
}

/**
 * Interactive Browser Agent that uses screenshots + DOM to make step-by-step decisions
 */
export class InteractiveBrowserAgent {
  private config: Required<InteractiveBrowserAgentConfig>;

  constructor(config: InteractiveBrowserAgentConfig = {}) {
    this.config = {
      browserExecutor: config.browserExecutor || new BrowserExecutor(),
      llm: config.llm || createLLMFromEnv(),
      promptManager: config.promptManager || new PromptManager(),
      maxSteps: config.maxSteps ?? 10,
      progressThreshold: config.progressThreshold ?? 0.1,
      stagnationLimit: config.stagnationLimit ?? 3,
      enableScreenshots: config.enableScreenshots ?? true,
      enableDOMCapture: config.enableDOMCapture ?? true,
    };
  }

  /**
   * Capture current browser state (screenshot + DOM)
   */
  async captureBrowserState(): Promise<BrowserState> {
    const timestamp = new Date();
    let screenshot: string | null = null;
    let dom = '';
    let url = '';
    let viewport = { width: 1920, height: 1080 };
    let error: Error | undefined;

    // Capture each piece individually with error handling
    try {
      screenshot = this.config.enableScreenshots 
        ? await this.config.browserExecutor.takeScreenshot() 
        : null;
    } catch (screenshotError) {
      console.error('[InteractiveBrowserAgent] Screenshot capture failed:', screenshotError);
      screenshot = null;
      error = error || (screenshotError instanceof Error ? screenshotError : new Error('Screenshot capture failed'));
    }

    try {
      dom = this.config.enableDOMCapture 
        ? await this.config.browserExecutor.getDOM() 
        : '';
    } catch (domError) {
      console.error('[InteractiveBrowserAgent] DOM capture failed:', domError);
      dom = '';
      error = error || (domError instanceof Error ? domError : new Error('DOM capture failed'));
    }

    try {
      url = this.config.browserExecutor.getCurrentUrl();
    } catch (urlError) {
      console.error('[InteractiveBrowserAgent] URL capture failed:', urlError);
      url = '';
      error = error || (urlError instanceof Error ? urlError : new Error('URL capture failed'));
    }

    try {
      viewport = this.config.browserExecutor.getViewport();
    } catch (viewportError) {
      console.error('[InteractiveBrowserAgent] Viewport capture failed:', viewportError);
      viewport = { width: 1920, height: 1080 };
      error = error || (viewportError instanceof Error ? viewportError : new Error('Viewport capture failed'));
    }

    return {
      screenshot,
      dom,
      url,
      timestamp,
      viewport,
      error,
    };
  }

  /**
   * Execute task interactively step by step
   */
  async executeInteractively(taskInput: TaskInput): Promise<InteractiveExecutionResult> {
    const startTime = Date.now();
    const steps: InteractiveStep[] = [];
    let isComplete = false;
    let escalatedToHuman = false;
    let escalationReason: string | undefined;
    let stagnationCount = 0;
    let previousScores: number[] = [];
    
    // Track token usage
    const usage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      llmCalls: 0
    };

    console.log('🤖 [InteractiveBrowserAgent] Starting interactive execution');

    try {
      // Initialize browser for interactive mode
      await this.config.browserExecutor.initializeBrowser();

      // Interactive execution loop
      for (let stepNumber = 1; stepNumber <= this.config.maxSteps && !isComplete; stepNumber++) {
        console.log(`🔍 [InteractiveBrowserAgent] Step ${stepNumber}/${this.config.maxSteps}`);

        // Capture current browser state
        const browserState = await this.captureBrowserState();

        // Get LLM decision based on current state
        const llmResponse = await this.getLLMDecision(taskInput, browserState, steps, usage);

        // Execute the decided action
        const executionResult = await this.executeAction(llmResponse.action);

        // Create step record
        const step: InteractiveStep = {
          stepNumber,
          browserState,
          action: llmResponse.action,
          executionResult,
          progressScore: llmResponse.progressEvaluation.score,
          isComplete: llmResponse.progressEvaluation.isComplete,
          reasoning: llmResponse.progressEvaluation.reasoning,
        };

        steps.push(step);
        previousScores.push(step.progressScore);

        console.log(`📊 [InteractiveBrowserAgent] Step ${stepNumber} progress: ${step.progressScore.toFixed(2)}`);

        // Check if task is complete
        if (llmResponse.progressEvaluation.isComplete) {
          console.log('✅ [InteractiveBrowserAgent] Task completed successfully');
          isComplete = true;
          break;
        }

        // Check for stagnation (gradient descent-like evaluation)
        if (this.detectStagnation(previousScores)) {
          escalatedToHuman = true;
          escalationReason = `Task stagnation detected. Progress scores: ${previousScores.slice(-this.config.stagnationLimit).map(s => s.toFixed(2)).join(', ')}. Unable to make sufficient progress after ${this.config.stagnationLimit} attempts.`;
          console.log('🚨 [InteractiveBrowserAgent] Escalating to human due to stagnation');
          break;
        }
      }

      // Check if max steps reached
      const maxStepsReached = steps.length >= this.config.maxSteps && !isComplete;
      if (maxStepsReached && !escalatedToHuman) {
        escalatedToHuman = true;
        escalationReason = `Maximum steps (${this.config.maxSteps}) reached without completing the task.`;
        console.log('🚨 [InteractiveBrowserAgent] Escalating to human due to max steps reached');
      }

      // Generate plan from successful execution
      let generatedPlan: ExecutionPlan | null = null;
      if (isComplete && !escalatedToHuman) {
        generatedPlan = await this.generatePlanFromSteps(taskInput, steps);
        console.log('📋 [InteractiveBrowserAgent] Generated plan from successful execution');
      }

      // Calculate metrics
      const totalDuration = Date.now() - startTime;
      const averageProgressScore = previousScores.length > 0 
        ? previousScores.reduce((sum, score) => sum + score, 0) / previousScores.length 
        : 0;
      const progressImprovement = previousScores.length > 1 
        ? previousScores[previousScores.length - 1] - previousScores[0] 
        : undefined;

      // Collect extracted data from successful extraction steps
      const extractedData: Record<string, any> = {};
      steps.forEach((step, index) => {
        if (step.executionResult.success && 
            (step.action.type === 'extract' || step.action.type === 'extractText') &&
            step.executionResult.result) {
          
          const rawData = step.executionResult.result;
          extractedData[`step_${index + 1}_raw`] = rawData;
          
          // Parse specific data patterns from extracted text
          let textToAnalyze = '';
          if (typeof rawData === 'string') {
            textToAnalyze = rawData;
          } else if (typeof rawData === 'object' && rawData !== null) {
            // Extract text from nested object (like {"interactive-123": "text content"})
            const textValues = Object.values(rawData).filter(v => typeof v === 'string');
            textToAnalyze = textValues.join(' ');
          }
          
          if (textToAnalyze) {
            console.log(`🔍 [InteractiveBrowserAgent] Parsing ${textToAnalyze.length} chars for: "${taskInput.instruction.substring(0, 50)}..."`);
            const parsedData = this.parseExtractedData(textToAnalyze, taskInput.instruction);
            console.log(`📊 [InteractiveBrowserAgent] Parsed data:`, Object.keys(parsedData));
            if (Object.keys(parsedData).length > 0) {
              Object.assign(extractedData, parsedData);
              console.log(`✅ [InteractiveBrowserAgent] Added parsed data:`, parsedData);
            } else {
              console.log(`❌ [InteractiveBrowserAgent] No parsed data found`);
            }
          }
        }
      });

      return {
        success: isComplete,
        steps,
        generatedPlan,
        escalatedToHuman,
        escalationReason,
        progressImprovement,
        totalDuration,
        extractedData: Object.keys(extractedData).length > 0 ? extractedData : undefined,
        usage: usage.llmCalls > 0 ? usage : undefined,
        metadata: {
          maxStepsReached,
          stagnationDetected: stagnationCount > 0,
          averageProgressScore,
        },
      };

    } catch (error) {
      console.error('💥 [InteractiveBrowserAgent] Unexpected error during interactive execution:', error);
      
      // Collect extracted data from successful extraction steps even in error case
      const extractedData: Record<string, any> = {};
      steps.forEach((step, index) => {
        if (step.executionResult.success && 
            (step.action.type === 'extract' || step.action.type === 'extractText') &&
            step.executionResult.result) {
          
          const rawData = step.executionResult.result;
          extractedData[`step_${index + 1}_raw`] = rawData;
          
          // Parse specific data patterns from extracted text
          if (typeof rawData === 'string') {
            const parsedData = this.parseExtractedData(rawData, taskInput.instruction);
            if (Object.keys(parsedData).length > 0) {
              Object.assign(extractedData, parsedData);
            }
          }
        }
      });
      
      return {
        success: false,
        steps,
        generatedPlan: null,
        escalatedToHuman: true,
        escalationReason: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        totalDuration: Date.now() - startTime,
        extractedData: Object.keys(extractedData).length > 0 ? extractedData : undefined,
        usage: usage.llmCalls > 0 ? usage : undefined,
        metadata: {
          maxStepsReached: false,
          stagnationDetected: false,
          averageProgressScore: 0,
        },
      };
    } finally {
      // Cleanup browser resources
      try {
        await this.config.browserExecutor.cleanup();
      } catch (cleanupError) {
        console.error('Failed to cleanup browser resources:', cleanupError);
      }
    }
  }

  /**
   * Get LLM decision based on current browser state
   */
  private async getLLMDecision(
    taskInput: TaskInput, 
    browserState: BrowserState, 
    previousSteps: InteractiveStep[],
    usage: { promptTokens: number; completionTokens: number; totalTokens: number; llmCalls: number }
  ): Promise<LLMInteractiveResponse> {
    
    // Build context for LLM
    const context = this.buildLLMContext(taskInput, browserState, previousSteps);
    
    try {
      console.log('🤖 [LLM] Making decision for interactive step...');
      const response = await this.config.llm.generateCompletion([
        { role: 'user', content: context }
      ], { jsonMode: true });
      
      // Track token usage
      usage.llmCalls++;
      if (response.usage) {
        usage.promptTokens += response.usage.promptTokens || 0;
        usage.completionTokens += response.usage.completionTokens || 0;
        usage.totalTokens += response.usage.totalTokens || 0;
      }
      
      console.log('✅ [LLM] Decision received', { 
        tokens: response.usage?.totalTokens || 'unknown',
        model: response.model 
      });
      const parsedResponse: LLMInteractiveResponse = JSON.parse(response.content);
      
      // Validate response structure
      if (!parsedResponse.action || !parsedResponse.progressEvaluation) {
        throw new Error('Invalid LLM response structure');
      }
      
      return parsedResponse;
    } catch (error) {
      console.error('[InteractiveBrowserAgent] LLM decision failed:', error);
      
      // Fallback decision
      return {
        action: {
          type: 'wait',
          waitTime: 1000,
          reasoning: 'LLM decision failed, waiting before retry',
        },
        progressEvaluation: {
          score: 0.0,
          reasoning: 'Unable to make decision due to LLM error',
          isComplete: false,
        },
      };
    }
  }

  /**
   * Build context for LLM decision making
   */
  private buildLLMContext(
    taskInput: TaskInput, 
    browserState: BrowserState, 
    previousSteps: InteractiveStep[]
  ): string {
    const previousStepsContext = previousSteps.length > 0 
      ? previousSteps.map(step => 
          `Step ${step.stepNumber}: ${step.action.type} ${step.action.selector || ''} - Progress: ${step.progressScore.toFixed(2)} - ${step.reasoning}`
        ).join('\n')
      : undefined;

    // Build template variables for the prompt
    const templateVars: PromptTemplateVars = {
      instruction: taskInput.instruction,
      url: taskInput.url,
      viewport: `${browserState.viewport.width}x${browserState.viewport.height}`,
      browserState: {
        currentUrl: browserState.url,
        screenshot: browserState.screenshot,
        dom: browserState.dom,
        viewport: browserState.viewport,
        timestamp: browserState.timestamp.toISOString(),
        stepNumber: previousSteps.length + 1,
        maxSteps: this.config.maxSteps,
      },
      previousSteps: previousStepsContext,
    };

    return this.config.promptManager.getInteractiveBrowserAgentPrompt(templateVars);
  }

  /**
   * Execute an action decided by the LLM
   */
  private async executeAction(action: InteractiveAction): Promise<{
    success: boolean;
    result?: any;
    error?: Error;
    duration: number;
  }> {
    const startTime = Date.now();

    try {
      // For testing purposes, we'll create a mini execution plan and use executePlan
      const executionStep: ExecutionStep = {
        id: `interactive-${Date.now()}`,
        type: action.type,
        description: action.reasoning,
        selector: action.selector,
        value: action.value,
        waitTime: action.waitTime,
      };

      // Create a minimal execution plan for this single step
      const miniPlan: ExecutionPlan = {
        id: `interactive-plan-${Date.now()}`,
        taskSignature: 'interactive-execution',
        instruction: action.reasoning,
        url: 'https://example.com',
        steps: [executionStep],
        expectedResults: ['Action executed'],
        errorHandling: {
          retryCount: 0,
          timeoutMs: 30000,
        },
        validation: {
          successCriteria: ['true'], // Always pass validation for interactive steps
          failureCriteria: ['false'], // Never trigger failure criteria
        },
        metadata: {
          createdAt: new Date(),
          llmModel: 'interactive-agent',
          confidence: 0.8,
          estimatedDuration: 5000,
        },
      };

      // Execute the plan (skip cleanup since InteractiveBrowserAgent manages browser lifecycle)
      const result = await this.config.browserExecutor.executePlan(miniPlan, { skipCleanup: true });
      
      return {
        success: result.status === 'success',
        result: result.extractedData,
        error: result.error ? new Error(result.error.message) : undefined,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown execution error'),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Detect stagnation using gradient descent-like approach
   */
  private detectStagnation(progressScores: number[]): boolean {
    if (progressScores.length < this.config.stagnationLimit) {
      return false;
    }

    const recentScores = progressScores.slice(-this.config.stagnationLimit);
    const maxScore = Math.max(...recentScores);
    const minScore = Math.min(...recentScores);
    
    // Consider it stagnation if progress variation is below threshold
    const progressVariation = maxScore - minScore;
    return progressVariation < this.config.progressThreshold;
  }

  /**
   * Generate an execution plan from successful interactive steps
   */
  private async generatePlanFromSteps(
    taskInput: TaskInput, 
    steps: InteractiveStep[]
  ): Promise<ExecutionPlan> {
    const planSteps: ExecutionStep[] = steps.map((step, index) => ({
      id: `step-${index + 1}`,
      type: step.action.type,
      description: step.action.reasoning,
      selector: step.action.selector,
      value: step.action.value,
      waitTime: step.action.waitTime,
    }));

    const taskSignature = this.createTaskSignature(taskInput.instruction, taskInput.url);
    const confidence = steps.length > 0 
      ? steps[steps.length - 1].progressScore 
      : 0;

    return {
      id: `interactive-plan-${Date.now()}`,
      taskSignature,
      instruction: taskInput.instruction,
      url: taskInput.url,
      steps: planSteps,
      expectedResults: ['Task completed through interactive execution'],
      errorHandling: {
        retryCount: 3,
        timeoutMs: 30000,
      },
      validation: {
        successCriteria: ['All steps executed successfully'],
        failureCriteria: ['Any step failed with error'],
      },
      metadata: {
        createdAt: new Date(),
        llmModel: this.config.llm.getProviderInfo().model,
        confidence,
        estimatedDuration: steps.reduce((total, step) => total + step.executionResult.duration, 0),
      },
    };
  }

  /**
   * Create task signature for caching
   */
  private createTaskSignature(instruction: string, url: string): string {
    const normalizedInstruction = instruction.toLowerCase().trim().replace(/\s+/g, '-');
    const normalizedUrl = url.replace(/^https?:\/\//, '').replace(/[^\w.-]/g, '-');
    return `${normalizedUrl}::${normalizedInstruction}`;
  }

  /**
   * Parse extracted data to find specific patterns
   */
  private parseExtractedData(rawText: string, instruction: string): Record<string, any> {
    const parsedData: Record<string, any> = {};
    
    // Look for roasting date pattern if instruction mentions roasting/date
    if (instruction.toLowerCase().includes('roast') || instruction.toLowerCase().includes('date')) {
      // Pattern 1: "Rostningsdatum\n2025-07-02" (Swedish coffee sites)
      const roastingDateMatch = rawText.match(/Rostningsdatum[\s\n]+(\d{4}-\d{2}-\d{2})/i);
      if (roastingDateMatch) {
        parsedData.roastingDate = roastingDateMatch[1];
      }
      
      // Pattern 2: General YYYY-MM-DD date pattern
      if (!parsedData.roastingDate) {
        const dateMatches = rawText.match(/\b(\d{4}-\d{2}-\d{2})\b/g);
        if (dateMatches && dateMatches.length > 0) {
          // Take the most recent date (assuming it's the roasting date)
          const sortedDates = dateMatches.sort().reverse();
          parsedData.roastingDate = sortedDates[0];
          if (dateMatches.length > 1) {
            parsedData.allDatesFound = dateMatches;
          }
        }
      }
    }
    
    // Look for price patterns
    if (instruction.toLowerCase().includes('price') || instruction.toLowerCase().includes('cost')) {
      const priceMatch = rawText.match(/(\d+)\s*kr/i) || rawText.match(/\$(\d+\.?\d*)/);
      if (priceMatch) {
        parsedData.price = priceMatch[1];
        parsedData.currency = priceMatch[0].includes('kr') ? 'SEK' : 'USD';
      }
    }
    
    // Look for title/product name
    if (instruction.toLowerCase().includes('title') || instruction.toLowerCase().includes('name')) {
      // Extract title from HTML title or h1 tags
      const titleMatch = rawText.match(/<title[^>]*>([^<]+)<\/title>/i) || 
                        rawText.match(/<h1[^>]*>([^<]+)<\/h1>/i);
      if (titleMatch) {
        parsedData.title = titleMatch[1].trim();
      }
    }
    
    return parsedData;
  }

  /**
   * Get current configuration
   */
  getConfiguration(): Required<InteractiveBrowserAgentConfig> {
    return { ...this.config };
  }
} 