import { describe, expect, it } from 'vitest';
import { lesserShare } from './derive';

describe('a lesser item of a ladder', () => {
  it('adds its share, and never nothing while it gives any and the ladder counts it: a coach beside a degree, a second watch', () => {
    expect(lesserShare(15, 25)).toBe(3);
    // A quarter of 2 rounds to nothing: it adds 1.
    expect(lesserShare(2, 25)).toBe(1);
    expect(lesserShare(1, 50)).toBe(1);
    // An item that gives nothing, or a ladder that counts its rest for nothing, adds nothing.
    expect(lesserShare(0, 25)).toBe(0);
    expect(lesserShare(4, 0)).toBe(0);
  });
});
