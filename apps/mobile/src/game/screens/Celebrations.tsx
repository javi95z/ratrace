import { portraitArt, rarityOf } from '@ratrace/content';
import type { BadgeRarity } from '@ratrace/content';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useShallow } from 'zustand/react/shallow';
import { useMedal, useRise } from '../../ui/animations';
import { Framed } from '../../ui/Frame';
import { GOLD } from '../../ui/frames';
import { Glow } from '../../ui/Glow';
import { Bare, Button } from '../../ui/kit';
import { Sheet } from '../../ui/overlay';
import { Sparks } from '../../ui/Sparks';
import { Sprite } from '../../ui/Sprite';
import { PixelText, ReadText, SNUG, TIGHT } from '../../ui/text';
import { COLORS, type ColorToken } from '../../ui/theme';
import { useGame, useT, useWords } from '../context';
import { Medal } from './Medal';
import { RARITY_GLOW, RARITY_TONE } from './rarityStyle';

/** The sparks of a badge won are the colours of its rim: bronze, silver, gold, and the gem's green and cream. */
const SPARKS: Record<BadgeRarity, readonly ColorToken[]> = {
  common: ['gold-700', 'gold-200'],
  uncommon: ['cream', 'ink-200'],
  rare: ['gold-500', 'gold-200', 'cream'],
  legendary: ['teal-300', 'cream', 'gold-500'],
};

/** A badge spinning in from nothing, in the rim of its rarity, throwing sparks of its colours; the rarer, the more. */
function Spinning({ badgeId, size, sparks }: { badgeId: string; size: 'md' | 'sm'; sparks: { colours: readonly ColorToken[]; count: number; reach: number } }) {
  // The web turns it in a `perspective: 200px`; the phone's turn is flat (motion.ts: `rotateY`), and ends square on, where the shot sees it.
  const medal = useMedal();
  return (
    <View style={{ flexShrink: 0 }}>
      <Animated.View style={medal}>
        <Medal badgeId={badgeId} size={size} />
      </Animated.View>
      <Sparks colours={sparks.colours} count={sparks.count} reach={sparks.reach} delayMs={500} />
    </View>
  );
}

/** The legendary one, with the whole screen to itself until the player moves on. */
function Legendary({ badgeId, onDone }: { badgeId: string; onDone(): void }) {
  const t = useT('badges');
  const { text } = useWords();
  return (
    <View {...{ dataSet: { legendary: badgeId } }} style={{ alignItems: 'center', gap: 12 }}>
      <PixelText size={13} tone="teal-300" style={{ letterSpacing: 13 * 0.14, textTransform: 'uppercase', textAlign: 'center' }}>{t('legendaryKicker')}</PixelText>
      <Spinning badgeId={badgeId} size="md" sparks={{ colours: SPARKS.legendary, count: 18, reach: 52 }} />
      <ReadText size={15} lineHeight={15 * SNUG} style={{ textAlign: 'center' }}>{text.badges[badgeId]?.how ?? ''}</ReadText>
      <Button variant="primary" wide onPress={onDone}>
        {t('legendaryGo')}
      </Button>
    </View>
  );
}

/**
 * What a card that rises with a step says to a screen reader, as it comes up. TalkBack hears the card's own live region. VoiceOver has no live
 * regions: on iOS it is announced, once, a moment after the card is on screen, and queued, so that what the stage itself says as it opens
 * (Play: "What happened") is said first and this after it.
 */
function useAnnounced(said: string) {
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const later = setTimeout(() => AccessibilityInfo.announceForAccessibilityWithOptions?.(said, { queue: true }), 0);
    return () => clearTimeout(later);
    // Once, as the card comes up, in the words it came up with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** A badge earned, as a card that rises with the step's result. */
function Earned({ badgeId }: { badgeId: string }) {
  const t = useT('badges');
  const { text } = useWords();
  const rise = useRise();
  const rarity = rarityOf(badgeId);
  const tone = RARITY_TONE[rarity];
  const name = text.badges[badgeId]?.name ?? badgeId;
  useAnnounced([t('earned'), name, t(`rarity.${rarity}`), text.badges[badgeId]?.how ?? ''].filter(Boolean).join('. '));
  return (
    <View accessible role="status" accessibilityLiveRegion="polite">
      <Animated.View style={rise}>
        {/* The web's `frame frame-gold … [--glow:…]`: the glow of its rarity, under the frame's strips (rarityStyle.ts). */}
        <Glow shadow={RARITY_GLOW[rarity]} />
        <Framed kind="frame" tone={GOLD} style={{ backgroundColor: COLORS['night-700'], padding: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Spinning badgeId={badgeId} size="sm" sparks={{ colours: SPARKS[rarity], count: rarity === 'legendary' ? 14 : rarity === 'rare' ? 10 : 8, reach: rarity === 'common' ? 26 : 36 }} />
          <View style={{ minWidth: 0, flexShrink: 1 }}>
            <PixelText size={12} tone="gold-500" style={{ letterSpacing: 12 * 0.05, textTransform: 'uppercase' }}>{t('earned')}</PixelText>
            <PixelText size={18}>{name}</PixelText>
            <PixelText size={11} style={{ letterSpacing: 11 * 0.1, textTransform: 'uppercase', ...(tone ? { color: tone } : null) }}>{t(`rarity.${rarity}`)}</PixelText>
            <ReadText size={13} tone="ink-200" lineHeight={13 * SNUG}>{text.badges[badgeId]?.how ?? ''}</ReadText>
          </View>
        </Framed>
      </Animated.View>
    </View>
  );
}

/** Lives unlocked together are told together: one card, each life with its face and what it is good at. */
function Unlocked({ lives }: { lives: readonly string[] }) {
  const t = useT('badges');
  const { text } = useWords();
  const rise = useRise();
  const title = t(lives.length === 1 ? 'unlocked' : 'unlockedMany', { count: lives.length });
  useAnnounced([title, ...lives.map((id) => `${text.lives[id]?.name ?? id}: ${text.lives[id]?.perk ?? ''}`)].join('. '));
  return (
    // Nothing inside can be pressed, so it reads as one thing, as the badge's card does.
    <View accessible role="status" accessibilityLiveRegion="polite">
      <Animated.View style={rise}>
        <Framed kind="frame" tone={GOLD} style={{ backgroundColor: COLORS['gold-500'], padding: 8, gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Sprite id="icon.star" />
            <PixelText size={12} tone="ink-900" style={{ flexShrink: 1, letterSpacing: 12 * 0.05, textTransform: 'uppercase' }}>
              {title}
            </PixelText>
          </View>
          <View style={{ gap: 8 }}>
            {lives.map((id) => (
              <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Bare style={{ width: 48, height: 48, backgroundColor: COLORS['gold-200'] }}>
                  <Sprite id={portraitArt(id, 22)} fallback={{ w: 64, h: 64 }} size={{ w: 48, h: 48 }} />
                </Bare>
                <View style={{ minWidth: 0, flexShrink: 1 }}>
                  <PixelText size={18} tone="ink-900" lineHeight={18 * TIGHT}>{text.lives[id]?.name ?? id}</PixelText>
                  <ReadText size={13} tone="ink-900" lineHeight={13 * SNUG}>{text.lives[id]?.perk ?? ''}</ReadText>
                </View>
              </View>
            ))}
          </View>
        </Framed>
      </Animated.View>
    </View>
  );
}

/**
 * What the step on screen earned for the first time ever: badges, and lives unlocked.
 * It says what the session reported; whether a badge was earned is never judged here.
 * It reads the round only for those two lists, and is drawn again only when what is in them changes. `seen` is what a scene shows as taken in
 * already: legendary badges whose sheet the player has moved on from (the web's scene presses its button).
 */
export function Celebrations({ seen: taken = [] }: { seen?: readonly string[] }) {
  const { text } = useWords();
  const common = useT('common');
  const earned = useGame(useShallow((s) => s.earned));
  const unlocked = useGame(useShallow((s) => s.unlocked));
  // Legendary badges already taken in: each has the whole screen once, until the player moves on.
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set(taken));
  const grand = earned.find((id) => rarityOf(id) === 'legendary' && !seen.has(id));
  // The sheet keeps saying what it said while it leaves.
  const [held, setHeld] = useState(grand);
  if (grand !== undefined && grand !== held) setHeld(grand);
  if (earned.length === 0 && unlocked.length === 0) return null;
  const dismiss = () => grand && setSeen((now) => new Set(now).add(grand));
  const shown = grand ?? held;

  return (
    <>
      {shown !== undefined ? (
        <Sheet open={grand !== undefined} onClose={dismiss} title={text.badges[shown]?.name ?? shown} closeLabel={common('close')} tone="gold">
          <Legendary badgeId={shown} onDone={dismiss} />
        </Sheet>
      ) : null}
      {earned.map((id) => (
        <Earned key={id} badgeId={id} />
      ))}
      {unlocked.length > 0 ? <Unlocked lives={unlocked} /> : null}
    </>
  );
}
