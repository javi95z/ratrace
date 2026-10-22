'use client';

// The scenes, one to a page, for the phone app's parity check (apps/mobile/src/testing/scene.tsx draws the same named game
// states on a route of its own, /scene). On the expo branch only; never linked, never in the sitemap.
//
// A scene is a store (packages/core/src/testing/scenes.ts), built the same way on both sides, and sometimes steps taken once the
// game is open on it (the result of a card, the ledger of a round). This page puts the store behind the game's services in memory,
// as the tests of the screens put theirs (testing/render.tsx's `memoryServices`: the same ids, seeds and clock, and none of its
// test library), so the game it draws holds nothing of the device's database and nothing of the cloud (a scene of the game online has a
// cloud of its own, in memory, `sceneCloud`: never the project's). What the page around it does
// is not this page's: the shots keep the browser from the project (apps/mobile/scripts/shotDrivers.ts). The date is the shot's to
// set (the browser's clock is held at SCENE_NOW): a screen here reads it as it always does.
import type { RoundActions, RoundState } from '@ratrace/core/game/store';
import { PAGE_TURN_HELD_MS, runScene, SCENES, sceneServices, sceneStore, screenOf, SHINE_HELD_MS, turnOf } from '@ratrace/core/testing/scenes';
import type { Scene } from '@ratrace/core/testing/scenes';
import { rankingsOpening, sceneCommunity } from '@ratrace/core/testing/sceneCommunity';
import { sceneCloud, sceneMember } from '@ratrace/core/testing/sceneCloud';
import { sceneInvite, sceneRooms } from '@ratrace/core/testing/sceneRooms';
import { ratLookOf } from '@ratrace/core/game/avatar';
import { content, progressOf } from '@ratrace/content';
import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { GameProvider, useGame, useProfile, useT, useWords } from '@/game/context';
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
import { Rankings } from '@/game/screens/Rankings';
import { WorkPanel } from '@/game/screens/Work';
import { RivalsBoard } from '@/game/screens/Rivals';
import { PlayerProfile } from '@/game/screens/PlayerProfile';
import { useRankName } from '@/game/screens/RankCard';
import { RatEditor } from '@/game/screens/RatEditor';
import { Room } from '@/game/screens/Room';
import { Panel } from '@/ui/kit';
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
 * open is nothing, but of a row it would open its sheet again. A press is a selector, or a function that finds its thing (`null` while it is not there).
 *
 * A sheet opened gives the focus to what is in it (the slider of an amount, its panel), and the browser scrolls the page to show what took the focus,
 * though the sheet is fixed over it (measured: 228 down under the pension's sheet). The phone's scene opens the sheet as the screen's initial state, at
 * the top of its page, and moves no focus: so once everything is pressed the page is put back at its top (a few frames on, after the focus has moved),
 * and both shots show the same page under the backdrop.
 */
function PressedInTurn({ selectors, children }: { selectors: ReadonlyArray<string | (() => HTMLElement | null)>; children: ReactNode }) {
  const pressed = useRef(false);
  useEffect(() => {
    if (selectors.length === 0 || pressed.current) return;
    pressed.current = true;
    let at = 0;
    let frames = 0;
    const settle = (left: number) => {
      if (left > 0) requestAnimationFrame(() => settle(left - 1));
      else window.scrollTo(0, 0);
    };
    const next = () => {
      const press = selectors[at];
      const target = typeof press === 'string' ? document.querySelector<HTMLElement>(press) : press();
      if (target) {
        target.click();
        at += 1;
      }
      frames += 1;
      // Five seconds of frames at most (a dev server draws slowly): a selector that never matches leaves the scene as it is, for the shot to show.
      if (at < selectors.length && frames < 300) requestAnimationFrame(next);
      else settle(5);
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

/**
 * The player's profile has no initial state on the web either (on a phone it is the sheet Play opens from the portrait), so a scene of it has the page
 * press the portrait, and then what the scene names in the profile's sheet: one of the things owned (`profile-owned`: the item's id, its button titled
 * with its name), or a line of the balance sheet (`balance-r6`: the line's id, its button starting with its label). The phone's registry draws the
 * profile beside Play and gives it the thing or the line as its initial state (`ProfileOpened`).
 */
function ProfileScene({ scene, line }: { scene: Scene; line?: string }) {
  const hud = useT('hud');
  const profile = useT('profile');
  const { names } = useWords();
  const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
  const find = [
    () => document.querySelector<HTMLElement>(`button[aria-label="${hud('openProfile')}"]`),
    ...(scene.sheet === undefined
      ? []
      : line === undefined
        ? [() => dialog()?.querySelector<HTMLElement>(`button[title="${names.items[scene.sheet as string]}"]`) ?? null]
        : [() => [...(dialog()?.querySelectorAll<HTMLElement>('button[aria-haspopup="dialog"]') ?? [])].find((button) => button.textContent?.startsWith(profile(line))) ?? null]),
  ];
  return (
    <PressedInTurn selectors={find}>
      <PlayScene scene={scene} />
    </PressedInTurn>
  );
}

/**
 * Where the player stands among the rivals (`rivals-r6`): the board alone in the page's column (the web's `main` of a page), as the phone's registry draws
 * it. In the profile it is far down a sheet that scrolls, where no shot could see it.
 */
function RivalsScene() {
  const history = useGame((s) => s.history);
  return (
    <main className="mx-auto flex w-full max-w-md flex-col px-3 pt-4">
      <RivalsBoard history={history} />
    </main>
  );
}

/**
 * The end of a life has no initial state on the web either: a scene of it with the picture to share open (`end-share`) has the page press the end's own
 * button for it (`Share this life`, in the end's `main`), once the screen is drawn, as a person would. The phone's End is given it as its initial state
 * (`EndOpened`). The end is Play's last stage on both sides.
 */
function EndScene({ scene }: { scene: Scene }) {
  const share = useT('share');
  const find = scene.sheet === 'share' ? [() => [...document.querySelectorAll<HTMLElement>('main button')].find((button) => button.textContent === share('open')) ?? null] : [];
  return (
    <PressedInTurn selectors={find}>
      <Play />
    </PressedInTurn>
  );
}

/**
 * The records have no initial state either, and their lives are read from the device a moment after the page is drawn: a scene that names a
 * life's sheet (`sheet`: its id) has the page press the first life of the list (the latest, which the scene names) as soon as it is drawn, once.
 * Each past life is a button that opens a sheet; nothing before them on the page does (the bests are lines, the way back a link). The phone's
 * Records is given the life (`opened`).
 */
const FIRST_LIFE = 'main button[aria-haspopup="dialog"]';
function PressedWhenDrawn({ selector, children }: { selector: string | undefined; children: ReactNode }) {
  // Once: the dev server runs an effect twice before the page is drawn again, and the sheet is opened by the first press.
  const pressed = useRef(false);
  useEffect(() => {
    if (selector === undefined || pressed.current) return;
    // Pressed if it is there, and said whether it is: there is nothing more to watch for once it has been.
    const press = () => {
      const found = document.querySelector<HTMLElement>(selector);
      if (found === null) return false;
      if (!pressed.current) {
        pressed.current = true;
        found.click();
      }
      return true;
    };
    if (press()) return;
    const watch = new MutationObserver(() => {
      if (press()) watch.disconnect();
    });
    watch.observe(document.body, { childList: true, subtree: true });
    return () => watch.disconnect();
  }, [selector]);
  return children;
}

/** The collection opens on its badges: a scene of its things has the page press their tab, once the screen is drawn. The phone's Collection is given the tab (`tab`). */
/**
 * The front door has no initial state for the question of the life waiting in the account (`home-offer`) either: the page presses the button that
 * asks it, found by its words, once the door is drawn. The account of the scene (`sceneCloud`, in its services) holds the life from the start. The
 * phone's front door is given the question open (`HomeOpened`).
 */
function OfferPressed({ children }: { children: ReactNode }) {
  const words = useT('home')('accountLife');
  const selectors = useMemo(() => [() => [...document.querySelectorAll<HTMLElement>('main button')].find((button) => button.textContent?.startsWith(words)) ?? null], [words]);
  return <PressedInTurn selectors={selectors}>{children}</PressedInTurn>;
}

const COLLECTION_TABS: Readonly<Record<string, string>> = {
  'collection-items': 'main [data-tab="items"]',
};

/**
 * The rankings have no initial state either (the web reads a link's `#friends` and `?tab=challenge`, which this page's address cannot carry for
 * them): a scene of them has the page press the tab its name says (`rankingsOpening`; each of the web's tabs is marked with its id, `data-tab`), and
 * for the name being changed (`rankings-nickname`), the button of the player's panel that opens its form, once the name is read. The phone's
 * Rankings is given the tab and the open form as its initial state.
 */
function RankingsScene({ scene }: { scene: Scene }) {
  const t = useT('rankings');
  const opening = rankingsOpening(scene.name);
  const find = [
    ...(opening === null || opening.tab === 'all' ? [] : [`main [data-tab="${opening.tab}"]`]),
    ...(opening?.naming ? [() => [...document.querySelectorAll<HTMLElement>('main button')].find((button) => button.textContent === t('changeName')) ?? null] : []),
  ];
  return (
    <PressedInTurn selectors={find}>
      <Rankings />
    </PressedInTurn>
  );
}

/**
 * The rat of the player of a scene, a tab of it at a time (`player-editor-*`): the profile's panel alone in the page's column, as the profile draws
 * it (far down the profile, no shot could see it there). The editor has no initial state, so the page presses the tab the scene names (each of the
 * web's tabs is marked with its id, `data-tab`), as for the finances; the first, the rat itself, is open already. The phone's registry draws the same
 * panel and gives it the tab. A choice pressed does nothing: a scene is a picture.
 */
function RatScene({ scene }: { scene: Scene }) {
  const t = useT('player');
  const profile = useProfile();
  const { text } = useWords();
  const rankName = useRankName();
  const member = sceneMember(scene.name);
  const tab = scene.name.slice('player-editor-'.length);
  if (member === null) return null;
  return (
    <PressedInTurn selectors={tab === 'body' ? [] : [`main [data-tab="${tab}"]`]}>
      <main className="mx-auto flex w-full max-w-md flex-col px-3 pt-4">
        <Panel title={t('rat')} label={t('rat')}>
          <RatEditor
            look={ratLookOf(member.avatar, member.userId)}
            earned={profile.badges}
            rank={progressOf(profile.rank.points).rank}
            badgeName={(id) => text.badges[id]?.name ?? id}
            rankName={rankName}
            onPick={nothing}
            onLocked={nothing}
          />
        </Panel>
      </main>
    </PressedInTurn>
  );
}

/**
 * The player's own profile (`player-member`), and the same with their friend code just copied (`player-friend-code`): the profile has no initial
 * state, so the page presses the code's button once the profile has read it, as a person would, and the toast says it was copied. The phone's
 * PlayerProfile is given the code as copied (`copied`).
 */
function PlayerScene({ scene }: { scene: Scene }) {
  const code = sceneMember(scene.name)?.friendCode;
  const find = scene.name === 'player-friend-code' && code !== undefined ? [() => [...document.querySelectorAll<HTMLElement>('main button')].find((button) => button.textContent?.includes(code)) ?? null] : [];
  return (
    <PressedInTurn selectors={find}>
      <PlayerProfile />
    </PressedInTurn>
  );
}

/**
 * The games with others at the scene's table (`sceneRooms`). The web's door reads an invitation's code from the page's address, once it is drawn: a
 * scene come by one (`room-join-code`) has the page put the code in its address first, as the link would, then draws the door. The phone's registry
 * gives the code to its screen, as its route does.
 */
function RoomScene({ scene }: { scene: Scene }) {
  const code = sceneInvite(scene.name);
  const [ready, setReady] = useState(code === undefined);
  useEffect(() => {
    if (code === undefined) return;
    const address = new URL(window.location.href);
    address.searchParams.set('code', code);
    window.history.replaceState(null, '', address);
    setReady(true);
  }, [code]);
  return ready ? <Room /> : null;
}

/**
 * The screen each scene is drawn on, by the first word of its name (`screenOf`): the web's pages. The scene is given, so a sheet it names (`scene.sheet`) is the screen's to open. The phone's list is the same.
 * A moment of a life (`moment-*`) is Play's own sheet, open over its stage as the game opens it: Play draws it.
 */
const SCREENS: Readonly<Record<string, (scene: Scene) => ReactNode>> = {
  home: (scene) => (scene.sheet === undefined ? <Home /> : scene.sheet === 'offer' ? <OfferPressed><Home /></OfferPressed> : <Settled sheet={scene.sheet}><Home /></Settled>),
  new: (scene) => <Pressed selector={PRESSED[scene.name]}><NewLife /></Pressed>,
  play: (scene) => (scene.sheet === 'city' ? <><PlayScene scene={scene} /><CardCity /></> : <PlayScene scene={scene} />),
  finance: (scene) => (scene.sheet === 'basket' ? <><PlayScene scene={scene} /><Basket onClose={nothing} /></> : <PressedInTurn selectors={financePresses(scene)}><PlayScene scene={scene} /></PressedInTurn>),
  hud: (scene) => <Pressed selector={HUD_SHEETS[scene.sheet ?? '']}><Play /></Pressed>,
  amount: () => <SavingsScene />,
  celebrate: (scene) => (scene.name === 'celebrate-earned' ? <Pressed selector={TAKEN_IN}><Play /></Pressed> : <Play />),
  records: (scene) => <PressedWhenDrawn selector={scene.sheet === undefined ? undefined : FIRST_LIFE}><Records /></PressedWhenDrawn>,
  collection: (scene) => <Pressed selector={COLLECTION_TABS[scene.name]}><Collection /></Pressed>,
  challenge: () => <WeeklyChallenge />,
  legal: () => <Legal />,
  work: () => <WorkScene />,
  profile: (scene) => <ProfileScene scene={scene} />,
  balance: (scene) => <ProfileScene scene={scene} line={scene.sheet} />,
  rivals: () => <RivalsScene />,
  end: (scene) => <EndScene scene={scene} />,
  moment: (scene) => <PlayScene scene={scene} />,
  settings: (scene) => <Settled sheet={scene.sheet}><Home /></Settled>,
  rankings: (scene) => <RankingsScene scene={scene} />,
  player: (scene) => (scene.name.startsWith('player-editor-') ? <RatScene scene={scene} /> : <PlayerScene scene={scene} />),
  room: (scene) => <RoomScene scene={scene} />,
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

/** The other players, as a game's services hand them to its screens. */
type Community = NonNullable<ReturnType<NonNullable<Services['community']>>>;

/**
 * The cloud a scene of the game online is drawn with (`sceneCloud`: the same on the phone's): its member signed in from the start, and their profile
 * on the server. None for a scene of the game alone, which nobody plays signed in: the page holds nothing of the cloud.
 */
function cloudOf(name: string): Pick<Services, 'account' | 'community'> {
  const cloud = sceneCloud(name);
  if (cloud === null) return {};
  // What a scene's screen asks of the other players: what the server keeps of the member. Only what is drawn is answered, and checked against the game's own shapes: the rest is never asked.
  const used: Pick<Community, 'me' | 'rename' | 'setAvatar'> = cloud.community;
  const community = used as Community;
  return { account: cloud.account, community: () => community };
}

export default function ScenePage({ searchParams }: { searchParams: Promise<{ name?: string }> }) {
  const { name } = use(searchParams);
  const scene = SCENES.find((candidate) => candidate.name === name);
  const drawable = scene !== undefined && SCREENS[screenOf(scene)] !== undefined;
  const [built, setBuilt] = useState<{ scene: Scene; services: Services } | null>(null);
  useEffect(() => {
    if (scene === undefined || !drawable) return;
    let current = true;
    // The other players of a scene of the rankings, the same as the phone's scene gives its screen (`sceneCommunity`): no cloud.
    const community = sceneCommunity(scene.name);
    // The table of a scene of the games with others, the same as the phone's scene gives its game (`sceneRooms`): never the project's.
    const rooms = sceneRooms(scene.name);
    const table = rooms ? { rooms: () => rooms } : {};
    void sceneStore(scene.name).then((store) => current && setBuilt({ scene, services: { ...table, ...sceneServices(store, scene.name), ...(community ? { community: () => community } : {}), ...cloudOf(scene.name) } }));
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
