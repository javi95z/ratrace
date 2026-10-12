import tseslint from 'typescript-eslint';

const bannedMath = [
  'exp', 'expm1', 'log', 'log2', 'log10', 'log1p', 'pow',
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
  'sinh', 'cosh', 'tanh', 'cbrt', 'hypot', 'random',
];

export default [
  { ignores: ['**/dist/**', '**/node_modules/**'] },
  ...tseslint.configs.recommended,
  {
    files: ['packages/engine/src/**/*.ts'],
    ignores: ['packages/engine/src/**/*.test.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        ...bannedMath.map((property) => ({
          object: 'Math',
          property,
          message: 'Not identical across JavaScript engines. Use + - * /, Math.floor, Math.round or Math.sqrt.',
        })),
      ],
      'no-restricted-globals': ['error', { name: 'Date', message: 'The engine has no clock.' }],
      'no-restricted-syntax': [
        'error',
        {
          selector: "BinaryExpression[operator='**']",
          message: 'Exponentiation is not identical across JavaScript engines. Multiply instead.',
        },
      ],
    },
  },
];
