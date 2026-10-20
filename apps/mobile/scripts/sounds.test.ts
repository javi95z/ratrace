import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { SCORE } from '../../web/src/ui/sound';
import { cueSamples, EDGE, envelope, MASTER, noiseBuffer, renderAll, renderCue, SAMPLE_RATE, soundsDir, wavBytes, type Note } from './sounds';

const cues = Object.keys(SCORE);
const scoreOf = (cue: string) => (SCORE as unknown as Record<string, Note[]>)[cue]!;
/** The samples of a WAV as written, from -1 to 1. */
const decode = (bytes: Buffer) => Array.from({ length: (bytes.length - 44) / 2 }, (_, i) => bytes.readInt16LE(44 + i * 2) / 32767);

test('there are 19 files, named by cue', () => {
  expect(cues).toHaveLength(19);
  expect(Object.keys(renderAll()).sort()).toEqual(cues.map((c) => `${c}.wav`).sort());
});

test('a file is 44 100 Hz mono 16-bit PCM and ends where its cue ends', () => {
  for (const [name, bytes] of Object.entries(renderAll())) {
    const cue = name.replace('.wav', '');
    const end = Math.max(...scoreOf(cue).map((n) => n.at + n.for));
    expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
    expect(bytes.toString('ascii', 8, 16)).toBe('WAVEfmt ');
    expect([bytes.readUInt16LE(20), bytes.readUInt16LE(22), bytes.readUInt32LE(24), bytes.readUInt16LE(34)]).toEqual([1, 1, 44_100, 16]);
    expect(bytes.readUInt32LE(40)).toBe(bytes.length - 44);
    const length = (bytes.length - 44) / 2;
    expect(length).toBe(Math.ceil(end * SAMPLE_RATE - 1e-6));
    expect(Math.abs(length / SAMPLE_RATE - end)).toBeLessThan(1 / SAMPLE_RATE);
    expect(length).toBe(cueSamples(scoreOf(cue)));
  }
});

test('no sample clips, before it is made 16-bit', () => {
  for (const cue of cues) {
    const peak = Math.max(...renderCue(scoreOf(cue)).map(Math.abs));
    expect(peak, cue).toBeGreaterThan(0.005);
    expect(peak, cue).toBeLessThanOrEqual(1);
  }
});

test('a single-note cue never gets louder than its note times the master volume of 0.5', () => {
  for (const cue of cues) {
    const notes = scoreOf(cue);
    if (notes.length !== 1) continue;
    const peak = Math.max(...renderCue(notes).map(Math.abs));
    expect(peak, cue).toBeLessThanOrEqual(notes[0]!.loud * MASTER + 1e-9);
    expect(peak, cue).toBeGreaterThan(notes[0]!.loud * MASTER * 0.5);
  }
});

test('a note rises from 0 over 8 ms and falls to 0 over its last 8 ms', () => {
  expect(EDGE).toBe(0.008);
  expect(envelope(0, 0.1, 0.2)).toBe(0);
  expect(envelope(0.004, 0.1, 0.2)).toBeCloseTo(0.2 * MASTER * 0.5, 12);
  expect(envelope(0.008, 0.1, 0.2)).toBeCloseTo(0.2 * MASTER, 12);
  expect(envelope(0.05, 0.1, 0.2)).toBeCloseTo(0.2 * MASTER, 12);
  expect(envelope(0.1 - 0.004, 0.1, 0.2)).toBeCloseTo(0.2 * MASTER * 0.5, 12);
  expect(envelope(0.1, 0.1, 0.2)).toBe(0);
  const tap = renderCue(scoreOf('tap'));
  const ramp = Math.round(EDGE * SAMPLE_RATE);
  const top = scoreOf('tap')[0]!.loud * MASTER;
  expect(tap[0]).toBe(0);
  for (let i = 0; i < ramp; i++) {
    expect(Math.abs(tap[i]!)).toBeLessThanOrEqual((top * (i + 1)) / (EDGE * SAMPLE_RATE) + 1e-9);
    expect(Math.abs(tap[tap.length - 1 - i]!)).toBeLessThanOrEqual((top * (i + 1)) / (EDGE * SAMPLE_RATE) + 1e-9);
  }
  // …and then it is full (a square wave is at its note's level between the edges).
  expect(Math.max(...tap.slice(ramp, tap.length - ramp).map(Math.abs))).toBeGreaterThan(top * 0.95);
});

test('every cue starts and ends on silence', () => {
  for (const cue of cues) {
    const samples = renderCue(scoreOf(cue));
    expect(Math.abs(samples[0]!), cue).toBeLessThan(1e-3);
    expect(Math.abs(samples[samples.length - 1]!), cue).toBeLessThan(1e-3);
  }
});

test("the hiss is the web's: one second of its generator, from the same seed", () => {
  const hiss = noiseBuffer();
  expect(hiss).toHaveLength(44_100);
  expect(hiss[0]).toBeCloseTo(-0.6521648446340882, 6);
  let seed = 22_222;
  for (let i = 0; i < 100; i++) {
    seed = (seed * 16_807) % 2_147_483_647;
    expect(hiss[i]).toBeCloseTo((seed / 2_147_483_647) * 2 - 1, 6);
  }
});

test('a noise note plays the hiss from its first sample, and a note longer than the hiss goes quiet after one second', () => {
  const card = renderCue(scoreOf('card'));
  // At the very start only the noise sounds (the triangle comes in at 30 ms); at 4 ms the gain is half way up.
  const k = 100;
  expect(card[k]! / noiseBuffer()[k]!).toBeCloseTo(envelope(k / SAMPLE_RATE, 0.05, 0.12), 6);
  const crisis = renderCue(scoreOf('crisis'));
  expect(crisis.length).toBeGreaterThan(SAMPLE_RATE);
});

test('the waves start as WebAudio draws them: square up to +1, sawtooth up from 0, triangle up from 0', () => {
  // 100 Hz is 441 samples a cycle, and loud 2 makes the gain 1 once past the 8 ms ramp: the second cycle is at full gain.
  const cycle = 441;
  const one = (wave: Note['wave']) => renderCue([{ wave, hz: 100, at: 0, for: 0.04, loud: 2 }]);
  /** The sample at `phase` of the second cycle. */
  const at = (s: Float64Array, phase: number) => s[cycle + Math.round(phase * cycle)]!;
  const square = one('square');
  expect(at(square, 0.25)).toBeCloseTo(1, 1);
  expect(at(square, 0.75)).toBeCloseTo(-1, 1);
  const saw = one('sawtooth');
  expect(at(saw, 0.25)).toBeCloseTo(0.5, 1);
  expect(at(saw, 0.45)).toBeCloseTo(0.9, 1);
  expect(at(saw, 0.55)).toBeCloseTo(-0.9, 1);
  expect(at(saw, 0.9)).toBeCloseTo(-0.2, 1);
  const triangle = one('triangle');
  expect(at(triangle, 0.25)).toBeCloseTo(1, 1);
  expect(at(triangle, 0.75)).toBeCloseTo(-1, 1);
  expect(at(triangle, 0.125)).toBeCloseTo(0.5, 1);
  // And from its very first sample each is at 0 (the ramp holds it there, as the wave's own phase 0 would).
  for (const s of [square, saw, triangle]) expect(s[0]).toBe(0);
});

test('a glide follows the pitch exponentially: bad falls an octave in 0.32 s', () => {
  const bad = renderCue(scoreOf('bad'));
  const crossings = (from: number, to: number) => {
    let n = 0;
    for (let i = from + 1; i < to; i++) if (bad[i - 1]! < 0 !== bad[i]! < 0) n++;
    return n / 2 / ((to - from) / SAMPLE_RATE);
  };
  const first = crossings(Math.round(0.02 * SAMPLE_RATE), Math.round(0.06 * SAMPLE_RATE));
  const last = crossings(Math.round(0.26 * SAMPLE_RATE), Math.round(0.3 * SAMPLE_RATE));
  expect(first).toBeGreaterThan(300);
  expect(first).toBeLessThan(330);
  expect(last).toBeGreaterThan(170);
  expect(last).toBeLessThan(205);
});

test('no square or sawtooth carries a tone above half the sample rate (band-limited)', () => {
  // 3520 Hz at 44.1 kHz: a naive square aliases (its 13th harmonic is past Nyquist); a band-limited one's spectrum there is nearly empty.
  const s = renderCue([{ wave: 'square', hz: 3520, at: 0, for: 0.1, loud: 2 }]);
  const slice = s.slice(Math.round(0.02 * SAMPLE_RATE), Math.round(0.09 * SAMPLE_RATE));
  let energy = 0;
  for (const x of slice) energy += x * x;
  // Goertzel at an aliased frequency of the 13th harmonic: 13 × 3520 − 44100 = 1660 Hz.
  const w = (2 * Math.PI * 1660) / SAMPLE_RATE;
  let a = 0;
  let b = 0;
  for (const x of slice) [a, b] = [x + 2 * Math.cos(w) * a - b, a];
  const power = (a * a + b * b - 2 * Math.cos(w) * a * b) / slice.length;
  expect(power / (energy / slice.length)).toBeLessThan(0.002);
});

test('the committed files are what the score renders today (run `pnpm --filter @ratrace/mobile exec tsx scripts/sounds.ts` when stale)', () => {
  for (const [name, bytes] of Object.entries(renderAll())) {
    const committed = readFileSync(join(soundsDir, name));
    expect(committed.equals(bytes), name).toBe(true);
  }
});

test('wavBytes rounds and clamps to 16 bits', () => {
  expect(decode(wavBytes([0, 1, -1, 2, -2, 0.5]))).toEqual([0, 1, -1, 1, -1, 16384 / 32767]);
});
