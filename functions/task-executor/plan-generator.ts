import { ExecutionPlan, ExecutionStep, PlanGenerationRequest, PlanGenerationResponse } from './types';
import { createLLMFromEnv } from './llm/llm-factory';
import { getPrompts, PromptTemplateVars } from './prompts/prompt-manager';
import { BaseLLM, PlanGenerationResponse as LLMPlanGenerationResponse } from './llm/base-llm';

/**
 * Plan generator configuration
 */
export interface PlanGeneratorConfig {
  llm?: BaseLLM;
  maxRetries?: number;
  timeoutMs?: number;
  cacheTTL?: number;
}

/**
 * Enhanced plan generator using LLM abstraction
 */
export class PlanGenerator {
  private llm: BaseLLM;
  private maxRetries: number;
  private timeoutMs: number;
  private cacheTTL: number;

  constructor(config: PlanGeneratorConfig = {}) {
    this.llm = config.llm || createLLMFromEnv();
    this.maxRetries = config.maxRetries || 3;
    this.timeoutMs = config.timeoutMs || 30000;
    this.cacheTTL = config.cacheTTL || 7 * 24 * 60 * 60 * 1000; // 7 days
  }

  /**
   * Generate execution plan using LLM
   */
  async generatePlan(request: PlanGenerationRequest): Promise<PlanGenerationResponse> {
    const startTime = Date.now();

    try {
      // Prepare prompt variables
      const promptVars: PromptTemplateVars = {
        instruction: request.instruction,
        url: request.url,
        viewport: '1280x720', // Default viewport for prompt context
      };

      // Get prompts from prompt manager
      const { systemPrompt, userPrompt } = getPrompts(promptVars);

      // Generate plan using LLM
      const llmResponse = await this.llm.generatePlan(
        {
          instruction: request.instruction,
          url: request.url,
        },
        systemPrompt,
        userPrompt
      );

      // Convert LLM response to our expected format
      const planResponse = this.convertLLMResponseToPlanResponse(llmResponse, request);

      return planResponse;
    } catch (error) {
      console.error('[PlanGenerator] Plan generation failed:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        confidence: 0,
        reasoning: 'Failed to generate plan due to error'
      };
    }
  }

  /**
   * Generate plan with fallback strategy
   */
  async generatePlanWithFallback(
    request: PlanGenerationRequest,
    fallbackLLM?: BaseLLM
  ): Promise<PlanGenerationResponse> {
    try {
      // Try with primary LLM
      const response = await this.generatePlan(request);
      
      if (response.success && response.confidence > 0.5) {
        return response;
      }

      // If primary fails or low confidence, try fallback
      if (fallbackLLM) {
        console.log('[PlanGenerator] Trying fallback LLM...');
        const fallbackGenerator = new PlanGenerator({ llm: fallbackLLM });
        const fallbackResponse = await fallbackGenerator.generatePlan(request);
        
        // Return the better response
        if (fallbackResponse.success && fallbackResponse.confidence > response.confidence) {
          return fallbackResponse;
        }
      }

      return response;
    } catch (error) {
      console.error('[PlanGenerator] Plan generation with fallback failed:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        confidence: 0,
        reasoning: 'Failed to generate plan with fallback'
      };
    }
  }

  /**
   * Convert LLM response to PlanGenerationResponse format
   */
  private convertLLMResponseToPlanResponse(llmResponse: LLMPlanGenerationResponse, request: PlanGenerationRequest): PlanGenerationResponse {
    if (!llmResponse.success) {
      return {
        success: false,
        error: llmResponse.error || 'Plan generation failed',
        confidence: llmResponse.confidence,
        reasoning: llmResponse.reasoning
      };
    }

    // Validate steps
    const validatedSteps = (llmResponse.steps || []).map(step => this.validateStep(step));
    
    // Estimate duration
    const estimatedDuration = this.estimateDuration(validatedSteps);
    
    // Create task signature
    const taskSignature = this.createTaskSignature(request.instruction, request.url);
    
    // Create ExecutionPlan object
    const plan: ExecutionPlan = {
      id: `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      taskSignature,
      instruction: request.instruction,
      url: request.url,
      steps: validatedSteps,
      expectedResults: llmResponse.expectedResults || [],
      errorHandling: {
        retryCount: 3,
        timeoutMs: 30000,
        fallbackSteps: llmResponse.fallbackSteps || []
      },
      validation: {
        successCriteria: llmResponse.successCriteria || ['All steps completed successfully'],
        failureCriteria: llmResponse.failureCriteria || ['Any step failed with error']
      },
      metadata: {
        createdAt: new Date(),
        llmModel: this.llm.getProviderInfo().model,
        confidence: llmResponse.confidence,
        estimatedDuration
      }
    };

    return {
      success: true,
      plan,
      confidence: llmResponse.confidence,
      reasoning: llmResponse.reasoning
    };
  }

  /**
   * Validate individual step
   */
  private validateStep(step: any): ExecutionStep {
    const validStep: ExecutionStep = {
      id: step.id || `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: step.type || 'navigate',
      description: step.description || 'No description provided',
      selector: step.selector,
      value: step.value,
      options: step.options,
      waitTime: step.waitTime,
      retries: step.retries || 3,
      optional: step.optional || false,
      condition: step.condition
    };

    // Add default timeout for wait steps
    if (validStep.type.includes('wait') && !validStep.waitTime) {
      validStep.waitTime = 10000; // 10 seconds default
    }

    // Validate selectors
    if (validStep.selector && !this.isValidSelector(validStep.selector)) {
      console.warn(`[PlanGenerator] Potentially invalid selector: ${validStep.selector}`);
    }

    return validStep;
  }

  /**
   * Estimate plan duration
   */
  private estimateDuration(steps: ExecutionStep[]): number {
    let totalDuration = 0;

    for (const step of steps) {
      switch (step.type) {
        case 'navigate':
          totalDuration += 3000; // 3 seconds for navigation
          break;
        case 'wait':
          totalDuration += step.waitTime || 1000;
          break;
        case 'waitForSelector':
          totalDuration += Math.min(step.waitTime || 10000, 10000);
          break;
        case 'click':
        case 'type':
        case 'select':
        case 'hover':
        case 'keyPress':
          totalDuration += 500; // 0.5 seconds for interactions
          break;
        case 'screenshot':
          totalDuration += 1000; // 1 second for screenshot
          break;
        case 'extract':
        case 'evaluate':
          totalDuration += 200; // 0.2 seconds for extraction
          break;
        case 'scroll':
        case 'reload':
        case 'goBack':
        case 'goForward':
          totalDuration += 1000; // 1 second for navigation actions
          break;
        default:
          totalDuration += 1000; // 1 second default
      }
    }

    return totalDuration;
  }

  /**
   * Basic selector validation (Node.js compatible)
   */
  private isValidSelector(selector: string): boolean {
    try {
      // Basic CSS selector validation without DOM
      // Check for common invalid patterns
      if (!selector || selector.trim() === '') {
        return false;
      }

      // Check for XPath or text selectors (these are valid)
      if (selector.startsWith('//') || selector.startsWith('text=') || selector.includes('[data-')) {
        return true;
      }

      // Basic CSS selector pattern validation
      const cssPatterns = [
        /^[a-zA-Z][a-zA-Z0-9_-]*$/, // Simple tag/class/id
        /^[.#]?[a-zA-Z][a-zA-Z0-9_-]*$/, // Class or ID
        /^[a-zA-Z][a-zA-Z0-9_-]*[\s>+~]*[a-zA-Z][a-zA-Z0-9_-]*$/, // Simple combinators
        /^[a-zA-Z][a-zA-Z0-9_-]*\[[^\]]+\]$/, // Attribute selectors
        /^[a-zA-Z][a-zA-Z0-9_-]*:[a-zA-Z-]+(\([^)]*\))?$/, // Pseudo-selectors
        /^[a-zA-Z][a-zA-Z0-9_-]*(\.[a-zA-Z][a-zA-Z0-9_-]*)*$/, // Tag with classes
        /^[a-zA-Z][a-zA-Z0-9_-]*(\s+[a-zA-Z][a-zA-Z0-9_-]*)*$/, // Descendant selectors
        /^[a-zA-Z][a-zA-Z0-9_-]*(\s*[>+~]\s*[a-zA-Z][a-zA-Z0-9_-]*)*$/, // Complex combinators
        /^[a-zA-Z][a-zA-Z0-9_-]*\s+[a-zA-Z][a-zA-Z0-9_-]*:nth-child\([0-9]+\)(\s+[a-zA-Z][a-zA-Z0-9_-]*)*$/ // nth-child selectors
      ];

      return cssPatterns.some(pattern => pattern.test(selector));
    } catch {
      return false;
    }
  }

  /**
   * Create task signature for caching
   */
  createTaskSignature(instruction: string, url: string): string {
    const crypto = require('crypto');
    const normalized = this.normalizeInstruction(instruction) + '|' + this.normalizeUrl(url);
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Normalize instruction for consistent caching
   */
  private normalizeInstruction(instruction: string): string {
    return instruction
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim();
  }

  /**
   * Normalize URL for consistent caching
   */
  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
    } catch {
      return url.toLowerCase();
    }
  }

  /**
   * Get LLM provider information
   */
  getProviderInfo(): {
    provider: string;
    model: string;
    supportsJsonMode: boolean;
    supportsStreaming: boolean;
    maxTokens: number;
  } {
    return this.llm.getProviderInfo();
  }

  /**
   * Test LLM connection
   */
  async testConnection(): Promise<boolean> {
    try {
      return await this.llm.testConnection();
    } catch (error) {
      console.error('[PlanGenerator] Connection test failed:', error);
      return false;
    }
  }

  /**
   * Validate a complete execution plan
   */
  validatePlan(plan: ExecutionPlan): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Validate required fields
    if (!plan.id) issues.push('Plan ID is required');
    if (!plan.instruction) issues.push('Instruction is required');
    if (!plan.url) issues.push('URL is required');
    if (!plan.steps || plan.steps.length === 0) issues.push('At least one step is required');

    // Validate steps
    plan.steps.forEach((step, index) => {
      if (!step.id) issues.push(`Step ${index + 1}: ID is required`);
      if (!step.type) issues.push(`Step ${index + 1}: Type is required`);
      if (!step.description) issues.push(`Step ${index + 1}: Description is required`);
      
      // Validate type-specific requirements
      switch (step.type) {
        case 'navigate':
          if (!step.value && !plan.url) issues.push(`Step ${index + 1}: Navigate step requires URL`);
          break;
        case 'click':
        case 'hover':
          if (!step.selector) issues.push(`Step ${index + 1}: ${step.type} step requires selector`);
          break;
        case 'type':
          if (!step.selector) issues.push(`Step ${index + 1}: Type step requires selector`);
          if (!step.value) issues.push(`Step ${index + 1}: Type step requires value`);
          break;
        case 'select':
          if (!step.selector) issues.push(`Step ${index + 1}: Select step requires selector`);
          if (!step.value) issues.push(`Step ${index + 1}: Select step requires value`);
          break;
        case 'extract':
          if (!step.selector) issues.push(`Step ${index + 1}: Extract step requires selector`);
          break;
        case 'waitForSelector':
          if (!step.selector) issues.push(`Step ${index + 1}: WaitForSelector step requires selector`);
          break;
      }
    });

    // Validate metadata
    if (!plan.metadata) issues.push('Metadata is required');
    if (plan.metadata && typeof plan.metadata.confidence !== 'number') issues.push('Confidence must be a number');
    if (plan.metadata && (plan.metadata.confidence < 0 || plan.metadata.confidence > 1)) {
      issues.push('Confidence must be between 0 and 1');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Switch to different LLM provider
   */
  switchProvider(newLLM: BaseLLM): void {
    this.llm = newLLM;
  }
}

/**
 * Create default plan generator instance
 */
export function createPlanGenerator(config?: PlanGeneratorConfig): PlanGenerator {
  return new PlanGenerator(config);
}

/**
 * Generate plan with default configuration
 */
export async function generatePlan(request: PlanGenerationRequest): Promise<PlanGenerationResponse> {
  const generator = createPlanGenerator();
  return generator.generatePlan(request);
} 