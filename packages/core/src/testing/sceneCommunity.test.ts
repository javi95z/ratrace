import { lives, weekOf } from '@ratrace/content';
import { describe, expect, it } from 'vitest';
import { rankingsOpening, sceneCommunity } from './sceneCommunity';
import { SCENE_NOW, SCENES, sceneStore } from './scenes';

const DAY = 86_400_000;
const RANKINGS = SCENES.filter((scene) => scene.name.startsWith('rankings-')).map((scene) => scene.name);

describe('the other players of a scene of the rankings', () => {
  it('are there for the rankings\' scenes only: every other scene asks nobody', () => {
    expect(RANKINGS).toEqual(['rankings-all', 'rankings-week', 'rankings-friends', 'rankings-challenge', 'rankings-nickname']);
    for (const name of RANKINGS) expect(sceneCommunity(name), name).not.toBeNull();
    for (const { name } of SCENES.filter((scene) => !RANKINGS.includes(scene.name))) expect(sceneCommunity(name), name).toBeNull();
  });

  it('open each scene on the tab its name says, and the name being changed on all time\'s', () => {
    expect(RANKINGS.map(rankingsOpening)).toEqual([
      { tab: 'all', naming: false },
      { tab: 'week', naming: false },
      { tab: 'friends', naming: false },
      { tab: 'challenge', naming: false },
      { tab: 'all', naming: true },
    ]);
    expect(rankingsOpening('records-three')).toBeNull();
    // The name's form is in the player's panel, as the web's is: no sheet. The scene's name is what opens it.
    expect(SCENES.find((scene) => scene.name === 'rankings-nickname')?.sheet).toBeUndefined();
  });

  it('are on a device with no life: what the rankings show is the cloud\'s', async () => {
    for (const name of RANKINGS) expect(await (await sceneStore(name)).loadGame(), name).toBeNull();
  });

  it('answer the same every time, whatever is asked of them: nothing a scene does changes what it shows', async () => {
    const community = sceneCommunity('rankings-friends')!;
    const before = await community.ranking({ period: 'all', friends: true, lifeId: null });
    expect(await community.rename('Other_Name')).toBe('failed');
    expect(await community.befriend('ABCD2345')).toBe('failed');
    expect(await community.unfriend('b0b00000-0000-4000-8000-000000000002')).toBe(false);
    expect(await community.ranking({ period: 'all', friends: true, lifeId: null })).toEqual(before);
    expect(await sceneCommunity('rankings-friends')!.friends()).toEqual(await community.friends());
    expect(await community.me()).toEqual({ nickname: 'Rata_Uno', friendCode: 'RAT7K2QX', avatar: 'rat_gold' });
  });

  it('rank each player once, best first, the scene\'s player among them, each life one the game has', async () => {
    const community = sceneCommunity('rankings-all')!;
    for (const query of [{ period: 'all', friends: false }, { period: 'week', friends: false }, { period: 'all', friends: true }] as const) {
      const rows = (await community.ranking({ ...query, lifeId: null }))!;
      expect(rows.map((row) => row.place), JSON.stringify(query)).toEqual(rows.map((_, i) => i + 1));
      expect(new Set(rows.map((row) => row.userId)).size).toBe(rows.length);
      expect([...rows].sort((a, b) => b.score - a.score)).toEqual(rows);
      expect(rows.filter((row) => row.mine)).toHaveLength(1);
      for (const row of rows) expect(lives.map((life) => life.id)).toContain(row.lifeId);
    }
    // The week's lives ended in the scene's own week.
    for (const row of (await community.ranking({ period: 'week', friends: false, lifeId: null }))!) expect(weekOf(row.finishedAt)).toBe(weekOf(SCENE_NOW));
    // One starting life: its lines alone.
    expect((await community.ranking({ period: 'all', friends: false, lifeId: 'nurse' }))!.map((row) => row.lifeId)).toEqual(['nurse', 'nurse']);
  });

  it('give the week\'s challenge forty entrants, the player fifth, just outside its best tenth', async () => {
    const board = (await sceneCommunity('rankings-challenge')!.challengeRanking(weekOf(SCENE_NOW)))!;
    expect(board.entrants).toBe(40);
    expect(board.rows.find((row) => row.mine)?.place).toBe(5);
    for (const row of board.rows) expect(row.finishedAt).toBeGreaterThan(SCENE_NOW - 4 * DAY);
  });
});
