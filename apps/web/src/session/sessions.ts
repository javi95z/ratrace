import { Unreachable } from './errors';
import type { RankedLifeInTheWay } from './errors';
import { rankedOf } from './ranked';
import type { RankedSessions } from './ranked';
import type { GameSession, Lost, PlayerStore, Sessions } from './types';

/**
 * The lives of this device, of both kinds: the ones it plays itself, and the ranked ones the
 * server plays. It chooses between the two when a life begins, and knows which kind the life in
 * progress is when the page opens. Nothing above it needs to know there are two.
 */
export class GameSessions implements Sessions {
  constructor(
    private readonly store: PlayerStore,
    private readonly local: Sessions,
    private readonly ranked: RankedSessions,
    private readonly versions: { engine: string; content: string },
  ) {}

  async start(lifeId: string, options?: { ranked?: boolean; replace?: string }): Promise<GameSession> {
    const living = await this.livingRanked();
    if (options?.ranked === true && this.ranked.available()) {
      try {
        // The server ends the life it is told to and no other. The one this device is living is named: the player was
        // asked about it on the way here. Any other in progress is theirs to decide about, and comes back as a question.
        return await this.ranked.start(lifeId, options.replace ?? living);
      } catch (error) {
        // The server cannot take it now. A life always begins: this one on the device, and it says so.
        if (!(error instanceof Unreachable)) throw error;
      }
    }
    // Only now, with a life certain to begin in its place, is the ranked one this device was living given up.
    if (living !== null) await this.ranked.giveUp(living);
    return this.local.start(lifeId);
  }

  async resume(): Promise<{ session: GameSession | null; lost: Lost | null }> {
    const note = rankedOf(await this.store.loadGame());
    if (note === null) return this.local.resume();
    // A ranked life goes on under the rules it began with, on the server. This page can only show and
    // preview a life of its own rules, so one begun under others cannot be continued here.
    if (note.engineVersion !== this.versions.engine || note.contentVersion !== this.versions.content) {
      // Written by a newer page than this one: it is not this page's to throw away, and the newer page can go on with it.
      if (later({ engine: note.engineVersion, content: note.contentVersion }, this.versions)) return { session: null, lost: 'newer' };
      // Begun under older rules. The note goes from this device; the life is left on the server, where
      // another device may still be living it under the rules it began with.
      await this.store.clearGame();
      return { session: null, lost: 'outdated' };
    }
    return { session: await this.ranked.resume(note), lost: null };
  }

  /**
   * Takes up the ranked life the player has in progress on another device, in place of whatever
   * this device holds. Null if it cannot be continued here: it is gone, or was begun under other
   * rules than this page plays.
   */
  async takeUp(life: RankedLifeInTheWay): Promise<GameSession | null> {
    if (life.engineVersion !== this.versions.engine || life.contentVersion !== this.versions.content) return null;
    return this.ranked.take(life);
  }

  async abandon(): Promise<void> {
    const living = await this.livingRanked();
    if (living !== null) await this.ranked.giveUp(living);
    await this.local.abandon();
  }

  /**
   * The ranked life this device is living, by its id: one it has shown the player and that is not
   * over. A note the account left here and nobody has opened is not one: the player has not seen
   * it, and so was never asked about it.
   */
  private async livingRanked(): Promise<string | null> {
    const note = rankedOf(await this.store.loadGame().catch(() => null));
    return note !== null && note.view !== null && !note.view.finished ? note.gameId : null;
  }
}

/** True if the first versions are later than the second: by the engine first, then by the content. */
function later(a: { engine: string; content: string }, b: { engine: string; content: string }): boolean {
  const order = (one: string, other: string): number => {
    const [left, right] = [one, other].map((version) => version.split('.').map(Number));
    for (let i = 0; i < Math.max(left.length, right.length); i++) {
      const gap = (left[i] ?? 0) - (right[i] ?? 0);
      if (gap !== 0) return gap;
    }
    return 0;
  };
  return (order(a.engine, b.engine) || order(a.content, b.content)) > 0;
}
