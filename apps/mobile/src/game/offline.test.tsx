// @vitest-environment jsdom
import { content, CONTENT_VERSION, lives } from '@ratrace/content';
import { createRoomStore } from '@ratrace/core/game/room';
import { MemoryStore } from '@ratrace/core/session/memory';
import { ENGINE_VERSION } from '@ratrace/engine';
import { cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, expect, test } from 'vitest';
import { GameProvider, NO_ROOM, useAccountSaves, useCanSignIn, useCommunity, useInRoom, useRanking, useRoom, useTrack } from './context';
import { memoryServices } from '../testing/render';

afterEach(cleanup);

/** The hooks as a screen has them: inside the game, with nobody signed in, because the phone has no account to sign in to. */
const inGame = ({ children }: { children: ReactNode }) => <GameProvider services={memoryServices()}>{children}</GameProvider>;
const hook = <T,>(use: () => T) => renderHook(use, { wrapper: inGame }).result.current;

test('a life on the phone is never ranked: there is no account to rank it for', () => {
  expect(hook(useRanking)).toBe('no');
});

test('there is no way to sign in until the phone has accounts: nothing may tell a player to', () => {
  expect(hook(useCanSignIn)).toBe(false);
});

test('there are no other players to ask', () => {
  expect(hook(useCommunity)).toBeNull();
});

test('a life is never a life in a room', () => {
  expect(hook(useInRoom)).toBe(false);
});

test('the room is no room: whatever a screen reads of it, it reads of that', () => {
  expect(hook(() => useRoom((s) => s))).toBe(NO_ROOM);
  expect(hook(() => useRoom((s) => s.status))).toBe('unavailable');
  expect(hook(() => useRoom((s) => s.room?.members))).toBeUndefined();
  expect(hook(() => useRoom((s) => s.game))).toBeNull();
  expect(hook(() => useRoom((s) => s.busy))).toBe(false);
  expect(hook(() => useRoom((s) => s.heard))).toEqual([]);
});

test('the room of no room is the one the web\'s room store holds with nobody signed in', async () => {
  const rooms = createRoomStore({ link: () => null, store: new MemoryStore(), content, lives, versions: { engine: ENGINE_VERSION, content: CONTENT_VERSION } });
  await rooms.getState().boot();
  const held = Object.fromEntries(Object.entries(rooms.getState()).filter(([, value]) => typeof value !== 'function'));
  expect(NO_ROOM).toEqual(held);
});

test('nothing is saved to an account, and there is no other life waiting in one', async () => {
  const saves = hook(useAccountSaves);
  expect(saves.status).toBe('off');
  expect(saves.offer).toBeNull();
  // Taking an offer that is not there is taking nothing; declining it is done at once.
  await expect(saves.takeOffer()).resolves.toBe(false);
  await expect(saves.declineOffer()).resolves.toBeUndefined();
});

test('counting what is played counts nothing, whatever it is told', () => {
  const track = hook(useTrack);
  expect(track({ name: 'life_start', mode: 'solo' })).toBeUndefined();
  expect(track({ name: 'share', what: 'card' })).toBeUndefined();
});

test('the answers are the same from one drawing to the next, so that a screen is not drawn again for them', () => {
  const first = renderHook(() => ({ saves: useAccountSaves(), track: useTrack(), room: useRoom((s) => s) }), { wrapper: inGame });
  const before = first.result.current;
  first.rerender();
  expect(first.result.current.saves).toBe(before.saves);
  expect(first.result.current.track).toBe(before.track);
  expect(first.result.current.room).toBe(before.room);
});
