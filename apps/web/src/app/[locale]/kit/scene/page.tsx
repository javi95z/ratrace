'use client';

// The scenes, one to a page, for the phone app's parity check (apps/mobile/src/testing/scene.tsx draws the same named game
// states on a route of its own, /scene). On the expo branch only; never linked, never in the sitemap.
//
// A scene is a store (packages/core/src/testing/scenes.ts), built the same way on both sides, and sometimes steps taken once the
// game is open on it (the result of a card, the ledger of a round). This page puts the store behind the game's services in memory,
// as the tests of the screens put theirs (testing/render.tsx's `memoryServices`: the same ids, seeds and clock, and none of its
// test library), so the game it draws holds nothing of the device's database and nothing of the cloud. What the page around it does
// is not this page's: the shots keep the browser from the project (apps/mobile/scripts/shotDrivers.ts). The date is the shot's to
// set (the browser's clock is held at SCENE_NOW): a screen here reads it as it always does.
import type { RoundActions, RoundState } from '@ratrace/core/game/store';
import { runScene, SCENES, sceneServices, sceneStore, screenOf } from '@ratrace/core/testing/scenes';
import type { Scene } from '@ratrace/core/testing/scenes';
import { use, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { GameProvider, useGame } from '@/game/context';
import type { Services } from '@/game/context';
import { Collection } from '@/game/screens/Collection';
import { Home } from '@/game/screens/Home';
import { NewLife } from '@/game/screens/NewLife';
import { Play } from '@/game/screens/Play';
import { Records } from '@/game/screens/Records';

/** The screen each scene is drawn on, by the first word of its name (`screenOf`): the web's pages. The scene is given, so a sheet it names (`scene.sheet`) is the screen's to open. The phone's list is the same. */
const SCREENS: Readonly<Record<string, (scene: Scene) => ReactNode>> = {
  home: () => <Home />,
  new: () => <NewLife />,
  play: () => <Play />,
  records: () => <Records />,
  collection: () => <Collection />,
};

/**
 * Takes the steps a scene goes on with (`runScene`) once the game has opened on the scene's store, on that game. Needs no more of
 * the game than a screen has: its actions and its state through `useGame`.
 */
function Script({ scene, done }: { scene: Scene; done: () => void }) {
  // The round store's state as it stands, whenever the script asks (it reads the game between its steps): a selector is run on
  // every change the store makes, as it is told of them, so what this one saw last is the latest.
  const latest = useRef<(RoundState & RoundActions) | null>(null);
  const status = useGame((state) => {
    latest.current = state;
    return state.status;
  });
  const started = useRef(false);
  useEffect(() => {
    if (status === 'booting' || started.current) return;
    started.current = true;
    runScene(scene.name, { getState: () => latest.current as RoundState & RoundActions }).then(done, (error: unknown) => console.error(error));
  }, [status, scene, done]);
  return null;
}

/** A scene's game with its screen, which is first drawn at the stage the scene ends on; the page marks itself once it is. */
function SceneGame({ scene, services }: { scene: Scene; services: Services }) {
  const [over, setOver] = useState(false);
  const done = useCallback(() => setOver(true), []);
  return (
    <div data-scene={over ? scene.name : undefined} className="contents">
      <GameProvider services={services}>
        <Script scene={scene} done={done} />
        {over ? SCREENS[screenOf(scene)](scene) : null}
      </GameProvider>
    </div>
  );
}

export default function ScenePage({ searchParams }: { searchParams: Promise<{ name?: string }> }) {
  const { name } = use(searchParams);
  const scene = SCENES.find((candidate) => candidate.name === name);
  const drawable = scene !== undefined && SCREENS[screenOf(scene)] !== undefined;
  const [built, setBuilt] = useState<{ scene: Scene; services: Services } | null>(null);
  useEffect(() => {
    if (scene === undefined || !drawable) return;
    let current = true;
    void sceneStore(scene.name).then((store) => current && setBuilt({ scene, services: sceneServices(store) }));
    return () => {
      current = false;
    };
  }, [scene, drawable]);
  if (scene === undefined || !drawable) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-2 px-3 pt-4">
        <p>unknown scene: {name ?? '-'}</p>
        {SCENES.map((one) => (
          <p key={one.name}>{one.name}</p>
        ))}
      </main>
    );
  }
  // Nothing until the store is built.
  if (built?.scene !== scene) return null;
  return <SceneGame key={scene.name} scene={scene} services={built.services} />;
}
