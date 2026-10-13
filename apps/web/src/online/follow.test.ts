import { describe, expect, it } from 'vitest';
import { follow } from './follow';
import type { AccountState } from './types';

/** An account, a mirror and a page that the test moves by hand. */
function setup(initial: AccountState = { kind: 'offline' }) {
  let state = initial;
  const watching = new Set<() => void>();
  const page = { online: new Set<() => void>(), shown: new Set<() => void>(), at: 0 };
  const asked: string[] = [];
  const stop = follow(
    {
      state: () => state,
      subscribe: (listener) => {
        watching.add(listener);
        return () => watching.delete(listener);
      },
    },
    { sync: async () => void asked.push('sync'), accountChanged: async () => void asked.push('account changed') },
    {
      onOnline: (listener) => (page.online.add(listener), () => page.online.delete(listener)),
      onShown: (listener) => (page.shown.add(listener), () => page.shown.delete(listener)),
      now: () => page.at,
    },
  );
  const become = (next: AccountState) => {
    state = next;
    for (const listener of watching) listener();
  };
  const fire = (set: Set<() => void>) => [...set].forEach((listener) => listener());
  return { asked, become, page, fire, stop, watching };
}
const guest = (userId: string, notice: 'taken' | null = null): AccountState => ({ kind: 'guest', userId, notice });

describe('keeping the account\'s copy in step with the page', () => {
  it('does nothing while nobody is signed in', () => {
    const { asked } = setup();
    expect(asked).toEqual([]);
  });

  it('reads the account as soon as someone is signed in, and anew when it is someone else', () => {
    const { asked, become } = setup();
    become(guest('u-1'));
    expect(asked).toEqual(['account changed']);
    // The same player with something new to be told is not someone else.
    become(guest('u-1', 'taken'));
    become({ kind: 'member', userId: 'u-1', email: 'ana@example.com' });
    expect(asked).toEqual(['account changed']);
    become({ kind: 'member', userId: 'u-2', email: 'ana@example.com' });
    become({ kind: 'offline' });
    expect(asked).toEqual(['account changed', 'account changed', 'account changed']);
  });

  it('reads the account of a player who was already signed in when the page opened', () => {
    const { asked } = setup(guest('u-1'));
    expect(asked).toEqual(['account changed']);
  });

  it('syncs when the connection comes back', () => {
    const { asked, fire, page } = setup(guest('u-1'));
    asked.length = 0;
    fire(page.online);
    fire(page.online);
    expect(asked).toEqual(['sync', 'sync']);
  });

  it('syncs when the page comes back to the front, which is how a life played elsewhere is found, but not every time', () => {
    const { asked, fire, page } = setup(guest('u-1'));
    asked.length = 0;
    page.at = 30_000;
    fire(page.shown);
    expect(asked).toEqual([]);
    page.at = 60_000;
    fire(page.shown);
    page.at = 90_000;
    fire(page.shown);
    expect(asked).toEqual(['sync']);
    page.at = 130_000;
    fire(page.shown);
    expect(asked).toEqual(['sync', 'sync']);
  });

  it('lets go of everything when told to stop', () => {
    const { stop, watching, page } = setup(guest('u-1'));
    stop();
    expect([watching.size, page.online.size, page.shown.size]).toEqual([0, 0, 0]);
  });
});
