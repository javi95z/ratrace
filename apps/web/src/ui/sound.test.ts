import { describe, expect, it } from 'vitest';
import { createSoundBoard, SCORE } from './sound';
import type { AudioPort, Cue } from './sound';

/** Audio that plays nothing and remembers what it was asked to play. */
function fakeAudio(state = 'running') {
  const played = { voices: [] as Array<{ type: string; hz: number; from: number; until: number }>, bursts: 0, resumed: 0, buffers: 0 };
  const param = () => ({ setValueAtTime: () => undefined, linearRampToValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined });
  const port = {
    currentTime: 5,
    sampleRate: 8_000,
    state,
    destination: {},
    resume: () => {
      played.resumed += 1;
      return Promise.resolve();
    },
    createGain: () => ({ gain: param(), connect: () => undefined }),
    createOscillator: () => {
      const voice = { type: 'sine', hz: 0, from: 0, until: 0 };
      played.voices.push(voice);
      return {
        set type(wave: string) {
          voice.type = wave;
        },
        frequency: { ...param(), setValueAtTime: (hz: number) => void (voice.hz = hz) },
        connect: () => undefined,
        start: (at: number) => void (voice.from = at),
        stop: (at: number) => void (voice.until = at),
      };
    },
    createBuffer: (_channels: number, length: number) => {
      played.buffers += 1;
      return { getChannelData: () => new Float32Array(length) };
    },
    createBufferSource: () => {
      played.bursts += 1;
      return { buffer: null, connect: () => undefined, start: () => undefined, stop: () => undefined };
    },
  };
  return { port: port as unknown as AudioPort, played };
}

const cues = Object.keys(SCORE) as Cue[];

describe('the score', () => {
  it('has notes for every cue, none of them loud, late or long', () => {
    for (const cue of cues) {
      const notes = SCORE[cue];
      expect(notes.length, cue).toBeGreaterThan(0);
      for (const note of notes) {
        expect(note.loud, cue).toBeGreaterThan(0);
        expect(note.loud, cue).toBeLessThanOrEqual(0.3);
        expect(note.for, cue).toBeGreaterThan(0.015);
        expect(note.at + note.for, cue).toBeLessThanOrEqual(2);
        if (note.wave !== 'noise') {
          expect(note.hz, cue).toBeGreaterThan(40);
          expect(note.hz, cue).toBeLessThan(5_000);
        }
      }
    }
  });

  it('answers a touch at once and briefly, and gives the moments of a life room', () => {
    const length = (cue: Cue) => Math.max(...SCORE[cue].map((note) => note.at + note.for));
    for (const cue of ['tap', 'pick', 'coin', 'refuse'] as const) expect(length(cue), cue).toBeLessThan(0.3);
    for (const cue of ['escape', 'bankrupt', 'crisis', 'million', 'end'] as const) expect(length(cue), cue).toBeGreaterThan(0.9);
    expect(Math.min(...SCORE.tap.map((note) => note.at))).toBe(0);
  });
});

describe('the sound board', () => {
  it('plays every note of a cue, on the wave and at the pitch the score says, from now on', () => {
    for (const cue of cues) {
      const { port, played } = fakeAudio();
      createSoundBoard(() => port).play(cue);
      const tones = SCORE[cue].filter((note) => note.wave !== 'noise');
      expect(played.voices.map((voice) => [voice.type, voice.hz]), cue).toEqual(tones.map((note) => [note.wave, note.hz]));
      expect(played.bursts, cue).toBe(SCORE[cue].length - tones.length);
      for (const voice of played.voices) {
        expect(voice.from, cue).toBeGreaterThanOrEqual(5);
        expect(voice.until, cue).toBeGreaterThan(voice.from);
      }
    }
  });

  it('asks for the audio only when the first cue comes, and once', () => {
    let opened = 0;
    const { port } = fakeAudio();
    const board = createSoundBoard(() => {
      opened += 1;
      return port;
    });
    expect(opened).toBe(0);
    board.play('tap');
    board.play('coin');
    expect(opened).toBe(1);
  });

  it('makes its noise once and plays pieces of it', () => {
    const { port, played } = fakeAudio();
    const board = createSoundBoard(() => port);
    board.play('card');
    board.play('crisis');
    expect(played.buffers).toBe(1);
    expect(played.bursts).toBe(2);
  });

  it('is silent when turned off, and plays again when turned back on', () => {
    const { port, played } = fakeAudio();
    const board = createSoundBoard(() => port);
    expect(board.on).toBe(true);
    board.setOn(false);
    board.play('escape');
    expect(played.voices).toEqual([]);
    board.setOn(true);
    board.play('tap');
    expect(played.voices).toHaveLength(1);
  });

  it('wakes audio that the browser put to sleep', () => {
    const { port, played } = fakeAudio('suspended');
    createSoundBoard(() => port).play('tap');
    expect(played.resumed).toBe(1);
    expect(played.voices).toHaveLength(1);
  });

  it('is a silent game, never a broken one, where there is no audio or the audio throws', () => {
    const none = createSoundBoard(() => null);
    expect(() => none.play('round')).not.toThrow();

    let opened = 0;
    const broken = createSoundBoard(() => {
      opened += 1;
      throw new Error('no audio device');
    });
    expect(() => broken.play('round')).not.toThrow();
    expect(() => broken.play('round')).not.toThrow();
    // It does not ask again for what it was refused.
    expect(opened).toBe(1);
  });
});
