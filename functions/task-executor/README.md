# Task Executor Lambda Function

A serverless function that performs intelligent web automation using a hybrid approach: LLM-generated plans cached for efficient reuse with Playwright browser automation.

## 🚀 Features

- **Hybrid LLM-Browser Automation**: First run uses OpenAI to generate detailed automation plans, subsequent runs execute cached plans directly
- **Intelligent Caching**: Plans are cached with TTL and smart invalidation strategies
- **Robust Browser Automation**: Playwright-powered execution with comprehensive error handling
- **Type-Safe**: Full TypeScript implementation with Zod validation
- **Production Ready**: Optimized for AWS Lambda with proper logging and monitoring

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Task Input    │ -> │  Plan Generator  │ -> │ Browser Executor │
│                 │    │     (OpenAI)     │    │   (Playwright)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                       │
         v                        v                       v
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Input Validation│    │  Cache Manager   │    │ Results Storage │
│     (Zod)       │    │   (Database)     │    │   (Database)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 📋 Core Components

### 1. Plan Generator (`plan-generator.ts`)
- Uses OpenAI GPT-4 to analyze tasks and generate step-by-step automation plans
- Validates generated plans for safety and executability
- Estimates execution duration and confidence scores

### 2. Browser Executor (`browser-executor.ts`)
- Executes automation plans using Playwright
- Supports all common browser actions (click, type, extract, scroll, etc.)
- Robust error handling with retry logic and fallback strategies

### 3. Cache Manager (`cache-manager.ts`)
- Intelligent plan caching with configurable TTL
- Hit rate tracking and performance analytics
- Automatic cleanup of expired entries

### 4. Main Handler (`index.ts`)
- Orchestrates the entire workflow
- Handles different input formats (API Gateway, direct invocation)
- Comprehensive error handling and response formatting

## 🛠️ Installation

1. **Install Dependencies**
   ```bash
   cd functions/task-executor
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configurations
   ```

3. **Build**
   ```bash
   npm run build
   ```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Yes | - |
| `OPENAI_API_KEY` | OpenAI API key for plan generation | Yes | - |
| `NODE_ENV` | Environment (development/production) | No | development |
| `BROWSER_TIMEOUT` | Browser operation timeout (ms) | No | 60000 |
| `CACHE_TTL_DAYS` | Plan cache TTL in days | No | 7 |

### Task Input Schema

```typescript
{
  taskId?: string;          // Optional existing task ID
  instruction: string;      // Task description
  url: string;             // Target URL
  options?: {
    forceNewPlan?: boolean;    // Force new plan generation
    timeout?: number;          // Execution timeout
    screenshot?: boolean;      // Take screenshots
    viewport?: {
      width: number;
      height: number;
    };
    userAgent?: string;
    headers?: Record<string, string>;
  };
}
```

## 📖 Usage Examples

### Basic Task Execution

```javascript
const taskInput = {
  instruction: "Find the price of the latest iPhone on Apple's website",
  url: "https://www.apple.com",
  options: {
    screenshot: true,
    timeout: 60000
  }
};

const result = await handler(taskInput);
console.log(result.extractedData);
```

### Using Existing Task

```javascript
const taskInput = {
  taskId: "existing-task-id",
  instruction: "Check product availability",
  url: "https://example.com/product"
};
```

### Force New Plan Generation

```javascript
const taskInput = {
  instruction: "Extract latest news headlines",
  url: "https://news.example.com",
  options: {
    forceNewPlan: true  // Bypass cache
  }
};
```

## 🎯 Response Format

### Success Response
```json
{
  "success": true,
  "planId": "plan_1234567890_abc123",
  "taskId": "task-uuid",
  "status": "success",
  "extractedData": {
    "prices": ["$999", "$1099"],
    "availability": "In Stock"
  },
  "screenshots": 2,
  "metrics": {
    "executionTime": 15420,
    "stepsCompleted": 8,
    "stepsTotal": 8,
    "retryCount": 1,
    "totalTime": 18350,
    "cacheHit": true
  },
  "logs": [...]
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "type": "BrowserExecutionError",
    "message": "Element not found",
    "code": "ELEMENT_NOT_FOUND",
    "details": {},
    "timestamp": "2024-01-15T10:30:00Z"
  },
  "metrics": {
    "totalTime": 5420,
    "failed": true
  }
}
```

## 🚀 Deployment

### AWS Lambda

1. **Build the deployment package**
   ```bash
   npm run build
   zip -r task-executor.zip dist/ node_modules/ package.json
   ```

2. **Lambda Configuration**
   - Runtime: Node.js 18.x
   - Memory: 1024MB (minimum for Playwright)
   - Timeout: 5-10 minutes
   - Environment variables: Set all required vars

3. **Lambda Layers** (for Playwright)
   ```bash
   # Use pre-built Playwright layer or create custom layer
   aws lambda publish-layer-version \
     --layer-name playwright-chromium \
     --zip-file fileb://playwright-layer.zip
   ```

### Environment-Specific Configs

- **Development**: Headless=false for debugging
- **Production**: Headless=true, optimized memory/timeout
- **Testing**: Mock OpenAI responses, shorter timeouts

## 🔍 Monitoring & Debugging

### Health Check Endpoint

```javascript
import { healthCheck } from './index';

const health = await healthCheck();
console.log(health.body); // Health status and checks
```

### Cache Performance

```javascript
const cacheStats = await cacheManager.getCacheStats();
console.log(`Hit rate: ${cacheStats.hitRate}`);
```

### Common Issues

1. **Browser Launch Failures**
   - Ensure sufficient memory allocation (1GB+)
   - Check Lambda layer configuration for Playwright

2. **Plan Generation Failures**
   - Verify OpenAI API key and quota
   - Check input validation and URL accessibility

3. **Cache Issues**
   - Monitor database connection health
   - Review cache TTL settings

## 🧪 Testing

### Local Testing

```bash
# Run with test input
npm run dev

# Test specific components
npm test
```

### Integration Testing

```javascript
// Test full workflow
const testResult = await handler({
  instruction: "Test task",
  url: "https://httpbin.org/html"
});
```

## 📈 Performance Optimization

### Plan Caching
- Cache hit rate typically >80% after initial runs
- 5-10x faster execution with cached plans
- Automatic cleanup prevents database bloat

### Browser Optimization
- Headless mode for production
- Optimized Chromium args for Lambda
- Connection pooling for database calls

### Cost Optimization
- LLM calls only on first execution per task type
- Efficient browser resource management
- Smart retry strategies to minimize failures

## 🔐 Security Considerations

- Input validation with Zod schemas
- Safe JavaScript evaluation in browser context
- No sensitive data in logs
- Environment variable encryption recommended

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new functionality
4. Submit pull request with detailed description

## 📄 License

MIT License - see LICENSE file for details 