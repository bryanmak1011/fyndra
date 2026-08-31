// @ts-check
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: { sourceType: 'module' },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      ...tseslint.configs.recommended.rules,
      // Constitution I: cyclomatic complexity must not exceed 10.
      complexity: ['error', 10],
      // src/lib/logger.ts is the one sanctioned place for console.*.
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        // Express identifies error-handling middleware by arity (fn.length
        // === 4), so the unused `next` param in error-handler.ts must stay.
        { argsIgnorePattern: '^_' },
      ],
    },
  },
  prettier,
];
