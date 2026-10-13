import { describe, expect, it } from 'vitest';
import { outcomeOf, verdict } from './outcome';

const hex = (value: unknown) => Buffer.from(JSON.stringify(value), 'utf8').toString('hex');

describe('reading the outcome of the SQL security tests', () => {
  it('finds the result in the message of the error the tests always end with', () => {
    const printed = `ERROR: P0001: SECURITY_TESTS ${hex({ passed: 41, failed: [] })}\nCONTEXT: PL/pgSQL function inline_code_block line 200 at RAISE`;
    expect(outcomeOf(printed)).toEqual({ passed: 41, failed: [] });
  });

  it('reads the rules that broke, whatever quotes and signs their messages carry', () => {
    const failed = ['B sees A\'s progress', 'a "quoted" word, a \\ and a } in one line', 'A could not save: relation "public.games" does not exist'];
    // As the Supabase CLI prints it: a message inside a message, quotes escaped twice over.
    const printed = String.raw`{"_tag":"Error","error":{"message":"unexpected status 400: {\"message\":\"Failed to run sql query: ERROR:  P0001: SECURITY_TESTS ` + hex({ passed: 3, failed }) + String.raw`\\nCONTEXT:  PL/pgSQL function\\n\"}"}}`;
    expect(outcomeOf(printed)).toEqual({ passed: 3, failed });
  });

  it('says nothing ran when the block stopped before its end, or sent something else', () => {
    expect(outcomeOf('ERROR: 42P01: relation "public.profiles" does not exist')).toBeNull();
    expect(outcomeOf('')).toBeNull();
    expect(outcomeOf(`SECURITY_TESTS ${hex('not a result')}`)).toBeNull();
    expect(outcomeOf(`SECURITY_TESTS ${hex({ passed: '3', failed: [] })}`)).toBeNull();
    expect(outcomeOf('SECURITY_TESTS abc')).toBeNull();
  });
});

describe('the verdict on a run', () => {
  it('is a pass only when every check of the file ran and held', () => {
    expect(verdict({ passed: 45, failed: [] }, 45)).toEqual({ ok: true, lines: ['✓ security rules: 45 held, 0 broken'] });
  });

  it('fails a broken rule, and names it', () => {
    const { ok, lines } = verdict({ passed: 44, failed: ['A read game_secrets'] }, 45);
    expect(ok).toBe(false);
    expect(lines).toEqual(['  ✗ A read game_secrets', '✗ security rules: 44 held, 1 broken']);
  });

  it('fails a run in which some checks never happened, though none broke', () => {
    const { ok, lines } = verdict({ passed: 40, failed: [] }, 45);
    expect(ok).toBe(false);
    expect(lines[0]).toContain('40 checks ran, and the file has 45');
  });

  it('fails a run that never reached its end', () => {
    expect(verdict(null, 45).ok).toBe(false);
  });
});
