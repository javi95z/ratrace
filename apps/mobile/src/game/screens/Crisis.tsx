import type { WorldState } from '@ratrace/engine';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useAlarm } from '../../ui/animations';
import { Framed } from '../../ui/Frame';
import { WINE } from '../../ui/frames';
import { usePress } from '../../ui/kit';
import { Sheet } from '../../ui/overlay';
import { PixelText, ReadText, SNUG } from '../../ui/text';
import { COLORS, TOUCH } from '../../ui/theme';
import { useT, useWords } from '../context';

type Crisis = NonNullable<WorldState['crisis']>;

/** One lamp of a crisis's rounds, 10 points square: gone by, being lived (it pulses), or to come. */
function Lamp({ when }: { when: 'past' | 'now' | 'ahead' }) {
  const alarm = useAlarm({ play: when === 'now' });
  const box = { width: 10, height: 10, backgroundColor: COLORS[when === 'past' ? 'wine-300' : when === 'now' ? 'cream' : 'wine-900'] };
  return when === 'now' ? <Animated.View {...{ dataSet: { lamp: when } }} style={[box, alarm]} /> : <View {...{ dataSet: { lamp: when } }} style={box} />;
}

/** One lamp for each round of a crisis: lit for those gone by, pulsing for the one being lived. */
function Years({ crisis }: { crisis: Crisis }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', flexShrink: 0, gap: 4 }}>
      {Array.from({ length: crisis.of }, (_, i) => (
        <Lamp key={i} when={i + 1 < crisis.year ? 'past' : i + 1 === crisis.year ? 'now' : 'ahead'} />
      ))}
    </View>
  );
}

/** What a crisis is and what each of its rounds does, the one being lived marked. */
export function CrisisDetails({ crisis }: { crisis: Crisis }) {
  const t = useT('crisis');
  const { text } = useWords();
  const written = text.crises[crisis.id];
  return (
    <View style={{ gap: 12 }}>
      <ReadText size={14} lineHeight={14 * SNUG}>{written.intro}</ReadText>
      <View role="list" style={{ gap: 6 }}>
        {written.years.map((line, i) => {
          const now = i + 1 === crisis.year;
          const past = i + 1 < crisis.year;
          return (
            <View key={i} role="listitem" aria-current={now ? 'step' : undefined}>
              <Framed kind="frame" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: COLORS[now ? 'wine-700' : 'night-700'] }}>
                <PixelText size={13} tone={past ? 'ink-300' : 'cream'} style={{ flexShrink: 0, letterSpacing: 13 * 0.05 }}>
                  {t('year', { n: i + 1 }).toUpperCase()}
                </PixelText>
                <ReadText size={14} lineHeight={14 * SNUG} tone={past ? 'ink-300' : 'cream'} style={{ flexShrink: 1 }}>
                  {line}
                </ReadText>
              </Framed>
            </View>
          );
        })}
      </View>
      <ReadText size={12} tone="ink-300">{t('advice')}</ReadText>
    </View>
  );
}

/**
 * The bar of a crisis: its name, how far through it the world is, and what this round of it
 * brings. A tap opens the whole of it. Nothing is drawn in ordinary times. `open` has it open from the start (a scene's sheet).
 */
export function CrisisBar({ crisis, compact = false, open: openAtFirst = false }: { crisis: Crisis | null; compact?: boolean; open?: boolean }) {
  const t = useT('crisis');
  const common = useT('common');
  const { text } = useWords();
  const [open, setOpen] = useState(openAtFirst);
  const press = usePress({ onPress: () => setOpen(true) });
  if (!crisis) return null;
  const written = text.crises[crisis.id];
  // The web's bar is as tall as its two lines (42.8 points as the strip): it is not made taller, the touch reaches past it instead.
  const tall = compact ? 6 + 12 * 1.1 + 16 * 1.1 + 6 : 0;
  const reach = Math.max(0, Math.ceil((TOUCH - tall) / 2));
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('open', { crisis: written.name, year: crisis.year, of: crisis.of })}
        hitSlop={compact ? { top: reach, bottom: reach } : undefined}
        onPress={press}
      >
        <Framed
          kind="raised"
          tone={WINE}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS['wine-700'], paddingHorizontal: compact ? 10 : 12, paddingVertical: compact ? 6 : 10 }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <PixelText size={12} tone="wine-300" style={{ letterSpacing: 12 * 0.12 }}>
              {t('label', { year: crisis.year, of: crisis.of }).toUpperCase()}
            </PixelText>
            <PixelText size={compact ? 16 : 20} numberOfLines={1}>{written.name}</PixelText>
            {compact ? null : (
              <ReadText size={13} lineHeight={13 * SNUG} style={{ marginTop: 2 }}>
                {written.years[crisis.year - 1]}
              </ReadText>
            )}
          </View>
          <Years crisis={crisis} />
        </Framed>
      </Pressable>
      <Sheet open={open} onClose={() => setOpen(false)} title={written.name} closeLabel={common('close')} tone="wine">
        <CrisisDetails crisis={crisis} />
      </Sheet>
    </>
  );
}
