import { sha256 } from './sha256';

export type RngState = [number, number, number, number];

/**
 * Where a named stream of a game begins: the first 128 bits of SHA-256 of the seed and the
 * stream's name, which is the whole of the generator's state.
 *
 * Each named stream is independent, so drawing a card never shifts market prices. And a stream's
 * start cannot be found by trying: it once came from a single 32-bit number, which whoever had
 * seen a few rounds of prices could search in seconds, and read the rounds to come. With a seed of
 * 128 bits or more, kept by the server, there is nothing short enough to try.
 */
export function seedRng(seed: string, stream: string): RngState {
  const [a, b, c, d] = sha256(`${seed}::${stream}`);
  return [a, b, c, d];
}

/** sfc32 generator. */
export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(state: RngState) {
    [this.a, this.b, this.c, this.d] = state;
  }

  u32(): number {
    this.a |= 0;
    this.b |= 0;
    this.c |= 0;
    this.d |= 0;
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  /** Uniform in [0, 1). */
  float(): number {
    return this.u32() / 4294967296;
  }

  /** Uniform integer in [0, n). */
  int(n: number): number {
    return Math.floor(this.float() * n);
  }

  /** True with the given probability in percent. */
  chance(pct: number): boolean {
    return this.float() * 100 < pct;
  }

  /** Approximately standard normal: twelve uniforms summed, minus six. Range [-6, 6]. */
  normal(): number {
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += this.float();
    return sum - 6;
  }

  pickWeighted<T>(items: ReadonlyArray<readonly [T, number]>): T {
    let total = 0;
    for (const [, weight] of items) total += weight;
    let r = this.float() * total;
    for (const [item, weight] of items) {
      if (r < weight) return item;
      r -= weight;
    }
    return items[items.length - 1][0];
  }

  snapshot(): RngState {
    return [this.a >>> 0, this.b >>> 0, this.c >>> 0, this.d >>> 0];
  }
}
