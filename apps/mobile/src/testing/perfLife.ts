import { bots, content } from '@ratrace/content';
import { fixedSessions } from '@ratrace/core/session/fixed';
import { sceneStore } from '@ratrace/core/testing/scenes';
import type { FinishedRun, StoredGame } from '@ratrace/core/session/types';
import { KvStore } from '../kvStore';

/*
 * For the timing probe's build only (`EXPO_PUBLIC_PERF=1`: app/perf.tsx requires this file behind the flag, and a build without it has none of it):
 * a life far into its course put where the phone keeps its life in progress, as a phone that had played it would have saved it, for the game to
 * take up. The life is a scene's (packages/core/src/testing/scenes.ts), played by its bot through the round store to its round and stage: the long
 * life that ends is `moment-escape`'s, the engineer of the first fixed seed at the finances of her fifteenth round, which the saver leaves the rat
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
