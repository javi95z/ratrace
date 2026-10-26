import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bots, content, CONTENT_VERSION, lives, textFor } from '@ratrace/content';
import type { Milestone } from '@ratrace/content';
import { ENGINE_VERSION } from '@ratrace/engine';
import type { GameEvent } from '@ratrace/engine';
import en from '@ratrace/i18n/messages/en.json';
import { describe, expect, it } from 'vitest';
import { formatFor } from '../lib/format';
import { fixedSessions } from '../session/fixed';
import { LocalSessions } from '../session/local';
import { MemoryStore } from '../session/memory';
import { newProfile } from '../session/types';
import { runScene, sceneStore } from '../testing/scenes';
import { chapters, epilogue } from './epilogue';
import { momentsOf } from './moments';
import { escapeAge, milestoneAge, milestoneRound } from './present';
import type { Translate } from './present';
import { createGameStore } from './store';

/** The epilogue's words as the pages fill them. */
const tale: Translate = (key, values = {}) => {
  let found: unknown = en.epilogue;
  for (const part of key.split('.')) found = (found as Record<string, unknown>)[part];
  return String(found).replace(/\{(\w+)\}/g, (_, name: string) => String(values[name]));
};

/** The game of a scene, opened on its store and taken through its steps, as either client takes it. */
async function scene(name: string) {
  const game = createGameStore({ sessions: fixedSessions(await sceneStore(name)), content });
  await game.getState().boot();
  await runScene(name, game);
  return game.getState();
}

describe('the age a life left the rat race at', () => {
  // The engineer of the scenes, played by the saver: her seventeenth round (round 16, counted from 0) is the second that covers her life.
  // She lives it at 54 and is 56 once it is played. The rules count her out at 54: `escapedAtRound` is 16, and the badges'
  // `escapedAtAge` (content/badges.ts) is START_AGE + 16 × 2.
  it('is the age of the round the life got out in, wherever it is told: the moment, the life line, the epilogue', async () => {
    const state = await scene('moment-escape');
    const view = state.view!;
    expect(view.round).toBe(17);
    expect(view.player.escapedAtRound).toBe(16);
    expect(escapeAge(content, view.player.escapedAtRound!)).toBe(54);

    const moment = momentsOf(state).find((m) => m.kind === 'escape');
    expect(moment).toMatchObject({ kind: 'escape', round: 16 });
    expect(escapeAge(content, (moment as { round: number }).round)).toBe(54);

    const out = state.story.find((m) => m.kind === 'escaped')!;
    expect(milestoneRound(out)).toBe(16);
    expect(milestoneAge(content, out)).toBe(54);

    const life = lives.find((one) => one.id === 'engineer')!;
    const [, middle] = epilogue({ words: { content, ...textFor('en'), fmt: formatFor('en') }, t: tale, life, view, story: state.story, score: 0, bankruptcies: 0 });
    expect(middle).toContain('At 54 you left the rat race');
    expect(middle).not.toContain('At 56 you left the rat race');
  });

  it('is told before what the same round brought once it was played, which is a round older', () => {
    // A round played: its end brought the top of a career (told at the round that opens, 15) and the way out (won in round 14).
    const story: Milestone[] = [
      { round: 15, kind: 'promoted', careerId: 'tech', level: 4, top: true },
      { round: 15, kind: 'escaped' },
    ];
    expect(chapters(story).map((m) => [m.kind, milestoneAge(content, m)])).toEqual([['escaped', 50], ['promoted', 52]]);
  });
});

/**
 * The engineer played by the indexer on a seed of her own: out of the rat race in round 15 (at 52), caught again in round 16 (lived at 54).
 * Played through the sessions, so the story is written as the game writes it (`recordStep`, `storyAfter`). Returns the life once the round
 * that caught her is played.
 */
async function caughtAgain() {
  const store = new MemoryStore();
  await store.saveProfile({ ...newProfile(), unlocked: Object.fromEntries(lives.map((life) => [life.id, { at: 0, gameId: 'caught' }])) });
  let n = 0;
  const sessions = new LocalSessions(store, content, lives, { newId: () => `caught-${(n += 1)}`, newSeed: () => 'lost-engineer-indexer-86'.padEnd(64, '0'), now: () => 0 });
  const session = await sessions.start('engineer');
  const bot = bots.find((one) => one.id === 'indexer')!;
  for (;;) {
    while (session.view().phase === 'cards') await session.answerCard(bot.pick(content, session.view()));
    const played: GameEvent[] = (await session.playRound({ orders: bot.orders(content, session.view()) })).events;
    if (played.some((event) => event.kind === 'escapeLost') || session.view().finished) return { session, played };
  }
}

describe('the age a life was caught again by the rat race at', () => {
  it('is the age of the round that caught it, as the escape is told at the round it was won in', async () => {
    const { session, played } = await caughtAgain();
    const view = session.view();
    expect(played).toContainEqual({ kind: 'escapeLost' });
    // Round 17 played: the game stands at 18, and the story writes both turns of the way out with the round it stands at once each is played.
    expect(view.round).toBe(18);
    expect(view.player.escapedAtRound).toBeNull();
    const story = session.story();
    expect(story.filter((m) => m.kind === 'escaped' || m.kind === 'escapeLost')).toEqual([{ round: 15, kind: 'escaped' }, { round: 18, kind: 'escapeLost' }]);
    const back = story.find((m) => m.kind === 'escapeLost')!;
    expect(milestoneRound(back)).toBe(17);
    expect(milestoneAge(content, back)).toBe(56);
    expect(milestoneAge(content, story.find((m) => m.kind === 'escaped')!)).toBe(50);

    const life = lives.find((one) => one.id === 'engineer')!;
    const [, middle] = epilogue({ words: { content, ...textFor('en'), fmt: formatFor('en') }, t: tale, life, view, story, score: 0, bankruptcies: 0 });
    expect(middle).toContain('At 50 you left the rat race');
    expect(middle).toContain('At 56 the rat race caught you again.');
    expect(middle).not.toContain('At 58 the rat race caught you again.');
  }, 60_000);

  it('is told before what the same round brought once it was played', () => {
    const story: Milestone[] = [
      { round: 17, kind: 'worth', mark: 100_000_000 },
      { round: 17, kind: 'escapeLost' },
    ];
    expect(chapters(story).map((m) => [m.kind, milestoneAge(content, m)])).toEqual([['escapeLost', 54], ['worth', 56]]);
  });
});

describe('the round the way out is written with, in every rules bundle still played', () => {
  // Saved stories are read, never rewritten: `milestoneRound` holds only if every version of the game that a life in progress may
  // still be on wrote both turns of the way out with the round that opens once the round that brought them is played.
  const held = fileURLToPath(new URL('../../../../supabase/functions/_shared/game/', import.meta.url));
  const retired = new Set<string>(JSON.parse(readFileSync(held + 'retired.json', 'utf8')));
  const shipped = Object.keys(JSON.parse(readFileSync(held + 'shipped.json', 'utf8'))).filter((key) => !retired.has(key));
  const files = readdirSync(held).filter((file) => /^v\d+\.\d+\.\d+-\d+\.\d+\.\d+\.js$/.test(file));

  it('is the round after the one the life got out in, or was caught in, from the oldest to the newest', () => {
    // The bundle of the rules now in the code may be written and not shipped yet: it ships with the deploy, which locks it in shipped.json.
    const keys = files.map((file) => file.slice(1, -3).replace('-', '/')).sort();
    const unshipped = keys.filter((key) => !shipped.includes(key));
    expect(unshipped.every((key) => key === `${ENGINE_VERSION}/${CONTENT_VERSION}`)).toBe(true);
    expect(keys.filter((key) => shipped.includes(key))).toEqual([...shipped].sort());
    // The story's writer: every milestone of a step at the round the game stands at after it (`o = after.round`), the way out among them.
    const story = /(\w)=(\w)\.round,\w=\2\.player,[^]*?kind==="escaped"&&\w\.push\(\{round:\1,kind:"escaped"\}\),\w\.kind==="escapeLost"&&\w\.push\(\{round:\1,kind:"escapeLost"\}\)/;
    // The round's step: `completed = round + 1`; out at `completed - 1`, caught again in the same step; the game then stands at `completed`.
    const step = /,(\w)=(\w)\.round\+1,[^]*?escapedAtRound=\1-1,\w\.push\(\{kind:"escaped",round:\1-1\}\)\):\w\.escapedAtRound!==null&&!\w&&\(\w\.escapedAtRound=null,\w\.push\(\{kind:"escapeLost"\}\)\)[^]*?\2\.round=\1,/;
    for (const file of files) {
      const source = readFileSync(held + file, 'utf8');
      expect(story.test(source), `${file}: the story's writer`).toBe(true);
      expect(step.test(source), `${file}: the round's step`).toBe(true);
    }
  });
});
