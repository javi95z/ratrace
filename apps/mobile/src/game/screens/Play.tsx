import { ageAt } from '@ratrace/core/game/present';
import { roundWarnings } from '@ratrace/core/game/roundWarnings';
import type { Stage } from '@ratrace/core/game/store';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useBlink } from '../../ui/animations';
import { Framed } from '../../ui/Frame';
import { GOLD } from '../../ui/frames';
import { webBaseline } from '../../ui/fonts';
import { Button, Raised, SrOnly } from '../../ui/kit';
import { Sheet, Toast } from '../../ui/overlay';
import { PerfDrawn } from '../../ui/perf';
import { BottomBar, type ScreenScroller } from '../../ui/Page';
import { StickyScreen } from '../../ui/Sticky';
import { PixelText, ReadText, SNUG } from '../../ui/text';
import { COLORS } from '../../ui/theme';
import { useIsDesk } from '../../ui/desk';
import { dialogOpen, pressMarked, useKeyboardContext, useKeyboardScope } from '../../ui/keyboard';
import { onHardwareBack } from '../../ui/hardwareBack';
import { useGame, useSettings, useStill, useT, useWords } from '../context';
import { useOwnT } from '../ownWords';
import { CardStage, Outcome } from './Cards';
import { CrisisBar } from './Crisis';
import { Basket, Finance, FinanceShell, FinanceTabs, FinanceToasts } from './Finance';
import { CoinFlights, CoinTargets } from './FlyingCoins';
import { Guide } from './Guide';
import { Hud } from './Hud';
import { Moments } from './Moments';
import { NewsPanel, RoundOpener } from './News';
import { PageTurn } from './PageTurn';
import { End } from './End';
import { PlayDesk, StuckTop } from './PlayDesk';
import { ProfileSheet } from './Profile';
import { Resolve } from './Resolve';
import { useGo } from '../pages';

/*
 * A life being played, as the web's Play.tsx lays it on a phone, and on a browser's wide screen in its three columns (`PlayDesk.web.tsx`, from the
 * web's desk width: `useIsDesk`, never on the phone), with the web's keyboard (Ctrl/⌘ + Enter, the skip links of the desk: `ui/keyboard.web.tsx`).
 * What the phone leaves out: the keyboard, and a ranked life's notices, which a life on the phone never has. Every stage is drawn by its own screen, with the stage machine, the bar of the next thing to do and
 * the guide round them; in a room, with what the room puts round them (`RoomSlots`).
 */

/**
 * Plays the round. When the orders would make a costly mistake (cash running out onto the credit
 * card, a margin loan a small fall from its forced sale) it says so first, and plays only if asked again.
 */
function PlayRound() {
  const t = useT('finance');
  const common = useT('common');
  const { content, names, fmt } = useWords();
  const view = useGame((s) => s.view);
  const preview = useGame((s) => s.preview);
  const busy = useGame((s) => s.busy);
  const play = useGame((s) => s.play);
  const [asking, setAsking] = useState(false);
  const warnings = view && preview ? roundWarnings(content, view, preview) : [];
  const go = () => {
    setAsking(false);
    void play();
  };
  return (
    <>
      <Button variant="primary" wide primary disabled={busy} onPress={() => (warnings.length > 0 ? setAsking(true) : go())}>
        {t('play')}
      </Button>
      <Sheet open={asking} onClose={() => setAsking(false)} title={t('warn.title')} tone="wine" closeLabel={common('close')}>
        <View role="list" style={{ gap: 8 }}>
          {warnings.map((warning) => (
            <View role="listitem" key={warning.kind === 'card' ? 'card' : warning.assetId}>
              <ReadText size={14} lineHeight={14 * SNUG}>
                {warning.kind === 'card'
                  ? t('warn.card', { amount: fmt.money(warning.amount), rate: fmt.rate(warning.rateBp) })
                  : t('warn.margin', { name: names.assets[warning.assetId]?.name ?? warning.assetId, pct: fmt.rate(warning.dropBp) })}
              </ReadText>
            </View>
          ))}
        </View>
        <View style={{ marginTop: 16, gap: 8 }}>
          <Button variant="secondary" wide onPress={() => setAsking(false)}>
            {t('warn.review')}
          </Button>
          <Button variant="danger" wide disabled={busy} onPress={go}>
            {t('warn.playAnyway')}
          </Button>
        </View>
      </Sheet>
    </>
  );
}

/** Where the two texts of the line over the finances' buttons stand, so their baselines meet (the web's `items-baseline`): the label (13) and the cash (17). */
function cashLine(language: string): { label: number; cash: number } {
  const label = webBaseline('read', 400, 13, 13 * 1.45, language);
  const cash = webBaseline('pixel', 400, 17, 17 * 1.1, language);
  const top = Math.max(label, cash);
  return { label: top - label, cash: top - cash };
}

/**
 * The one thing to do next, where a thumb rests. In the finance phase it also says what the round
 * will leave in cash, and on a phone it opens the list of orders (at desk width the orders are at the side). Null where the screen itself is the choice.
 */
function Actions({ stage, desk, onBasket }: { stage: Stage; desk: boolean; onBasket(): void }) {
  const news = useT('news');
  const cards = useT('cards');
  const finance = useT('finance');
  const resolve = useT('resolve');
  const { fmt } = useWords();
  const { locale } = useSettings();
  const phase = useGame((s) => s.view?.phase ?? null);
  const finished = useGame((s) => s.view?.finished === true);
  const cashAfter = useGame((s) => s.preview?.cashAfter ?? null);
  const orders = useGame((s) => s.orders.length);
  const busy = useGame((s) => s.busy);
  const leaveNews = useGame((s) => s.leaveNews);
  const afterCard = useGame((s) => s.afterCard);
  const next = useGame((s) => s.next);
  if (phase === null) return null;
  const cardsWait = phase === 'cards';

  switch (stage) {
    case 'news':
      return (
        <Button variant="primary" wide primary onPress={leaveNews}>
          {cardsWait ? news('toCards') : news('toFinance')}
        </Button>
      );
    case 'outcome':
      return (
        <Button variant="primary" wide primary disabled={busy} onPress={afterCard}>
          {cardsWait ? cards('next') : cards('toFinance')}
        </Button>
      );
    case 'finance': {
      const line = cashLine(locale);
      return (
        <View style={{ gap: 8 }}>
          {cashAfter !== null ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <ReadText size={13} tone="ink-200" style={{ marginTop: line.label }}>{finance('afterRound')}</ReadText>
              <PixelText size={17} tone={cashAfter < 0 ? 'wine-300' : 'cream'} style={{ marginTop: line.cash }}>{fmt.money(cashAfter)}</PixelText>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {/* The web's `shrink-0 px-3 text-[14px]`. */}
            {desk ? null : (
              <Button variant="quiet" size={14} padX={12} onPress={onBasket}>
                {finance('basket', { count: orders })}
              </Button>
            )}
            <View style={{ flex: 1 }}>
              <PlayRound />
            </View>
          </View>
        </View>
      );
    }
    case 'resolve':
      return (
        <Button variant="primary" wide primary onPress={next}>
          {finished ? resolve('finish') : resolve('next')}
        </Button>
      );
    default:
      return null;
  }
}

/**
 * What the stage of the round shows, under the tip of the guide when one is due.
 * A card is the exception: its choices are the stage, so the tip follows them and never pushes them off a small screen.
 * The finances are the other: their tip stands over their tabs, which stick under the Hud, so it is drawn with them (`FinanceLeadIn`).
 */
function StageView({ stage, desk = false }: { stage: Stage; desk?: boolean }) {
  const body = <StageBody stage={stage} desk={desk} />;
  // At desk width nothing sticks under the Hud, which is at the side: the finances' tip and tabs stand over their panel, the tabs sticking to the top.
  if (stage === 'finance' && desk) {
    return (
      <>
        <Guide />
        <StuckTop>
          <FinanceTabs />
        </StuckTop>
        {body}
      </>
    );
  }
  if (stage === 'finance') return body;
  if (stage !== 'cards') {
    return (
      <>
        <Guide />
        {body}
      </>
    );
  }
  return (
    <>
      {body}
      <View style={{ paddingTop: 12 }}>
        <Guide />
      </View>
    </>
  );
}

/** What each stage of the round shows. On a wide screen the headlines sit at the side, so the round opens on its own title. */
function StageBody({ stage, desk }: { stage: Stage; desk: boolean }) {
  switch (stage) {
    case 'news':
      return desk ? <RoundOpener /> : <NewsPanel />;
    case 'cards':
      return <CardStage />;
    case 'outcome':
      return <Outcome />;
    case 'finance':
      return <Finance />;
    case 'resolve':
      return <Resolve />;
    default:
      return null;
  }
}

/**
 * The two ways on from a screen the round cannot go on from: a new life, which takes the place of this screen, and home, the front door, wherever it
 * stands in the stack (the web's two links of its `Fault`).
 */
function WaysOut() {
  const t = useT('play');
  const go = useGo();
  return (
    <>
      <Raised role="link" tone={GOLD} bg="gold-500" style={{ minHeight: 48, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }} onPress={() => go.replace('new')}>
        <PixelText size={17} tone="ink-900">{t('newLife')}</PixelText>
      </Raised>
      <Raised role="link" bg="night-600" style={{ paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }} onPress={() => go.home()}>
        <PixelText size={15}>{t('home')}</PixelText>
      </Raised>
    </>
  );
}

/** The web's `main mx-auto max-w-sm px-4 flex-col justify-center gap-4 min-h-dvh`: a narrow column in the middle of the screen. */
function Middle({ children }: { children: ReactNode }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <View style={{ width: '100%', maxWidth: 384, alignSelf: 'center', paddingHorizontal: 16, gap: 16 }}>{children}</View>
    </View>
  );
}

/** The game refused a step. The life is saved as it stood before it; this is the way out. */
function Fault() {
  const t = useT('play');
  return (
    <Middle>
      <View role="alert">
        <Framed kind="frame" style={{ backgroundColor: COLORS['wine-900'], padding: 16 }}>
          <View accessibilityRole="header">
            <PixelText size={20}>{t('faultTitle')}</PixelText>
          </View>
          <ReadText size={14} lineHeight={14 * SNUG} style={{ marginTop: 8 }}>{t('faultBody')}</ReadText>
        </Framed>
      </View>
      <WaysOut />
    </Middle>
  );
}

/** The game is being opened: nothing to show yet, in the middle of the screen, blinking. */
function Waiting({ children }: { children: string }) {
  const blink = useBlink();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={blink}>
        <PixelText tone="ink-300">{children}</PixelText>
      </Animated.View>
    </View>
  );
}

/** Away from the news, where the bar of a crisis is whole, a strip says it is on. It scrolls away with the page: only the figures stay stuck. */
function CrisisStrip() {
  const crisis = useGame((s) => (s.view ? (s.view.timeline[s.view.round]?.crisis ?? null) : null));
  // Its place is there with no crisis too: the web's Hud keeps the strip's `mt-2` box, empty, so the stage stands 8 lower than it would without it.
  // (The strip itself is not put in a box: its touch reaches a point past it, into the page's gap.)
  return crisis ? <CrisisBar crisis={crisis} compact /> : <View />;
}

/**
 * What stands between the Hud's figures and the finances' tabs, as the web's page has it: the way out of the rat race right under the figures, the
 * strip of a crisis 8 under that (its place kept with none, the web's empty `mt-2`), and the tip of the guide when one is due, 12 under that (the stage's `pt-3`). It scrolls up under the figures
 * as the page does, and the tabs follow it until they meet them (`StickyScreen`'s `between`). The tabs stand 12 under it (`subGap`: with a tip,
 * the tip's own `mb-3`; with none, the stage's `pt-3`), so the tip is given its 12 above it in place of the one below it, and with no tip the
 * two cancel out to nothing.
 */
function FinanceLeadIn({ wayOut, bar }: { wayOut: ReactNode; bar?: ReactNode }) {
  return (
    <>
      {wayOut}
      <View style={{ height: 8 }} />
      <CrisisStrip />
      {/* In a room, its bar: 8 under the strip, as the web's stands under its Hud (`pt-2`). */}
      {bar ? <View style={{ marginTop: 8 }}>{bar}</View> : null}
      <View style={{ marginTop: 12, marginBottom: -12 }}>
        <Guide />
      </View>
    </>
  );
}

/** What a room adds to the screens of a life: its bar, what stands in for the next thing to do while the player waits, its order after a round, and at the end. */
export interface RoomSlots {
  bar: ReactNode;
  /** Shown in place of the round's own button, while the player has played and waits for the others. Null otherwise. */
  actions: ReactNode | null;
  /** Below the ledger of a round. */
  resolved: ReactNode;
  /** Above the end of the life. */
  end: ReactNode;
}

/**
 * A life being played: the HUD, the stage of the round, and the next thing to do. In a room, `room` adds the room's bar, its wait and its order
 * (and the room says itself where to go: no life is never a way home). The HUD is the two parts of the page's `StickyScreen`:
 * the portrait's row scrolls away, the figures stick. Each part is made once for as long as the HUD is compact or not, so a change of
 * stage draws neither again (the figures are drawn again by what they show). Android's Back goes home, and the life stays saved; a sheet
 * that is open takes Back first (its Modal does).
 */
export function Play({ room }: { room?: RoomSlots } = {}) {
  const common = useT('common');
  const news = useT('news');
  const cards = useT('cards');
  const play = useT('play');
  const end = useT('end');
  const phone = useOwnT();
  const go = useGo();
  const { content, text } = useWords();
  const desk = useIsDesk();
  const status = useGame((s) => s.status);
  const stage = useGame((s) => s.stage);
  const round = useGame((s) => s.view?.round ?? null);
  const answered = useGame((s) => s.view?.answered ?? 0);
  const hand = useGame((s) => s.view?.hand.length ?? 0);
  const moved = useGame((s) => s.moved);
  const fault = useGame((s) => s.fault);
  const clearMoved = useGame((s) => s.clearMoved);
  const lifeId = useGame((s) => s.lifeId);
  const [basketOpen, setBasketOpen] = useState(false);
  // The profile, opened from the portrait (the web's phone layout; the phone has no desk to keep it at the side).
  const [profileOpen, setProfileOpen] = useState(false);
  const openProfile = useCallback(() => setProfileOpen(true), []);
  const closeProfile = useCallback(() => setProfileOpen(false), []);
  const scroller = useRef<ScreenScroller>(null);

  // No life to play: the front door is where one is started. A room says itself where to go: its life may not be open yet, and is asked for again.
  useEffect(() => {
    if (status === 'none' && !room) go.home();
  }, [status, go, room]);

  // Android's Back, while this screen is in front: home, with the life as it stands (it is saved at every step). An open sheet is a Modal,
  // which takes Back itself and closes.
  useFocusEffect(
    useCallback(() => {
      return onHardwareBack(() => {
        go.home();
        return true;
      });
    }, [go]),
  );

  // The keyboard (the web's): its reference says what applies to the stage, and Ctrl/⌘ + Enter presses the stage's safe main action, never twice for a
  // key held down, never under a sheet. Nothing on the phone.
  useKeyboardContext(stage === 'cards' ? 'cards' : stage === 'finance' ? 'finance' : 'play');
  useKeyboardScope(
    (event) => {
      if (event.repeat || event.key !== 'Enter' || (!event.ctrlKey && !event.metaKey) || dialogOpen()) return false;
      return pressMarked('primary-action');
    },
    { active: status === 'playing', priority: 10 },
  );

  // A sheet belongs to the stage it was opened in, and to the layout: at desk width the orders are at the side.
  useEffect(() => {
    setBasketOpen(false);
  }, [stage, desk]);

  // Two years go by as a round turns: the calendar loses a page. Not on opening a life already under way,
  // and never where motion is left out.
  const still = useStill();
  const lastRound = useRef<number | null>(null);
  const [turn, setTurn] = useState<{ from: number; to: number } | null>(null);
  useEffect(() => {
    if (round === null) return;
    const was = lastRound.current;
    lastRound.current = round;
    if (was !== null && round > was && !still) setTurn({ from: ageAt(content, was), to: ageAt(content, round) });
  }, [round, still, content]);
  const pageTurn = turn ? <PageTurn key={turn.to} from={turn.from} to={turn.to} onDone={() => setTurn(null)} /> : null;

  // What the stage is called, for someone who cannot see it change. The end of a life is a screen of its own, called by its title.
  const stageName =
    stage === 'news' ? news('title') : stage === 'cards' ? cards('progress', { n: Math.min(answered + 1, hand), total: hand }) : stage === 'end' ? end('title') : play(`stages.${stage}`);
  // A new stage starts at its top, and a screen reader says where the player now is, VoiceOver and TalkBack alike (the web gives the stage the focus,
  // which every screen reader reads).
  const playing = status === 'playing' && round !== null;
  const shownStage = useRef<string | null>(null);
  useEffect(() => {
    if (!playing) return;
    scroller.current?.reveal(0, 0, false);
    if (shownStage.current !== null && shownStage.current !== stage) AccessibilityInfo.announceForAccessibility(stageName);
    shownStage.current = stage;
    // Said once a stage, in the words it has when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, playing]);

  // The skyline opens and closes a round. In between, the room goes to the cards and the finances.
  const compact = stage !== 'news' && stage !== 'resolve';
  const lead = useMemo(() => <Hud part="lead" compact={compact} onProfile={openProfile} />, [compact, openProfile]);
  const header = useMemo(() => <Hud part="header" compact={compact} />, [compact]);
  // The way out of the rat race, just under the figures, scrolls away with the page: only the figures stick.
  const wayOut = useMemo(() => <Hud part="wayOut" />, []);
  // The stage is made once a stage, as the Hud's parts are: what Play itself draws again (the basket opened, the calendar turning) does not draw it again.
  const stageView = useMemo(() => <StageView stage={stage} />, [stage]);
  // In the finances, their tabs stick under the figures, and what stands between the two (the strip of a crisis, the guide's tip) scrolls up under them.
  const finances = stage === 'finance';
  const financeTabs = useMemo(() => <FinanceTabs />, []);
  const bar = room?.bar;
  const financeLeadIn = useMemo(() => <FinanceLeadIn wayOut={wayOut} bar={bar} />, [wayOut, bar]);
  // Made once for as long as it is open or shut: a step of the round draws Play again, and not the profile, which draws what it shows itself.
  const profileSheet = useMemo(() => <ProfileSheet open={profileOpen} onClose={closeProfile} />, [profileOpen, closeProfile]);
  // The moments that stop the game (a crisis opening, the rat race left, a bankruptcy): a sheet of their own, over everything, made once, as the
  // web's are mounted once with the page; each reads the round itself.
  const moments = useMemo(() => <Moments />, []);

  if (fault) return <Fault />;
  if (!playing) return <Waiting>{common('loading')}</Waiting>;
  // A life that is over: its end, with its own two ways on (another life, and home); in a room, the room's order over it.
  if (stage === 'end') return <End extra={room?.end} />;

  // The life was played on somewhere else (on a phone, only another device could): the store has already opened it as it now stands, and the player is told why the screen changed.
  // In a room the life moves on with the room, which says itself how many rounds the clock played: no word of another device.
  const notice = <Toast message={moved && !room ? phone('moved') : null} onDone={clearMoved} ms={6_000} />;
  // In a room, once the player has played, the wait stands in for the round's button.
  const actions = room?.actions ?? <Actions stage={stage} desk={desk} onBasket={() => setBasketOpen(true)} />;
  const hasActions = stage !== 'cards' || room?.actions != null;
  const heading = play('heading', { life: text.lives[lifeId ?? '']?.name ?? '', age: ageAt(content, round) });

  if (desk) {
    // The same pieces in three columns (PlayDesk.web.tsx): the profile is at the side, so is no sheet; the orders too.
    return (
      <FinanceShell>
        <CoinTargets>
          <PerfDrawn name={`stage: ${stage}`} />
          <PlayDesk
            stage={stage}
            heading={heading}
            stageName={stageName}
            bar={bar}
            scroller={scroller}
            main={
              <>
                <StageView stage={stage} desk />
                {/* In a room, under the ledger of a round, the room's order as it left it (the web's `mt-4`). */}
                {room && stage === 'resolve' ? <View style={{ marginTop: 16 }}>{room.resolved}</View> : null}
              </>
            }
            actions={hasActions ? actions : null}
            fixed={
              <>
                <CoinFlights />
                {notice}
                {finances ? <FinanceToasts /> : null}
                {pageTurn}
                {moments}
              </>
            }
          />
        </CoinTargets>
      </FinanceShell>
    );
  }

  return (
    // The page coins fly over: the HUD's cash is where they land, and they are drawn in the screen's own layer, over all of it (FlyingCoins.tsx).
    // The finances' tab is kept round all of it: their row of tabs and their panel are two places of this screen.
    <FinanceShell>
      <CoinTargets>
        <StickyScreen
          scroller={scroller}
          contentStyle={{ paddingTop: 0, gap: 8 }}
          lead={lead}
          header={header}
          subHeader={finances ? financeTabs : undefined}
          subGap={12}
          between={finances ? financeLeadIn : undefined}
          bar={
            hasActions ? (
              // Stuck to the foot of the screen, under the page: the next thing to do is always where the thumb is.
              <BottomBar>
                {actions}
              </BottomBar>
            ) : null
          }
          fixed={
            <>
              <CoinFlights />
              {notice}
              {finances ? <FinanceToasts /> : null}
              {pageTurn}
              {moments}
            </>
          }
        >
          <View accessibilityRole="header" style={{ position: 'absolute' }}>
            <SrOnly>{heading}</SrOnly>
          </View>
          <PerfDrawn name={`stage: ${stage}`} />
          {/* Right under the figures (their block's own 8 below them, the web's `pb-2`), not the page's gap further: in the finances it stands over their tabs (`FinanceLeadIn`). */}
          {finances ? null : <View style={{ marginTop: -8 }}>{wayOut}</View>}
          {compact && !finances ? <CrisisStrip /> : null}
          {/* In a room, its bar, 8 under the Hud (the web's `pt-2`); in the finances it stands over their tabs (`FinanceLeadIn`). */}
          {bar && !finances ? bar : null}
          {/* The web's `main pt-3` under the figures, 8 of it the page's gap. In the finances that room is over their tabs, which the panel stands right under. */}
          <View role="main" aria-label={stageName} style={finances ? { marginTop: -8 } : { paddingTop: 4, paddingBottom: hasActions ? 0 : 16 }}>
            {stageView}
            {/* In a room, under the ledger of a round, the room's order as it left it (the web's `mt-4`). */}
            {room && stage === 'resolve' ? <View style={{ marginTop: 16 }}>{room.resolved}</View> : null}
          </View>
          {basketOpen && finances ? <Basket onClose={() => setBasketOpen(false)} /> : null}
          {profileSheet}
        </StickyScreen>
      </CoinTargets>
    </FinanceShell>
  );
}
