import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sha256 } from './sha256';

const hex = (words: readonly number[]) => words.map((word) => word.toString(16).padStart(8, '0')).join('');
const node = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

describe('sha256', () => {
  it('gives the published answers', () => {
    expect(hex(sha256(''))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(hex(sha256('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(hex(sha256('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'))).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
  });

  it('agrees with the platform at every length around the edges of a block', () => {
    for (const length of [1, 54, 55, 56, 57, 63, 64, 65, 118, 119, 120, 121, 127, 128, 129, 1000]) {
      const text = Array.from({ length }, (_, i) => String.fromCharCode(33 + ((i * 7) % 90))).join('');
      expect(hex(sha256(text)), `${length} bytes`).toBe(node(text));
    }
  });

  it('reads text as UTF-8, whatever is in it', () => {
    for (const text of ['ñandú', '€uro', 'life 😀 of a rat', '日本語のテキスト', 'a\u0000b', '\ud83d alone', 'seed::asset:sp500']) {
      // An unpaired half of a character is read as the platform reads it: as the replacement character.
      expect(hex(sha256(text)), JSON.stringify(text)).toBe(node(text));
    }
  });

  it('is eight whole numbers of 32 bits', () => {
    const words = sha256('x');
    expect(words).toHaveLength(8);
    for (const word of words) {
      expect(Number.isInteger(word)).toBe(true);
      expect(word).toBeGreaterThanOrEqual(0);
      expect(word).toBeLessThanOrEqual(0xffffffff);
    }
  });
});
