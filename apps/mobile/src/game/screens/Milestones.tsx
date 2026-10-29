import { portraitArt, rarityOf } from '@ratrace/content';
import { celebrationOf } from '@ratrace/core/game/lifeMilestones';
import type { Carried as Carrying, Celebration, Reached } from '@ratrace/core/game/lifeMilestones';
import { momentsOf } from '@ratrace/core/game/moments';
import { portraitAge } from '@ratrace/core/game/present';
import { useEffect } from 'react';
import { AccessibilityInfo, Platform, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useShallow } from 'zustand/react/shallow';
import { useRise } from '../../ui/animations';
import { Framed } from '../../ui/Frame';
import { GOLD } from '../../ui/frames';
import { Glow } from '../../ui/Glow';
import { Bare } from '../../ui/kit';
import { stepped } from '../../ui/motion';
import { Sparks } from '../../ui/Sparks';
import { Sprite } from '../../ui/Sprite';
import { PixelText, ReadText, SNUG, TIGHT } from '../../ui/text';
import { COLORS } from '../../ui/theme';
import { useGame, useInRoom, useStill, useT } from '../context';
import { Loop } from './Loop';
import { RARITY_GLOW } from './rarityStyle';

/*
 * The milestones of a life, celebrated in every life (core's lifeMilestones.ts decides which a step reached, once a life, and how big each is):
 * a banner that rises with the step's result, or the whole screen (a step of the round's sheet, Rewards.tsx) for the first time ever, a new personal
 * record and the way out. The step's badges follow the milestone in the same sheet, or come inside the moment that already has the screen.
 */

/**
 * How the step on screen is celebrated: in the moment that already has the screen (the first million, the way out), the whole screen, a banner,
 * or, with no milestone, the badges as they always were. A room never stops for one.
 */
export function useCelebration(): Celebration {
  const reached = useGame(useShallow((s) => s.reached));
  const earned = useGame(useShallow((s) => s.earned));
  // Only which moment has the screen, and only with a milestone to carry: the screen is drawn again for nothing else of the round.
  const moment = useGame((s) => (s.reached.length === 0 ? null : (momentsOf(s).find((each) => each.kind === 'escape' || each.kind === 'million')?.kind ?? null)));
  const inRoom = useInRoom();
  if (reached.length === 0) return { where: 'badges' };
  return celebrationOf({ reached, earned, legendary: (id) => rarityOf(id) === 'legendary', moment: moment as 'escape' | 'million' | null, inRoom });
}

/** The words of a milestone reached: its name, the headline that says it at its age, and the line under it. */
function useSaid() {
  const t = useT('milestone');
  return (each: Reached) => {
    const name = t(`names.${each.id}`);
    // A record is a younger age than any before; the first time ever has nothing to beat.
    const note = each.best === null ? t('first') : each.age < each.best ? t('record', { age: each.best }) : null;
    return { name, headline: t('headline', { name, age: each.age }), line: t(`lines.${each.id}`), note };
  };
}

/** What a step said, for a screen reader, as it comes up: VoiceOver has no live regions, so it is announced once, after what the stage says. */
function useAnnounced(said: string) {
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const later = setTimeout(() => AccessibilityInfo.announceForAccessibilityWithOptions?.(said, { queue: true }), 0);
    return () => clearTimeout(later);
    // Once, as it comes up, in the words it came up with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** The time of one hop of the portrait, and how many steps it is drawn in (the game's motion is stepped, as its pixels are). */
const HOP_MS = 900;
const HOP_STEPS = 9;
/** How high it hops, in points: high, then a little bounce, then still for a beat. */
const HOP = [0, -12, -16, -12, 0, -5, 0, 0, 0] as const;

/**
 * The player's portrait at the age of the milestone, hopping for joy: a loop on the phone's animation thread, in steps. With motion left out it
 * stands still.
 */
function Hopping({ lifeId, age, size }: { lifeId: string; age: number; size: number }) {
  const still = useStill();
  const at = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    at.value = 0;
    at.value = withRepeat(withTiming(1, { duration: HOP_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(at);
  }, [at, still]);
  const hop = useAnimatedStyle(() => {
    const step = Math.min(HOP_STEPS - 1, Math.round(stepped(at.value, HOP_STEPS) * HOP_STEPS));
    return { transform: [{ translateY: HOP[step] ?? 0 }] };
  });
  return (
    <Animated.View style={still ? undefined : hop}>
      <Bare style={{ width: size, height: size, backgroundColor: COLORS['gold-200'] }}>
        <Sprite id={portraitArt(lifeId, portraitAge(age))} fallback={{ w: 64, h: 64 }} size={{ w: size, h: size }} />
      </Bare>
    </Animated.View>
  );
}

/** The other milestones of the same step, under the one that leads in its banner. */
function Carried({ others }: { others: readonly Reached[] }) {
  const t = useT('milestone');
  const said = useSaid();
  if (others.length === 0) return null;
  return (
    <View style={{ alignSelf: 'stretch' }}>
        <View style={{ gap: 2 }}>
          <PixelText size={11} tone="ink-300" style={{ letterSpacing: 11 * 0.1, textTransform: 'uppercase' }}>{t('also')}</PixelText>
          {others.map((each) => {
            const { name, note } = said(each);
            return (
              <View key={each.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Sprite id="icon.star" />
                <ReadText size={13} lineHeight={13 * SNUG} style={{ flexShrink: 1 }}>{[`${name} · ${t('at', { age: each.age })}`, note].filter(Boolean).join(' · ')}</ReadText>
              </View>
            );
          })}
        </View>
    </View>
  );
}

/** A milestone as a banner that rises with the step's result: it stops nothing (the step's badges are steps of the round's sheet). */
export function MilestoneBanner({ plan, lifeId }: { plan: Carrying; lifeId: string }) {
  const t = useT('milestone');
  const said = useSaid();
  const rise = useRise();
  const { name, line, note } = said(plan.lead);
  useAnnounced(
    [t('kicker'), name, t('at', { age: plan.lead.age }), note ?? '', line, ...plan.others.map((each) => said(each).name)]
      .filter(Boolean)
      .join('. '),
  );
  return (
    <View accessible role="status" accessibilityLiveRegion="polite" {...{ dataSet: { milestoneBanner: plan.lead.id } }}>
      <Animated.View style={rise}>
        <Glow shadow={RARITY_GLOW.rare} />
        <Framed kind="frame" tone={GOLD} style={{ backgroundColor: COLORS['night-700'], padding: 8, gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flexShrink: 0 }}>
              <Hopping lifeId={lifeId} age={plan.lead.age} size={48} />
              <View aria-hidden style={{ position: 'absolute', left: 24, top: 24, width: 0, height: 0 }}>
                <Sparks colours={['gold-500', 'gold-200', 'cream']} count={10} reach={36} delayMs={300} />
              </View>
            </View>
            <View style={{ minWidth: 0, flexShrink: 1, flexGrow: 1 }}>
              <PixelText size={12} tone="gold-500" style={{ letterSpacing: 12 * 0.05, textTransform: 'uppercase' }}>{note ?? t('kicker')}</PixelText>
              <PixelText size={18} lineHeight={18 * TIGHT}>{name}</PixelText>
              <PixelText size={11} tone="ink-200" style={{ letterSpacing: 11 * 0.1, textTransform: 'uppercase' }}>{t('at', { age: plan.lead.age })}</PixelText>
              <ReadText size={13} tone="ink-200" lineHeight={13 * SNUG}>{line}</ReadText>
            </View>
            <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexShrink: 0, alignItems: 'center' }}>
              <Loop name="cheer" ms={180} />
            </View>
          </View>
          <Carried others={plan.others} />
        </Framed>
      </Animated.View>
    </View>
  );
}
