# Birdwatcher Frontend

A modern Next.js 15 frontend application for creating and managing intelligent web monitoring tasks. Built with TypeScript, Tailwind CSS, and shadcn/ui components.

## 🚀 Features

- **Task Creation Interface**: Intuitive form for creating "birdwatcher" monitoring tasks
- **Cron Scheduling**: User-friendly time interval selection with automatic cron conversion
- **Real-time Validation**: Form validation with error handling and success feedback
- **Modern UI**: Beautiful interface built with Tailwind CSS and shadcn/ui components
- **Database Integration**: Server actions with Drizzle ORM and PostgreSQL
- **Responsive Design**: Mobile-first responsive design with modern gradients and shadows

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Next.js App   │ -> │  Server Actions  │ -> │   PostgreSQL    │
│   (Frontend)    │    │  (Form Handler)  │    │   (Database)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                       │
         v                        v                       v
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  UI Components  │    │  Cron Generator  │    │   Task Storage  │
│  (shadcn/ui)    │    │ (Time Converter) │    │    (Drizzle)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 📋 Core Components

### 1. Main Page (`src/app/page.tsx`)
- **Tabbed Interface**: Create vs Manage birdwatchers
- **Modern Design**: Gradient backgrounds, shadows, and clean typography
- **Responsive Layout**: Works on desktop and mobile devices

### 2. Birdwatcher Form (`src/app/birdwatcher-form.tsx`)
- **Task Configuration**: Name, URL, and instruction inputs
- **Time Scheduling**: Days, hours, and minutes selection
- **Real-time Feedback**: Success/error notifications with Sonner
- **Form Validation**: Client and server-side validation

### 3. Server Actions (`src/app/actions.ts`)
- **Form Processing**: Handles form submission with validation
- **Cron Conversion**: Converts user-friendly time intervals to cron expressions
- **Database Operations**: Inserts tasks into PostgreSQL database
- **Error Handling**: Comprehensive error handling with user feedback

### 4. Database Schema (`src/db/schema.ts`)
- **Task Table**: Stores monitoring tasks with cron schedules
- **Execution Plans**: Caches AI-generated automation plans
- **Results Tracking**: Stores execution results and logs
- **Performance Cache**: Intelligent plan caching with TTL

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 18+ 
- PostgreSQL database (Neon recommended)
- Environment variables configured

### Installation

```bash
# Navigate to frontend directory
cd next

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration
```

### Environment Variables

```bash
# Database Connection
DATABASE_URL=postgresql://user:password@host:port/database

# Optional: Customize development settings
NODE_ENV=development
```

### Database Setup

```bash
# Generate migrations from schema
npx drizzle-kit generate

# Run migrations
npx drizzle-kit migrate

# Open database studio (optional)
npx drizzle-kit studio
```

## 🚀 Development

### Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Available Scripts

```bash
npm run dev          # Start development server with Turbopack
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Development Features

- **Hot Reload**: Instant updates with Turbopack
- **TypeScript**: Full type safety throughout the application
- **ESLint**: Code quality and style enforcement
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: Modern, accessible component library

## 🎨 UI Components

### Form Components
- **Input**: Text and URL input fields with validation styles
- **Textarea**: Multi-line text input for instructions
- **Button**: Various button styles (default, outline, etc.)
- **Tabs**: Tabbed interface for different sections

### Feedback Components
- **Sonner**: Toast notifications for success/error messages
- **Loading States**: Smooth loading indicators during form submission

### Layout Components
- **Responsive Grid**: Mobile-first responsive layouts
- **Cards**: Clean card components with shadows and borders
- **Gradients**: Modern gradient backgrounds

## 📝 Usage Examples

### Creating a Birdwatcher Task

1. **Navigate to Create Tab**: Click "Create Birdwatcher" tab
2. **Fill Task Details**:
   - **Task Name**: "Competitor Price Monitor"
   - **URL**: "https://example.com/product"
   - **Instructions**: "Monitor iPhone 15 Pro price changes"
3. **Set Schedule**: Choose frequency (e.g., every 6 hours)
4. **Submit**: Click "Create Birdwatcher" button

### Viewing Existing Tasks

1. **Navigate to Manage Tab**: Click "My Birdwatchers" tab
2. **View Tasks**: See list of active and paused tasks
3. **Task Actions**: Edit, delete, or pause/resume tasks

## 🔧 Configuration

### Cron Scheduling Logic

The application converts user-friendly time intervals to cron expressions:

```typescript
// Examples of time interval conversion
{ days: 1, hours: 0, minutes: 0 }     // → "0 0 * * *" (daily)
{ days: 0, hours: 6, minutes: 0 }     // → "0 */6 * * *" (every 6 hours)
{ days: 0, hours: 0, minutes: 30 }    // → "*/30 * * * *" (every 30 minutes)
{ days: 2, hours: 0, minutes: 0 }     // → "0 0 */2 * *" (every 2 days)
```

### Database Schema

```sql
-- Main tasks table
CREATE TABLE task (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    creator_id TEXT NOT NULL,
    name TEXT NOT NULL,
    instruction TEXT NOT NULL,
    url TEXT NOT NULL,
    cron TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- Additional tables for execution plans, results, and caching
-- See src/db/schema.ts for complete schema
```

## 🎯 User Experience Features

### Form Validation
- **Real-time Validation**: Instant feedback on input errors
- **URL Validation**: Ensures valid URL format
- **Required Fields**: Clear indication of required inputs
- **Error Messages**: Descriptive error messages for better UX

### Responsive Design
- **Mobile First**: Optimized for mobile devices
- **Tablet Support**: Clean layout on tablet screens
- **Desktop**: Full-featured desktop experience
- **Touch Friendly**: Large buttons and touch targets

### Accessibility
- **Semantic HTML**: Proper HTML structure and elements
- **ARIA Labels**: Screen reader support
- **Keyboard Navigation**: Full keyboard accessibility
- **Color Contrast**: WCAG compliant color schemes

## 🔍 Technical Details

### Next.js 15 Features
- **App Router**: Latest Next.js app directory structure
- **Server Actions**: Form handling without API routes
- **Turbopack**: Fast development bundling
- **TypeScript**: Full type safety

### Styling Architecture
- **Tailwind CSS 4**: Latest version with modern features
- **CSS Variables**: Dynamic theming support
- **Component Variants**: Consistent component styling
- **Responsive Utilities**: Mobile-first responsive design

### State Management
- **React 19**: Latest React with improved concurrent features
- **Server State**: Server actions for form state
- **Client State**: useTransition for loading states
- **Form State**: Controlled form inputs with validation

## 🚀 Deployment

### Build for Production

```bash
npm run build
```

### Deployment Options

#### Vercel (Recommended)
```bash
# Connect to Vercel and deploy
npx vercel

# Or use Vercel CLI
vercel --prod
```

#### Other Platforms
- **Netlify**: Static export or server functions
- **Railway**: Node.js deployment
- **AWS**: Lambda with Next.js adapter
- **Docker**: Containerized deployment

### Environment Variables for Production

```bash
DATABASE_URL=postgresql://...     # Production database
NODE_ENV=production
```

## 🔐 Security Considerations

- **Input Validation**: Server-side validation of all inputs
- **SQL Injection**: Protected by Drizzle ORM parameterized queries
- **XSS Protection**: React's built-in XSS protection
- **CSRF Protection**: Next.js built-in CSRF protection for server actions

## 🧪 Testing

### Manual Testing Checklist

- [ ] Form submission with valid data
- [ ] Form validation with invalid data  
- [ ] URL validation and error handling
- [ ] Time interval conversion accuracy
- [ ] Responsive design on different screen sizes
- [ ] Accessibility with keyboard navigation
- [ ] Toast notifications display correctly

### Automated Testing (Future)

```bash
# Future testing setup
npm test              # Jest unit tests
npm run test:e2e      # Playwright E2E tests
npm run test:coverage # Coverage reports
```

## 📈 Performance Optimization

### Next.js Optimizations
- **Static Generation**: Pre-built pages where possible
- **Image Optimization**: Next.js automatic image optimization  
- **Bundle Analysis**: Webpack bundle analyzer integration
- **Font Optimization**: Google Fonts optimization

### Database Optimizations
- **Connection Pooling**: Efficient database connections
- **Indexed Queries**: Optimized database queries
- **Caching**: Intelligent caching of execution plans

This frontend provides a modern, user-friendly interface for creating and managing intelligent web monitoring tasks with the BirdWatcher automation system.
