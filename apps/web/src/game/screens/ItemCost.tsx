'use client';

import type { ItemQuote } from '@ratrace/engine';
import { useT, useWords } from '@/game/context';

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
    <div className="flex flex-col gap-1.5 text-center text-[14px]">
      {quote.paid !== null ? (
        <div>
          <p>{quote.paid === 0 ? t('gift') : t('paid', { amount: fmt.money(quote.paid) })}</p>
          {quote.sellable && quote.resale > 0 && gain !== 0 ? (
            <p className={`text-[13px] ${gain > 0 ? 'text-teal-300' : 'text-wine-300'}`}>{t(gain > 0 ? 'sellGain' : 'sellLoss', { amount: fmt.money(Math.abs(gain)) })}</p>
          ) : null}
        </div>
      ) : null}
      {quote.owed > 0 ? (
        <div role="note" className="frame-wine bg-wine-900 px-3 py-2 text-left">
          <p className="flex items-baseline justify-between gap-3">
            <span>{t('owed')}</span>
            <span className="pixel text-wine-300">{fmt.money(quote.owed)}</span>
          </p>
          <p className="mt-0.5 text-[12px] leading-snug text-ink-200">
            {quote.paid === null ? t('owedGone') : quote.sellable && quote.resale < quote.owed ? t('owedShort', { amount: fmt.money(quote.owed - quote.resale) }) : t('owedKept')}
          </p>
        </div>
      ) : null}
    </div>
  );
}
