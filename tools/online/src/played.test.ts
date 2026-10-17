import { content, CONTENT_VERSION, lives, replayLife as replayWhole } from '@ratrace/content';
import { ENGINE_VERSION, stateHash } from '@ratrace/engine';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GAMES } from '../../../supabase/functions/_shared/game/index.ts';
import { forgetPlayed, lifePlayer } from '../../../supabase/functions/_shared/played.ts';
import { withStep } from '../../../supabase/functions/_shared/ranked.ts';
import type { LoggedRound } from '../../../supabase/functions/_shared/game/types.ts';

vi.setConfig({ testTimeout: 60_000 });

const VERSIONS = `${ENGINE_VERSION}/${CONTENT_VERSION}`;
const game = GAMES[VERSIONS];
const nurse = lives.find((life) => life.id === 'nurse');
if (!game || !nurse) throw new Error('no bundle for the versions of this checkout, or no nurse');
const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
/** The whole replay, from the content itself, of a log as the server holds it. */
const replayLife = (c: typeof content, start: unknown, seed: string, log: readonly LoggedRound[]) => replayWhole(c, start as never, seed, log as never);

/** A life of a few rounds, played one step at a time as a server is asked for it, with what the whole replay gives at each step. */
function playThrough(player: ReturnType<typeof lifePlayer>, seed: string, rounds: number) {
  let log: LoggedRound[] = [];
  let played = player.play(log);
  for (let round = 0; round < rounds; round++) {
    while (played.state.phase === 'cards') {
      const choice = { card: (round + log.length) % 2 };
      const next = withStep(log, choice);
      played = player.step(log, next, choice);
      log = next;
      const whole = replayLife(content, nurse!.start, seed, log);
      expect(stateHash(played.state as never)).toBe(stateHash(whole.state));
      expect(played.journal).toEqual(whole.journal);
    }
    const choice = { orders: round % 2 ? [{ type: 'focus', action: 'studyCareer' }] : [] };
    const next = withStep(log, choice);
    played = player.step(log, next, choice);
    log = next;
    const whole = replayLife(content, nurse!.start, seed, log);
    expect(stateHash(played.state as never)).toBe(stateHash(whole.state));
    expect(played.history).toEqual(whole.history);
  }
  return { log, played };
}

describe('the lives a function keeps', () => {
  beforeEach(forgetPlayed);

  it('takes each next step from the life it kept, and gives what the whole replay gives', () => {
    const replay = vi.spyOn(game, 'replayLife');
    const player = lifePlayer(game, ID, VERSIONS, nurse.start, 'kept');
    playThrough(player, 'kept', 4);
    // Played from its seed once, at the start, and never again.
    expect(replay).toHaveBeenCalledTimes(1);
    replay.mockRestore();
  });

  it('keeps every card answered, as the picks of a challenge are counted', () => {
    const player = lifePlayer(game, ID, VERSIONS, nurse.start, 'picks');
    const { log, played } = playThrough(player, 'picks', 3);
    forgetPlayed();
    const fresh = lifePlayer(game, ID, VERSIONS, nurse.start, 'picks').play(log);
    expect(played.picks).toEqual(fresh.picks);
    expect(played.picks.length).toBe(log.reduce((n, entry) => n + entry.picks.length, 0));
  });

  it('plays the life from its seed when the log is not the one it kept', () => {
    const player = lifePlayer(game, ID, VERSIONS, nurse.start, 'other');
    const { log } = playThrough(player, 'other', 2);
    const replay = vi.spyOn(game, 'replayLife');
    // A step from somewhere the function never saw this life, as when another instance took the step before.
    const earlier = log.slice(0, 1);
    const choice = { orders: [] };
    const after = player.step(earlier, withStep(earlier, choice), choice);
    expect(replay).toHaveBeenCalledTimes(1);
    expect(stateHash(after.state as never)).toBe(stateHash(replayLife(content, nurse.start, 'other', withStep(earlier, choice)).state));
    replay.mockRestore();
  });

  it('never hands one life to another with the same id but another seed', () => {
    playThrough(lifePlayer(game, ID, VERSIONS, nurse.start, 'first'), 'first', 1);
    const second = lifePlayer(game, ID, VERSIONS, nurse.start, 'second').play([]);
    expect(stateHash(second.state as never)).toBe(stateHash(replayLife(content, nurse.start, 'second', []).state));
  });

  it('reads a log whose keys the database put in another order as the same log', () => {
    const player = lifePlayer(game, ID, VERSIONS, nurse.start, 'keys');
    const { log } = playThrough(player, 'keys', 2);
    const reordered = JSON.parse(JSON.stringify(log.map((entry) => ({ orders: entry.orders, picks: entry.picks })))) as LoggedRound[];
    const replay = vi.spyOn(game, 'replayLife');
    player.play(reordered);
    expect(replay).not.toHaveBeenCalled();
    replay.mockRestore();
  });

  it('does not change a life it kept when the next step is refused', () => {
    const player = lifePlayer(game, ID, VERSIONS, nurse.start, 'refused');
    let log: LoggedRound[] = [];
    let played = player.play(log);
    while (played.state.phase === 'cards') {
      const next = withStep(log, { card: 0 });
      played = player.step(log, next, { card: 0 });
      log = next;
    }
    const before = structuredClone(played);
    expect(() => player.step(log, withStep(log, { card: 0 }), { card: 0 })).toThrow();
    expect(player.play(log)).toEqual(before);
  });
});

describe('the lives a function keeps, told apart', () => {
  beforeEach(forgetPlayed);

  it('never hands one life to another with the same id and seed but another start', () => {
    const engineer = lives.find((life) => life.id === 'engineer');
    if (!engineer) throw new Error('no engineer');
    lifePlayer(game, ID, VERSIONS, nurse.start, 'same').play([]);
    const other = lifePlayer(game, ID, VERSIONS, engineer.start, 'same').play([]);
    expect(stateHash(other.state as never)).toBe(stateHash(replayLife(content, engineer.start, 'same', []).state));
  });
});
