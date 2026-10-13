import { describe, expect, it } from 'vitest';
import { outcomeOf } from './outcome';

describe('reading the outcome of the SQL security tests', () => {
  it('finds the result in the message of the error the tests always end with', () => {
    const printed = 'ERROR: P0001: SECURITY_TESTS {"passed" : 41, "failed" : []}\nCONTEXT: PL/pgSQL function inline_code_block line 200 at RAISE';
    expect(outcomeOf(printed)).toEqual({ passed: 41, failed: [] });
  });

  it('reads the rules that broke, quotes escaped or not', () => {
    expect(outcomeOf('SECURITY_TESTS {"passed" : 3, "failed" : ["B sees A\'s progress","A read game_secrets"]}')).toEqual({ passed: 3, failed: ["B sees A's progress", 'A read game_secrets'] });
    expect(outcomeOf('{"message":"SECURITY_TESTS {\\"passed\\" : 1, \\"failed\\" : [\\"x\\"]}"}')).toEqual({ passed: 1, failed: ['x'] });
  });

  it('reads it as the Supabase CLI really prints it, a message inside a message', () => {
    const printed = String.raw`{"_tag":"Error","error":{"code":"DbQueryUnexpectedStatusError","message":"unexpected status 400: {\"message\":\"Failed to run sql query: ERROR:  P0001: SECURITY_TESTS {\\\"passed\\\" : 45, \\\"failed\\\" : []}\\nCONTEXT:  PL/pgSQL function inline_code_block line 230 at RAISE\\n\"}"}}`;
    expect(outcomeOf(printed)).toEqual({ passed: 45, failed: [] });
  });

  it('says nothing ran when the block stopped before its end', () => {
    expect(outcomeOf('ERROR: 42P01: relation "public.profiles" does not exist')).toBeNull();
    expect(outcomeOf('')).toBeNull();
  });
});
