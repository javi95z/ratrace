// The scenes, one to a page, for the parity check against the web (apps/web/src/app/[locale]/kit/scene/page.tsx draws the
// same named game states). Development only, like /kit and /dev; everything it needs is in testing/scene.tsx.
import { Redirect, useLocalSearchParams } from 'expo-router';
import { SceneView } from '../testing/scene';

export default function SceneRoute() {
  const { name } = useLocalSearchParams<{ name?: string }>();
  if (!__DEV__) return <Redirect href="/" />;
  return <SceneView name={name} />;
}
