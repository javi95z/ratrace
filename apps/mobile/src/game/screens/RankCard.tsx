import { progressOf, promoted, RANKS } from '@ratrace/content';
import type { RankId } from '@ratrace/content';
import { useEffect } from 'react';
import { View } from 'react-native';
import { Framed } from '../../ui/Frame';
import { webLine } from '../../ui/fonts';
import { GOLD } from '../../ui/frames';
import { Bar, Panel, SrOnly } from '../../ui/kit';
import { Sprite } from '../../ui/Sprite';
import { Rising } from '../../ui/Rising';
import { PixelText, ReadText } from '../../ui/text';
import { COLORS } from '../../ui/theme';
import { useProfile, useSettings, useSound, useT } from '../context';

/*
 * The web's RankCard.tsx, on the phone: the card of the rat's rank on the player's own page (`RankCard`, PlayerProfile's), and what the end of a
 * life says of it (`RankGain`).
 */

/** The emblem of a rank. */
export const rankArt = (rank: RankId): string => `rank.${rank}`;

/** The name of a rank, in the language of the game. */
export function useRankName(): (rank: RankId) => string {
  const t = useT('rank');
  return (rank) => t(`names.${rank}`);
}

/** The player's rat rank and how far they are to the next: a title earned by playing, which gives nothing in the game. */
export function RankCard() {
  const t = useT('rank');
  const name = useRankName();
  const profile = useProfile();
  const progress = progressOf(profile.rank.points);
  const { locale } = useSettings();
  /** The rank's name (pixel 17) and its step (reading 12) on one baseline, as the web's `items-baseline` row sets them. */
  const line = webLine([['pixel', 17, 17 * 1.1], ['read', 12, 12 * 1.45]], locale);
  return (
    <Panel label={t('title')}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {/* The rank's emblem: grander, the higher the rat has climbed. */}
        <Sprite id={rankArt(progress.rank)} fallback={{ w: 64, h: 64 }} size={{ w: 48, h: 48 }} />
        {/* The web's `items-baseline` row, laid from the browser's baselines (a native row's baselines are not where the kit draws its glyphs). */}
        <View style={{ flex: 1, minWidth: 0, height: line.height, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <View style={{ flexShrink: 1, marginTop: line.tops[0] }}>
            <SrOnly>{`${t('title')}: `}</SrOnly>
            <PixelText size={17} tone="gold-500">{name(progress.rank)}</PixelText>
          </View>
          <ReadText size={12} tone="ink-300" style={{ marginTop: line.tops[1] }}>{t('step', { n: RANKS.indexOf(progress.rank) + 1, of: RANKS.length })}</ReadText>
        </View>
      </View>
      <View style={{ marginTop: 8 }}>
        <Bar value={progress.share} max={1} label={t('progress')} tone="teal" />
      </View>
      <ReadText size={12} tone="ink-300" style={{ marginTop: 4 }}>{progress.next === null ? t('top', { points: progress.points }) : t('toNext', { points: progress.toNext, rank: name(progress.next) })}</ReadText>
    </Panel>
  );
}

/**
 * On the end screen of a life: the points it gave and how many are left to the next rank, and a
 * card when the life made the player a higher rank, with its sound (silent where sound is off). Where motion is left out the card stands at once.
 */
export function RankGain({ gameId }: { gameId: string }) {
  const t = useT('rank');
  const name = useRankName();
  const profile = useProfile();
  const play = useSound();
  const gained = Object.hasOwn(profile.rank.lives, gameId) ? profile.rank.lives[gameId] : null;
  const after = progressOf(profile.rank.points);
  const rose = gained !== null && promoted(profile.rank.points - gained, profile.rank.points);
  useEffect(() => {
    // The sound board is silent where sound is off.
    if (rose) play('promote');
    // Once when the card appears, not each time the profile is read again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rose]);
  if (gained === null) return null;
  return (
    <View style={{ gap: 8 }}>
      {rose ? (
        <Rising>
          <View accessible role="status" {...{ dataSet: { promotion: after.rank } }}>
            <Framed kind="frame" tone={GOLD} style={{ backgroundColor: COLORS['gold-500'], paddingHorizontal: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <Sprite id={rankArt(after.rank)} fallback={{ w: 64, h: 64 }} />
              <PixelText size={18} tone="ink-900" style={{ flexShrink: 1, textAlign: 'center' }}>{t('promoted', { rank: name(after.rank) })}</PixelText>
            </Framed>
          </View>
        </Rising>
      ) : null}
      <View accessible role="status">
        <Framed kind="frame" style={{ backgroundColor: COLORS['night-700'], paddingHorizontal: 12, paddingVertical: 8 }}>
          <ReadText size={14} tone="ink-200" style={{ textAlign: 'center' }}>
            {`${t('gained', { points: gained })} · ${after.next === null ? name(after.rank) : t('toNextShort', { points: after.toNext, rank: name(after.next) })}`}
          </ReadText>
        </Framed>
      </View>
    </View>
  );
}
