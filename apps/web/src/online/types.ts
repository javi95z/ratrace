/**
 * Who is playing, as far as the cloud knows. The game never needs an answer to play: `offline`
 * is a state like the others, and it is the state of a build with no Supabase project set.
 */
export type AccountState =
  /** No project is configured, or nobody could be signed in. The game plays on this device alone. */
  | { kind: 'offline' }
  /** Signed in without a form: an account that lives only in this browser until it is kept. */
  | { kind: 'guest'; userId: string; notice: AccountNotice | null }
  /** Kept with Google: the same account on any device. */
  | { kind: 'member'; userId: string; email: string | null };

/**
 * Something the player should be told once about keeping their account.
 * `taken`: the Google account they chose already belongs to another player of this game.
 */
export type AccountNotice = 'taken' | 'failed';

/** The one way the screens learn who is playing and ask to keep the account. */
export interface Account {
  state(): AccountState;
  /** Calls `listener` whenever the state changes. Returns how to stop. */
  subscribe(listener: () => void): () => void;
  /** Signs in as a guest unless someone already is. Never throws: with no network the state stays `offline`. */
  start(language: string): Promise<void>;
  /**
   * Sends the player to Google to keep this account, and brings them back to `returnTo`.
   * The account stays the same one, so nothing has to be moved. Resolves false if it could not even begin.
   */
  keepWithGoogle(returnTo: string): Promise<boolean>;
  /** The player has read the notice. */
  dismissNotice(): void;
}
