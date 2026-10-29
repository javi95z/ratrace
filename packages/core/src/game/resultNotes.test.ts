import { describe, expect, it } from 'vitest';
import { MINOR_NOTES, byWeight } from './resultNotes';

describe("a round's notes by weight", () => {
  it('keeps what changed the life apart from what only informs, each in the order it came', () => {
    expect(MINOR_NOTES).toEqual(['wornOff', 'crisisOver']);
    const { major, minor } = byWeight([
      { kind: 'wornOff', note: 'trip' },
      { kind: 'promoted', note: 'promotion' },
      { kind: 'crisisOver', note: 'crash' },
      { kind: 'skill', note: 'skills' },
      { kind: 'wornOff', note: 'pass' },
    ]);
    expect(major).toEqual(['promotion', 'skills']);
    expect(minor).toEqual(['trip', 'crash', 'pass']);
  });
});
