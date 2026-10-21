import type { RoundActions, RoundState } from '@ratrace/core/game/store';
import { runScene, SCENE_NOW, SCENES, sceneStore, screenOf } from '@ratrace/core/testing/scenes';
import type { Scene } from '@ratrace/core/testing/scenes';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { GameProvider, useGame } from '../game/context';
import type { Services } from '../game/context';
import { WeeklyChallenge } from '../game/screens/Challenge';
import { Home } from '../game/screens/Home';
import { Legal } from '../game/screens/Legal';
import { NewLife } from '../game/screens/NewLife';
import type { NewLifeOpened } from '../game/screens/NewLife';
import { Placeholder } from '../game/screens/Placeholder';
import { HomeSettingsSheet } from '../game/screens/Settings';
import { Screen } from '../ui/Page';
import { ReadText } from '../ui/text';
import { HudScene } from './hudScene';
import type { HudSceneOpen } from './hudScene';
import { memoryServices, speaking } from './memoryServices';

/*
 * The app's side of the scenes (packages/core/src/testing/scenes.ts): a named game state drawn on a screen, for the
 * parity check against the web, which draws the same scene on a page of its own (apps/web/src/app/[locale]/kit/scene/page.tsx).
 * Development only: the route that reaches it (`app/scene.tsx`) goes home anywhere else. Everything that wires a store
 * and sessions for it is here, behind the wall, and not in the route.
 */

/** A sheet shown open for a scene is not closed by anything. */
const nothing = (): void => {};

/** What draws a scene's screen: the scene itself is given, so a sheet the scene names (`scene.sheet`) is the screen's to open. */
export type SceneScreens = Readonly<Record<string, (scene: Scene) => ReactNode>>;

/**
 * What a scene of the page where a life is chosen has open at the start: its sheet, the question of ending the life in progress (`scene.sheet`), or
 * the list of the lives still locked (`new-locked`, which the web's page opens by pressing the button that folds it).
 */
const openedOf = (scene: Scene): NewLifeOpened | undefined => (scene.sheet === 'replace' ? 'replace' : scene.name === 'new-locked' ? 'locked' : undefined);

/** What a scene of the Hud has open at the start: the sheet it names (a figure's, the prison's, the crisis's), given to the Hud as its initial state. */
const HUD_OPEN: readonly HudSceneOpen[] = ['cash', 'flow', 'status', 'ratRace', 'jail', 'settings', 'news', 'crisis'];
const hudOpenOf = (scene: Scene): HudSceneOpen | undefined => HUD_OPEN.find((open) => open === scene.sheet);

/**
 * The screen each scene is drawn on, by the first word of its name (`screenOf`: `play-news-r1` is drawn on `play`). Each
 * screen's task puts the screen itself in place of the stand-in of phase 1; the web's page has the same list.
 */
export const SCENE_SCREENS: SceneScreens = {
  home: (scene) => (scene.sheet === 'settings' ? <><Home /><HomeSettingsSheet open onClose={nothing} /></> : <Home />),
  new: (scene) => <NewLife opened={openedOf(scene)} />,
  play: () => <Placeholder page="play" />,
  hud: (scene) => <HudScene open={hudOpenOf(scene)} />,
  records: () => <Placeholder page="records" />,
  collection: () => <Placeholder page="collection" />,
  challenge: () => <WeeklyChallenge />,
  legal: () => <Legal />,
};

/**
 * What a scene is drawn with: its store behind the game's services, in the language it names whatever the phone speaks,
 * and the day every scene is drawn on (`SCENE_NOW`) as the clock a screen reads the date by.
 */
export function servicesOf(scene: Scene, store: Awaited<ReturnType<typeof sceneStore>>): Services {
  return { ...speaking(memoryServices(store), scene.locale), now: () => SCENE_NOW };
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
 * Takes the steps a scene goes on with (`runScene`: the result of a card, the ledger of a round) once the game has opened on
 * the scene's store, on that game. Needs no more of the game than a screen has: its actions and its state through `useGame`.
 */
function Script({ scene, done }: { scene: Scene; done: () => void }) {
  // The round store's state as it stands, whenever the script asks (it reads the game between its steps): a selector is run
  // on every change the store makes, as it is told of them, so what this one saw last is the latest.
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

/**
 * A scene's screen on the phone it is drawn for: the shots' own (the whole screen), or a narrower one (`scene.width`), as a box that wide
 * in the middle of the screen. The simulator's width cannot be changed; the web's page draws the same box.
 */
function OfWidth({ width, children }: { width: number | undefined; children: ReactNode }) {
  if (width === undefined) return children;
  return <View style={{ flex: 1, width, alignSelf: 'center' }}>{children}</View>;
}

/**
 * A scene's game, with its screen: the game opened on the scene's store, the scene's steps taken on it, and then the screen,
 * which is first drawn at the stage the scene ends on, as the web's is.
 */
export function SceneGame({ scene, services, screens = SCENE_SCREENS }: { scene: Scene; services: Services; screens?: SceneScreens }) {
  const [over, setOver] = useState(false);
  const done = useCallback(() => setOver(true), []);
  return (
    <GameProvider services={services}>
      <Script scene={scene} done={done} />
      {over ? <OfWidth width={scene.width}>{screens[screenOf(scene)]?.(scene)}</OfWidth> : null}
    </GameProvider>
  );
}

/**
 * The scene named, drawn as the app would draw it: its store built, the game opened on it as it opens the life on the
 * phone, and the scene's screen inside. Nothing at all until the store is built (it takes a moment).
 */
export function SceneView({ name, screens = SCENE_SCREENS }: { name: string | undefined; screens?: SceneScreens }) {
  const scene = SCENES.find((candidate) => candidate.name === name);
  const drawable = scene !== undefined && screens[screenOf(scene)] !== undefined;
  const [built, setBuilt] = useState<{ scene: Scene; services: Services } | null>(null);
  useEffect(() => {
    if (scene === undefined || !drawable) return;
    let current = true;
    void sceneStore(scene.name).then((store) => current && setBuilt({ scene, services: servicesOf(scene, store) }));
    return () => {
      current = false;
    };
  }, [scene, drawable]);
  if (scene === undefined || !drawable) return <Unknown name={name} />;
  if (built?.scene !== scene) return null;
  // One game for one scene: another name is another store, not the same game opened on another life.
  return <SceneGame key={scene.name} scene={scene} services={built.services} screens={screens} />;
}
