import type { GameView } from '@ratrace/engine';
import type { GameSession, Sessions } from '@ratrace/core/session/types';
import type { RoomState } from '@ratrace/core/session/room';

/*
 * What the game counts of how it is played: a copy of the web's (apps/web/src/pwa/events.ts), but for where the web sends it (Vercel), which is the
 * web's own: the phone sends to the game's own project (`online/track.ts`, wired in `game/context.tsx`). The file cannot be shared,
 * because the web's imports Vercel's library. `events.test.ts` holds the copy to the original: both are run over the same lives and rooms.
 */

/**
 * What the game counts of how it is played: never who played, never a score, never an id. Each says only what kind of thing happened.
 */
export type LifeMode = 'solo' | 'ranked' | 'challenge' | 'practice';

export type Counted =
  /** A life of the player's own really began: not one taken up again. */
  | { name: 'life_start'; mode: LifeMode }
  /** A life of the player's own reached its end, played out on this page. */
  | { name: 'life_end'; mode: LifeMode; escaped: boolean }
  /** An attempt at the week's challenge that counts began: the server took it. */
  | { name: 'challenge_attempt' }
  /** A game with others began, as this page saw it begin. */
  | { name: 'game_start'; kind: 'friends' | 'public' }
  /** The player joined a game with others. */
  | { name: 'game_join'; via: 'code' | 'link' | 'quick' }
  /** A guest kept their account with Google. */
  | { name: 'account_kept' }
  /** The game was installed as an app. */
  | { name: 'app_installed' }
  /** Something was shared: a life's card, or an invitation to a game. */
  | { name: 'share'; what: 'card' | 'invite' };

export type Track = (event: Counted) => void;

/** Counts nothing: for tests, and anywhere there is nothing to count to. */
export const ignore: Track = () => {};

/** What kind of life a life is, by whether the server plays it and whether it is a week's challenge. */
export function modeOf(life: { ranked?: boolean; challenge?: string | null }): LifeMode {
  if (life.challenge) return life.ranked ? 'challenge' : 'practice';
  return life.ranked ? 'ranked' : 'solo';
}

/** The sessions of the game, counting each life that begins, and each attempt at the week's challenge the server took. */
export function countingStarts(sessions: Sessions, track: Track): Sessions {
  return {
    start: async (lifeId, options) => {
      const session: GameSession = await sessions.start(lifeId, options);
      track({ name: 'life_start', mode: modeOf(session) });
      if (session.ranked && session.challenge) track({ name: 'challenge_attempt' });
      return session;
    },
    ...(sessions.takeUp ? { takeUp: (life) => sessions.takeUp!(life) } : {}),
    resume: () => sessions.resume(),
    abandon: () => sessions.abandon(),
  };
}

/** The round store as the count reads it. */
interface LifeOnScreen {
  gameId: string | null;
  view: GameView | null;
  ranked: boolean;
  challenge: string | null;
  resolved: unknown;
}

/**
 * The end of a life, when this page played its last step: the same life, unfinished before and
 * finished now, with the step's result in hand. A finished life opened again has none, so it is not counted twice.
 */
export function lifeEnded(now: LifeOnScreen, before: LifeOnScreen): Counted | null {
  if (now.gameId === null || now.gameId !== before.gameId || now.resolved === null) return null;
  if (!before.view || before.view.finished || !now.view?.finished) return null;
  return { name: 'life_end', mode: modeOf(now), escaped: now.view.player.escapedAtRound !== null };
}

/** The start of a game with others, as this page saw its room go from waiting to playing. */
export function gameBegan(now: RoomState | null, before: RoomState | null): Counted | null {
  if (now === null || before === null || now.id !== before.id) return null;
  if (before.status !== 'open' || now.status !== 'playing') return null;
  return { name: 'game_start', kind: now.public ? 'public' : 'friends' };
}
