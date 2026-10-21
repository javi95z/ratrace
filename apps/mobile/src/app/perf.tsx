// The timing probe's route: in a build made with EXPO_PUBLIC_PERF=1 only (anywhere else it goes home, and the life it puts is not in the build:
// ui/perf.test.ts). A scene's life (packages/core/src/testing/scenes.ts) put where the phone keeps its life in progress, taken up by the game and
// opened on Play, for what only a long life reaches: `theratrace:///perf?life=moment-escape`, the finances of the round that ends a fifteen-round life.
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useGame } from '../game/context';
import { Screen } from '../ui/Page';
import { ReadText } from '../ui/text';

type Lives = typeof import('../testing/perfLife');
// Cut out of a build without the flag: the condition is the flag itself, folded before the bundle's files are gathered (as ui/perf.ts's).
const lives: Lives | null = process.env.EXPO_PUBLIC_PERF === '1' ? (require('../testing/perfLife') as Lives) : null;

export default function PerfRoute() {
  const { life } = useLocalSearchParams<{ life?: string }>();
  if (lives === null || life === undefined) return <Redirect href="/" />;
  return <PutAndPlay put={lives.putSceneLife} life={life} />;
}

function PutAndPlay({ put, life }: { put(name: string): Promise<void>; life: string }) {
  const boot = useGame((s) => s.boot);
  const router = useRouter();
  const [said, setSaid] = useState(`putting ${life} on the phone`);
  useEffect(() => {
    void put(life)
      .then(boot)
      .then(() => router.replace('/play'))
      .catch((error: unknown) => setSaid(String(error)));
  }, [put, life, boot, router]);
  return (
    <Screen>
      <ReadText>{said}</ReadText>
    </Screen>
  );
}
