import type { Account, Community } from '@ratrace/online/types';
import type { Page } from '../game/pages';

/*
 * The web export's twin of `push.ts` (Metro picks it for the web). The game's notices on the web are the browser's own push subscription, which come
 * with plan 5b: until then there are none. The switch is not shown (`available` is false), nothing is asked of the player or told to the account, and
 * Expo's library is never named, so none of it is in the web's bundle. The types are the phone's, so the game's context is the same on both.
 */

/** What the switch came to: on, refused by the player (now or before), or not to be had here. */
export type PushOn = 'on' | 'refused' | 'unavailable';

/** What the app remembers of the notices: turned on, turned off, or refused by the player; and the token the account was last given. */
export interface PushNoted {
  state: 'on' | 'off' | 'refused';
  token: string | null;
}

/** Where the app keeps that, handed in by the game's context (`kvPush`). */
export interface PushNote {
  read(): PushNoted | null;
  write(noted: PushNoted): void;
}

/** A page a notice opens, and the query it opens it with (the phone's). */
export interface NoticePage {
  page: Page;
  query: Record<string, string>;
}

/** The device, as the server knows it. */
type Target = { expo: string };

/** The phone's `Push`, the same calls: see `push.ts`. */
export interface Push {
  available(): boolean;
  isOn(): Promise<boolean>;
  pushOn(): Promise<PushOn>;
  register(community: Community, locale: string): Promise<boolean>;
  pushOff(community: Community): Promise<boolean>;
  release(community: Community | null, patience?: number): Promise<void>;
  resume(): void;
  target(): Promise<Target | null>;
  follow(account: Account, community: () => Community | null, locale: string): () => void;
  onTap(open: (to: NoticePage) => void): () => void;
}

/** The notices of a page that has none: never on, never asked, nothing for the account to keep or forget. Called as the phone's, its note unread. */
export const phonePush: (note: PushNote, options?: { platform?: string }) => Push = () => ({
  available: () => false,
  isOn: async () => false,
  pushOn: async () => 'unavailable',
  register: async () => false,
  // Off they are already: there is nothing for the account to forget.
  pushOff: async () => true,
  release: async () => undefined,
  resume: () => undefined,
  target: async () => null,
  follow: () => () => undefined,
  onTap: () => () => undefined,
});
