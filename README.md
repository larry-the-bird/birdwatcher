# 🦅 BirdWatcher

An intelligent web automation and monitoring system that combines AI-powered plan generation with advanced browser automation. BirdWatcher allows you to create automated "watchers" that monitor websites on scheduled intervals using natural language instructions.

## ✨ Key Features

- **🤖 Interactive Browser Agent**: Real-time step-by-step execution with LLM-guided decisions
- **🔄 Self-Improving Feedback Loop**: Plans automatically refine based on execution results
- **📋 Multiple Execution Modes**: Traditional planned execution, interactive mode, and intelligent auto-selection
- **⚡ Intelligent Caching**: Smart plan reuse with TTL and performance tracking
- **🌐 Modern Frontend**: Beautiful Next.js 15 interface with intuitive task creation
- **📊 Advanced Monitoring**: Comprehensive execution tracking and analytics
- **🔧 Production Ready**: Optimized for AWS Lambda with robust error handling

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     BirdWatcher System                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────┐ │
│  │   Next.js App   │ -> │  Task Executor   │ -> │ PostgreSQL  │ │
│  │   (Frontend)    │    │   (Lambda)       │    │ (Database)  │ │
│  └─────────────────┘    └──────────────────┘    └─────────────┘ │
│           │                        │                     │     │
│           v                        v                     v     │
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────┐ │
│  │  Form Interface │    │Interactive Agent │    │ Plan Cache  │ │
│  │  Cron Scheduler │    │ Browser Engine   │    │ Results Log │ │
│  └─────────────────┘    └──────────────────┘    └─────────────┘ │
│                                   │                             │
│                                   v                             │
│                         ┌──────────────────┐                   │
│                         │ Feedback Loop    │                   │
│                         │ Auto-Improvement │                   │
│                         └──────────────────┘                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
birdwatcher-public/
├── next/                          # Frontend Application
│   ├── src/
│   │   ├── app/                   # Next.js 15 App Router
│   │   │   ├── page.tsx           # Main interface with tabs
│   │   │   ├── birdwatcher-form.tsx # Task creation form
│   │   │   └── actions.ts         # Server actions
│   │   ├── components/ui/         # shadcn/ui components
│   │   ├── db/
│   │   │   └── schema.ts          # Database schema (shared)
│   │   └── lib/
│   └── package.json
├── functions/
│   └── task-executor/             # Lambda Function
│       ├── index.ts               # Main handler
│       ├── interactive-browser-agent.ts # Interactive execution
│       ├── plan-generator.ts      # LLM plan generation
│       ├── browser-executor.ts    # Playwright automation
│       ├── cache-manager.ts       # Intelligent caching
│       ├── types.ts               # TypeScript interfaces
│       ├── __tests__/             # Comprehensive test suite
│       └── package.json
├── CLAUDE.md                      # Development guidance
└── README.md                      # This file
```

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** 
- **PostgreSQL Database** (Neon recommended)
- **OpenAI API Key** (for plan generation)
- **Anthropic API Key** (optional, for fallback)

### 1. Environment Setup

```bash
# Clone the repository
git clone <repository-url>
cd birdwatcher-public

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration
```

### 2. Database Setup

```bash
cd next
npm install

# Generate and run migrations
npx drizzle-kit generate
npx drizzle-kit migrate
```

### 3. Start Frontend

```bash
cd next
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the interface.

### 4. Test Lambda Function

```bash
cd functions/task-executor
npm install

# Test basic functionality
npm run invoke:simple

# Test without browser dependencies
npm run invoke:mock
```

## 💡 How It Works

### 1. **Create Birdwatcher Task**
Users create monitoring tasks through the web interface:
- **Task Name**: Descriptive name for the monitoring task
- **Target URL**: Website to monitor
- **Instructions**: Natural language description of what to monitor
- **Schedule**: How often to check (converted to cron format)

### 2. **Intelligent Execution**
The system offers multiple execution modes:

#### **Interactive Mode** (`interactive`)
- Captures browser state at each step
- Uses LLM to decide next actions dynamically
- Monitors progress and detects stagnation
- Escalates to human when stuck

#### **Traditional Mode** (`plan`)
- Generates complete automation plan upfront
- Executes plan step-by-step with Playwright
- Uses cached plans for efficiency

#### **Auto Mode** (`auto`)
- Tries interactive mode first
- Falls back to traditional mode if needed
- Best of both worlds approach

### 3. **Self-Improvement**
The feedback loop system continuously improves:
- Analyzes execution failures
- Refines plans based on results
- Builds knowledge base of successful patterns
- Reduces future failure rates

### 4. **Smart Caching**
Intelligent plan reuse for efficiency:
- Task signature matching
- TTL-based expiration
- Performance analytics
- Version control

## 🎯 Use Cases

### **E-commerce Monitoring**
```javascript
{
  instruction: "Monitor iPhone 15 Pro price and availability",
  url: "https://apple.com/shop/buy-iphone",
  schedule: "Every 6 hours"
}
```

### **Job Board Tracking**
```javascript
{
  instruction: "Check for new remote TypeScript developer positions",
  url: "https://jobs.example.com/engineering",
  schedule: "Daily"
}
```

### **News Monitoring**
```javascript
{
  instruction: "Extract top 5 headlines from tech news section",
  url: "https://news.example.com/technology",
  schedule: "Every 2 hours"
}
```

### **Competitor Analysis**
```javascript
{
  instruction: "Track competitor's new product announcements",
  url: "https://competitor.com/products",
  schedule: "Weekly"
}
```

## 🛠️ Development

### Frontend Development

```bash
cd next
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Code quality checks
```

### Lambda Development

```bash
cd functions/task-executor
npm run dev          # Development server
npm run test         # Run test suite
npm run invoke:*     # Local testing scenarios
```

### Database Operations

```bash
cd next
npx drizzle-kit generate    # Generate migrations
npx drizzle-kit migrate     # Apply migrations  
npx drizzle-kit studio      # Database inspector
```

## 🧪 Testing

### Frontend Testing
- **Form Validation**: Input validation and error handling
- **Responsive Design**: Mobile and desktop compatibility
- **Accessibility**: Screen reader and keyboard navigation support

### Lambda Testing
- **Unit Tests**: 38 passing tests covering core functionality
- **Integration Tests**: End-to-end workflow validation
- **Mock Testing**: Browser-less execution simulation
- **Local Scenarios**: Real-world testing scenarios

```bash
# Run comprehensive test suite
cd functions/task-executor
npm test

# Test specific scenarios
npm run invoke:simple      # Basic Google search
npm run invoke:ecommerce   # E-commerce interaction
npm run invoke:mock        # Mock execution
```

## 🚀 Deployment

### Frontend Deployment (Vercel)

```bash
cd next
npm run build
npx vercel --prod
```

### Lambda Deployment (AWS SAM)

```bash
cd functions/task-executor
npm run build
sam build
sam deploy --guided
```

### Environment Variables

```bash
# Required for both frontend and lambda
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-...

# Optional
ANTHROPIC_API_KEY=sk-...
NODE_ENV=production
BROWSER_TIMEOUT=60000
CACHE_TTL_DAYS=7
```

## 📊 Key Technologies

### Frontend Stack
- **Next.js 15**: Latest app router with server actions
- **React 19**: Concurrent features and improved performance
- **TypeScript**: Full type safety
- **Tailwind CSS 4**: Modern utility-first styling
- **shadcn/ui**: Accessible component library
- **Drizzle ORM**: Type-safe database operations

### Backend Stack
- **Node.js 18**: Runtime environment
- **Playwright**: Browser automation engine
- **OpenAI GPT-4**: Primary plan generation
- **Anthropic Claude**: Secondary LLM provider
- **PostgreSQL**: Primary database
- **AWS Lambda**: Serverless execution
- **Zod**: Runtime type validation

## 🔒 Security & Performance

### Security Features
- **Input Validation**: Comprehensive validation with Zod schemas
- **SQL Injection Protection**: Parameterized queries via Drizzle ORM
- **XSS Prevention**: React's built-in protections
- **Environment Security**: Secure environment variable handling

### Performance Optimizations
- **Plan Caching**: 80%+ cache hit rate after initial runs
- **Smart Retries**: Intelligent retry strategies
- **Browser Optimization**: Headless mode and resource management
- **Database Pooling**: Efficient connection management

## 📈 Monitoring & Analytics

### Execution Metrics
- Success/failure rates
- Execution duration tracking
- Cache hit/miss analytics
- Error categorization

### Interactive Mode Analytics
- Progress scoring
- Stagnation detection
- Human escalation rates
- Decision confidence levels

## 🤝 Contributing

1. **Fork the Repository**
2. **Create Feature Branch**: `git checkout -b feature/amazing-feature`
3. **Add Tests**: Ensure new functionality is tested
4. **Submit Pull Request**: Detailed description of changes

### Development Guidelines
- Follow TypeScript strict mode
- Add tests for new features
- Update documentation as needed
- Follow existing code style

## 📄 Documentation

- **[CLAUDE.md](./CLAUDE.md)**: Development guidance and common commands
- **[Frontend README](./next/README.md)**: Next.js application documentation
- **[Lambda README](./functions/task-executor/README.md)**: Task executor documentation
- **[Feedback Loop Guide](./functions/task-executor/FEEDBACK_LOOP_README.md)**: Self-improvement system details
- **[Test Documentation](./functions/task-executor/__tests__/README.md)**: Testing strategy and coverage

## 📝 License

MIT License - see LICENSE file for details.

## 🎯 Roadmap

- [ ] **Real-time Dashboard**: Live monitoring interface
- [ ] **Multi-user Support**: User authentication and task isolation
- [ ] **Advanced Notifications**: Email, SMS, and webhook alerts
- [ ] **Visual Plan Editor**: Drag-and-drop automation builder
- [ ] **API Integration**: REST API for programmatic access
- [ ] **Mobile App**: Native mobile monitoring interface

---

**BirdWatcher** provides enterprise-grade web automation with cutting-edge interactive capabilities, making it easy to monitor and extract data from any website using natural language instructions. 