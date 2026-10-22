import { momentArt } from '@ratrace/content';
import { momentsOf } from '@ratrace/core/game/moments';
import type { Moment } from '@ratrace/core/game/moments';
import { ageAt, escapeAge } from '@ratrace/core/game/present';
import { escapeProgress, realNetWorth } from '@ratrace/engine';
import type { GameView } from '@ratrace/engine';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useFall, useReveal } from '../../ui/animations';
import { Framed } from '../../ui/Frame';
import { Button, Figure, Row } from '../../ui/kit';
import { Sheet } from '../../ui/overlay';
import { Sprite } from '../../ui/Sprite';
import { spriteBox } from '../../ui/sprites';
import { PixelText, ReadText, SNUG } from '../../ui/text';
import { COLORS, type ColorToken } from '../../ui/theme';
import { useGame, useStill, useT, useWords } from '../context';
import { CrisisDetails } from './Crisis';

/** Where each piece of confetti starts across the sheet, in percent, and how long it waits. Fixed, so it falls the same every time. */
const CONFETTI: ReadonlyArray<readonly [left: number, delayMs: number, colour: ColorToken]> = [
  [4, 0, 'gold-500'], [12, 260, 'cream'], [20, 90, 'gold-200'], [28, 420, 'teal-300'], [36, 30, 'gold-500'], [44, 310, 'gold-200'],
  [52, 150, 'cream'], [60, 480, 'gold-500'], [68, 60, 'teal-300'], [76, 350, 'gold-200'], [84, 200, 'gold-500'], [92, 110, 'cream'],
];

/** One piece of confetti, 8 points square: it waits where it starts, then falls the height of the sheet once, turning, on the phone's animation thread. */
function Piece({ left, delayMs, colour }: { left: number; delayMs: number; colour: ColorToken }) {
  const fall = useFall({ delayMs });
  return <Animated.View style={[{ position: 'absolute', left: `${left}%`, top: 0, width: 8, height: 8, backgroundColor: COLORS[colour] }, fall]} />;
}

/**
 * Gold falling over good news. Decoration only: it says nothing a screen reader needs, and it is not there at all where motion is left out (the
 * web's stylesheet hides it, `[data-confetti]`). It is the last thing in the sheet, so it falls over what is in it, as the web's, which is placed,
 * falls over what is not.
 */
function Confetti() {
  const still = useStill();
  if (still) return null;
  return (
    <View
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      {...{ dataSet: { confetti: '' } }}
      style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 0, pointerEvents: 'none' }}
    >
      {CONFETTI.map(([left, delay, colour]) => (
        <Piece key={left} left={left} delayMs={delay} colour={colour} />
      ))}
    </View>
  );
}

/** The size the picture of a moment is drawn at when its art is missing (the web's). */
const ART_FALLBACK = { w: 288, h: 120 };

/**
 * The picture of a moment, uncovered from the left as the sheet comes up (the web's `animate-reveal`, a clip of the picture): a box of its size, and in
 * it a box that clips it, as wide as the part shown.
 */
function Picture({ id }: { id: string }) {
  const reveal = useReveal();
  const box = spriteBox(id, 1, 1, ART_FALLBACK);
  return (
    <View style={{ width: box.w, height: box.h }}>
      <Animated.View style={[{ height: box.h, overflow: 'hidden' }, reveal]}>
        <Sprite id={id} fallback={ART_FALLBACK} />
      </Animated.View>
    </View>
  );
}

/** A frame of figures inside the sheet (the web's `frame bg-night-900 px-3 py-1`). */
function Figures({ children }: { children: ReactNode }) {
  return <Framed kind="frame" style={{ backgroundColor: COLORS['night-900'], paddingHorizontal: 12, paddingVertical: 4 }}>{children}</Framed>;
}

/** What each moment says, in the figures the game gave. */
function Body({ moment, view }: { moment: Moment; view: GameView }) {
  const t = useT('moments');
  const { content, fmt } = useWords();
  const age = ageAt(content, view.round);
  const years = content.yearsPerRound;
  const said = (text: string) => <ReadText size={15} lineHeight={15 * SNUG}>{text}</ReadText>;
  const hint = (text: string) => <ReadText size={13} tone="ink-300">{text}</ReadText>;

  switch (moment.kind) {
    case 'escape': {
      const escape = escapeProgress(content, view);
      return (
        <>
          {said(t('escape.body', { age: escapeAge(content, moment.round) }))}
          <Figures>
            <Row left={t('escape.passive')} right={<Figure tone="teal-300">{t('perYear', { amount: fmt.money(Math.floor(escape.passiveAfterTax / years)) })}</Figure>} />
            <Row left={t('escape.costs')} right={t('perYear', { amount: fmt.money(Math.floor(escape.outgoings / years)) })} />
          </Figures>
          {hint(t('escape.hint'))}
        </>
      );
    }
    case 'million':
      return (
        <>
          {said(t('million.body', { age }))}
          <Figures>
            <Row left={t('million.worth')} right={<Figure tone="gold-500">{fmt.money(realNetWorth(view))}</Figure>} />
          </Figures>
          {hint(t('million.hint'))}
        </>
      );
    case 'bankrupt':
      return (
        <>
          {said(t('bankrupt.body', { age }))}
          <Figures>
            <Row left={t('bankrupt.sold')} right={fmt.money(moment.proceeds)} />
            <Row left={t('bankrupt.cleared')} right={<Figure tone="teal-300">{fmt.money(moment.debtsCleared)}</Figure>} />
            <Row left={t('bankrupt.status')} right={<Figure tone="wine-300">{`−${fmt.number(content.debt.bankruptcyStatusPenalty)}`}</Figure>} />
          </Figures>
          {hint(t('bankrupt.hint', { age: ageAt(content, view.player.bankruptUntilRound) }))}
        </>
      );
    case 'crisis': {
      const crisis = view.timeline[view.round]?.crisis;
      return crisis ? <CrisisDetails crisis={crisis} /> : null;
    }
  }
}

/**
 * The moment the screen stops for: out of the rat race, the first million, bankruptcy, a crisis opening. Each has the screen to itself, with its
 * picture, until the player moves on; then the round goes on underneath as it was. Which moments are due is not decided here. One sheet, open while
 * any is due: a moment taken in gives its place to the next, the gravest first.
 */
export function Moments() {
  const t = useT('moments');
  const common = useT('common');
  const { text } = useWords();
  const stage = useGame((s) => s.stage);
  const view = useGame((s) => s.view);
  const resolved = useGame((s) => s.resolved);
  const story = useGame((s) => s.story);
  const gameId = useGame((s) => s.gameId);
  // The moments already taken in, by life and by key: one is never shown twice.
  const [done, setDone] = useState<ReadonlySet<string>>(() => new Set());
  if (!view) return null;

  const moment = momentsOf({ stage, view, resolved, story }).find((candidate) => !done.has(`${gameId}:${candidate.key}`));
  if (!moment) return null;
  const close = () => setDone((seen) => new Set(seen).add(`${gameId}:${moment.key}`));
  const good = moment.kind === 'escape' || moment.kind === 'million';
  const title = moment.kind === 'crisis' ? text.crises[moment.crisisId].name : t(`${moment.kind}.title`);
  const art = momentArt[moment.kind === 'crisis' ? moment.crisisId : moment.kind];

  return (
    <Sheet open onClose={close} title={title} closeLabel={common('close')} tone={good ? 'gold' : 'wine'}>
      <View {...{ dataSet: { moment: moment.kind } }} style={{ gap: 12 }}>
        <PixelText size={13} tone={good ? 'gold-500' : 'wine-300'} style={{ marginTop: -8, letterSpacing: 13 * 0.14, textTransform: 'uppercase' }}>
          {moment.kind === 'crisis' ? t('crisis.kicker', { rounds: moment.rounds }) : t(`${moment.kind}.kicker`)}
        </PixelText>
        {/* Its frame is drawn outside its box, so what clips the picture is a box inside it (the web's `overflow-hidden` clips nothing of a frame). */}
        <Framed kind="frame" style={{ alignSelf: 'center', maxWidth: '100%', backgroundColor: COLORS['night-900'] }}>
          <View style={{ maxWidth: '100%', overflow: 'hidden' }}>
            <Picture id={art} />
          </View>
        </Framed>
        <Body moment={moment} view={view} />
        <Button variant={good ? 'primary' : 'secondary'} wide onPress={close}>
          {t(`${moment.kind}.go`)}
        </Button>
        {good ? <Confetti /> : null}
      </View>
    </Sheet>
  );
}
