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
 * `taken`: the Google account they chose already belongs to a player of this game, most often
 * themselves on another device. `failed`: nothing was linked, whatever the reason.
 */
export type AccountNotice = 'taken' | 'failed';

/** The one way the screens learn who is playing and ask to keep the account. */
export interface Account {
  state(): AccountState;
  /** Calls `listener` whenever the state changes. Returns how to stop. */
  subscribe(listener: () => void): () => void;
  /**
   * Signs in as a guest unless someone already is. Never throws: with no network the state stays
   * `offline`, and it can be asked again later.
   */
  start(language: string): Promise<void>;
  /**
   * Sends the player to Google to keep this account, and brings them back to `returnTo`.
   * The account stays the same one, so nothing has to be moved. Resolves false if it could not even begin.
   */
  keepWithGoogle(returnTo: string): Promise<boolean>;
  /**
   * Signs in as the player a Google account already belongs to, in place of the guest this
   * browser has been so far, and comes back to `returnTo`. For a second device. Resolves false if it could not begin.
   */
  useExistingAccount(returnTo: string): Promise<boolean>;
  /** The player has read the notice. */
  dismissNotice(): void;
}

/**
 * Where what is on the device stands with the account: there is no account; it is on its way; the
 * last try did not get through; or everything is there.
 */
export type CloudSaving = 'off' | 'sending' | 'waiting' | 'saved';

/** What the account changed on the device, for whoever shows it. */
export type DeviceChange = 'game' | 'profile' | 'runs';

/** A different life in progress waiting in the account, as far as a screen needs to know it. */
export interface AccountLife {
  gameId: string;
  lifeId: string;
  round: number;
  cityId: string;
}

/**
 * The account's copy of what the player has, as the game is told of it. The device is always
 * written first and is always enough; this says how far the account is behind it, and holds the
 * one thing a player is asked: what to do with a different life waiting there.
 */
export interface AccountSaves {
  status(): CloudSaving;
  /** A different life in progress waiting in the account, if there is one. The same object until it changes. */
  offer(): AccountLife | null;
  /** Calls `listener` when the status or the offer changes. Returns how to stop. */
  subscribe(listener: () => void): () => void;
  /** Calls `listener` when the account has changed what the device holds. Returns how to stop. */
  onDeviceChanged(listener: (what: DeviceChange) => void): () => void;
  /** Takes the offered life in place of the device's own, which is given up. False if there was none. */
  takeOffer(): Promise<boolean>;
  /** Ends the offered life in the account instead. */
  declineOffer(): Promise<void>;
}
