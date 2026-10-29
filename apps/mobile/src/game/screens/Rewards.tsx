import { careerArt, cityIcon, lives, portraitArt, rarityOf } from '@ratrace/content';
import type { BadgeRarity } from '@ratrace/content';
import { characterName } from '@ratrace/core/game/characters';
import { useEffect, useReducer, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, View, type HostInstance } from 'react-native';
import Animated from 'react-native-reanimated';
import { useMedal } from '../../ui/animations';
import { Bare, Button } from '../../ui/kit';
import { Sheet } from '../../ui/overlay';
import { Sparks } from '../../ui/Sparks';
import { Sprite } from '../../ui/Sprite';
import { PixelText, ReadText, SNUG, TIGHT } from '../../ui/text';
import { COLORS, type ColorToken } from '../../ui/theme';
import { useSettings, useT, useWords } from '../context';
import { acceptReward, rewardAccepted } from '../rewardsAccepted';
import { Difficulty } from './LifeSummary';
import { Medal } from './Medal';
import { RARITY_TONE } from './rarityStyle';

/*
 * What a round or a life's end gives the player for the first time ever, a badge or a life to live, told in one standard moment: a sheet over the
 * summary, one reward at a time, each with its Accept. Several at once are shown in turn in the same sheet ("1 of 3"); closing it any other way
 * (the backdrop, its Close, Back, Escape) accepts them all. A reward is shown once: what has been accepted is kept for as long as the app runs, by
 * life, so a summary drawn again (a page left and come back to, a tablet turned) does not show it again.
 */

export type Reward = { kind: 'badge'; id: string } | { kind: 'life'; id: string };

const keyOf = (gameId: string | null, reward: Reward) => `${gameId ?? ''}:${reward.kind}:${reward.id}`;

/** The sparks of a badge are the colours of its rim: bronze, silver, gold, and the gem's green and cream. The rarer, the more. */
const SPARKS: Record<BadgeRarity, { colours: readonly ColorToken[]; count: number; reach: number }> = {
  common: { colours: ['gold-700', 'gold-200'], count: 8, reach: 40 },
  uncommon: { colours: ['cream', 'ink-200'], count: 10, reach: 44 },
  rare: { colours: ['gold-500', 'gold-200', 'cream'], count: 12, reach: 48 },
  legendary: { colours: ['teal-300', 'cream', 'gold-500'], count: 18, reach: 52 },
};

const kicker = { letterSpacing: 13 * 0.14, textTransform: 'uppercase', textAlign: 'center' } as const;

/** A badge (its name the sheet's title): its medal spinning in, large, throwing sparks of its colours, its rarity in the colour of its rim, and how it was earned. */
function BadgeReward({ badgeId }: { badgeId: string }) {
  const t = useT('badges');
  const { text } = useWords();
  const medal = useMedal();
  const rarity = rarityOf(badgeId);
  const tone = RARITY_TONE[rarity];
  return (
    <View {...{ dataSet: { reward: `badge.${badgeId}` } }} style={{ alignItems: 'center', gap: 8 }}>
      <PixelText size={13} tone={rarity === 'legendary' ? 'teal-300' : 'gold-500'} style={kicker}>
        {rarity === 'legendary' ? t('legendaryKicker') : t('earned')}
      </PixelText>
      <View style={{ marginVertical: 4 }}>
        <Animated.View style={medal}>
          <Medal badgeId={badgeId} />
        </Animated.View>
        <Sparks {...SPARKS[rarity]} delayMs={500} />
      </View>
      <PixelText size={12} style={{ letterSpacing: 12 * 0.1, textTransform: 'uppercase', ...(tone ? { color: tone } : null) }}>{t(`rarity.${rarity}`)}</PixelText>
      <ReadText size={15} lineHeight={15 * SNUG} tone="ink-200" style={{ textAlign: 'center' }}>{text.badges[badgeId]?.how ?? ''}</ReadText>
    </View>
  );
}

/** A life to live: who lives it, large, the job, where it starts, at what, and how hard it is, and what it is good at. */
function LifeReward({ lifeId }: { lifeId: string }) {
  const t = useT('badges');
  const { text } = useWords();
  const { locale } = useSettings();
  const life = lives.find((one) => one.id === lifeId);
  const job = text.lives[lifeId]?.name ?? lifeId;
  const name = characterName(lifeId, locale);
  const career = life?.start.life?.career?.id;
  return (
    <View {...{ dataSet: { reward: `life.${lifeId}` } }} style={{ alignItems: 'center', gap: 8 }}>
      <PixelText size={13} tone="gold-500" style={kicker}>{t('unlocked')}</PixelText>
      <View style={{ marginVertical: 4 }}>
        <Bare style={{ width: 96, height: 96, backgroundColor: COLORS['gold-200'] }}>
          <Sprite id={portraitArt(lifeId, 22)} fallback={{ w: 64, h: 64 }} size={{ w: 96, h: 96 }} />
        </Bare>
        <View aria-hidden style={{ position: 'absolute', left: 48, top: 48, width: 0, height: 0 }}>
          <Sparks colours={['gold-500', 'gold-200', 'cream']} count={12} reach={64} delayMs={300} />
        </View>
      </View>
      {/* Who lives it is the sheet's title; the job under the face, where a life has someone named. */}
      {name ? <PixelText size={17} lineHeight={17 * TIGHT} style={{ textAlign: 'center' }}>{job}</PixelText> : null}
      {life ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <Sprite id={cityIcon(life.start.cityId)} size={{ w: 16, h: 16 }} />
          {career ? <Sprite id={careerArt(career)} size={{ w: 16, h: 16 }} /> : null}
          <View style={{ marginLeft: 2 }}>
            <Difficulty lifeId={lifeId} />
          </View>
        </View>
      ) : null}
      <ReadText size={15} lineHeight={15 * SNUG} tone="ink-200" style={{ textAlign: 'center' }}>{text.lives[lifeId]?.perk ?? ''}</ReadText>
    </View>
  );
}

/** What a reward is called: the sheet's title, which a screen reader hears as the dialog's name. */
function useTitle() {
  const { text } = useWords();
  const { locale } = useSettings();
  return (reward: Reward) => (reward.kind === 'badge' ? (text.badges[reward.id]?.name ?? reward.id) : (characterName(reward.id, locale) ?? text.lives[reward.id]?.name ?? reward.id));
}

/** What a reward says to a screen reader as it comes on screen in the sheet: its kicker, its name and what it is. */
function useSaid() {
  const t = useT('badges');
  const { text } = useWords();
  const title = useTitle();
  return (reward: Reward) =>
    reward.kind === 'badge'
      ? [rarityOf(reward.id) === 'legendary' ? t('legendaryKicker') : t('earned'), title(reward), t(`rarity.${rarityOf(reward.id)}`), text.badges[reward.id]?.how ?? '']
      : [t('unlocked'), title(reward), text.lives[reward.id]?.name ?? '', text.lives[reward.id]?.perk ?? ''];
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
  const title = useTitle();
  const said = useSaid();
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

  return (
    <Sheet open={open} onClose={acceptAll} title={title(showing)} closeLabel={common('close')} tone="gold" initialFocus={acceptButton}>
      <View style={{ gap: 16 }}>
        {shown.length > 1 ? (
          <PixelText size={12} tone="ink-300" style={{ textAlign: 'center' }}>{t('step', { n: at + 1, total: shown.length })}</PixelText>
        ) : null}
        {/* A reward after the first comes into the same sheet: told by TalkBack and the web's readers as it comes. */}
        <View key={keyOf(gameId, showing)} accessibilityLiveRegion="polite" aria-live="polite">
          {showing.kind === 'badge' ? <BadgeReward badgeId={showing.id} /> : <LifeReward lifeId={showing.id} />}
        </View>
        <View style={{ gap: 8 }}>
          <Button ref={acceptButton} variant="primary" wide onPress={acceptOne}>
            {t('accept')}
          </Button>
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
