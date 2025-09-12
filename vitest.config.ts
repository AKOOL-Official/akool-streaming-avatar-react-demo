/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup/setupTests.ts'],
    css: false,
    typecheck: {
      tsconfig: './tsconfig.test.json',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/__tests__/setup/setupTests.ts',
        'src/__tests__/setup/testUtils.tsx',
        'src/__tests__/mocks/**',
        'src/__tests__/fixtures/**',
        'src/__tests__/helpers/**',
        '**/*.d.ts',
        '**/*.config.js',
        '**/*.config.ts',
        'dist/',
        'build/',
        'coverage/',
        '**/__mocks__/**',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
        // Higher coverage thresholds for critical modules
        'src/hooks/': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        'src/providers/': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        'src/core/': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        // Lower thresholds for UI components
        'src/components/': {
          branches: 75,
          functions: 75,
          lines: 75,
          statements: 75,
        },
      },
    },
    // Increased timeouts for streaming operations
    testTimeout: 15000,
    hookTimeout: 15000,
    // Retry flaky tests
    retry: 2,
    // Run tests in sequence for streaming tests to avoid conflicts
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 1,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './src/__tests__'),
    },
  },
});
