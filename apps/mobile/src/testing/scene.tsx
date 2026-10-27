import { BADGE_RARITY, content, progressOf, rarityOf } from '@ratrace/content';
import { ratLookOf } from '@ratrace/core/game/avatar';
import type { RoundActions, RoundState } from '@ratrace/core/game/store';
import { FAULTS, PAGE_TURN_HELD_MS, runScene, SCENE_NOW, sceneBasket, sceneCloud, sceneMilestones, SCENES, sceneStore, screenOf, SHINE_HELD_MS, turnOf } from '@ratrace/core/testing/scenes';
import type { Scene } from '@ratrace/core/testing/scenes';
import { rankingsOpening, sceneCommunity } from '@ratrace/core/testing/sceneCommunity';
import { sceneCloud as memberCloud, sceneMember } from '@ratrace/core/testing/sceneCloud';
import { runRoomScene, sceneGameOpened, sceneInvite, sceneRooms } from '@ratrace/core/testing/sceneRooms';
import { LOCALES } from '@ratrace/i18n/locales';
import type { Locale } from '@ratrace/i18n/locales';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { GameProvider, useGame, useProfile, useRooms, useT, useWords } from '../game/context';
import type { Services } from '../game/context';
import { AmountSheet } from '../game/screens/AmountSheet';
import { HeldShine } from '../game/screens/Cards';
import { Celebrations } from '../game/screens/Celebrations';
import { EndOpened } from '../game/screens/End';
import { Collection } from '../game/screens/Collection';
import { WeeklyChallenge } from '../game/screens/Challenge';
import { Basket, CityPreview, FinanceOpened } from '../game/screens/Finance';
import { Home, HomeOpened } from '../game/screens/Home';
import { useShown } from '../game/screens/Hud';
import { Legal } from '../game/screens/Legal';
import { NewLife } from '../game/screens/NewLife';
import type { NewLifeOpened } from '../game/screens/NewLife';
import { PageTurn } from '../game/screens/PageTurn';
import { Play } from '../game/screens/Play';
import { Records } from '../game/screens/Records';
import { Rankings } from '../game/screens/Rankings';
import { HomeSettingsSheet } from '../game/screens/Settings';
import { WorkPanel } from '../game/screens/Work';
import type { BalanceLine } from '../game/screens/Balance';
import { ProfileOpened, ProfileSheet } from '../game/screens/Profile';
import { RivalsBoard } from '../game/screens/Rivals';
import { PlayerProfile } from '../game/screens/PlayerProfile';
import { useRankName } from '../game/screens/RankCard';
import { RatEditor } from '../game/screens/RatEditor';
import { Room } from '../game/screens/Room';
import type { RatGroup } from '../game/screens/RatEditor';
import { Panel } from '../ui/kit';
import { KEYFRAMES } from '../ui/motion';
import { Screen } from '../ui/Page';
import { useSpritesLoading } from '../ui/spriteImages';
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

/** The line the game of a scene that cannot go on (`FAULTS`: `play-fault`) writes to the log as it opens (core's round store says it so). */
export const FAULT_LINE = 'the round could not be previewed:';

/**
 * While a scene of a game that cannot go on is drawn, the one line its game writes as it opens is kept from the log: in development the app shows
 * an error over the screen, and this one would be in the shot. Only that line, and only while that scene is drawn: the log is put back as it was when
 * the scene goes, so the same line from any other screen, or any other line from this one, is an error shown as it always is. (`LogBox.ignoreLogs`
 * would hide it for the rest of the session, a real fault with it.)
 */
function useQuietFault(name: string | undefined) {
  const fault = name !== undefined && FAULTS.has(name);
  useEffect(() => {
    if (!fault) return;
    const told = console.error;
    console.error = (...said: unknown[]) => {
      if (said[0] !== FAULT_LINE) told(...said);
    };
    return () => {
      console.error = told;
    };
  }, [fault]);
}

/** The core's moments of a rare card's shine (`SHINE_HELD_MS`) as shares of the runs the kit plays them over: where the card holds them. */
const HELD_SHINE = { holo: SHINE_HELD_MS.holo / KEYFRAMES.holo.ms, glint: SHINE_HELD_MS.glint / KEYFRAMES.glint.ms, spark: SHINE_HELD_MS.spark / KEYFRAMES.spark.ms };

/**
 * The play screen of a scene, and over it the calendar of a round just turned where the scene has one (`turnOf`), held at one moment of its run:
 * drawn beside the screen, as the screen draws it when the round goes by under it. The web's page draws the same, held by a rule of its own. A rare
 * card's shine is held still too, where the web's page holds it (`HOLD_SHINE` there).
 */
function PlayScene({ scene }: { scene: Scene }) {
  const turn = turnOf(scene);
  return (
    <>
      <HeldShine value={HELD_SHINE}>
        <Play />
      </HeldShine>
      {turn ? <PageTurn from={turn.from} to={turn.to} onDone={nothing} held={PAGE_TURN_HELD_MS} /> : null}
    </>
  );
}

/** What draws a scene's screen: the scene itself is given, so a sheet the scene names (`scene.sheet`) is the screen's to open. */
export type SceneScreens = Readonly<Record<string, (scene: Scene) => ReactNode>>;

/**
 * What a scene of the page where a life is chosen has open at the start: its sheet, the question of ending the life in progress (`scene.sheet`), or
 * the list of the lives still locked (`new-locked`, which the web's page opens by pressing the button that folds it).
 */
const openedOf = (scene: Scene): NewLifeOpened | undefined => (scene.sheet === 'replace' ? 'replace' : scene.name === 'new-locked' ? 'locked' : undefined);

/** A sheet that asks nothing of the game is never taken: a scene's sheet stays open whatever is pressed in it. */
const refused = (): boolean => false;

/**
 * The sheet that moves cash to savings, as Finance's portfolio opens it (`amount-savings`): all the cash there is, the most it can move. Drawn beside
 * the Hud of the finances, as the web's is (its Finance keeps the sheet to itself), over a page that is the Hud alone on both sides (`HUD_ONLY` in
 * scripts/sceneShots.ts): the scene was recorded so in Task 10, before the phone had Finance, and compares the sheet. The finances themselves have
 * scenes of their own (`finance-*`).
 */
function SavingsSheet() {
  const playing = useGame((s) => s.status === 'playing' && s.view !== null);
  return playing ? <Savings /> : null;
}
function Savings() {
  const amount = useT('finance.amount');
  const cash = useShown().player.cash;
  return <AmountSheet title={amount('save')} max={cash} onClose={nothing} onConfirm={refused} />;
}

/**
 * The stage a sheet of a scene belongs to, mounted and drawn nowhere in the page: what the web's shot leaves of its stage (`HUD_ONLY` hides it,
 * and a sheet it opens is drawn over the page all the same). A legendary badge (`celebrate-legendary`) is shown by the result of the card that
 * earned it (`Outcome`, which draws `Celebrations`): its scene compares the sheet over the Hud alone, so its `Celebrations` stands here, its sheet
 * over the Hud and its small card in a box of no size. The result itself is compared in `play-outcome-r1`.
 */
function HiddenStage({ children }: { children: ReactNode }) {
  return <View style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>{children}</View>;
}

/** The legendary badges a scene shows as taken in already: every one there is. */
const LEGENDARY: readonly string[] = Object.keys(BADGE_RARITY).filter((id) => rarityOf(id) === 'legendary');

/**
 * The small cards of what a step earned (`celebrate-earned`), its legendary sheet taken in, where the result of a card has them: 12 under the Hud's
 * figures (Play's `paddingTop: 4` and the page's gap of 8, the web's `pt-3`) and 12 apart (the result's `gap-3`). The web's shot takes everything
 * else of the stage out (`CELEBRATIONS_ONLY`); its page presses the sheet's button, which the phone's Celebrations is given as its initial state.
 */
function EarnedStage() {
  return (
    <View style={{ paddingTop: 4, gap: 12 }}>
      <Celebrations seen={LEGENDARY} />
    </View>
  );
}

/** What a scene of the Hud has open at the start: the sheet it names (a figure's, the prison's, the crisis's), given to the Hud as its initial state. */
const HUD_OPEN: readonly HudSceneOpen[] = ['cash', 'flow', 'status', 'ratRace', 'jail', 'settings', 'news', 'crisis'];
const hudOpenOf = (scene: Scene): HudSceneOpen | undefined => HUD_OPEN.find((open) => open === scene.sheet);

/**
 * The city the card on screen offers to move to, its sheet open beside the play screen (`play-cards-city`): the sheet the card's link opens
 * (`CityPreview`), for the life as the card has it, drawn beside the screen as a scene's sheet is. The web's page draws the same.
 */
function CardCity() {
  const view = useGame((s) => s.view);
  if (!view || view.phase !== 'cards') return null;
  const card = content.cards.find((def) => def.id === view.hand[view.answered]);
  const city = card?.options.find((option) => option.effects?.moveCity !== undefined)?.effects?.moveCity;
  return city ? <CityPreview cityId={city} view={view} onClose={nothing} /> : null;
}

/**
 * The work panel of the profile (`work-panel`) on a page of its own, as the profile holds it: given the life as it stands. The profile itself comes
 * with Task 17; the web's page draws the same panel on the same page.
 */
function WorkScene() {
  const playing = useGame((s) => s.view !== null);
  return <Screen>{playing ? <ShownWork /> : null}</Screen>;
}
function ShownWork() {
  return <WorkPanel shown={useShown()} />;
}

/**
 * The player's profile over Play, open as the portrait opens it, with what the scene names open over it from the start (`ProfileOpened`): one of the
 * things owned (`profile-owned`: its id), or a line of the balance sheet (`balance-r6`: `netWorth`). The web's page presses the portrait, then the thing
 * or the line. Play's own profile stays shut under it.
 */
function ProfileScene({ scene, opened }: { scene: Scene; opened: { item?: string; line?: BalanceLine } }) {
  return (
    <ProfileOpened value={opened}>
      <PlayScene scene={scene} />
      <ProfileSheet open onClose={nothing} />
    </ProfileOpened>
  );
}

/**
 * Where the player stands among the rivals (`rivals-r6`): the board alone on a page, the web's `main` column, as the web's page draws it. In the profile it is
 * far down a sheet that scrolls, where no shot could see it.
 */
function RivalsScene() {
  const history = useGame((s) => s.history);
  return (
    <Screen>
      <RivalsBoard history={history} />
    </Screen>
  );
}

/**
 * The tab of the collection a scene has open at the start: the things (`collection-items`), or the badges, which the page opens on. The records
 * are given the life whose sheet a scene has open by its id (`scene.sheet`), and open it once they have read the device's lives.
 */
const collectionTabOf = (scene: Scene): 'items' | 'badges' => (scene.name === 'collection-items' ? 'items' : 'badges');

/** The front door with the question of the life waiting in the account open (`home-offer`), given as its initial state. */
const OFFER_OPEN = { offer: true };

/**
 * The rankings a scene opens on (`rankingsOpening`): the tab its name says, given to the screen as its initial state. The web's page presses the tab.
 * (The player's name is changed on their profile now: `rankings-nickname` opens on the rankings as they are.)
 */
function RankingsScene({ scene }: { scene: Scene }) {
  return <Rankings tab={rankingsOpening(scene.name)?.tab} />;
}

/** The tab of the rat a scene of it has open (`player-editor-wear`: what it wears). */
const ratTabOf = (scene: Scene): RatGroup => scene.name.slice('player-editor-'.length) as RatGroup;

/**
 * The rat of the player of a scene, a tab of it at a time (`player-editor-*`): the profile's panel alone on a page, as the profile draws it, the tab
 * given as its initial state. Far down the profile, no shot could see it there; the web's page draws the same panel on the same page and presses
 * the tab. A choice pressed does nothing: a scene is a picture.
 */
function RatScene({ scene }: { scene: Scene }) {
  const t = useT('player');
  const profile = useProfile();
  const { text } = useWords();
  const rankName = useRankName();
  const member = sceneMember(scene.name);
  if (member === null) return null;
  return (
    <Screen>
      <Panel title={t('rat')} label={t('rat')}>
        <RatEditor
          look={ratLookOf(member.avatar, member.userId)}
          earned={profile.badges}
          rank={progressOf(profile.rank.points).rank}
          badgeName={(id) => text.badges[id]?.name ?? id}
          rankName={rankName}
          onPick={nothing}
          onLocked={nothing}
          tab={ratTabOf(scene)}
        />
      </Panel>
    </Screen>
  );
}

/**
 * The screen each scene is drawn on, by the first word of its name (`screenOf`: `play-news-r1` is drawn on `play`). Each
 * screen's task puts the screen itself in place of the stand-in of phase 1; the web's page has the same list. A moment of a life (`moment-*`) is
 * Play's own sheet, open over its stage as the game opens it (no initial state: nothing has taken it in yet): Play draws it.
 */
export const SCENE_SCREENS: SceneScreens = {
  home: (scene) => (scene.sheet === 'settings' ? <><Home /><HomeSettingsSheet open onClose={nothing} /></> : scene.sheet === 'offer' ? <HomeOpened value={OFFER_OPEN}><Home /></HomeOpened> : <Home />),
  new: (scene) => <NewLife opened={openedOf(scene)} />,
  play: (scene) => (scene.sheet === 'city' ? <><PlayScene scene={scene} /><CardCity /></> : <PlayScene scene={scene} />),
  finance: (scene) => (scene.sheet === 'basket' ? <><PlayScene scene={scene} /><Basket onClose={nothing} /></> : <FinanceOpened value={{ tab: scene.tab, sheet: scene.sheet }}><PlayScene scene={scene} /></FinanceOpened>),
  hud: (scene) => <HudScene open={hudOpenOf(scene)} />,
  amount: () => <><HudScene /><SavingsSheet /></>,
  // A milestone of the life (Milestones.tsx, the phone's own: the Next web had none) is drawn as the badges are: its whole screen over the Hud of the
  // card that reached it, as a legendary badge's, or its banner where the result of the card has it (`celebrate-milestone-banner`).
  celebrate: (scene) => (scene.name === 'celebrate-earned' || scene.name === 'celebrate-milestone-banner' ? <HudScene><EarnedStage /></HudScene> : <><HudScene /><HiddenStage><Celebrations /></HiddenStage></>),
  records: (scene) => <Records opened={scene.sheet} />,
  collection: (scene) => <Collection tab={collectionTabOf(scene)} />,
  challenge: () => <WeeklyChallenge />,
  legal: () => <Legal />,
  work: () => <WorkScene />,
  profile: (scene) => <ProfileScene scene={scene} opened={{ item: scene.sheet }} />,
  balance: (scene) => <ProfileScene scene={scene} opened={{ line: scene.sheet as BalanceLine | undefined }} />,
  rivals: () => <RivalsScene />,
  end: (scene) => <EndOpened value={{ share: scene.sheet === 'share' }}><Play /></EndOpened>,
  moment: (scene) => <PlayScene scene={scene} />,
  settings: () => <><Home /><HomeSettingsSheet open onClose={nothing} /></>,
  rankings: (scene) => <RankingsScene scene={scene} />,
  player: (scene) => (scene.name.startsWith('player-editor-') ? <RatScene scene={scene} /> : <PlayerProfile />),
  // The games with others, at the scene's table (`sceneRooms`); one come by an invitation is given its code as the route gives it (`?code=`). The games
  // played with others are the records' (`room-history`), given the one open (the web's page presses it).
  room: (scene) => (scene.name === 'room-history' ? <Records game={sceneGameOpened(scene.name)} /> : <Room code={sceneInvite(scene.name)} />),
};

/**
 * What a scene is drawn with: its store behind the game's services, in the language it names whatever the phone speaks,
 * and the day every scene is drawn on (`SCENE_NOW`) as the clock a screen reads the date by; where the scene names one, the place its
 * game keeps the orders of the round (`sceneBasket`: one that cannot be read, for a game that cannot go on); for a scene of the account, the
 * account it says, which stays so, with no network (`sceneCloud`, the web's page's too); the other players it is told of (`sceneCommunity`:
 * the rankings', and those of the game online beside the game alone); and for a scene of the player's own profile, its member and their profile on
 * the server (`cloudOf`).
 */
export function servicesOf(scene: Scene, store: Awaited<ReturnType<typeof sceneStore>>): Services {
  const basket = sceneBasket(scene.name);
  const milestones = sceneMilestones(scene.name);
  // The other players of a scene of the game online (the rankings', the front door's, the challenge's, an end's, a new life's), the same as the web's
  // page gives its screen (`sceneCommunity`).
  const community = sceneCommunity(scene.name);
  // The table of a scene of the games with others, the same as the web's page gives its game (`sceneRooms`).
  const rooms = sceneRooms(scene.name);
  return {
    ...speaking(memoryServices(store), scene.locale),
    now: () => SCENE_NOW,
    ...(basket ? { basket } : {}),
    ...(milestones !== undefined ? { milestones } : {}),
    ...sceneCloud(scene.name),
    ...(community ? { community: () => community } : {}),
    ...(rooms ? { rooms: () => rooms } : {}),
    ...cloudOf(scene),
  };
}

/** The other players, as a game's services hand them to its screens. */
type Community = NonNullable<ReturnType<NonNullable<Services['community']>>>;

/**
 * The cloud a scene of the player's own profile is drawn with (`memberCloud`: the same on the web's page): its member signed in from the start, and
 * their profile on the server. None for any other scene.
 */
function cloudOf(scene: Scene): Pick<Services, 'account' | 'community'> {
  const cloud = memberCloud(scene.name);
  if (cloud === null) return {};
  // What a scene's screen asks of the other players: what the server keeps of the member. Only what is drawn is answered, and checked against the game's own shapes: the rest is never asked.
  const used: Pick<Community, 'me' | 'rename' | 'setAvatar'> = cloud.community;
  const community = used as Community;
  return { account: cloud.account, community: () => community };
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
 * Where a scene's game stands, as far as a step would change it: the stage, the round, the card on screen, a choice being taken. A scene is a
 * picture of one such place: once its own steps are taken, nothing may move its game from there (`Ready`).
 */
export const whereOf = (state: RoundState & RoundActions): string =>
  `${state.stage} ${state.view?.round ?? '-'} ${state.view?.answered ?? '-'} ${state.picked ?? '-'} ${state.busy ? 'busy' : 'still'}`;

/**
 * Takes the steps a scene goes on with (`runScene`: the result of a card, the ledger of a round) once the game has opened on
 * the scene's store, on that game, and says where they left it. Needs no more of the game than a screen has: its actions and its state through `useGame`.
 * A scene of a game with others then waits for the life in its room, and takes its own steps on that one (`runRoomScene`), so its screen is first
 * drawn there too.
 */
function Script({ scene, done }: { scene: Scene; done: (where: string) => void }) {
  const rooms = useRooms();
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
    const now = () => latest.current as RoundState & RoundActions;
    runScene(scene.name, { getState: now })
      .then(() => runRoomScene(scene.name, rooms))
      .then(() => done(whereOf(now())), (error: unknown) => console.error(error));
  }, [status, scene, done, rooms]);
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
 * A scene's screen takes no touch: it is a picture to be shot, and nothing pressed on it (a stray tap on the simulator, another session at work on
 * it) may move its game on. (Task 9 saw `play-cards-r1` gone on to a card's result once in a full run, its choices pressed with no tap of the
 * driver's: the cause was not found in the app, and a touch from outside could not be ruled out.) A sheet is a window of its own (a Modal), which
 * this does not reach; nothing of a sheet moves a scene's game.
 */
function Untouched({ children }: { children: ReactNode }) {
  return <View style={{ flex: 1, pointerEvents: 'none' }}>{children}</View>;
}

/** The number of the last word a scene said to the driver: one count for the app, from the time it started, so a scene drawn again speaks after. */
let word = Date.now();

/**
 * Tells the driver of the shots, on this machine (`readyPort`: the route is opened with `&ready=<port>` by scripts/shotDrivers.ts), whether the
 * scene is ready to be shot: its screen drawn, its game where its steps left it (`at`, from `whereOf`), and no picture of it still being read.
 * Said each time that changes, numbered, so word that arrives late is not taken for the latest: a part drawn once the page is laid out may ask for a
 * picture after the scene first said it was ready. A game that moves on from its place (whatever moved it) is no longer the scene, and it says so:
 * the run then fails on it, naming it, instead of shooting another picture under its name. A scene opened for anything else says nothing. While it
 * is not ready, shots alike are a screen waiting, not one standing still.
 */
function Ready({ name, at, port }: { name: string; at: string | null; port: number | undefined }) {
  const reading = useSpritesLoading();
  const where = useGame(whereOf);
  const done = at !== null && where === at && reading === 0;
  useEffect(() => {
    if (port === undefined) return;
    word += 1;
    fetch(`http://127.0.0.1:${port}/ready?name=${encodeURIComponent(name)}&ready=${done ? 1 : 0}&n=${word}`).catch(() => undefined);
  }, [done, port, name]);
  return null;
}

/**
 * A scene's game, with its screen: the game opened on the scene's store, the scene's steps taken on it, and then the screen,
 * which is first drawn at the stage the scene ends on, as the web's is.
 */
export function SceneGame({ scene, services, screens = SCENE_SCREENS, readyPort }: { scene: Scene; services: Services; screens?: SceneScreens; readyPort?: number }) {
  // Where the scene's steps left its game, once they are taken.
  const [over, setOver] = useState<string | null>(null);
  const done = useCallback((where: string) => setOver(where), []);
  return (
    <GameProvider services={services}>
      <Script scene={scene} done={done} />
      {over !== null ? (
        <Untouched>
          <OfWidth width={scene.width}>{screens[screenOf(scene)]?.(scene)}</OfWidth>
        </Untouched>
      ) : null}
      <Ready name={scene.name} at={over} port={readyPort} />
    </GameProvider>
  );
}

/**
 * The scene named, drawn as the app would draw it: its store built, the game opened on it as it opens the life on the
 * phone, and the scene's screen inside. Nothing at all until the store is built (it takes a moment).
 */
export function SceneView({ name, screens = SCENE_SCREENS, readyPort, locale }: { name: string | undefined; screens?: SceneScreens; readyPort?: number; locale?: Locale }) {
  const scene = useMemo(() => {
    const named = SCENES.find((candidate) => candidate.name === name);
    return named && locale ? { ...named, locale } : named;
  }, [name, locale]);
  const drawable = scene !== undefined && screens[screenOf(scene)] !== undefined;
  const [built, setBuilt] = useState<{ scene: Scene; services: Services } | null>(null);
  // In place before the store is built, so before the game opens and says it.
  useQuietFault(scene !== undefined && drawable ? scene.name : undefined);
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
  return <SceneGame key={scene.name} scene={scene} services={built.services} screens={screens} readyPort={readyPort} />;
}

/**
 * The /scene route's page (app/scene.tsx loads it behind `__DEV__`, so a release build has none of it): the scene its address names, and, when it
 * is opened for a shot, the port the driver of the shots listens on for it to say it is ready (`&ready=`, scripts/shotDrivers.ts). `&locale=` draws
 * it in another of the game's languages than its own (the store's pictures in each language, `scripts/playShots.ts`).
 */
export function SceneRoute() {
  const { name, ready, locale } = useLocalSearchParams<{ name?: string; ready?: string; locale?: string }>();
  const port = ready !== undefined && /^\d+$/.test(ready) ? Number(ready) : undefined;
  const speaking = LOCALES.find((known) => known === locale);
  return <SceneView name={name} readyPort={port} {...(speaking ? { locale: speaking } : {})} />;
}
