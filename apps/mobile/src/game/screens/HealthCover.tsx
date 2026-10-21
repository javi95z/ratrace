import { HEALTH_RISK_ART } from '@ratrace/content';
import { ageAt } from '@ratrace/core/game/present';
import type { LivingQuote } from '@ratrace/engine';
import { View } from 'react-native';
import { Sprite } from '../../ui/Sprite';
import { ReadText, SNUG } from '../../ui/text';
import type { ColorToken } from '../../ui/theme';
import { useT, useWords } from '../context';

/**
 * What sets the price of health cover, under its switch: the age it was taken out at, for cover
 * held; that taking it out later costs more; or that no insurer takes it on after an illness.
 * Every cover renews by itself each round until it is ended.
 */
export function HealthCoverNote({ living }: { living: LivingQuote }) {
  const t = useT('finance.lifestyle');
  const { content } = useWords();
  const { since, dearerFrom, refused } = living.health;
  const line: { tone: ColorToken; text: string } | null = refused
    ? { tone: 'wine-300', text: t('healthRefused') }
    : since !== null
      ? { tone: 'ink-300', text: t('healthLocked', { age: ageAt(content, since) }) }
      : dearerFrom !== null
        ? { tone: 'gold-200', text: t('healthDearer', { age: ageAt(content, dearerFrom.fromRound) }) }
        : null;
  return (
    // The web's `flex flex-col gap-1 text-[12px] leading-snug`.
    <View style={{ gap: 4 }}>
      {line ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {since === null ? <Sprite id={HEALTH_RISK_ART} /> : null}
          <ReadText size={12} lineHeight={12 * SNUG} tone={line.tone} style={{ flexShrink: 1 }}>{line.text}</ReadText>
        </View>
      ) : null}
      <ReadText size={12} lineHeight={12 * SNUG} tone="ink-300">{t('insuranceRenews')}</ReadText>
    </View>
  );
}
