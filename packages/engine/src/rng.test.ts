import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { Rng, seedRng } from './rng';
import type { RngState } from './rng';

const take = (rng: Rng, n: number) => Array.from({ length: n }, () => rng.u32());

describe('rng', () => {
  it('starts every stream from 128 bits of the seed, not from one 32-bit number spread over four', () => {
    // A stream once began from a single 32-bit number: whoever saw a few of its draws could try all of them
    // and read the rest. It now begins from the first four words of SHA-256 of the seed and the stream's name.
    const words = (text: string) => {
      const digest = createHash('sha256').update(text, 'utf8').digest();
      return [0, 4, 8, 12].map((at) => digest.readUInt32BE(at));
    };
    expect(seedRng('s', 'market')).toEqual(words('s::market'));
    expect(seedRng('8f2c0a51', 'asset:sp500')).toEqual(words('8f2c0a51::asset:sp500'));
    // Pinned: a change here changes every game ever seeded, and needs a new engine version.
    expect(seedRng('the rat race', 'world')).toEqual([3536404475, 2827881105, 1756735627, 1876695792]);
  });

  it('gives the same sequence for the same seed and stream', () => {
    expect(take(new Rng(seedRng('s', 'market')), 20)).toEqual(take(new Rng(seedRng('s', 'market')), 20));
  });

  it('gives different sequences for different seeds and streams', () => {
    const base = take(new Rng(seedRng('s', 'market')), 20);
    expect(take(new Rng(seedRng('s', 'cards')), 20)).not.toEqual(base);
    expect(take(new Rng(seedRng('t', 'market')), 20)).not.toEqual(base);
  });

  it('continues exactly from a snapshot, also after a JSON round trip', () => {
    const a = new Rng(seedRng('s', 'market'));
    take(a, 10);
    const saved = JSON.parse(JSON.stringify(a.snapshot())) as RngState;
    const b = new Rng(saved);
    expect(take(b, 5)).toEqual(take(a, 5));
  });

  it('keeps float in [0, 1) and int in range', () => {
    const r = new Rng(seedRng('f', 'x'));
    for (let i = 0; i < 5_000; i++) {
      const f = r.float();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = r.int(7);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(7);
    }
  });

  it('normal is centred near zero and bounded', () => {
    const r = new Rng(seedRng('n', 'x'));
    let sum = 0;
    for (let i = 0; i < 20_000; i++) {
      const z = r.normal();
      expect(z).toBeGreaterThanOrEqual(-6);
      expect(z).toBeLessThanOrEqual(6);
      sum += z;
    }
    expect(Math.abs(sum / 20_000)).toBeLessThan(0.05);
  });

  it('pickWeighted respects weights', () => {
    const r = new Rng(seedRng('w', 'x'));
    let a = 0;
    for (let i = 0; i < 10_000; i++) {
      if (r.pickWeighted([['a', 90], ['b', 10]] as const) === 'a') a++;
    }
    expect(a).toBeGreaterThan(8_700);
    expect(a).toBeLessThan(9_300);
  });

  it('chance(0) never fires and chance(100) always fires', () => {
    const r = new Rng(seedRng('c', 'x'));
    for (let i = 0; i < 1_000; i++) {
      expect(r.chance(0)).toBe(false);
      expect(r.chance(100)).toBe(true);
    }
  });
});
