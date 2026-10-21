import type { ItemQuote } from '@ratrace/engine';
import { View } from 'react-native';
import { PixelText, ReadText, SNUG } from '../../ui/text';
import { COLORS } from '../../ui/theme';
import { useT, useWords } from '../context';

/**
 * What a thing the player owns cost them, what selling it today would leave them up or down against
 * that, and what is still owed on the loan that bought it. Shown wherever a thing is looked at, so
 * that the price to sell at is never read without the price it was bought at, nor without the debt
 * that will outlive the sale.
 */
export function ItemCost({ quote }: { quote: ItemQuote }) {
  const t = useT('finance.shop');
  const { fmt } = useWords();
  if (quote.paid === null && quote.owed === 0) return null;
  const gain = quote.paid === null ? 0 : quote.resale - quote.paid;

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
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
            <ReadText size={14} style={{ flexShrink: 1 }}>{t('owed')}</ReadText>
            <PixelText size={14} tone="wine-300">{fmt.money(quote.owed)}</PixelText>
          </View>
          <ReadText size={12} lineHeight={12 * SNUG} tone="ink-200" style={{ marginTop: 2 }}>
            {quote.paid === null ? t('owedGone') : quote.sellable && quote.resale < quote.owed ? t('owedShort', { amount: fmt.money(quote.owed - quote.resale) }) : t('owedKept')}
          </ReadText>
        </View>
      ) : null}
    </View>
  );
}
