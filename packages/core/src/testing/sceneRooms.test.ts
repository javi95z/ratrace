import { content, CONTENT_VERSION, lives } from '@ratrace/content';
import { ENGINE_VERSION } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { runRoomScene, SCENE_ROOM_CODE, SCENE_STARTS_IN_MS, sceneGameOpened, sceneInvite, sceneRooms } from './sceneRooms';
import { createRoomStore } from '../game/room';
import { memoryDevice } from '../session/fixed';
import { sceneMember } from './sceneCloud';
import { SCENE_NOW, SCENES, sceneStore } from './scenes';

const VERSIONS = { engine: ENGINE_VERSION, content: CONTENT_VERSION };
const ROOMS = SCENES.filter((scene) => scene.name.startsWith('room-')).map((scene) => scene.name);

describe('the games with others of a scene', () => {
  it('are there for the rooms\' scenes only, each played by the member signed in for it: every other scene has nobody to play with', () => {
    expect(ROOMS).toEqual(['room-door', 'room-lobby-friends', 'room-lobby-public', 'room-join-code', 'room-playing', 'room-loans', 'room-resolved', 'room-end', 'room-history']);
    for (const name of ROOMS) {
      expect(sceneRooms(name), name).not.toBeNull();
      expect(sceneMember(name)?.nickname, name).toBe('Rata_Uno');
    }
    for (const { name } of SCENES.filter((scene) => !ROOMS.includes(scene.name))) expect(sceneRooms(name), name).toBeNull();
  });

  it('are on a device with no life: what the rooms show is the server\'s', async () => {
    for (const name of ROOMS) expect(await (await sceneStore(name)).loadGame(), name).toBeNull();
  });

  it('put the player at no table at the door, with two public games waiting to be played together', async () => {
    const { api } = sceneRooms('room-door')!;
    expect(await api.mine()).toBeNull();
    expect(await api.lobbies(VERSIONS)).toEqual({ live: 2, slow: 0, dropped: false });
  });

  it('give the invitation\'s code only to the scene come by one', () => {
    expect(ROOMS.map(sceneInvite)).toEqual([undefined, undefined, undefined, SCENE_ROOM_CODE, undefined, undefined, undefined, undefined, undefined]);
    expect(SCENE_ROOM_CODE).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
  });

  it('seat the player as the host of a game among friends, with one who chose a name and one who did not, on this build\'s rules', async () => {
    const room = (await sceneRooms('room-lobby-friends')!.api.mine())!;
    expect(room).toMatchObject({ status: 'open', public: false, code: SCENE_ROOM_CODE, lifeId: 'engineer', seconds: 180, startsAt: null, engineVersion: VERSIONS.engine, contentVersion: VERSIONS.content, now: SCENE_NOW });
    expect(room.members.map((m) => [m.name, m.me, m.host])).toEqual([
      ['Rata_Uno', true, true],
      ['Bea_7', false, false],
      [null, false, false],
    ]);
    expect(room.host).toBe(room.members[0].userId);
  });

  it('seat the player in a public game whose clock has a minute and thirty-five seconds to run, by the server\'s', async () => {
    const room = (await sceneRooms('room-lobby-public')!.api.mine())!;
    expect(room).toMatchObject({ status: 'open', public: true, startsAt: SCENE_NOW + SCENE_STARTS_IN_MS, now: SCENE_NOW });
    expect(SCENE_STARTS_IN_MS).toBe(95_000);
    expect(room.members.filter((m) => m.me)).toHaveLength(1);
  });

  it('answer the same every time and take nothing: whatever is pressed, the table stays as it is', async () => {
    const { api, watch } = sceneRooms('room-lobby-friends')!;
    const before = await api.mine();
    await expect(api.start('scene-room')).rejects.toThrow();
    await expect(api.leave('scene-room')).rejects.toThrow();
    await expect(api.join('ABCDEF', VERSIONS)).rejects.toThrow();
    await expect(api.quick(VERSIONS)).rejects.toThrow();
    expect(await api.mine()).toEqual(before);
    expect(await api.state('scene-room')).toEqual(before);
    expect(typeof watch('scene-room', () => undefined)).toBe('function');
  });

  it('show the player\'s life in a game in play as the server would: the engineer\'s sixth round, with the flag of a life in a room', async () => {
    const { api } = sceneRooms('room-playing')!;
    const room = (await api.mine())!;
    expect(room).toMatchObject({ status: 'playing', round: 5, rounds: content.rounds, deadline: SCENE_NOW + 150_000 });
    expect(room.members.filter((m) => m.ready).map((m) => m.name)).toEqual(['Bea_7', 'Moe_Money']);
    const life = await api.view(room.id);
    if (life === 'gone') throw new Error('no life');
    expect(life).toMatchObject({ lifeId: 'engineer', events: [], run: null });
    expect(life.view.round).toBe(5);
    expect(life.view.player.life.flags).toHaveProperty('in_room');
    expect(life.record.history).toHaveLength(6);
    // A room not played yet has no life to show.
    expect(await sceneRooms('room-lobby-friends')!.api.view('scene-room')).toBe('gone');
  });

  it('put the loans of the round on the table of its scene: one offered to the player, and the player\'s own, waiting', async () => {
    const room = (await sceneRooms('room-loans')!.api.mine())!;
    expect(room.loans.map((loan) => [loan.mine, loan.lend, loan.status])).toEqual([
      [false, false, 'open'],
      [true, true, 'open'],
    ]);
  });

  it('play the one round of room-resolved on the engine, and the room turns with it', async () => {
    const rooms = createRoomStore({ link: () => sceneRooms('room-resolved'), store: memoryDevice(), content, lives, versions: VERSIONS, schedule: () => () => undefined });
    await rooms.getState().boot();
    await runRoomScene('room-resolved', rooms);
    const life = rooms.getState().game!.getState();
    expect(life.stage).toBe('resolve');
    expect(life.view?.round).toBe(6);
    expect(rooms.getState().room?.round).toBe(6);
    expect(rooms.getState().room?.members.every((m) => !m.ready)).toBe(true);
  }, 60_000);

  it('end the game with the player first, and list the games played among the records, the latest open', async () => {
    const room = (await sceneRooms('room-end')!.api.mine())!;
    expect(room.status).toBe('finished');
    expect(room.members.find((m) => m.me)?.standing?.score).toBe(Math.max(...room.members.map((m) => m.standing?.score ?? 0)));
    const life = await sceneRooms('room-end')!.api.view(room.id);
    expect(life !== 'gone' && life.view.finished).toBe(true);
    const games = await sceneRooms('room-history')!.api.history();
    expect(games.map((game) => game.id)).toEqual(['scene-game-2', 'scene-game-1']);
    expect(sceneGameOpened('room-history')).toBe('scene-game-2');
    expect(ROOMS.filter((name) => sceneGameOpened(name) !== undefined)).toEqual(['room-history']);
  }, 60_000);
});
