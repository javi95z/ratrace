import { sceneStore } from '@ratrace/core/testing/scenes';
import type { StoredGame } from '@ratrace/core/session/types';
import { KvStore } from '../kvStore';

/*
 * For the timing probe's build only (`EXPO_PUBLIC_PERF=1`: app/perf.tsx requires this file behind the flag, and a build without it has none of it):
 * a life far into its course put where the phone keeps its life in progress, as a phone that had played it would have saved it, for the game to
 * take up. The life is a scene's (packages/core/src/testing/scenes.ts), played by its bot through the round store to its round and stage: the long
 * life that ends is `moment-escape`'s, the engineer of the first fixed seed at the finances of her fifteenth round, which the saver leaves the rat
 * race with. Only the life is put: the profile, its settings and what it has unlocked stay the phone's own.
 */
export async function putSceneLife(name: string): Promise<void> {
  const played = await sceneStore(name);
  const game = (await played.loadGame()) as StoredGame | null;
  if (game === null || game === undefined) throw new Error(`scene ${name} has no life to put on the phone`);
  await new KvStore().saveGame(game);
}
