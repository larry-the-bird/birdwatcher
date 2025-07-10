import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { PromptManager, PromptTemplateVars, PromptConfig, getPrompts, getSystemPrompt, getUserPrompt, getInteractiveBrowserAgentPrompt } from '../../prompts/prompt-manager';

describe('PromptManager', () => {
  const testDir = join(__dirname, 'test-prompts');
  const systemPromptPath = join(testDir, 'system-prompt.md');
  const userPromptPath = join(testDir, 'user-prompt-template.md');
  const interactivePromptPath = join(testDir, 'interactive-browser-agent-prompt.md');

  const testSystemPrompt = `# Test System Prompt
You are a test automation expert.`;

  const testUserPrompt = `# Test User Prompt
Instruction: {{instruction}}
URL: {{url}}
Viewport: {{viewport}}`;

  const testInteractivePrompt = `# Test Interactive Prompt
Task: {{instruction}}
URL: {{url}}
Current URL: {{browserState.currentUrl}}
DOM: {{browserState.dom}}
Screenshot: {{#if browserState.screenshot}}Available{{else}}Not available{{/if}}
Step: {{browserState.stepNumber}}/{{browserState.maxSteps}}
Previous Steps:
{{#if previousSteps}}
{{previousSteps}}
{{else}}
No previous steps
{{/if}}`;

  beforeEach(() => {
    // Create test directory and files
    mkdirSync(testDir, { recursive: true });
    writeFileSync(systemPromptPath, testSystemPrompt);
    writeFileSync(userPromptPath, testUserPrompt);
    writeFileSync(interactivePromptPath, testInteractivePrompt);
  });

  afterEach(() => {
    // Clean up test files
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('Constructor and Loading', () => {
    it('should load prompts from default files', () => {
      const promptManager = new PromptManager({
        systemPromptPath,
        userPromptTemplatePath: userPromptPath,
        interactiveBrowserAgentPromptPath: interactivePromptPath,
      });

      expect(promptManager.getSystemPrompt()).toBe(testSystemPrompt);
    });

    it('should use custom prompts when provided', () => {
      const customSystemPrompt = 'Custom system prompt';
      const customUserPrompt = 'Custom user prompt: {{instruction}}';
      const customInteractivePrompt = 'Custom interactive: {{instruction}}';

      const promptManager = new PromptManager({
        customSystemPrompt,
        customUserPromptTemplate: customUserPrompt,
        customInteractiveBrowserAgentPrompt: customInteractivePrompt,
      });

      expect(promptManager.getSystemPrompt()).toBe(customSystemPrompt);
    });

    it('should fall back to defaults when files do not exist', () => {
      const promptManager = new PromptManager({
        systemPromptPath: '/nonexistent/path',
        userPromptTemplatePath: '/nonexistent/path',
        interactiveBrowserAgentPromptPath: '/nonexistent/path',
      });

      const systemPrompt = promptManager.getSystemPrompt();
      expect(systemPrompt).toContain('web automation expert');
      expect(systemPrompt.length).toBeGreaterThan(0);
    });
  });

  describe('getUserPrompt', () => {
    let promptManager: PromptManager;

    beforeEach(() => {
      promptManager = new PromptManager({
        userPromptTemplatePath: userPromptPath,
      });
    });

    it('should substitute basic variables', () => {
      const vars: PromptTemplateVars = {
        instruction: 'Click the submit button',
        url: 'https://example.com',
        viewport: '1920x1080',
      };

      const result = promptManager.getUserPrompt(vars);

      expect(result).toContain('Click the submit button');
      expect(result).toContain('https://example.com');
      expect(result).toContain('1920x1080');
    });

    it('should handle missing optional variables gracefully', () => {
      const vars: PromptTemplateVars = {
        instruction: 'Test instruction',
        url: 'https://test.com',
        viewport: '800x600',
      };

      const result = promptManager.getUserPrompt(vars);

      expect(result).toContain('Test instruction');
      expect(result).toContain('https://test.com');
    });
  });

  describe('getInteractiveBrowserAgentPrompt', () => {
    let promptManager: PromptManager;

    beforeEach(() => {
      promptManager = new PromptManager({
        interactiveBrowserAgentPromptPath: interactivePromptPath,
      });
    });

    it('should substitute all browser state variables', () => {
      const vars: PromptTemplateVars = {
        instruction: 'Fill out the form',
        url: 'https://example.com',
        viewport: '1920x1080',
        browserState: {
          currentUrl: 'https://example.com/form',
          screenshot: 'base64screenshot',
          dom: '<html><body>Test DOM content</body></html>',
          viewport: { width: 1920, height: 1080 },
          stepNumber: 3,
          maxSteps: 10,
          timestamp: '2023-01-01T12:00:00.000Z',
        },
        previousSteps: 'Step 1: navigate - Progress: 0.5\nStep 2: click - Progress: 0.8',
      };

      const result = promptManager.getInteractiveBrowserAgentPrompt(vars);

      expect(result).toContain('Fill out the form');
      expect(result).toContain('https://example.com/form');
      expect(result).toContain('Test DOM content');
      expect(result).toContain('Available'); // Screenshot available
      expect(result).toContain('3/10'); // Step number
      expect(result).toContain('Step 1: navigate - Progress: 0.5');
    });

    it('should handle missing screenshot', () => {
      const vars: PromptTemplateVars = {
        instruction: 'Test task',
        url: 'https://example.com',
        viewport: '1920x1080',
        browserState: {
          currentUrl: 'https://example.com',
          screenshot: null,
          dom: '<html></html>',
          viewport: { width: 1920, height: 1080 },
          stepNumber: 1,
          maxSteps: 5,
          timestamp: '2023-01-01T12:00:00.000Z',
        },
      };

      const result = promptManager.getInteractiveBrowserAgentPrompt(vars);

      expect(result).toContain('Not available'); // Screenshot not available
    });

    it('should handle missing previous steps', () => {
      const vars: PromptTemplateVars = {
        instruction: 'Test task',
        url: 'https://example.com',
        viewport: '1920x1080',
        browserState: {
          currentUrl: 'https://example.com',
          screenshot: null,
          dom: '<html></html>',
          viewport: { width: 1920, height: 1080 },
          stepNumber: 1,
          maxSteps: 5,
          timestamp: '2023-01-01T12:00:00.000Z',
        },
      };

      const result = promptManager.getInteractiveBrowserAgentPrompt(vars);

      expect(result).toContain('No previous steps');
    });

    it('should handle missing browser state', () => {
      const vars: PromptTemplateVars = {
        instruction: 'Test task',
        url: 'https://example.com',
        viewport: '1920x1080',
      };

      const result = promptManager.getInteractiveBrowserAgentPrompt(vars);

      expect(result).toContain('Test task');
      expect(result).toContain('https://example.com');
    });
  });

  describe('getPrompts', () => {
    let promptManager: PromptManager;

    beforeEach(() => {
      promptManager = new PromptManager({
        systemPromptPath,
        userPromptTemplatePath: userPromptPath,
      });
    });

    it('should return both system and user prompts', () => {
      const vars: PromptTemplateVars = {
        instruction: 'Test instruction',
        url: 'https://test.com',
        viewport: '1920x1080',
      };

      const result = promptManager.getPrompts(vars);

      expect(result.systemPrompt).toBe(testSystemPrompt);
      expect(result.userPrompt).toContain('Test instruction');
      expect(result.userPrompt).toContain('https://test.com');
    });
  });

  describe('validateTemplate', () => {
    let promptManager: PromptManager;

    beforeEach(() => {
      promptManager = new PromptManager();
    });

    it('should validate valid template variables', () => {
      const vars: PromptTemplateVars = {
        instruction: 'Valid instruction',
        url: 'https://example.com',
        viewport: '1920x1080',
      };

      const result = promptManager.validateTemplate(vars);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty instruction', () => {
      const vars: PromptTemplateVars = {
        instruction: '',
        url: 'https://example.com',
        viewport: '1920x1080',
      };

      const result = promptManager.validateTemplate(vars);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Instruction is required');
    });

    it('should reject empty URL', () => {
      const vars: PromptTemplateVars = {
        instruction: 'Valid instruction',
        url: '',
        viewport: '1920x1080',
      };

      const result = promptManager.validateTemplate(vars);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('URL is required');
    });

    it('should reject invalid URL format', () => {
      const vars: PromptTemplateVars = {
        instruction: 'Valid instruction',
        url: 'not-a-valid-url',
        viewport: '1920x1080',
      };

      const result = promptManager.validateTemplate(vars);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('URL must be a valid HTTP/HTTPS URL');
    });

    it('should accept valid HTTP and HTTPS URLs', () => {
      const httpVars: PromptTemplateVars = {
        instruction: 'Valid instruction',
        url: 'http://example.com',
        viewport: '1920x1080',
      };

      const httpsVars: PromptTemplateVars = {
        instruction: 'Valid instruction',
        url: 'https://example.com',
        viewport: '1920x1080',
      };

      expect(promptManager.validateTemplate(httpVars).valid).toBe(true);
      expect(promptManager.validateTemplate(httpsVars).valid).toBe(true);
    });
  });

  describe('getPromptStats', () => {
    let promptManager: PromptManager;

    beforeEach(() => {
      promptManager = new PromptManager({
        systemPromptPath,
        userPromptTemplatePath: userPromptPath,
      });
    });

    it('should return accurate prompt statistics', () => {
      const vars: PromptTemplateVars = {
        instruction: 'Test instruction',
        url: 'https://test.com',
        viewport: '1920x1080',
      };

      const stats = promptManager.getPromptStats(vars);

      expect(stats.systemPromptLength).toBe(testSystemPrompt.length);
      expect(stats.userPromptLength).toBeGreaterThan(0);
      expect(stats.totalLength).toBe(stats.systemPromptLength + stats.userPromptLength);
      expect(stats.estimatedTokens).toBeGreaterThan(0);
    });
  });

  describe('Static methods', () => {
    it('should create prompt manager with custom prompts', () => {
      const customPrompt = 'Custom system prompt';
      const config: PromptConfig = {
        customSystemPrompt: customPrompt,
      };

      const promptManager = PromptManager.withCustomPrompts(config);

      expect(promptManager.getSystemPrompt()).toBe(customPrompt);
    });
  });

  describe('Global convenience functions', () => {
    const vars: PromptTemplateVars = {
      instruction: 'Test instruction',
      url: 'https://test.com',
      viewport: '1920x1080',
    };

    it('should provide getPrompts convenience function', () => {
      const result = getPrompts(vars);

      expect(result.systemPrompt).toBeDefined();
      expect(result.userPrompt).toBeDefined();
      expect(result.userPrompt).toContain('Test instruction');
    });

    it('should provide getSystemPrompt convenience function', () => {
      const result = getSystemPrompt();

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should provide getUserPrompt convenience function', () => {
      const result = getUserPrompt(vars);

      expect(result).toBeDefined();
      expect(result).toContain('Test instruction');
      expect(result).toContain('https://test.com');
    });

    it('should provide getInteractiveBrowserAgentPrompt convenience function', () => {
      const result = getInteractiveBrowserAgentPrompt(vars);

      expect(result).toBeDefined();
      expect(result).toContain('Test instruction');
      expect(result).toContain('https://test.com');
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle very long DOM content in interactive prompt', () => {
      const longDom = 'x'.repeat(10000);
      const vars: PromptTemplateVars = {
        instruction: 'Test',
        url: 'https://test.com',
        viewport: '1920x1080',
        browserState: {
          currentUrl: 'https://test.com',
          dom: longDom,
          viewport: { width: 1920, height: 1080 },
          stepNumber: 1,
          maxSteps: 5,
          timestamp: '2023-01-01T12:00:00.000Z',
        },
      };

      const promptManager = new PromptManager();
      const result = promptManager.getInteractiveBrowserAgentPrompt(vars);

      // Should truncate DOM to 4000 characters
      expect(result).toContain('x'.repeat(4000));
      expect(result).not.toContain('x'.repeat(4001));
    });

    it('should handle undefined browser state fields gracefully', () => {
      const vars: PromptTemplateVars = {
        instruction: 'Test',
        url: 'https://test.com',
        viewport: '1920x1080',
        browserState: {
          currentUrl: '',
          dom: undefined as any,
          viewport: { width: 1920, height: 1080 },
        },
      };

      const promptManager = new PromptManager();
      const result = promptManager.getInteractiveBrowserAgentPrompt(vars);

      expect(result).toBeDefined();
      expect(result).toContain('Test');
    });

    it('should handle special characters in template variables', () => {
      const vars: PromptTemplateVars = {
        instruction: 'Test with "quotes" and <brackets> and & ampersands',
        url: 'https://test.com?param=value&other=test',
        viewport: '1920x1080',
      };

      const promptManager = new PromptManager();
      const result = promptManager.getUserPrompt(vars);

      expect(result).toContain('Test with "quotes" and <brackets> and & ampersands');
      expect(result).toContain('https://test.com?param=value&other=test');
    });
  });
}); 