import type { CloudGame, Progress } from '@ratrace/online/merge';
import type { CloudRun } from '@ratrace/online/mirror';
import type { Cloud, CloudUser } from '@ratrace/online/supabase';
import type { Community, Opener } from '@ratrace/online/types';
import type { BrowserAnswer } from './fakes';

/*
 * The game's project in memory for the tests of the account's screens: who the phone is signed in as, and what each account holds (the lives being
 * played and finished, the progress), with Google as a phone reaches it. Google is the system's browser (`authBrowser` in fakes.ts), opened with the
 * address the project gives and coming back as a test says: what the project does with the address it came back to is what the real client does
 * (`connect.ts`, `throughBrowser`): a code from the address the trip was sent back to is the player's session; an error, a browser closed or another
 * address is nothing. Linking keeps the guest's account, unless Google's account is already a player's (`taken`); signing in is that player.
 */

/** Where Google sends the phone back to (`BACK_FROM_GOOGLE`). */
const BACK = 'theratrace://auth';

/** How the browser comes back from Google, by what Google says. */
export const fromGoogle = {
  /** Kept: a code for the player's session. */
  linked: { type: 'success', url: `${BACK}?code=c0de` },
  /** The Google account is already a player's: the project says so in the address. */
  taken: { type: 'success', url: `${BACK}?error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked+to+another+user` },
  /** Any other failure. */
  failed: { type: 'success', url: `${BACK}?error=access_denied&error_description=The+user+denied+access` },
  /** Closed by the player. */
  closed: { type: 'cancel' },
  /** Closed for them: the system took the browser away. */
  killed: { type: 'dismiss' },
} as const satisfies Record<string, BrowserAnswer>;

/** A browser held open until the test says how it comes back. */
export function heldBrowser(): { answer: Promise<BrowserAnswer>; back(answer: BrowserAnswer): void } {
  let back: (answer: BrowserAnswer) => void = () => undefined;
  const answer = new Promise<BrowserAnswer>((done) => (back = done));
  return { answer, back: (said) => back(said) };
}

/** What one account holds. */
interface Held {
  games: CloudGame[];
  progress: Progress | null;
  runs: CloudRun[];
}

/**
 * The code an address carries for the player's session, as the real client reads it (connect.ts, `throughBrowser`, with `cameBackTo` and `noticeIn`
 * of supabase.ts): back to the address it was sent to (itself, or followed by its query, its hash or a path below it), with no word of a failure
 * (`error`, `error_code`) in its query or its hash, and a code in its query. Null otherwise. Written out here, because a file of `testing/` may take no
 * more than the cloud's types (the wall); Account.test.ts holds it to the client's own functions, address by address.
 */
const codeIn = (address: string, to: string): string | null => {
  if (!address.startsWith(to)) return null;
  const next = address.charAt(to.length);
  if (!(next === '' || to.endsWith('/') || next === '?' || next === '#' || next === '/')) return null;
  try {
    const url = new URL(address);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
    for (const said of [url.searchParams, hash]) if (said.has('error') || said.has('error_code')) return null;
    return url.searchParams.get('code');
  } catch {
    return null;
  }
};

/**
 * The project: `signedIn` is who the phone already is (nobody, and a guest is made); `existing` the player whose Google account it is, if it is one
 * already (linking it is then refused as `taken`, and signing in with it is that player). `held(id)` is what an account holds, for a test to fill.
 */
export function accountCloud({ signedIn = null, existing = null, email = 'ana.garcia@example.com' }: { signedIn?: CloudUser | null; existing?: string | null; email?: string } = {}) {
  // `lostAnswers`: how many answers of a deletion are lost on their way (the account deleted all the same, the phone not told).
  const state = { user: signedIn, guests: 0, clock: 0, deleted: [] as string[], lostAnswers: 0 };
  const accounts = new Map<string, Held>();
  const held = (id: string): Held => {
    let one = accounts.get(id);
    if (!one) accounts.set(id, (one = { games: [], progress: null, runs: [] }));
    return one;
  };
  const mine = (): Held => {
    if (state.user === null) throw new Error('nobody is signed in');
    return held(state.user.id);
  };
  const listeners = new Set<(user: CloudUser | null) => void>();
  const become = (user: CloudUser | null) => {
    state.user = user;
    for (const listener of [...listeners]) listener(user);
  };
  /** Google, through the browser: the player's session if it came back with a code to where it was sent, nothing otherwise. */
  const google = async (to: string, open: Opener | undefined, who: () => CloudUser | null): Promise<boolean> => {
    if (!open) return true;
    const back = await open('https://accounts.google.com/o/oauth2/v2/auth?client_id=ratrace');
    if (back === null || codeIn(back, to) === null) return false;
    const user = who();
    if (user === null) return false;
    become(user);
    return true;
  };
  const cloud: Cloud = {
    ranked: {} as Cloud['ranked'],
    rooms: {} as Cloud['rooms'],
    // What the front door asks of the other players: the player's profile, their friends, today's attempt at the week's challenge.
    community: { me: async () => null, friends: async () => null, challengeEntry: async () => null } as unknown as Community,
    currentUser: async () => state.user,
    signInAsGuest: async () => {
      state.guests += 1;
      state.user = { id: `guest-${state.guests}`, is_anonymous: true, email: undefined };
      return state.user;
    },
    // Kept with Google: the same account, a member now, unless the Google account is a player's already (and the address said so, never this).
    linkGoogle: (to, open) => google(to, open, () => (existing !== null || state.user === null ? null : { id: state.user.id, is_anonymous: false, email })),
    signInWithGoogle: (to, open) => google(to, open, () => ({ id: existing ?? 'member-1', is_anonymous: false, email })),
    signOut: async () => become(null),
    // The account deleted with everything it holds, as the project's function deletes it; the session goes with the sign-out the account asks for after.
    // Asked again for a player already gone (an answer lost on its way), it answers deleted, as the function does.
    deleteAccount: async () => {
      if (state.user === null) return false;
      if (!state.deleted.includes(state.user.id)) {
        accounts.delete(state.user.id);
        state.deleted.push(state.user.id);
      }
      if (state.lostAnswers > 0) {
        state.lostAnswers -= 1;
        return false;
      }
      return true;
    },
    ensureProfile: async () => undefined,
    onUser: (listener) => (listeners.add(listener), () => void listeners.delete(listener)),
    reportErrors: async () => 'sent',
    playingGames: async () => mine().games.filter((game) => game.status === 'playing').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    pushGame: async (upload) => {
      const games = mine().games;
      const row = games.find((game) => game.id === upload.id);
      if (row && row.status === 'finished') return 'closed';
      const next: CloudGame = { ...upload, status: 'playing', updatedAt: `2026-10-13T10:00:${String((state.clock += 1)).padStart(2, '0')}Z` };
      if (row) Object.assign(row, next);
      else games.push(next);
      return 'saved';
    },
    abandonGame: async (id) => {
      const row = mine().games.find((game) => game.id === id);
      if (row && row.status === 'playing') row.status = 'abandoned';
    },
    loadProgress: async () => mine().progress,
    saveProgress: async (progress) => void (mine().progress = progress),
    listRuns: async () => [...mine().runs],
    rankedLife: async () => null,
    giveUpRanked: async () => undefined,
    finishRun: async () => 'refused',
  };
  return { cloud, state, held, become };
}
