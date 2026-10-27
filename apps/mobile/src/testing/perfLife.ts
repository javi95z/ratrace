import { bots, content, lives } from '@ratrace/content';
import { fixedSessions } from '@ratrace/core/session/fixed';
import { LocalSessions } from '@ratrace/core/session/local';
import { MemoryStore } from '@ratrace/core/session/memory';
import { newProfile } from '@ratrace/core/session/types';
import { sceneStore } from '@ratrace/core/testing/scenes';
import type { FinishedRun, StoredGame } from '@ratrace/core/session/types';
import { KvStore } from '../kvStore';

/*
 * For the timing probe's build only (`EXPO_PUBLIC_PERF=1`: app/perf.tsx requires this file behind the flag, and a build without it has none of it):
 * a life far into its course put where the phone keeps its life in progress, as a phone that had played it would have saved it, for the game to
 * take up. The life is a scene's (packages/core/src/testing/scenes.ts), played by its bot through the round store to its round and stage: the long
 * life that ends is `moment-escape`'s, the engineer of screen-seed-335 at the finances of her seventeenth round, which the saver leaves the rat
 * race with. Only the life is put: the profile, its settings and what it has unlocked stay the phone's own.
 */
export async function putSceneLife(name: string, toLastRound = false): Promise<void> {
  const played = await sceneStore(name);
  // Played on by the saver to the finances of the life's last round, where playing the round ends the life (`&last=1`).
  if (toLastRound) {
    const { session } = await fixedSessions(played).resume();
    if (session === null) throw new Error(`scene ${name} has no life to play on`);
    const saver = bots.find((bot) => bot.id === 'saver');
    if (saver === undefined) throw new Error('no saver among the bots');
    const atFinances = async () => {
      while (session.view().phase === 'cards') await session.answerCard(saver.pick(content, session.view()));
    };
    await atFinances();
    while (session.view().round < content.rounds - 1) {
      await session.playRound({ orders: saver.orders(content, session.view()) });
      await atFinances();
    }
  }
  const game = (await played.loadGame()) as StoredGame | null;
  if (game === null || game === undefined) throw new Error(`scene ${name} has no life to put on the phone`);
  await new KvStore().saveGame(game);
}

/**
 * A scene's finished lives put where the phone keeps them, each `copies` times (each copy a life of its own: its id, and a day further back), for a
 * list of many lives to be flung: the records of a phone that has played `copies` times as much as the scene.
 */
export async function putSceneRuns(name: string, copies: number): Promise<void> {
  const runs: FinishedRun[] = await (await sceneStore(name)).listRuns();
  if (runs.length === 0) throw new Error(`scene ${name} has no finished life to put on the phone`);
  const store = new KvStore();
  for (let copy = 0; copy < copies; copy++) {
    for (const run of runs) await store.addRun({ ...run, runId: `${run.runId}-${copy}`, finishedAt: run.finishedAt - copy * 86_400_000 });
  }
}

/**
 * A life whose next round both takes it out of the rat race and earns a legendary badge (`escaped_before_40`): the influencer of this seed, played by
 * the landlord to the finances of her eighth round (age 36), where playing the round as it stands, with no orders (as a player presses it), leaves the
 * rat race at 36. For the device check of two sheets at once (the moment of leaving, and the legendary badge's). Found by playing every life with every
 * bot from a few seeds, since savings count half towards the way out (engine 0.45); held by this file's test.
 */
export const EARLY_ESCAPE = { life: 'influencer', bot: 'landlord', seed: 'escape-influencer-landlord-18'.padEnd(64, '0'), round: 7 } as const;

/** That life, played on a store of its own (every life open to it) to its round, at the finances: the store, and its session. */
export async function earlyEscape(): Promise<{ store: MemoryStore; session: NonNullable<Awaited<ReturnType<LocalSessions['resume']>>['session']> }> {
  const store = new MemoryStore();
  await store.saveProfile({ ...newProfile(), unlocked: Object.fromEntries(lives.map((life) => [life.id, { at: 0, gameId: 'perf' }])) });
  let n = 0;
  const sessions = new LocalSessions(store, content, lives, { newId: () => `early-escape-${(n += 1)}`, newSeed: () => EARLY_ESCAPE.seed, now: () => 0 });
  const session = await sessions.start(EARLY_ESCAPE.life);
  const bot = bots.find((one) => one.id === EARLY_ESCAPE.bot);
  if (bot === undefined) throw new Error(`no ${EARLY_ESCAPE.bot} among the bots`);
  const atFinances = async () => {
    while (session.view().phase === 'cards') await session.answerCard(bot.pick(content, session.view()));
  };
  await atFinances();
  while (session.view().round < EARLY_ESCAPE.round) {
    await session.playRound({ orders: bot.orders(content, session.view()) });
    await atFinances();
  }
  return { store, session };
}

/** That life put where the phone keeps its life in progress (only the life: the profile stays the phone's own). */
export async function putEarlyEscape(): Promise<void> {
  const { store } = await earlyEscape();
  const game = (await store.loadGame()) as StoredGame | null;
  if (game === null) throw new Error('the early escape has no life to put on the phone');
  await new KvStore().saveGame(game);
}
