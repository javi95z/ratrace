import { ageAt } from '@ratrace/core/game/present';
import { roundWarnings } from '@ratrace/core/game/roundWarnings';
import type { Stage } from '@ratrace/core/game/store';
import { previewCard } from '@ratrace/engine';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, BackHandler, Platform, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useBlink } from '../../ui/animations';
import { Framed } from '../../ui/Frame';
import { GOLD } from '../../ui/frames';
import { webBaseline } from '../../ui/fonts';
import { Button, Raised, SrOnly } from '../../ui/kit';
import { Sheet, Toast } from '../../ui/overlay';
import { BottomBar, type ScreenScroller } from '../../ui/Page';
import { StickyScreen } from '../../ui/Sticky';
import { PixelText, ReadText, SNUG } from '../../ui/text';
import { COLORS } from '../../ui/theme';
import { useGame, useSettings, useStill, useT, useWords } from '../context';
import { CrisisBar } from './Crisis';
import { Guide } from './Guide';
import { Hud } from './Hud';
import { NewsPanel } from './News';
import { PageTurn } from './PageTurn';

/*
 * A life being played, as the web's Play.tsx lays it on a phone. What the phone leaves out: the desk's three columns, the keyboard (its
 * shortcut and skip links), and what is only online (a room's bar, its wait and its order; a ranked life's notices, which a life on the
 * phone never has). Stages that later tasks bring are drawn in the meantime as a stand-in (`StandIn`), with the stage machine, the bar of
 * the next thing to do and the guide round them as they will stay.
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
      <Button variant="primary" wide disabled={busy} onPress={() => (warnings.length > 0 ? setAsking(true) : go())}>
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
 * will leave in cash, and opens the list of orders. Null where the screen itself is the choice.
 */
function Actions({ stage, onBasket }: { stage: Stage; onBasket(): void }) {
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
        <Button variant="primary" wide onPress={leaveNews}>
          {cardsWait ? news('toCards') : news('toFinance')}
        </Button>
      );
    case 'outcome':
      return (
        <Button variant="primary" wide disabled={busy} onPress={afterCard}>
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
            <Button variant="quiet" onPress={onBasket}>
              {finance('basket', { count: orders })}
            </Button>
            <View style={{ flex: 1 }}>
              <PlayRound />
            </View>
          </View>
        </View>
      );
    }
    case 'resolve':
      return (
        <Button variant="primary" wide onPress={next}>
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
 */
function StageView({ stage }: { stage: Stage }) {
  const body = <StageBody stage={stage} />;
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

/** What each stage of the round shows. Those a later task brings stand in as a line that says so, and keep the round going. */
function StageBody({ stage }: { stage: Stage }) {
  switch (stage) {
    case 'news':
      return <NewsPanel />;
    case 'cards':
      // Task 11: CardStage.
      return <CardsStandIn />;
    case 'outcome':
    case 'finance':
    case 'resolve':
      // Task 11: Outcome. Task 12: Finance. Task 16: Resolve.
      return <StageStandIn stage={stage} />;
    default:
      return null;
  }
}

/**
 * TEMPORARY, for development: what stands where a stage of the round will be until its task ports it, plainly not the game (a dashed box,
 * the stage's name after a sign of works). The round goes on through the bar of the next thing to do, as it will.
 */
function StandIn({ name, children }: { name?: string; children?: ReactNode }) {
  return (
    <View style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS['ink-500'], padding: 12, gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <ReadText size={13} tone="ink-300">{'🚧'}</ReadText>
        {name ? <ReadText size={13} tone="ink-300" style={{ flexShrink: 1 }}>{name}</ReadText> : null}
      </View>
      {children}
    </View>
  );
}

/** A stage a later task brings, as its stand-in: its name, as the stage is called for someone who cannot see it. */
function StageStandIn({ stage }: { stage: 'outcome' | 'finance' | 'resolve' }) {
  const play = useT('play');
  return <StandIn name={play(`stages.${stage}`)} />;
}

/**
 * TEMPORARY, for development (Task 11 brings the cards): the card on screen as a line, and its choices as buttons, so that a life can be
 * played on in the meantime. What it reads is what the web's cards read: the hand, the card's words, the choices that can be taken.
 */
function CardsStandIn() {
  const t = useT('cards');
  const { content, text } = useWords();
  const view = useGame((s) => s.view);
  const busy = useGame((s) => s.busy);
  const pick = useGame((s) => s.pick);
  const waiting = view !== null && view.phase === 'cards';
  const def = waiting ? content.cards.find((card) => card.id === view.hand[view.answered]) : undefined;
  const previews = useMemo(() => (view && def ? previewCard(content, view, def.id) : []), [content, view, def]);
  if (!view || !def) return null;
  const written = text.cards[def.id];
  const shown = previews.flatMap((preview, index) => (preview.available ? [index] : []));
  return (
    <StandIn name={`${t('progress', { n: view.answered + 1, total: view.hand.length })} · ${def.category === 'world' ? t('world') : text.categories[def.category]}`}>
      <PixelText size={19}>{written.title}</PixelText>
      <View role="group" aria-label={t('choices', { title: written.title })} style={{ gap: 10 }}>
        {shown.map((i) => (
          <Button key={`${def.id}-${i}`} variant="secondary" wide disabled={busy} onPress={() => void pick(i)}>
            {written.options[i].label}
          </Button>
        ))}
      </View>
    </StandIn>
  );
}

/**
 * The two ways on from a screen the round cannot go on from: a new life, which takes the place of this screen, and home, the front door, wherever it
 * stands in the stack (the web's two links of its `Fault`).
 */
function WaysOut() {
  const t = useT('play');
  const router = useRouter();
  return (
    <>
      <Raised role="link" tone={GOLD} bg="gold-500" style={{ minHeight: 48, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }} onPress={() => router.replace('/new')}>
        <PixelText size={17} tone="ink-900">{t('newLife')}</PixelText>
      </Raised>
      <Raised role="link" bg="night-600" style={{ paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }} onPress={() => router.dismissTo('/')}>
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

/** TEMPORARY, for development (Task 18 brings the end of a life): what stands for it, and the two ways on from a life that is over. */
function EndStandIn() {
  return (
    <Middle>
      <StandIn />
      <WaysOut />
    </Middle>
  );
}

/** Away from the news, where the bar of a crisis is whole, a strip says it is on. It scrolls away with the page: only the figures stay stuck. */
function CrisisStrip() {
  const crisis = useGame((s) => (s.view ? (s.view.timeline[s.view.round]?.crisis ?? null) : null));
  return <CrisisBar crisis={crisis} compact />;
}

/**
 * TEMPORARY, for development (Task 12 brings the basket): what the finances' button of orders opens until then, so it is never a button
 * that does nothing.
 */
function BasketStandIn({ open, onClose }: { open: boolean; onClose(): void }) {
  const finance = useT('finance');
  const common = useT('common');
  const orders = useGame((s) => s.orders.length);
  return (
    <Sheet open={open} onClose={onClose} title={finance('basketTitle')} closeLabel={common('close')}>
      <StandIn name={finance('basket', { count: orders })} />
    </Sheet>
  );
}

/**
 * A life being played: the HUD, the stage of the round, and the next thing to do. The HUD is the two parts of the page's `StickyScreen`:
 * the portrait's row scrolls away, the figures stick. Each part is made once for as long as the HUD is compact or not, so a change of
 * stage draws neither again (the figures are drawn again by what they show). Android's Back goes home, and the life stays saved; a sheet
 * that is open takes Back first (its Modal does).
 */
export function Play() {
  const common = useT('common');
  const news = useT('news');
  const cards = useT('cards');
  const play = useT('play');
  const phone = useT('phone');
  const router = useRouter();
  const { content, text } = useWords();
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
  const scroller = useRef<ScreenScroller>(null);

  // No life to play: the front door is where one is started.
  useEffect(() => {
    if (status === 'none') router.dismissTo('/');
  }, [status, router]);

  // Android's Back, while this screen is in front: home, with the life as it stands (it is saved at every step). An open sheet is a Modal,
  // which takes Back itself and closes.
  useFocusEffect(
    useCallback(() => {
      const listening = BackHandler.addEventListener('hardwareBackPress', () => {
        router.dismissTo('/');
        return true;
      });
      return () => listening.remove();
    }, [router]),
  );

  // A sheet belongs to the stage it was opened in.
  useEffect(() => {
    setBasketOpen(false);
  }, [stage]);

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

  // What the stage is called, for someone who cannot see it change.
  const stageName = stage === 'news' ? news('title') : stage === 'cards' ? cards('progress', { n: Math.min(answered + 1, hand), total: hand }) : play(`stages.${stage}`);
  // A new stage starts at its top, and a screen reader says where the player now is (the web gives the stage the focus).
  const playing = status === 'playing' && round !== null;
  const shownStage = useRef<string | null>(null);
  useEffect(() => {
    if (!playing) return;
    scroller.current?.reveal(0, 0, false);
    if (shownStage.current !== null && shownStage.current !== stage && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility?.(stageName);
    shownStage.current = stage;
    // Said once a stage, in the words it has when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, playing]);

  // The skyline opens and closes a round. In between, the room goes to the cards and the finances.
  const compact = stage !== 'news' && stage !== 'resolve';
  const lead = useMemo(() => <Hud part="lead" compact={compact} />, [compact]);
  const header = useMemo(() => <Hud part="header" compact={compact} />, [compact]);

  if (fault) return <Fault />;
  if (!playing) return <Waiting>{common('loading')}</Waiting>;
  if (stage === 'end') return <EndStandIn />;

  // The life was played on somewhere else (on a phone, only another device could): the store has already opened it as it now stands, and the player is told why the screen changed.
  const notice = <Toast message={moved ? phone('moved') : null} onDone={clearMoved} ms={6_000} />;
  const hasActions = stage !== 'cards';
  const heading = play('heading', { life: text.lives[lifeId ?? '']?.name ?? '', age: ageAt(content, round) });

  return (
    <StickyScreen
      scroller={scroller}
      contentStyle={{ paddingTop: 0, gap: 8 }}
      lead={lead}
      header={header}
      bar={
        hasActions ? (
          // Stuck to the foot of the screen, under the page: the next thing to do is always where the thumb is.
          <BottomBar>
            <Actions stage={stage} onBasket={() => setBasketOpen(true)} />
          </BottomBar>
        ) : null
      }
      fixed={
        <>
          {notice}
          {pageTurn}
        </>
      }
    >
      <View accessibilityRole="header" style={{ position: 'absolute' }}>
        <SrOnly>{heading}</SrOnly>
      </View>
      {compact ? <CrisisStrip /> : null}
      {/* The web's `main pt-3` under the figures, 8 of it the page's gap. */}
      <View role="main" aria-label={stageName} style={{ paddingTop: 4, paddingBottom: hasActions ? 0 : 16 }}>
        <StageView stage={stage} />
      </View>
      <BasketStandIn open={basketOpen && stage === 'finance'} onClose={() => setBasketOpen(false)} />
    </StickyScreen>
  );
}
