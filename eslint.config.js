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
  { ignores: ['**/dist/**', '**/node_modules/**'] },
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
      ],
      'no-restricted-syntax': [
        'error',
        { selector: "BinaryExpression[operator='**']", message: 'Exponentiation is not identical across JavaScript engines. Multiply instead.' },
        { selector: "AssignmentExpression[operator='**=']", message: 'Exponentiation is not identical across JavaScript engines. Multiply instead.' },
        { selector: 'CallExpression[callee.property.name=/^toLocale/]', message: 'Locale-dependent output differs between devices.' },
      ],
    },
  },
];
