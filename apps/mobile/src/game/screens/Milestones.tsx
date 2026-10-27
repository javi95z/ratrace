import { LIFE_MILESTONE_ART, portraitArt, rarityOf } from '@ratrace/content';
import { celebrationOf } from '@ratrace/core/game/lifeMilestones';
import type { Carried as Carrying, Celebration, Reached } from '@ratrace/core/game/lifeMilestones';
import { momentsOf } from '@ratrace/core/game/moments';
import { portraitAge } from '@ratrace/core/game/present';
import { useEffect } from 'react';
import { AccessibilityInfo, Platform, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useShallow } from 'zustand/react/shallow';
import { useMedal, useReveal, useRise } from '../../ui/animations';
import { Framed } from '../../ui/Frame';
import { GOLD } from '../../ui/frames';
import { Glow } from '../../ui/Glow';
import { Bare, Button } from '../../ui/kit';
import { stepped } from '../../ui/motion';
import { Sparks } from '../../ui/Sparks';
import { Sprite } from '../../ui/Sprite';
import { spriteBox } from '../../ui/sprites';
import { PixelText, ReadText, SNUG, TIGHT } from '../../ui/text';
import { COLORS } from '../../ui/theme';
import { useGame, useInRoom, useSettings, useStill, useT, useWords } from '../context';
import { hrefOf } from '../pages';
import { canShareLink, shareLink } from '../sharing';
import { SITE_URL } from '../site';
import { Loop } from './Loop';
import { Medal } from './Medal';
import { RARITY_GLOW } from './rarityStyle';

/*
 * The milestones of a life, celebrated in every life (core's lifeMilestones.ts decides which a step reached, once a life, and how big each is):
 * a banner that rises with the step's result, or the whole screen for the first time ever, a new personal record and the way out. Whatever badges
 * the step earned come inside the same moment, the milestone leading: never two celebrations in a row.
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

/** A badge the same step earned, inside the milestone's moment: its medal turning in, its name and what it is for. */
function BadgeInside({ badgeId }: { badgeId: string }) {
  const t = useT('badges');
  const { text } = useWords();
  const medal = useMedal({ delayMs: 400 });
  const rarity = rarityOf(badgeId);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Animated.View style={[{ flexShrink: 0 }, medal]}>
        <Medal badgeId={badgeId} size="sm" />
      </Animated.View>
      <View style={{ minWidth: 0, flexShrink: 1 }}>
        <PixelText size={11} tone="gold-500" style={{ letterSpacing: 11 * 0.05, textTransform: 'uppercase' }}>{`${t('earned')} · ${t(`rarity.${rarity}`)}`}</PixelText>
        <PixelText size={15} lineHeight={15 * TIGHT}>{text.badges[badgeId]?.name ?? badgeId}</PixelText>
      </View>
    </View>
  );
}

/** The other milestones of the same step, under the one that leads, and the badges: what the moment carries besides its lead. */
export function Carried({ others, badges }: { others: readonly Reached[]; badges: readonly string[] }) {
  const t = useT('milestone');
  const said = useSaid();
  if (others.length === 0 && badges.length === 0) return null;
  return (
    <View style={{ gap: 8, alignSelf: 'stretch' }}>
      {others.length > 0 ? (
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
      ) : null}
      {badges.map((id) => (
        <BadgeInside key={id} badgeId={id} />
      ))}
    </View>
  );
}

/** The milestone each moment that has the screen is. */
const OF_MOMENT = { escape: 'escaped', million: 'worth1m' } as const;

/**
 * What a moment that already has the screen (the first million, the way out) carries of the step's milestones: the record, and the rest of the
 * step, in the moment that leads only. A milestone with a moment of its own (the first million in the step of the way out) is told by its own.
 */
export function MomentMilestones({ kind }: { kind: keyof typeof OF_MOMENT }) {
  const plan = useCelebration();
  const said = useSaid();
  if (plan.where !== 'moment' || plan.lead.id !== OF_MOMENT[kind]) return null;
  const { note } = said(plan.lead);
  const others = plan.others.filter((each) => each.id !== 'escaped' && each.id !== 'worth1m');
  return (
    <View style={{ gap: 8 }}>
      {note !== null ? (
        <PixelText size={13} tone="gold-500" style={{ textAlign: 'center' }}>
          {note}
        </PixelText>
      ) : null}
      <Carried others={others} badges={plan.badges} />
    </View>
  );
}

/** The size a milestone's scene is drawn at when its art is missing (a card's). */
const SCENE_FALLBACK = { w: 288, h: 120 };

/** The scene of a milestone across the top of its big moment, uncovered from the left as the sheet comes up, as a moment's picture is. */
function Scene({ id }: { id: string }) {
  const reveal = useReveal();
  const box = spriteBox(id, 1, 1, SCENE_FALLBACK);
  return (
    <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: box.w, height: box.h }}>
      <Animated.View style={[{ height: box.h, overflow: 'hidden' }, reveal]}>
        <Sprite id={id} fallback={SCENE_FALLBACK} />
      </Animated.View>
    </View>
  );
}

/** Fireworks bursting and coins turning either side of the portrait, sparks thrown from it: all decoration, none of it where motion is left out. */
function Fanfare({ lifeId, age }: { lifeId: string; age: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ alignItems: 'center', gap: 4 }}>
        <Loop name="burst" ms={180} />
        <Loop name="coin" ms={90} />
      </View>
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Hopping lifeId={lifeId} age={age} size={96} />
        <View aria-hidden style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0 }}>
          <Sparks colours={['gold-500', 'gold-200', 'cream', 'teal-300']} count={16} reach={64} delayMs={300} size={4} />
        </View>
      </View>
      <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ alignItems: 'center', gap: 4 }}>
        <Loop name="coin" ms={110} />
        <Loop name="burst" ms={210} />
      </View>
    </View>
  );
}

/** The whole screen for a milestone: its scene across the top, the portrait hopping in the middle of the fireworks, the headline, the record, the rest of the step, and on. */
export function MilestoneBig({ plan, lifeId, onDone }: { plan: Carrying; lifeId: string; onDone(): void }) {
  const t = useT('milestone');
  const said = useSaid();
  const { locale } = useSettings();
  const { name, headline, line, note } = said(plan.lead);
  const url = new URL(hrefOf('', { locale }), SITE_URL).href;
  const send = async () => {
    try {
      await shareLink(name, t('shareText', { headline }), url);
    } catch {
      // The share sheet would not open: the moment is still on screen.
    }
  };
  return (
    <View {...{ dataSet: { milestone: plan.lead.id } }} style={{ alignItems: 'center', gap: 12 }}>
      <PixelText size={13} tone="gold-500" style={{ letterSpacing: 13 * 0.14, textTransform: 'uppercase', textAlign: 'center' }}>
        {note ?? t('kicker')}
      </PixelText>
      <Scene id={LIFE_MILESTONE_ART[plan.lead.id]} />
      <Fanfare lifeId={lifeId} age={plan.lead.age} />
      <PixelText size={20} lineHeight={20 * TIGHT} style={{ textAlign: 'center' }}>
        {headline}
      </PixelText>
      <ReadText size={15} lineHeight={15 * SNUG} style={{ textAlign: 'center' }}>
        {line}
      </ReadText>
      <Carried others={plan.others} badges={plan.badges} />
      <Button variant="primary" wide onPress={onDone}>
        {t('go')}
      </Button>
      {canShareLink() ? (
        <Button variant="secondary" wide onPress={() => void send()}>
          {t('share')}
        </Button>
      ) : null}
    </View>
  );
}

/** A milestone as a banner that rises with the step's result, the step's badges inside it: it stops nothing. */
export function MilestoneBanner({ plan, lifeId }: { plan: Carrying; lifeId: string }) {
  const t = useT('milestone');
  const badges = useT('badges');
  const { text } = useWords();
  const said = useSaid();
  const rise = useRise();
  const { name, line, note } = said(plan.lead);
  useAnnounced(
    [t('kicker'), name, t('at', { age: plan.lead.age }), note ?? '', line, ...plan.others.map((each) => said(each).name), ...plan.badges.map((id) => `${badges('earned')}: ${text.badges[id]?.name ?? id}`)]
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
          <Carried others={plan.others} badges={plan.badges} />
        </Framed>
      </Animated.View>
    </View>
  );
}
