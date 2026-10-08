import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

const typedFiles = ['apps/**/*.ts', 'apps/**/*.tsx', 'packages/**/*.ts'];
export default [
  { ignores: ['**/node_modules/**', '**/dist/**', '**/.wrangler/**', '**/ios/**', '**/android/**', '**/coverage/**', '**/test-results/**', '**/playwright-report/**'] },
  {
    files: ['**/*.{js,mjs}'],
    ...js.configs.recommended,
    languageOptions: { globals: globals.node },
  },
  {
    files: typedFiles,
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ['apps/api/tsconfig.json', 'apps/api/tsconfig.scripts.json', 'apps/web/tsconfig.json', 'apps/web/tsconfig.server.json', 'apps/web/tsconfig.node.json', 'packages/shared/tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
      '@typescript-eslint/await-thenable': 'error',
    },
  },
  {
    files: ['apps/api/src/db/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
    },
  },
];
