import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

async function lint(code: string): Promise<string[]> {
  const eslint = new ESLint({ cwd: repoRoot });
  const [result] = await eslint.lintText(code, {
    filePath: path.join(repoRoot, 'packages/engine/src/sample.ts'),
  });
  return result.messages.map((m) => m.ruleId ?? 'fatal');
}

describe('engine lint guard', () => {
  it('rejects non-deterministic maths, the clock and Math.random', async () => {
    expect(await lint('export const a = Math.exp(1);\n')).toContain('no-restricted-properties');
    expect(await lint('export const a = Math.random();\n')).toContain('no-restricted-properties');
    expect(await lint('export const a = 2 ** 10;\n')).toContain('no-restricted-syntax');
    expect(await lint('export const a = Date.now();\n')).toContain('no-restricted-globals');
  });

  it('rejects the remaining escape hatches', async () => {
    expect(await lint('let a = 2;\na **= 3;\nexport { a };\n')).toContain('no-restricted-syntax');
    expect(await lint('export const a = Math.asinh(1);\n')).toContain('no-restricted-properties');
    expect(await lint('export const a = (1234.5).toLocaleString();\n')).toContain('no-restricted-syntax');
    expect(await lint('export const a = performance.now();\n')).toContain('no-restricted-globals');
    expect(await lint('export const a = globalThis.Date.now();\n')).toContain('no-restricted-properties');
    expect(await lint("export const a = 'a'.localeCompare('b');\n")).toContain('no-restricted-syntax');
    expect(await lint('export const a = new Intl.NumberFormat();\n')).toContain('no-restricted-globals');
  });

  it('accepts exact maths', async () => {
    expect(await lint('export const a = Math.floor(Math.sqrt(2) * 3) + Math.round(1.5);\n')).toEqual([]);
  });
});
