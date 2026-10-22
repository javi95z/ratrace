import { CONTENT_VERSION } from '@ratrace/content';
import { ENGINE_VERSION } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { SCENE_ROOM_CODE, SCENE_STARTS_IN_MS, sceneInvite, sceneRooms } from './sceneRooms';
import { sceneMember } from './sceneCloud';
import { SCENE_NOW, SCENES, sceneStore } from './scenes';

const VERSIONS = { engine: ENGINE_VERSION, content: CONTENT_VERSION };
const ROOMS = SCENES.filter((scene) => scene.name.startsWith('room-')).map((scene) => scene.name);

describe('the games with others of a scene', () => {
  it('are there for the rooms\' scenes only, each played by the member signed in for it: every other scene has nobody to play with', () => {
    expect(ROOMS).toEqual(['room-door', 'room-lobby-friends', 'room-lobby-public', 'room-join-code']);
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
    expect(ROOMS.map(sceneInvite)).toEqual([undefined, undefined, undefined, SCENE_ROOM_CODE]);
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
});
