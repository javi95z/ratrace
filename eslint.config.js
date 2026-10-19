import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const bannedMath = [
  'exp', 'expm1', 'log', 'log2', 'log10', 'log1p', 'pow',
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
  'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh',
  'cbrt', 'hypot', 'random',
];

const notExact = 'Not identical across JavaScript engines. Use + - * /, Math.floor, Math.round or Math.sqrt.';
const noClock = 'The engine has no clock.';

export default [
  { ignores: ['**/dist/**', '**/node_modules/**', '.worktrees/**', '**/.next/**', '**/next-env.d.ts', '**/playwright-report/**', '**/test-results/**', 'supabase/functions/_shared/game/v*.js', 'apps/web/public/rules/v*.js'] },
  ...tseslint.configs.recommended,
  {
    files: ['packages/engine/src/**/*.ts'],
    ignores: ['packages/engine/src/**/*.test.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        ...bannedMath.map((property) => ({ object: 'Math', property, message: notExact })),
        { object: 'globalThis', property: 'Date', message: noClock },
        { object: 'globalThis', property: 'performance', message: noClock },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: noClock },
        { name: 'performance', message: noClock },
        { name: 'Intl', message: 'Locale-dependent output differs between devices.' },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: "BinaryExpression[operator='**']", message: 'Exponentiation is not identical across JavaScript engines. Multiply instead.' },
        { selector: "AssignmentExpression[operator='**=']", message: 'Exponentiation is not identical across JavaScript engines. Multiply instead.' },
        { selector: 'CallExpression[callee.property.name=/^(toLocale|localeCompare)/]', message: 'Locale-dependent output differs between devices.' },
      ],
    },
  },
  {
    // The game's logic is shared by every app: nothing of React, Next or a browser in it, and nothing of the web's own.
    files: ['packages/core/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['react', 'react-dom', 'next', 'next-intl', 'idb'],
          patterns: [{ group: ['@/*', 'next/*', 'react/*', 'apps/*'], message: 'The core is shared by every app: it imports nothing of one of them.' }],
        },
      ],
      'no-restricted-globals': ['error', 'window', 'document', 'localStorage', 'sessionStorage', 'indexedDB', 'navigator'],
    },
  },
  {
    // The web app: the rules of hooks, and a wall between the screens and the two things only the session layer may touch.
    files: ['apps/web/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
];
