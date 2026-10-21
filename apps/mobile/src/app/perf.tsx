// The timing probe's route: in a build made with EXPO_PUBLIC_PERF=1 only (anywhere else it goes home, and the life it puts is not in the build:
// ui/perf.test.ts). A scene's life (packages/core/src/testing/scenes.ts) put where the phone keeps its life in progress, taken up by the game and
// opened on Play, for what only a long life reaches: `theratrace:///perf?life=moment-escape`, the finances of the round that ends a fifteen-round life.
// And a scene's finished lives, many times over, opened on the records: `theratrace:///perf?runs=records-three&copies=20`, sixty lives to fling.
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useGame } from '../game/context';
import { Screen } from '../ui/Page';
import { ReadText } from '../ui/text';

type Lives = typeof import('../testing/perfLife');
// Cut out of a build without the flag: the condition is the flag itself, folded before the bundle's files are gathered (as ui/perf.ts's).
const lives: Lives | null = process.env.EXPO_PUBLIC_PERF === '1' ? (require('../testing/perfLife') as Lives) : null;

export default function PerfRoute() {
  const { life, runs, copies } = useLocalSearchParams<{ life?: string; runs?: string; copies?: string }>();
  if (lives === null) return <Redirect href="/" />;
  if (life !== undefined) return <PutAndOpen put={() => lives.putSceneLife(life)} what={life} to="/play" />;
  if (runs !== undefined) return <PutAndOpen put={() => lives.putSceneRuns(runs, Number(copies ?? 1))} what={`${runs} × ${copies ?? 1}`} to="/records" />;
  return <Redirect href="/" />;
}

function PutAndOpen({ put, what, to }: { put(): Promise<void>; what: string; to: '/play' | '/records' }) {
  const boot = useGame((s) => s.boot);
  const router = useRouter();
  const [said, setSaid] = useState(`putting ${what} on the phone`);
  useEffect(() => {
    void put()
      .then(boot)
      // Over the home screen alone, as a player opens it: a route opened again does not leave another screen of the game under this one.
      .then(() => {
        if (router.canDismiss()) {
          router.dismissAll();
          router.push(to);
        } else router.replace(to);
      })
      .catch((error: unknown) => setSaid(String(error)));
    // Once, as the route opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Screen>
      <ReadText>{said}</ReadText>
    </Screen>
  );
}
