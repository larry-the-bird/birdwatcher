# Task Executor Lambda Function

A serverless function that performs intelligent web automation using a hybrid approach: LLM-generated plans cached for efficient reuse with Playwright browser automation, enhanced with interactive execution and self-improving feedback loops.

## 🚀 Features

- **Multiple Execution Modes**: Traditional planned execution, interactive step-by-step, and automatic mode selection
- **Interactive Browser Agent**: Real-time step-by-step execution with browser state analysis and LLM decision making
- **Feedback Loop System**: Self-improving automation with iterative plan refinement based on execution results
- **Intelligent Caching**: Plans are cached with TTL and smart invalidation strategies
- **Robust Browser Automation**: Playwright-powered execution with comprehensive error handling
- **Multi-LLM Support**: OpenAI GPT-4 and Anthropic Claude with automatic fallback
- **Type-Safe**: Full TypeScript implementation with Zod validation
- **Production Ready**: Optimized for AWS Lambda with proper logging and monitoring

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Task Input    │ -> │  Plan Generator  │ -> │ Browser Executor │
│                 │    │  (Multi-LLM)     │    │   (Playwright)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                       │
         v                        v                       v
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Input Validation│    │  Cache Manager   │    │ Results Storage │
│     (Zod)       │    │   (Database)     │    │   (Database)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                 │
                                 v
                       ┌──────────────────┐    ┌─────────────────┐
                       │Interactive Agent │ -> │ Feedback Loop   │
                       │ (Real-time)      │    │ (Auto-Improve)  │
                       └──────────────────┘    └─────────────────┘
```

## 📋 Core Components

### 1. Main Handler (`index.ts`)
- Orchestrates the entire workflow with mode routing
- Handles different input formats (API Gateway, direct invocation)
- Supports multiple execution modes: `plan`, `interactive`, `auto`
- Comprehensive error handling and response formatting

### 2. Interactive Browser Agent (`interactive-browser-agent.ts`)
- **Real-time Execution**: Step-by-step browser interaction with live state analysis
- **LLM-Guided Decisions**: Uses current DOM and visual state to determine next actions
- **Progress Monitoring**: Tracks task completion with stagnation detection
- **Human Escalation**: Automatically escalates when stuck or confidence is low
- **Screenshot Analysis**: Visual debugging and context capture

### 3. Plan Generator (`plan-generator.ts`)
- Uses OpenAI GPT-4 or Anthropic Claude to analyze tasks and generate automation plans
- Validates generated plans for safety and executability
- Estimates execution duration and confidence scores
- Supports both traditional and interactive planning modes

### 4. Browser Executor (`browser-executor.ts`)
- Executes automation plans using Playwright
- Supports all common browser actions (click, type, extract, scroll, etc.)
- Robust error handling with retry logic and fallback strategies
- Screenshot capture and performance monitoring

### 5. Cache Manager (`cache-manager.ts`)
- Intelligent plan caching with configurable TTL
- Task signature matching for plan reuse
- Hit rate tracking and performance analytics
- Automatic cleanup of expired entries

### 6. Feedback Loop System
- **Feedback Analyzer**: Categorizes execution failures and identifies improvement areas
- **Plan Refiner**: Uses feedback to iteratively improve automation plans
- **Learning Engine**: Builds knowledge base of successful patterns
- **Multi-Iteration Support**: Retries with refined plans until success

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
| `ANTHROPIC_API_KEY` | Anthropic API key (alternative LLM) | No | - |
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
    // Execution Control
    executionMode?: 'plan' | 'interactive' | 'auto';  // Execution strategy
    planOnly?: boolean;        // Only generate plan, don't execute
    executionOnly?: boolean;   // Only execute existing plan, don't generate
    planId?: string;          // Plan ID to execute (for executionOnly mode)
    forceNewPlan?: boolean;    // Force new plan generation
    
    // Browser Configuration
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

### Interactive Execution Mode

```javascript
const taskInput = {
  instruction: "Find the price of the latest iPhone on Apple's website",
  url: "https://www.apple.com",
  options: {
    executionMode: 'interactive',
    screenshot: true,
    timeout: 60000
  }
};

const result = await handler(taskInput);
console.log(result.interactiveSteps);  // Step-by-step execution details
console.log(result.escalation);        // Human escalation status
```

### Traditional Plan Mode

```javascript
const taskInput = {
  instruction: "Extract latest news headlines",
  url: "https://news.example.com",
  options: {
    executionMode: 'plan',
    forceNewPlan: true
  }
};

const result = await handler(taskInput);
console.log(result.extractedData);
```

### Plan-Only Mode (Generate Without Execution)

```javascript
const taskInput = {
  instruction: "Search for 'TypeScript tutorial' on Google",
  url: "https://www.google.com",
  options: {
    planOnly: true
  }
};

const result = await handler(taskInput);
console.log(result.planId);           // Use this ID later for execution
console.log(result.planDetails.steps); // Generated automation steps
```

### Execution-Only Mode (Execute Existing Plan)

```javascript
const taskInput = {
  instruction: "Search for 'TypeScript tutorial' on Google",
  url: "https://www.google.com",
  options: {
    executionOnly: true,
    planId: "plan_1234567890_abc123"  // From previous planOnly call
  }
};

const result = await handler(taskInput);
```

### Auto Mode (Intelligent Mode Selection)

```javascript
const taskInput = {
  instruction: "Check product availability and compare prices",
  url: "https://example-ecommerce.com/product",
  options: {
    executionMode: 'auto'  // Tries interactive first, falls back to plan
  }
};
```

## 🎯 Response Formats

### Interactive Mode Response
```json
{
  "success": true,
  "mode": "interactive",
  "planId": "plan_1234567890_abc123",
  "taskId": "task-uuid",
  "extractedData": {...},
  "interactiveSteps": [
    {
      "stepNumber": 1,
      "action": {...},
      "progressScore": 0.8,
      "reasoning": "Successfully navigated to search page"
    }
  ],
  "escalation": {
    "escalatedToHuman": false,
    "reason": null,
    "confidence": 0.95
  },
  "metrics": {
    "executionTime": 15420,
    "averageProgressScore": 0.85,
    "maxStepsReached": false,
    "stagnationDetected": false
  }
}
```

### Traditional Plan Mode Response
```json
{
  "success": true,
  "mode": "plan",
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
    "cacheHit": true
  }
}
```

### Plan-Only Mode Response
```json
{
  "success": true,
  "mode": "plan_only",
  "planId": "plan_1234567890_abc123",
  "taskSignature": "search_google_typescript_tutorial",
  "planDetails": {
    "steps": [...],
    "estimatedDuration": 30000,
    "confidence": 0.92,
    "reasoning": "Plan generated with high confidence"
  },
  "message": "Plan generated successfully. Use executionOnly mode with this planId to execute."
}
```

## 🧪 Testing & Development

### Local Testing Commands

```bash
# Interactive Testing
npm run invoke                    # Interactive prompt for test scenarios
npm run invoke:simple            # Simple Google search test
npm run invoke:ecommerce         # E-commerce interaction test  
npm run invoke:search            # Search functionality test
npm run invoke:news              # News extraction test
npm run invoke:api               # API Gateway format test

# Mock Testing (No Browser Dependencies)
npm run invoke:mock              # Mock execution without browser
npm run invoke:mock:simple       # Simple mock test
npm run invoke:mock:ecommerce    # E-commerce mock test
npm run invoke:mock:error        # Error scenario mock test
npm run invoke:mock:timeout      # Timeout scenario mock test
npm run test:mock                # Run all mock tests

# Unit Testing
npm test                         # Run Jest test suite
npm run test -- --coverage      # Run with coverage report
```

### Test Suite Coverage

#### **Unit Tests** (38 passing tests)
- **`types.test.ts`** (9 tests): Schema validation and type structures
- **`integration.test.ts`** (12 tests): Complete lambda workflows
- **`handler.test.ts`** (14 tests): Lambda response formats and API contracts
- **`simple.test.ts`** (3 tests): Basic functionality verification

#### **Test Categories**
1. **Type Safety & Validation**: ExecutionStep schemas, TaskInput validation, error handling
2. **Lambda Integration**: Input validation, response formats, API Gateway events
3. **Workflow Simulation**: Task execution scenarios, cache behavior, error handling
4. **Interactive Mode Testing**: Step-by-step execution, progress tracking, escalation scenarios

### Local Development

```bash
# Start development server
npm run dev

# Test specific scenarios locally
npm run invoke:simple           # Test basic functionality
npm run invoke:mock            # Test without external dependencies

# Build and validate
npm run build
npm run lint
```

## 🚀 Deployment

### AWS Lambda Configuration

```yaml
# SAM template.yaml
Resources:
  TaskExecutorFunction:
    Type: AWS::Serverless::Function
    Properties:
      Runtime: nodejs18.x
      MemorySize: 1024
      Timeout: 300
      Environment:
        Variables:
          DATABASE_URL: !Ref DatabaseUrl
          OPENAI_API_KEY: !Ref OpenAIApiKey
          ANTHROPIC_API_KEY: !Ref AnthropicApiKey
```

### Deployment Steps

1. **Build the deployment package**
   ```bash
   npm run build
   sam build
   ```

2. **Deploy to AWS**
   ```bash
   sam deploy --guided
   ```

3. **Configuration Requirements**
   - Memory: 1024MB minimum (for Playwright)
   - Timeout: 5-10 minutes
   - Environment variables: All required vars set
   - Layers: Chrome AWS Lambda layer for browser support

## 🔍 Key Features Deep Dive

### Interactive Browser Agent
- **Real-time State Analysis**: Captures DOM, screenshots, and context at each step
- **LLM Decision Making**: Uses current browser state to determine optimal next actions
- **Progress Tracking**: Monitors completion progress with stagnation detection
- **Human Escalation**: Automatically escalates complex scenarios when confidence drops

### Feedback Loop System
- **Error Analysis**: Categorizes failures (selectors, timeouts, interactions)
- **Plan Refinement**: Iteratively improves plans based on execution feedback
- **Pattern Learning**: Builds knowledge base of successful automation patterns
- **Self-Improvement**: Automatically retries with enhanced plans

### Intelligent Caching
- **Task Signature Matching**: Reuses plans for similar instruction + URL combinations
- **Performance Tracking**: Monitors cache hit rates and execution efficiency
- **TTL Management**: Automatic expiration and cleanup of stale plans
- **Version Control**: Plan versioning with active/inactive state management

This Lambda function provides enterprise-grade web automation with both traditional reliability and cutting-edge interactive capabilities. 