import 'dotenv/config';

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';