module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended'
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    // Allow any type in specific scenarios
    '@typescript-eslint/no-explicit-any': 'warn',
    // Allow non-null assertions in tests
    '@typescript-eslint/no-non-null-assertion': 'warn',
  },
  overrides: [
    {
      // Test files specific rules
      files: [
        '**/__tests__/**/*',
        '**/*.test.*',
        '**/*.spec.*',
        '**/test-utils/**/*',
        '**/mocks/**/*',
        '**/fixtures/**/*',
      ],
      env: {
        jest: true,
        node: true,
      },
      globals: {
        vi: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
      },
      rules: {
        // More relaxed rules for test files
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/ban-ts-comment': 'off',
        '@typescript-eslint/no-empty-function': 'off',

        // React-specific relaxations for test files
        'react-refresh/only-export-components': 'off',
        'react-hooks/exhaustive-deps': 'warn',

        // Allow console methods in tests
        'no-console': 'off',

        // Allow long lines in test descriptions
        'max-len': 'off',

        // Allow unused expressions (useful for test assertions)
        'no-unused-expressions': 'off',
        '@typescript-eslint/no-unused-expressions': 'off',

        // Allow object property assignment in tests
        'no-param-reassign': 'off',

        // Allow magic numbers in tests
        'no-magic-numbers': 'off',
        '@typescript-eslint/no-magic-numbers': 'off',

        // Allow require() in test files for dynamic imports
        '@typescript-eslint/no-var-requires': 'off',

        // Allow empty catch blocks in tests
        'no-empty': ['error', { allowEmptyCatch: true }],

        // Allow floating promises in tests (for fire-and-forget scenarios)
        '@typescript-eslint/no-floating-promises': 'off',

        // Allow unsafe member access in tests
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',

        // Allow unbound methods in tests (useful for mocking)
        '@typescript-eslint/unbound-method': 'off',

        // Allow prefer-const relaxation for test variables
        'prefer-const': 'warn',

        // Allow function declarations after return statements
        'no-unreachable': 'warn',
      },
    },
    {
      // Mock files specific rules
      files: ['**/mocks/**/*', '**/fixtures/**/*', '**/setup/**/*'],
      rules: {
        // Very relaxed rules for mock and fixture files
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/ban-types': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        'import/no-extraneous-dependencies': 'off',
        'no-console': 'off',
        'max-len': 'off',
        'max-lines': 'off',
        'max-lines-per-function': 'off',
        complexity: 'off',
      },
    },
    {
      // Vitest config files
      files: ['**/vitest.config.*', '**/vite.config.*'],
      rules: {
        'import/no-extraneous-dependencies': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
};
