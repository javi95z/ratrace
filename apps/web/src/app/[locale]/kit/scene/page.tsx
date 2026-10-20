'use client';

// The scenes, one to a page, for the phone app's parity check (apps/mobile/src/testing/scene.tsx draws the same named game
// states on a route of its own, /scene). On the expo branch only; never linked, never in the sitemap.
//
// A scene is a store (packages/core/src/testing/scenes.ts), built the same way on both sides. It is put behind the game's services
// in memory, as the tests of the screens put theirs (testing/render.tsx's `memoryServices`: the same ids, seeds and clock, and none
// of its test library), so nothing here reaches the device's database or the cloud: this page makes no client of the project.
import { SCENES, sceneServices, sceneStore } from '@ratrace/core/testing/scenes';
import type { Scene } from '@ratrace/core/testing/scenes';
import { use, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { GameProvider } from '@/game/context';
import type { Services } from '@/game/context';
import { Collection } from '@/game/screens/Collection';
import { Home } from '@/game/screens/Home';
import { NewLife } from '@/game/screens/NewLife';
import { Play } from '@/game/screens/Play';
import { Records } from '@/game/screens/Records';

/** The screen each scene is drawn on, by the first word of its name (`play-news-r1` is drawn on `play`): the web's pages. The phone's list is the same. */
const SCREENS: Readonly<Record<string, () => ReactNode>> = {
  home: () => <Home />,
  new: () => <NewLife />,
  play: () => <Play />,
  records: () => <Records />,
  collection: () => <Collection />,
};

export default function ScenePage({ searchParams }: { searchParams: Promise<{ name?: string }> }) {
  const { name } = use(searchParams);
  const scene = SCENES.find((candidate) => candidate.name === name);
  const draw = scene === undefined ? undefined : SCREENS[scene.name.split('-')[0]];
  const [built, setBuilt] = useState<{ scene: Scene; services: Services } | null>(null);
  useEffect(() => {
    if (scene === undefined || draw === undefined) return;
    let current = true;
    void sceneStore(scene.name).then((store) => current && setBuilt({ scene, services: sceneServices(store) }));
    return () => {
      current = false;
    };
    // The page names one scene for as long as it is open.
  }, [scene, draw]);
  if (scene === undefined || draw === undefined) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-2 px-3 pt-4">
        <p>unknown scene: {name ?? '-'}</p>
        {SCENES.map((one) => (
          <p key={one.name}>{one.name}</p>
        ))}
      </main>
    );
  }
  // Nothing until the store is built; the shots wait for the mark, which is on the page once the scene is.
  if (built?.scene !== scene) return null;
  return (
    <div data-scene={scene.name} className="contents">
      <GameProvider services={built.services}>{draw()}</GameProvider>
    </div>
  );
}
