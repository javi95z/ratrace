// These tests damage saves on purpose.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { content, CONTENT_VERSION, lives } from '@ratrace/content';
import { applyCard, applyRound, createGame, ENGINE_VERSION, realNetWorth, stateHash } from '@ratrace/engine';
import type { GameState } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { recordStart, recordStep } from './record';
import { openSave, replay } from './save';
import type { RoundLog, SavedGame } from './types';

const nurse = lives[0];

/**
 * Plays `rounds` rounds and returns the save a session would have written, with `answered` cards of
 * the next round answered: all of them unless told otherwise.
 */
function saved(rounds: number, answered = Infinity): SavedGame {
  let state: GameState = createGame({ content, start: nurse.start }, 'save-seed');
  const log: RoundLog[] = [];
  let record = recordStart(content, state);
  /** Takes a step and keeps the record of the life, as a session does. */
  const take = (result: { state: GameState; events: Parameters<typeof recordStep>[4] }, orders: Parameters<typeof recordStep>[5] = []) => {
    record = recordStep(content, record, state, result.state, result.events, orders).record;
    state = result.state;
  };
  for (let i = 0; i <= rounds; i++) {
    const entry: RoundLog = { picks: [], orders: null };
    const limit = i === rounds ? answered : Infinity;
    if (state.phase === 'cards' && limit > 0) log.push(entry);
    while (state.phase === 'cards' && entry.picks.length < limit) {
      entry.picks.push(1);
      take(applyCard(content, state, 1));
    }
    if (i === rounds) break;
    if (!log.includes(entry)) log.push(entry);
    entry.orders = [{ type: 'focus', action: 'studyCareer' }, { type: 'depositIn', amount: 10_000 }];
    take(applyRound(content, state, { orders: entry.orders }), entry.orders);
  }
  expect(record.history[0]).toBe(realNetWorth(createGame({ content, start: nurse.start }, 'save-seed')));
  return {
    format: 1, gameId: 'game-1', engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION, lifeId: 'nurse', seed: 'save-seed',
    log, ...record, state, updatedAt: 5,
  };
}

const open = (raw: unknown) => openSave(raw, content, lives);

describe('replay', () => {
  it('rebuilds the state from the seed and the log, at any point of a round', () => {
    for (const rounds of [0, 1, 6]) {
      const save = saved(rounds);
      const again = replay(content, nurse.start, save.seed, save.log);
      expect(stateHash(again.state)).toBe(stateHash(save.state));
      expect(again.history).toEqual(save.history);
      expect(again.bankruptcies).toBe(0);
      expect(again.journal).toEqual(save.journal);
    }
    const fresh = replay(content, nurse.start, 'save-seed', []).state;
    expect(fresh.round).toBe(0);
    expect(fresh.phase).toBe('cards');
  });

  it('rebuilds a hand left half answered, card by card', () => {
    for (const answered of [0, 1, 2]) {
      const save = saved(3, answered);
      expect(save.state).toMatchObject({ round: 3, phase: 'cards', answered });
      const again = replay(content, nurse.start, save.seed, save.log);
      expect(stateHash(again.state)).toBe(stateHash(save.state));
    }
  });

  it('plays a round whose hand was only partly answered as the engine did', () => {
    const start = createGame({ content, start: nurse.start }, 'save-seed');
    const one = applyCard(content, start, 1).state;
    const played = applyRound(content, one, { orders: [] }).state;
    const again = replay(content, nurse.start, 'save-seed', [{ picks: [1], orders: [] }]);
    expect(stateHash(again.state)).toBe(stateHash(played));
  });

  it('refuses a log that does not fit the game', () => {
    expect(() => replay(content, nurse.start, 'save-seed', [{ picks: [], orders: [] }, { picks: [], orders: null }, { picks: [], orders: [] }])).toThrow(
      'the log goes on after a round that was never played',
    );
    const tooLong = new Array<RoundLog>(25).fill({ picks: [], orders: [] });
    expect(() => replay(content, nurse.start, 'save-seed', tooLong)).toThrow('the log is longer than a life');
    const hand = createGame({ content, start: nurse.start }, 'save-seed').hand.length;
    expect(() => replay(content, nurse.start, 'save-seed', [{ picks: new Array<number>(hand + 1).fill(0), orders: null }])).toThrow(
      'the log answers more cards than the round had',
    );
  });
});

describe('openSave', () => {
  it('opens a sound save as it is', () => {
    const save = saved(3);
    const opened = open(JSON.parse(JSON.stringify(save)));
    expect(opened).toEqual({ ok: true, repaired: false, save });
  });

  it('calls a save from other rules outdated', () => {
    expect(open({ ...saved(1), engineVersion: '0.0.1' })).toEqual({ ok: false, lost: 'outdated' });
    expect(open({ ...saved(1), contentVersion: '9.9.9' })).toEqual({ ok: false, lost: 'outdated' });
    // A save from a version of the game newer than this page is not old: it is ahead, and must be left alone.
    expect(open({ ...saved(1), format: 2 })).toEqual({ ok: false, lost: 'newer' });
    expect(open({ ...saved(1), format: 2, engineVersion: '99.0.0' })).toEqual({ ok: false, lost: 'newer' });
  });

  it('rebuilds a damaged state from the seed and the log', () => {
    const save = saved(4);
    const hash = stateHash(save.state);
    for (const damage of [
      (s: any) => (s.state.player.cash = -1),
      (s: any) => (s.state.player.statusPoints += 1),
      (s: any) => delete s.state.player.life,
      (s: any) => (s.state = null),
      (s: any) => s.state.timeline.pop(),
    ]) {
      const broken = JSON.parse(JSON.stringify(save));
      damage(broken);
      const opened = open(broken);
      if (!opened.ok) throw new Error('expected the save to be rebuilt');
      expect(stateHash(opened.save.state)).toBe(hash);
      expect(opened.save.gameId).toBe('game-1');
    }
  });

  it('does not trust a state that belongs to another point of the game', () => {
    const save = saved(4);
    const earlier = saved(2);
    const opened = open({ ...save, state: earlier.state });
    if (!opened.ok) throw new Error('expected the save to be rebuilt');
    expect(opened.save.state.round).toBe(4);
    expect(stateHash(opened.save.state)).toBe(stateHash(save.state));
  });

  it('does not trust a state that belongs to another card of the same hand', () => {
    const save = saved(4, 2);
    for (const other of [saved(4, 0), saved(4, 1), saved(4)]) {
      const opened = open({ ...save, state: other.state });
      if (!opened.ok) throw new Error('expected the save to be rebuilt');
      expect(opened.repaired).toBe(true);
      expect(opened.save.state.answered).toBe(2);
      expect(stateHash(opened.save.state)).toBe(stateHash(save.state));
    }
    expect(open(JSON.parse(JSON.stringify(save)))).toEqual({ ok: true, repaired: false, save });
  });

  it('does not trust a state whose log has a round that was never played in the middle of it', () => {
    const save = saved(3);
    const holed = save.log.map((entry, i) => (i === 1 ? { ...entry, orders: null } : entry));
    // Such a log cannot be played again, so the state it comes with cannot be checked: the save is lost,
    // however sound the state and however well the rest of the record fits it.
    expect(open({ ...JSON.parse(JSON.stringify(save)), log: holed })).toEqual({ ok: false, lost: 'damaged' });
    expect(open({ ...JSON.parse(JSON.stringify(save)), log: holed, history: save.history.slice(0, 3) })).toEqual({ ok: false, lost: 'damaged' });
  });

  it('gives up on a save that cannot be rebuilt either', () => {
    const save = saved(2);
    expect(open({ ...save, state: null, log: 'none' })).toEqual({ ok: false, lost: 'damaged' });
    expect(open({ ...save, state: null, seed: 7 })).toEqual({ ok: false, lost: 'damaged' });
    expect(open({ ...save, state: null, lifeId: 'pirate' })).toEqual({ ok: false, lost: 'damaged' });
    expect(open({ ...save, state: null, log: [{ picks: [], orders: 'buy' }] })).toEqual({ ok: false, lost: 'damaged' });
    for (const picks of [null, {}, 'first', [0.5], [-1], ['0'], [null]]) {
      expect(open({ ...save, log: [{ picks, orders: null }] }), JSON.stringify(picks)).toEqual({ ok: false, lost: 'damaged' });
    }
    for (const junk of [null, undefined, 'save', 42, [], {}]) expect(open(junk)).toEqual({ ok: false, lost: 'damaged' });
  });

  it('repairs the small things a save may lack', () => {
    const save = saved(1);
    const opened = open({ ...save, history: 'none', bankruptcies: -3, updatedAt: 'yesterday' });
    if (!opened.ok) throw new Error('expected the save to open');
    expect(opened.repaired).toBe(true);
    expect(opened.save.history).toEqual(save.history);
    expect(opened.save.bankruptcies).toBe(0);
    expect(opened.save.updatedAt).toBe(0);
    // A save from before the journal existed, or one whose journal is not a journal, gets it back from the log.
    for (const journal of [undefined, null, 'none', { cities: [] }, { cities: ['madrid'], cardUsed: 'no', kinds: [], earned: [] }]) {
      const rebuilt = open({ ...save, journal });
      if (!rebuilt.ok) throw new Error('expected the save to open');
      expect(rebuilt.repaired, JSON.stringify(journal)).toBe(true);
      expect(rebuilt.save.journal).toEqual(save.journal);
    }
    expect(stateHash(opened.save.state)).toBe(stateHash(save.state));
  });
});
