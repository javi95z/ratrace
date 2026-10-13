import { Unreachable } from './errors';
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

  async start(lifeId: string, options?: { ranked?: boolean }): Promise<GameSession> {
    await this.giveUpRanked();
    if (options?.ranked === true && this.ranked.available()) {
      try {
        return await this.ranked.start(lifeId);
      } catch (error) {
        // The server cannot take it now. A life always begins: this one on the device, and it says so.
        if (!(error instanceof Unreachable)) throw error;
      }
    }
    return this.local.start(lifeId);
  }

  async resume(): Promise<{ session: GameSession | null; lost: Lost | null }> {
    const note = rankedOf(await this.store.loadGame());
    if (note === null) return this.local.resume();
    // A ranked life goes on under the rules it began with, on the server. This page can only show and
    // preview a life of its own rules, so one begun under others cannot be continued here.
    if (note.engineVersion !== this.versions.engine || note.contentVersion !== this.versions.content) {
      await this.ranked.giveUp(note.gameId);
      await this.store.clearGame();
      return { session: null, lost: 'outdated' };
    }
    return { session: await this.ranked.resume(note), lost: null };
  }

  async abandon(): Promise<void> {
    await this.giveUpRanked();
    await this.local.abandon();
  }

  /** A ranked life in progress on this device that is about to give way is given up on the server too. */
  private async giveUpRanked(): Promise<void> {
    const note = rankedOf(await this.store.loadGame().catch(() => null));
    if (note !== null && note.view?.finished !== true) await this.ranked.giveUp(note.gameId);
  }
}
