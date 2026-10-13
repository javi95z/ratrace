import { describe, expect, it } from 'vitest';
import { maskEmail } from './mask';

describe('maskEmail', () => {
  it('keeps the start of the name and the whole of the domain', () => {
    expect(maskEmail('ana.garcia@example.com')).toBe('an•••@example.com');
    expect(maskEmail('javi@gmail.com')).toBe('ja•••@gmail.com');
  });

  it('does not show a short name whole', () => {
    expect(maskEmail('ab@example.com')).toBe('a•••@example.com');
    expect(maskEmail('a@example.com')).toBe('•••@example.com');
  });

  it('hides everything of what is not an address', () => {
    expect(maskEmail('not an address')).toBe('•••');
    expect(maskEmail('')).toBe('•••');
    expect(maskEmail('@example.com')).toBe('•••@example.com');
  });
});
