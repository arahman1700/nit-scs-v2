import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  // Global ignores
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/*.js', '**/*.mjs', '!eslint.config.js'],
  },

  // Base JS recommended rules
  js.configs.recommended,

  // TypeScript recommended rules
  ...tseslint.configs.recommended,

  // Project-specific rules
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      'no-restricted-properties': [
        'error',
        {
          object: 'prisma',
          property: '$queryRawUnsafe',
          message: 'Use Prisma.sql or $queryRaw with tagged templates to prevent SQL injection.',
        },
        {
          object: 'prisma',
          property: '$executeRawUnsafe',
          message: 'Use Prisma.sql or $executeRaw with tagged templates to prevent SQL injection.',
        },
        {
          object: 'tx',
          property: '$queryRawUnsafe',
          message: 'Use Prisma.sql or $queryRaw with tagged templates to prevent SQL injection.',
        },
        {
          object: 'tx',
          property: '$executeRawUnsafe',
          message: 'Use Prisma.sql or $executeRaw with tagged templates to prevent SQL injection.',
        },
      ],
    },
  },

  // Relax rules for test files
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // Disable formatting rules (Prettier handles formatting)
  eslintConfigPrettier,
);
