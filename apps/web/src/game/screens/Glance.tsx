'use client';

import { quotePortfolio } from '@ratrace/engine';
import type { WealthKind } from '@ratrace/engine';
import { useGame, useT, useWords } from '@/game/context';
import { Panel, Row, Toggle } from '@/ui/kit';
import { useShown } from './Hud';

/** One colour a kind, the same in the bar and in its legend. */
const COLOUR: Record<WealthKind, string> = {
  cash: 'bg-ink-300',
  savings: 'bg-sky-300',
  pension: 'bg-sky-500',
  equity: 'bg-gold-500',
  bond: 'bg-teal-300',
  crypto: 'bg-wine-300',
  gold: 'bg-gold-200',
  property: 'bg-skin-500',
  things: 'bg-ink-500',
};

/**
 * Everything the player owns in one bar: what it is held in and in what shares, the one thing most
 * of it hangs on, and a warning when that is too much. Every figure is the engine's quote.
 */
export function PortfolioGlance() {
  const t = useT('finance.glance');
  const { content, text, names, fmt } = useWords();
  const shown = useShown();
  const quote = quotePortfolio(content, shown);
  const top = quote.largest;
  const property = top?.kind === 'property' ? shown.player.properties.find((x) => x.id === top.id) : undefined;
  const topName = !top ? '' : top.kind === 'asset' ? names.assets[top.id].name : property ? `${text.propertyTypes[property.typeId]}, ${names.cities[property.cityId]}` : '';

  return (
    <Panel title={t('title')} label={t('title')}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-ink-300">{t('total')}</span>
        <span className="pixel text-[20px] text-gold-500">{fmt.money(quote.total)}</span>
      </div>
      {quote.total > 0 ? (
        <>
          {/* The bar is a picture of the list under it, which says the same in words and figures. */}
          <div aria-hidden className="frame sunk mt-2 flex h-4 overflow-hidden bg-night-900">
            {quote.slices.map((slice) => (
              <span key={slice.kind} className={COLOUR[slice.kind]} style={{ width: `${slice.shareBp / 100}%` }} />
            ))}
          </div>
          <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
            {quote.slices.map((slice) => (
              <li key={slice.kind} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span aria-hidden className={`size-2.5 shrink-0 ${COLOUR[slice.kind]}`} />
                  <span className="truncate">{t(`kinds.${slice.kind}`)}</span>
                </span>
                <span className="pixel shrink-0 text-ink-200">{fmt.rate(slice.shareBp)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-1 text-[13px] text-ink-300">{t('empty')}</p>
      )}
      {top && quote.concentrated ? (
        <p role="note" className="mt-2 border-l-4 border-wine-300 pl-2 text-[13px] leading-snug text-wine-300">
          {t('concentrated', { name: topName, pct: fmt.rate(top.shareBp) })}
        </p>
      ) : top && quote.invested > top.value ? (
        <p className="mt-2 text-[12px] leading-snug text-ink-300">{t('largest', { name: topName, pct: fmt.rate(top.shareBp) })}</p>
      ) : null}
    </Panel>
  );
}

/**
 * What the investments and the savings pay this round, and the switch that puts the dividends back
 * into what paid them. Shown only to someone who is paid something.
 */
export function Payouts() {
  const t = useT('finance.glance');
  const { content, fmt } = useWords();
  const shown = useShown();
  const view = useGame((s) => s.view);
  const preview = useGame((s) => s.preview);
  const setOrder = useGame((s) => s.setOrder);
  const quote = quotePortfolio(content, shown);
  if (!view || (quote.dividendsTotal === 0 && quote.interest === 0 && !quote.reinvest)) return null;
  // On, and the round has cash for it; or on, and it has not.
  const short = quote.reinvest && quote.dividendsTotal > 0 && preview !== null && preview.reinvested === 0;

  return (
    <Panel title={t('paysTitle')} label={t('paysTitle')}>
      <Row left={t('dividends')} sub={t('dividendsHint')} right={<span className="text-teal-300">{fmt.signed(quote.dividendsTotal)}</span>} />
      {quote.interest > 0 ? <Row left={t('interest')} right={<span className="text-teal-300">{fmt.signed(quote.interest)}</span>} /> : null}
      <div className="mt-2">
        <Toggle
          on={quote.reinvest}
          onChange={(on) => setOrder((order) => order.type === 'setReinvest', on === view.player.reinvest ? null : { type: 'setReinvest', on })}
          label={t('reinvest')}
          hint={t(quote.reinvest ? 'reinvestOn' : 'reinvestOff')}
        />
      </div>
      {short ? <p className="mt-1.5 text-[12px] leading-snug text-wine-300">{t('reinvestShort')}</p> : null}
    </Panel>
  );
}
