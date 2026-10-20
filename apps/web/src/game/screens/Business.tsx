'use client';

import { businessArt, businessStageArt, HANDOVER_ART } from '@ratrace/content';
import { quoteBusinesses } from '@ratrace/engine';
import type { BusinessesQuote, GameView, Order } from '@ratrace/engine';
import { useState } from 'react';
import { useGame, useKnows, useT, useWords } from '@/game/context';
import { reviewStars } from '@ratrace/core/game/quips';
import { Bare, Button, Panel, Row, Segmented, Tag, Toggle, KeyFigure } from '@/ui/kit';
import { Sheet } from '@/ui/overlay';
import { Sprite } from '@/ui/Sprite';
import { AmountSheet } from './AmountSheet';
import { useShown } from './Hud';

type Owned = BusinessesQuote['owned'][number];
type Kind = BusinessesQuote['kinds'][number];

const signedPct = (pct: number) => (pct > 0 ? `+${pct}` : pct < 0 ? `−${-pct}` : '0');


/** An owned business drawn as big as it has grown: its capital against the size its kind reaches. */
function grownArt(business: { typeId: string; capital: number }, types: ReadonlyArray<{ id: string; scale: number }>): string {
  const kind = types.find((type) => type.id === business.typeId);
  return kind ? businessStageArt(business.typeId, business.capital, kind.scale) : businessArt(business.typeId);
}
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

/**
 * The two ways a business is run, as orders: the player's own focus this round, and a manager. The
 * same orders the business's sheet gives, so a change made in one place shows in the other.
 */
function useRunning(view: GameView | null, business: Owned) {
  const setOrder = useGame((s) => s.setOrder);
  const isSetting = (order: Order) => order.type === 'setBusiness' && order.businessId === business.id;
  const isTending = (order: Order) => order.type === 'tendBusiness' && order.businessId === business.id;
  return {
    tend: (on: boolean) => setOrder(isTending, on ? { type: 'tendBusiness', businessId: business.id } : null),
    // A manager takes over from the owner: their focus is given back.
    manage: (on: boolean) => {
      if (!view) return false;
      if (on) setOrder(isTending, null);
      return setOrder(isSetting, settingOrder(view, business.id, { payoutPct: business.payoutPct, manager: on }));
    },
  };
}

/** A small switch beside a business: on or off, with what it costs said in its label. */
function QuickSwitch({ on, disabled, label, onChange }: { on: boolean; disabled?: boolean; label: string; onChange(on: boolean): void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`pixel frame-raised min-h-9 flex-1 px-2 text-[13px] disabled:opacity-45 ${on ? 'frame-gold bg-teal-800 text-cream' : 'bg-night-600 text-ink-200'}`}
    >
      {on ? '✓ ' : ''}
      {label}
    </button>
  );
}

/**
 * One business in the list: what it is worth and makes, how it is run, what its customers say, and
 * the two switches that run it, at hand without opening it. The rest is in its sheet.
 */
function BusinessLine({ business, quote, onOpen }: { business: Owned; quote: BusinessesQuote; onOpen(): void }) {
  const t = useT('finance.business');
  const { content, text, fmt } = useWords();
  const view = useGame((s) => s.view);
  const runLine = useRunLine();
  const run = runLine(business);
  const running = useRunning(view, business);
  const stars = reviewStars(business);
  // A business opened by an order of this round is not the player's to run until the round is played.
  const standing = view?.player.businesses.find((x) => x.id === business.id);
  return (
    <li className="border-t-2 border-night-900 py-2 first:border-t-0 first:pt-0">
      <button type="button" aria-haspopup="dialog" onClick={onOpen} className="flex min-h-11 w-full items-center gap-3 text-left">
        <Bare className="size-16 shrink-0">
          <Sprite id={grownArt(business, content.business.types)} />
        </Bare>
        <span className="min-w-0 flex-1">
          <span className="pixel block truncate text-[17px]">{text.businessTypes[business.typeId].name}</span>
          <span className={`block text-[12px] ${run.tone}`}>{run.text}</span>
          <span role="img" aria-label={t('review.stars', { n: stars })} className="block text-[12px] tracking-widest text-gold-500">
            {'★'.repeat(stars)}
            <span className="text-ink-500">{'★'.repeat(5 - stars)}</span>
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="pixel block text-[17px] text-gold-500">{fmt.money(business.capital)}</span>
          <span className={`block text-[12px] ${business.profit >= 0 ? 'text-teal-300' : 'text-wine-300'}`}>{t('profitRound', { amount: fmt.signed(business.profit) })}</span>
          <span className="block text-[12px] text-ink-300">{t('paysYou', { amount: fmt.money(business.payout) })}</span>
        </span>
      </button>
      {business.neglected ? <p className="mt-1 text-[12px] leading-snug text-wine-300">{t('neglectedShort')}</p> : null}
      {standing ? (
        <div className="mt-2 flex gap-2">
          <QuickSwitch
            on={business.tended && !business.manager}
            disabled={standing.tended || (!business.tended && (business.manager || quote.focusLeft < 1))}
            label={t('quickTend')}
            onChange={(on) => running.tend(on)}
          />
          <QuickSwitch on={business.manager} label={t('quickManager', { pct: business.managerPct })} onChange={(on) => running.manage(on)} />
        </div>
      ) : null}
    </li>
  );
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
  const [open, setOpen] = useState<string | null>(null);
  const [starting, setStarting] = useState<Kind | null>(null);
  const quote = quoteBusinesses(content, shown);
  // Only what the player could open: not what needs more Finance, not a trade that is not theirs, not a second of what there may be only one of.
  const offered = quote.kinds.filter((kind) => kind.lock !== 'needs-finance-skill' && kind.lock !== 'not-your-trade' && kind.lock !== 'already-owned');
  // Looked up afresh on every draw: a business sold while its sheet is open closes it.
  const opened = quote.owned.find((business) => business.id === open);
  const total = quote.owned.reduce((sum, business) => ({ capital: sum.capital + business.capital, profit: sum.profit + business.profit, payout: sum.payout + business.payout }), { capital: 0, profit: 0, payout: 0 });
  if (!view) return null;

  return (
    <div className="flex flex-col gap-3">
      <Panel title={t('yours')} label={t('yours')}>
        {quote.owned.length === 0 ? <p className="text-[14px] leading-snug text-ink-300">{t('none')}</p> : null}
        {quote.owned.length > 0 ? (
          // All of them at a glance: what they are worth, what they make this round, and what comes to the player.
          <div className="mb-2 grid grid-cols-3 gap-2 border-b-2 border-night-900 pb-2 text-center">
            <div>
              <p className="pixel text-[16px] text-gold-500">{fmt.compact(total.capital)}</p>
              <p className="text-[11px] text-ink-300">{t('totalWorth')}</p>
            </div>
            <div>
              <p className={`pixel text-[16px] ${total.profit >= 0 ? 'text-teal-300' : 'text-wine-300'}`}>{fmt.signed(total.profit)}</p>
              <p className="text-[11px] text-ink-300">{t('totalProfit')}</p>
            </div>
            <div>
              <p className="pixel text-[16px]">{fmt.money(total.payout)}</p>
              <p className="text-[11px] text-ink-300">{t('totalPayout')}</p>
            </div>
          </div>
        ) : null}
        <ul className="flex flex-col">
          {quote.owned.map((business) => (
            <BusinessLine key={business.id} business={business} quote={quote} onOpen={() => setOpen(business.id)} />
          ))}
        </ul>
        {quote.owned.length > 0 ? <p className="mt-1 text-[12px] leading-snug text-ink-300">{t('focusLeft', { n: quote.focusLeft })}</p> : null}
      </Panel>

      <Panel title={t('open')} label={t('open')}>
        <p className="mb-2 text-[13px] leading-snug text-ink-200">{t('openAbout', { max: quote.max })}</p>
        {/* Set off by rules, not boxed: the panel is the only box. */}
        <ul className="flex flex-col">
          {offered.map((kind) => (
            <li key={kind.typeId} className="border-t-2 border-night-900 py-3 first:border-t-0 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <Bare className="size-16 shrink-0">
                    <Sprite id={businessArt(kind.typeId)} />
                  </Bare>
                  <span className="pixel text-[16px]">{text.businessTypes[kind.typeId].name}</span>
                </span>
                <span className="pixel shrink-0 text-[14px] text-gold-500">{t('from', { amount: fmt.compact(kind.minCapital) })}</span>
              </div>
              <p className="mt-0.5 text-[13px] leading-snug text-ink-200">{text.businessTypes[kind.typeId].blurb}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Tag tone="good">{t('yield', { rate: fmt.rate(kind.yieldBp) })}</Tag>
                <Tag tone={kind.cyclePct > 0 ? 'good' : kind.cyclePct < 0 ? 'bad' : 'plain'}>{t('economy', { pct: signedPct(kind.cyclePct) })}</Tag>
                <Tag>{t('managerShare', { pct: kind.managerPct })}</Tag>
                {/* The start is the hard part: it may not survive its first round, and it takes a while to find its customers. */}
                {kind.failChancePct > 0 ? <Tag tone="bad">{t('failChance', { pct: kind.failChancePct })}</Tag> : null}
              </div>
              <p className="mt-1 text-[12px] leading-snug text-ink-300">{t('slowStart', { first: content.business.rampPct[0] ?? 100, second: content.business.rampPct[1] ?? 100, back: content.business.failRecoverPct })}</p>
              {kind.lock !== null ? (
                <p className="mt-1.5 text-[12px] leading-snug text-gold-200">{text.reasons[kind.lock]}</p>
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

/** What the customers write about it online. It is said, not counted: the stars follow how it is run. */
function Review({ business }: { business: Owned }) {
  const t = useT('finance.business');
  const stars = reviewStars(business);
  return (
    <p className="text-[12px] leading-snug">
      <span role="img" aria-label={t('review.stars', { n: stars })} className="mr-1.5 tracking-widest text-gold-500">
        {'★'.repeat(stars)}
        <span className="text-ink-500">{'★'.repeat(5 - stars)}</span>
      </span>
      <span className="italic text-ink-200">{t(`review.${stars}`)}</span>
    </p>
  );
}

/**
 * Living from the business: once it has made a good share of the pay two rounds running, the job
 * can be left for it; run full time it says so, and what it gives. Before that, nothing is shown.
 */
function OwnBoss({ business, view }: { business: Owned; view: GameView }) {
  const knows = useKnows();
  const t = useT('finance.business');
  const { content, text } = useWords();
  const setOrder = useGame((s) => s.setOrder);
  const orders = useGame((s) => s.orders);
  const rule = content.life.fullTime;
  const p = view.player;
  const isLeaving = (order: Order) => order.type === 'goFullTime';
  const leaving = orders.some((order) => order.type === 'goFullTime' && order.businessId === business.id);
  if (business.fullTime === true) {
    return (
      <div className="border-l-4 border-teal-300 pl-2.5">
        <p className="pixel text-[15px] text-teal-300">{t('fullTime.is')}</p>
        <p className="text-[12px] leading-snug text-ink-200">{t('fullTime.isHint', { pct: rule.profitPct - 100, focus: rule.focus })}</p>
      </div>
    );
  }
  const strong = business.strong ?? 0;
  if (!knows('goFullTime') || p.life.career === null || p.businesses.some((x) => x.fullTime === true)) return null;
  if (strong < rule.strongRounds) return null;
  const job = text.careers[p.life.career.id].levels[p.life.career.level];
  return (
    <div className="flex flex-col gap-1.5">
      <Button variant={leaving ? 'primary' : undefined} onClick={() => setOrder(isLeaving, leaving ? null : { type: 'goFullTime', businessId: business.id })}>
        {leaving ? t('fullTime.leaving') : t('fullTime.go')}
      </Button>
      <p className="text-[12px] leading-snug text-ink-300">{t('fullTime.goHint', { job, pct: rule.profitPct - 100, focus: rule.focus })}</p>
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
            <Sprite id={grownArt(business, content.business.types)} />
          </Bare>
          <div className="min-w-0">
            <KeyFigure className="block">{fmt.money(business.capital)}</KeyFigure>
            <p className="text-[12px] text-ink-300">{t('capitalHint')}</p>
          </div>
        </div>
        <p className={`text-[13px] ${run.tone}`}>{run.text}</p>
        <Review business={business} />

        <Panel label={t('thisRound')}>
          <p className="pixel mb-1 text-[12px] uppercase tracking-wider text-gold-200">{t('thisRound')}</p>
          <Row left={t('profit')} sub={t('economyLine', { pct: signedPct(business.cyclePct) })} right={<span className={business.profit >= 0 ? 'text-teal-300' : 'text-wine-300'}>{fmt.signed(business.profit)}</span>} />
          <Row left={t('payout')} right={fmt.money(business.payout)} />
          <Row left={t(business.retained >= 0 ? 'retained' : 'lost')} right={<span className={business.retained < 0 ? 'text-wine-300' : ''}>{fmt.signed(business.retained)}</span>} />
          {business.neglected ? <p className="mt-1 text-[12px] leading-snug text-wine-300">{t('neglected', { pct: content.business.neglectProfitPct })}</p> : null}
        </Panel>

        {standing ? <OwnBoss business={business} view={view} /> : null}

        {standing ? (
          <>
            <Segmented<number>
              label={t('payoutLabel')}
              value={business.payoutPct}
              onChange={(payoutPct) => set({ payoutPct })}
              options={quote.payouts.map((pct) => ({ value: pct, label: t(pct === 0 ? 'keepAll' : pct === 100 ? 'takeAll' : 'takeHalf'), hint: t('payoutPct', { pct }) }))}
            />
            {/* Run full time, it needs neither the owner's spare focus nor a manager. */}
            {business.fullTime === true ? null : (
            <>
            <Toggle
              on={business.tended && !business.manager}
              disabled={standing.tended || (!business.tended && (business.manager || quote.focusLeft < 1))}
              onChange={(on) => setOrder(isTending, on ? { type: 'tendBusiness', businessId: business.id } : null)}
              label={t('tend')}
              hint={business.manager ? t('tendNoNeed') : t('tendHint', { left: quote.focusLeft })}
            />
            <Toggle
              on={business.manager}
              onChange={(manager) => {
                // A manager takes over from the owner: their focus is given back.
                if (manager) setOrder(isTending, null);
                set({ manager });
              }}
              label={t('manager')} hint={t('managerHint', { pct: business.managerPct })} />
            </>
            )}
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
                <Sprite id={HANDOVER_ART} />
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
