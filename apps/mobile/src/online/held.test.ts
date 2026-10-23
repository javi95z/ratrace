import type { Cloud } from '@ratrace/online/supabase';
import { describe, expect, it, vi } from 'vitest';
import { FIRST_SCREEN_AT_MOST, firstScreenDoor, heldSaves, pacedLives } from './held';

/** A cloud whose every ask is noted as it reaches it, and answers at once. */
function noting() {
  const asked: string[] = [];
  const ask = (name: string, answer: unknown) => async (...args: unknown[]) => {
    asked.push(`${name}(${args.join(',')})`);
    return answer;
  };
  const cloud = { listRuns: ask('listRuns', []), playingGames: ask('playingGames', [{ id: 'life-1' }]), pushGame: ask('pushGame', 'saved'), finishRun: ask('finishRun', 'done'), currentUser: ask('currentUser', null) } as unknown as Cloud;
  return { cloud, asked };
}

describe('the account\'s lives in progress, handed back after the first screen', () => {
  it('asks everything at once, and hands back every answer as it comes but the lives in progress, which wait for the door', async () => {
    const door = firstScreenDoor(() => undefined);
    const { cloud, asked } = noting();
    const held = heldSaves(cloud, door.wait);
    let lives: unknown = 'waiting';
    void held.playingGames().then((answer) => (lives = answer));
    expect(await held.listRuns()).toEqual([]);
    expect(await held.finishRun('life-0')).toBe('done');
    await new Promise((resolve) => setTimeout(resolve, 5));
    // Asked at once, all of it; the lives' answer held.
    expect(asked).toEqual(['playingGames()', 'listRuns()', 'finishRun(life-0)']);
    expect(lives).toBe('waiting');
    door.open();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(lives).toEqual([{ id: 'life-1' }]);
  });

  it('hands back a refusal of the lives in progress once the door opens, and never as an unheard rejection before', async () => {
    const door = firstScreenDoor(() => undefined);
    const cloud = { playingGames: () => Promise.reject(new Error('no network')) } as unknown as Cloud;
    const held = heldSaves(cloud, door.wait);
    const asking = held.playingGames();
    await new Promise((resolve) => setTimeout(resolve, 5));
    door.open();
    await expect(asking).rejects.toThrow('no network');
  });

  it('lets the JS thread turn between two lives played back', async () => {
    const order: string[] = [];
    setTimeout(() => order.push('waiting'), 0);
    await pacedLives();
    order.push('next life');
    expect(order).toEqual(['waiting', 'next life']);
  });

  it('opens by itself a while after the lives first came to it, should the first screen never say it is drawn', async () => {
    const timers: Array<{ run: () => void; ms: number }> = [];
    const door = firstScreenDoor((run, ms) => timers.push({ run, ms }));
    expect(timers).toEqual([]);
    const opened = vi.fn();
    void door.wait().then(opened);
    void door.wait();
    expect(timers).toHaveLength(1);
    expect(timers[0].ms).toBe(FIRST_SCREEN_AT_MOST);
    expect(door.isOpen()).toBe(false);
    timers[0].run();
    await Promise.resolve();
    expect(opened).toHaveBeenCalled();
    expect(door.isOpen()).toBe(true);
  });
});
