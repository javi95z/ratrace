import { cityIcon, lives } from '@ratrace/content';
import { characterName } from '@ratrace/core/game/characters';
import { difficultyOf } from '@ratrace/core/game/difficulty';
import { View } from 'react-native';
import { SrOnly } from '../../ui/kit';
import { Sprite } from '../../ui/Sprite';
import { PixelText, ReadText, SNUG, TIGHT } from '../../ui/text';
import { COLORS, type ColorToken } from '../../ui/theme';
import { useSettings, useT, useWords } from '../context';

const LEVELS = ['level1', 'level2', 'level3'] as const;

/** The word of each level on its colour: teal for the easy, gold for the middling, wine for the hard. */
const WORD: Record<1 | 2 | 3, { bg: ColorToken; fg: ColorToken }> = {
  1: { bg: 'teal-600', fg: 'cream' },
  2: { bg: 'gold-500', fg: 'ink-900' },
  3: { bg: 'wine-500', fg: 'cream' },
};

/**
 * How hard a life is: as dots, one to three filled of three, with its word for whoever does not see
 * them; or, where there is room, as the word itself.
 */
export function Difficulty({ lifeId, light = false, word = false }: { lifeId: string; light?: boolean; word?: boolean }) {
  const t = useT('newLife');
  const level = difficultyOf(lifeId);
  if (word) {
    const { bg, fg } = WORD[level];
    return (
      <View style={{ flexShrink: 0, paddingHorizontal: 6, backgroundColor: COLORS[bg] }}>
        <PixelText size={11} tone={fg} style={{ letterSpacing: 11 * 0.05, textTransform: 'uppercase' }}>{t(LEVELS[level - 1])}</PixelText>
      </View>
    );
  }
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={t('difficulty', { level: t(LEVELS[level - 1]) })} style={{ flexShrink: 0 }}>
      <PixelText size={11} tone={light ? 'ink-700' : 'gold-500'} style={{ letterSpacing: 11 * 0.15 }} after={[{ text: '●'.repeat(3 - level), tone: light ? 'ink-300' : 'ink-500' }]}>
        {'●'.repeat(level)}
      </PixelText>
    </View>
  );
}

/**
 * A life as it is chosen: its name and how hard it is, where it starts and with how much, and in a
 * line each what it is good at and what holds it back. `light` is for a life drawn on cream, chosen.
 */
export function LifeSummary({ lifeId, light = false }: { lifeId: string; light?: boolean }) {
  const t = useT('newLife');
  const { text, names, fmt } = useWords();
  const { locale } = useSettings();
  const character = characterName(lifeId, locale);
  const life = lives.find((one) => one.id === lifeId);
  const written = text.lives[lifeId];
  if (!life || !written) return null;
  const city = names.cities[life.start.cityId];
  const cash = fmt.money(life.start.cash);
  return (
    <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-start', gap: 4, paddingVertical: 4, paddingRight: 4 }}>
      <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flexShrink: 1 }}>
          {/* The one who lives it is in the reading face, inside the pixel title: it keeps the title's font-size-adjust, so it is drawn larger than its 13. */}
          <PixelText size={17} lineHeight={17 * TIGHT} tone={light ? 'ink-900' : 'ink-200'} after={character ? [{ text: ` · ${character}`, read: 13 }] : undefined}>
            {written.name}
          </PixelText>
        </View>
        <Difficulty lifeId={lifeId} light={light} word />
      </View>
      <SrOnly>{t('startsIn', { city, cash })}</SrOnly>
      {/* What the sentence above says, for the eyes. */}
      <View aria-hidden style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Sprite id={cityIcon(life.start.cityId)} size={{ w: 20, h: 20 }} />
          <ReadText size={13} tone={light ? 'ink-900' : 'ink-200'}>{city}</ReadText>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Sprite id="icon.cash" size={{ w: 20, h: 20 }} />
          <PixelText size={14} tone={light ? 'ink-900' : 'ink-200'}>{cash}</PixelText>
        </View>
      </View>
      <ReadText size={12} lineHeight={12 * SNUG} tone={light ? 'teal-800' : 'teal-300'}>{`＋ ${written.perk}`}</ReadText>
      <ReadText size={12} lineHeight={12 * SNUG} tone={light ? 'wine-700' : 'wine-300'}>{`− ${written.handicap}`}</ReadText>
    </View>
  );
}

/** A life as a small tile shows it, not chosen: its name, the city it starts in, and how hard it is. */
export function LifeBrief({ lifeId }: { lifeId: string }) {
  const { text, names } = useWords();
  const life = lives.find((one) => one.id === lifeId);
  if (!life) return null;
  return (
    <View style={{ flexShrink: 1, minWidth: 0, gap: 4 }}>
      <ReadText size={13} lineHeight={13 * TIGHT} tone="ink-200">{text.lives[lifeId]?.name ?? lifeId}</ReadText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Sprite id={cityIcon(life.start.cityId)} size={{ w: 16, h: 16 }} />
        <View style={{ flexShrink: 1, minWidth: 0 }}>
          <ReadText size={11} lineHeight={11} tone="ink-300" numberOfLines={1}>{names.cities[life.start.cityId]}</ReadText>
        </View>
      </View>
      <Difficulty lifeId={lifeId} />
    </View>
  );
}
