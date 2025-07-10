module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      isolatedModules: true,
      diagnostics: {
        ignoreCodes: [2578] // Ignore unused @ts-expect-error directive warnings
      }
    }],
  },
  collectCoverageFrom: [
    '**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/*.test.ts',
    '!**/*.spec.ts',
  ],
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
  testTimeout: 30000,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};