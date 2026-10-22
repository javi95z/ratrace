import { avatarOf } from '../game/avatar';
import type { RatLook } from '../game/avatar';

/**
 * The cloud a scene of the game online is drawn with: who is signed in, and what the server keeps of them, the same on both clients (the web's page
 * at `/kit/scene`, the app's `/scene`) and never the live project. Plain data and plain objects: the core names nothing of the cloud's package, and
 * each client hands these to its game as its `Account` and `Community`, whose shapes they have (what a scene's screen asks of them; the rest it
 * never asks). A scene with no cloud is played by nobody signed in.
 */

/** A player signed in with Google, as a scene has them: their id, and their profile on the server (the name, the code to be followed by, the rat). */
export interface SceneMember {
  userId: string;
  email: string | null;
  nickname: string | null;
  friendCode: string;
  /** The rat as the profile keeps it (`avatarOf`). */
  avatar: string | null;
}

/** The rat of the scenes' player: a fur, a face, something of each to wear, and a backdrop, all of them open to anyone. */
export const SCENE_RAT: RatLook = { colour: 'teal', body: 'ginger', face: 'grin', outfit: 'hoodie', hat: 'beanie', eyes: 'round', backdrop: 'stars' };

/** The player of the scenes of their own profile: a name of their own, their code, and the rat they dressed. */
const RATA: SceneMember = { userId: 'u-scene', email: null, nickname: 'Rata_Uno', friendCode: 'ABCD2345', avatar: avatarOf(SCENE_RAT) };

/** Who is signed in for each scene of the game online, by the scene's name. */
const MEMBERS: Readonly<Record<string, SceneMember>> = {
  'player-member': RATA,
  'player-friend-code': RATA,
  'player-editor-body': RATA,
  'player-editor-wear': RATA,
  'player-editor-scene': RATA,
  // The games with others (`sceneRooms`): the same player, at the table.
  'room-door': RATA,
  'room-lobby-friends': RATA,
  'room-lobby-public': RATA,
  'room-join-code': RATA,
};

/** The member a scene is played by, or null for a scene with nobody signed in. */
export const sceneMember = (name: string): SceneMember | null => (Object.hasOwn(MEMBERS, name) ? MEMBERS[name] : null);

/**
 * The cloud of a scene, or null where nobody is signed in: an account that is the member from the start (settled, signed in with Google, never
 * changing: a scene is a picture), and the server's side of their profile, which answers what it keeps and takes every change without keeping it
 * (nothing is pressed on a scene). Nothing here goes anywhere.
 */
export function sceneCloud(name: string) {
  const member = sceneMember(name);
  if (member === null) return null;
  const state = { kind: 'member' as const, userId: member.userId, email: member.email };
  const account = {
    state: () => state,
    subscribe: () => () => {},
    settled: () => true,
    start: async () => {},
    keepWithGoogle: async () => false,
    useExistingAccount: async () => false,
    dismissNotice: () => {},
    signOut: async () => false,
  };
  const community = {
    me: async () => ({ nickname: member.nickname, friendCode: member.friendCode, avatar: member.avatar }),
    rename: async () => 'ok' as const,
    setAvatar: async () => true,
  };
  return { member, account, community };
}
