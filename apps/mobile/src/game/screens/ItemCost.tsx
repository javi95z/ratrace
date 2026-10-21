import type { ItemQuote } from '@ratrace/engine';
import { View } from 'react-native';
import { webBaseline } from '../../ui/fonts';
import { PixelText, ReadText, SNUG } from '../../ui/text';
import { COLORS } from '../../ui/theme';
import { useSettings, useT, useWords } from '../context';

/**
 * Where the two texts of the line of what is owed stand, so their baselines meet (the web's `items-baseline`): the words (14, a line of 1.45) and
 * the figure (a pixel 14, a line of 1.1). A native row's `baseline` reads each text's box, and the kit moves the glyphs inside it (on iOS the pixel
 * figure's by about two points more than the words'): each is placed from the browser's baseline instead, the higher one let down to the lower.
 */
export function owedLine(language: string): { words: number; figure: number } {
  const words = webBaseline('read', 400, 14, 14 * 1.45, language);
  const figure = webBaseline('pixel', 400, 14, 14 * 1.1, language);
  const top = Math.max(words, figure);
  return { words: top - words, figure: top - figure };
}

/**
 * What a thing the player owns cost them, what selling it today would leave them up or down against
 * that, and what is still owed on the loan that bought it. Shown wherever a thing is looked at, so
 * that the price to sell at is never read without the price it was bought at, nor without the debt
 * that will outlive the sale.
 */
export function ItemCost({ quote }: { quote: ItemQuote }) {
  const t = useT('finance.shop');
  const { fmt } = useWords();
  const { locale } = useSettings();
  if (quote.paid === null && quote.owed === 0) return null;
  const gain = quote.paid === null ? 0 : quote.resale - quote.paid;
  const line = owedLine(locale);

  return (
    // The web's `flex flex-col gap-1.5 text-center text-[14px]`.
    <View style={{ gap: 6 }}>
      {quote.paid !== null ? (
        <View>
          <ReadText size={14} style={{ textAlign: 'center' }}>{quote.paid === 0 ? t('gift') : t('paid', { amount: fmt.money(quote.paid) })}</ReadText>
          {quote.sellable && quote.resale > 0 && gain !== 0 ? (
            <ReadText size={13} tone={gain > 0 ? 'teal-300' : 'wine-300'} style={{ textAlign: 'center' }}>
              {t(gain > 0 ? 'sellGain' : 'sellLoss', { amount: fmt.money(Math.abs(gain)) })}
            </ReadText>
          ) : null}
        </View>
      ) : null}
      {quote.owed > 0 ? (
        // The web's `frame-wine bg-wine-900 px-3 py-2 text-left`: `frame-wine` only names the colours of a frame, and nothing draws one here (no
        // `frame`, `bevel` or `frame-raised` beside it), so it is the wine surface alone.
        <View role="note" style={{ backgroundColor: COLORS['wine-900'], paddingHorizontal: 12, paddingVertical: 8 }}>
          {/* The web's `flex items-baseline justify-between gap-3`: aligned at the top, each text let down to the shared baseline (`owedLine`). */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flexShrink: 1, minWidth: 0, marginTop: line.words }}>
              <ReadText size={14}>{t('owed')}</ReadText>
            </View>
            <View style={{ flexShrink: 0, marginTop: line.figure }}>
              <PixelText size={14} tone="wine-300">{fmt.money(quote.owed)}</PixelText>
            </View>
          </View>
          <ReadText size={12} lineHeight={12 * SNUG} tone="ink-200" style={{ marginTop: 2 }}>
            {quote.paid === null ? t('owedGone') : quote.sellable && quote.resale < quote.owed ? t('owedShort', { amount: fmt.money(quote.owed - quote.resale) }) : t('owedKept')}
          </ReadText>
        </View>
      ) : null}
    </View>
  );
}
