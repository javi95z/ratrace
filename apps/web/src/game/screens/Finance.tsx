'use client';

import { assetKind, cityIcon, focusArt, insuranceArt, itemArt, lifestyleArt, propertyArt, rentTierIcon } from '@ratrace/content';
import type { AssetKind } from '@ratrace/content';
import { assetYieldBp, debtRateBp, depositRateBp, effectiveTax, focusLeft, homeOf, quoteItem, quoteLiving, quoteLoan, quoteMargin, quoteMove, quoteOwnedProperty, quotePlans, quotePortfolio, quoteProperty, quoteWork } from '@ratrace/engine';
import type { AssetDef, Debt, FocusAction, GameView, InsuranceKind, ItemDef, LifestyleTier, Order, RentTier } from '@ratrace/engine';
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { useGame, useT, useWords } from '@/game/context';
import { ageAt, debtLabel, orderLabel, priceHistory } from '@/game/present';
import { Bar, Bare, Button, Panel, Row, Segmented, Tag, TickerBadge, TILE, Toggle } from '@/ui/kit';
import { Sheet, Tabs, Toast } from '@/ui/overlay';
import { Sprite } from '@/ui/Sprite';
import { AmountSheet } from './AmountSheet';
import { Payouts, PortfolioGlance } from './Glance';
import { useShown } from './Hud';
import { ItemCost } from './ItemCost';
import { ItemUses } from './ItemUses';

type TabId = 'portfolio' | 'market' | 'property' | 'debt' | 'lifestyle' | 'shop' | 'taxes';
const TABS: TabId[] = ['portfolio', 'market', 'property', 'debt', 'lifestyle', 'shop', 'taxes'];
const KINDS: AssetKind[] = ['fund', 'bond', 'stock', 'crypto', 'gold'];
const KIND_TITLE: Record<AssetKind, string> = { fund: 'funds', bond: 'bonds', stock: 'stocks', crypto: 'crypto', gold: 'gold' };
const INSURANCES: InsuranceKind[] = ['health', 'home', 'life', 'liability'];

/** The game before this round's orders, the game with them applied, and the preview of the round. */
function useRound() {
  const view = useGame((s) => s.view);
  const preview = useGame((s) => s.preview);
  const shown = useShown();
  if (!view || !preview) throw new Error('the finance phase needs a view and a preview');
  return { view, shown, preview, world: view.timeline[view.round], p: shown.player };
}

// ------------------------------------------------------------------------------------------------
// Portfolio

type Move = { kind: 'save' } | { kind: 'withdraw' } | { kind: 'pension' } | { kind: 'sell'; asset: AssetDef };

function Portfolio() {
  const t = useT('finance.portfolio');
  const amount = useT('finance.amount');
  const { content, names, fmt } = useWords();
  const { p, shown, world, preview } = useRound();
  const addOrder = useGame((s) => s.addOrder);
  const [move, setMove] = useState<Move | null>(null);
  const held = content.assets.filter((asset) => Object.hasOwn(p.positions, asset.id));
  // The most the pension takes this round, from the engine: its cap, the cash there is, and solvency.
  const pensionRoom = preview.pensionRoom;

  const sheet = (() => {
    if (!move) return null;
    const close = () => setMove(null);
    if (move.kind === 'save') return <AmountSheet title={amount('save')} max={p.cash} onClose={close} onConfirm={(a) => addOrder({ type: 'depositIn', amount: a })} />;
    if (move.kind === 'withdraw') return <AmountSheet title={amount('withdraw')} max={p.deposit} onClose={close} onConfirm={(a) => addOrder({ type: 'depositOut', amount: a })} />;
    if (move.kind === 'pension') return <AmountSheet title={amount('pension')} max={pensionRoom} onClose={close} onConfirm={(a) => addOrder({ type: 'pensionIn', amount: a })} />;
    const name = names.assets[move.asset.id].name;
    return (
      <AmountSheet
        title={amount('sell', { name })}
        max={p.positions[move.asset.id]?.value ?? 0}
        onClose={close}
        onConfirm={(a) => addOrder({ type: 'sell', assetId: move.asset.id, amount: a })}
      />
    );
  })();

  const dividends = new Map(quotePortfolio(content, shown).dividends.map((paid) => [paid.assetId, paid.amount]));

  return (
    <div className="flex flex-col gap-3">
      <PortfolioGlance />
      <Panel>
        <Row left={t('cash')} sub={t('cashHint')} right={fmt.money(p.cash)} />
        <div className="my-1 h-[2px] bg-night-900" />
        <Row left={t('savings')} sub={t('savingsRate', { rate: fmt.rate(depositRateBp(content, world)) })} right={fmt.money(p.deposit)} />
        <div className="mt-1 grid grid-cols-2 gap-2">
          <Button onClick={() => setMove({ kind: 'save' })} disabled={p.cash <= 0}>
            {t('save')}
          </Button>
          <Button onClick={() => setMove({ kind: 'withdraw' })} disabled={p.deposit <= 0}>
            {t('withdraw')}
          </Button>
        </div>
        <div className="my-3 h-[2px] bg-night-900" />
        <Row left={t('pension')} sub={t('pensionHint')} right={fmt.money(p.pension)} />
        <p className="text-[12px] text-ink-300">{pensionRoom > 0 ? t('pensionRoom', { amount: fmt.money(pensionRoom) }) : t('pensionFull')}</p>
        <Button className="mt-2" wide onClick={() => setMove({ kind: 'pension' })} disabled={pensionRoom <= 0}>
          {t('add')}
        </Button>
      </Panel>

      <Panel title={t('holdings')} label={t('holdings')}>
        {held.length === 0 ? <p className="text-[14px] text-ink-300">{t('none')}</p> : null}
        {held.map((asset) => {
          const position = p.positions[asset.id];
          const gain = position.value - position.basis;
          return (
            <div key={asset.id} className="flex items-center gap-3 py-1.5">
              <TickerBadge ticker={names.assets[asset.id].ticker} kind={asset.class} />
              <div className="min-w-0 flex-1">
                <div className="truncate">{names.assets[asset.id].name}</div>
                <div className={`text-[12px] ${gain >= 0 ? 'text-teal-300' : 'text-wine-300'}`}>
                  {t(gain >= 0 ? 'gain' : 'loss', { amount: fmt.money(Math.abs(gain)) })}
                </div>
                {dividends.has(asset.id) ? <div className="text-[12px] text-ink-300">{t('pays', { amount: fmt.money(dividends.get(asset.id) ?? 0) })}</div> : null}
                <MarginLine assetId={asset.id} />
              </div>
              <div className="pixel text-right">{fmt.money(position.value)}</div>
              <Button onClick={() => setMove({ kind: 'sell', asset })}>{t('sell')}</Button>
            </div>
          );
        })}
      </Panel>
      <Payouts />
      <Plans />
      {sheet}
    </div>
  );
}

/** What is owed to the broker on a holding, and how far its price may fall before he sells it. Nothing for a holding bought outright. */
function MarginLine({ assetId }: { assetId: string }) {
  const t = useT('finance.plans');
  const { content, fmt } = useWords();
  const { shown } = useRound();
  const margin = quoteMargin(content, shown, assetId);
  if (margin.owed === 0 || margin.dropToCallBp === null) return null;
  return (
    <div className="text-[12px] text-wine-300">
      {t('marginOwed', { amount: fmt.money(margin.owed) })} · {margin.dropToCallBp > 0 ? t('marginDrop', { pct: fmt.rate(margin.dropToCallBp) }) : t('marginNow')}
    </div>
  );
}

/** The order that leaves a plan at `amount` a round, or none when that is what it already is. */
function planOrder(view: GameView, assetId: string, amount: number): Order | null {
  const now = view.player.plans.find((plan) => plan.assetId === assetId)?.amount ?? 0;
  return amount === now ? null : { type: 'setPlan', assetId, amount };
}
const isPlanFor = (assetId: string) => (order: Order) => order.type === 'setPlan' && order.assetId === assetId;
/** The most a plan can be set to: what a round's pay would cover, or the cash in hand if that is more. */
const planMax = (cash: number, salary: number) => Math.max(cash, salary);

/**
 * The player's standing plans to invest: what each buys a round, what it has put in, how today's
 * price stands to the average paid, and whether this round can pay for it. A tap changes or ends one.
 */
function Plans() {
  const t = useT('finance.plans');
  const { content, names, fmt } = useWords();
  const { view, shown, p, preview } = useRound();
  const setOrder = useGame((s) => s.setOrder);
  const [editing, setEditing] = useState<string | null>(null);
  const plans = quotePlans(shown);
  const open = plans.find((plan) => plan.assetId === editing);
  let total = 0;
  for (const plan of plans) total += plan.amount;

  return (
    <Panel title={t('title')} label={t('title')}>
      {plans.length === 0 ? (
        <p className="text-[14px] leading-snug text-ink-300">{t('none')}</p>
      ) : (
        <p className="mb-1 text-[13px] text-ink-200">{t('total', { amount: fmt.money(total) })}</p>
      )}
      <ul className="flex flex-col">
        {plans.map((plan) => {
          const run = preview.plans.find((x) => x.assetId === plan.assetId);
          const missed = run !== undefined && run.reason !== null;
          const standing = view.player.plans.some((x) => x.assetId === plan.assetId);
          const edge = plan.priceVsAverageBp;
          return (
            <li key={plan.assetId} className="border-t-2 border-night-900 first:border-t-0">
              <button type="button" aria-haspopup="dialog" onClick={() => setEditing(plan.assetId)} className="flex min-h-11 w-full items-center gap-3 py-2 text-left">
                <TickerBadge ticker={names.assets[plan.assetId].ticker} kind={content.assets.find((asset) => asset.id === plan.assetId)?.class ?? 'equity'} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{names.assets[plan.assetId].name}</span>
                  <span className="block text-[12px] text-ink-300">{plan.rounds > 0 ? t('putIn', { amount: fmt.money(plan.invested), rounds: plan.rounds }) : t('starts')}</span>
                  {edge !== null && edge !== 0 ? (
                    <span className={`block text-[12px] ${edge > 0 ? 'text-teal-300' : 'text-wine-300'}`}>{t(edge > 0 ? 'priceAbove' : 'priceBelow', { pct: fmt.rate(Math.abs(edge)) })}</span>
                  ) : null}
                  {missed ? <span className="block text-[12px] text-wine-300">{t('missed')}</span> : !standing ? <span className="block text-[12px] text-gold-200">{t('new')}</span> : null}
                </span>
                <span className="shrink-0 text-right">
                  <span className="pixel block text-gold-500">{fmt.money(plan.amount)}</span>
                  <span className="block text-[11px] text-ink-300">{t('aRound')}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {open ? (
        <AmountSheet
          title={t('edit', { name: names.assets[open.assetId].name })}
          // What the plan takes this round is cash again once the plan is being changed.
          max={planMax(p.cash + (preview.plans.find((x) => x.assetId === open.assetId)?.reason === null ? open.amount : 0), preview.income.salary)}
          start={open.amount}
          onClose={() => setEditing(null)}
          onConfirm={(amount) => setOrder(isPlanFor(open.assetId), planOrder(view, open.assetId, amount))}
          footer={
            <Button
              className="mt-2"
              variant="danger"
              wide
              onClick={() => {
                if (setOrder(isPlanFor(open.assetId), planOrder(view, open.assetId, 0))) setEditing(null);
              }}
            >
              {t('stop')}
            </Button>
          }
        >
          <p className="mb-2 text-[14px] leading-snug text-ink-200">{t('editHint')}</p>
          {open.basis > 0 ? (
            <div className="mb-3 text-[14px]">
              <Row left={t('held')} right={fmt.money(open.value)} />
              <Row left={t('cost')} right={fmt.money(open.basis)} />
            </div>
          ) : null}
        </AmountSheet>
      ) : null}
    </Panel>
  );
}

// ------------------------------------------------------------------------------------------------
// Market

/** The price of an asset since the start of the life, as a stepped pixel line. */
function Sparkline({ values, label }: { values: number[]; label: string }) {
  const w = 280;
  const h = 48;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 1);
  const span = max - min || 1;
  const stepX = values.length > 1 ? w / (values.length - 1) : w;
  let path = '';
  values.forEach((value, i) => {
    const x = Math.round(i * stepX);
    const y = Math.round(h - 4 - ((value - min) / span) * (h - 8));
    path += i === 0 ? `M0 ${y}` : ` H${x} V${y}`;
  });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className="frame w-full bg-night-900" shapeRendering="crispEdges">
      <path d={path} fill="none" stroke="var(--color-gold-500)" strokeWidth="2" />
    </svg>
  );
}

function Market() {
  const t = useT('finance.market');
  const amount = useT('finance.amount');
  const { content, text, names, fmt } = useWords();
  const { view, p, world } = useRound();
  const addOrder = useGame((s) => s.addOrder);
  const setOrder = useGame((s) => s.setOrder);
  const plans = useT('finance.plans');
  const { shown, preview } = useRound();
  const [buying, setBuying] = useState<AssetDef | null>(null);
  // The same sheet buys once or sets what is bought every round.
  const [each, setEach] = useState(false);
  // Bought once, it may be bought with as much again borrowed from the broker.
  const [geared, setGeared] = useState(false);
  const margin = buying ? quoteMargin(content, shown, buying.id) : null;
  const planned = buying ? shown.player.plans.find((plan) => plan.assetId === buying.id) : undefined;

  return (
    <div className="flex flex-col gap-3">
      {KINDS.map((kind) => (
        <Panel key={kind} title={t(KIND_TITLE[kind])}>
          {content.assets
            .filter((asset) => assetKind(asset) === kind)
            .map((asset) => {
              const need = asset.minFinanceSkill ?? 0;
              const locked = need > p.life.financeSkill;
              const change = world.assetReturnBp[asset.id];
              const pays = assetYieldBp(asset, world);
              return (
                <button
                  key={asset.id}
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    setEach(false);
                    setGeared(false);
                    setBuying(asset);
                  }}
                  className="flex min-h-11 w-full items-center gap-3 py-1.5 text-left"
                >
                  {/* Only the badge is dimmed for a locked asset: its name and what unlocks it must stay readable. */}
                  <span className={locked ? 'opacity-50' : ''}>
                    <TickerBadge ticker={names.assets[asset.id].ticker} kind={asset.class} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate ${locked ? 'text-ink-200' : ''}`}>{names.assets[asset.id].name}</span>
                    <span className={`block text-[12px] ${locked ? 'text-gold-200' : 'text-ink-300'}`}>{locked ? t('needsSkill', { level: need }) : pays > 0 ? t('yield', { rate: fmt.rate(pays) }) : ' '}</span>
                  </span>
                  <span className={`pixel text-right ${view.round === 0 ? 'text-ink-300' : change >= 0 ? 'text-teal-300' : 'text-wine-300'}`}>
                    {view.round === 0 ? '—' : fmt.change(change)}
                  </span>
                </button>
              );
            })}
        </Panel>
      ))}

      {buying ? (
        <AmountSheet
          // A new sheet for each way of buying: the amount starts over, and so does what it can be.
          key={each ? 'each' : 'once'}
          title={each ? plans('edit', { name: names.assets[buying.id].name }) : amount('buy', { name: names.assets[buying.id].name })}
          max={each ? planMax(p.cash, preview.income.salary) : p.cash}
          start={each ? (planned?.amount ?? 0) : 0}
          onClose={() => setBuying(null)}
          onConfirm={(a) =>
            each
              ? setOrder(isPlanFor(buying.id), planOrder(view, buying.id, a))
              : addOrder(geared && margin?.lock === null && margin.canDouble ? { type: 'buy', assetId: buying.id, amount: a, margin: a } : { type: 'buy', assetId: buying.id, amount: a })
          }
          footer={
            each || !margin ? null : (
              <section aria-label={plans('marginTitle')} className="mt-3 border-t-2 border-night-900 pt-3">
                <Toggle
                  on={geared && margin.lock === null && margin.canDouble}
                  onChange={setGeared}
                  disabled={margin.lock !== null || !margin.canDouble}
                  label={plans('margin')}
                  hint={plans('marginHint', { rate: fmt.rate(margin.rateBp) })}
                />
                <p className={`mt-1.5 text-[12px] leading-snug ${margin.lock !== null || !margin.canDouble ? 'text-gold-200' : 'text-ink-300'}`}>
                  {margin.lock === 'needs-finance-skill'
                    ? plans('marginSkill', { level: margin.minSkill })
                    : margin.lock !== null
                      ? text.reasons[margin.lock]
                      : !margin.canDouble
                        ? plans('marginFull', { pct: margin.maxPct })
                        : plans('marginRisk', { call: margin.callPct, drop: 100 - Math.ceil((margin.maxPct * 100) / margin.callPct) })}
                </p>
              </section>
            )
          }
        >
          <div className="mb-3">
            <Segmented<'once' | 'each'>
              label={plans('how')}
              value={each ? 'each' : 'once'}
              onChange={(how) => setEach(how === 'each')}
              options={[
                { value: 'once', label: plans('once'), hint: plans('onceHint') },
                { value: 'each', label: plans('each'), hint: plans('eachHint') },
              ]}
            />
          </div>
          {each ? <p className="mb-2 text-[13px] leading-snug text-ink-200">{planned ? plans('already', { amount: fmt.money(planned.amount) }) : plans('editHint')}</p> : null}
          <p className="mb-2 text-[14px] text-ink-200">{text.assets[buying.id].blurb}</p>
          <Sparkline values={priceHistory(view, buying.id)} label={t('history')} />
          <div className="mb-3 mt-1 flex justify-between text-[12px] text-ink-300">
            <span>{t('history')}</span>
            {Object.hasOwn(p.positions, buying.id) ? <span>{t('youHold', { amount: fmt.money(p.positions[buying.id].value) })}</span> : null}
          </div>
        </AmountSheet>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Property

function BuyHome({ typeId, onClose }: { typeId: string; onClose(): void }) {
  const t = useT('finance.property');
  const common = useT('common');
  const words = useWords();
  const { content, text, fmt } = words;
  const { shown } = useRound();
  const addOrder = useGame((s) => s.addOrder);
  const quote = quoteProperty(content, shown, typeId);
  const [mortgage, setMortgage] = useState<'fixed' | 'variable' | 'none'>(quote.canBorrow ? 'fixed' : 'none');
  const [down, setDown] = useState(quote.minDown);
  // What nobody can live in is bought to let, and there is nothing to choose.
  const [rented, setRented] = useState(quote.letOnly);
  const cashDown = mortgage === 'none' ? quote.price : down;
  const step = Math.max(100_000, Math.round(quote.price / 100 / 100_000) * 100_000);

  return (
    <Sheet open onClose={onClose} title={t(quote.letOnly ? 'buyLetTitle' : 'buyTitle', { home: text.propertyTypes[typeId] })} closeLabel={common('close')}>
      <div className="flex flex-col gap-3">
        <div className="flex justify-center">
          <Bare className="p-1 leading-[0]">
            <Sprite id={propertyArt(typeId)} fallback={{ w: 128, h: 128 }} />
          </Bare>
        </div>
        <Panel>
          <Row left={t('price')} right={fmt.money(quote.price)} />
          <Row left={t('purchaseTax')} right={fmt.money(quote.purchaseTax)} />
          {rented ? <Row left={t('rent')} right={<span className="text-teal-300">{fmt.signed(quote.rentAnnual)}</span>} /> : null}
        </Panel>

        <div>
          <h3 className="pixel mb-1.5 text-[14px] uppercase tracking-wider text-ink-200">{t('mortgage')}</h3>
          <Segmented<'fixed' | 'variable' | 'none'>
            label={t('mortgage')}
            value={mortgage}
            onChange={setMortgage}
            options={[
              { value: 'fixed', label: t('fixed'), hint: t('rateNow', { rate: fmt.rate(quote.fixedRateBp) }), disabled: !quote.canBorrow },
              { value: 'variable', label: t('variable'), hint: t('rateNow', { rate: fmt.rate(quote.variableRateBp) }), disabled: !quote.canBorrow },
              { value: 'none', label: t('noMortgage') },
            ]}
          />
        </div>

        {mortgage === 'none' ? null : (
          <div>
            <div className="flex items-baseline justify-between">
              <h3 className="pixel text-[14px] uppercase tracking-wider text-ink-200">{t('down')}</h3>
              <span className="pixel text-[17px]">{fmt.money(down)}</span>
            </div>
            <input
              type="range"
              className="range"
              aria-label={t('down')}
              min={quote.minDown}
              max={quote.price - 1}
              step={step}
              value={down}
              onChange={(event) => setDown(Math.max(quote.minDown, Math.min(quote.price - 1, Number(event.target.value))))}
            />
          </div>
        )}

        {quote.letOnly ? null : (
          <div>
            <h3 className="pixel mb-1.5 text-[14px] uppercase tracking-wider text-ink-200">{t('use')}</h3>
            <Segmented<'live' | 'rent'>
              label={t('use')}
              value={rented ? 'rent' : 'live'}
              onChange={(value) => setRented(value === 'rent')}
              options={[
                { value: 'live', label: t('liveIn') },
                { value: 'rent', label: t('rentOut'), disabled: !quote.canRentOut },
              ]}
            />
          </div>
        )}
        {quote.canRentOut ? null : <p className="text-[13px] text-ink-200">{t('rentOutLocked', { level: content.life.rentOutMinFinanceSkill })}</p>}

        <p className="pixel text-center text-[17px] text-gold-500">{t('payNow', { amount: fmt.money(cashDown + quote.purchaseTax) })}</p>
        <Button
          variant="primary"
          wide
          // Something only a landlord can own is not for sale to anyone else: the line above says why.
          disabled={quote.letOnly && !quote.canRentOut}
          onClick={() => {
            if (addOrder({ type: 'buyProperty', typeId, downPayment: mortgage === 'none' ? 0 : down, mortgage, rented })) onClose();
          }}
        >
          {t('buy')}
        </Button>
      </div>
    </Sheet>
  );
}

/** One property the player owns, looked at closely: what it is worth, what it brings, what is owed on it and what a sale would leave. */
function OwnedPropertySheet({ propertyId, onClose }: { propertyId: string; onClose(): void }) {
  const t = useT('finance.property');
  const debt = useT('finance.debt');
  const common = useT('common');
  const { content, text, names, fmt } = useWords();
  const { shown, p } = useRound();
  const property = p.properties.find((x) => x.id === propertyId);
  const quote = quoteOwnedProperty(content, shown, propertyId);
  // Sold while its sheet was open: there is nothing left to show.
  if (!property || !quote) return null;
  const gain = quote.value - quote.paid;

  return (
    <Sheet open onClose={onClose} title={text.propertyTypes[property.typeId]} closeLabel={common('close')}>
      <div className="flex flex-col gap-3">
        <div className="flex justify-center">
          <Bare className="p-1 leading-[0]">
            <Sprite id={propertyArt(property.typeId)} fallback={{ w: 128, h: 128 }} />
          </Bare>
        </div>
        <p className="pixel text-center text-[13px] uppercase tracking-wider text-ink-300">{names.cities[property.cityId]}</p>
        <div className="flex flex-wrap justify-center gap-1.5">
          <Tag tone={quote.rented || quote.livedIn ? 'good' : 'plain'}>{quote.rented ? t('rented') : quote.livedIn ? t('livedIn') : t('empty')}</Tag>
          {quote.livedIn && quote.status > 0 ? <Tag tone="good">{t('status', { n: quote.status })}</Tag> : null}
        </div>

        <Panel>
          <Row left={t('worth')} right={<span className="text-gold-500">{fmt.money(quote.value)}</span>} />
          <Row left={t('paid')} right={fmt.money(quote.paid)} />
          <Row left={t('gain')} right={<span className={gain < 0 ? 'text-wine-300' : 'text-teal-300'}>{fmt.signed(gain)}</span>} />
          {quote.letOnly || quote.rented ? (
            <Row left={t('rent')} right={<span className="text-teal-300">{fmt.signed(quote.rentAnnual)}</span>} />
          ) : (
            <Row left={t('wouldLet')} right={fmt.money(quote.rentAnnual)} />
          )}
        </Panel>

        <Panel title={t('mortgage')}>
          {quote.mortgage ? (
            <>
              <Row left={t('owed')} right={<span className="text-wine-300">{fmt.money(quote.mortgage.principal)}</span>} />
              <Row left={quote.mortgage.variable ? t('variable') : t('fixed')} right={t('rateNow', { rate: fmt.rate(quote.mortgage.rateBp) })} />
              <Row left={t('term')} right={<span className="font-sans text-[13px]">{debt('left', { rounds: quote.mortgage.roundsLeft })}</span>} />
            </>
          ) : (
            <p className="text-[14px] text-ink-300">{t('ownedOutright')}</p>
          )}
        </Panel>

        <div>
          <Row
            className="frame bg-night-700 px-3"
            left={<span className="pixel text-[16px]">{t('netOnSale')}</span>}
            right={<span className="text-[18px] text-gold-500">{fmt.money(quote.netOnSale)}</span>}
          />
          <p className="mt-1.5 text-center text-[12px] text-ink-300">{t('netOnSaleHint')}</p>
        </div>
      </div>
    </Sheet>
  );
}

function PropertyTab() {
  const t = useT('finance.property');
  const { content, text, names, fmt } = useWords();
  const { view, shown, p } = useRound();
  const setOrder = useGame((s) => s.setOrder);
  const addOrder = useGame((s) => s.addOrder);
  const [buying, setBuying] = useState<string | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  const home = homeOf(p, content);

  // A home put up for sale this round stays in its place until the round is played: were it to
  // vanish, the next one would slide under the thumb that just pressed "Sell".
  const selling = view.player.properties.filter((before) => !p.properties.some((now) => now.id === before.id));
  const listed = [...view.player.properties.map((before) => p.properties.find((now) => now.id === before.id) ?? before), ...p.properties.filter((now) => !view.player.properties.some((before) => before.id === now.id))];

  return (
    <div className="flex flex-col gap-3">
      <Panel title={t('owned')} label={t('owned')}>
        {listed.length === 0 ? <p className="text-[14px] text-ink-300">{t('ownedNone')}</p> : null}
        {listed.map((property) => {
          const original = view.player.properties.find((x) => x.id === property.id);
          const sold = selling.some((x) => x.id === property.id);
          const mortgage = (sold ? view.player.debts : p.debts).find((d) => d.id === property.mortgageId);
          // Which home the player lives in is the engine's to say: it is one, however many they own in town.
          const state = property.rented ? t('rented') : home?.id === property.id ? t('livedIn') : t('empty');
          const same = (order: Order) => order.type === 'setRented' && order.propertyId === property.id;
          // Whether it can be lived in is the engine's to say, like its price.
          const letOnly = quoteProperty(content, shown, property.typeId).letOnly;
          // What a year of letting it brings is the engine's figure, shown for what is let now.
          const rent = property.rented ? quoteOwnedProperty(content, shown, property.id)?.rentAnnual : undefined;
          return (
            <div key={property.id} className="border-b-2 border-night-900 py-2 last:border-b-0">
              {/* A tap on the home itself opens everything about it. What can be done with it stays on the buttons below. */}
              <button type="button" aria-haspopup="dialog" disabled={sold} onClick={() => setOpened(property.id)} className="flex w-full items-center gap-3 text-left">
                <Bare className="shrink-0">
                  <Sprite id={propertyArt(property.typeId)} fallback={{ w: 128, h: 128 }} />
                </Bare>
                <span className="min-w-0 flex-1">
                  <span className="pixel block text-[17px]">{text.propertyTypes[property.typeId]}</span>
                  <span className="block text-[13px] text-ink-200">{names.cities[property.cityId]}</span>
                  <span className="pixel mt-1 block text-[17px] text-gold-500">{fmt.money(property.value)}</span>
                  {rent !== undefined ? <span className="pixel block text-[14px] text-teal-300">{t('rentYear', { amount: fmt.money(rent) })}</span> : null}
                  <span className="mt-1 block text-[12px] text-ink-300">
                    {state}
                    {mortgage ? ` · ${t('mortgageLeft', { amount: fmt.money(mortgage.principal) })}` : ''}
                  </span>
                </span>
              </button>
              {sold ? (
                <Button className="mt-2" wide disabled>
                  {t('selling')}
                </Button>
              ) : original ? (
                <div className={`mt-2 grid gap-2 ${letOnly ? '' : 'grid-cols-2'}`}>
                  {/* What nobody can live in is let for as long as it is owned: there is nothing to switch. */}
                  {letOnly ? null : (
                    <Button onClick={() => setOrder(same, original.rented === !property.rented ? null : { type: 'setRented', propertyId: property.id, rented: !property.rented })}>
                      {property.rented ? t('stopRenting') : t('startRenting')}
                    </Button>
                  )}
                  <Button variant="danger" onClick={() => addOrder({ type: 'sellProperty', propertyId: property.id })}>
                    {t('sell', { amount: fmt.compact(property.value) })}
                  </Button>
                </div>
              ) : null}
            </div>
          );
        })}
      </Panel>

      {opened ? <OwnedPropertySheet propertyId={opened} onClose={() => setOpened(null)} /> : null}

      {/* Somewhere to live, and what is only bought to let: two shelves, each with its cheapest first. */}
      {([false, true] as const).map((letOnly) => {
        const title = t(letOnly ? 'letTitle' : 'title', { city: names.cities[p.cityId] });
        return (
          <Panel key={String(letOnly)} title={title} label={title}>
            {/* Two side by side on a phone, each drawn whole at its own size; more where the column is wider. */}
            <div className="grid grid-cols-2 gap-2 @min-[560px]:grid-cols-3">
              {content.propertyTypes.map((type) => {
                const quote = quoteProperty(content, shown, type.id);
                if (quote.letOnly !== letOnly) return null;
                return (
                  <button key={type.id} type="button" onClick={() => setBuying(type.id)} className={TILE}>
                    <Bare className="w-full py-1">
                      <Sprite id={propertyArt(type.id)} fallback={{ w: 128, h: 128 }} />
                    </Bare>
                    <span className="mt-0.5 text-[14px] leading-tight">{text.propertyTypes[type.id]}</span>
                    <span className="pixel text-[18px] text-gold-500">{fmt.compact(quote.price)}</span>
                    <span className="text-[11px] leading-tight text-ink-200">{t('minDown', { amount: fmt.compact(quote.minDown + quote.purchaseTax) })}</span>
                    {/* A home says what living in it is worth; what cannot be lived in says what it lets for. */}
                    {quote.letOnly ? <span className="text-[12px] leading-tight text-teal-300">{t('lets', { amount: fmt.compact(quote.rentAnnual) })}</span> : <Tag tone="good">{t('status', { n: type.status })}</Tag>}
                  </button>
                );
              })}
            </div>
          </Panel>
        );
      })}
      {buying ? <BuyHome typeId={buying} onClose={() => setBuying(null)} /> : null}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Debt

function DebtTab() {
  const t = useT('finance.debt');
  const amount = useT('finance.amount');
  const words = useWords();
  const { content, fmt } = words;
  const { shown, p, world } = useRound();
  const addOrder = useGame((s) => s.addOrder);
  const [repaying, setRepaying] = useState<Debt | null>(null);
  const [borrowing, setBorrowing] = useState(false);
  const loan = quoteLoan(content, shown);
  let total = 0;
  for (const debt of p.debts) total += debt.principal;

  return (
    <div className="flex flex-col gap-3">
      <Panel>
        {p.debts.length === 0 ? <p className="text-[14px] text-ink-300">{t('none')}</p> : <Row left={t('total')} right={fmt.money(total)} />}
        {p.debts.map((debt) => (
          <div key={debt.id} className="flex items-center gap-3 border-t-2 border-night-900 py-2">
            <div className="min-w-0 flex-1">
              <div className="truncate">{debtLabel(words, debt, p.properties)}</div>
              <div className="text-[12px] text-ink-300">
                {t('rate', { rate: fmt.rate(debtRateBp(debt, content, world, p)) })} · {t('left', { rounds: debt.kind === 'creditCard' ? 0 : debt.roundsLeft })}
              </div>
            </div>
            <div className="pixel">{fmt.money(debt.principal)}</div>
            <Button onClick={() => setRepaying(debt)} disabled={p.cash <= 0}>
              {t('repay')}
            </Button>
          </div>
        ))}
      </Panel>

      <Panel>
        {loan.lockedUntilRound !== null ? (
          <p className="text-[14px] text-wine-300">{t('noCredit', { age: ageAt(content, loan.lockedUntilRound) })}</p>
        ) : loan.room <= 0 ? (
          <p className="text-[14px] text-ink-300">{t('borrowNone')}</p>
        ) : (
          <>
            <p className="mb-2 text-[14px] text-ink-200">
              {t('borrowHint', { amount: fmt.money(loan.room), rate: fmt.rate(loan.rateBp), years: loan.termRounds * content.yearsPerRound })}
            </p>
            <Button wide onClick={() => setBorrowing(true)}>
              {t('borrow')}
            </Button>
          </>
        )}
      </Panel>

      {repaying ? (
        <AmountSheet
          title={amount('repay', { name: debtLabel(words, repaying, p.properties) })}
          max={Math.min(repaying.principal, p.cash)}
          onClose={() => setRepaying(null)}
          onConfirm={(a) => addOrder({ type: 'repay', debtId: repaying.id, amount: a })}
        />
      ) : null}
      {borrowing ? <AmountSheet title={amount('borrow')} max={loan.room} onClose={() => setBorrowing(false)} onConfirm={(a) => addOrder({ type: 'borrow', amount: a })} /> : null}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Lifestyle

/** One line of a year in a city: what it is here, and what it would be there, the better of the two in green. */
function Versus({ label, here, there, more = 'better', strong = false }: { label: string; here: number; there?: number; more?: 'better' | 'worse'; strong?: boolean }) {
  const { fmt } = useWords();
  const gain = there === undefined ? 0 : more === 'better' ? there - here : here - there;
  const tone = gain > 0 ? 'text-teal-300' : gain < 0 ? 'text-wine-300' : '';
  return (
    <div className={`flex items-baseline justify-between gap-2 py-1 ${strong ? 'border-t-2 border-night-900 pt-1.5' : ''}`}>
      <span className={`min-w-0 truncate ${strong ? 'pixel' : 'text-[14px]'}`}>{label}</span>
      <span className="pixel shrink-0 text-right text-[15px]">
        {there === undefined ? (
          fmt.money(here)
        ) : (
          <>
            <span className="text-ink-300">{fmt.compact(here)}</span>
            <span aria-hidden className="mx-1 text-ink-300">
              →
            </span>
            <span className={tone}>{fmt.compact(there)}</span>
          </>
        )}
      </span>
    </div>
  );
}

/**
 * Every city, and for each the player's own year there beside the year they have: pay, tax, costs
 * and what is left, as the move would leave them. All of it is the engine's quote.
 */
function MoveSheet({ onClose }: { onClose(): void }) {
  const t = useT('finance.lifestyle');
  const common = useT('common');
  const { content, text, names, fmt } = useWords();
  const { shown, p, world } = useRound();
  const setOrder = useGame((s) => s.setOrder);
  const job = p.life.career;
  const years = content.yearsPerRound;

  return (
    <Sheet open onClose={onClose} title={t('moveTitle')} closeLabel={common('close')}>
      <div className="flex flex-col gap-3">
        <p className="text-[13px] leading-snug text-ink-200">{t('moveAbout')}</p>
        {content.cities.map((city) => {
          const here = city.id === p.cityId;
          const tax = effectiveTax(city, world);
          const quote = quoteMove(content, shown, city.id);
          const { here: now, there } = quote;
          const trades = Object.entries(city.careerPayPct ?? {});
          return (
            <Panel key={city.id} label={names.cities[city.id]}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="pixel flex min-w-0 items-center gap-2 text-[17px]">
                  <Sprite id={cityIcon(city.id)} />
                  {names.cities[city.id]}
                </h3>
                {here ? <Tag tone="good">{t('here')}</Tag> : null}
              </div>
              <p className="mb-1.5 text-[13px] text-ink-300">{text.cities[city.id].tagline}</p>
              <div className="mb-1.5 flex flex-wrap gap-1.5">
                <Tag tone="good">{t('cityStatus', { n: city.prestige })}</Tag>
                {/* The trades the city pays above the usual. The player's own stands out. */}
                {trades.map(([career, pct]) => (
                  <Tag key={career} tone={job?.id === career ? 'good' : 'plain'}>
                    {t('cityTrade', { career: text.careers[career].name, pct: pct - 100 })}
                  </Tag>
                ))}
              </div>

              {here ? null : (
                <div className="flex justify-end gap-2 text-[11px] uppercase tracking-wider text-ink-300">
                  <span>{t('yearHere')}</span>
                  <span aria-hidden>→</span>
                  <span>{t('yearThere')}</span>
                </div>
              )}
              <Versus label={t('yourPay')} here={now.payAnnual} there={here ? undefined : there.payAnnual} />
              {now.partnerAnnual > 0 || there.partnerAnnual > 0 ? <Versus label={t('partnerPay')} here={now.partnerAnnual} there={here ? undefined : there.partnerAnnual} /> : null}
              <Versus label={t('incomeTax')} here={now.taxAnnual} there={here ? undefined : there.taxAnnual} more="worse" />
              <Versus label={t('costs')} here={now.costAnnual} there={here ? undefined : there.costAnnual} more="worse" />
              <Versus strong label={t('left')} here={now.leftAnnual} there={here ? undefined : there.leftAnnual} />
              <p className="mt-1 text-[12px] text-ink-300">
                {t('taxRates', { income: tax.incomeRatesBp.map((rate) => fmt.rate(rate)).join(' · '), gains: fmt.rate(tax.capitalGainsBp) })}
              </p>

              {here ? null : (
                <>
                  <ul className="my-2 flex flex-col gap-1 text-[13px] leading-snug">
                    <li>{t('moveCost', { amount: fmt.money(quote.cost) })}</li>
                    {job && quote.rungsLost > 0 && there.level !== null ? (
                      <li className="text-wine-300">{t('moveRung', { title: text.careers[job.id].levels[there.level] })}</li>
                    ) : null}
                    {quote.partnerIdleRounds > 0 ? <li className="text-wine-300">{t('movePartner', { years: quote.partnerIdleRounds * years })}</li> : null}
                    {/* Said before the move is ordered: what belongs to this city does not come along. */}
                    {quote.lapses.length > 0 ? <li className="text-wine-300">{t('moveLapses', { items: quote.lapses.map((id) => names.items[id]).join(', ') })}</li> : null}
                  </ul>
                  <Button
                    wide
                    onClick={() => {
                      if (setOrder((order) => order.type === 'moveCity', { type: 'moveCity', cityId: city.id })) onClose();
                    }}
                  >
                    {t('moveHere')}
                  </Button>
                </>
              )}
            </Panel>
          );
        })}
      </div>
    </Sheet>
  );
}

function Lifestyle() {
  const t = useT('finance.lifestyle');
  const { content, text, names, fmt } = useWords();
  const { view, shown, p } = useRound();
  const orders = useGame((s) => s.orders);
  const setOrder = useGame((s) => s.setOrder);
  const [moving, setMoving] = useState(false);
  const living = quoteLiving(content, shown);
  const career = p.life.career ? content.careers.find((c) => c.id === p.life.career?.id) : undefined;
  const has = (action: FocusAction) => orders.some((order) => order.type === 'focus' && order.action === action);
  const focus = (action: FocusAction) => (on: boolean) =>
    setOrder((order) => order.type === 'focus' && order.action === action, on ? { type: 'focus', action } : null);
  const left = focusLeft(p);
  // What each use of focus is worth to this player, counting what they own.
  const work = quoteWork(content, shown);
  const moveOrdered = orders.some((order) => order.type === 'moveCity');
  const common = useT('common');
  const perYear = (cents: number) => common('perYear', { amount: fmt.compact(cents) });

  return (
    <div className="flex flex-col gap-3">
      <Panel title={t('work')}>
        {career ? (
          <div className="flex flex-col gap-2">
            <p className="text-[13px] text-ink-300">{t('focusLeft', { left, total: work.focus.total })}</p>
            <Toggle on={has('overtime')} onChange={focus('overtime')} disabled={!has('overtime') && left < 1} label={t('overtime')} hint={t('overtimeHint', { pct: career.overtimePct })} icon={focusArt.overtime} />
            <Toggle on={has('studyCareer')} onChange={focus('studyCareer')} disabled={!has('studyCareer') && left < 1} label={t('study')} hint={t('studyHint', { n: work.studySkill })} icon={focusArt.studyCareer} />
            <Toggle on={has('jobHunt')} onChange={focus('jobHunt')} disabled={!has('jobHunt') && left < 1} label={t('hunt')} hint={t('huntHint', { pct: work.jobHuntChancePct })} icon={focusArt.jobHunt} />
          </div>
        ) : (
          <p className="text-[14px] text-ink-300">{t('noJob')}</p>
        )}
      </Panel>

      <Panel title={t('tier')}>
        <Segmented<LifestyleTier>
          label={t('tier')}
          value={p.lifestyleTier}
          onChange={(tier) => setOrder((order) => order.type === 'setLifestyle', tier === view.player.lifestyleTier ? null : { type: 'setLifestyle', tier })}
          options={([0, 1, 2, 3] as const).map((tier) => ({
            value: tier,
            label: text.lifestyleTiers[tier],
            icon: lifestyleArt[tier],
            hint: perYear(living.tiers[tier]),
            disabled: tier < p.life.minLifestyleTier,
          }))}
        />
        <p className="mt-2 text-[12px] text-ink-300">
          {t('tierStatus')} {text.lifestyleTiers.map((name, tier) => `${name} ${points(content.life.lifestyleStatus[tier])}`).join(' · ')}
        </p>
        {p.life.minLifestyleTier > 0 ? <p className="mt-2 text-[12px] text-ink-300">{t('tierFloor')}</p> : null}
      </Panel>

      <Panel title={t('home')}>
        {living.rentTiers ? (
          <>
          <Segmented<RentTier>
            label={t('home')}
            value={p.life.rentTier}
            onChange={(tier) => setOrder((order) => order.type === 'setRentTier', tier === view.player.life.rentTier ? null : { type: 'setRentTier', tier })}
            options={([0, 1] as const).map((tier) => ({ value: tier, label: text.rentTiers[tier], icon: rentTierIcon[tier], hint: perYear(living.rentTiers?.[tier] ?? 0) }))}
          />
          <p className="mt-2 text-[12px] text-ink-300">
            {t('tierStatus')} {text.rentTiers.map((name, tier) => `${name} ${points(living.rentStatus[tier])}`).join(' · ')}
            {living.roomLateFromRound !== null ? ` · ${t('roomLate', { age: ageAt(content, living.roomLateFromRound), n: -living.roomLateStatus })}` : ''}
          </p>
          </>
        ) : (
          <p className="text-[14px] text-ink-300">{t('ownerNote')}</p>
        )}
      </Panel>

      <Panel title={t('insurance')}>
        <div className="flex flex-col gap-2">
          {INSURANCES.map((kind) => (
            <Toggle
              key={kind}
              on={p.life.insurance[kind]}
              onChange={(on) =>
                setOrder((order) => order.type === 'setInsurance' && order.insurance === kind, on === view.player.life.insurance[kind] ? null : { type: 'setInsurance', insurance: kind, on })
              }
              label={text.insurance[kind]}
              icon={insuranceArt[kind]}
              hint={common('perYear', { amount: fmt.money(living.insurance[kind]) })}
            />
          ))}
        </div>
      </Panel>

      <Panel title={t('city')}>
        <div className="mb-2 flex items-center gap-3">
          <Bare className="size-9">
            <Sprite id={cityIcon(p.cityId)} />
          </Bare>
          <div className="min-w-0">
            <div className="pixel text-[18px]">{names.cities[p.cityId]}</div>
            <p className="text-[13px] leading-snug text-ink-200">{text.cities[p.cityId].tagline}</p>
          </div>
        </div>
        {p.life.movingTo ? (
          <>
            <p className="mb-2 text-[14px] text-gold-500">{t('moving', { city: names.cities[p.life.movingTo] })}</p>
            {moveOrdered ? (
              <Button wide onClick={() => setOrder((order) => order.type === 'moveCity', null)}>
                {t('stay')}
              </Button>
            ) : null}
          </>
        ) : (
          <Button wide onClick={() => setMoving(true)}>
            <Sprite id="icon.move" className="-my-1" />
            {t('move')}
          </Button>
        )}
      </Panel>
      {moving ? <MoveSheet onClose={() => setMoving(false)} /> : null}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Shop

/** Status points with their sign: +3, −3, 0. */
const points = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

function ItemSheet({ item, onClose }: { item: ItemDef; onClose(): void }) {
  const t = useT('finance.shop');
  const common = useT('common');
  const { content, text, names, fmt } = useWords();
  const { shown, p } = useRound();
  const orders = useGame((s) => s.orders);
  const addOrder = useGame((s) => s.addOrder);
  const setOrder = useGame((s) => s.setOrder);
  const quote = quoteItem(content, shown, item.id);
  const plan = quote.finance;
  const held = p.life.items.find((owned) => owned.itemId === item.id);
  const inBasket = orders.some((order) => order.type === 'buyItem' && order.itemId === item.id);
  const years = content.yearsPerRound;
  const done = (ok: boolean) => {
    if (ok) onClose();
  };

  return (
    <Sheet open onClose={onClose} title={names.items[item.id]} closeLabel={common('close')}>
      <div className="flex flex-col gap-3">
        <div className="flex justify-center">
          <Bare className="p-2 leading-[0]">
            <Sprite id={itemArt(item.id)} scale={2} fallback={{ w: 64, h: 64 }} />
          </Bare>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5">
          <Tag tone="good">{t('status', { n: quote.status })}</Tag>
          {quote.status < quote.statusNew ? <Tag>{t('statusWas', { n: quote.statusNew })}</Tag> : null}
          {quote.upkeepAnnual > 0 ? <Tag tone="bad">{t('upkeep', { amount: fmt.money(quote.upkeepAnnual) })}</Tag> : null}
          {item.kind === 'experience' ? <Tag>{t('lasts', { years: item.boostRounds * years })}</Tag> : null}
        </div>
        <ItemUses item={item} />
        {quote.ages ? <p className="text-center text-[13px] text-ink-300">{t(quote.status < quote.statusNew ? 'aged' : 'ages')}</p> : null}
        {quote.local ? <p className="text-center text-[13px] text-ink-300">{t('local', { city: names.cities[p.cityId] })}</p> : null}
        {item.kind === 'durable' && !held && quote.forSale ? <p className="text-center text-[13px] text-ink-300">{t('resale', { amount: fmt.money(quote.resale) })}</p> : null}
        <ItemCost quote={quote} />

        {inBasket ? (
          <Button wide onClick={() => done(setOrder((order) => order.type === 'buyItem' && order.itemId === item.id, null))}>
            {common('cancel')}
          </Button>
        ) : held ? (
          quote.sellable ? (
            <Button variant="danger" wide onClick={() => done(addOrder({ type: 'sellItem', itemId: item.id }))}>
              {item.kind === 'membership' ? t('cancel') : t('sell', { amount: fmt.money(held.value) })}
            </Button>
          ) : held.roundsLeft !== null ? (
            <p className="text-center text-[14px] text-ink-300">{t('spent', { years: held.roundsLeft * years })}</p>
          ) : (
            // What only life can give, a degree for one, is not the player's to sell.
            <p className="text-center text-[14px] text-ink-300">{t('cardOnly')}</p>
          )
        ) : quote.forSale ? (
          <>
            <Button variant="primary" wide onClick={() => done(addOrder({ type: 'buyItem', itemId: item.id }))}>
              {t('buy', { amount: fmt.money(quote.price) })}
            </Button>
            {plan ? (
              <div className="flex flex-col gap-1.5">
                <Button wide disabled={plan.lock !== null} onClick={() => done(addOrder({ type: 'buyItem', itemId: item.id, financed: true }))}>
                  {t('finance', { amount: fmt.money(plan.down) })}
                </Button>
                {plan.lock !== null ? (
                  <p className="text-center text-[13px] text-wine-300">{text.reasons[plan.lock]}</p>
                ) : (
                  <p className="text-center text-[13px] text-ink-300">
                    {t('financeTerms', { loan: fmt.money(plan.loan), rate: fmt.rate(plan.rateBp), years: plan.termRounds * years, annual: fmt.money(plan.annual) })} {t('financeKept')}
                  </p>
                )}
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-center text-[14px] text-ink-300">{t('cardOnly')}</p>
        )}
      </div>
    </Sheet>
  );
}

function Shop() {
  const t = useT('finance.shop');
  const { content, text, names, fmt } = useWords();
  const { shown, p } = useRound();
  const [open, setOpen] = useState<ItemDef | null>(null);
  const ladders = [...new Set(content.items.map((item) => item.ladder))];

  return (
    <div className="flex flex-col gap-3">
      {ladders.map((ladder) => (
        <Panel key={ladder} title={text.ladders[ladder]}>
          <div className="grid grid-cols-2 gap-2">
            {content.items
              // The shelf of a city holds what that city sells: what is sold only elsewhere is not shown at all.
              .filter((item) => item.ladder === ladder && quoteItem(content, shown, item.id).soldHere)
              .map((item) => {
                const owned = p.life.items.some((x) => x.itemId === item.id);
                return (
                  // What is already owned wears a gold edge, so the shelf shows at a glance what is left to want.
                  <button key={item.id} type="button" onClick={() => setOpen(item)} className={`${TILE} ${owned ? 'frame-gold' : ''}`}>
                    <Bare className="w-full py-1.5">
                      <Sprite id={itemArt(item.id)} fallback={{ w: 64, h: 64 }} />
                    </Bare>
                    <span className="mt-0.5 line-clamp-2 min-h-[2.4em] text-[13px] leading-tight">{names.items[item.id]}</span>
                    <span className={`pixel text-[16px] ${owned ? 'text-teal-300' : 'text-gold-500'}`}>{owned ? t('owned') : fmt.compact(quoteItem(content, shown, item.id).price)}</span>
                    <Tag tone="good">{t('status', { n: quoteItem(content, shown, item.id).status })}</Tag>
                  </button>
                );
              })}
          </div>
        </Panel>
      ))}
      {open ? <ItemSheet item={open} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Taxes: the round as it will resolve

function Taxes() {
  const t = useT('finance.taxes');
  const { text, fmt } = useWords();
  const { preview, p } = useRound();
  const line = (label: ReactNode, amount: number, key: string) => (amount === 0 ? null : <Row key={key} left={label} right={fmt.signed(amount)} />);
  const { income, expenses, tax, escape } = preview;

  return (
    <div className="flex flex-col gap-3">
      <Panel title={t('income')}>
        {line(text.ledger.salary, income.salary, 'salary')}
        {line(text.ledger.dividends, income.dividends, 'dividends')}
        {line(text.ledger.interest, income.interest, 'interest')}
        {line(text.ledger.rent, income.rent, 'rent')}
        {line(text.ledger.otherPassive, income.otherPassive, 'other')}
      </Panel>
      <Panel title={t('expenses')}>
        {line(text.ledger.living, -expenses.living, 'living')}
        {line(text.ledger.otherExpenses, -expenses.other, 'other')}
        {line(text.ledger.debtInterest, -expenses.debtInterest, 'interest')}
        {line(text.ledger.debtPrincipal, -expenses.debtPrincipal, 'principal')}
      </Panel>
      <Panel title={t('tax')}>
        <Row left={t('incomeTax')} right={fmt.signed(-tax.income)} />
        <Row left={t('investmentTax')} right={fmt.signed(-tax.investment)} />
        <Row left={t('propertyTax')} right={fmt.signed(-tax.property)} />
        {preview.purchaseTaxPaid > 0 ? <Row left={t('purchaseTax')} right={fmt.signed(-preview.purchaseTaxPaid)} /> : null}
      </Panel>
      <Panel>
        <Row left={t('cashNow')} right={fmt.money(p.cash)} />
        <Row left={<span className="pixel text-[17px]">{t('cashAfter')}</span>} right={<span className={`text-[19px] ${preview.cashAfter < 0 ? 'text-wine-300' : 'text-gold-500'}`}>{fmt.money(preview.cashAfter)}</span>} />
        {preview.cashAfter < 0 ? <p className="mt-1 text-[13px] text-wine-300">{t('shortfall')}</p> : null}
        <p className="mt-2 text-[12px] text-ink-300">{t('exact')}</p>
      </Panel>
      <Panel title={t('escapeTitle')}>
        <div className="mb-1.5 flex justify-between text-[14px]">
          <span className="pixel">{fmt.money(escape.passiveAfterTax)}</span>
          <span className="pixel text-ink-300">{fmt.money(escape.outgoings)}</span>
        </div>
        <Bar value={escape.passiveAfterTax} max={escape.outgoings} label={t('escapeTitle')} />
        <p className="mt-2 text-[12px] text-ink-300">{t('escapeHint')}</p>
      </Panel>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------

/**
 * The orders of the round so far, in the order they will run, each removable. A move already
 * decided on a card heads the list: it happens with the round like the rest, and cannot be undone.
 */
export function BasketList() {
  const t = useT('finance');
  const labels = useT('orders');
  const words = useWords();
  const view = useGame((s) => s.view);
  const orders = useGame((s) => s.orders);
  const removeOrder = useGame((s) => s.removeOrder);
  if (!view) return null;
  const moving = view.player.life.movingTo;
  if (orders.length === 0 && !moving) return <p className="py-1 text-[14px] text-ink-300">{t('basketEmpty')}</p>;

  return (
    <ol aria-label={t('basketTitle')} className="flex flex-col gap-2">
      {moving ? (
        <li className="frame flex min-h-11 items-center justify-between gap-3 bg-night-600 px-3 py-1">
          <span className="flex min-w-0 items-center gap-2">
            <Sprite id={cityIcon(moving)} />
            <span className="min-w-0 truncate">{labels('move', { city: words.names.cities[moving] })}</span>
          </span>
          <Tag>{t('decided')}</Tag>
        </li>
      ) : null}
      {orders.map((order, i) => {
        const label = orderLabel(words, labels, view.player, order);
        return (
          <li key={i} className="frame flex items-center justify-between gap-3 bg-night-600 py-1 pl-3 pr-1">
            <span className="min-w-0 truncate">{label}</span>
            <button type="button" onClick={() => removeOrder(i)} aria-label={`${t('remove')}: ${label}`} className="pixel flex size-11 shrink-0 items-center justify-center text-[18px] text-wine-300">
              ✕
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** The orders of the round in a sheet, for a phone. */
export function Basket({ onClose }: { onClose(): void }) {
  const t = useT('finance');
  const common = useT('common');
  return (
    <Sheet open onClose={onClose} title={t('basketTitle')} closeLabel={common('close')}>
      <BasketList />
    </Sheet>
  );
}

/** The finance phase: seven tabs over one basket of orders. */
export function Finance() {
  const t = useT('finance');
  const { text } = useWords();
  const refusal = useGame((s) => s.refusal);
  const clearRefusal = useGame((s) => s.clearRefusal);
  const alsoRemoved = useGame((s) => s.alsoRemoved);
  const clearAlsoRemoved = useGame((s) => s.clearAlsoRemoved);
  const [tab, setTab] = useState<TabId>('portfolio');
  const ids = useId();

  return (
    <div>
      <div className="sticky top-0 z-10 bg-night-800">
        <Tabs<TabId> label={t('tabsLabel')} idPrefix={ids} tabs={TABS.map((id) => ({ id, label: t(`tabs.${id}`) }))} value={tab} onChange={setTab} />
      </div>
      <div role="tabpanel" id={`${ids}-panel-${tab}`} aria-labelledby={`${ids}-tab-${tab}`} className="px-3 pt-1">
        {tab === 'portfolio' ? <Portfolio /> : null}
        {tab === 'market' ? <Market /> : null}
        {tab === 'property' ? <PropertyTab /> : null}
        {tab === 'debt' ? <DebtTab /> : null}
        {tab === 'lifestyle' ? <Lifestyle /> : null}
        {tab === 'shop' ? <Shop /> : null}
        {tab === 'taxes' ? <Taxes /> : null}
      </div>
      <Toast message={refusal ? `${t('refused')}: ${text.reasons[refusal]}` : null} onDone={clearRefusal} />
      {/* Taking one order out can take others with it; that must not happen without a word. */}
      <Toast message={alsoRemoved > 0 && !refusal ? t('alsoRemoved', { count: alsoRemoved }) : null} onDone={clearAlsoRemoved} ms={4_000} />
    </div>
  );
}
