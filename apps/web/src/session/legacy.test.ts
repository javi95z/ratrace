import { content, lives } from '@ratrace/content';
import { describe, expect, it } from 'vitest';
import { GAMES } from '../../../../supabase/functions/_shared/game/index.ts';
import type { LoadRules, OlderRules } from './legacy';
import { LocalSessions } from './local';
import { MemoryStore } from './memory';
import { SAVE_FORMAT } from './types';
import type { SavedGame } from './types';

const OLD = { engine: '0.36.0', content: '1.37.0' };
const rules = GAMES[`${OLD.engine}/${OLD.content}`] as unknown as OlderRules;

/** A life begun under the rules of 0.36 / 1.37, as a page on those rules saved it: a round in. */
function oldSave() {
  const start = rules.lives.find((life) => life.id === 'nurse')?.start;
  const fresh = rules.replayLife(rules.content, start, 'older-seed', []);
  const picks = (fresh.state as unknown as { hand: string[] }).hand.map(() => 0);
  const log = [{ picks, orders: [] }];
  const life = rules.replayLife(rules.content, start, 'older-seed', log);
  return { format: SAVE_FORMAT, gameId: 'older-life', engineVersion: OLD.engine, contentVersion: OLD.content, lifeId: 'nurse', seed: 'older-seed', log, updatedAt: 1, ...life } as SavedGame;
}

function device(load: LoadRules) {
  const store = new MemoryStore();
  let clock = 10;
  const sessions = new LocalSessions(store, content, lives, { newId: () => 'new-id', newSeed: () => 'new-seed', now: () => (clock += 1), loadRules: load });
  return { store, sessions };
}

describe('a life begun under older rules', () => {
  it('is played on under them, step by step, to the same game they would give', async () => {
    const d = device(async () => rules);
    await d.store.saveGame(oldSave());
    const { session, lost } = await d.sessions.resume();
    expect(lost).toBeNull();
    expect(session?.view().round).toBe(1);
    while (session?.view().phase === 'cards') await session.answerCard(0);
    await session?.playRound({ orders: [] });
    expect(session?.view().round).toBe(2);
    // The save is the older rules' own: their versions, and a log they play to the same place.
    const saved = (await d.store.loadGame()) as SavedGame;
    expect(saved).toMatchObject({ engineVersion: OLD.engine, contentVersion: OLD.content });
    const again = rules.replayLife(rules.content, rules.lives.find((life) => life.id === 'nurse')?.start, saved.seed, saved.log);
    expect(again.state).toEqual(saved.state);
  });

  it('waits, kept, while its rules cannot be loaded, and is let go only when no version holds them', async () => {
    const offline = device(async () => 'unreachable');
    await offline.store.saveGame(oldSave());
    expect(await offline.sessions.resume()).toEqual({ session: null, lost: 'waiting' });
    expect(await offline.store.loadGame()).not.toBeNull();
    const retired = device(async () => 'gone');
    await retired.store.saveGame(oldSave());
    expect(await retired.sessions.resume()).toEqual({ session: null, lost: 'outdated' });
    expect(await retired.store.loadGame()).toBeNull();
  });

  it('leaves alone a life saved by a newer page', async () => {
    const d = device(async () => rules);
    await d.store.saveGame({ ...oldSave(), engineVersion: '99.0.0' });
    expect(await d.sessions.resume()).toEqual({ session: null, lost: 'newer' });
    expect(await d.store.loadGame()).not.toBeNull();
  });
});
