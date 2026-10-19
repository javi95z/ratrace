import { CONTENT_VERSION } from '@ratrace/content';
import { ENGINE_VERSION } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { RoomRefused } from '@ratrace/core/session/room';
import { Unreachable } from '@ratrace/core/session/errors';
import { roomServer } from '@/testing/roomServer';
import { roomOf, roomsApi } from '@ratrace/online/rooms';

const HOST = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const versions = { engine: ENGINE_VERSION, content: CONTENT_VERSION };
const ROOM = '00000000-0000-4000-8000-000000000001';

describe('the server of rooms, as the page asks it', () => {
  it('turns a room\'s clocks into milliseconds, and refuses what is not a room', () => {
    const room = roomOf({ id: ROOM, code: 'ABCDEF', host: HOST, lifeId: 'nurse', engineVersion: '1', contentVersion: '1', seconds: 90, status: 'playing', round: 2, rounds: 20, deadline: '2026-10-16T10:01:30.000Z', now: '2026-10-16T10:00:00.000Z', members: [{ userId: HOST, me: true, standing: { score: '7' } }] });
    expect(room).toMatchObject({ deadline: Date.parse('2026-10-16T10:01:30.000Z'), now: Date.parse('2026-10-16T10:00:00.000Z'), members: [{ userId: HOST, me: true, host: false, standing: { score: 7, escaped: false } }] });
    expect(roomOf({ id: ROOM, code: 'ABCDEF', status: 'dancing', round: 0, seconds: 90, members: [], now: '2026-10-16T10:00:00.000Z' })).toBeNull();
    expect(roomOf({ id: ROOM, code: 'ABCDEF', status: 'open', round: 0, seconds: 90, members: [{}], now: '2026-10-16T10:00:00.000Z' })).toBeNull();
    expect(roomOf({ id: ROOM, code: 'ABCDEF', status: 'open', round: 0, seconds: 90, members: [], now: 'yesterday' })).toBeNull();
  });

  it('says no in the server\'s own word, with the room in the way when there is one', async () => {
    const server = roomServer();
    const api = server.link(HOST).api;
    const room = await api.open('nurse', 90, versions);
    await expect(api.open('nurse', 90, versions)).rejects.toEqual(new RoomRefused('in-a-room', room.id));
    await expect(server.link(B).api.join('ZZZZZZ', versions)).rejects.toMatchObject({ word: 'unknown-room' });
    await expect(server.link(B).api.join(room.code, { engine: '0.0.1', content: versions.content })).rejects.toMatchObject({ word: 'other-version' });
    await expect(api.start(room.id)).rejects.toMatchObject({ word: 'alone' });
  });

  it('answers gone for a room the player is not in, and moved for a step that is not where the page thinks', async () => {
    const server = roomServer();
    const host = server.link(HOST).api;
    const room = await host.open('nurse', 90, versions);
    await server.link(B).api.join(room.code, versions);
    await host.start(room.id);
    const stranger = server.link('cccccccc-cccc-4ccc-8ccc-cccccccccccc').api;
    expect(await stranger.state(room.id)).toBe('gone');
    expect(await stranger.view(room.id)).toBe('gone');
    expect(await stranger.leave(room.id)).toBeNull();
    expect(await host.card(room.id, 99, 0)).toBe('moved');
    expect(await host.submit(room.id, 99, [])).toBe('moved');
    const life = await host.view(room.id);
    if (life === 'gone') throw new Error('the host has no life in the room');
    expect(life).toMatchObject({ lifeId: 'nurse', step: 0, run: null });
    const step = await host.card(room.id, 0, 0);
    expect(step).toMatchObject({ step: 1, world: null, run: null });
  });

  it('takes no answer, a busy server and a limit reached for something worth asking again', async () => {
    for (const fail of [async () => { throw new TypeError('Failed to fetch'); }, async () => ({ status: 429, body: { error: 'too-many' } }), async () => ({ status: 503, body: null }), async () => ({ status: 401, body: null })]) {
      const api = roomsApi(fail);
      await expect(api.mine()).rejects.toBeInstanceOf(Unreachable);
      await expect(api.state(ROOM)).rejects.toBeInstanceOf(Unreachable);
      await expect(api.card(ROOM, 0, 0)).rejects.toBeInstanceOf(Unreachable);
    }
    // An answer that is not what it says it is is not trusted either.
    await expect(roomsApi(async () => ({ status: 200, body: { room: { id: 1 } } })).state(ROOM)).rejects.toBeInstanceOf(Unreachable);
    await expect(roomsApi(async () => ({ status: 200, body: { step: 'one' } })).card(ROOM, 0, 0)).rejects.toBeInstanceOf(Unreachable);
  });
});
