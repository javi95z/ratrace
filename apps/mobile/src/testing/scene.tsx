import { SCENES, sceneStore } from '@ratrace/core/testing/scenes';
import type { Scene } from '@ratrace/core/testing/scenes';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { GameProvider } from '../game/context';
import type { Services } from '../game/context';
import { Home, Placeholder } from '../game/screens/Placeholder';
import { Screen } from '../ui/Page';
import { ReadText } from '../ui/text';
import { memoryServices, speaking } from './memoryServices';

/*
 * The app's side of the scenes (packages/core/src/testing/scenes.ts): a named game state drawn on a screen, for the
 * parity check against the web, which draws the same scene on a page of its own (apps/web/src/app/[locale]/kit/scene/page.tsx).
 * Development only: the route that reaches it (`app/scene.tsx`) goes home anywhere else. Everything that wires a store
 * and sessions for it is here, behind the wall, and not in the route.
 */

/**
 * The screen each scene is drawn on, by the first word of its name (`play-news-r1` is drawn on `play`). Each screen's
 * task puts the screen itself in place of the stand-in of phase 1; the web's page has the same list.
 */
export const SCENE_SCREENS: Readonly<Record<string, () => ReactNode>> = {
  home: () => <Home />,
  new: () => <Placeholder page="new" />,
  play: () => <Placeholder page="play" />,
  records: () => <Placeholder page="records" />,
  collection: () => <Placeholder page="collection" />,
};

/** What a scene is drawn with: its store behind the game's services, in the language it names, whatever the phone speaks. */
export function servicesOf(scene: Scene, store: Awaited<ReturnType<typeof sceneStore>>): Services {
  return speaking(memoryServices(store), scene.locale);
}

/** What a mistyped name gets: the scenes there are. */
function Unknown({ name }: { name: string | undefined }) {
  return (
    <Screen contentStyle={{ gap: 8 }}>
      <ReadText>{`unknown scene: ${name ?? '-'}`}</ReadText>
      {SCENES.map((scene) => (
        <ReadText key={scene.name}>{scene.name}</ReadText>
      ))}
    </Screen>
  );
}

/**
 * The scene named, drawn as the app would draw it: its store built, the game opened on it as it opens the life on the
 * phone, and the scene's screen inside. Nothing at all until the store is built (it takes a moment).
 */
export function SceneView({ name, screens = SCENE_SCREENS }: { name: string | undefined; screens?: Readonly<Record<string, () => ReactNode>> }) {
  const scene = SCENES.find((candidate) => candidate.name === name);
  const draw = scene === undefined ? undefined : screens[scene.name.split('-')[0]];
  const drawable = draw !== undefined;
  const [built, setBuilt] = useState<{ scene: Scene; services: Services } | null>(null);
  useEffect(() => {
    if (scene === undefined || !drawable) return;
    let current = true;
    void sceneStore(scene.name).then((store) => current && setBuilt({ scene, services: servicesOf(scene, store) }));
    return () => {
      current = false;
    };
  }, [scene, drawable]);
  if (scene === undefined || draw === undefined) return <Unknown name={name} />;
  if (built?.scene !== scene) return null;
  // One game for one scene: another name is another store, not the same game opened on another life.
  return (
    <GameProvider key={scene.name} services={built.services}>
      {draw()}
    </GameProvider>
  );
}
