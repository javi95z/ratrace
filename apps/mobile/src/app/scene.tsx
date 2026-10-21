// The scenes, one to a page, for the parity check against the web (apps/web/src/app/[locale]/kit/scene/page.tsx draws the
// same named game states). Development only, like /kit and /dev; everything it needs is in testing/scene.tsx.
import { Redirect, useLocalSearchParams } from 'expo-router';
import { SceneView } from '../testing/scene';

export default function SceneRoute() {
  // `ready`: where the driver of the shots listens for the scene to say it is ready (scripts/shotDrivers.ts), when it is opened for a shot.
  const { name, ready } = useLocalSearchParams<{ name?: string; ready?: string }>();
  if (!__DEV__) return <Redirect href="/" />;
  const port = ready !== undefined && /^\d+$/.test(ready) ? Number(ready) : undefined;
  return <SceneView name={name} readyPort={port} />;
}
