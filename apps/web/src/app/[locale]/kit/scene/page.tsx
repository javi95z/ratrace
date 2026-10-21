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
import { PAGE_TURN_HELD_MS, runScene, SCENES, sceneServices, sceneStore, screenOf, SHINE_HELD_MS, turnOf } from '@ratrace/core/testing/scenes';
import type { Scene } from '@ratrace/core/testing/scenes';
import { content } from '@ratrace/content';
import { use, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { GameProvider, useGame, useT } from '@/game/context';
import type { Services } from '@/game/context';
import { AmountSheet } from '@/game/screens/AmountSheet';
import { WeeklyChallenge } from '@/game/screens/Challenge';
import { Collection } from '@/game/screens/Collection';
import { Basket, CityPreview } from '@/game/screens/Finance';
import { Home } from '@/game/screens/Home';
import { useShown } from '@/game/screens/Hud';
import { NewLife } from '@/game/screens/NewLife';
import { PageTurn } from '@/game/screens/PageTurn';
import { Play } from '@/game/screens/Play';
import { Records } from '@/game/screens/Records';
import { WorkPanel } from '@/game/screens/Work';
import { Legal } from './Legal';

/**
 * The web's front door keeps its settings behind a button of its own and takes no word of whether they are open (its sheet is not
 * exported), so a scene that names them has the page press that button once the door is drawn: in the page, as a person would, and
 * not by the shot, which cannot tap. The phone's registry draws the sheet beside the door instead.
 */
function Settled({ sheet, children }: { sheet: string | undefined; children: ReactNode }) {
  useEffect(() => {
    if (sheet === 'settings') document.querySelector<HTMLElement>('button[aria-label="Settings"]')?.click();
  }, [sheet]);
  return children;
}

/**
 * The page where a life is chosen has no initial state to take, and the web may not be changed to give it one, so a scene that has something open has the
 * page press what opens it once the screen is drawn: in the page, as a person would, and not by the shot. A scene's name says which: the list of the lives
 * still locked is opened by the button that folds it, and the question of ending the life in progress (`sheet: 'replace'`) by the button that starts one.
 * The phone's registry gives the same two to its screen as an initial state (`opened`).
 */
const PRESSED: Readonly<Record<string, string>> = {
  'new-locked': 'main button[aria-expanded]',
  'new-replace': 'main div.fixed button',
};
function Pressed({ selector, children }: { selector: string | undefined; children: ReactNode }) {
  // Once: the dev server runs an effect twice before the page is drawn again, and a second press would shut again what the first opened.
  const pressed = useRef(false);
  useEffect(() => {
    if (selector === undefined || pressed.current) return;
    pressed.current = true;
    document.querySelector<HTMLElement>(selector)?.click();
  }, [selector]);
  return children;
}

/**
 * The web's Hud has no initial state either: a scene of it that names a sheet has the page press the figure (or the tag) that opens it, once the
 * screen is drawn, as for the page where a life is chosen. Each is the Hud's own button, inside its `header`: the cash (marked as where coins
 * land), the second and third figures of its grid, the way out (the one block button of the header), the tag of someone in prison, the strip of a
 * crisis that hangs under it. The phone's
 * Hud is given the sheet as its initial state (`open`).
 */
const HUD_SHEETS: Readonly<Record<string, string>> = {
  cash: 'header [data-hud-cash] button',
  flow: 'header .grid-cols-3 > button:nth-child(2)',
  status: 'header .grid-cols-3 > button:nth-child(3)',
  ratRace: 'header button.block.min-h-11',
  jail: 'header button.mt-1.inline-flex',
  crisis: 'header button.frame-wine',
};

/**
 * A scene's screen on the phone it is drawn for: the shots' own (the whole page), or a narrower one (`scene.width`), as a box that wide in the
 * middle of the page. The phone's simulator cannot be made narrower, so its scene draws the same box.
 */
function OfWidth({ width, children }: { width: number | undefined; children: ReactNode }) {
  if (width === undefined) return children;
  return <div style={{ width, marginInline: 'auto' }}>{children}</div>;
}

/** Nothing is done when the calendar of a scene has run its time: it is a picture, and stays. */
const nothing = (): void => {};

/**
 * The calendar's two animations (the new page shown, the old one torn off) held still `PAGE_TURN_HELD_MS` into their run: paused, started that long
 * in the past (a negative delay), so the stylesheet's own keyframes are what is drawn, as the kit's motion page holds every effect. In the page from
 * before the calendar is drawn, so they begin there and stay.
 */
const HOLD_TURN = `.animate-page, .animate-tear { animation-play-state: paused !important; animation-delay: -${PAGE_TURN_HELD_MS}ms !important; }`;

/**
 * The shine of a rare card held still `SHINE_HELD_MS` into its runs, as the kit's motion page holds it: its rainbow and its band of light paused
 * there, and a legendary card's sparks at the end of their flight (gone). Only the card's own (`article`): the Hud's light, on a status that
 * rose, is not touched. In the page with Play, from before a card is drawn. The phone's scene gives its card the same moments (`HeldShine`).
 */
const HOLD_SHINE = [
  `article .animate-holo { animation-play-state: paused !important; animation-delay: -${SHINE_HELD_MS.holo}ms !important; }`,
  `article .animate-glint { animation-play-state: paused !important; animation-delay: -${SHINE_HELD_MS.glint}ms !important; }`,
  `article .animate-spark { animation-play-state: paused !important; animation-delay: -${SHINE_HELD_MS.spark}ms !important; }`,
].join(' ');

/**
 * The play screen of a scene, and over it the calendar of a round just turned where the scene has one (`turnOf`), held at one moment of its run:
 * drawn beside the screen, as the screen draws it when the round goes by under it. The phone's scene gives its calendar the same moment. A rare
 * card's shine is held still too (`HOLD_SHINE`).
 */
function PlayScene({ scene }: { scene: Scene }) {
  const turn = turnOf(scene);
  return (
    <>
      <style>{HOLD_SHINE}</style>
      <Play />
      {turn ? <style>{HOLD_TURN}</style> : null}
      {turn ? <PageTurn from={turn.from} to={turn.to} onDone={nothing} /> : null}
    </>
  );
}

/**
 * The finances have no initial state either (their tab and their sheets are their own), so a scene of them has the page press what a player would, once
 * the screen is drawn, as for the Hud: the tab it names (each of the web's tabs is marked with its id, `data-tab`), then what opens the sheet it names.
 * The pension plan's line is the first item of the finances that opens a sheet (`data-finance-item` with a popup: the plans' lines come after it); a
 * share's sheet is opened by its row of the market, the one item of the market that draws its mark; a thing's sheet by its tile on the shop's shelf, the
 * one that draws its picture (`item-<id>`). The basket is Play's, exported by Finance: the page
 * draws it beside Play, as the phone's registry does. The phone's Finance is given the tab and the sheet as its initial state (`FinanceOpened`).
 */
const FINANCE_SHEETS: Readonly<Record<string, string>> = {
  pension: 'main [data-finance-item][aria-haspopup="dialog"]',
  'buy-apple': 'main [role="tabpanel"] [data-finance-item]:has(img[src*="/logo.apple."])',
  move: 'main [role="tabpanel"] button:has(img[src*="/icon.move."])',
  'item-watch_omega': 'main [role="tabpanel"] [data-finance-item]:has(img[src*="/item.watch_omega."])',
};

/** What the page presses for a scene of the finances, in turn: the tab it names, then what opens its sheet. */
const financePresses = (scene: Scene): string[] => [...(scene.tab === undefined ? [] : [`main [data-tab="${scene.tab}"]`]), ...(scene.sheet === undefined || FINANCE_SHEETS[scene.sheet] === undefined ? [] : [FINANCE_SHEETS[scene.sheet]])];

/**
 * Presses each of `selectors` in turn, once the screen is drawn: each as soon as it is there (a tab pressed draws its panel a frame or two later, and
 * the row in it is pressed then), and each once. Once for all, as `Pressed`: the dev server runs an effect twice, and a second press of a tab already
 * open is nothing, but of a row it would open its sheet again.
 */
function PressedInTurn({ selectors, children }: { selectors: readonly string[]; children: ReactNode }) {
  const pressed = useRef(false);
  useEffect(() => {
    if (selectors.length === 0 || pressed.current) return;
    pressed.current = true;
    let at = 0;
    let frames = 0;
    const next = () => {
      const target = document.querySelector<HTMLElement>(selectors[at]);
      if (target) {
        target.click();
        at += 1;
      }
      frames += 1;
      // Five seconds of frames at most (a dev server draws slowly): a selector that never matches leaves the scene as it is, for the shot to show.
      if (at < selectors.length && frames < 300) requestAnimationFrame(next);
    };
    next();
  }, [selectors]);
  return children;
}

/** A sheet that asks nothing of the game is never taken: a scene's sheet stays open whatever is pressed in it. */
const refused = (): boolean => false;

/**
 * The sheet that moves cash to savings over the finances (`amount-savings`): Finance's portfolio keeps the sheet it opens to itself, with no
 * initial state to take, so the page draws the same AmountSheet with the same words and the cash shown beside Play, as the phone's registry
 * does (as recorded in Task 10, before the phone had Finance). The shot shows Play's Hud alone under it (`HUD_ONLY`, apps/mobile/scripts/sceneShots.ts).
 * (A legendary badge needs nothing of the kind: the result of the card that earned it, Play's own stage, opens its sheet, `celebrate`.)
 */
function SavingsScene() {
  const amount = useT('finance.amount');
  const cash = useShown().player.cash;
  return (
    <>
      <Play />
      <AmountSheet title={amount('save')} max={cash} onClose={nothing} onConfirm={refused} />
    </>
  );
}

/**
 * The legendary sheet of a step that earned badges has no initial state either: a scene of the step after it (`celebrate-earned`) has the page press
 * its one button (the sheet is marked with the badge, `data-legendary`), once, as a person would. The phone's Celebrations is told it was seen.
 */
const TAKEN_IN = '[data-legendary] button';

/**
 * The city the card on screen offers to move to, its sheet open beside Play (`play-cards-city`): the sheet the card's link opens (`CityPreview`,
 * which the web's Finance exports, as Cards opens it), for the life as the card has it, drawn beside Play as the basket is. The phone's registry
 * draws the same.
 */
function CardCity() {
  const view = useGame((s) => s.view);
  if (!view || view.phase !== 'cards') return null;
  const card = content.cards.find((def) => def.id === view.hand[view.answered]);
  const city = card?.options.find((option) => option.effects?.moveCity !== undefined)?.effects?.moveCity;
  return city ? <CityPreview cityId={city} view={view} onClose={nothing} /> : null;
}

/**
 * The work panel of the profile (`work-panel`) on a page of its own, in the column the game's pages stand in (`mx-auto w-full max-w-md px-3`, 16 above
 * and below it as the phone's page has): given the life as it stands, as the profile gives it. The phone's registry draws the same.
 */
function WorkScene() {
  const shown = useShown();
  return (
    <main className="mx-auto min-h-safe w-full max-w-md px-3 pb-4 pt-4">
      <WorkPanel shown={shown} />
    </main>
  );
}

/** The screen each scene is drawn on, by the first word of its name (`screenOf`): the web's pages. The scene is given, so a sheet it names (`scene.sheet`) is the screen's to open. The phone's list is the same. */
const SCREENS: Readonly<Record<string, (scene: Scene) => ReactNode>> = {
  home: (scene) => (scene.sheet === undefined ? <Home /> : <Settled sheet={scene.sheet}><Home /></Settled>),
  new: (scene) => <Pressed selector={PRESSED[scene.name]}><NewLife /></Pressed>,
  play: (scene) => (scene.sheet === 'city' ? <><PlayScene scene={scene} /><CardCity /></> : <PlayScene scene={scene} />),
  finance: (scene) => (scene.sheet === 'basket' ? <><PlayScene scene={scene} /><Basket onClose={nothing} /></> : <PressedInTurn selectors={financePresses(scene)}><PlayScene scene={scene} /></PressedInTurn>),
  hud: (scene) => <Pressed selector={HUD_SHEETS[scene.sheet ?? '']}><Play /></Pressed>,
  amount: () => <SavingsScene />,
  celebrate: (scene) => (scene.name === 'celebrate-earned' ? <Pressed selector={TAKEN_IN}><Play /></Pressed> : <Play />),
  records: () => <Records />,
  collection: () => <Collection />,
  challenge: () => <WeeklyChallenge />,
  legal: () => <Legal />,
  work: () => <WorkScene />,
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
        {over ? <OfWidth width={scene.width}>{SCREENS[screenOf(scene)](scene)}</OfWidth> : null}
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
    void sceneStore(scene.name).then((store) => current && setBuilt({ scene, services: sceneServices(store, scene.name) }));
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
