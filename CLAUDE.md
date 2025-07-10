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
npm run test-simple  # Run simple test scenario
npm run test-feedback-loop  # Test with feedback loop
```

### Database Operations (Drizzle)
```bash
cd next
npx drizzle-kit generate    # Generate migrations from schema
npx drizzle-kit migrate     # Run migrations
npx drizzle-kit studio      # Open Drizzle Studio
```

## Architecture Overview

This is a **BirdWatcher** application - a web automation system that monitors websites on scheduled intervals using AI-generated execution plans.

### High-Level Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Next.js App   │ -> │  Task Executor   │ -> │   PostgreSQL    │
│   (Frontend)    │    │   (Lambda)       │    │   (Database)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                       │
         v                        v                       v
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  User Interface │    │  Browser Executor│    │ Execution Plans │
│   (Forms/Tabs)  │    │   (Playwright)   │    │     (Cache)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Core Components

1. **Next.js Frontend** (`/next/src/`):
   - Main app with form to create "birdwatcher" tasks
   - Uses server actions for form submission
   - Drizzle ORM for database operations
   - Tailwind CSS + shadcn/ui components

2. **Task Executor Lambda** (`/functions/task-executor/`):
   - Hybrid LLM-browser automation system
   - Generates execution plans using OpenAI/Anthropic
   - Executes plans with Playwright browser automation
   - Intelligent caching system for plan reuse

3. **Database Schema** (PostgreSQL with Drizzle):
   - `task` table: User-created monitoring tasks with cron schedules
   - `execution_plans` table: AI-generated step-by-step automation plans
   - `execution_results` table: Execution logs and extracted data
   - `plan_cache` table: Cached plans with TTL for performance

### Key Patterns

- **Hybrid Approach**: First run generates AI plan, subsequent runs use cached plans
- **Server Actions**: Next.js server actions handle form submissions
- **Type Safety**: Full TypeScript with Zod validation schemas
- **Cron Scheduling**: Tasks convert user-friendly intervals to cron expressions
- **Error Handling**: Comprehensive error types and retry logic

### Database Connection

- Uses Neon PostgreSQL (serverless)
- Drizzle ORM with schema in `next/src/db/schema.ts`
- Shared schema between Next.js app and Lambda function
- Environment variable: `DATABASE_URL`

### Key Files to Understand

- `next/src/db/schema.ts` - Database schema definition
- `next/src/app/actions.ts` - Server actions for form handling
- `functions/task-executor/types.ts` - TypeScript interfaces
- `functions/task-executor/index.ts` - Main Lambda handler
- `functions/task-executor/plan-generator.ts` - LLM plan generation
- `functions/task-executor/browser-executor.ts` - Playwright automation

### Environment Variables Required

```
DATABASE_URL=postgresql://...     # Neon database connection
OPENAI_API_KEY=sk-...            # For plan generation
ANTHROPIC_API_KEY=sk-...         # Alternative LLM provider
```

### Testing

The task executor has several test modes:
- `npm run test-simple` - Basic functionality test
- `npm run test-feedback-loop` - Test with AI feedback loop
- `npm run test-config` - Test configuration validation
- `npm run test-components` - Test individual components

### Development Workflow

1. Start Next.js dev server: `cd next && npm run dev`
2. For Lambda testing: `cd functions/task-executor && npm run dev`
3. Database changes: Update schema, generate migrations, run migrations
4. Always run `npm run build` and `npm run lint` before committing