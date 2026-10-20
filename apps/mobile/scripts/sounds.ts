import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCORE } from '../../web/src/ui/sound';

/**
 * Renders the web's chiptune score (apps/web/src/ui/sound.ts, which plays it live through WebAudio) to one WAV per cue, once,
 * so the phone can play files instead of building a synth. The same notes, the same gains, the same hiss:
 *
 *   - 44 100 Hz, mono, 16-bit PCM; a file ends where its cue's last note ends.
 *   - Each note fades in from 0 and out to 0 over 8 ms, at MASTER 0.5 under its own loudness (a linear ramp, held between).
 *   - square, sawtooth and triangle are band-limited as WebAudio's are (PolyBLEP; a few harmonics' sum for the triangle) and
 *     start at phase 0: the square rising to +1, the sawtooth rising from 0, the triangle rising from 0.
 *   - A glide (`to`) is exponential in pitch, as `exponentialRampToValueAtTime` is.
 *   - Noise is one second of the web's fixed sequence; every burst plays it from its first sample.
 *
 *   pnpm --filter @ratrace/mobile exec tsx scripts/sounds.ts
 */
export const SAMPLE_RATE = 44_100;
export const MASTER = 0.5;
export const EDGE = 0.008;

/** The shape of a note in the web's score (its own type is not exported). */
export interface Note {
  wave: 'square' | 'triangle' | 'sawtooth' | 'noise';
  hz: number;
  at: number;
  for: number;
  loud: number;
  to?: number;
}

const here = dirname(fileURLToPath(import.meta.url));
export const soundsDir = join(here, '../assets/sounds');

/** The web's hiss: one second of a fixed sequence, so that every device and every test hears the same. */
export function noiseBuffer(): Float32Array {
  const samples = new Float32Array(SAMPLE_RATE);
  let seed = 22_222;
  for (let i = 0; i < samples.length; i++) {
    seed = (seed * 16_807) % 2_147_483_647;
    samples[i] = (seed / 2_147_483_647) * 2 - 1;
  }
  return samples;
}

/** The smoothing of a step of height 2 at phase 0, over one sample of width `dt`. */
function blep(t: number, dt: number): number {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

const fract = (x: number): number => x - Math.floor(x);

/** One sample of a wave at `phase` (0 to 1, the fraction of a cycle) for a pitch that advances `dt` cycles a sample. */
function wave(kind: 'square' | 'triangle' | 'sawtooth', phase: number, dt: number): number {
  if (kind === 'square') {
    // +1 for the first half cycle, -1 for the second, both edges smoothed; it starts at 0, as the sum of sines does.
    return (phase < 0.5 ? 1 : -1) + blep(phase, dt) - blep(fract(phase + 0.5), dt);
  }
  if (kind === 'sawtooth') {
    // Rises from 0 to 1 over the first half cycle, drops to -1, and rises back to 0.
    const u = fract(phase + 0.5);
    return 2 * u - 1 - blep(u, dt);
  }
  // Rises from 0 to 1 at a quarter, down to -1 at three quarters: the odd harmonics, each 1/n² of the first, up to Nyquist.
  const limit = 0.5 / dt;
  let sum = 0;
  for (let n = 1, sign = 1; n < limit; n += 2, sign = -sign) sum += (sign * Math.sin(2 * Math.PI * n * phase)) / (n * n);
  return (8 / (Math.PI * Math.PI)) * sum;
}

/** The gain of a note `t` seconds in: up from 0 over EDGE, held, down to 0 over the last EDGE. */
export function envelope(t: number, length: number, loud: number): number {
  const top = loud * MASTER;
  if (t < 0 || t >= length) return 0;
  if (t < EDGE) return (top * t) / EDGE;
  const fall = Math.max(EDGE, length - EDGE);
  if (t < fall) return top;
  return (top * (length - t)) / (length - fall);
}

/** How many samples a cue lasts: to the end of its last note. */
export function cueSamples(notes: readonly Note[]): number {
  return Math.max(...notes.map((n) => Math.ceil((n.at + n.for) * SAMPLE_RATE - 1e-6)));
}

/** A cue as samples from -1 to 1, before they are made 16-bit. */
export function renderCue(notes: readonly Note[]): Float64Array {
  const out = new Float64Array(cueSamples(notes));
  const hiss = noiseBuffer();
  for (const note of notes) {
    const first = Math.ceil(note.at * SAMPLE_RATE - 1e-6);
    const last = Math.min(out.length, Math.ceil((note.at + note.for) * SAMPLE_RATE - 1e-6));
    let phase = 0;
    for (let n = first; n < last; n++) {
      const t = n / SAMPLE_RATE - note.at;
      const gain = envelope(t, note.for, note.loud);
      if (note.wave === 'noise') {
        out[n]! += gain * (hiss[n - first] ?? 0);
        continue;
      }
      const hz = note.to === undefined ? note.hz : note.hz * (note.to / note.hz) ** (t / note.for);
      const dt = hz / SAMPLE_RATE;
      out[n]! += gain * wave(note.wave, phase, dt);
      phase = fract(phase + dt);
    }
  }
  return out;
}

/** 16-bit mono PCM in a WAV container. */
export function wavBytes(samples: ArrayLike<number>): Buffer {
  const data = samples.length * 2;
  const bytes = Buffer.alloc(44 + data);
  bytes.write('RIFF', 0, 'ascii');
  bytes.writeUInt32LE(36 + data, 4);
  bytes.write('WAVEfmt ', 8, 'ascii');
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20); // PCM
  bytes.writeUInt16LE(1, 22); // mono
  bytes.writeUInt32LE(SAMPLE_RATE, 24);
  bytes.writeUInt32LE(SAMPLE_RATE * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36, 'ascii');
  bytes.writeUInt32LE(data, 40);
  for (let i = 0; i < samples.length; i++) bytes.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i]!)) * 32767), 44 + i * 2);
  return bytes;
}

/** Every cue's file, by name. */
export function renderAll(): Record<string, Buffer> {
  const files: Record<string, Buffer> = {};
  for (const [cue, notes] of Object.entries(SCORE) as [string, Note[]][]) files[`${cue}.wav`] = wavBytes(renderCue(notes));
  return files;
}

function main(): void {
  mkdirSync(soundsDir, { recursive: true });
  const files = renderAll();
  for (const [name, bytes] of Object.entries(files)) writeFileSync(join(soundsDir, name), bytes);
  console.log(`sounds: ${Object.keys(files).length} written`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
