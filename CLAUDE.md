# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Next.js Frontend (`/next`)
```bash
cd next
npm run dev          # Start development server with Turbopack
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Task Executor Function (`/functions/task-executor`)
```bash
cd functions/task-executor
npm run build        # Compile TypeScript to dist/
npm run dev          # Run with tsx for development
npm run test         # Run Jest tests

# Local Testing & Invocation
npm run invoke                    # Interactive prompt for test scenarios
npm run invoke:simple            # Simple Google search test
npm run invoke:ecommerce         # E-commerce interaction test
npm run invoke:search            # Search functionality test
npm run invoke:news              # News extraction test
npm run invoke:api               # API Gateway format test

# Mock Testing (no external dependencies)
npm run invoke:mock              # Mock execution without browser
npm run invoke:mock:simple       # Simple mock test
npm run invoke:mock:ecommerce    # E-commerce mock test
npm run invoke:mock:error        # Error scenario mock test
npm run invoke:mock:timeout      # Timeout scenario mock test
npm run test:mock                # Run all mock tests
```

### Database Operations (Drizzle)
```bash
cd next
npx drizzle-kit generate    # Generate migrations from schema
npx drizzle-kit migrate     # Run migrations
npx drizzle-kit studio      # Open Drizzle Studio
```

## Architecture Overview

This is a **BirdWatcher** application - a web automation system that monitors websites on scheduled intervals using AI-generated execution plans with advanced interactive capabilities.

### High-Level Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Next.js App   │ -> │  Task Executor   │ -> │   PostgreSQL    │
│   (Frontend)    │    │   (Lambda)       │    │   (Database)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                       │
         v                        v                       v
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  User Interface │    │Interactive Agent │    │ Execution Plans │
│   (Forms/Tabs)  │    │ + Browser Engine │    │ + Results Cache │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                 │
                                 v
                       ┌──────────────────┐
                       │ Feedback Loop    │
                       │ System (Auto-    │
                       │ Improvement)     │
                       └──────────────────┘
```

### Core Components

1. **Next.js Frontend** (`/next/src/`):
   - Modern form interface for creating "birdwatcher" tasks
   - Server actions for form submission with cron scheduling
   - Drizzle ORM with PostgreSQL integration
   - Tailwind CSS + shadcn/ui components
   - Tab-based UI (Create vs Manage birdwatchers)

2. **Task Executor Lambda** (`/functions/task-executor/`):
   - **Multiple Execution Modes:**
     - `plan`: Traditional plan generation + execution
     - `interactive`: Step-by-step execution with real-time browser analysis
     - `auto`: Tries interactive mode first, falls back to plan mode
   - **Interactive Browser Agent**: Real-time step-by-step automation with browser state analysis
   - **Feedback Loop System**: Self-improving plans with iterative refinement
   - **Intelligent Caching**: Plans cached with TTL and smart invalidation
   - **Hybrid LLM Support**: OpenAI GPT-4 + Anthropic Claude with automatic fallback
   - **Plan/Execution Separation**: `planOnly` and `executionOnly` modes for workflow control

3. **Database Schema** (PostgreSQL with Drizzle):
   - `task` table: User-created monitoring tasks with cron schedules
   - `execution_plans` table: AI-generated step-by-step automation plans
   - `execution_results` table: Execution logs and extracted data
   - `plan_cache` table: Cached plans with TTL and hit tracking

### Key Features & Patterns

#### 🤖 Interactive Execution Mode
- **Real-time Browser Analysis**: Captures DOM state, screenshots, and page context at each step
- **LLM-Guided Decisions**: Uses current browser state to determine next actions dynamically
- **Progress Tracking**: Monitors task completion progress with stagnation detection
- **Human Escalation**: Automatically escalates complex scenarios when stuck

#### 🔄 Feedback Loop System
- **Plan Refinement**: Analyzes execution failures and improves plans iteratively
- **Error Categorization**: Identifies selector issues, timeouts, and interaction problems
- **Self-Learning**: Builds knowledge base of successful patterns for future use
- **Multi-Iteration Support**: Retries with improved plans until success or max attempts

#### 🎯 Execution Modes
- **Traditional (`plan`)**: Generate complete plan upfront, then execute
- **Interactive (`interactive`)**: Step-by-step execution with real-time decisions
- **Auto (`auto`)**: Try interactive first, fallback to traditional if needed
- **Plan-Only (`planOnly`)**: Generate and cache plan without execution
- **Execution-Only (`executionOnly`)**: Execute existing plan by ID or task signature

#### 💾 Intelligent Caching
- **Task Signature Matching**: Reuses plans for similar instruction + URL combinations
- **TTL Management**: Automatic expiration and cleanup of stale plans
- **Hit Rate Tracking**: Performance analytics for cache effectiveness
- **Version Control**: Plan versioning with active/inactive states

### Database Connection

- Uses Neon PostgreSQL (serverless)
- Shared Drizzle schema between Next.js app and Lambda function
- Full type safety with TypeScript interfaces
- Environment variable: `DATABASE_URL`

### Key Files to Understand

#### Frontend
- `next/src/app/page.tsx` - Main app with tabbed interface
- `next/src/app/birdwatcher-form.tsx` - Form component for creating tasks
- `next/src/app/actions.ts` - Server actions with cron scheduling logic
- `next/src/db/schema.ts` - Database schema definition (shared)

#### Task Executor
- `functions/task-executor/index.ts` - Main Lambda handler with mode routing
- `functions/task-executor/interactive-browser-agent.ts` - Interactive execution engine
- `functions/task-executor/plan-generator.ts` - LLM plan generation
- `functions/task-executor/browser-executor.ts` - Playwright automation
- `functions/task-executor/cache-manager.ts` - Intelligent plan caching
- `functions/task-executor/types.ts` - TypeScript interfaces and schemas

#### Testing
- `functions/task-executor/__tests__/` - Comprehensive test suite
- `functions/task-executor/local-invoke.ts` - Local testing utilities
- `functions/task-executor/local-invoke-mock.ts` - Mock testing without browser

### Environment Variables Required

```bash
# Database
DATABASE_URL=postgresql://...     # Neon database connection

# LLM Providers
OPENAI_API_KEY=sk-...            # For plan generation
ANTHROPIC_API_KEY=sk-...         # Alternative LLM provider

# Optional Configuration
NODE_ENV=development             # Environment mode
BROWSER_TIMEOUT=60000           # Browser operation timeout (ms)
CACHE_TTL_DAYS=7               # Plan cache TTL in days
```

### Testing Strategy

The task executor includes comprehensive testing capabilities:

#### **Unit Tests** (`npm test`)
- Type validation and schema tests (9 tests)
- Component functionality validation
- Error handling scenarios

#### **Integration Tests** 
- Lambda handler workflows (14 tests)
- End-to-end simulation (12 tests)
- API Gateway compatibility tests

#### **Local Testing** (`npm run invoke:*`)
- **Simple**: Basic Google search functionality
- **E-commerce**: Product interaction and data extraction
- **Search**: Advanced search and navigation
- **News**: Content extraction and analysis
- **API**: API Gateway event format testing

#### **Mock Testing** (`npm run invoke:mock:*`)
- Execution simulation without browser dependencies
- Error scenario testing (timeouts, failures)
- Performance and interface validation

### Development Workflow

1. **Start Development Environment**
   ```bash
   # Frontend
   cd next && npm run dev
   
   # Lambda Function Testing
   cd functions/task-executor && npm run dev
   ```

2. **Test Task Execution Locally**
   ```bash
   cd functions/task-executor
   npm run invoke:simple          # Test basic functionality
   npm run invoke:mock           # Test without browser dependencies
   ```

3. **Database Operations**
   ```bash
   cd next
   npx drizzle-kit generate      # After schema changes
   npx drizzle-kit migrate       # Apply migrations
   npx drizzle-kit studio        # Inspect database
   ```

4. **Before Deployment**
   ```bash
   npm run build                 # Both frontend and lambda
   npm run lint                  # Code quality checks
   npm test                      # All test suites
   ```

### Advanced Features

#### **Interactive Browser Agent**
- Real-time DOM capture and analysis
- Screenshot-based debugging
- Progress scoring and stagnation detection
- Automatic human escalation triggers

#### **Feedback Loop System**
- Automatic plan improvement based on execution results
- Error pattern recognition and resolution
- Success pattern learning and reuse
- Multi-iteration retry with refined plans

#### **Multi-LLM Architecture**
- Primary: OpenAI GPT-4 for plan generation
- Secondary: Anthropic Claude for alternative perspectives
- Automatic failover and provider selection
- Model-specific prompt optimization

This architecture provides a robust, self-improving web automation platform with both traditional planned execution and modern interactive capabilities.