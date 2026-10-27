import { bots, content, CONTENT_VERSION } from '@ratrace/content';
import { ENGINE_VERSION } from '@ratrace/engine';
import type { GameView } from '@ratrace/engine';
import { fixedSessions } from '../session/fixed';
import type { RoomGameOver, RoomLife, RoomLoan, RoomMember, RoomsApi, RoomsLink, RoomStanding, RoomState } from '../session/room';
import type { GameSession, SavedGame } from '../session/types';
import { sceneMember } from './sceneCloud';
import { SCENE_NOW, sceneStore } from './scenes';
import type { SceneGame } from './scenes';

/*
 * The games with others of a scene, the same on both clients (the web's page at `/kit/scene`, the app's `/scene`): the room the scene's player is
 * in, or none, how many public games are looking for players, the player's life in the room, and the games they played to the end. Both registries
 * give their game a `rooms` of it (`sceneRooms`) in place of the server, so a shot of the web and one of the phone show the same table. Nothing is
 * asked of a network. Whatever is pressed is refused, and the room is the same each time it is asked for, but for the one round a scene plays
 * (`room-resolved`, `runRoomScene`): the engine plays it on the scene's life, as the server would. A picture.
 */

/** A room's code, as the server makes them: six of the letters and digits that cannot be read as one another. */
export const SCENE_ROOM_CODE = 'K7Q2XM';

/** How long the scene's public lobby has to wait before it starts by itself, by the server's clock: a minute and thirty-five seconds. */
export const SCENE_STARTS_IN_MS = 95_000;

/** Someone at the table: a player who chose a name, one who did not (called by their id), dressed or not. */
const seat = (userId: string, name: string | null, over: Partial<RoomMember> = {}): RoomMember => ({
  userId,
  name,
  me: false,
  host: false,
  bot: null,
  followed: false,
  friend: false,
  ready: false,
  left: false,
  standing: null,
  avatar: null,
  shout: null,
  ...over,
});

/** The others at the scenes' tables: one with a name and a rat of her own, one with neither (`Rat C3D4`), and one more who named himself. */
const BEA = seat('b0a70000-0000-4000-8000-000000000002', 'Bea_7', { avatar: 'rat_teal' });
const NAMELESS = seat('c3d40000-0000-4000-8000-000000000003', null);
const MOE = seat('a0e00000-0000-4000-8000-000000000004', 'Moe_Money', { avatar: 'rat_coral' });

/** How a member stood when the last round turned: their score and net worth, and their score and place the round before (none after the first). */
const stood = (score: number, netWorth: number, before: [number, number] | null, over: Partial<RoomStanding> = {}): RoomStanding => ({
  score,
  netWorth,
  status: 0,
  escaped: false,
  bankruptcies: 0,
  before: before === null ? null : { score: before[0], place: before[1] },
  cityId: 'london',
  career: { id: 'tech', level: 2 },
  ...over,
});

/** A room as the server answers it, on this build's rules, its clock at the scene's own day. */
const room = (over: Partial<RoomState> & Pick<RoomState, 'members'>): RoomState => ({
  id: 'scene-room',
  code: SCENE_ROOM_CODE,
  host: over.members[0].userId,
  lifeId: 'engineer',
  engineVersion: ENGINE_VERSION,
  contentVersion: CONTENT_VERSION,
  seconds: 180,
  status: 'open',
  round: 0,
  rounds: 15,
  deadline: null,
  now: SCENE_NOW,
  rematch: null,
  rematchOf: false,
  public: false,
  startsAt: null,
  loans: [],
  ...over,
});

/** What each scene of the rooms has: the room its player sits in, if any, and the public games waiting at each pace. */
interface Plan {
  room(me: RoomMember): RoomState | null;
  lobbies: { live: number; slow: number };
  /**
   * The player's life in the room, as the server shows it: the life of another scene (`sceneStore`), which the engine played the scene's way, at its
   * round and stage. None for a room not played yet.
   */
  life?: string;
  /** The room once the player's round is played, for the one scene that plays one (`room-resolved`): what the server answers the round with. */
  after?(me: RoomMember): RoomState;
  /** The games over the player was in, the latest first. */
  history?: RoomGameOver[];
}

/** The scenes' game in play: the engineer's sixth round (its fifth by the server's count), two minutes and a half of it left. */
const PLAYED = { status: 'playing' as const, round: 5, rounds: content.rounds, deadline: SCENE_NOW + 150_000 };
/** How the table stood after the fifth round: Bea took the lead from the player, Moe close behind, the nameless one far back. */
const AFTER_FIVE = (me: RoomMember): RoomMember[] => [
  { ...me, standing: stood(612, 4_150_000, [580, 1], { cityId: 'tokyo' }) },
  { ...BEA, ready: true, standing: stood(655, 4_420_000, [570, 2], { cityId: 'madrid', career: { id: 'healthcare', level: 2 } }) },
  { ...NAMELESS, standing: stood(298, 1_870_000, [281, 4], { cityId: 'bangkok', career: null }) },
  { ...MOE, ready: true, standing: stood(590, 3_980_000, [560, 3], { cityId: 'new_york', career: { id: 'finance', level: 3 } }) },
];
/** The offers of the round: Moe offers the player a loan, and the player offers Bea one, still waiting for her answer. */
const LOANS: RoomLoan[] = [
  { id: 'scene-loan-moe', round: 5, lend: false, other: MOE.userId, mine: false, amount: 1_000_000, rateBp: 500, rounds: 3, status: 'open' },
  { id: 'scene-loan-bea', round: 5, lend: true, other: BEA.userId, mine: true, amount: 500_000, rateBp: 300, rounds: 2, status: 'open' },
];
/** How the game ended: the player first, Bea second, Moe third, the nameless one gave up halfway. */
const OVER = (me: RoomMember): RoomMember[] => [
  { ...me, standing: stood(1_284, 9_870_000, [1_190, 1], { escaped: true, cityId: 'tokyo' }) },
  { ...BEA, standing: stood(1_107, 8_220_000, [1_150, 2], { cityId: 'madrid', career: { id: 'healthcare', level: 3 } }) },
  { ...MOE, standing: stood(860, 6_010_000, [842, 3], { cityId: 'new_york', career: { id: 'finance', level: 4 } }) },
  { ...NAMELESS, left: true, standing: null },
];
/** A game over, as the player's history keeps it: everyone in their final order, those who left last. */
const gameOver = (id: string, over: Partial<RoomGameOver> & Pick<RoomGameOver, 'players'>): RoomGameOver => ({ id, lifeId: 'engineer', seconds: 180, playedAt: SCENE_NOW - 3 * 86_400_000, rematchOf: false, public: false, gameId: null, ...over });
const player = (member: RoomMember, score: number | null, over: Partial<RoomGameOver['players'][number]> = {}): RoomGameOver['players'][number] => ({
  name: member.name,
  tag: member.userId.slice(0, 4).toUpperCase(),
  userId: member.userId,
  avatar: member.avatar,
  bot: member.bot,
  me: member.me,
  score,
  left: false,
  netWorth: score === null ? null : score * 7_000,
  cityId: 'london',
  career: { id: 'tech', level: 3 },
  ...over,
});

const PLANS: Readonly<Record<string, Plan>> = {
  // The way in: two public games played together are waiting, none of a round a day.
  'room-door': { room: () => null, lobbies: { live: 2, slow: 0 } },
  // Come by an invitation (`sceneInvite`): the code it carries, and the one button that joins it.
  'room-join-code': { room: () => null, lobbies: { live: 0, slow: 0 } },
  // A game among friends the player opened: three at the table, an engineer's life, three minutes a round.
  'room-lobby-friends': { room: (me) => room({ members: [{ ...me, host: true }, BEA, NAMELESS] }), lobbies: { live: 0, slow: 0 } },
  // A public game the player took a seat in, played together, its clock running: two at the table, and anyone may start it.
  'room-lobby-public': {
    room: (me) => room({ id: 'scene-public', code: 'P4N7WQ', lifeId: 'nurse', public: true, startsAt: SCENE_NOW + SCENE_STARTS_IN_MS, members: [{ ...MOE, host: true }, me] }),
    lobbies: { live: 0, slow: 0 },
  },
  // The game among friends in play, at the news of the sixth round: the room's bar (Bea and Moe have played), and the paper telling of Bea's coup.
  'room-playing': { room: (me) => room({ ...PLAYED, members: AFTER_FIVE({ ...me, host: true }) }), lobbies: { live: 0, slow: 0 }, life: 'play-news-r6' },
  // The same game at the finances of the round: Moe's offer of a loan to answer, and the player's own to Bea, waiting.
  'room-loans': { room: (me) => room({ ...PLAYED, loans: LOANS, members: AFTER_FIVE({ ...me, host: true }) }), lobbies: { live: 0, slow: 0 }, life: 'play-finance-r6' },
  // The same game, its sixth round played by the player as the last to play: the ledger, and the room's order under it.
  'room-resolved': {
    room: (me) => room({ ...PLAYED, members: AFTER_FIVE({ ...me, host: true }) }),
    lobbies: { live: 0, slow: 0 },
    life: 'play-finance-r6',
    after: (me) =>
      room({
        ...PLAYED,
        round: 6,
        deadline: SCENE_NOW + 180_000,
        members: [
          { ...me, host: true, standing: stood(671, 4_480_000, [612, 2], { cityId: 'tokyo' }) },
          { ...BEA, standing: stood(648, 4_390_000, [655, 1], { cityId: 'madrid', career: { id: 'healthcare', level: 2 } }) },
          { ...NAMELESS, standing: stood(305, 1_920_000, [298, 4], { cityId: 'bangkok', career: null }) },
          { ...MOE, standing: stood(633, 4_210_000, [590, 3], { cityId: 'new_york', career: { id: 'finance', level: 3 } }) },
        ],
      }),
  },
  // The game over, the player first of those who stayed: the end of the life, the room's order over it, and the rematch to ask for.
  'room-end': { room: (me) => room({ status: 'finished', round: content.rounds, rounds: content.rounds, members: OVER({ ...me, host: true }) }), lobbies: { live: 0, slow: 0 }, life: 'end-escaped' },
  // The records' games played with others: two over, the latest open in its sheet (`sceneGameOpened`).
  'room-history': {
    room: () => null,
    lobbies: { live: 0, slow: 0 },
    history: [
      gameOver('scene-game-2', {
        rematchOf: true,
        playedAt: SCENE_NOW - 86_400_000,
        players: [player({ ...BEA }, 1_402, { cityId: 'madrid', career: { id: 'healthcare', level: 3 } }), player({ ...MOE }, 1_290, { cityId: 'new_york', career: { id: 'finance', level: 4 } }), player(seat('scene-me', 'Rata_Uno', { me: true }), 1_211)],
      }),
      gameOver('scene-game-1', {
        players: [player(seat('scene-me', 'Rata_Uno', { me: true }), 1_284), player({ ...BEA }, 1_107, { cityId: 'madrid', career: { id: 'healthcare', level: 3 } }), player({ ...NAMELESS }, null, { left: true, netWorth: null, cityId: null, career: null })],
      }),
    ],
  },
};

/** The game whose sheet a scene of the records' games opens from the start, by its id: the latest. */
export const sceneGameOpened = (name: string): string | undefined => (name === 'room-history' ? 'scene-game-2' : undefined);

/** A life as the server shows a life played in a room: the engine's view of it, with the flag the server sets on every life in a room. */
const inRoom = (view: GameView): GameView => ({ ...view, player: { ...view.player, life: { ...view.player.life, flags: { ...view.player.life.flags, in_room: 1 } } } });

/** The player's life in a scene's room, played on the device of the scene it is taken from, and what the server would answer of it. */
async function lifeOf(scene: string): Promise<{ session: GameSession; save: () => Promise<SavedGame> }> {
  const store = await sceneStore(scene);
  const { session } = await fixedSessions(store).resume();
  if (session === null) throw new Error(`scene ${scene}: no life to play in the room`);
  return { session, save: async () => (await store.loadGame()) as SavedGame };
}

/** The life as the server shows it whole, at the step `step`. */
async function shown(life: { session: GameSession; save: () => Promise<SavedGame> }, step: number): Promise<RoomLife> {
  const saved = await life.save();
  return {
    gameId: life.session.gameId,
    lifeId: life.session.lifeId,
    engineVersion: ENGINE_VERSION,
    step,
    view: inRoom(life.session.view()),
    record: { history: saved.history, bankruptcies: saved.bankruptcies, journal: saved.journal },
    events: [],
    run: null,
  };
}

/** The code the address a scene is opened with carries (an invitation), or none. */
export const sceneInvite = (name: string): string | undefined => (name === 'room-join-code' ? SCENE_ROOM_CODE : undefined);

/** A refusal of the server: whatever is asked of a scene's table, it stays as it is. */
const refused = async (): Promise<never> => {
  throw new Error('a scene is a picture: nothing is asked of its table');
};

/**
 * The rooms of a scene (the core's `RoomsLink`, which the clients' game takes as its `rooms`), or null for a scene that has none: nobody signed in to
 * play with. The scene's player is the member signed in for it (`sceneMember`); what they are in is answered the same every time, and nothing they
 * press is taken.
 */
export function sceneRooms(name: string): RoomsLink | null {
  const plan = PLANS[name];
  const member = sceneMember(name);
  if (plan === undefined || member === null) return null;
  const me = seat(member.userId, member.nickname, { me: true, avatar: member.avatar });
  // The room as it now stands: the scene's, until its one round is played.
  let current = plan.room(me);
  // The life, played once for the link, when it is first asked for.
  let life: ReturnType<typeof lifeOf> | null = null;
  const theLife = () => (life ??= lifeOf(plan.life as string));
  let step = 1;
  const api: RoomsApi = {
    mine: async () => current,
    lobbies: async () => ({ ...plan.lobbies, dropped: false }),
    state: async () => current ?? 'gone',
    open: refused,
    quick: refused,
    join: refused,
    start: refused,
    leave: refused,
    report: refused,
    follow: refused,
    invite: refused,
    view: async () => (plan.life === undefined ? 'gone' : shown(await theLife(), step)),
    card: refused,
    // The one round a scene plays: the engine plays it on the scene's life, and the room turns with it, the player the last to play.
    submit: async (_room, _step, orders) => {
      if (plan.after === undefined || plan.life === undefined) return refused();
      const playing = await theLife();
      const result = await playing.session.playRound({ orders });
      const saved = await playing.save();
      step += 1;
      current = plan.after(me);
      return { room: current, result: { step, view: inRoom(result.view), world: result.view.timeline[result.view.round], events: result.events, record: { history: saved.history, bankruptcies: saved.bankruptcies, journal: saved.journal }, run: null } };
    },
    rematch: refused,
    history: async () => plan.history ?? [],
    shout: refused,
    offerLoan: refused,
    answerLoan: refused,
  };
  return { api, watch: () => () => undefined };
}

/** The round store of a scene's room, as a script needs it: its state, with the game of the player's life in the room once it is open. */
export type SceneRooms = { getState(): { game: SceneGame | null } };

/** How long a scene waits for the life in its room to open before it says it never did. */
const OPENED_WITHIN_MS = 30_000;

/**
 * What a scene of the games with others does once its game is open, on the room store of the client that draws it: waits for the life in the room
 * to open where the scene has one (so the screen is first drawn on it), and plays the round of `room-resolved` with the scene's player's orders, as
 * any scene's script does. Nothing for any other scene.
 */
export async function runRoomScene(name: string, rooms: SceneRooms): Promise<void> {
  const plan = PLANS[name];
  if (plan?.life === undefined) return;
  const opened = () => rooms.getState().game?.getState() ?? null;
  for (let waited = 0; opened()?.status !== 'playing'; waited += 10) {
    if (waited > OPENED_WITHIN_MS) throw new Error(`scene ${name}: the life in the room never opened`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  if (plan.after === undefined) return;
  const game = rooms.getState().game as SceneGame;
  const saver = bots.find((bot) => bot.id === 'saver');
  const view = game.getState().view;
  if (saver === undefined || view === null) throw new Error(`scene ${name}: nobody to play the round`);
  for (const order of saver.orders(content, view)) game.getState().addOrder(order);
  await game.getState().play();
  const stage = game.getState().stage;
  if (stage !== 'resolve') throw new Error(`scene ${name}: expected the resolve, found the ${stage}`);
}
