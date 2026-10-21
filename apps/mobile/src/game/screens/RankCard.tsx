import { progressOf, promoted } from '@ratrace/content';
import type { RankId } from '@ratrace/content';
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRise } from '../../ui/animations';
import { Framed } from '../../ui/Frame';
import { GOLD } from '../../ui/frames';
import { Sprite } from '../../ui/Sprite';
import { PixelText, ReadText } from '../../ui/text';
import { COLORS } from '../../ui/theme';
import { useProfile, useSound, useT } from '../context';

/*
 * The web's RankCard.tsx, on the phone: what the end of a life says of the rat's rank (`RankGain`). The card of the rank itself (`RankCard`) is the
 * player's page's (PlayerProfile), which the phone does not have yet.
 */

/** The emblem of a rank. */
export const rankArt = (rank: RankId): string => `rank.${rank}`;

/** The name of a rank, in the language of the game. */
export function useRankName(): (rank: RankId) => string {
  const t = useT('rank');
  return (rank) => t(`names.${rank}`);
}

/** The web's `animate-rise`, on what it holds. */
function Rising({ children }: { children: ReactNode }) {
  const rise = useRise();
  return <Animated.View style={rise}>{children}</Animated.View>;
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
