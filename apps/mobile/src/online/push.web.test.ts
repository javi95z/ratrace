// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import type { Account, Community } from '@ratrace/online/types';
import { describe, expect, it, vi } from 'vitest';
import { phonePush } from './push.web';
import type { PushNoted } from './push.web';

/*
 * The game's notices on the web (push.web.ts): none yet (the browser's own come in plan 5b). The switch is not shown, nothing is asked of the player
 * or of the account, and Expo's library is never named.
 */

/** A file of the app, as written: its name passed loose, since Vite takes a literal `new URL('./x', import.meta.url)` for an asset. */
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('the notices on the web', () => {
  it('are not to be had: nothing to switch on, nothing asked, nothing told to the account', async () => {
    const note = { now: null as PushNoted | null, read: vi.fn(() => note.now), write: vi.fn((noted: PushNoted) => void (note.now = noted)) };
    const push = phonePush(note);
    const community = { notifyMe: vi.fn(), stopNotifying: vi.fn() } as unknown as Community;
    expect(push.available()).toBe(false);
    await expect(push.isOn()).resolves.toBe(false);
    await expect(push.pushOn()).resolves.toBe('unavailable');
    await expect(push.register(community, 'en')).resolves.toBe(false);
    await expect(push.target()).resolves.toBeNull();
    await expect(push.release(community)).resolves.toBeUndefined();
    push.resume();
    push.follow({} as Account, () => community, 'en')();
    push.onTap(() => undefined)();
    // Off it is, with nothing for the account to forget.
    await expect(push.pushOff(community)).resolves.toBe(true);
    expect(community.notifyMe).not.toHaveBeenCalled();
    expect(community.stopNotifying).not.toHaveBeenCalled();
    expect(note.write).not.toHaveBeenCalled();
  });

  it('never name Expo\'s library', () => {
    expect(read('./push.web.ts')).not.toMatch(/expo-notifications|expo-device|expo-constants/);
  });
});
