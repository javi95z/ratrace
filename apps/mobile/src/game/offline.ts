import type { RoomStoreState } from '@ratrace/core/game/room';
import type { AccountLife, CloudSaving, Community } from '@ratrace/online/types';

/*
 * What the web's game context answers when no one is signed in and nothing is on the network, which is all the phone
 * knows yet: the ranking, the other players, the rooms, the account's copy of the player's things, and the counting of
 * how the game is played. A screen that asks for any of them gets the answer a guest with no connection gets on the
 * web, and so draws what the web draws then. The names and the answers are the web's (apps/web/src/game/context.tsx);
 * where the phone is given an account these are replaced by the real ones, and no screen changes.
 */

/** Whether a new life can be a ranked one, played by the server. With no account, never. */
export const useRanking = (): 'yes' | 'offline' | 'no' => 'no';

/** The other players: the rankings, the player's name, whom they follow. With no account, there are none. */
export const useCommunity = (): Community | null => null;

/** True for the screens of a life in a room. The phone has no rooms. */
export const useInRoom = (): boolean => false;

/** The room the web's room store holds when nobody is signed in to play with (`offline.test.tsx` holds it to the store's own). */
export const NO_ROOM: RoomStoreState = {
  status: 'unavailable',
  room: null,
  skew: 0,
  game: null,
  busy: false,
  refusal: null,
  missed: 0,
  closed: false,
  otherRules: false,
  olderRules: false,
  earned: [],
  heard: [],
  lobbies: null,
  dropped: false,
};

/** A slice of the room the player is in. With no account there is none, so it is always a slice of no room. */
export function useRoom<T>(select: (state: RoomStoreState) => T): T {
  return select(NO_ROOM);
}

/** How the account's copy of the player's things stands, and the different life waiting there, if there is one. */
interface AccountCopy {
  status: CloudSaving;
  offer: AccountLife | null;
  takeOffer(): Promise<boolean>;
  declineOffer(): Promise<void>;
}

/** Nothing is saved to an account, and no life waits in one: so there is nothing to take and nothing to turn down. */
const NO_SAVES: AccountCopy = { status: 'off', offer: null, takeOffer: async () => false, declineOffer: async () => {} };

export const useAccountSaves = (): AccountCopy => NO_SAVES;

/** Counts something the player did, by its name and what it says of it. The phone counts nothing. */
export type Track = (event: { name: string; [what: string]: unknown }) => void;

const IGNORE: Track = () => {};

export const useTrack = (): Track => IGNORE;
