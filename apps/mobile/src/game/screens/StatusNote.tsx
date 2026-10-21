import type { ItemQuote } from '@ratrace/engine';
import { ReadText, SNUG } from '../../ui/text';
import { useT } from '../context';

/**
 * What a thing does to the player's status all told: what buying it would add, or what the one owned
 * gives. Within a ladder the best thing counts whole and the rest for less, or nothing.
 */
export function realStatus(quote: ItemQuote): number {
  return quote.statusReal;
}

/** Why a thing gives less than its own status: a better one of its kind is owned. Nothing when it gives all of it. */
export function StatusNote({ quote, owned }: { quote: ItemQuote; owned: boolean }) {
  const t = useT('finance.shop');
  const real = realStatus(quote);
  if (real >= quote.status) return null;
  const key = real <= 0 ? (owned ? 'statusOwnedNone' : 'statusNone') : owned ? 'statusOwnedLess' : 'statusLess';
  // The web's `text-center text-[13px] leading-snug text-ink-300`.
  return (
    <ReadText size={13} lineHeight={13 * SNUG} tone="ink-300" style={{ textAlign: 'center' }}>
      {t(key, { n: real, of: quote.status })}
    </ReadText>
  );
}
