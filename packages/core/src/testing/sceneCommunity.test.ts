import { lives, weekOf } from '@ratrace/content';
import { describe, expect, it } from 'vitest';
import { rankingsOpening, sceneCommunity } from './sceneCommunity';
import { SCENE_NOW, sceneCloud, SCENES, sceneStore } from './scenes';

const DAY = 86_400_000;
const RANKINGS = SCENES.filter((scene) => scene.name.startsWith('rankings-')).map((scene) => scene.name);
/** The scenes of the game online beside the game alone: the front door, the week's challenge, a life's end and a new life, for a member. */
const ONLINE = ['home-member', 'challenge-attempt', 'challenge-board', 'end-standing', 'new-ranked'];

describe('the other players of a scene of the rankings', () => {
  it('are there for the rankings\' scenes and those of the game online only: every other scene asks nobody', () => {
    expect(RANKINGS).toEqual(['rankings-all', 'rankings-week', 'rankings-friends', 'rankings-challenge', 'rankings-nickname']);
    for (const name of [...RANKINGS, ...ONLINE]) expect(sceneCommunity(name), name).not.toBeNull();
    for (const { name } of SCENES.filter((scene) => !RANKINGS.includes(scene.name) && !ONLINE.includes(scene.name))) expect(sceneCommunity(name), name).toBeNull();
    for (const name of ONLINE) expect(SCENES.map((scene) => scene.name), name).toContain(name);
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

describe('the other players of a scene of the game online', () => {
  it('tell the front door today\'s attempt is still to play, and the friend request waiting', async () => {
    const community = sceneCommunity('home-member')!;
    expect(await community.challengeEntry(weekOf(SCENE_NOW))).toEqual({ entered: false, score: null });
    expect((await community.friends())!.incoming).toHaveLength(1);
  });

  it('tell the challenge\'s page the attempt is still to play with the week\'s best so far, or played today, the best the ranking shows', async () => {
    const mine = (await sceneCommunity('rankings-challenge')!.challengeRanking(weekOf(SCENE_NOW)))!.rows.find((row) => row.mine)!;
    expect(await sceneCommunity('challenge-attempt')!.challengeEntry(weekOf(SCENE_NOW))).toEqual({ entered: false, score: mine.score });
    expect(await sceneCommunity('challenge-board')!.challengeEntry(weekOf(SCENE_NOW))).toEqual({ entered: true, score: mine.score });
    // The rankings' player has played today's too.
    expect(await sceneCommunity('rankings-all')!.challengeEntry(weekOf(SCENE_NOW))).toEqual({ entered: true, score: mine.score });
  });

  it('tell the end of a life where it stands among enough others to say, and nobody else where a score stands', async () => {
    expect(await sceneCommunity('end-standing')!.compare({ lifeId: 'engineer', score: 1 })).toEqual({ below: 31, total: 40 });
    for (const name of [...RANKINGS, 'home-member', 'new-ranked']) expect(await sceneCommunity(name)!.compare({ lifeId: 'engineer', score: 1 }), name).toBeNull();
  });

  it('are told by a member, signed in from the start with nothing waiting in the account: the scene\'s cloud', async () => {
    for (const name of ONLINE) {
      const cloud = sceneCloud(name);
      expect(cloud.account?.state().kind, name).toBe('member');
      expect(cloud.saves?.offer(), name).toBeNull();
    }
  });

  it('are on the device the scene says: a life in progress at the door, an end, and nothing on the pages that begin one', async () => {
    expect(((await (await sceneStore('home-member')).loadGame()) as { lifeId: string }).lifeId).toBe('nurse');
    expect(((await (await sceneStore('end-standing')).loadGame()) as { lifeId: string }).lifeId).toBe('engineer');
    for (const name of ['challenge-attempt', 'challenge-board', 'new-ranked']) expect(await (await sceneStore(name)).loadGame(), name).toBeNull();
  });
});
