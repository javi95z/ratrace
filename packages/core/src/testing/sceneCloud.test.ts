import { describe, expect, it } from 'vitest';
import { mayWear, ratLookOf } from '../game/avatar';
import { SCENE_RAT, sceneCloud, sceneMember } from './sceneCloud';
import { SCENES, sceneStore } from './scenes';

describe('the cloud of a scene', () => {
  it('is nobody signed in for a scene of the game alone', () => {
    expect(sceneCloud('home-new')).toBeNull();
    expect(sceneMember('records-three')).toBeNull();
  });

  it('is a member from the start, settled, for every scene of the player\'s own profile, and every one of them is a scene', () => {
    const players = SCENES.filter((scene) => scene.name.startsWith('player-')).map((scene) => scene.name);
    expect(players).toEqual(['player-member', 'player-editor-body', 'player-editor-wear', 'player-editor-scene', 'player-friend-code']);
    for (const name of players) {
      const cloud = sceneCloud(name);
      expect(cloud?.account.state(), name).toEqual({ kind: 'member', userId: 'u-scene', email: null });
      expect(cloud?.account.settled(), name).toBe(true);
    }
  });

  it('keeps the member\'s name, code and rat on the server, and takes a change without keeping it: a scene is a picture', async () => {
    const cloud = sceneCloud('player-member')!;
    expect(await cloud.community.me()).toEqual({ nickname: 'Rata_Uno', friendCode: 'ABCD2345', avatar: cloud.member.avatar });
    expect(ratLookOf(cloud.member.avatar, cloud.member.userId)).toEqual(SCENE_RAT);
    expect(await cloud.community.rename()).toBe('ok');
    expect(await cloud.community.setAvatar()).toBe(true);
    expect(await cloud.community.me()).toEqual({ nickname: 'Rata_Uno', friendCode: 'ABCD2345', avatar: cloud.member.avatar });
    // A rat anyone may wear, whatever their rank and badges: the scene's player wears nothing they could not.
    for (const layer of ['body', 'face', 'outfit', 'hat', 'eyes', 'backdrop'] as const) expect(mayWear(layer, SCENE_RAT[layer] as string, {}, 'sewer'), layer).toBe(true);
  });

  it('plays the player\'s scenes on the device of three lives lived: their figures, rank and badges', async () => {
    const store = await sceneStore('player-member');
    expect(await store.listRuns()).toHaveLength(3);
    const profile = await store.loadProfile();
    expect(profile.rank.points).toBeGreaterThan(0);
    expect(Object.keys(profile.badges).length).toBeGreaterThan(0);
  });
});
