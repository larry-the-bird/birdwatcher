import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Template variables for user prompts
 */
export interface PromptTemplateVars {
  instruction: string;
  url: string;
  viewport: string;
  browserState?: {
    currentUrl: string;
    screenshot?: string | null;
    dom?: string;
    viewport?: { width: number; height: number };
    stepNumber?: number;
    maxSteps?: number;
    progressScore?: number;
    timestamp?: string;
  };
  previousSteps?: string;
  timeConstraint?: string;
  userAgent?: string;
}

/**
 * Prompt configuration
 */
export interface PromptConfig {
  systemPromptPath?: string;
  userPromptTemplatePath?: string;
  interactiveBrowserAgentPromptPath?: string;
  customSystemPrompt?: string;
  customUserPromptTemplate?: string;
  customInteractiveBrowserAgentPrompt?: string;
}

/**
 * Manages prompt templates and variable substitution
 */
export class PromptManager {
  private static instance: PromptManager | null = null;
  private systemPrompt: string = '';
  private userPromptTemplate: string = '';
  private interactiveBrowserAgentPrompt: string = '';

  constructor(config: PromptConfig = {}) {
    this.loadPrompts(config);
  }

  /**
   * Load prompt templates from files or config
   */
  private loadPrompts(config: PromptConfig = {}): void {
    const promptsDir = __dirname;

    // Load system prompt
    if (config.customSystemPrompt) {
      this.systemPrompt = config.customSystemPrompt;
    } else {
      const systemPromptPath = config.systemPromptPath || join(promptsDir, 'system-prompt.md');
      try {
        this.systemPrompt = readFileSync(systemPromptPath, 'utf-8');
      } catch (error) {
        console.warn('Failed to load system prompt from file, using default');
        this.systemPrompt = this.getDefaultSystemPrompt();
      }
    }

    // Load user prompt template
    if (config.customUserPromptTemplate) {
      this.userPromptTemplate = config.customUserPromptTemplate;
    } else {
      const userPromptPath = config.userPromptTemplatePath || join(promptsDir, 'user-prompt-template.md');
      try {
        this.userPromptTemplate = readFileSync(userPromptPath, 'utf-8');
      } catch (error) {
        console.warn('Failed to load user prompt template from file, using default');
        this.userPromptTemplate = this.getDefaultUserPromptTemplate();
      }
    }

    // Load interactive browser agent prompt template
    if (config.customInteractiveBrowserAgentPrompt) {
      this.interactiveBrowserAgentPrompt = config.customInteractiveBrowserAgentPrompt;
    } else {
      const interactivePromptPath = config.interactiveBrowserAgentPromptPath || join(promptsDir, 'interactive-browser-agent-prompt.md');
      try {
        this.interactiveBrowserAgentPrompt = readFileSync(interactivePromptPath, 'utf-8');
      } catch (error) {
        console.warn('Failed to load interactive browser agent prompt template from file, using default');
        this.interactiveBrowserAgentPrompt = this.getDefaultInteractiveBrowserAgentPrompt();
      }
    }
  }

  /**
   * Get the system prompt
   */
  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  /**
   * Generate user prompt with variable substitution
   */
  getUserPrompt(vars: PromptTemplateVars): string {
    let prompt = this.userPromptTemplate;

    // Replace variables
    prompt = prompt.replace(/\{\{instruction\}\}/g, vars.instruction);
    prompt = prompt.replace(/\{\{url\}\}/g, vars.url);
    prompt = prompt.replace(/\{\{viewport\}\}/g, vars.viewport);

    return prompt.trim();
  }

  /**
   * Generate interactive browser agent prompt with variable substitution
   */
  getInteractiveBrowserAgentPrompt(vars: PromptTemplateVars): string {
    let prompt = this.interactiveBrowserAgentPrompt;

    // Replace basic variables
    prompt = prompt.replace(/\{\{instruction\}\}/g, vars.instruction);
    prompt = prompt.replace(/\{\{url\}\}/g, vars.url);

    // Handle browser state
    if (vars.browserState) {
      prompt = prompt.replace(/\{\{browserState\.currentUrl\}\}/g, vars.browserState.currentUrl || '');
      prompt = prompt.replace(/\{\{browserState\.dom\}\}/g, (vars.browserState.dom || '').substring(0, 4000));
      prompt = prompt.replace(/\{\{browserState\.timestamp\}\}/g, vars.browserState.timestamp || '');
      prompt = prompt.replace(/\{\{browserState\.stepNumber\}\}/g, String(vars.browserState.stepNumber || 1));
      prompt = prompt.replace(/\{\{browserState\.maxSteps\}\}/g, String(vars.browserState.maxSteps || 10));

      // Handle screenshot conditional
      if (vars.browserState.screenshot) {
        prompt = prompt.replace(/\{\{#if browserState\.screenshot\}\}Available\{\{else\}\}Not available\{\{\/if\}\}/g, 'Available');
      } else {
        prompt = prompt.replace(/\{\{#if browserState\.screenshot\}\}Available\{\{else\}\}Not available\{\{\/if\}\}/g, 'Not available');
      }
    }

    // Handle previous steps
    if (vars.previousSteps) {
      prompt = prompt.replace(/\{\{#if previousSteps\}\}/g, '');
      prompt = prompt.replace(/\{\{previousSteps\}\}/g, vars.previousSteps);
      prompt = prompt.replace(/\{\{else\}\}No previous steps\{\{\/if\}\}/g, '');
    } else {
      // Remove the conditional section and show "No previous steps"
      prompt = prompt.replace(/\{\{#if previousSteps\}\}[\s\S]*?\{\{else\}\}/g, '');
      prompt = prompt.replace(/\{\{\/if\}\}/g, '');
    }

    return prompt.trim();
  }

  /**
   * Get both system and user prompts
   */
  getPrompts(vars: PromptTemplateVars): {
    systemPrompt: string;
    userPrompt: string;
  } {
    return {
      systemPrompt: this.getSystemPrompt(),
      userPrompt: this.getUserPrompt(vars)
    };
  }

  /**
   * Create a new prompt manager with custom prompts
   */
  static withCustomPrompts(config: PromptConfig): PromptManager {
    return new PromptManager(config);
  }

  /**
   * Validate prompt template variables
   */
  validateTemplate(vars: PromptTemplateVars): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!vars.instruction || vars.instruction.trim().length === 0) {
      errors.push('Instruction is required');
    }

    if (!vars.url || vars.url.trim().length === 0) {
      errors.push('URL is required');
    }

    if (vars.url && !this.isValidUrl(vars.url)) {
      errors.push('URL must be a valid HTTP/HTTPS URL');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get prompt statistics
   */
  getPromptStats(vars: PromptTemplateVars): {
    systemPromptLength: number;
    userPromptLength: number;
    totalLength: number;
    estimatedTokens: number;
  } {
    const systemPrompt = this.getSystemPrompt();
    const userPrompt = this.getUserPrompt(vars);

    return {
      systemPromptLength: systemPrompt.length,
      userPromptLength: userPrompt.length,
      totalLength: systemPrompt.length + userPrompt.length,
      estimatedTokens: Math.ceil((systemPrompt.length + userPrompt.length) / 4) // Rough estimate
    };
  }

  /**
   * Default system prompt fallback
   */
  private getDefaultSystemPrompt(): string {
    return `You are a web automation expert. Create detailed automation plans in JSON format.

Your response must be valid JSON with this structure:
{
  "success": true,
  "steps": [{"type": "navigate", "url": "...", "description": "..."}],
  "expectedResults": ["..."],
  "successCriteria": ["..."],
  "failureCriteria": ["..."],
  "fallbackSteps": [],
  "confidence": 0.95,
  "reasoning": "..."
}

Available step types: navigate, click, type, wait, waitForElement, extractText, extractAttribute, screenshot, etc.`;
  }

  /**
   * Default user prompt template fallback
   */
  private getDefaultUserPromptTemplate(): string {
    return `Create an automation plan for this task:

Instruction: {{instruction}}
URL: {{url}}

Create a detailed plan that navigates to the URL and performs the requested actions.`;
  }

  /**
   * Default interactive browser agent prompt template fallback
   */
  private getDefaultInteractiveBrowserAgentPrompt(): string {
    return `You are an intelligent web automation agent. Analyze the current browser state and decide the next action.

TASK: {{instruction}}
URL: {{url}}
Current State: {{browserState.currentUrl}}

Respond with JSON only containing action and progressEvaluation.`;
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }
}

/**
 * Global prompt manager instance
 */
export const promptManager = new PromptManager();

/**
 * Convenience function to get prompts
 */
export function getPrompts(vars: PromptTemplateVars): {
  systemPrompt: string;
  userPrompt: string;
} {
  return promptManager.getPrompts(vars);
}

/**
 * Convenience function to get system prompt only
 */
export function getSystemPrompt(): string {
  return promptManager.getSystemPrompt();
}

/**
 * Convenience function to get user prompt only
 */
export function getUserPrompt(vars: PromptTemplateVars): string {
  return promptManager.getUserPrompt(vars);
}

/**
 * Convenience function to get interactive browser agent prompt only
 */
export function getInteractiveBrowserAgentPrompt(vars: PromptTemplateVars): string {
  return promptManager.getInteractiveBrowserAgentPrompt(vars);
} 