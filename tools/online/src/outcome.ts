export interface Outcome {
  passed: number;
  failed: string[];
}

/**
 * Reads the outcome out of whatever the CLI printed. Null if the block never reached its end.
 * The block sends its result as hex after the word SECURITY_TESTS: the CLI wraps the database's
 * message in JSON inside JSON, and hex is the one thing no layer of quoting can change.
 */
export function outcomeOf(text: string): Outcome | null {
  const found = /SECURITY_TESTS ([0-9a-f]+)/.exec(text);
  if (!found || found[1].length % 2 !== 0) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(found[1], 'hex').toString('utf8'));
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { passed, failed } = parsed as { passed?: unknown; failed?: unknown };
    if (typeof passed !== 'number' || !Array.isArray(failed) || !failed.every((line) => typeof line === 'string')) return null;
    return { passed, failed };
  } catch {
    return null;
  }
}

/**
 * How the run went, as a line to print and an exit code. A block that reached its end with fewer
 * checks than it has is as much a failure as a broken rule: a check that was skipped proves nothing.
 */
export function verdict(outcome: Outcome | null, expected: number): { ok: boolean; lines: string[] } {
  if (outcome === null) return { ok: false, lines: ['✗ the security tests did not run to the end'] };
  const lines = outcome.failed.map((line) => `  ✗ ${line}`);
  const all = outcome.passed + outcome.failed.length;
  if (all !== expected) lines.push(`  ✗ ${all} checks ran, and the file has ${expected}: some were skipped, or the count in test-db.ts is out of date`);
  const ok = outcome.failed.length === 0 && all === expected;
  lines.push(`${ok ? '✓' : '✗'} security rules: ${outcome.passed} held, ${outcome.failed.length} broken`);
  return { ok, lines };
}
