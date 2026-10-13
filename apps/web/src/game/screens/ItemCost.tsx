'use client';

import type { ItemQuote } from '@ratrace/engine';
import { useT, useWords } from '@/game/context';

/**
 * What a thing the player owns cost them, and, where it can be sold on, what selling it today would
 * leave them up or down against that. Shown wherever a thing owned is looked at, so that the price
 * to sell at is never read without the price it was bought at.
 */
export function ItemCost({ quote }: { quote: ItemQuote }) {
  const t = useT('finance.shop');
  const { fmt } = useWords();
  if (quote.paid === null) return null;
  const gain = quote.resale - quote.paid;

  return (
    <div className="text-center text-[14px]">
      <p>{quote.paid === 0 ? t('gift') : t('paid', { amount: fmt.money(quote.paid) })}</p>
      {quote.sellable && quote.resale > 0 && gain !== 0 ? (
        <p className={`text-[13px] ${gain > 0 ? 'text-teal-300' : 'text-wine-300'}`}>{t(gain > 0 ? 'sellGain' : 'sellLoss', { amount: fmt.money(Math.abs(gain)) })}</p>
      ) : null}
    </div>
  );
}
