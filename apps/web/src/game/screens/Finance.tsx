'use client';

import { START_AGE, assetKind, assetLogo, cityIcon, crestArt, debtArt, focusArt, homeName, insuranceArt, itemArt, lifestyleArt, propertyArt, rentTierIcon, USED_ART, saleSignArt } from '@ratrace/content';
import type { AssetKind } from '@ratrace/content';
import { assetYieldBp, debtRateBp, depositRateBp, effectiveTax, focusLeft, homeOf, quoteItem, quoteLiving, quoteLoan, quoteMargin, quoteMove, quoteOwnedProperty, quotePlans, quotePortfolio, quoteProperty, quoteSkills, quoteWork, workModeOf, indexed, mortgageSwitch } from '@ratrace/engine';
import type { AssetDef, CityDef, Debt, FocusAction, GameView, WorkMode, InsuranceKind, ItemDef, ItemQuote, LifestyleTier, Order, RentTier, UsedQuote } from '@ratrace/engine';
import { useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useGame, useGuided, useIntroducesTabs, useT, useWords } from '@/game/context';
import { TAB_FROM_ROUND } from '@/game/guide';
import { ageAt, debtLabel, headlineText, loanPlan, orderLabel, priceHistory } from '@/game/present';
import { Bar, Bare, Button, Panel, Row, Segmented, Tag, TickerBadge, TILE, Toggle } from '@/ui/kit';
import { useKeyboardScope } from '@/ui/keyboard';
import { Sheet, Tabs, Toast } from '@/ui/overlay';
import { HealthCoverNote } from './HealthCover';
import { Sparks } from '@/ui/Sparks';
import { Sprite } from '@/ui/Sprite';
import { AmountSheet } from './AmountSheet';
import { BusinessTab } from './Business';
import { Payouts, PortfolioGlance } from './Glance';
import { useShown } from './Hud';
import { ItemCost } from './ItemCost';
import { EvasionPanel } from './Evasion';
import { ItemUses } from './ItemUses';
import { masteredLast, useFocusNote } from './focusNote';

type TabId = 'portfolio' | 'market' | 'property' | 'business' | 'debt' | 'lifestyle' | 'shop' | 'taxes';
type ShopView = 'affordable' | 'all';
const TABS: TabId[] = ['portfolio', 'market', 'property', 'business', 'debt', 'lifestyle', 'shop', 'taxes'];
const KINDS: AssetKind[] = ['fund', 'bond', 'stock', 'crypto', 'gold'];
const KIND_TITLE: Record<AssetKind, string> = { fund: 'funds', bond: 'bonds', stock: 'stocks', crypto: 'crypto', gold: 'gold' };
const INSURANCES: InsuranceKind[] = ['health', 'home', 'life'];

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
  const [buying, setBuying] = useState<AssetDef | null>(null);
  const held = content.assets.filter((asset) => Object.hasOwn(p.positions, asset.id));
  // The most the pension takes this round, from the engine: its cap, the cash there is, and solvency.
  const pensionRoom = preview.pensionRoom;
  // What can be sold this round: what is held once the orders so far have run, without what a plan buys after them.
  // A plan buys when the round is played, after every order: the order cannot sell what it has not bought yet.
  const planned = (assetId: string): number => {
    let amount = 0;
    for (const run of preview.plans) if (run.assetId === assetId && run.reason === null) amount += run.amount;
    return amount;
  };
  const sellable = (assetId: string): number => Math.max(0, (p.positions[assetId]?.value ?? 0) - planned(assetId));

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
        max={sellable(move.asset.id)}
        onClose={close}
        onConfirm={(a) => addOrder({ type: 'sell', assetId: move.asset.id, amount: a })}
      />
    );
  })();

  const dividends = new Map(quotePortfolio(content, shown).dividends.map((paid) => [paid.assetId, paid.amount]));

  return (
    <div className="flex flex-col gap-3">
      <PortfolioGlance />
      {/* Cash, savings and the pension, a line each, with what can be done to each beside it: nothing that cannot be done is shown. */}
      <Panel>
        <Row left={t('cash')} sub={t('cashHint')} right={fmt.money(p.cash)} />
        <div className="flex items-center gap-2 border-t-2 border-night-900 py-1.5">
          <div className="min-w-0 flex-1">
            <Row left={t('savings')} sub={t('savingsRate', { rate: fmt.rate(depositRateBp(content, world)) })} right={fmt.money(p.deposit)} />
          </div>
          {p.cash > 0 ? (
            <Button className="shrink-0 px-2 text-[13px]" onClick={() => setMove({ kind: 'save' })}>
              {t('save')}
            </Button>
          ) : null}
          {p.deposit > 0 ? (
            <Button className="shrink-0 px-2 text-[13px]" onClick={() => setMove({ kind: 'withdraw' })}>
              {t('withdraw')}
            </Button>
          ) : null}
        </div>
        <div className="flex items-center gap-2 border-t-2 border-night-900 pt-1.5">
          <div className="min-w-0 flex-1">
            <Row left={t('pension')} sub={t('pensionHint')} right={fmt.money(p.pension)} />
          </div>
          {pensionRoom > 0 ? (
            <Button className="shrink-0 px-2 text-[13px]" onClick={() => setMove({ kind: 'pension' })}>
              {t('add')}
            </Button>
          ) : null}
        </div>
      </Panel>

      <Panel title={t('holdings')} label={t('holdings')}>
        {held.length === 0 ? <p className="text-[14px] text-ink-300">{t('none')}</p> : null}
        {held.map((asset) => {
          const position = p.positions[asset.id];
          const gain = position.value - position.basis;
          return (
            <div key={asset.id} className="flex items-center gap-3 py-1.5">
              {/* The holding opens the same sheet as the market: to buy more of it, once or every round. */}
              <button type="button" data-finance-item onClick={() => setBuying(asset)} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left">
              <AssetMark asset={asset} />
              <div className="min-w-0 flex-1">
                <div className="truncate">{names.assets[asset.id].name}</div>
                <div className={`text-[12px] ${gain >= 0 ? 'text-teal-300' : 'text-wine-300'}`}>
                  {t(gain >= 0 ? 'gain' : 'loss', { amount: fmt.money(Math.abs(gain)) })}
                </div>
                {dividends.has(asset.id) ? <div className="text-[12px] text-ink-300">{t('pays', { amount: fmt.money(dividends.get(asset.id) ?? 0) })}</div> : null}
                <MarginLine assetId={asset.id} />
                {/* What a plan buys is on the line already, but it is bought only as the round is played. */}
                {planned(asset.id) > 0 ? <div className="text-[12px] text-sky-300">{t('planBuys', { amount: fmt.money(planned(asset.id)) })}</div> : null}
              </div>
              <div className="pixel text-right">{fmt.money(position.value)}</div>
              </button>
              <Button onClick={() => setMove({ kind: 'sell', asset })} disabled={sellable(asset.id) <= 0}>
                {t('sell')}
              </Button>
            </div>
          );
        })}
      </Panel>
      <Payouts />
      <Plans />
      {sheet}
      {buying ? <BuySheet asset={buying} onClose={() => setBuying(null)} /> : null}
    </div>
  );
}

/**
 * An asset by its mark, answering the orders of the round: bought, it jumps and throws gold sparks;
 * sold, it shrinks and comes back. Each new order plays it again; what was ordered before the list
 * was opened plays nothing.
 */
function AssetMark({ asset }: { asset: AssetDef }) {
  const { names } = useWords();
  const orders = useGame((s) => s.orders);
  const mine = orders.filter((order) => (order.type === 'buy' || order.type === 'sell') && order.assetId === asset.id);
  const [before] = useState(mine.length);
  const last = mine.length > before ? mine[mine.length - 1].type : null;
  return (
    <span key={mine.length} className={`relative inline-flex ${last === 'buy' ? 'animate-pop' : last === 'sell' ? 'animate-sink' : ''}`}>
      <TickerBadge ticker={names.assets[asset.id].ticker} kind={asset.class} logo={assetLogo[asset.id]} />
      {last === 'buy' ? <Sparks colours={['bg-gold-500', 'bg-gold-200', 'bg-cream']} count={8} reach={26} /> : null}
    </span>
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
              <button type="button" data-finance-item aria-haspopup="dialog" onClick={() => setEditing(plan.assetId)} className="flex min-h-11 w-full items-center gap-3 py-2 text-left">
                <TickerBadge ticker={names.assets[plan.assetId].ticker} kind={content.assets.find((asset) => asset.id === plan.assetId)?.class ?? 'equity'} logo={assetLogo[plan.assetId]} />
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

/**
 * The price of an asset since the start of the life, read at a glance: a line of its price round by
 * round over a dashed line where it started, green above it and red below, the change since then in
 * big type, and the ages along the bottom. A round of rise or fall is a dot on the line.
 */
function PriceChart({ values, label }: { values: number[]; label: string }) {
  const t = useT('finance.market');
  const { content } = useWords();
  const w = 280;
  const h = 90;
  const pad = 6;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 1);
  const span = max - min || 1;
  const x = (i: number) => (values.length > 1 ? pad + (i * (w - pad * 2)) / (values.length - 1) : w / 2);
  const y = (value: number) => pad + (1 - (value - min) / span) * (h - pad * 2);
  const last = values[values.length - 1] ?? 1;
  const change = Math.round((last - 1) * 100);
  const up = last >= 1;
  const tone = up ? 'var(--color-teal-300)' : 'var(--color-wine-300)';
  const line = values.map((value, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(value).toFixed(1)}`).join(' ');
  const base = y(1);
  const area = `${line} L${x(values.length - 1).toFixed(1)} ${base.toFixed(1)} L${x(0).toFixed(1)} ${base.toFixed(1)} Z`;
  const ageAtRound = (round: number) => START_AGE + round * content.yearsPerRound;
  return (
    <figure className="frame bg-night-900 px-2 pb-1.5 pt-2">
      <figcaption className="flex items-baseline justify-between gap-2 px-1">
        <span className="text-[12px] text-ink-300">{t('sinceStart')}</span>
        <span className="pixel text-[20px] leading-none" style={{ color: tone }}>
          {change > 0 ? '+' : ''}
          {change}%
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className="mt-1 block w-full">
        <path d={area} fill={tone} opacity="0.15" />
        <line x1={pad} x2={w - pad} y1={base} y2={base} stroke="var(--color-ink-500)" strokeWidth="1" strokeDasharray="3 3" />
        <path d={line} fill="none" stroke={tone} strokeWidth="2" strokeLinejoin="round" />
        <circle cx={x(values.length - 1)} cy={y(last)} r="3.5" fill={tone} />
      </svg>
      <div className="flex justify-between px-1 text-[11px] text-ink-300">
        <span>{ageAtRound(0)}</span>
        <span>{ageAtRound(values.length - 1)}</span>
      </div>
    </figure>
  );
}

function Market() {
  const t = useT('finance.market');
  const { content, names, fmt } = useWords();
  const { view, p, world, shown } = useRound();
  const [buying, setBuying] = useState<AssetDef | null>(null);

  return (
    <div className="flex flex-col gap-3">
      {/* What needs more Finance than the player has is not on the market at all; a class with nothing open is left out. */}
      {KINDS.filter((kind) => content.assets.some((asset) => assetKind(asset) === kind && (asset.minFinanceSkill ?? 0) <= p.life.financeSkill)).map((kind) => (
        <Panel key={kind} title={t(KIND_TITLE[kind])}>
          {content.assets
            .filter((asset) => assetKind(asset) === kind && (asset.minFinanceSkill ?? 0) <= p.life.financeSkill)
            .map((asset) => {
              const change = world.assetReturnBp[asset.id];
              const pays = assetYieldBp(asset, world);
              // A standing plan shows where the asset is listed: what it buys each round.
              const plan = shown.player.plans.find((x) => x.assetId === asset.id);
              return (
                <button
                  key={asset.id}
                  type="button"
                  data-finance-item
                  onClick={() => setBuying(asset)}
                  className="flex min-h-11 w-full items-center gap-3 py-1.5 text-left"
                >
                  <AssetMark asset={asset} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{names.assets[asset.id].name}</span>
                    <span className="block text-[12px] text-ink-300">
                      {pays > 0 ? t('yield', { rate: fmt.rate(pays) }) : plan ? null : ' '}
                      {plan ? <span className="text-teal-300">{`${pays > 0 ? ' · ' : ''}${t('planned', { amount: fmt.compact(plan.amount) })}`}</span> : null}
                    </span>
                  </span>
                  <span className={`pixel text-right ${view.round === 0 ? 'text-ink-300' : change >= 0 ? 'text-teal-300' : 'text-wine-300'}`}>
                    {view.round === 0 ? '—' : fmt.change(change)}
                  </span>
                </button>
              );
            })}
        </Panel>
      ))}

      {buying ? <BuySheet asset={buying} onClose={() => setBuying(null)} /> : null}
    </div>
  );
}

/**
 * Buying an asset: once, or every round, and with borrowed money where the player may. Opened from
 * the market, and from a holding in the portfolio, to buy more of it.
 */
function BuySheet({ asset, onClose }: { asset: AssetDef; onClose(): void }) {
  const t = useT('finance.market');
  const amount = useT('finance.amount');
  const plans = useT('finance.plans');
  const { content, text, names, fmt } = useWords();
  const { view, p, shown, preview } = useRound();
  const addOrder = useGame((s) => s.addOrder);
  const setOrder = useGame((s) => s.setOrder);
  // The same sheet buys once or sets what is bought every round.
  const [each, setEach] = useState(false);
  // Bought once, it may be bought with as much again borrowed from the broker.
  const [geared, setGeared] = useState(false);
  const margin = quoteMargin(content, shown, asset.id);
  const planned = shown.player.plans.find((plan) => plan.assetId === asset.id);

  return (
    <AmountSheet
      // A new sheet for each way of buying: the amount starts over, and so does what it can be.
      key={each ? 'each' : 'once'}
      title={each ? plans('edit', { name: names.assets[asset.id].name }) : amount('buy', { name: names.assets[asset.id].name })}
      max={each ? planMax(p.cash, preview.income.salary) : p.cash}
      start={each ? (planned?.amount ?? 0) : 0}
      onClose={onClose}
      onConfirm={(a) =>
        each
          ? setOrder(isPlanFor(asset.id), planOrder(view, asset.id, a))
          : addOrder(geared && margin?.lock === null && margin.canDouble ? { type: 'buy', assetId: asset.id, amount: a, margin: a } : { type: 'buy', assetId: asset.id, amount: a })
      }
      footer={
        // Margin is not spoken of until the player has the skill for it: a closed switch teaches nothing to someone years from it.
        each || !margin || margin.lock === 'needs-finance-skill' ? null : (
          <section aria-label={plans('marginTitle')} className="mt-3 border-t-2 border-night-900 pt-3">
            <Toggle
              on={geared && margin.lock === null && margin.canDouble}
              onChange={setGeared}
              disabled={margin.lock !== null || !margin.canDouble}
              label={plans('margin')}
              hint={plans('marginHint', { rate: fmt.rate(margin.rateBp) })}
            />
            <p className={`mt-1.5 text-[12px] leading-snug ${margin.lock !== null || !margin.canDouble ? 'text-gold-200' : 'text-ink-300'}`}>
              {margin.lock !== null
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
      <p className="mb-2 text-[14px] text-ink-200">{text.assets[asset.id].blurb}</p>
      <PriceChart values={priceHistory(view, asset.id)} label={t('history')} />
      {Object.hasOwn(p.positions, asset.id) ? <p className="mb-3 mt-1 text-right text-[12px] text-ink-300">{t('youHold', { amount: fmt.money(p.positions[asset.id].value) })}</p> : <div className="mb-3" />}
    </AmountSheet>
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
    <Sheet open onClose={onClose} title={t(quote.letOnly ? 'buyLetTitle' : 'buyTitle', { home: homeName(text, typeId, shown.player.cityId) })} closeLabel={common('close')}>
      <div className="flex flex-col gap-3">
        <div className="flex justify-center">
          <Bare className="p-1 leading-[0]">
            <Sprite id={propertyArt(typeId, shown.player.cityId)} fallback={{ w: 128, h: 128 }} />
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

        {/* Letting it out takes Finance: without it, it is a home to live in, and nothing is said of letting. */}
        {quote.letOnly || !quote.canRentOut ? null : (
          <div>
            <h3 className="pixel mb-1.5 text-[14px] uppercase tracking-wider text-ink-200">{t('use')}</h3>
            <Segmented<'live' | 'rent'>
              label={t('use')}
              value={rented ? 'rent' : 'live'}
              onChange={(value) => setRented(value === 'rent')}
              options={[
                { value: 'live', label: t('liveIn') },
                { value: 'rent', label: t('rentOut') },
              ]}
            />
          </div>
        )}

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
    <Sheet open onClose={onClose} title={homeName(text, property.typeId, property.cityId)} closeLabel={common('close')}>
      <div className="flex flex-col gap-3">
        <div className="flex justify-center">
          <Bare className="p-1 leading-[0]">
            <Sprite id={propertyArt(property.typeId, property.cityId)} fallback={{ w: 128, h: 128 }} />
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
            left={
              <span className="pixel flex items-center gap-2 text-[16px]">
                <Sprite id={saleSignArt(property.cityId)} className="!h-8 !w-8" />
                {t('netOnSale')}
              </span>
            }
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
          const owned = quoteOwnedProperty(content, shown, property.id);
          const rent = property.rented ? owned?.rentAnnual : undefined;
          const lodger = sold ? null : (owned?.lodger ?? null);
          const lodging = (order: Order) => order.type === 'setLodger';
          return (
            <div key={property.id} className="border-b-2 border-night-900 py-2 last:border-b-0">
              {/* A tap on the home itself opens everything about it. What can be done with it stays on the buttons below. */}
              <button type="button" data-finance-item aria-haspopup="dialog" disabled={sold} onClick={() => setOpened(property.id)} className="flex w-full items-center gap-3 text-left">
                <Bare className="shrink-0">
                  <Sprite id={propertyArt(property.typeId, property.cityId)} fallback={{ w: 128, h: 128 }} />
                </Bare>
                <span className="min-w-0 flex-1">
                  <span className="pixel block text-[17px]">{homeName(text, property.typeId, property.cityId)}</span>
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
                  <Sprite id={saleSignArt(property.cityId)} className="!h-8 !w-8" />
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
              {/* The home lived in, with a room to spare: it can take a lodger. */}
              {lodger ? (
                <div className="mt-2">
                  <Toggle
                    on={lodger.on}
                    onChange={(on) => setOrder(lodging, on === view.player.life.lodger ? null : { type: 'setLodger', on })}
                    label={t('lodger')}
                    hint={t('lodgerHint', { amount: fmt.money(lodger.annual), status: lodger.statusLost })}
                    icon="icon.rent_room"
                  />
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
        // What can only be let is offered only to someone with the Finance to let it: without it, that shelf is not there.
        const tiles = content.propertyTypes
          .map((type) => ({ type, quote: quoteProperty(content, shown, type.id) }))
          .filter(({ quote }) => quote.letOnly === letOnly && (!quote.letOnly || quote.canRentOut));
        if (tiles.length === 0) return null;
        return (
          <Panel key={String(letOnly)} title={title} label={title}>
            {/* Two side by side on a phone, each drawn whole at its own size; more where the column is wider. */}
            <div className="grid grid-cols-2 gap-2 @min-[560px]:grid-cols-3">
              {tiles.map(({ type, quote }) => {
                return (
                  <button key={type.id} type="button" data-finance-item onClick={() => setBuying(type.id)} className={TILE}>
                    <Bare className="w-full py-1">
                      <Sprite id={propertyArt(type.id, p.cityId)} fallback={{ w: 128, h: 128 }} />
                    </Bare>
                    <span className="mt-0.5 text-[14px] leading-tight">{homeName(text, type.id, p.cityId)}</span>
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
  const [switching, setSwitching] = useState<string | null>(null);
  const loan = quoteLoan(content, shown);
  let total = 0;
  for (const debt of p.debts) total += debt.principal;

  return (
    <div className="flex flex-col gap-3">
      <Panel>
        {p.debts.length === 0 ? <p className="text-[14px] text-ink-300">{t('none')}</p> : <Row left={t('total')} right={fmt.money(total)} />}
        {p.debts.map((debt) => (
          <div key={debt.id} className="flex items-center gap-3 border-t-2 border-night-900 py-2">
            <Bare className="size-8">
              <Sprite id={debtArt(debt)} />
            </Bare>
            <div className="min-w-0 flex-1">
              <div className="truncate">{debtLabel(words, debt, p.properties)}</div>
              <div className="text-[12px] text-ink-300">
                {t('rate', { rate: fmt.rate(debtRateBp(debt, content, world, p)) })} · {t('left', { rounds: debt.kind === 'creditCard' ? 0 : debt.roundsLeft })}
              </div>
              {/* A mortgage can be switched between fixed and variable: said under it, opened in a sheet. Not while it rests from the last switch. */}
              <SwitchLink debtId={debt.id} onOpen={() => setSwitching(debt.id)} />
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

      {switching ? <SwitchSheet debtId={switching} onClose={() => setSwitching(null)} /> : null}
      {repaying ? (
        <AmountSheet
          title={amount('repay', { name: debtLabel(words, repaying, p.properties) })}
          max={Math.min(repaying.principal, p.cash)}
          onClose={() => setRepaying(null)}
          onConfirm={(a) => addOrder({ type: 'repay', debtId: repaying.id, amount: a })}
        />
      ) : null}
      {borrowing ? (
        <AmountSheet
          title={amount('borrow')}
          max={loan.room}
          onClose={() => setBorrowing(false)}
          onConfirm={(a) => addOrder({ type: 'borrow', amount: a })}
          preview={(a) => {
            const plan = loanPlan(a, loan.rateBp, loan.termRounds, content.yearsPerRound);
            return (
              <div className="border-y-2 border-night-900 py-1">
                {/* One figure a round, the average: the first is a little more and the last a little less. */}
                <Row left={t('perRound')} right={fmt.money(Math.round((a + plan.interest) / plan.payments.length))} />
                <Row left={t('repayTotal')} sub={t('interestPart', { interest: fmt.money(plan.interest), rate: fmt.rate(loan.rateBp) })} right={<span className="text-wine-300">{fmt.money(a + plan.interest)}</span>} />
              </div>
            );
          }}
        />
      ) : null}
    </div>
  );
}

/** The way into switching a mortgage: what it would become, or that it is being switched this round. Nothing while it may not be switched. */
function SwitchLink({ debtId, onOpen }: { debtId: string; onOpen(): void }) {
  const t = useT('finance.debt');
  const { content } = useWords();
  const { view, world } = useRound();
  const orders = useGame((s) => s.orders);
  const ordered = orders.some((order) => order.type === 'switchMortgage' && order.debtId === debtId);
  const quote = mortgageSwitch(view.player, debtId, content, world, view.round);
  if (quote === null || (quote.lock === 'switch-resting' && !ordered)) return null;
  return (
    <button type="button" onClick={onOpen} className={`mt-0.5 text-[12px] underline underline-offset-2 ${ordered ? 'text-teal-300' : 'text-sky-300'}`}>
      {ordered ? t(quote.to === 'fixed' ? 'switchingToFixed' : 'switchingToVariable') : t(quote.to === 'fixed' ? 'switchToFixed' : 'switchToVariable')}
    </button>
  );
}

/**
 * Switching one mortgage between fixed and variable, made plain: what it means, the rate before and
 * after, the interest of a year each way, the fee, what the paper says of rates, and how long until
 * it can be switched again.
 */
function SwitchSheet({ debtId, onClose }: { debtId: string; onClose(): void }) {
  const t = useT('finance.debt');
  const common = useT('common');
  const words = useWords();
  const { content, fmt } = words;
  const { view, world } = useRound();
  const orders = useGame((s) => s.orders);
  const setOrder = useGame((s) => s.setOrder);
  const debt = view.player.debts.find((d) => d.id === debtId);
  const quote = mortgageSwitch(view.player, debtId, content, world, view.round);
  if (!debt || quote === null) return null;
  const same = (order: Order) => order.type === 'switchMortgage' && order.debtId === debtId;
  const ordered = orders.some(same);
  const toFixed = quote.to === 'fixed';
  const yearly = (bp: number) => Math.round((debt.principal * bp) / 10_000);
  const rates = world.news.find((h) => h.topic === 'rates');
  return (
    <Sheet open onClose={onClose} title={t(toFixed ? 'switchTitleFixed' : 'switchTitleVariable')} closeLabel={common('close')}>
      <div className="flex flex-col gap-2">
        <p className="text-[14px] leading-snug text-ink-200">{debtLabel(words, debt, view.player.properties)}</p>
        <p className="text-[13px] leading-snug text-ink-200">{t(toFixed ? 'switchAboutFixed' : 'switchAboutVariable')}</p>
        <Row left={t('switchRate')} right={`${fmt.rate(quote.rateNowBp)} → ${fmt.rate(quote.rateAfterBp)}`} />
        <Row left={t('switchInterest')} right={`${fmt.money(yearly(quote.rateNowBp))} → ${fmt.money(yearly(quote.rateAfterBp))}`} />
        <Row left={t('switchFee', { pct: toFixed ? content.debt.switchFeePct.toFixed : content.debt.switchFeePct.toVariable })} right={<span className="text-wine-300">{fmt.money(quote.fee)}</span>} />
        {/* What the paper of the round says of rates, if it says anything: the one hint there is of where they go. */}
        {rates ? <p className="text-[12px] italic leading-snug text-ink-300">{t('switchPaper', { headline: headlineText(words, rates, view.round) })}</p> : null}
        <p className="text-[12px] leading-snug text-ink-300">{t('switchRest', { rounds: content.debt.switchRestRounds })}</p>
        {quote.lock === 'not-enough-cash' && !ordered ? (
          <p className="text-[13px] text-wine-300">{words.text.reasons['not-enough-cash']}</p>
        ) : (
          <Button
            variant={ordered ? undefined : 'primary'}
            wide
            onClick={() => {
              setOrder(same, ordered ? null : { type: 'switchMortgage', debtId });
              onClose();
            }}
          >
            {ordered ? t('switchUndo') : t('switchDo', { fee: fmt.money(quote.fee) })}
          </Button>
        )}
      </div>
    </Sheet>
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
  const { shown, p } = useRound();
  const job = p.life.career;
  // One city at a time in full; the list is short, a row a city.
  const [chosen, setChosen] = useState<string | null>(null);
  const quotes = content.cities.map((city) => ({ city, quote: quoteMove(content, shown, city.id) }));
  const here = quotes.find((entry) => entry.city.id === p.cityId);
  // Where the year leaves the most first, the city lived in at the top.
  const others = quotes.filter((entry) => entry.city.id !== p.cityId).sort((a, b) => b.quote.there.leftAnnual - a.quote.there.leftAnnual);
  const open = chosen ? quotes.find((entry) => entry.city.id === chosen) : undefined;

  return (
    <Sheet open onClose={onClose} title={open ? names.cities[open.city.id] : t('moveTitle')} closeLabel={common('close')}>
      {open ? (
        <CityDetail city={open.city} quote={open.quote} onBack={() => setChosen(null)} onMoved={onClose} />
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] leading-snug text-ink-200">{t('moveAbout', { level: content.life.skills.languagesKeepRungFrom })}</p>
          <div className="flex justify-end text-[11px] uppercase tracking-wider text-ink-300">{t('left')}</div>
          <ul className="flex flex-col gap-1.5">
            {[...(here ? [here] : []), ...others].map(({ city, quote }) => {
              const home = city.id === p.cityId;
              const best = job !== null && (city.careerPayPct?.[job.id] ?? 100) > 100;
              const gain = quote.there.leftAnnual - quote.here.leftAnnual;
              return (
                <li key={city.id}>
                  <button
                    type="button"
                    data-finance-item
                    onClick={() => setChosen(city.id)}
                    className={`frame-raised flex min-h-12 w-full items-center gap-2 bg-night-600 px-2 py-1.5 text-left ${home ? 'frame-gold' : ''}`}
                  >
                    <Bare className="size-9">
                      <Sprite id={crestArt(city.id)} fallback={{ w: 64, h: 64 }} className="!h-full !w-full" />
                    </Bare>
                    <span className="min-w-0 flex-1">
                      <span className="pixel block truncate text-[16px]">{names.cities[city.id]}</span>
                      <span className="flex flex-wrap gap-1">
                        {home ? <Tag tone="good">{t('here')}</Tag> : null}
                        {best && job ? <Tag tone="plain">{t('bestForJob', { career: text.careers[job.id].name })}</Tag> : null}
                      </span>
                    </span>
                    <span className={`pixel shrink-0 text-right text-[16px] ${home ? '' : gain > 0 ? 'text-teal-300' : gain < 0 ? 'text-wine-300' : ''}`}>
                      {fmt.compact(home ? quote.here.leftAnnual : quote.there.leftAnnual)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Sheet>
  );
}

/**
 * One city in full: what it is, what the year would leave there beside here, and the figures behind
 * that folded away until asked for; then what a move costs, and the move itself.
 */
function CityDetail({ city, quote, onBack, onMoved }: { city: CityDef; quote: ReturnType<typeof quoteMove>; onBack(): void; onMoved(): void }) {
  const t = useT('finance.lifestyle');
  const { content, text, names, fmt } = useWords();
  const { p, world } = useRound();
  const setOrder = useGame((s) => s.setOrder);
  const [numbers, setNumbers] = useState(false);
  const job = p.life.career;
  const years = content.yearsPerRound;
  const here = city.id === p.cityId;
  const tax = effectiveTax(city, world);
  const { here: now, there } = quote;
  const trades = Object.entries(city.careerPayPct ?? {});

  return (
    <section aria-label={names.cities[city.id]} className="flex flex-col gap-2">
      <Button variant="quiet" className="self-start text-[14px]" onClick={onBack}>
        {t('allCities')}
      </Button>
      <div className="flex items-center gap-2">
        <Sprite id={crestArt(city.id)} fallback={{ w: 64, h: 64 }} />
        <div className="min-w-0">
          {here ? <Tag tone="good">{t('here')}</Tag> : null}
          <p className="text-[13px] leading-snug text-ink-300">{text.cities[city.id].tagline}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
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
      <Versus strong label={t('left')} here={now.leftAnnual} there={here ? undefined : there.leftAnnual} />
      <Button variant="quiet" className="text-[14px]" aria-expanded={numbers} onClick={() => setNumbers((shown) => !shown)}>
        {t(numbers ? 'hideNumbers' : 'showNumbers')}
      </Button>
      {numbers ? (
        <div>
          <Versus label={t('yourPay')} here={now.payAnnual} there={here ? undefined : there.payAnnual} />
          {now.partnerAnnual > 0 || there.partnerAnnual > 0 ? <Versus label={t('partnerPay')} here={now.partnerAnnual} there={here ? undefined : there.partnerAnnual} /> : null}
          <Versus label={t('incomeTax')} here={now.taxAnnual} there={here ? undefined : there.taxAnnual} more="worse" />
          <Versus label={t('costs')} here={now.costAnnual} there={here ? undefined : there.costAnnual} more="worse" />
          <p className="mt-1 text-[12px] text-ink-300">
            {t('taxRates', { income: tax.incomeRatesBp.map((rate) => fmt.rate(rate)).join(' · '), gains: fmt.rate(tax.capitalGainsBp) })}
          </p>
        </div>
      ) : null}

      {here ? null : (
        <>
          <ul className="my-1 flex flex-col gap-1 text-[13px] leading-snug">
            <li>{t('moveCost', { amount: fmt.money(quote.cost) })}</li>
            {/* Going home: what is waiting there, said before the move is ordered. */}
            {quote.home ? <li className="text-teal-300">{t(quote.home.helped ? 'homeHelped' : 'homeBack')}</li> : null}
            {job && quote.rungsLost > 0 && there.level !== null ? <li className="text-wine-300">{t('moveRung', { title: text.careers[job.id].levels[there.level] })}</li> : null}
            {quote.partnerIdleRounds > 0 ? <li className="text-wine-300">{t('movePartner', { years: quote.partnerIdleRounds * years })}</li> : null}
            {/* Said before the move is ordered: what belongs to this city does not come along. */}
            {quote.lapses.length > 0 ? <li className="text-wine-300">{t('moveLapses', { items: quote.lapses.map((id) => names.items[id]).join(', ') })}</li> : null}
          </ul>
          <Button
            wide
            onClick={() => {
              if (setOrder((order) => order.type === 'moveCity', { type: 'moveCity', cityId: city.id })) onMoved();
            }}
          >
            {t('moveHere')}
          </Button>
        </>
      )}
    </section>
  );
}

function Lifestyle() {
  const t = useT('finance.lifestyle');
  const wording = useT('work');
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
  const skills = quoteSkills(content, shown);
  const note = useFocusNote();
  const jobUses = career
    ? ([
        ['overtime', t('overtime'), t('overtimeHint', { pct: career.overtimePct })],
        ['studyCareer', t('study'), t('studyHint', { n: work.studySkill })],
        ['jobHunt', t('hunt'), t('huntHint', { pct: work.jobHuntChancePct })],
        ['askRaise', t('raise'), t('raiseHint', { chance: work.raise.chancePct, pct: work.raise.pct })],
      ] as const).map(([action, label, gives]) => ({ action, label, note: note(work, action, gives) }))
    : [];
  const learnUses = masteredLast([
    { action: skills.finance.study, label: text.focusActions[skills.finance.study], note: note(work, skills.finance.study, t('learnHint', { n: skills.finance.studyPoints, skill: wording('finance'), level: skills.finance.level })) },
    ...skills.skills.flatMap((skill) =>
      skill.study === null ? [] : [{ action: skill.study, label: text.focusActions[skill.study], note: note(work, skill.study, t('learnHint', { n: skill.studyPoints, skill: text.skills[skill.skill], level: skill.level })) }],
    ),
  ]);
  const moveOrdered = orders.some((order) => order.type === 'moveCity');
  const common = useT('common');
  const perYear = (cents: number) => common('perYear', { amount: fmt.compact(cents) });

  return (
    <div className="flex flex-col gap-3">
      {/* How the job is done, apart from the focus: half the day anywhere, and from home where the job allows it, a few rungs up. */}
      {career ? (
        <Panel title={t('mode')}>
          <div className="flex flex-col gap-2">
            <Segmented<WorkMode>
              label={t('mode')}
              value={work.workMode.current}
              onChange={(mode) => setOrder((order) => order.type === 'setWorkMode', mode === workModeOf(view.player, content) ? null : { type: 'setWorkMode', mode })}
              options={(['office', 'remote', 'partTime'] as const)
                .filter((mode) => mode !== 'remote' || work.workMode.remote)
                .map((mode) => ({ value: mode, label: t(mode) }))}
            />
            <p className="-mt-1 text-[12px] text-ink-300">
              {work.workMode.current === 'office'
                ? t('officeHint')
                : work.workMode.current === 'remote'
                  ? t('remoteHint', { focus: work.workMode.rules.remote.focus, hunt: work.workMode.rules.remote.huntOffPct })
                  : t('partTimeHint', { focus: work.workMode.rules.partTime.focus, pay: work.workMode.rules.partTime.payPct })}
            </p>
          </div>
        </Panel>
      ) : null}

      <Panel title={t('work')}>
        {career ? (
          <div className="flex flex-col gap-2">
            <p className="text-[13px] text-ink-300">{t('focusLeft', { left, total: work.focus.total })}</p>
            {jobUses.map((use) => (
              <Toggle key={use.action} on={has(use.action)} onChange={focus(use.action)} disabled={!has(use.action) && (left < 1 || use.note.locked)} label={use.label} hint={use.note.hint} icon={focusArt[use.action]} />
            ))}
          </div>
        ) : work.backToWork ? (
          // Left for a business: the way back, a rung lower.
          <div className="flex flex-col gap-1.5">
            <Button
              variant={orders.some((order) => order.type === 'backToWork') ? 'primary' : undefined}
              onClick={() => setOrder((order) => order.type === 'backToWork', orders.some((order) => order.type === 'backToWork') ? null : { type: 'backToWork' })}
            >
              {t('back', { job: text.careers[work.backToWork.careerId].levels[work.backToWork.level] })}
            </Button>
            <p className="text-[12px] leading-snug text-ink-300">{t('backHint')}</p>
          </div>
        ) : (
          <p className="text-[14px] text-ink-300">{t('noJob')}</p>
        )}
      </Panel>


      {/* Skills of one's own: each a point of focus, and no job needed. What is mastered goes last, and is closed. */}
      <Panel title={t('learn')} label={t('learn')}>
        <div className="flex flex-col gap-2">
          <p className="text-[13px] text-ink-300">{t('learnAbout')}</p>
          {learnUses.map((use) => (
            <Toggle key={use.action} on={has(use.action)} onChange={focus(use.action)} disabled={!has(use.action) && (left < 1 || use.note.locked)} label={use.label} hint={use.note.hint} icon={focusArt[use.action]} />
          ))}
        </div>
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
          {t('tierStatus')} {text.lifestyleTiers.map((name, tier) => `${name} ${points(living.lifestyleStatus[tier])}`).join(' · ')}
          {living.worse.frugal ? ` · ${t('frugalLate', { age: ageAt(content, living.worse.frugal.fromRound), n: -living.worse.frugal.status })}` : ''}
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
            {living.worse.room ? ` · ${t('roomLate', { age: ageAt(content, living.worse.room.fromRound), n: -living.worse.room.status })}` : ''}
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
              disabled={kind === 'health' && living.health.refused && !p.life.insurance.health}
              label={text.insurance[kind]}
              icon={insuranceArt[kind]}
              hint={common('perYear', { amount: fmt.money(living.insurance[kind]) })}
            />
          ))}
          <HealthCoverNote living={living} />
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

/**
 * The same thing second hand, set off by a rule under the new one: what it costs, what it gives at
 * its age, and the repairs that may come. Paid in cash only.
 */
function SecondHand({ used, onBought }: { used: UsedQuote; onBought(): void }) {
  const t = useT('finance.shop');
  const { content, text, fmt } = useWords();
  return (
    <section aria-label={t('usedTitle')} className="flex flex-col gap-2 border-t-2 border-night-900 pt-3">
      <p className="pixel flex items-center gap-2 text-[14px] uppercase tracking-[0.1em] text-gold-200">
        <Sprite id={USED_ART} />
        {t('usedTitle')}
      </p>
      <div className="flex flex-wrap justify-center gap-1.5">
        <Tag tone="good">{t('status', { n: used.status })}</Tag>
        <Tag>{t('usedAge', { years: used.ageRounds * content.yearsPerRound })}</Tag>
      </div>
      <p className="text-center text-[13px] leading-snug text-ink-300">
        {t('usedRisk', { pct: used.repairChancePct, amount: fmt.money(used.repairCost) })} {t('usedWarranty')}
      </p>
      <Button wide disabled={used.lock !== null} onClick={onBought}>
        {t('buyUsed', { amount: fmt.money(used.price) })}
      </Button>
      {used.lock !== null ? <p className="text-center text-[13px] text-wine-300">{text.reasons[used.lock]}</p> : <p className="text-center text-[13px] text-ink-300">{t('resale', { amount: fmt.money(used.resale) })}</p>}
    </section>
  );
}

/**
 * The same thing without an invoice, set off by a rule: cheaper, in cash, and a question asked when
 * it is sold or the tax office inspects.
 */
function NoInvoice({ offer, onBought }: { offer: NonNullable<ItemQuote['noInvoice']>; onBought(): void }) {
  const t = useT('finance.shop');
  const { content, text, fmt } = useWords();
  return (
    <section aria-label={t('noInvoiceTitle')} className="flex flex-col gap-2 border-t-2 border-night-900 pt-3">
      <p className="pixel text-[14px] uppercase tracking-[0.1em] text-gold-200">{t('noInvoiceTitle')}</p>
      <p className="text-center text-[13px] leading-snug text-ink-300">
        {t('noInvoiceRisk', { pct: offer.discountPct, suspicion: content.evasion.noInvoiceSaleSuspicion, goods: content.evasion.auditGoodsPct })}
      </p>
      <Button wide disabled={offer.lock !== null} onClick={onBought}>
        {t('buyNoInvoice', { amount: fmt.money(offer.price) })}
      </Button>
      {offer.lock !== null ? <p className="text-center text-[13px] text-wine-300">{text.reasons[offer.lock]}</p> : null}
    </section>
  );
}

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
            {quote.used ? <SecondHand used={quote.used} onBought={() => done(addOrder({ type: 'buyItem', itemId: item.id, used: true }))} /> : null}
            {quote.noInvoice ? <NoInvoice offer={quote.noInvoice} onBought={() => done(addOrder({ type: 'buyItem', itemId: item.id, noInvoice: true }))} /> : null}
          </>
        ) : (
          <p className="text-center text-[14px] text-ink-300">{t('cardOnly')}</p>
        )}
      </div>
    </Sheet>
  );
}

/** A thing on the shelf: the tile of the game, laid out in a row. */
// In a narrow column the picture sits above the words; with room, beside them.
const SHELF =
  'frame-raised flex min-h-11 flex-col items-center gap-1 bg-night-600 p-1.5 text-center text-cream transition-transform active:translate-y-[2px] @min-[400px]:flex-row @min-[400px]:gap-2 @min-[400px]:text-left';

type ShelfItem = { item: ItemDef; quote: ItemQuote; owned: boolean };

/** A thing is in reach if any way the shop offers it can actually be used today. */
const inReach = ({ quote, owned }: ShelfItem, cash: number) =>
  owned || quote.price <= cash || quote.finance?.lock === null || quote.used?.lock === null || quote.noInvoice?.lock === null;

function Shop({ view, onViewChange }: { view: ShopView; onViewChange(view: ShopView): void }) {
  const t = useT('finance.shop');
  const { content, text, names, fmt } = useWords();
  const { shown, p } = useRound();
  const [open, setOpen] = useState<ItemDef | null>(null);
  const ladders = [...new Set(content.items.map((item) => item.ladder))];
  const shelves = ladders.map((ladder) => ({
    ladder,
    items: content.items
      // The shelf of a city holds what that city sells: what is sold only elsewhere is not shown at all.
      .filter((item) => item.ladder === ladder)
      .map((item) => ({ item, quote: quoteItem(content, shown, item.id), owned: p.life.items.some((owned) => owned.itemId === item.id) }))
      .filter((entry) => entry.quote.soldHere),
  }));
  // In reach, a shelf with nothing on it is left out; with nothing at all, one line says so.
  const visible = shelves
    .map(({ ladder, items }) => ({ ladder, items: view === 'all' ? items : items.filter((entry) => inReach(entry, p.cash)) }))
    .filter(({ items }) => items.length > 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Segmented<ShopView>
          label={t('viewLabel')}
          options={(['affordable', 'all'] as const).map((value) => ({ value, label: t(value) }))}
          value={view}
          onChange={onViewChange}
        />
        <p className="text-center text-[12px] leading-snug text-ink-300">{t(view === 'affordable' ? 'affordableHint' : 'allHint')}</p>
      </div>
      {visible.length === 0 ? <p className="py-3 text-center text-[13px] text-ink-300">{t('noneAffordable')}</p> : null}
      {visible.map(({ ladder, items }) => (
        <Panel key={ladder} title={text.ladders[ladder]}>
          {/* Always two a row, so a car is drawn whole whatever the width. */}
          <div className="@container">
            <div className="grid grid-cols-2 gap-2">
              {items.map(({ item, quote, owned }) => (
                // What is already owned wears a gold edge, so the shelf shows at a glance what is left to want.
                // A row, the picture beside the words: a shelf of many things reads at a glance without empty space.
                <button key={item.id} type="button" data-finance-item onClick={() => setOpen(item)} className={`${SHELF} ${owned ? 'frame-gold' : ''}`}>
                  {/* As tall as a watch, as wide as the thing needs: a car is twice as wide as it is tall. */}
                  <Bare className="h-16 min-w-16">
                    <Sprite id={itemArt(item.id)} fallback={{ w: 64, h: 64 }} />
                  </Bare>
                  <span className="flex min-w-0 flex-1 flex-col items-center gap-0.5 @min-[400px]:items-start">
                    <span className="line-clamp-2 text-[13px] leading-tight">{names.items[item.id]}</span>
                    <span className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 @min-[400px]:justify-start">
                      <span className={`pixel whitespace-nowrap text-[15px] leading-none ${owned ? 'text-teal-300' : 'text-gold-500'}`}>{owned ? t(quote.ownedUsed ? 'ownedUsed' : 'owned') : fmt.compact(quote.price)}</span>
                      <span className="whitespace-nowrap">
                        <Tag tone="good">{t('status', { n: quote.status })}</Tag>
                      </span>
                      {/* A long trip is a rest too: the focus it gives says so beside the status. */}
                      {item.perks?.focus ? (
                        <span className="whitespace-nowrap">
                          <Tag tone="good">{t('focusTag', { n: item.perks.focus })}</Tag>
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Panel>
      ))}
      {open ? <ItemSheet item={open} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Taxes: the round as it will resolve

/**
 * The tax residency a city offers, for whoever lives there: what it costs and what it saves, and the
 * switch. Nothing is shown in a city that offers none.
 */
function Residency() {
  const t = useT('finance.taxes');
  const { content, names, fmt } = useWords();
  const { view, p, world } = useRound();
  const setOrder = useGame((s) => s.setOrder);
  const offer = content.cities.find((city) => city.id === p.cityId)?.residency;
  if (!offer) return null;
  return (
    <Panel title={t('residencyTitle', { city: names.cities[p.cityId] })}>
      <Toggle
        on={p.life.residency}
        onChange={(on) => setOrder((order) => order.type === 'setResidency', on === view.player.life.residency ? null : { type: 'setResidency', on })}
        label={t('residency')}
        hint={t('residencyHint', { fee: fmt.money(indexed(offer.feeAnnual, world)), rate: fmt.rate(offer.dividendBp) })}
      />
    </Panel>
  );
}

function Taxes() {
  const t = useT('finance.taxes');
  const { content, fmt } = useWords();
  const { preview, p, shown } = useRound();
  // These are the round's figures, the two years of it; the HUD's Flow is the same money a year.
  const years = content.yearsPerRound;
  const { tax, escape } = preview;
  // The tax nobody votes for: what the rise in prices of the last two years took from cash left idle. Only told, never charged.
  const before = shown.round > 0 ? shown.timeline[shown.round - 1] : null;
  const now = shown.timeline[shown.round];
  const eatenPct = before ? Math.max(0, 1 - before.priceLevel / now.priceLevel) : 0;
  const eaten = Math.round(p.cash * eatenPct);

  return (
    <div className="flex flex-col gap-3">
      <Panel title={t('tax', { years })}>
        <Row left={t('incomeTax')} right={fmt.signed(-tax.income)} />
        <Row left={t('investmentTax')} right={fmt.signed(-tax.investment)} />
        <Row left={t('propertyTax')} right={fmt.signed(-tax.property)} />
        {preview.purchaseTaxPaid > 0 ? <Row left={t('purchaseTax')} right={fmt.signed(-preview.purchaseTaxPaid)} /> : null}
        {eaten > 0 ? (
          <Row
            className="mt-1 border-t-2 border-night-900 pt-2 text-ink-300"
            left={t('inflationTax')}
            sub={t('inflationHint', { cash: fmt.money(p.cash), pct: (eatenPct * 100).toFixed(1), years })}
            right={<span className="text-ink-300">{fmt.signed(-eaten)}</span>}
          />
        ) : null}
      </Panel>
      <Residency />
      <EvasionPanel shown={shown} preview={preview} />
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
  // A guided first life opens the tabs one by one, with their tips.
  const guidedLife = useGuided();
  const introduces = useIntroducesTabs();
  const guided = guidedLife && introduces;
  const round = useGame((s) => s.view?.round ?? 0);
  const tabs = guided ? TABS.filter((id) => round >= (TAB_FROM_ROUND[id] ?? 0)) : TABS;
  const [shopView, setShopView] = useState<ShopView>('affordable');
  const ids = useId();
  const panel = useRef<HTMLDivElement>(null);
  // [ and ] move between tabs from anywhere on the stage, without going back to the tab strip first.
  useKeyboardScope((event) => {
    if ((event.key !== '[' && event.key !== ']') || event.altKey || event.ctrlKey || event.metaKey || document.querySelector('[role="dialog"]')) return false;
    const next = tabs[(tabs.indexOf(tab) + (event.key === ']' ? 1 : -1) + tabs.length) % tabs.length];
    setTab(next);
    requestAnimationFrame(() => document.getElementById(`${ids}-tab-${next}`)?.focus());
    return true;
  });
  const navigateItems = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[data-finance-item]') : null;
    if (!target) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      document.getElementById(`${ids}-tab-${tab}`)?.focus();
      return;
    }
    const direction = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (!direction && event.key !== 'Home' && event.key !== 'End') return;
    const items = [...(panel.current?.querySelectorAll<HTMLElement>('[data-finance-item]:not(:disabled)') ?? [])];
    if (items.length === 0) return;
    event.preventDefault();
    const at = Math.max(0, items.indexOf(target));
    const next = event.key === 'Home' ? items[0] : event.key === 'End' ? items.at(-1)! : items[(at + direction + items.length) % items.length];
    next.focus();
    next.scrollIntoView?.({ block: 'nearest' });
  };

  return (
    <div>
      <div className="sticky top-0 z-10 bg-night-800">
        <Tabs<TabId> label={t('tabsLabel')} idPrefix={ids} tabs={tabs.map((id) => ({ id, label: t(`tabs.${id}`) }))} value={tab} onChange={setTab} />
      </div>
      <div ref={panel} role="tabpanel" id={`${ids}-panel-${tab}`} aria-labelledby={`${ids}-tab-${tab}`} onKeyDown={navigateItems} className="px-3 pt-1">
        {tab === 'portfolio' ? <Portfolio /> : null}
        {tab === 'market' ? <Market /> : null}
        {tab === 'property' ? <PropertyTab /> : null}
        {tab === 'business' ? <BusinessTab /> : null}
        {tab === 'debt' ? <DebtTab /> : null}
        {tab === 'lifestyle' ? <Lifestyle /> : null}
        {tab === 'shop' ? <Shop view={shopView} onViewChange={setShopView} /> : null}
        {tab === 'taxes' ? <Taxes /> : null}
      </div>
      <Toast message={refusal ? `${t('refused')}: ${text.reasons[refusal]}` : null} onDone={clearRefusal} />
      {/* Taking one order out can take others with it; that must not happen without a word. */}
      <Toast message={alsoRemoved > 0 && !refusal ? t('alsoRemoved', { count: alsoRemoved }) : null} onDone={clearAlsoRemoved} ms={4_000} />
    </div>
  );
}
