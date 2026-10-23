import { CONTENT_VERSION } from '@ratrace/content';
import { ENGINE_VERSION } from '@ratrace/engine';
import { connectSupabase } from '@ratrace/online/connect';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { FAKE_KEY, fakeCloud } from './fakeCloud';

/*
 * The fake project of the device checks, reached through the game's own client (`@ratrace/online/connect`, supabase-js and its Realtime) as the
 * phone reaches it: if the client changes what it asks, the checks on the simulator would fail in ways hard to read; here they fail by name.
 */

const versions = { engine: ENGINE_VERSION, content: CONTENT_VERSION };

/** A phone's storage of the session: in memory. */
function memory() {
  const kept = new Map<string, string>();
  return { getItem: async (key: string) => kept.get(key) ?? null, setItem: async (key: string, value: string) => void kept.set(key, value), removeItem: async (key: string) => void kept.delete(key) };
}

let cloud: ReturnType<typeof fakeCloud>;
let url: string;
beforeEach(async () => {
  cloud = fakeCloud();
  url = `http://127.0.0.1:${await cloud.listen(0)}`;
});
afterEach(async () => {
  await cloud.close();
});

/** What a browser does with the fake Google page: opens it, presses the choice, and comes back with the address the app is sent to. */
const browser = (choice: 'linked' | 'taken' | 'denied') => async (address: string) => {
  const page = await (await fetch(address)).text();
  const link = page.match(new RegExp(`href="([^"]*as=${choice})"`))?.[1];
  if (!link) return null;
  const back = await fetch(new URL(link.replace(/&amp;/g, '&'), address), { redirect: 'manual' });
  return back.headers.get('location');
};

test('a guest is made, kept on the phone, and the same guest comes back on the next start', async () => {
  const storage = memory();
  const first = await connectSupabase(url, FAKE_KEY, { storage, autoRefresh: false });
  const guest = await first.signInAsGuest();
  if (guest === null) throw new Error('no guest was made');
  expect(guest.is_anonymous).toBe(true);
  const again = await connectSupabase(url, FAKE_KEY, { storage, autoRefresh: false });
  expect((await again.currentUser())?.id).toBe(guest.id);
  expect(cloud.counts.guests).toBe(1);
  await again.ensureProfile(guest.id, 'en');
  expect((await again.community.me())?.friendCode).toMatch(/^[A-Z2-9]{8}$/);
});

test('Google through the fake page: kept (the same account, a member now), already a player (refused, then signed in as that player), refused', async () => {
  const cloudOfPhone = await connectSupabase(url, FAKE_KEY, { storage: memory(), autoRefresh: false });
  const guest = await cloudOfPhone.signInAsGuest();
  if (guest === null) throw new Error('no guest was made');
  expect(await cloudOfPhone.linkGoogle('theratrace://auth', browser('denied'))).toBe(false);
  expect(await cloudOfPhone.linkGoogle('theratrace://auth', browser('taken'))).toBe(false);
  expect(await cloudOfPhone.signInWithGoogle('theratrace://auth', browser('taken'))).toBe(true);
  expect((await cloudOfPhone.currentUser())?.id).toBe(cloud.member.id);

  const other = await connectSupabase(url, FAKE_KEY, { storage: memory(), autoRefresh: false });
  const second = await other.signInAsGuest();
  if (second === null) throw new Error('no guest was made');
  expect(await other.linkGoogle('theratrace://auth', browser('linked'))).toBe(true);
  const kept = await other.currentUser();
  expect(kept).toMatchObject({ id: second.id, is_anonymous: false });
  expect(guest.id).not.toBe(second.id);
});

test('a room: opened by the phone, joined by another player, and the phone told by Realtime', async () => {
  const phone = await connectSupabase(url, FAKE_KEY, { storage: memory(), autoRefresh: false });
  await phone.signInAsGuest();
  const room = await phone.rooms.api.open('engineer', 90, versions);
  let changes = 0;
  const stop = phone.rooms.watch(room.id, () => (changes += 1));
  // Subscribed: the channel asks once as it opens (the system's word).
  await expect.poll(() => changes, { timeout: 5000 }).toBe(1);
  const joined = await cloud.askRooms(cloud.mia.id, { action: 'join', code: room.code, engineVersion: versions.engine, contentVersion: versions.content });
  expect(joined.status).toBe(200);
  await expect.poll(() => changes, { timeout: 5000 }).toBeGreaterThanOrEqual(2);
  const seen = await phone.rooms.api.state(room.id);
  expect(seen !== 'gone' && seen.members.length).toBe(2);
  stop();
});

test('the friends of a guest given many: listed through the friends function, the latest first', async () => {
  const many = fakeCloud({ friends: { friends: 200, incoming: 50, outgoing: 50 } });
  const at = `http://127.0.0.1:${await many.listen(0)}`;
  try {
    const phone = await connectSupabase(at, FAKE_KEY, { storage: memory(), autoRefresh: false });
    await phone.signInAsGuest();
    const list = await phone.community.friends();
    expect([list?.friends.length, list?.incoming.length, list?.outgoing.length]).toEqual([200, 50, 50]);
    const ranking = await phone.community.ranking({ period: 'all', lifeId: null, friends: true });
    expect(ranking?.length).toBe(50);
  } finally {
    await many.close();
  }
});

test('a finished life sent and finished, then forgotten by the account (`/control/unsent`): the phone sends it again at its next start', async () => {
  const phone = await connectSupabase(url, FAKE_KEY, { storage: memory(), autoRefresh: false });
  await phone.signInAsGuest();
  const life = { id: 'life-1', lifeId: 'nurse', engineVersion: versions.engine, contentVersion: versions.content, seed: 's', round: 40, log: [], stateHash: '' };
  expect(await phone.pushGame(life)).toBe('saved');
  expect(await phone.finishRun('life-1')).toBe('done');
  expect((await phone.listRuns()).map((run) => run.id)).toEqual(['life-1']);
  const forget = (playing: boolean) => fetch(`${url}/control/unsent`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ playing }) }).then((r) => r.json());
  // Forgotten whole: no run, no game.
  expect(await forget(false)).toEqual({ forgotten: 1 });
  expect(await phone.listRuns()).toEqual([]);
  expect(await phone.playingGames()).toEqual([]);
  // Sent again and forgotten with its game left being played (a finish that failed): the account offers it as a life in progress.
  await phone.pushGame(life);
  await phone.finishRun('life-1');
  expect(await forget(true)).toEqual({ forgotten: 1 });
  expect((await phone.playingGames()).map((game) => game.id)).toEqual(['life-1']);
});
