import type { Account, AccountNotice, AccountState } from './types';

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
export interface Cloud {
  /** Whoever this browser is already signed in as, or null. */
  currentUser(): Promise<CloudUser | null>;
  /** Makes a guest account with no form. Null if the cloud would not. */
  signInAsGuest(): Promise<CloudUser | null>;
  /** Starts linking a Google account to the one signed in, and comes back to `redirectTo`. False if it could not start. */
  linkGoogle(redirectTo: string): Promise<boolean>;
  /** Makes the player's profile row if it is not there yet. */
  ensureProfile(userId: string, language: string): Promise<void>;
  /** Calls `listener` whenever who is signed in changes. Returns how to stop. */
  onUser(listener: (user: CloudUser | null) => void): () => void;
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
export function noticeIn(address: string): AccountNotice | null {
  const parts = failureParams(address);
  if (!parts) return null;
  for (const params of [parts.query, parts.hash]) {
    if (params.get('error_code') === 'identity_already_exists') return 'taken';
    if (params.has('error') || params.has('error_code')) return 'failed';
  }
  return null;
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
 */
export class SupabaseAccount implements Account {
  private current: AccountState = { kind: 'offline' };
  private readonly listeners = new Set<() => void>();
  private cloud: Cloud | null = null;
  private starting: Promise<void> | null = null;
  private notice: AccountNotice | null = null;

  /**
   * `connect` loads the client, so a game that never goes online never downloads it.
   * `address` is where the page is; `clean` replaces it once a notice has been read from it.
   */
  constructor(
    private readonly connect: () => Promise<Cloud>,
    private readonly address: () => string,
    private readonly clean: (address: string) => void,
  ) {}

  state(): AccountState {
    return this.current;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  start(language: string): Promise<void> {
    return (this.starting ??= this.begin(language));
  }

  private async begin(language: string): Promise<void> {
    try {
      const cloud = await this.connect();
      const here = this.address();
      this.notice = noticeIn(here);
      if (this.notice !== null) this.clean(withoutFailure(here));

      const user = (await cloud.currentUser()) ?? (await cloud.signInAsGuest());
      if (user === null) return;
      this.cloud = cloud;
      this.show(user);
      cloud.onUser((next) => this.show(next));
      // The profile row is the player's own first write. If it cannot be made now, the next launch makes it.
      void cloud.ensureProfile(user.id, language).catch(() => undefined);
    } catch {
      this.set({ kind: 'offline' });
    }
  }

  async keepWithGoogle(returnTo: string): Promise<boolean> {
    if (this.cloud === null) return false;
    const begun = await this.cloud.linkGoogle(returnTo).catch(() => false);
    if (!begun && this.current.kind === 'guest') {
      this.notice = 'failed';
      this.set({ ...this.current, notice: 'failed' });
    }
    return begun;
  }

  dismissNotice(): void {
    this.notice = null;
    if (this.current.kind === 'guest' && this.current.notice !== null) this.set({ ...this.current, notice: null });
  }

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
