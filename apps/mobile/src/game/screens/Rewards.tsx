import { LIFE_MILESTONE_ART, momentArt, rarityOf } from '@ratrace/content';
import type { BadgeRarity } from '@ratrace/content';
import { characterName } from '@ratrace/core/game/characters';
import type { Reached } from '@ratrace/core/game/lifeMilestones';
import type { Moment } from '@ratrace/core/game/moments';
import { useEffect, useReducer, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, View, type HostInstance } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useMedal, useReveal } from '../../ui/animations';
import { Button } from '../../ui/kit';
import { Sheet } from '../../ui/overlay';
import { Sparks } from '../../ui/Sparks';
import { Sprite } from '../../ui/Sprite';
import { spriteBox } from '../../ui/sprites';
import { PixelText, ReadText, SNUG } from '../../ui/text';
import { COLORS, type ColorToken } from '../../ui/theme';
import { useGame, useSettings, useStill, useT, useWords } from '../context';
import { hrefOf } from '../pages';
import { canShareLink, shareLink } from '../sharing';
import { SITE_URL } from '../site';
import { acceptReward, rewardAccepted } from '../rewardsAccepted';
import { LifeDetails } from './LifeSummary';
import { Loop } from './Loop';
import { Confetti, MomentBody } from './Moments';
import { Medal } from './Medal';
import { RARITY_TONE } from './rarityStyle';

/*
 * A round's big moments in one standard sheet over its summary, one step at a time: a milestone of the life that has the whole screen, and what
 * the round or a life's end gives the player for the first time ever, a badge or a life to live, each with its Accept (a milestone's Onwards). Several at once are shown in turn in the same sheet ("1 of 3"); closing it any other way
 * (the backdrop, its Close, Back, Escape) accepts them all. A reward is shown once: what has been accepted is kept for as long as the app runs, by
 * life, so a summary drawn again (a page left and come back to, a tablet turned) does not show it again.
 */

/** The way out and the first million: moments of a life the round stops for. */
export type GoodMoment = Extract<Moment, { kind: 'escape' | 'million' }>;

export type Reward =
  | { kind: 'badge'; id: string }
  | { kind: 'life'; id: string }
  | { kind: 'milestone'; id: string; reached: Reached }
  /** `lead`: the milestone it is, where the step reached it (the first time ever, a record). */
  | { kind: 'moment'; id: string; moment: GoodMoment; lead: Reached | null };

const keyOf = (gameId: string | null, reward: Reward) => `${gameId ?? ''}:${reward.kind}:${reward.id}`;

/** The sparks of a badge are the colours of its rim: bronze, silver, gold, and the gem's green and cream. The rarer, the more. */
const SPARKS: Record<BadgeRarity, { colours: readonly ColorToken[]; count: number; reach: number }> = {
  common: { colours: ['gold-700', 'gold-200'], count: 8, reach: 40 },
  uncommon: { colours: ['cream', 'ink-200'], count: 10, reach: 44 },
  rare: { colours: ['gold-500', 'gold-200', 'cream'], count: 12, reach: 48 },
  legendary: { colours: ['teal-300', 'cream', 'gold-500'], count: 18, reach: 52 },
};

/** A life unlocked's face, larger than the life's sheet draws it (96). */
const LIFE_PORTRAIT = 120;

const kicker = { letterSpacing: 13 * 0.14, textTransform: 'uppercase', textAlign: 'center' } as const;

/** A badge (its name the sheet's title): its rarity as its heading, in the colour of its rim; its medal spinning in, large, throwing sparks of its colours; and how it was earned. */
function BadgeReward({ badgeId }: { badgeId: string }) {
  const t = useT('badges');
  const { text } = useWords();
  const medal = useMedal();
  const rarity = rarityOf(badgeId);
  const legendary = rarity === 'legendary';
  // A legendary one's heading is gold, the rarest of its moments; the others say theirs in the colour of their rim.
  const tone = legendary ? COLORS['gold-500'] : RARITY_TONE[rarity];
  return (
    <View {...{ dataSet: { reward: `badge.${badgeId}` } }} style={{ alignItems: 'center', gap: 8 }}>
      <PixelText size={13} tone="ink-200" style={{ ...kicker, ...(tone ? { color: tone } : null) }}>
        {t('kicker', { rarity })}
      </PixelText>
      <View style={{ marginVertical: legendary ? (BURST - 96) / 2 : 4, alignItems: 'center', justifyContent: 'center' }}>
        {legendary ? <Sunburst /> : null}
        <Animated.View style={medal}>
          <Medal badgeId={badgeId} />
        </Animated.View>
        <Sparks {...SPARKS[rarity]} delayMs={500} />
        {legendary ? <Fireworks /> : null}
      </View>
      <ReadText size={15} lineHeight={15 * SNUG} tone="ink-200" style={{ textAlign: 'center' }}>{text.badges[badgeId]?.how ?? ''}</ReadText>
    </View>
  );
}

/** How wide a legendary medal's rays reach, and how many there are. */
const BURST = 136;
const RAYS = 12;
/** One turn of the rays, slow: a glow that lives, not a spinner. */
const TURN_MS = 24_000;

/**
 * Gold rays round a legendary medal, slowly turning: a ring of thin bars of gold, faint, on the phone's animation thread. Where motion is left out
 * they stand still, a glow.
 */
function Sunburst() {
  const still = useStill();
  const turn = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    turn.value = 0;
    turn.value = withRepeat(withTiming(360, { duration: TURN_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(turn);
  }, [still, turn]);
  const turning = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  return (
    <Animated.View
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      {...{ dataSet: { rays: still ? 'still' : 'turning' } }}
      pointerEvents="none"
      style={[{ position: 'absolute', width: BURST, height: BURST, alignItems: 'center', justifyContent: 'center' }, still ? null : turning]}
    >
      {Array.from({ length: RAYS }, (_, i) => (
        <View
          key={i}
          style={{ position: 'absolute', width: 6, height: BURST, backgroundColor: COLORS[i % 2 === 0 ? 'gold-500' : 'gold-700'], opacity: 0.45, transform: [{ rotate: `${(180 / RAYS) * i}deg` }] }}
        />
      ))}
    </Animated.View>
  );
}

/** The fireworks and the cheer over a legendary medal's top corners, as over a milestone's scene: none where motion is left out. */
function Fireworks() {
  const still = useStill();
  if (still) return null;
  return (
    <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={{ position: 'absolute', left: -48, right: -48, top: -12, flexDirection: 'row', justifyContent: 'space-between' }}>
      <Loop name="burst" ms={180} />
      <Loop name="cheer" ms={180} />
    </View>
  );
}

/** A life to live: its face on its city's sky, and what the life's own sheet says of it, the city, the job, the cash and how hard it is (LifeSummary.tsx). */
function LifeReward({ lifeId }: { lifeId: string }) {
  const t = useT('badges');
  return (
    <View {...{ dataSet: { reward: `life.${lifeId}` } }} style={{ gap: 12 }}>
      <PixelText size={13} tone="gold-500" style={kicker}>{t('unlocked')}</PixelText>
      <LifeDetails id={lifeId} px={LIFE_PORTRAIT} notes={false} />
    </View>
  );
}

/** The size a milestone's scene is drawn at when its art is missing. */
const SCENE_FALLBACK = { w: 288, h: 120 };

/** What a milestone says: its headline at its age (the sheet's title, said once), the record or first time it is, and its line. */
function useMilestoneWords() {
  const t = useT('milestone');
  return (each: Reached) => {
    const name = t(`names.${each.id}`);
    // A record is a younger age than any before; the first time ever has nothing to beat.
    const note = each.best === null ? t('first') : each.age < each.best ? t('record', { age: each.best }) : null;
    return { name, headline: t('headline', { name, age: each.age }), line: t(`lines.${each.id}`), note, kicker: note ?? t('kicker') };
  };
}

/** A scene edge to edge in the sheet's width, uncovered from the left as it comes up, the cheer and the fireworks over its top corners. */
function WideScene({ art }: { art: string }) {
  const reveal = useReveal();
  const box = spriteBox(art, 1, 1, SCENE_FALLBACK);
  const [width, setWidth] = useState(0);
  const height = width === 0 ? 0 : Math.round((width * box.h) / box.w);
  return (
    <View
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(event) => setWidth(Math.floor(event.nativeEvent.layout.width))}
      style={{ alignSelf: 'stretch', height }}
    >
      {width > 0 ? (
        <Animated.View style={[{ height, overflow: 'hidden' }, reveal]}>
          <Sprite id={art} fallback={SCENE_FALLBACK} size={{ w: width, h: height }} />
        </Animated.View>
      ) : null}
      {/* Decoration, none of it where motion is left out. */}
      <View style={{ position: 'absolute', left: 4, top: 4 }}>
        <Loop name="burst" ms={180} />
      </View>
      <View style={{ position: 'absolute', right: 4, top: 4 }}>
        <Loop name="cheer" ms={180} />
      </View>
    </View>
  );
}

/** A milestone: what it is (the first time ever, a record) where a badge says its rarity, its scene, and its line. */
function MilestoneReward({ reached }: { reached: Reached }) {
  const words = useMilestoneWords()(reached);
  return (
    <View {...{ dataSet: { reward: `milestone.${reached.id}` } }} style={{ alignItems: 'center', gap: 12 }}>
      <PixelText size={13} tone="gold-500" style={kicker}>{words.kicker}</PixelText>
      <WideScene art={LIFE_MILESTONE_ART[reached.id]} />
      <ReadText size={15} lineHeight={15 * SNUG} style={{ textAlign: 'center' }}>{words.line}</ReadText>
    </View>
  );
}

/**
 * The way out, or the first million: what it is (the first time ever, a record, or the moment's own words), its scene, and what it says in the
 * figures the game gave (the passive income against the life's costs; the net worth), with its note. Gold falls over it.
 */
function MomentReward({ moment, lead }: { moment: GoodMoment; lead: Reached | null }) {
  const t = useT('moments');
  const view = useGame((s) => s.view);
  const words = useMilestoneWords();
  if (!view) return null;
  return (
    <View {...{ dataSet: { reward: `moment.${moment.kind}` } }} style={{ gap: 12 }}>
      <PixelText size={13} tone="gold-500" style={kicker}>{(lead ? words(lead).note : null) ?? t(`${moment.kind}.kicker`)}</PixelText>
      <WideScene art={momentArt[moment.kind]} />
      <MomentBody moment={moment} view={view} />
      <Confetti />
    </View>
  );
}

/** What a reward is called: the sheet's title, which a screen reader hears as the dialog's name. */
function useTitle() {
  const { text } = useWords();
  const { locale } = useSettings();
  const milestone = useMilestoneWords();
  const moments = useT('moments');
  return (reward: Reward) =>
    reward.kind === 'moment'
      ? moments(`${reward.moment.kind}.title`)
      : reward.kind === 'milestone'
      ? milestone(reward.reached).headline
      : reward.kind === 'badge'
        ? (text.badges[reward.id]?.name ?? reward.id)
        : [text.lives[reward.id]?.name ?? reward.id, characterName(reward.id, locale)].filter(Boolean).join(' · ');
}

/** What a reward says to a screen reader as it comes on screen in the sheet: its kicker, its name and what it is. */
function useSaid() {
  const t = useT('badges');
  const { text } = useWords();
  const title = useTitle();
  const milestone = useMilestoneWords();
  const moments = useT('moments');
  return (reward: Reward) =>
    reward.kind === 'moment'
      ? [(reward.lead ? milestone(reward.lead).note : null) ?? moments(`${reward.moment.kind}.kicker`), title(reward)]
      : reward.kind === 'milestone'
      ? [milestone(reward.reached).kicker, title(reward), milestone(reward.reached).line]
      : reward.kind === 'badge'
        ? [t('kicker', { rarity: rarityOf(reward.id) }), title(reward), text.badges[reward.id]?.how ?? '']
        : [t('unlocked'), title(reward)];
}

/**
 * The rewards of a round or a life's end, in a sheet over its summary, one at a time. `waiting`: not yet (a milestone has the screen first).
 * `taken`: rewards a scene shows as accepted already. `onTry`: where a life can begin at once (the end of a life), a life's "Try it now" beside its
 * Accept, which closes the sheet and then begins it.
 */
export function RewardSheet({
  rewards,
  gameId,
  waiting = false,
  taken = [],
  onTry,
  onOpen,
}: {
  rewards: readonly Reward[];
  gameId: string | null;
  waiting?: boolean;
  taken?: readonly string[];
  onTry?: (lifeId: string) => void;
  /** Called once as the sheet first opens. */
  onOpen?: () => void;
}) {
  const t = useT('badges');
  const end = useT('end');
  const common = useT('common');
  const onwards = useT('milestone');
  const moments = useT('moments');
  const { locale } = useSettings();
  const title = useTitle();
  const said = useSaid();
  const milestoneWords = useMilestoneWords();
  const [, accept] = useReducer((n: number) => n + 1, 0);
  // Which rewards this sheet shows: those not accepted already when it first saw them. One accepted stays among them, so that "1 of 3" counts
  // what came, and the sheet closes as a sheet closes rather than vanishing.
  const mine = useRef(new Map<string, boolean>());
  for (const reward of rewards) {
    const key = keyOf(gameId, reward);
    if (!mine.current.has(key)) mine.current.set(key, !rewardAccepted(key) && !taken.includes(reward.id));
  }
  const shown = rewards.filter((reward) => mine.current.get(keyOf(gameId, reward)) === true);
  const current = shown.find((reward) => !rewardAccepted(keyOf(gameId, reward)));
  // The sheet keeps saying what it said while it leaves.
  const [held, setHeld] = useState(current);
  if (current !== undefined && (held === undefined || keyOf(gameId, current) !== keyOf(gameId, held))) setHeld(current);
  const open = current !== undefined && !waiting;

  const opened = useRef(false);
  useEffect(() => {
    if (!open || opened.current) return;
    opened.current = true;
    onOpen?.();
  }, [open, onOpen]);

  // VoiceOver hears the sheet's title as it opens; each reward after the first, which comes into the same sheet, is told as it comes.
  const step = current === undefined ? -1 : shown.indexOf(current);
  useEffect(() => {
    if (!open || step <= 0 || current === undefined || Platform.OS !== 'ios') return;
    AccessibilityInfo.announceForAccessibility(said(current).filter(Boolean).join('. '));
    // Once a reward, as it comes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, open]);

  const acceptButton = useRef<HostInstance>(null);
  if (held === undefined) return null;
  const showing = current ?? held;
  const at = shown.findIndex((reward) => keyOf(gameId, reward) === keyOf(gameId, showing));
  const acceptOne = () => {
    if (current === undefined) return;
    acceptReward(keyOf(gameId, current));
    accept();
  };
  const acceptAll = () => {
    for (const reward of shown) acceptReward(keyOf(gameId, reward));
    accept();
  };
  const tryIt = onTry && showing.kind === 'life' ? onTry : null;
  // A milestone is shared from its step, with its headline, as it always was.
  const shared = showing.kind === 'milestone' ? showing.reached : showing.kind === 'moment' ? showing.lead : null;
  const share = shared !== null && canShareLink();
  const send = async () => {
    if (shared === null) return;
    const { name, headline } = milestoneWords(shared);
    try {
      await shareLink(name, onwards('shareText', { headline }), new URL(hrefOf('', { locale }), SITE_URL).href);
    } catch {
      // The share sheet would not open: the moment is still on screen.
    }
  };

  return (
    <Sheet open={open} onClose={acceptAll} title={title(showing)} closeLabel={common('close')} tone="gold" initialFocus={acceptButton}>
      <View style={{ gap: 16 }}>
        {shown.length > 1 ? (
          <PixelText size={12} tone="ink-300" style={{ textAlign: 'center' }}>{t('step', { n: at + 1, total: shown.length })}</PixelText>
        ) : null}
        {/* A reward after the first comes into the same sheet: told by TalkBack and the web's readers as it comes. */}
        <View key={keyOf(gameId, showing)} accessibilityLiveRegion="polite" aria-live="polite">
          {showing.kind === 'moment' ? <MomentReward moment={showing.moment} lead={showing.lead} /> : showing.kind === 'milestone' ? <MilestoneReward reached={showing.reached} /> : showing.kind === 'badge' ? <BadgeReward badgeId={showing.id} /> : <LifeReward lifeId={showing.id} />}
        </View>
        <View style={{ gap: 8 }}>
          <Button ref={acceptButton} variant="primary" wide onPress={acceptOne}>
            {showing.kind === 'moment' ? moments(`${showing.moment.kind}.go`) : showing.kind === 'milestone' ? onwards('go') : t('accept')}
          </Button>
          {share ? (
            <Button variant="secondary" wide onPress={() => void send()}>
              {onwards('share')}
            </Button>
          ) : null}
          {tryIt ? (
            <Button
              variant="secondary"
              wide
              onPress={() => {
                const lifeId = showing.id;
                acceptAll();
                tryIt(lifeId);
              }}
            >
              {end('tryNow')}
            </Button>
          ) : null}
        </View>
      </View>
    </Sheet>
  );
}
