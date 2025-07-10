# Feedback Loop System

A self-improving web automation system that uses plan-execute-feedback loops to iteratively refine automation plans until they succeed.

## Overview

The feedback loop system consists of several components that work together to create a self-improving automation system:

1. **Plan Generator**: Creates initial automation plans using LLM
2. **Browser Executor**: Executes plans in a Playwright browser environment
3. **Feedback Analyzer**: Analyzes execution results and identifies issues
4. **Plan Refiner**: Uses feedback to improve plans for subsequent iterations
5. **Test Runner**: Orchestrates the entire feedback loop process

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Feedback Loop System                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │    Plan     │    │   Browser   │    │  Feedback   │         │
│  │  Generator  │───▶│  Executor   │───▶│  Analyzer   │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│         ▲                                       │               │
│         │                                       ▼               │
│  ┌─────────────┐                        ┌─────────────┐        │
│  │    Plan     │◀───────────────────────│    Test     │        │
│  │   Refiner   │                        │   Runner    │        │
│  └─────────────┘                        └─────────────┘        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Key Features

### 🔄 **Iterative Improvement**
- Plans are refined based on execution feedback
- Each iteration learns from previous failures
- Automatic retry with improved plans

### 🎯 **Intelligent Feedback**
- Categorizes issues by type and severity
- Provides specific improvement suggestions
- Tracks success patterns for future use

### 🧠 **Multi-LLM Support**
- Works with OpenAI GPT models
- Supports Anthropic Claude models
- Automatic provider fallback

### 📊 **Comprehensive Monitoring**
- Detailed execution metrics
- Screenshot capture on failures
- Performance analysis and optimization

## Component Details

### FeedbackAnalyzer

Analyzes execution results and generates structured feedback:

```typescript
const analyzer = new FeedbackAnalyzer({
  enableScreenshotAnalysis: true,
  enablePerformanceAnalysis: true,
  enableSelectorAnalysis: true,
  enableLearning: true
});

const feedback = await analyzer.analyzeFeedback(executionResult, context);
```

**Feedback Types**:
- `selector_not_found`: Element selectors that failed
- `timeout_exceeded`: Steps that took too long
- `element_not_clickable`: Interaction issues
- `javascript_error`: Runtime errors
- `page_structure_changed`: Layout changes

### PlanRefiner

Improves plans based on feedback:

```typescript
const refiner = new PlanRefiner(llm);

const improvedPlan = await refiner.refinePlan(
  originalRequest,
  executionFeedback,
  previousPlan,
  iteration
);
```

**Refinement Strategies**:
- Selector improvement (more robust targeting)
- Timing adjustments (increase timeouts)
- Step reordering (better execution flow)
- Fallback strategies (alternative approaches)

### TestRunner

Orchestrates the complete feedback loop:

```typescript
const testRunner = createTestRunner({
  maxRetries: 3,
  headless: true,
  enableFeedback: true,
  enableLearning: true
});

const result = await testRunner.runTest({
  instruction: 'Search for "TypeScript tutorial" on Google',
  url: 'https://www.google.com'
});
```

## Usage Examples

### Basic Usage

```typescript
import { runQuickTest } from './test-runner';

const result = await runQuickTest(
  'Search for "web automation" on Google',
  'https://www.google.com',
  {
    maxRetries: 3,
    enableFeedback: true
  }
);

console.log(`Success: ${result.success}`);
console.log(`Iterations: ${result.iterations.length}`);
```

### Advanced Usage

```typescript
import { TestRunner, createTestRunner } from './test-runner';

const testRunner = createTestRunner({
  maxRetries: 5,
  headless: false,
  viewport: { width: 1920, height: 1080 },
  screenshotOnFailure: true,
  enableFeedback: true,
  enableLearning: true
});

const tests = [
  {
    instruction: 'Search for "playwright testing" on Google',
    url: 'https://www.google.com'
  },
  {
    instruction: 'Find programming books on Amazon',
    url: 'https://www.amazon.com'
  }
];

for (const test of tests) {
  const result = await testRunner.runTest(test);
  console.log(`Test: ${test.instruction}`);
  console.log(`Result: ${result.success ? 'PASSED' : 'FAILED'}`);
  console.log(`Retries: ${result.metadata.retryCount}`);
}
```

## Running Tests

### Configuration Test
```bash
npm run test-config
```
Tests environment variables and LLM connections.

### Component Tests
```bash
npm run test-components
```
Tests individual components (FeedbackAnalyzer, PlanRefiner, TestRunner).

### Simple Integration Tests
```bash
npm run test-simple
```
Runs simple Google search tests with feedback loop.

### Full Test Suite
```bash
npm run test-all
```
Runs all tests including configuration, components, and integration tests.

### Interactive Test Runner
```bash
npm run test-feedback-loop all
```
Runs comprehensive test suite with multiple scenarios.

## Test Scenarios

The system includes several test scenarios:

1. **Simple Google Search**: Basic search functionality
2. **Complex Google Search**: Multi-step search with result clicking
3. **Amazon Product Search**: E-commerce navigation
4. **GitHub Navigation**: Repository browsing
5. **Failing Scenario**: Deliberate failure to test feedback loop

## Configuration

### Environment Variables

```bash
# Required for LLM functionality
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key

# Optional configuration
LLM_PROVIDER=openai  # or 'anthropic'
LLM_MODEL=gpt-4o     # or specific model
```

### Test Runner Configuration

```typescript
interface TestRunnerConfig {
  maxRetries: number;           // Maximum retry attempts
  timeout: number;              // Overall timeout in ms
  headless: boolean;            // Browser headless mode
  viewport: {                   // Browser viewport size
    width: number;
    height: number;
  };
  screenshotOnFailure: boolean; // Capture screenshots on failure
  screenshotOnSuccess: boolean; // Capture screenshots on success
  enableFeedback: boolean;      // Enable feedback analysis
  enableLearning: boolean;      // Enable learning from results
  outputDirectory: string;      // Directory for outputs
  environment: string;          // Test environment
}
```

## Feedback Types and Solutions

### Selector Issues
- **Problem**: Elements not found
- **Solution**: Use data attributes, CSS selectors, or XPath
- **Refinement**: Automatic selector improvement

### Timing Issues
- **Problem**: Steps timeout
- **Solution**: Increase wait times, add intermediate waits
- **Refinement**: Dynamic timeout adjustment

### Interaction Issues
- **Problem**: Elements not clickable
- **Solution**: Scroll to element, wait for visibility
- **Refinement**: Add scroll steps automatically

### JavaScript Errors
- **Problem**: Runtime errors
- **Solution**: Wait for page stability, avoid JS-dependent elements
- **Refinement**: Add error handling steps

## Performance Metrics

The system tracks various metrics:

- **Execution Time**: Total time per test
- **Success Rate**: Percentage of successful tests
- **Retry Count**: Number of iterations needed
- **Improvement Rate**: Success improvement over iterations
- **Cost Estimation**: LLM API costs per test

## Learning and Optimization

### Pattern Recognition
- Successful selectors are remembered
- Failed approaches are avoided
- Common patterns are identified

### Continuous Improvement
- Plans get better over time
- Feedback quality improves
- Success rates increase

### Cost Optimization
- Efficient LLM usage
- Minimal API calls
- Smart caching of successful patterns

## Troubleshooting

### Common Issues

1. **LLM API Errors**
   - Check API keys
   - Verify network connectivity
   - Monitor rate limits

2. **Browser Execution Errors**
   - Ensure Playwright is installed
   - Check system dependencies
   - Verify browser permissions

3. **Feedback Loop Failures**
   - Review error logs
   - Check timeout settings
   - Verify selector strategies

### Debug Mode

Run tests in non-headless mode for debugging:

```bash
npm run test-simple -- --debug
```

## Future Enhancements

- **Multi-browser Support**: Chrome, Firefox, Safari
- **Parallel Execution**: Run multiple tests simultaneously
- **Advanced Learning**: ML-based pattern recognition
- **Visual Feedback**: Screenshot comparison analysis
- **Performance Monitoring**: Real-time metrics dashboard

## Contributing

1. Add new test scenarios in `test-feedback-loop.ts`
2. Implement new feedback types in `FeedbackAnalyzer`
3. Add refinement strategies in `PlanRefiner`
4. Update documentation and examples

## License

MIT License - See LICENSE file for details. 