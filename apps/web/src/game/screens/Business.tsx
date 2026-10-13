'use client';

import { quoteBusinesses } from '@ratrace/engine';
import type { BusinessesQuote, GameView, Order } from '@ratrace/engine';
import { useState } from 'react';
import { useGame, useT, useWords } from '@/game/context';
import { Bare, Button, Panel, Row, Segmented, Tag, Toggle } from '@/ui/kit';
import { Sheet } from '@/ui/overlay';
import { Sprite } from '@/ui/Sprite';
import { AmountSheet } from './AmountSheet';
import { useShown } from './Hud';

type Owned = BusinessesQuote['owned'][number];
type Kind = BusinessesQuote['kinds'][number];

const ICON = 'icon.business';
const signedPct = (pct: number) => (pct > 0 ? `+${pct}` : pct < 0 ? `−${-pct}` : '0');

/**
 * The one order that leaves a business set as asked: what it pays out and who runs it. Only what
 * differs from how it stands is ordered, and nothing at all when nothing differs.
 */
function settingOrder(view: GameView, businessId: string, want: { payoutPct: number; manager: boolean }): Order | null {
  const now = view.player.businesses.find((business) => business.id === businessId);
  if (!now) return null;
  const payoutPct = want.payoutPct === now.payoutPct ? undefined : want.payoutPct;
  const manager = want.manager === now.manager ? undefined : want.manager;
  if (payoutPct === undefined && manager === undefined) return null;
  return { type: 'setBusiness', businessId, ...(payoutPct === undefined ? {} : { payoutPct }), ...(manager === undefined ? {} : { manager }) };
}

/** How a business is being run this round, in a line. */
function useRunLine() {
  const t = useT('finance.business');
  return (business: Owned): { text: string; tone: string } =>
    business.manager ? { text: t('runManager'), tone: 'text-ink-300' } : business.tended ? { text: t('runYou'), tone: 'text-teal-300' } : { text: t('runNobody'), tone: 'text-wine-300' };
}

/**
 * The businesses the player owns and the ones they could open. A business is run, grown, neglected
 * or sold from here; every figure is the engine's quote of this round.
 */
export function BusinessTab() {
  const t = useT('finance.business');
  const { content, text, fmt } = useWords();
  const shown = useShown();
  const view = useGame((s) => s.view);
  const addOrder = useGame((s) => s.addOrder);
  const runLine = useRunLine();
  const [open, setOpen] = useState<string | null>(null);
  const [starting, setStarting] = useState<Kind | null>(null);
  const quote = quoteBusinesses(content, shown);
  // Looked up afresh on every draw: a business sold while its sheet is open closes it.
  const opened = quote.owned.find((business) => business.id === open);
  if (!view) return null;

  return (
    <div className="flex flex-col gap-3">
      <Panel title={t('yours')} label={t('yours')}>
        {quote.owned.length === 0 ? <p className="text-[14px] leading-snug text-ink-300">{t('none')}</p> : null}
        <ul className="flex flex-col">
          {quote.owned.map((business) => {
            const run = runLine(business);
            return (
              <li key={business.id} className="border-t-2 border-night-900 first:border-t-0">
                <button type="button" aria-haspopup="dialog" onClick={() => setOpen(business.id)} className="flex min-h-11 w-full items-center gap-3 py-2 text-left">
                  <Bare className="size-9">
                    <Sprite id={ICON} />
                  </Bare>
                  <span className="min-w-0 flex-1">
                    <span className="pixel block truncate text-[16px]">{text.businessTypes[business.typeId].name}</span>
                    <span className={`block text-[12px] ${run.tone}`}>{run.text}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="pixel block text-gold-500">{fmt.money(business.capital)}</span>
                    <span className={`block text-[12px] ${business.profit >= 0 ? 'text-teal-300' : 'text-wine-300'}`}>{t('profitRound', { amount: fmt.signed(business.profit) })}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {quote.owned.length > 0 ? <p className="mt-1 text-[12px] leading-snug text-ink-300">{t('focusLeft', { n: quote.focusLeft })}</p> : null}
      </Panel>

      <Panel title={t('open')} label={t('open')}>
        <p className="mb-2 text-[13px] leading-snug text-ink-200">{t('openAbout', { max: quote.max })}</p>
        {/* Set off by rules, not boxed: the panel is the only box. */}
        <ul className="flex flex-col">
          {quote.kinds.map((kind) => (
            <li key={kind.typeId} className="border-t-2 border-night-900 py-3 first:border-t-0 first:pt-0 last:pb-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="pixel text-[16px]">{text.businessTypes[kind.typeId].name}</span>
                <span className="pixel shrink-0 text-[14px] text-gold-500">{t('from', { amount: fmt.compact(kind.minCapital) })}</span>
              </div>
              <p className="mt-0.5 text-[13px] leading-snug text-ink-200">{text.businessTypes[kind.typeId].blurb}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Tag tone="good">{t('yield', { rate: fmt.rate(kind.yieldBp) })}</Tag>
                <Tag tone={kind.cyclePct > 0 ? 'good' : kind.cyclePct < 0 ? 'bad' : 'plain'}>{t('economy', { pct: signedPct(kind.cyclePct) })}</Tag>
                <Tag>{t('managerShare', { pct: kind.managerPct })}</Tag>
              </div>
              {kind.lock !== null ? (
                <p className="mt-1.5 text-[12px] leading-snug text-gold-200">{kind.lock === 'needs-finance-skill' ? t('needsSkill', { level: kind.minFinanceSkill }) : text.reasons[kind.lock]}</p>
              ) : shown.player.cash < kind.minCapital ? (
                <p className="mt-1.5 text-[12px] leading-snug text-gold-200">{t('needsCash', { amount: fmt.money(kind.minCapital - shown.player.cash) })}</p>
              ) : (
                <Button className="mt-2" wide onClick={() => setStarting(kind)}>
                  {t('start')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      {starting ? (
        <AmountSheet
          title={t('startTitle', { name: text.businessTypes[starting.typeId].name })}
          max={shown.player.cash}
          start={starting.minCapital}
          onClose={() => setStarting(null)}
          onConfirm={(capital) => addOrder({ type: 'startBusiness', typeId: starting.typeId, capital })}
        >
          <p className="mb-2 text-[14px] leading-snug text-ink-200">{t('startHint', { min: fmt.money(starting.minCapital), scale: fmt.compact(starting.scale) })}</p>
        </AmountSheet>
      ) : null}
      {opened ? <BusinessSheet business={opened} view={view} quote={quote} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

/** One business, looked at closely: what this round makes of it, and everything that can be done with it. */
function BusinessSheet({ business, view, quote, onClose }: { business: Owned; view: GameView; quote: BusinessesQuote; onClose(): void }) {
  const t = useT('finance.business');
  const common = useT('common');
  const { content, text, fmt } = useWords();
  const addOrder = useGame((s) => s.addOrder);
  const setOrder = useGame((s) => s.setOrder);
  const shown = useShown();
  const [investing, setInvesting] = useState(false);
  const runLine = useRunLine();
  const run = runLine(business);
  // A business opened by an order of this round is not the player's to run until the round is played.
  const standing = view.player.businesses.find((x) => x.id === business.id);
  const regime = view.timeline[view.round].regime;
  const isSetting = (order: Order) => order.type === 'setBusiness' && order.businessId === business.id;
  const isTending = (order: Order) => order.type === 'tendBusiness' && order.businessId === business.id;
  const set = (want: Partial<{ payoutPct: number; manager: boolean }>) =>
    setOrder(isSetting, settingOrder(view, business.id, { payoutPct: business.payoutPct, manager: business.manager, ...want }));

  // One sheet at a time: putting money in takes the place of the business, and gives it back when done.
  if (investing) {
    return (
      <AmountSheet title={t('investTitle', { name: text.businessTypes[business.typeId].name })} max={shown.player.cash} onClose={() => setInvesting(false)} onConfirm={(amount) => addOrder({ type: 'investBusiness', businessId: business.id, amount })} />
    );
  }

  return (
    <Sheet open onClose={onClose} title={text.businessTypes[business.typeId].name} closeLabel={common('close')}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Bare className="p-1 leading-[0]">
            <Sprite id={ICON} scale={2} />
          </Bare>
          <div className="min-w-0">
            <p className="pixel text-[22px] leading-none text-gold-500">{fmt.money(business.capital)}</p>
            <p className="text-[12px] text-ink-300">{t('capitalHint')}</p>
          </div>
        </div>
        <p className={`text-[13px] ${run.tone}`}>{run.text}</p>

        <Panel label={t('thisRound')}>
          <p className="pixel mb-1 text-[12px] uppercase tracking-wider text-gold-200">{t('thisRound')}</p>
          <Row left={t('profit')} sub={t('economyLine', { pct: signedPct(business.cyclePct) })} right={<span className={business.profit >= 0 ? 'text-teal-300' : 'text-wine-300'}>{fmt.signed(business.profit)}</span>} />
          <Row left={t('payout')} right={fmt.money(business.payout)} />
          <Row left={t(business.retained >= 0 ? 'retained' : 'lost')} right={<span className={business.retained < 0 ? 'text-wine-300' : ''}>{fmt.signed(business.retained)}</span>} />
          {business.neglected ? <p className="mt-1 text-[12px] leading-snug text-wine-300">{t('neglected', { pct: content.business.neglectProfitPct })}</p> : null}
        </Panel>

        {standing ? (
          <>
            <Segmented<number>
              label={t('payoutLabel')}
              value={business.payoutPct}
              onChange={(payoutPct) => set({ payoutPct })}
              options={quote.payouts.map((pct) => ({ value: pct, label: t(pct === 0 ? 'keepAll' : pct === 100 ? 'takeAll' : 'takeHalf'), hint: t('payoutPct', { pct }) }))}
            />
            <Toggle
              on={business.tended}
              disabled={business.manager || standing.tended || (!business.tended && quote.focusLeft < 1)}
              onChange={(on) => setOrder(isTending, on ? { type: 'tendBusiness', businessId: business.id } : null)}
              label={t('tend')}
              hint={business.manager ? t('tendNoNeed') : t('tendHint', { left: quote.focusLeft })}
            />
            <Toggle on={business.manager} onChange={(manager) => set({ manager })} label={t('manager')} hint={t('managerHint', { pct: business.managerPct })} />
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => setInvesting(true)} disabled={shown.player.cash <= 0}>
                {t('invest')}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  if (setOrder((order) => order.type === 'sellBusiness' && order.businessId === business.id, { type: 'sellBusiness', businessId: business.id })) onClose();
                }}
              >
                {t('sell', { amount: fmt.compact(business.salePrice) })}
              </Button>
            </div>
            <p className="text-[12px] leading-snug text-ink-300">
              {t('sellHint', { pct: content.business.salePct[regime] })} {business.salePrice > business.basis ? t('sellGain', { amount: fmt.money(business.salePrice - business.basis) }) : ''}
            </p>
          </>
        ) : (
          <p className="text-[13px] leading-snug text-ink-200">{t('opensNow')}</p>
        )}
      </div>
    </Sheet>
  );
}
