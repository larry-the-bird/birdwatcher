# Project Structure

This document explains the clean, reorganized structure of the simplified ReAct task executor.

## Directory Structure

```
task-executor/
├── src/                          # 🎯 Core Implementation
│   ├── core/                     # Business logic
│   │   ├── react-agent.ts        # AI exploration using ReAct pattern
│   │   └── path-executor.ts      # Execute saved automation paths
│   ├── storage/                  # Data persistence
│   │   └── path-storage.ts       # File-based path storage
│   ├── handlers/                 # Request orchestration
│   │   └── simplified-handler.ts # Main task handler
│   └── utils/                    # Browser automation
│       └── browser-executor.ts   # Playwright wrapper
├── __tests__/                    # 🧪 Test Suite
│   └── simplified/               # Tests for new implementation
│       ├── react-agent.test.ts   # ReAct agent tests
│       ├── path-executor.test.ts # Path execution tests
│       └── path-storage.test.ts  # Storage tests
├── llm/                          # 🤖 Language Model Providers
│   ├── base-llm.ts              # Abstract LLM interface
│   ├── openai-llm.ts            # OpenAI GPT implementation
│   ├── anthropic-llm.ts         # Anthropic Claude implementation
│   └── llm-factory.ts           # Provider factory
├── old-implementation/           # 📦 Archived Complex Version
│   ├── *.ts                     # Original complex implementation
│   └── integration/             # Old integration tests
├── index.ts                      # 🚀 Lambda Entry Point
├── types.ts                      # 📋 TypeScript Definitions
├── example-usage.ts              # 📚 Usage Examples
├── test-simplified.ts            # 🔬 Integration Test
└── README.md                     # 📖 Documentation
```

## Key Design Principles

### 1. **Separation of Concerns**
- **`src/core/`**: Pure business logic for ReAct exploration and path execution
- **`src/storage/`**: Data persistence abstracted from business logic
- **`src/handlers/`**: Request orchestration and workflow management
- **`src/utils/`**: Technical utilities (browser automation)

### 2. **Clean Dependencies**
- Core modules don't depend on external services
- Storage abstraction allows easy swapping of persistence layers
- Handlers orchestrate between components
- Utils provide technical capabilities

### 3. **Test Organization**
- **`__tests__/simplified/`**: Only tests for the new simplified implementation
- **`old-implementation/`**: All legacy code archived but preserved
- Clean separation between old and new test suites

### 4. **Single Responsibility**
Each module has one clear purpose:
- **ReactAgent**: Explore and learn new automation paths
- **PathExecutor**: Execute known paths efficiently
- **PathStorage**: Persist and retrieve execution paths
- **SimplifiedHandler**: Orchestrate the complete workflow

## File Responsibilities

### Core Components

| File | Purpose | Dependencies |
|------|---------|-------------|
| `src/core/react-agent.ts` | AI-driven exploration using ReAct pattern | BrowserExecutor, LLM |
| `src/core/path-executor.ts` | Execute saved automation paths | BrowserExecutor |
| `src/storage/path-storage.ts` | File-based path persistence | Node.js fs |
| `src/handlers/simplified-handler.ts` | Main workflow orchestration | All core components |
| `src/utils/browser-executor.ts` | Browser automation wrapper | Playwright |

### Support Files

| File | Purpose |
|------|---------|
| `index.ts` | Lambda function entry point |
| `types.ts` | TypeScript interfaces and types |
| `example-usage.ts` | Complete usage examples |
| `test-simplified.ts` | End-to-end workflow test |

## Clean Up Achievements

### ✅ **Removed Complexity**
- Multiple execution modes (plan/interactive/auto)
- Complex caching with TTL and versioning
- Feedback loops and plan refinement
- Monitoring and change detection
- Multi-LLM fallback systems
- Progress scoring and human escalation

### ✅ **Preserved Essentials**
- ReAct-based AI exploration
- Path storage and reuse
- Browser automation capabilities
- LLM integration
- Comprehensive testing
- Clear documentation

### ✅ **Improved Organization**
- Logical directory structure
- Clear separation of concerns
- Archived old implementation
- Focused test suite
- Updated documentation

## Development Workflow

1. **Development**: All new code goes in `src/`
2. **Testing**: Use `npm test` to run simplified tests only
3. **Examples**: Use `npm run example` for demonstrations
4. **Integration**: Use `npm run test:flow` for end-to-end testing

This structure supports the core ReAct workflow while maintaining simplicity and clarity.