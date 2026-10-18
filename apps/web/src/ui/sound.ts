/**
 * The sounds of the game, played by a small chip of its own: square, triangle and saw waves and a
 * burst of noise, written as notes. There is no sound file to load, and so nothing to wait for.
 *
 * A browser only lets a page make sound once the player has touched it, so the chip is not built
 * until the first cue, which always follows a tap. Where there is no audio at all, on a server or
 * in a test, every cue is silence.
 */

/** Everything the game can be heard doing. */
export type Cue =
  | 'tap'
  | 'card'
  | 'pick'
  | 'coin'
  | 'refuse'
  | 'round'
  | 'good'
  | 'bad'
  | 'promote'
  | 'badge'
  | 'badgeUncommon'
  | 'badgeRare'
  | 'badgeLegendary'
  | 'million'
  | 'escape'
  | 'bankrupt'
  | 'crisis'
  | 'calm'
  | 'end';

type Wave = 'square' | 'triangle' | 'sawtooth' | 'noise';

/** One note: what plays it, its pitch in hertz, when it starts and how long it lasts in seconds, and how loud it is from 0 to 1. */
interface Note {
  wave: Wave;
  hz: number;
  at: number;
  for: number;
  loud: number;
  /** The pitch it has glided to by the time it ends. */
  to?: number;
}

/** The pitch of a note of the scale: `pitch('A', 4)` is 440. */
function pitch(name: 'C' | 'D' | 'Eb' | 'E' | 'F' | 'F#' | 'G' | 'Ab' | 'A' | 'Bb' | 'B', octave: number): number {
  const steps = { C: -9, D: -7, Eb: -6, E: -5, F: -4, 'F#': -3, G: -2, Ab: -1, A: 0, Bb: 1, B: 2 }[name];
  return 440 * 2 ** (steps / 12 + (octave - 4));
}

/** Notes one after another, each as long as the step, on one voice. */
function run(wave: Wave, pitches: number[], step: number, loud: number, at = 0, last = step): Note[] {
  return pitches.map((hz, i) => ({ wave, hz, at: at + i * step, for: i === pitches.length - 1 ? last : step, loud }));
}

const C5 = pitch('C', 5);
const E5 = pitch('E', 5);
const G5 = pitch('G', 5);
const C6 = pitch('C', 6);

/** The score: every cue as its notes. Short ones answer a touch; long ones mark a moment of a life. */
export const SCORE: Record<Cue, Note[]> = {
  // A touch on anything that can be pressed.
  tap: [{ wave: 'square', hz: 660, at: 0, for: 0.025, loud: 0.1 }],
  // A card is dealt: paper, then a rising blip.
  card: [
    { wave: 'noise', hz: 0, at: 0, for: 0.05, loud: 0.12 },
    { wave: 'triangle', hz: 520, to: 780, at: 0.03, for: 0.09, loud: 0.3 },
  ],
  // A choice is made, for good.
  pick: run('square', [pitch('A', 4), pitch('E', 5)], 0.06, 0.16, 0, 0.1),
  // Money moves: the two notes every arcade taught.
  coin: [
    { wave: 'square', hz: pitch('B', 5), at: 0, for: 0.06, loud: 0.16 },
    { wave: 'square', hz: pitch('E', 6), at: 0.06, for: 0.2, loud: 0.16 },
  ],
  // The game will not take that.
  refuse: run('square', [pitch('G', 3), pitch('D', 3)], 0.09, 0.18, 0, 0.16),
  // Two years go by: the ledger rolls up.
  round: run('triangle', [C5, E5, G5, C6], 0.07, 0.3, 0, 0.16),
  good: run('square', [C5, E5, G5], 0.06, 0.14, 0, 0.14),
  bad: [{ wave: 'sawtooth', hz: 330, to: 165, at: 0, for: 0.32, loud: 0.14 }],
  // A step up the ladder.
  promote: [...run('square', [C5, G5, C6], 0.09, 0.16, 0, 0.26), ...run('triangle', [pitch('E', 4), pitch('G', 4), pitch('C', 5)], 0.09, 0.22, 0, 0.26)],
  // A badge: a climb with a sparkle on top.
  badge: [...run('square', [G5, pitch('B', 5), pitch('D', 6), pitch('G', 6)], 0.07, 0.14, 0, 0.3), { wave: 'triangle', hz: pitch('G', 7), at: 0.28, for: 0.18, loud: 0.12 }],
  // An uncommon badge: the same climb, a fifth higher and a note longer.
  badgeUncommon: [...run('square', [pitch('B', 5), pitch('D', 6), pitch('G', 6), pitch('B', 6)], 0.07, 0.14, 0, 0.34), { wave: 'triangle', hz: pitch('D', 7), at: 0.28, for: 0.24, loud: 0.13 }],
  // A rare badge: a rising run under a held chord of gold.
  badgeRare: [
    ...run('square', [G5, pitch('B', 5), pitch('D', 6), pitch('G', 6), pitch('B', 6)], 0.08, 0.14, 0, 0.5),
    ...[pitch('G', 4), pitch('B', 4), pitch('D', 5)].map((hz) => ({ wave: 'triangle' as const, hz, at: 0.32, for: 0.6, loud: 0.17 })),
    { wave: 'triangle', hz: pitch('D', 7), at: 0.4, for: 0.5, loud: 0.12 },
  ],
  // A legendary badge: a slow fanfare, a full chord, and a bell that rings on after it.
  badgeLegendary: [
    ...run('square', [C5, G5, C6, E5, G5, pitch('E', 6)], 0.11, 0.15, 0, 0.3),
    ...run('square', [G5, C6, pitch('E', 6), pitch('G', 6)], 0.14, 0.16, 0.66, 0.9),
    ...[pitch('C', 3), C5, E5, G5, C6].map((hz) => ({ wave: 'triangle' as const, hz, at: 1.0, for: 0.9, loud: 0.18 })),
    { wave: 'triangle', hz: pitch('C', 7), at: 1.2, for: 0.7, loud: 0.1 },
  ],
  // The first million: three coins, each higher, then the chord they add up to.
  million: [
    ...[0, 0.14, 0.28].flatMap((at, i) => [
      { wave: 'square' as const, hz: pitch('B', 5) * 2 ** (i / 12), at, for: 0.05, loud: 0.15 },
      { wave: 'square' as const, hz: pitch('E', 6) * 2 ** (i / 12), at: at + 0.05, for: 0.09, loud: 0.15 },
    ]),
    ...[C5, E5, G5, C6].map((hz) => ({ wave: 'triangle' as const, hz, at: 0.46, for: 0.7, loud: 0.2 })),
  ],
  // Out of the rat race: a fanfare, with a bass under it.
  escape: [
    ...run('square', [G5, G5, G5], 0.11, 0.16),
    ...run('square', [C6, pitch('B', 5), C6, pitch('E', 6)], 0.16, 0.17, 0.36, 0.8),
    ...run('triangle', [pitch('C', 4), pitch('G', 3), pitch('C', 4), pitch('C', 4)], 0.16, 0.3, 0.36, 0.8),
    { wave: 'triangle', hz: pitch('G', 6), at: 0.84, for: 0.8, loud: 0.1 },
  ],
  // Bankrupt: down the minor scale, slowing, onto a low note that stays.
  bankrupt: [
    ...run('sawtooth', [pitch('G', 4), pitch('F', 4), pitch('Eb', 4), pitch('D', 4)], 0.2, 0.13),
    { wave: 'sawtooth', hz: pitch('C', 4), to: pitch('C', 3), at: 0.8, for: 0.9, loud: 0.14 },
    { wave: 'triangle', hz: pitch('C', 2), at: 0.8, for: 1.0, loud: 0.3 },
  ],
  // A crisis opens: a siren of two notes over a rumble.
  crisis: [
    ...[0, 0.36, 0.72].flatMap((at) => [
      { wave: 'square' as const, hz: pitch('A', 3), at, for: 0.18, loud: 0.15 },
      { wave: 'square' as const, hz: pitch('F#', 3), at: at + 0.18, for: 0.18, loud: 0.15 },
    ]),
    { wave: 'noise', hz: 0, at: 0, for: 1.1, loud: 0.05 },
    { wave: 'triangle', hz: pitch('D', 2), at: 0, for: 1.1, loud: 0.28 },
  ],
  // A crisis is over: the siren's notes, resolved upwards.
  calm: [...run('triangle', [pitch('D', 4), pitch('F#', 4), pitch('A', 4), pitch('D', 5)], 0.12, 0.28, 0, 0.6)],
  // A life ends: a slow cadence that comes home.
  end: [
    ...run('triangle', [pitch('G', 4), C5, E5, G5], 0.22, 0.28, 0, 0.3),
    ...[C5, E5, G5, C6].map((hz) => ({ wave: 'triangle' as const, hz, at: 0.9, for: 1.1, loud: 0.16 })),
    { wave: 'triangle', hz: pitch('C', 3), at: 0.9, for: 1.1, loud: 0.3 },
  ],
};

/** The part of a browser's audio the chip uses. A test hands in its own. */
export interface AudioPort {
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly state: string;
  readonly destination: AudioNode;
  resume(): Promise<void>;
  createOscillator(): OscillatorNode;
  createGain(): GainNode;
  createBuffer(channels: number, length: number, sampleRate: number): AudioBuffer;
  createBufferSource(): AudioBufferSourceNode;
}

export interface SoundBoard {
  /** Plays a cue now, if sound is on and the device can play it. */
  play(cue: Cue): void;
  /** Turns every cue on or off. Off stops nothing already playing: no cue is longer than two seconds. */
  setOn(on: boolean): void;
  readonly on: boolean;
}

/** Loudness of the whole board, under which each note has its own. Chip sounds are harsh: this is low on purpose. */
const MASTER = 0.5;
/** Every note fades in and out over this long, so that none starts or ends on a click. */
const EDGE = 0.008;

function browserAudio(): AudioPort | null {
  if (typeof window === 'undefined') return null;
  const Maker = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Maker ? new Maker() : null;
}

/**
 * A board that plays the score. `open` is asked for the audio once, on the first cue, and may
 * answer that there is none.
 */
export function createSoundBoard(open: () => AudioPort | null = browserAudio): SoundBoard {
  let on = true;
  let port: AudioPort | null | undefined;
  let hiss: AudioBuffer | null = null;

  /** One second of noise, made once: every burst plays a piece of it. */
  const noise = (audio: AudioPort): AudioBuffer => {
    if (hiss) return hiss;
    hiss = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
    const samples = hiss.getChannelData(0);
    // A fixed sequence, not Math.random: the same hiss on every device and in every test.
    let seed = 22_222;
    for (let i = 0; i < samples.length; i++) {
      seed = (seed * 16_807) % 2_147_483_647;
      samples[i] = (seed / 2_147_483_647) * 2 - 1;
    }
    return hiss;
  };

  const sound = (audio: AudioPort, note: Note, start: number): void => {
    const level = audio.createGain();
    const from = start + note.at;
    const until = from + note.for;
    level.gain.setValueAtTime(0, from);
    level.gain.linearRampToValueAtTime(note.loud * MASTER, from + EDGE);
    level.gain.setValueAtTime(note.loud * MASTER, Math.max(from + EDGE, until - EDGE));
    level.gain.linearRampToValueAtTime(0, until);
    level.connect(audio.destination);

    if (note.wave === 'noise') {
      const source = audio.createBufferSource();
      source.buffer = noise(audio);
      source.connect(level);
      source.start(from);
      source.stop(until);
      return;
    }
    const voice = audio.createOscillator();
    voice.type = note.wave;
    voice.frequency.setValueAtTime(note.hz, from);
    if (note.to !== undefined) voice.frequency.exponentialRampToValueAtTime(note.to, until);
    voice.connect(level);
    voice.start(from);
    voice.stop(until);
  };

  return {
    get on() {
      return on;
    },
    setOn(next) {
      on = next;
    },
    play(cue) {
      if (!on) return;
      try {
        if (port === undefined) port = open();
        if (!port) return;
        // A page left in the background is put to sleep: wake it, and play when it is awake.
        if (port.state === 'suspended') void port.resume().catch(() => undefined);
        const start = port.currentTime + 0.01;
        for (const note of SCORE[cue]) sound(port, note, start);
      } catch {
        // A device that will not play is a silent game, never a broken one.
        port = null;
      }
    },
  };
}
