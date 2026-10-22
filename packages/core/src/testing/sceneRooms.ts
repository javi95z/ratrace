import { CONTENT_VERSION } from '@ratrace/content';
import { ENGINE_VERSION } from '@ratrace/engine';
import type { RoomMember, RoomsApi, RoomsLink, RoomState } from '../session/room';
import { sceneMember } from './sceneCloud';
import { SCENE_NOW } from './scenes';

/*
 * The games with others of a scene, the same on both clients (the web's page at `/kit/scene`, the app's `/scene`): the room the scene's player is
 * in, or none, and how many public games are looking for players. Both registries give their game a `rooms` of it (`sceneRooms`) in place of the
 * server, so a shot of the web and one of the phone show the same table. Nothing is asked of a network, and nothing changes: whatever is pressed is
 * refused, and the room is the same each time it is asked for. A picture.
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
}

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
};

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
  const api: RoomsApi = {
    mine: async () => plan.room(me),
    lobbies: async () => ({ ...plan.lobbies, dropped: false }),
    state: async () => plan.room(me) ?? 'gone',
    open: refused,
    quick: refused,
    join: refused,
    start: refused,
    leave: refused,
    report: refused,
    follow: refused,
    view: refused,
    card: refused,
    submit: refused,
    rematch: refused,
    history: async () => [],
    shout: refused,
    offerLoan: refused,
    answerLoan: refused,
  };
  return { api, watch: () => () => undefined };
}
