// Deleting an account, asked for by its own player: the account and everything of theirs goes, for good.
//
// Everything a player has in the database hangs from their row of `auth.users` and goes with it (`on delete
// cascade`): the profile and its name in the rankings, the lives in progress and the finished ones, the progress,
// friends and requests both ways, the games with others they were in, the challenge entries, the notices, the
// counts of their calls. A game with others they opened stays for the others in it, with no host (`on delete set
// null`). What is kept of the game is nobody's: the errors met (`error_kinds`) and the events counted by day
// (`private.app_events`) carry nothing of who. Tested without a server; the function in `delete-account/index.ts`
// is the project behind it.

import type { Reply } from './replay.ts';

export interface DeletionDeps {
  /** Counts a call; false if it is one too many. */
  allow(userId: string): Promise<boolean>;
  /** Removes the player's account, and with it everything of theirs. Throws if it could not. */
  remove(userId: string): Promise<void>;
}

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/**
 * Deletes the account of whoever asks. The request must say so in as many words (`confirm: true`), so that nothing sent by mistake
 * removes anyone; who goes is the token's player, never anyone the body names. Nothing is answered `deleted` that is not gone.
 */
export async function deleteAccount(deps: DeletionDeps, userId: string, raw: unknown): Promise<Reply> {
  if (!isRecord(raw) || raw.confirm !== true) return { status: 400, body: { error: 'bad-request', field: 'confirm' } };
  if (!(await deps.allow(userId))) return { status: 429, body: { error: 'too-many' } };
  await deps.remove(userId);
  return { status: 200, body: { deleted: true } };
}
