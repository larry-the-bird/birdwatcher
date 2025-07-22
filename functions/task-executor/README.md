# Simplified ReAct Task Executor

## Overview

This is a simplified implementation of a ReAct (Reasoning and Acting) based web automation system that focuses on a single, clear workflow:

1. **First Run**: AI explores the task using ReAct approach to find a working path
2. **Subsequent Runs**: Execute the saved path without AI involvement
3. **On Failure**: Delete the saved path and let AI find a new one

## Project Structure

```
task-executor/
├── src/                          # Main source code
│   ├── core/                     # Core business logic
│   │   ├── react-agent.ts        # ReAct exploration agent
│   │   └── path-executor.ts      # Execute saved paths
│   ├── storage/                  # Data persistence
│   │   └── path-storage.ts       # File-based path storage
│   ├── handlers/                 # Request handlers
│   │   └── simplified-handler.ts # Main orchestrator
│   └── utils/                    # Utilities
│       └── browser-executor.ts   # Browser automation wrapper
├── __tests__/
│   └── simplified/               # Tests for new implementation
│       ├── react-agent.test.ts
│       ├── path-executor.test.ts
│       └── path-storage.test.ts
├── llm/                          # LLM providers
│   ├── base-llm.ts
│   ├── openai-llm.ts
│   ├── anthropic-llm.ts
│   └── llm-factory.ts
├── old-implementation/           # Archived complex implementation
├── index.ts                      # Lambda entry point
├── types.ts                      # TypeScript definitions
└── example-usage.ts              # Usage examples
```

## Architecture

### Core Components

1. **ReactAgent** (`src/core/react-agent.ts`)
   - Uses LLM to explore web pages step-by-step
   - Implements ReAct pattern (Thought → Action → Observation)
   - Returns successful execution paths

2. **PathStorage** (`src/storage/path-storage.ts`)
   - Simple file-based storage for execution paths
   - Stores paths as JSON files with task ID as filename
   - In-memory cache for performance

3. **PathExecutor** (`src/core/path-executor.ts`)
   - Executes saved paths without AI
   - Fast, deterministic execution
   - Reports failures for re-exploration

4. **SimplifiedTaskHandler** (`src/handlers/simplified-handler.ts`)
   - Main orchestrator
   - Manages the flow: saved path → execute → fallback to AI

## Usage

### Basic Example

```typescript
import { SimplifiedTaskHandler } from './src/handlers/simplified-handler';

const handler = new SimplifiedTaskHandler();

const task = {
  id: 'search-coffee-prices',
  url: 'https://www.google.com',
  instruction: 'Search for coffee prices in Stockholm and extract the first result'
};

// First run - AI explores and saves path
const result1 = await handler.executeTask(task);
// Output: { success: true, usedSavedPath: false, extractedData: {...} }

// Second run - uses saved path (fast, no AI)
const result2 = await handler.executeTask(task);
// Output: { success: true, usedSavedPath: true, extractedData: {...} }
```

### Lambda Handler

```typescript
// Use index.ts as your Lambda handler
export async function handler(event: any) {
  // Event format:
  // {
  //   id: "unique-task-id",
  //   url: "https://example.com",
  //   instruction: "What to do on the page"
  // }
}
```

## Testing

Run the test files:

```bash
# Run all simplified tests
npm test

# Run tests in watch mode
npm test:watch

# Run tests with coverage
npm test:coverage

# Run the example flow
npm run example

# Run the integration test
npm run test:flow
```

## Key Differences from Original Implementation

1. **Single Execution Mode**: No complex modes (plan/interactive/auto)
2. **Simple Storage**: File-based instead of database with complex caching
3. **No Monitoring**: Removed change detection and monitoring features
4. **No Feedback Loops**: No plan refinement or multi-iteration improvements
5. **Single LLM Provider**: Uses one LLM provider, no fallbacks
6. **Minimal Types**: Only essential types for the core workflow

## When to Use This

This simplified implementation is ideal when you need:
- Deterministic execution after initial exploration
- Fast repeated executions without AI costs
- Simple task automation without complex monitoring
- Clear, understandable code with minimal dependencies

## Limitations

- No sophisticated error recovery (just re-explores)
- No plan versioning or history
- No concurrent execution handling
- Basic storage (file-based)
- No metrics or analytics