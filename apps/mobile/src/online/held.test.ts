import type { Cloud } from '@ratrace/online/supabase';
import { describe, expect, it, vi } from 'vitest';
import { FIRST_SCREEN_AT_MOST, firstScreenDoor, heldSaves } from './held';

/** A cloud whose every ask is noted as it reaches it. */
function noting() {
  const asked: string[] = [];
  const ask = (name: string) => async (...args: unknown[]) => {
    asked.push(`${name}(${args.join(',')})`);
    return name === 'finishRun' ? 'done' : [];
  };
  const cloud = { listRuns: ask('listRuns'), pushGame: ask('pushGame'), finishRun: ask('finishRun'), currentUser: ask('currentUser'), signInAsGuest: ask('signInAsGuest') } as unknown as Cloud;
  return { cloud, asked };
}

describe('the account\'s saves, after the first screen', () => {
  it('asks nothing of the saves until the door opens, then each as it was asked, in order; signing in never waits', async () => {
    const door = firstScreenDoor(() => undefined);
    const { cloud, asked } = noting();
    const held = heldSaves(cloud, door.wait, async () => undefined);
    const user = held.currentUser();
    const runs = held.listRuns();
    const finished = held.finishRun('life-1');
    await user;
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(asked).toEqual(['currentUser()']);
    door.open();
    expect(await runs).toEqual([]);
    expect(await finished).toBe('done');
    expect(asked).toEqual(['currentUser()', 'listRuns()', 'finishRun(life-1)']);
    // Open, it stays open: what comes later waits only for the thread to be free.
    await held.pushGame({ id: 'life-2' } as never);
    expect(asked.at(-1)).toBe('pushGame([object Object])');
  });

  it('waits for a free moment of the JS thread before each ask', async () => {
    const door = firstScreenDoor(() => undefined);
    door.open();
    const { cloud, asked } = noting();
    let free: () => void = () => undefined;
    const held = heldSaves(cloud, door.wait, () => new Promise((resolve) => (free = resolve)));
    const runs = held.listRuns();
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(asked).toEqual([]);
    free();
    await runs;
    expect(asked).toEqual(['listRuns()']);
  });

  it('opens by itself a while after the saves first came to it, should the first screen never say it is drawn', async () => {
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
