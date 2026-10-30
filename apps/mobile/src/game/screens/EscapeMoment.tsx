import type { Milestone } from '@ratrace/content';
import type { Reached } from '@ratrace/core/game/lifeMilestones';
import { momentsOf, type Moment, type Seen } from '@ratrace/core/game/moments';
import { escapeAge } from '@ratrace/core/game/present';
import { escapeUnder } from '@ratrace/core/game/rules';
import { escapeProgress } from '@ratrace/engine';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Platform, View, useWindowDimensions, type HostInstance } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import { useHaptic } from '../../ui/haptic';
import { Button } from '../../ui/kit';
import { stepped } from '../../ui/motion';
import { Sheet } from '../../ui/overlay';
import { Sparks } from '../../ui/Sparks';
import { Sprite } from '../../ui/Sprite';
import { ReadText, PixelText, SNUG } from '../../ui/text';
import { COLORS, type ColorToken } from '../../ui/theme';
import { useGame, useStill, useT, useWords } from '../context';
import { Loop } from './Loop';

/*
 * The way out of the rat race, the first time a life gets out: the game's biggest moment, on the whole screen over the round's result. The rat in
 * its wheel leaps out of it as the wheel falls away, cheering, gold and confetti falling over everything and fireworks going off; the headline, what
 * the money brings in against what the life costs, and one button to go on. The round's other rewards wait in their sheet until it has gone
 * (Celebrations.tsx). A later way out of the same life (one lost and won again) is a step of that sheet, as before. With motion left out it is one
 * still picture: the rat cheering, nothing falling.
 */

/** The moment of the way out, where it is due on the screen as it stands and it is the life's first: its story tells no way out before this one. */
export function firstEscapeOf(seen: Seen & { story: readonly Milestone[] }): Extract<Moment, { kind: 'escape' }> | null {
  const out = momentsOf(seen).find((each): each is Extract<Moment, { kind: 'escape' }> => each.kind === 'escape');
  if (!out) return null;
  // The story the round left tells this way out already (as its last); a second one told is a way out won again.
  return seen.story.filter((each) => each.kind === 'escaped').length <= 1 ? out : null;
}

/** The value at `at` along a line through the points (`xs` rising), held at its ends. */
function along(at: number, xs: readonly number[], ys: readonly number[]): number {
  'worklet';
  if (at <= xs[0]) return ys[0];
  for (let i = 1; i < xs.length; i += 1) {
    if (at <= xs[i]) return ys[i - 1] + ((at - xs[i - 1]) / (xs[i] - xs[i - 1])) * (ys[i] - ys[i - 1]);
  }
  return ys[ys.length - 1];
}

/** How long the rat takes to leave its wheel, from the moment opening to landing: it runs in it for the first half. */
const LEAP_MS = 1400;
/** Where in the leap it jumps (the wheel falls away) and where it lands. */
const JUMPS = 0.45;
const LANDS = 0.85;
/** The hop of joy it keeps up once landed, in steps: high, a little bounce, then still for a beat. */
const HOP_MS = 900;
const HOP = [0, -12, -16, -12, 0, -5, 0, 0, 0] as const;

/** The scene's box: the wheel (48 drawn three times as large) at its foot, the cheering rat (128) over it. */
const SCENE = { w: 220, h: 200 };
const WHEEL = 144;
const RAT = 128;

/**
 * The rat leaving its wheel: the wheel turns with it inside, then drops and fades as the rat springs out of it, larger, with a burst of gold, and
 * hops for joy once it lands. On the phone's animation thread (and react-native-web's, on the web). Where motion is left out, the rat cheering, still.
 */
function Leap() {
  const still = useStill();
  const leap = useSharedValue(still ? 1 : 0);
  const hop = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    leap.value = 0;
    leap.value = withTiming(1, { duration: LEAP_MS, easing: Easing.linear });
    hop.value = 0;
    hop.value = withDelay(LEAP_MS, withRepeat(withTiming(1, { duration: HOP_MS, easing: Easing.linear }), -1, false));
    return () => {
      cancelAnimation(leap);
      cancelAnimation(hop);
    };
  }, [still, leap, hop]);
  const wheel = useAnimatedStyle(() => ({
    opacity: along(leap.value, [0, JUMPS, JUMPS + 0.15], [1, 1, 0]),
    transform: [{ translateY: Math.round(along(leap.value, [0, JUMPS, JUMPS + 0.15], [0, 0, 28])) }, { scale: along(leap.value, [0, JUMPS, JUMPS + 0.15], [1, 1, 0.8]) }],
  }));
  const rat = useAnimatedStyle(() => {
    const step = Math.min(HOP.length - 1, Math.round(stepped(hop.value, HOP.length) * HOP.length));
    const up = along(leap.value, [JUMPS, 0.68, LANDS, 1], [44, -40, 0, 0]);
    return {
      opacity: along(leap.value, [0, JUMPS, JUMPS + 0.04], [0, 0, 1]),
      transform: [{ translateY: Math.round(up + (HOP[step] ?? 0)) }, { scale: along(leap.value, [JUMPS, 0.68, LANDS], [0.5, 1.12, 1]) }],
    };
  });
  return (
    <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" {...{ dataSet: { leap: still ? 'still' : 'leaping' } }} style={{ width: SCENE.w, height: SCENE.h }}>
      {still ? null : (
        <Animated.View style={[{ position: 'absolute', left: (SCENE.w - WHEEL) / 2, bottom: 0 }, wheel]}>
          <Loop name="wheel" ms={110} scale={3} />
        </Animated.View>
      )}
      <Animated.View style={[{ position: 'absolute', left: (SCENE.w - RAT) / 2, bottom: 16 }, still ? null : rat]}>
        <Sprite id="rat.cheer" fallback={{ w: RAT, h: RAT }} />
      </Animated.View>
      {/* The gold thrown up as it springs out, from where the wheel was. */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: WHEEL }}>
        <Sparks colours={['gold-500', 'gold-200', 'cream']} count={14} reach={96} size={6} delayMs={LEAP_MS * JUMPS} />
      </View>
    </View>
  );
}

/** Each piece of confetti: across the screen in percent, how long it waits, how long one fall takes, its colour and size. Fixed, so it falls the same every time. */
const PIECES: ReadonlyArray<readonly [left: number, delayMs: number, ms: number, colour: ColorToken, size: number]> = [
  [3, 0, 2600, 'gold-500', 8], [9, 700, 3100, 'cream', 6], [15, 250, 2800, 'teal-300', 8], [21, 1100, 2500, 'gold-200', 6],
  [27, 400, 3300, 'wine-300', 8], [33, 900, 2700, 'gold-500', 6], [39, 150, 3000, 'cream', 8], [45, 1300, 2600, 'teal-300', 6],
  [51, 550, 2900, 'gold-200', 8], [57, 50, 3200, 'gold-500', 6], [63, 800, 2700, 'wine-300', 6], [69, 300, 3100, 'cream', 8],
  [75, 1000, 2500, 'gold-200', 6], [81, 200, 2800, 'teal-300', 8], [87, 650, 3000, 'gold-500', 6], [93, 1200, 2600, 'cream', 8],
  [6, 1500, 2900, 'gold-200', 6], [30, 1700, 2700, 'gold-500', 8], [54, 1600, 3100, 'teal-300', 6], [78, 1800, 2800, 'wine-300', 8],
];

/** One piece, falling the height of the screen again and again, turning, in steps as the game's pixels move. */
function Piece({ left, delayMs, ms, colour, size, drop }: { left: number; delayMs: number; ms: number; colour: ColorToken; size: number; drop: number }) {
  const fall = useSharedValue(0);
  useEffect(() => {
    fall.value = 0;
    fall.value = withDelay(delayMs, withRepeat(withTiming(1, { duration: ms, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(fall);
  }, [fall, delayMs, ms]);
  const style = useAnimatedStyle(() => {
    const at = stepped(fall.value, 40);
    return { transform: [{ translateY: Math.round(-size + at * (drop + size * 2)) }, { rotate: `${Math.round(at * 4) * 90}deg` }] };
  });
  return <Animated.View style={[{ position: 'absolute', left: `${left}%`, top: -size * 2, width: size, height: size, backgroundColor: COLORS[colour] }, style]} />;
}

/** The fireworks going off over the screen: the burst's loop at three places, and the cheer. Decoration. */
const FIREWORKS: ReadonlyArray<readonly [left: `${number}%`, top: `${number}%`, ms: number]> = [
  ['6%', '6%', 170],
  ['72%', '9%', 200],
  ['40%', '2%', 230],
];

/** Confetti and fireworks over the whole screen. None of it where motion is left out, nor for a screen reader. */
function Party() {
  const still = useStill();
  const { height } = useWindowDimensions();
  if (still) return null;
  return (
    <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" {...{ dataSet: { confetti: '' } }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {FIREWORKS.map(([left, top, ms]) => (
        <View key={left} style={{ position: 'absolute', left, top, opacity: 0.85 }}>
          <Loop name="burst" ms={ms} scale={2} />
        </View>
      ))}
      {PIECES.map(([left, delayMs, ms, colour, size]) => (
        <Piece key={`${left}.${delayMs}`} left={left} delayMs={delayMs} ms={ms} colour={colour} size={size} drop={height} />
      ))}
    </View>
  );
}

/** Felt as the rat springs out of its wheel and as it lands, after the fanfare's own success (game/feel.ts): the strongest the game says. */
function useFeltLeap() {
  const haptic = useHaptic();
  useEffect(() => {
    const timers = [setTimeout(() => haptic('threshold'), LEAP_MS * JUMPS), setTimeout(() => haptic('success'), LEAP_MS * LANDS)];
    return () => timers.forEach(clearTimeout);
    // Once, as it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * The first way out of the life, on the whole screen (`Sheet`'s `full`). `round`: the round it got out in, whose age it tells. `lead`: the milestone it is, where the step reached it (the first time ever,
 * a record), said over the headline. `open` false lets it go (its Continue pressed, Back): `onGone` once it has.
 */
export function EscapeMoment({ open, round, lead, onClose, onGone }: { open: boolean; round: number; lead: Reached | null; onClose(): void; onGone(): void }) {
  const t = useT('moments');
  const milestone = useT('milestone');
  const view = useGame((s) => s.view);
  // The way out as the life's own rules measure it: a life under older rules says its own figures.
  const rules = useGame((s) => s.rules);
  const { content, fmt } = useWords();
  const go = useRef<HostInstance>(null);
  useFeltLeap();
  const years = content.yearsPerRound;
  const escape = view ? escapeUnder(rules, escapeProgress(content, view)) : null;
  const note = lead === null ? null : lead.best === null ? milestone('first') : lead.age < lead.best ? milestone('record', { age: lead.best }) : null;
  const kicker = note ?? t('escape.kicker');
  const headline = t('escape.headline');
  const body = t('escape.body', { age: escapeAge(content, round) });
  const covers = escape ? t('escape.covers', { passive: fmt.money(Math.floor(escape.passiveAfterTax / years)), costs: fmt.money(Math.floor(escape.outgoings / years)) }) : '';

  // Said to a screen reader as it opens, after the dialog's name: what it is, and what the money does now.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const later = setTimeout(() => AccessibilityInfo.announceForAccessibility([kicker, headline, body, covers].filter(Boolean).join('. ')), 400);
    return () => clearTimeout(later);
    // Once, as it opens, in the words it opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Sheet open={open} onClose={onClose} onGone={onGone} title={headline} closeLabel={t('escape.continue')} initialFocus={go} full={{ above: <Leap />, over: <Party /> }}>
      <View {...{ dataSet: { moment: 'escape-full' } }} style={{ alignSelf: 'stretch', alignItems: 'center', gap: 16 }}>
        <PixelText size={13} tone="teal-300" style={{ letterSpacing: 13 * 0.14, textTransform: 'uppercase', textAlign: 'center' }}>{kicker}</PixelText>
        <ReadText size={16} lineHeight={16 * SNUG} style={{ textAlign: 'center' }}>{body}</ReadText>
        {covers ? (
          <ReadText size={15} lineHeight={15 * SNUG} tone="ink-200" style={{ textAlign: 'center' }}>{covers}</ReadText>
        ) : null}
        <View style={{ alignSelf: 'stretch', marginTop: 8 }}>
          <Button ref={go} variant="primary" wide onPress={onClose}>
            {t('escape.continue')}
          </Button>
        </View>
      </View>
    </Sheet>
  );
}
