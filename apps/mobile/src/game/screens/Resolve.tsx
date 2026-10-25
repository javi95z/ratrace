import { milestoneArt } from '@ratrace/content';
import type { MilestoneScene } from '@ratrace/content';
import { milestoneOf } from '@ratrace/core/game/milestones';
import { ageAt, roundNotes } from '@ratrace/core/game/present';
import type { RoundNote } from '@ratrace/core/game/present';
import { bankQuip, familyQuip, ratOutfit } from '@ratrace/core/game/quips';
import { netWorth } from '@ratrace/engine';
import type { GameEvent } from '@ratrace/engine';
import { memo, useContext, useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useCountUp, usePop, useRise, useSink } from '../../ui/animations';
import { useDrawnFirst } from '../../ui/drawnFirst';
import { Framed } from '../../ui/Frame';
import { CREAM, GOLD, type FrameTone } from '../../ui/frames';
import { Bare, KeyFigure, Panel, Row, SrOnly } from '../../ui/kit';
import { Sparks } from '../../ui/Sparks';
import { ArtScale, Sprite } from '../../ui/Sprite';
import { LEVEL_2 } from '../../ui/headingLevel';
import { PixelText, ReadText, SNUG } from '../../ui/text';
import { COLORS, type ColorToken } from '../../ui/theme';
import { useGame, useStill, useT, useWords } from '../context';
import { useRoomSlice } from '../roomSlice';
import { Celebrations } from './Celebrations';
import { FlyingCoins, useCoinTarget } from './FlyingCoins';
import { Loop } from './Loop';

/*
 * The web's Resolve.tsx on a phone: the ledger of a round, rolling up line by line, and where it leaves the player. What the phone leaves out:
 * nothing of the round. In a room, a note of another player names them as the room does (their name, or the room's name for a stranger).
 */

/** The ground, the frame and the words of a note, by its tone (the web's `NOTE`: gold is `frame-gold bg-gold-500 text-ink-900`). */
/** The confetti round a cheer's picture, as the web's page draws it: 48 high, held to its 40-point box's width. */
const CHEER = { w: 40, h: 48 };

const NOTE: Record<RoundNote['tone'], { bg: ColorToken; fg: ColorToken; frame?: FrameTone }> = {
  gold: { bg: 'gold-500', fg: 'ink-900', frame: GOLD },
  good: { bg: 'teal-800', fg: 'cream' },
  bad: { bg: 'wine-700', fg: 'cream' },
  plain: { bg: 'night-700', fg: 'cream' },
};

/** How long each line of the ledger waits for the one before it. */
const ROLL_MS = 80;
/** How long a line takes to rise into place. */
const RISE_MS = 280;

/** What each milestone is called on screen: the key of each is written out. */
const MILESTONE_TITLE: Record<MilestoneScene, string> = {
  home: 'milestones.home',
  wedding: 'milestones.wedding',
  child: 'milestones.child',
  businessSold: 'milestones.businessSold',
  retired: 'milestones.retired',
  promotion: 'milestones.promotion',
};

/** Money that came in on its own: it flies to the cash as coins once the ledger has rolled. */
const PASSIVE: ReadonlySet<string> = new Set(['dividends', 'interest', 'rent', 'otherPassive', 'business']);

/**
 * The names the ledger's coins go by on the page they fly over (FlyingCoins.tsx: names are the whole page's, so each part that flies coins has its
 * own): the lines that paid on their own, which they leave from, and the cash now, where they land (the web's `data-coin-from` and `data-coin-to`,
 * both inside the ledger: not the HUD's cash).
 */
const LEDGER_FROM = 'ledger';
const LEDGER_TO = 'ledger-cash';

/** A figure counting, with what it ends on said to a screen reader at once (the web's `sr-only` words beside the `aria-hidden` figure). */
function Counting({ said, children }: { said: string; children: ReactNode }) {
  return (
    <>
      <SrOnly>{said}</SrOnly>
      <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {children}
      </View>
    </>
  );
}

/**
 * How long, from now, until the moment `at` (a `Date.now()`): a part put in after the page came (the panels under the ledger, once it is on screen)
 * waits from when the page came, as the web's do from its page's, and not from its own mount. Read once, as the part is put in.
 */
function useWaitUntil(at: number): number {
  const [wait] = useState(() => Math.max(0, at - Date.now()));
  return wait;
}

/**
 * The cash after the round, counted up from what it was as the coins land, from `at` on (a `Date.now()`). The count is this figure's alone: it is
 * drawn again for each step of it, and nothing round it is.
 */
function CashCount({ from, to, at }: { from: number; to: number; at: number }) {
  const { fmt } = useWords();
  const delay = useWaitUntil(at);
  const shown = useCountUp(to, { from, delay, ms: 800 });
  const place = useCoinTarget(LEDGER_TO);
  return (
    <View ref={place} collapsable={false} {...{ dataSet: { coinTo: '' } }}>
      <Counting said={fmt.money(to)}>
        <PixelText size={15} style={{ textAlign: 'right' }}>{fmt.money(shown)}</PixelText>
      </Counting>
    </View>
  );
}

/** How long net worth takes to count to where the round left it. */
const WORTH_MS = 1100;

/** Net worth counting, in the key figure's size: drawn again for each step of the count, and nothing round it is. */
function WorthCount({ from, to, delay, tone }: { from: number; to: number; delay: number; tone: 'gold' | 'wine' }) {
  const { fmt } = useWords();
  const shown = useCountUp(to, { from, delay, ms: WORTH_MS });
  return (
    <Counting said={fmt.money(to)}>
      <KeyFigure tone={tone}>{fmt.money(shown)}</KeyFigure>
    </Counting>
  );
}

/**
 * Where the round leaves the player, made to be felt: net worth counts from what it was to what it is from `at` on (a `Date.now()`), lands with a
 * jump (or sinks, in red), and says by how much. Where motion is left out, it stands where it ends at once.
 */
function WorthRise({ from, to, at }: { from: number; to: number; at: number }) {
  const t = useT('resolve');
  const { fmt } = useWords();
  const still = useStill();
  const delay = useWaitUntil(at);
  const [landed, setLanded] = useState(still);
  useEffect(() => {
    if (still) return setLanded(true);
    const timer = setTimeout(() => setLanded(true), delay + WORTH_MS);
    return () => clearTimeout(timer);
  }, [still, delay]);
  const change = to - from;
  const up = change >= 0;
  // It jumps or sinks once, as it lands (the web's `animate-pop` or `animate-sink`, put on it then); the change rises into the place kept for it.
  const pop = usePop({ play: landed && change !== 0 && up });
  const sink = useSink({ play: landed && change !== 0 && !up });
  const rise = useRise({ play: landed });

  return (
    <View {...{ dataSet: { worth: '' } }} style={{ marginTop: 4, borderTopWidth: 2, borderTopColor: COLORS['night-900'], paddingTop: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ minWidth: 0, flexShrink: 1 }}>
          <PixelText size={17}>{t('netWorth')}</PixelText>
          <ReadText size={12} tone="ink-300">{t('before', { amount: fmt.money(from) })}</ReadText>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Animated.View style={up ? pop : sink}>
            <WorthCount from={from} to={to} delay={delay} tone={landed && !up ? 'wine' : 'gold'} />
          </Animated.View>
          <Animated.View style={[{ marginTop: 4, paddingHorizontal: 6, backgroundColor: COLORS[up ? 'teal-800' : 'wine-900'] }, rise]}>
            <PixelText size={14} tone={up ? 'teal-300' : 'wine-300'}>{fmt.signed(change)}</PixelText>
          </Animated.View>
          {landed && !still && change > 0 ? <Sparks colours={['gold-500', 'gold-200', 'cream']} count={12} reach={48} /> : null}
        </View>
      </View>
    </View>
  );
}

/**
 * One line of the ledger, rising in its turn: `at` lines after the first, `ROLL_MS` each (the web's `animationDelay`), on the phone's animation
 * thread. Its props are its words and its figure, so a line is drawn once, as it comes, and never again while the ledger is on screen: not while
 * the cash counts up under it. A line that paid on its own is where the coins leave from.
 *
 * The web's is a row of a `<table>`: its name on the left, its figure on the right and never wrapped, in the middle of the line. A row here is the
 * same, each in its own box: a name long enough to wrap takes the room its own figure leaves it (the table's column takes the room the widest figure
 * leaves every name).
 */
const LedgerLine = memo(function LedgerLine({ line, label, amount, at }: { line: string; label: string; amount: number; at: number }) {
  const { fmt } = useWords();
  const rise = useRise({ delayMs: at * ROLL_MS });
  const from = useCoinTarget(LEDGER_FROM);
  const paid = PASSIVE.has(line) && amount > 0;
  return (
    <Animated.View style={rise}>
      <View role="row" {...{ dataSet: { line } }} style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View role="rowheader" style={{ flex: 1, minWidth: 0, paddingVertical: 2, paddingRight: 12 }}>
          <ReadText size={14}>{label}</ReadText>
        </View>
        <View role="cell" ref={paid ? from : undefined} collapsable={false} {...(paid ? { dataSet: { coinFrom: '' } } : null)} style={{ flexShrink: 0, paddingVertical: 2 }}>
          <PixelText size={14} tone={amount >= 0 ? 'teal-300' : 'wine-300'} style={{ textAlign: 'right' }}>
            {fmt.signed(amount)}
          </PixelText>
        </View>
      </View>
    </Animated.View>
  );
});

/**
 * Something that happened in the round besides the money, rising in a frame of its colour: its picture (with confetti round it, for a cheer), what
 * it was and what it means.
 */
function Note({ note }: { note: RoundNote }) {
  const rise = useRise();
  const look = NOTE[note.tone];
  return (
    <View accessible role="status" accessibilityLiveRegion="polite">
      <Animated.View style={rise}>
        <Framed kind="frame" tone={look.frame} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, backgroundColor: COLORS[look.bg] }}>
          <Bare style={{ width: 40, height: 40 }}>
            <Sprite id={note.icon} />
            {/* The web's `absolute -inset-1`: a 48-point loop 4 out from the 40-point box's corner. Its picture is held to the box's width by the
                page's `img { max-width: 100% }` (measured: 40 × 48 on the web's page), so it is drawn squeezed into 40 × 48, as there. */}
            {note.cheer ? <Loop name="confetti" size={CHEER} style={{ position: 'absolute', top: -4, left: -4 }} /> : null}
          </Bare>
          <View style={{ minWidth: 0, flexShrink: 1 }}>
            <PixelText size={17} tone={look.fg}>{note.title}</PixelText>
            {note.hint ? (
              <ReadText size={13} tone={look.fg} lineHeight={13 * SNUG}>
                {note.hint}
              </ReadText>
            ) : null}
          </View>
        </Framed>
      </Animated.View>
    </View>
  );
}

/** A milestone of the life, with its picture, as wide as the picture and never wider than the page (the web's `figure`). */
function Milestone({ scene }: { scene: MilestoneScene }) {
  const t = useT('resolve');
  const art = useContext(ArtScale);
  const rise = useRise();
  return (
    <Animated.View style={rise}>
      <View {...{ dataSet: { milestone: scene } }} style={{ width: 288 * art + 4, maxWidth: '100%', alignSelf: 'center' }}>
        <Framed kind="frame" tone={CREAM} style={{ backgroundColor: COLORS.cream }}>
          {/* The web's `border-2 border-cream`: two points of the frame's own cream round the picture. */}
          <View style={{ padding: 2 }}>
            <Sprite id={milestoneArt[scene]} scale="art" fallback={{ w: 288, h: 120 }} />
          </View>
          <View style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
            <PixelText size={17} tone="ink-900" style={{ textAlign: 'center' }}>
              {t(MILESTONE_TITLE[scene])}
            </PixelText>
          </View>
        </Framed>
      </View>
    </Animated.View>
  );
}

/** What is said of the two years, by the bank or at the family's table (the web's `dt` and `dd`). */
function Said({ title, words }: { title: string; words: string }) {
  return (
    <View>
      <PixelText size={12} tone="gold-200" style={{ letterSpacing: 12 * 0.05, textTransform: 'uppercase' }}>
        {title}
      </PixelText>
      <ReadText size={13} tone="ink-200" lineHeight={13 * SNUG} italic>
        {words}
      </ReadText>
    </View>
  );
}

/**
 * Two years later: what happened, then the ledger rolling up line by line, then where it leaves the player. Every line is an event the engine
 * sent; nothing is added up here but two net worths.
 *
 * The ledger is at most one line of each kind of money the engine writes (25 kinds: the round's tally writes each once, and a homecoming its
 * gift), so it is drawn whole in the page's scroll, as the web's table is: never past the 30 lines a list is windowed from, and a list windowed
 * inside the page's own scroll would not be windowed at all. Each line is drawn once (`LedgerLine`).
 */
export function Resolve() {
  const t = useT('resolve');
  const crisis = useT('crisis');
  const words = useWords();
  const { content, text } = words;
  const resolved = useGame((s) => s.resolved);
  const story = useGame((s) => s.story);
  const view = useGame((s) => s.view);
  // The names the players of a room go by, by their ids: only these, so a look at the room (a seat that played, a shout) does not draw the ledger again.
  const names = useRoomSlice(({ room: now }) => (now === null ? null : Object.fromEntries(now.members.map((member) => [member.userId, member.name]))));
  const room = useT('room');
  const still = useStill();
  // When the page came: the counts under the ledger start from then, as the web's do, though their panels are put in later.
  const [came] = useState(() => Date.now());
  // The panels under the ledger, once the top of the page is on screen (ui/drawnFirst.ts). Where motion is left out the page stands still from
  // the first frame, every line in place: nothing comes after it, so those panels are put in with it.
  const drawn = useDrawnFirst();
  const rest = drawn || still;
  if (!resolved || !view) return null;

  const { before, events } = resolved;
  const scene = milestoneOf(story, before.round, view.round);
  // Who did something to this life, in a game with friends, by the name the room shows.
  const whoIs = (userId: string) => names?.[userId] ?? room('nameless', { tag: userId.slice(0, 4).toUpperCase() });
  const notes = roundNotes(words, t, events, whoIs);
  const lines = events.filter((e): e is Extract<GameEvent, { kind: 'ledger' }> => e.kind === 'ledger');
  // A crisis that was on when the round was played and is not now has just ended.
  const ended = before.timeline[before.round]?.crisis && !view.timeline[view.round]?.crisis ? before.timeline[before.round].crisis : null;
  const worthBefore = netWorth(before.player);
  const worthNow = netWorth(view.player);
  const bank = bankQuip(before, view, events);
  const family = familyQuip(content, before, view);
  // The coins leave once every line of the ledger is in place, and the cash counts as they land.
  const rolled = lines.length * ROLL_MS + RISE_MS;

  return (
    <View style={{ gap: 12 }}>
      <FlyingCoins from={LEDGER_FROM} to={LEDGER_TO} startMs={rolled} />
      <View>
        {/* Two years go by: the wheel turns. (The web's title is a flex row in a centred block: it stands at the left, and the ages under it in the middle.) */}
        <View accessibilityRole="header" {...LEVEL_2} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Loop name="wheel" outfit={ratOutfit(view)} />
          <PixelText size={22} tone="gold-500" style={{ flexShrink: 1 }}>
            {t('title')}
          </PixelText>
        </View>
        <ReadText size={13} tone="ink-300" style={{ textAlign: 'center' }}>
          {t('ages', { from: ageAt(content, before.round), to: ageAt(content, view.round) })}
        </ReadText>
      </View>

      <Celebrations />
      {/* A milestone of the life gets its picture, on the round it happened in. */}
      {scene ? <Milestone scene={scene} /> : null}
      {ended ? <Note note={{ tone: 'good', icon: 'icon.economy', title: crisis('over', { crisis: text.crises[ended.id].name }), hint: crisis('overHint') }} /> : null}
      {notes.map((note, i) => (
        <Note key={i} note={note} />
      ))}

      <Panel>
        <View role="table" aria-label={t('ledger')}>
          {lines.map((line, i) => (
            <LedgerLine key={i} line={line.line} label={text.ledger[line.line]} amount={line.amount} at={i} />
          ))}
        </View>
      </Panel>

      {/* Where the round leaves the player, and what is said of it: under the first screen of a phone, put in once the ledger is on it (the
          coins and the counts wait for the ledger to roll, far longer, from when the page came). */}
      {rest ? (
        <>
          <Panel>
            <Row left={[<Loop key="coin" name="coin" />, t('cashNow')]} right={<CashCount from={before.player.cash} to={view.player.cash} at={came + rolled + 450} />} />
            <WorthRise from={worthBefore} to={worthNow} at={came + rolled + 450 + 800} />
          </Panel>

          {/* What is said of the two years, by the bank and at the family's table: for a smile, it changes nothing. */}
          <Panel>
            <View style={{ gap: 8 }}>
              {bank ? <Said title={t('bank.title')} words={t(`bank.${bank}`)} /> : null}
              <Said title={t('family.title')} words={t(`family.${family}`)} />
            </View>
          </Panel>
        </>
      ) : null}
    </View>
  );
}
