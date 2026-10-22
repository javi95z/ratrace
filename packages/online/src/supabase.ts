import type { RankedApi } from '@ratrace/core/session/ranked';
import type { RoomsLink } from '@ratrace/core/session/room';
import type { ErrorReport, Sent } from './errors';
import type { SyncCloud } from './mirror';
import type { Account, AccountNotice, AccountState, Community, Opener } from './types';

/** A signed-in player as the cloud describes them. */
export interface CloudUser {
  id: string;
  is_anonymous: boolean;
  email: string | undefined;
}

/**
 * The few things the account asks of the cloud. The real one is made from the Supabase client in
 * `connect.ts`; a test hands in its own. Any of these may fail: the account treats a failure as
 * having no network.
 */
export interface Cloud extends SyncCloud {
  /** The server of ranked lives, asked as whoever is signed in. */
  ranked: RankedApi;
  /** The rooms, asked as whoever is signed in, and heard of as they change. */
  rooms: RoomsLink;
  /** The other players: rankings, names, friends. */
  community: Community;
  /** Whoever this browser is already signed in as, or null. Fails if it could not find out: that is not "nobody". */
  currentUser(): Promise<CloudUser | null>;
  /** Makes a guest account with no form. Null if the cloud would not. */
  signInAsGuest(): Promise<CloudUser | null>;
  /**
   * Starts linking a Google account to the one signed in, and comes back to `redirectTo`. False if it could not start.
   * With `open`, the page is not left: Google is opened with it, and the call resolves once the browser comes back,
   * true if it came back with a code that was exchanged for the player's session, false otherwise.
   */
  linkGoogle(redirectTo: string, open?: Opener): Promise<boolean>;
  /** Starts signing in as the player a Google account already belongs to. False if it could not start. With `open`, as `linkGoogle`. */
  signInWithGoogle(redirectTo: string, open?: Opener): Promise<boolean>;
  /** Signs this browser out. Throws if it could not. */
  signOut(): Promise<void>;
  /** Makes the player's profile row if it is not there, in the language of the page. One already there is left as it is. */
  ensureProfile(userId: string, language: string): Promise<void>;
  /** Calls `listener` whenever who is signed in changes. Returns how to stop. */
  onUser(listener: (user: CloudUser | null) => void): () => void;
  /** Sends the errors a page met, to be kept with the server's: see `docs/errors.md`. */
  reportErrors(reports: ErrorReport[]): Promise<Sent>;
  /**
   * Starts (true) or stops (false) renewing the session by itself, for a client made not to (`autoRefresh: false`): a phone renews it only while
   * the app is in front. Left out by a cloud that renews it as it was made to.
   */
  autoRefresh?(on: boolean): Promise<void>;
  /**
   * Counts one event of how the game is played, in the game's own project (`supabase/functions/track`): what happened, with what, where, and
   * nothing of who. Never throws. Left out by a cloud that counts nothing (the web counts with Vercel).
   */
  track?(event: TrackedEvent): Promise<Sent>;
}

/** An event as the `track` function takes it: its name, its props (no id, no name, no score: the function refuses them), and where it happened. */
export interface TrackedEvent {
  name: string;
  props: Record<string, string | boolean>;
  platform: string;
}

const FAILURES = ['error', 'error_code', 'error_description'];

/** The parts of an address that may say a sign-in went wrong: its query, and what follows the hash. */
function failureParams(address: string): { url: URL; query: URLSearchParams; hash: URLSearchParams } | null {
  try {
    const url = new URL(address);
    return { url, query: url.searchParams, hash: new URLSearchParams(url.hash.replace(/^#/, '')) };
  } catch {
    return null;
  }
}

/**
 * What the address the player came back to says about keeping their account, or null if it says
 * nothing. Google's answer comes back through the cloud as `error` and `error_code` in the address.
 */
export function noticeIn(address: string): 'taken' | 'failed' | null {
  const parts = failureParams(address);
  if (!parts) return null;
  for (const params of [parts.query, parts.hash]) {
    if (params.get('error_code') === 'identity_already_exists') return 'taken';
    if (params.has('error') || params.has('error_code')) return 'failed';
  }
  return null;
}

/**
 * Whether a browser came back to the address it was sent back to (`to` itself, or `to` and then its query, its hash or a path
 * below it), and not somewhere else: only that address speaks for the trip. A code or a word from any other is nobody's.
 */
export function cameBackTo(address: string, to: string): boolean {
  if (!address.startsWith(to)) return false;
  const next = address.charAt(to.length);
  return next === '' || to.endsWith('/') || next === '?' || next === '#' || next === '/';
}

/** The same address without what `noticeIn` read, so a reload does not say it again. */
function withoutFailure(address: string): string {
  const parts = failureParams(address);
  if (!parts) return address;
  for (const name of FAILURES) parts.query.delete(name);
  if (FAILURES.some((name) => parts.hash.has(name))) parts.url.hash = '';
  return parts.url.toString();
}

/**
 * The player's account in the cloud. It signs in as a guest on first launch, with no form, and
 * can be kept with Google later; either way it is the same account, so nothing has to be moved.
 * Every failure leaves the game where it would be with no cloud at all: playing, offline.
 *
 * Its methods are fields, not methods of the class: they are handed loose to whoever watches the
 * account, and a method that needed `this` would break there.
 */
export class SupabaseAccount implements Account {
  private current: AccountState = { kind: 'offline' };
  private readonly listeners = new Set<() => void>();
  private link: Cloud | null = null;
  private starting: Promise<void> | null = null;
  private notice: AccountNotice | null = null;
  /** The trip to Google under way on a phone: a second call while the browser is open is answered by it, never a second browser. */
  private trip: Promise<boolean> | null = null;
  private stopListening: (() => void) | null = null;
  /** The language the account was last started in, for trying again. */
  private language: string | null = null;
  /** A start has ended, signed in or not. */
  private tried = false;

  /**
   * `connect` loads the client, so a game that never goes online never downloads it.
   * `address` is where the page is; `clean` replaces it once a notice has been read from it. A phone has
   * no address (null): what Google says comes back to it with the browser instead (`travel`).
   */
  constructor(
    private readonly connect: () => Promise<Cloud>,
    private readonly address: () => string | null,
    private readonly clean: (address: string) => void,
  ) {}

  /** The cloud, once someone is signed in to it. For what syncs to the account, not for screens. */
  readonly cloud = (): Cloud | null => (this.current.kind === 'offline' ? null : this.link);

  readonly state = (): AccountState => this.current;

  readonly settled = (): boolean => this.tried;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly start = (language: string): Promise<void> => {
    this.language = language;
    // Already signed in: there is nothing to start. Asked while starting: the same start answers.
    if (this.current.kind !== 'offline') return Promise.resolve();
    return (this.starting ??= this.begin(language).finally(() => {
      // A start that ended offline may be tried again later; one that signed in is not repeated.
      this.starting = null;
      if (!this.tried) {
        this.tried = true;
        for (const listener of this.listeners) listener();
      }
    }));
  };

  /**
   * Starts again as it was last started, if nobody is signed in: for when the connection comes
   * back to a page that was opened without one. Never started, there is nothing to try again.
   */
  readonly again = (): Promise<void> => (this.language === null ? Promise.resolve() : this.start(this.language));

  private async begin(language: string): Promise<void> {
    try {
      const cloud = this.link ?? (await this.connect());
      const here = this.address();
      const said = here === null ? null : noticeIn(here);
      const back = here === null ? null : withoutFailure(here);
      if (said !== null && back !== null) {
        // A Google account that already has a player is the player's own, most often: they are taken into it, not asked again.
        this.notice = said === 'taken' ? 'joining' : 'failed';
        this.clean(back);
      }

      // A failure to find out who is signed in is not "nobody": making a guest then would write
      // a new player over the one this browser has stored. It throws, and the game stays offline.
      const user = (await cloud.currentUser()) ?? (await cloud.signInAsGuest());
      if (user === null) return;
      this.link = cloud;
      this.show(user);
      this.stopListening ??= cloud.onUser((next) => this.show(next));
      // The profile row is the player's own first write. If it cannot be made now, the next launch makes it. Its language
      // is not written over: it is the one the player chose, which a page opened in the browser's language is not.
      void cloud.ensureProfile(user.id, language).catch(() => undefined);
      // Sent back from Google to a guest whose Google account is already a player's: straight on into it.
      // What is on this device joins that account, as it does for any sign-in.
      if (said === 'taken' && back !== null && user.is_anonymous) void this.leaveFor((c) => c.signInWithGoogle(back));
    } catch {
      this.set({ kind: 'offline' });
    }
  }

  // The web's calls carry the address alone, as they always have: `open` is passed on only where there is one.
  readonly keepWithGoogle = async (returnTo: string, open?: Opener): Promise<boolean> =>
    open ? this.once(() => this.travel(returnTo, open, 'link')) : this.leaveFor((cloud) => cloud.linkGoogle(returnTo));

  readonly useExistingAccount = async (returnTo: string, open?: Opener): Promise<boolean> =>
    open ? this.once(() => this.travel(returnTo, open, 'sign-in')) : this.leaveFor((cloud) => cloud.signInWithGoogle(returnTo));

  /** One trip to Google at a time: asked again while one is under way, that one answers. */
  private once(go: () => Promise<boolean>): Promise<boolean> {
    return (this.trip ??= go().finally(() => {
      this.trip = null;
    }));
  }

  /**
   * Google through a browser that comes back (a phone). Nothing is left, so the call waits for the
   * browser and reads the address it came back with as a page reads its own, and follows the web's
   * paths from there: kept; an account that is already a player's, taken into it with nothing more to
   * tap; any other failure, said; closed by the player, nothing said.
   */
  private async travel(returnTo: string, open: Opener, way: 'link' | 'sign-in', joining = false): Promise<boolean> {
    const cloud = this.link;
    if (cloud === null || this.current.kind === 'offline') return false;
    // Undefined while the browser has not come back: never opened, or it could not be.
    let back: string | null | undefined;
    const watched: Opener = async (url) => (back = await open(url));
    const done = await (way === 'link' ? cloud.linkGoogle(returnTo, watched) : cloud.signInWithGoogle(returnTo, watched)).catch(() => false);
    if (done) {
      // The session is the account's now: the cloud tells who it is, and there is nothing left to say (and the listeners hear it taken back).
      this.notice = null;
      this.say(null);
      return true;
    }
    if (back === null || (back !== undefined && !cameBackTo(back, returnTo))) {
      // Closed by the player, or back somewhere it was not sent: nothing the trip says. A word that the player is being taken into their
      // account no longer holds.
      if (joining) this.say(null);
      return false;
    }
    if (back !== undefined && noticeIn(back) === 'taken' && !joining && this.current.kind === 'guest') {
      this.say('joining');
      return this.travel(returnTo, open, 'sign-in', true);
    }
    this.say('failed');
    return false;
  }

  /** Tells a guest something about keeping their account, or takes it back. A member has nothing to be told. */
  private say(notice: AccountNotice | null): void {
    if (this.current.kind !== 'guest') return;
    this.notice = notice;
    if (this.current.notice !== notice) this.set({ ...this.current, notice });
  }

  /** Sends the player to Google one way or the other. If the journey cannot begin, a guest is told so. */
  private async leaveFor(go: (cloud: Cloud) => Promise<boolean>): Promise<boolean> {
    if (this.link === null || this.current.kind === 'offline') return false;
    const begun = await go(this.link).catch(() => false);
    if (!begun && this.current.kind === 'guest') {
      this.notice = 'failed';
      this.set({ ...this.current, notice: 'failed' });
    }
    return begun;
  }

  readonly signOut = async (): Promise<boolean> => {
    if (this.link === null || this.current.kind === 'offline') return false;
    try {
      await this.link.signOut();
    } catch {
      return false;
    }
    this.set({ kind: 'offline' });
    return true;
  };

  readonly dismissNotice = (): void => {
    this.notice = null;
    if (this.current.kind === 'guest' && this.current.notice !== null) this.set({ ...this.current, notice: null });
  };

  private show(user: CloudUser | null): void {
    if (user === null) this.set({ kind: 'offline' });
    else if (user.is_anonymous) this.set({ kind: 'guest', userId: user.id, notice: this.notice });
    else this.set({ kind: 'member', userId: user.id, email: user.email ?? null });
  }

  private set(next: AccountState): void {
    this.current = next;
    for (const listener of this.listeners) listener();
  }
}
