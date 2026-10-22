// The scenes, one to a page, for the parity check against the web (apps/web/src/app/[locale]/kit/scene/page.tsx draws the
// same named game states). Development only, like /kit and /dev; everything it needs is in testing/scene.tsx.
import { Redirect } from 'expo-router';

type Scenes = typeof import('../testing/scene');
// Cut out of a release build: `__DEV__` is written in as `false` there and Metro folds the condition before the bundle's files are gathered, so
// nothing of the scenes (their stores, the fixed sessions, the driver's address) is in it (ui/devRoutes.test.ts). As ui/perf.ts loads the probe.
const scenes: Scenes | null = __DEV__ ? (require('../testing/scene') as Scenes) : null;

export default function SceneRoute() {
  if (scenes === null) return <Redirect href="/" />;
  return <scenes.SceneRoute />;
}
