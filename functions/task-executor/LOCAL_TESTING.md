# Local Testing Guide

This guide explains how to test the lambda function locally using various methods.

## 🚀 Quick Start

### 1. Environment Setup

Create a `.env` file in the function directory:

```bash
# Required
DATABASE_URL=postgresql://user:password@localhost:5432/birdwatcher

# Optional (for LLM plan generation)
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key

# Development settings
NODE_ENV=development
DEBUG=task-executor:*
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build the Function

```bash
npm run build
```

## 📋 Testing Methods

### Method 1: Mock Testing (Quickest - No External Dependencies)

Perfect for testing the lambda interface without needing database or API keys:

```bash
# Quick mock tests (no DB/LLM/Browser required)
npm run invoke:mock:simple
npm run invoke:mock:ecommerce
npm run invoke:mock:error
npm run invoke:mock:timeout

# Test multiple scenarios
npm run test:mock

# Interactive mock testing
tsx local-invoke-mock.ts [scenario]
```

### Method 2: Direct Invocation (Full Integration)

Requires database connection and API keys:

```bash
# Test environment check
npm run test:env

# Quick test with simple payload
npm run invoke:simple

# Test with different scenarios
npm run invoke:ecommerce
npm run invoke:search
npm run invoke:news
npm run invoke:api

# Use specific payload
npm run invoke simple
npm run invoke ecommerce

# Full local test (env check + simple invoke)
npm run test:local
```

### Method 2: Custom Payload Files

Create your own payload files in the `payloads/` directory:

```json
{
  "instruction": "Your automation instruction",
  "url": "https://target-website.com", 
  "options": {
    "timeout": 30000,
    "screenshot": true,
    "viewport": {
      "width": 1920,
      "height": 1080
    }
  }
}
```

Then run:
```bash
tsx local-invoke.ts path/to/your/payload.json
```

### Method 3: AWS SAM Local (Advanced)

If you have AWS SAM CLI installed:

```bash
# Build the SAM application
sam build

# Start local API
sam local start-api --port 3001

# Invoke function directly
sam local invoke TaskExecutorFunction --event payloads/simple.json

# Start API Gateway locally
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d @payloads/simple.json
```

### Method 4: Direct TypeScript Execution

For quick testing during development:

```bash
# Run with tsx directly
tsx local-invoke.ts simple

# With environment variables
DATABASE_URL=postgresql://... tsx local-invoke.ts ecommerce

# Interactive environment test
tsx local-test-env.ts
```

## 📦 Available Test Payloads

### Built-in Payloads (in local-invoke.ts)

- **`simple`** - Basic page title extraction
- **`ecommerce`** - Apple iPhone price/availability 
- **`search`** - Google search results
- **`news`** - Hacker News headlines
- **`apiGateway`** - API Gateway event format

### Payload Files (in payloads/ directory)

- **`simple.json`** - HTTPBin HTML test page
- **`apple-iphone.json`** - Apple product page
- **`hackernews.json`** - Hacker News stories
- **`api-gateway-event.json`** - API Gateway event structure

## 🔧 Local Development Tips

### 1. Environment Variables

```bash
# Load from .env file
source .env

# Or set directly
export DATABASE_URL=postgresql://localhost:5432/test
export OPENAI_API_KEY=sk-your-key
```

### 2. Debug Mode

Enable verbose logging:

```bash
DEBUG=* npm run invoke:simple
DEBUG=task-executor:* npm run invoke:simple
```

### 3. Mock Mode

For testing without external dependencies:

```bash
NODE_ENV=test npm run invoke:simple
```

### 4. Browser Debugging

Test with visible browser (non-headless):

```bash
BROWSER_HEADLESS=false npm run invoke:simple
```

## 📊 Understanding Output

### Successful Response

```json
{
  "statusCode": 200,
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {
    "success": true,
    "planId": "plan-abc123",
    "status": "success",
    "extractedData": {
      "title": "Example Page Title",
      "price": "$999"
    },
    "metrics": {
      "executionTime": 15420,
      "stepsCompleted": 3,
      "stepsTotal": 3,
      "retryCount": 0,
      "cacheHit": false
    },
    "logs": [...]
  }
}
```

### Error Response

```json
{
  "statusCode": 500,
  "body": {
    "success": false,
    "error": {
      "message": "Element not found: .price-selector",
      "step": "step-3",
      "type": "BrowserExecutionError"
    },
    "metrics": {
      "executionTime": 8500,
      "stepsCompleted": 2,
      "stepsTotal": 4
    }
  }
}
```

## 🐛 Troubleshooting

### Quick Fix: Use Mock Testing

If you're experiencing database or API issues, use mock testing first:
```bash
npm run invoke:mock:simple  # Works without any external dependencies
```

### Common Issues

1. **Database Connection Error**
   ```bash
   Error connecting to database: TypeError: fetch failed
   ```
   Solutions:
   - Use mock testing: `npm run invoke:mock:simple`
   - Set up a real PostgreSQL database
   - Use the production DATABASE_URL (if you have access)

2. **Plan Generation/Validation Failed** 
   ```bash
   PlanGenerationError: Failed to generate execution plan
   ```
   Causes:
   - Invalid OpenAI API key (401 Incorrect API key)
   - Plan validation failing due to selector issues
   Solutions:
   - Use mock testing: `npm run invoke:mock:ecommerce`
   - Get a valid OpenAI API key from https://platform.openai.com/api-keys
   - Check plan validation logic

3. **Browser Launch Failed**
   ```bash
   Error: Browser launch failed
   ```
   Solution: Install Playwright browsers
   ```bash
   npx playwright install chromium
   ```

4. **LLM API Errors**
   ```bash
   Error: Plan generation failed: API quota exceeded
   ```
   Solutions:
   - Use mock testing to bypass LLM calls
   - Check API key and quota limits
   - Try Anthropic as alternative (set ANTHROPIC_API_KEY)

5. **Timeout Errors**
   ```bash
   Error: Navigation timeout
   ```
   Solution: Increase timeout in payload options

### Debug Commands

```bash
# Check environment
npm run test:env

# Test with simple payload
npm run invoke:simple

# Verbose logging
DEBUG=* npm run invoke:simple

# Check browser installation
npx playwright install --dry-run
```

## 📚 Additional Resources

- [AWS SAM Local Documentation](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference-sam-local.html)
- [Playwright Testing](https://playwright.dev/docs/intro)
- [Jest Testing Framework](https://jestjs.io/docs/getting-started)

## 🎯 Performance Testing

Monitor execution times and optimize:

```bash
# Time execution
time npm run invoke:simple

# Memory usage
NODE_OPTIONS="--max-old-space-size=2048" npm run invoke:ecommerce

# Performance profiling
NODE_ENV=production npm run invoke:simple
```