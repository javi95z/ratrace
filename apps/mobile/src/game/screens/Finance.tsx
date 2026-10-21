import { assetKind, assetLogo, cityIcon, debtArt, homeName, propertyArt, saleSignArt, START_AGE } from '@ratrace/content';
import type { AssetKind } from '@ratrace/content';
import { TAB_FROM_ROUND } from '@ratrace/core/game/guide';
import { ageAt, debtLabel, headlineText, loanPlan, orderLabel, priceHistory } from '@ratrace/core/game/present';
import { rulesSell } from '@ratrace/core/game/rules';
import { applyBp, assetYieldBp, debtRateBp, depositRateBp, homeOf, mortgageSwitch, previewRound, quoteLoan, quoteMargin, quoteOwnedProperty, quotePlans, quoteProperty } from '@ratrace/engine';
import type { AssetDef, Debt, GameView, Order } from '@ratrace/engine';
import { createContext, memo, useCallback, useContext, useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePop, useSink } from '../../ui/animations';
import { LineChart } from '../../ui/charts';
import { Framed } from '../../ui/Frame';
import { adjustedRead, webBaseline } from '../../ui/fonts';
import { Bare, Button, Panel, Raised, reach, Row, Segmented, Tag, TickerBadge, Toggle, usePress } from '../../ui/kit';
import { Sheet, Tabs, Toast } from '../../ui/overlay';
import { Slider } from '../../ui/Slider';
import { Sparks } from '../../ui/Sparks';
import { Sprite } from '../../ui/Sprite';
import { PixelText, ReadText, SNUG, TIGHT } from '../../ui/text';
import { COLORS, GUTTER, TOUCH, type ColorToken } from '../../ui/theme';
import { useGame, useGuided, useIntroducesTabs, useKnows, useT, useWords } from '../context';
import { AmountSheet } from './AmountSheet';
import { Explain } from './Explain';
import { Payouts, portfolioQuote, PortfolioGlance } from './Glance';
import { useShown } from './Hud';

/*
 * The finance phase, as the web's Finance.tsx lays it on a phone: eight tabs over one basket of orders. What the phone leaves out: the keyboard
 * (`[` and `]` between the tabs, the arrows between what a tab lists) and what is only online (what other players of a room owe, `p.lent`, and
 * the loans they made, named for them: a life alone owes no other player).
 *
 * The web's Finance is one block: its row of tabs sticks under the Hud's figures, its panel scrolls, its toasts stand over the page. On the phone
 * those are three places of Play's screen: the row is the second sticky row of its `StickyScreen` (`FinanceTabs`, the `subHeader`), the panel is
 * the stage (`Finance`), and the toasts are drawn over the screen (`FinanceToasts`, in its `fixed`). The tab on screen is shared by the row and
 * the panel (`FinanceShell`), so a change of tab draws the two of them again and nothing else.
 *
 * Task 12 brought the portfolio, Task 13 the market, property and debt; the other tabs come with their tasks, each a line of `TAB_BODIES`.
 * The lists a tab draws are short (22 assets in all, the homes and lets a city sells, a life's homes and debts): drawn whole, each row memoised
 * where a list can be long (the market's, the homes'), so an order draws again only the rows it changes.
 */

type TabId = 'portfolio' | 'market' | 'property' | 'business' | 'debt' | 'lifestyle' | 'shop' | 'taxes';
const TABS: TabId[] = ['portfolio', 'market', 'property', 'business', 'debt', 'lifestyle', 'shop', 'taxes'];

/** The game before this round's orders, the game with them applied, and the preview of the round. */
function useRound() {
  const view = useGame((s) => s.view);
  const preview = useGame((s) => s.preview);
  const shown = useShown();
  if (!view || !preview) throw new Error('the finance phase needs a view and a preview');
  return { view, shown, preview, world: view.timeline[view.round], p: shown.player };
}

/**
 * What the finances have open from the start, where a scene says so (the phone's initial state, as the Hud's `open` and NewLife's `opened`; the web's
 * scene page presses what opens it): a tab, by its id, and a sheet of that tab (`pension`: the portfolio's pension plan; `buy-<asset>`: the market's
 * sheet that buys that asset).
 */
export const FinanceOpened = createContext<{ tab?: string; sheet?: string }>({});

/** A figure on the right of a line, in a colour of its own (the web's `<span className="text-…">` in a Row's `right`). */
function Figure({ tone, size, children }: { tone: ColorToken; size?: number; children: string }) {
  return <PixelText size={size} tone={tone} style={{ textAlign: 'right' }}>{children}</PixelText>;
}

/** A heading in a sheet (the web's `h3 pixel text-[14px] uppercase tracking-wider text-ink-200`). */
function SheetHeading({ children, below = 0 }: { children: string; below?: number }) {
  return (
    <View accessibilityRole="header" style={{ marginBottom: below }}>
      <PixelText size={14} tone="ink-200" style={{ textTransform: 'uppercase', letterSpacing: 14 * 0.05 }}>{children}</PixelText>
    </View>
  );
}

/** The picture of a home, the size it is drawn at (the web's fallback where it is missing). */
const HOME = { w: 128, h: 128 } as const;
/** The sale sign drawn into 32 (the web's `!h-8 !w-8`). */
const SIGN = { w: 32, h: 32 } as const;
/** Nothing to do: a button that only says something (a home being sold). */
const nothing = (): void => {};

// ------------------------------------------------------------------------------------------------
// Portfolio

type Move = { kind: 'save' } | { kind: 'withdraw' } | { kind: 'pension' } | { kind: 'sell'; asset: AssetDef };

/** A line of the figures' small print: 12, in its colour (the web's `div text-[12px]`). */
function Small({ tone, children }: { tone: 'teal-300' | 'wine-300' | 'ink-300' | 'sky-300' | 'gold-200'; children: string }) {
  return <ReadText size={12} tone={tone}>{children}</ReadText>;
}

function Portfolio() {
  const t = useT('finance.portfolio');
  const amount = useT('finance.amount');
  const { content, names, fmt } = useWords();
  const { p, shown, world, preview } = useRound();
  const addOrder = useGame((s) => s.addOrder);
  const opened = useContext(FinanceOpened);
  const [move, setMove] = useState<Move | null>(opened.sheet === 'pension' ? { kind: 'pension' } : null);
  const [buying, setBuying] = useState<AssetDef | null>(null);
  const openPension = usePress({ onPress: () => setMove({ kind: 'pension' }) });
  // The same two for every holding and every drawing, so a holding is drawn again only when what it shows changes (`Holding` is memoised).
  const buy = useCallback((asset: AssetDef) => setBuying(asset), []);
  const sell = useCallback((asset: AssetDef) => setMove({ kind: 'sell', asset }), []);
  // Worked out once for the round as it stands, not again for each drawing (the quote is the glance's, made once a round: `portfolioQuote`).
  const held = useMemo(() => content.assets.filter((asset) => Object.hasOwn(p.positions, asset.id)), [content, p.positions]);
  const dividends = useMemo(() => new Map(portfolioQuote(content, shown).dividends.map((paid) => [paid.assetId, paid.amount])), [content, shown]);
  // What can be sold this round: what is held once the orders so far have run, without what a plan buys after them.
  // A plan buys when the round is played, after every order: the order cannot sell what it has not bought yet.
  const planned = (assetId: string): number => {
    let sum = 0;
    for (const run of preview.plans) if (run.assetId === assetId && run.reason === null) sum += run.amount;
    return sum;
  };
  const sellable = (assetId: string): number => Math.max(0, (p.positions[assetId]?.value ?? 0) - planned(assetId));

  const sheet = (() => {
    if (!move) return null;
    const close = () => setMove(null);
    if (move.kind === 'save') return <AmountSheet title={amount('save')} max={p.cash} onClose={close} onConfirm={(a) => addOrder({ type: 'depositIn', amount: a })} />;
    if (move.kind === 'withdraw') return <AmountSheet title={amount('withdraw')} max={p.deposit} onClose={close} onConfirm={(a) => addOrder({ type: 'depositOut', amount: a })} />;
    if (move.kind === 'pension') return <PensionSheet onClose={close} />;
    const name = names.assets[move.asset.id].name;
    return <AmountSheet title={amount('sell', { name })} max={sellable(move.asset.id)} onClose={close} onConfirm={(a) => addOrder({ type: 'sell', assetId: move.asset.id, amount: a })} />;
  })();

  return (
    <View style={{ gap: 12 }}>
      <PortfolioGlance />
      {/* Cash, savings and the pension, a line each, with what can be done to each beside it: nothing that cannot be done is shown. */}
      <Panel>
        <Row left={t('cash')} sub={t('cashHint')} right={fmt.money(p.cash)} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 2, borderTopColor: COLORS['night-900'], paddingVertical: 6 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Row left={t('savings')} sub={t('savingsRate', { rate: fmt.rate(depositRateBp(content, world)) })} right={fmt.money(p.deposit)} />
          </View>
          {p.cash > 0 ? (
            <Button variant="secondary" size={13} padX={8} onPress={() => setMove({ kind: 'save' })}>
              {t('save')}
            </Button>
          ) : null}
          {p.deposit > 0 ? (
            <Button variant="secondary" size={13} padX={8} onPress={() => setMove({ kind: 'withdraw' })}>
              {t('withdraw')}
            </Button>
          ) : null}
        </View>
        {/* The pension opens a sheet of its own: what it is, and the money put in or taken out. */}
        <Pressable accessibilityRole="button" onPress={openPension} style={{ borderTopWidth: 2, borderTopColor: COLORS['night-900'], paddingTop: 6 }}>
          <Row left={t('pension')} sub={t('pensionHint')} right={fmt.money(p.pension)} />
        </Pressable>
      </Panel>

      <Panel title={t('holdings')} label={t('holdings')}>
        {held.length === 0 ? <ReadText size={14} tone="ink-300">{t('none')}</ReadText> : null}
        {held.map((asset) => (
          <Holding
            key={asset.id}
            asset={asset}
            value={p.positions[asset.id].value}
            gain={p.positions[asset.id].value - p.positions[asset.id].basis}
            pays={dividends.get(asset.id) ?? null}
            planned={planned(asset.id)}
            sellable={sellable(asset.id)}
            onBuy={buy}
            onSell={sell}
          />
        ))}
      </Panel>
      <Payouts />
      <Plans />
      {sheet}
      {buying ? <BuySheet asset={buying} onClose={() => setBuying(null)} /> : null}
    </View>
  );
}

/**
 * A holding: its mark, its name and what it has made or lost, what it pays, what is owed on it, what a plan adds to it, its worth; and its sale.
 * Drawn again only when one of its figures changes (an order of another holding, or of the cash, leaves it as it is): what is owed on it follows
 * the round itself (`MarginLine`), and its mark the orders of its own asset (`AssetMark`).
 */
const Holding = memo(function Holding({ asset, value, gain, pays, planned, sellable, onBuy, onSell }: { asset: AssetDef; value: number; gain: number; pays: number | null; planned: number; sellable: number; onBuy(asset: AssetDef): void; onSell(asset: AssetDef): void }) {
  const t = useT('finance.portfolio');
  const { names, fmt } = useWords();
  const buy = usePress({ onPress: () => onBuy(asset) });
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}>
      {/* The holding opens the same sheet as the market: to buy more of it, once or every round. */}
      <Pressable accessibilityRole="button" onPress={buy} style={{ flexDirection: 'row', minHeight: TOUCH, minWidth: 0, flex: 1, alignItems: 'center', gap: 12 }}>
        <AssetMark asset={asset} />
        <View style={{ minWidth: 0, flex: 1 }}>
          <ReadText numberOfLines={1}>{names.assets[asset.id].name}</ReadText>
          <Small tone={gain >= 0 ? 'teal-300' : 'wine-300'}>{t(gain >= 0 ? 'gain' : 'loss', { amount: fmt.money(Math.abs(gain)) })}</Small>
          {pays !== null ? <Small tone="ink-300">{t('pays', { amount: fmt.money(pays) })}</Small> : null}
          <MarginLine assetId={asset.id} />
          {/* What a plan buys is on the line already, but it is bought only as the round is played. */}
          {planned > 0 ? <Small tone="sky-300">{t('planBuys', { amount: fmt.money(planned) })}</Small> : null}
        </View>
        <PixelText style={{ textAlign: 'right' }}>{fmt.money(value)}</PixelText>
      </Pressable>
      <Button variant="secondary" onPress={() => onSell(asset)} disabled={sellable <= 0}>
        {t('sell')}
      </Button>
    </View>
  );
});

/**
 * The pension plan, opened: what it is and what it holds, and the money put into it this round or,
 * where the life's rules allow, taken out of it before its time, at a cost said beside the amount.
 */
function PensionSheet({ onClose }: { onClose(): void }) {
  const knows = useKnows();
  const t = useT('finance.portfolio');
  const amount = useT('finance.amount');
  const market = useT('finance.market');
  const { content, names, fmt } = useWords();
  const { p, preview } = useRound();
  const addOrder = useGame((s) => s.addOrder);
  const penalty = content.pensionEarlyPenaltyBp;
  const age = ageAt(content, content.rounds);
  // The most the pension takes this round, from the engine: its cap, the cash there is, and solvency.
  const room = preview.pensionRoom;
  const canOut = p.pension > 0 && knows('pensionOut');
  const [out, setOut] = useState(room <= 0 && canOut);

  return (
    <AmountSheet
      // A new sheet each way: the amount starts over.
      key={out ? 'out' : 'in'}
      title={t('pension')}
      max={out ? p.pension : room}
      onClose={onClose}
      onConfirm={(a) => addOrder(out ? { type: 'pensionOut', amount: a } : { type: 'pensionIn', amount: a })}
      preview={out ? (a) => <ReadText size={14} tone="ink-200" style={{ textAlign: 'center' }}>{amount('pensionOutGet', { amount: fmt.money(a - applyBp(a, penalty)) })}</ReadText> : undefined}
    >
      {canOut ? (
        <View style={{ marginBottom: 12 }}>
          <Segmented<'in' | 'out'>
            label={t('pension')}
            value={out ? 'out' : 'in'}
            onChange={(way) => setOut(way === 'out')}
            options={[
              { value: 'in', label: t('add') },
              { value: 'out', label: t('withdraw') },
            ]}
          />
        </View>
      ) : null}
      <ReadText size={14} lineHeight={14 * SNUG} tone="ink-200" style={{ marginBottom: 8 }}>{t('pensionAbout', { index: names.assets[content.pensionAssetId].name })}</ReadText>
      <ReadText size={13} lineHeight={13 * SNUG} tone="ink-300">
        {out ? amount('pensionOutRule', { penalty: penalty / 100 }) : knows('pensionOut') ? t('pensionKeep', { age, penalty: penalty / 100 }) : t('pensionLocked', { age })}
      </ReadText>
      <ReadText size={12} tone="ink-300" style={{ marginTop: 4, marginBottom: 12, textAlign: 'right' }}>{market('youHold', { amount: fmt.money(p.pension) })}</ReadText>
    </AmountSheet>
  );
}

/** How many of this round's orders buy or sell an asset, and which the last of them was: a number and a word, so an order of another asset draws nothing. */
const tradesOf = (orders: readonly Order[], assetId: string): number => orders.filter((order) => (order.type === 'buy' || order.type === 'sell') && order.assetId === assetId).length;
const lastTradeOf = (orders: readonly Order[], assetId: string): 'buy' | 'sell' | null => {
  for (let i = orders.length - 1; i >= 0; i--) {
    const order = orders[i];
    if ((order.type === 'buy' || order.type === 'sell') && order.assetId === assetId) return order.type;
  }
  return null;
};

/**
 * An asset by its mark, answering the orders of the round: bought, it jumps and throws gold sparks;
 * sold, it shrinks and comes back. Each new order plays it again; what was ordered before the list
 * was opened plays nothing. The web plays it again by making the mark anew (`key`); here the box round it
 * plays it again (`replay`) and the mark, a picture on a canvas, stays as it is: only the sparks are made anew.
 */
function AssetMark({ asset }: { asset: AssetDef }) {
  const { names } = useWords();
  const count = useGame((s) => tradesOf(s.orders, asset.id));
  const lastTrade = useGame((s) => lastTradeOf(s.orders, asset.id));
  const [before] = useState(count);
  const last = count > before ? lastTrade : null;
  const pop = usePop({ play: last === 'buy', replay: count });
  const sink = useSink({ play: last === 'sell', replay: count });
  return (
    <Animated.View {...{ dataSet: last ? { mark: last } : undefined }} style={[{ flexDirection: 'row', flexShrink: 0 }, last === 'buy' ? pop : last === 'sell' ? sink : null]}>
      <TickerBadge ticker={names.assets[asset.id].ticker} kind={asset.class} logo={assetLogo[asset.id]} />
      {last === 'buy' ? <Sparks key={count} colours={['gold-500', 'gold-200', 'cream']} count={8} reach={26} /> : null}
    </Animated.View>
  );
}

/** How much of a purchase may be borrowed from the broker: none, a quarter more, half as much again, or as much again. */
type Gear = 1 | 1.25 | 1.5 | 2;
const GEARS: readonly Gear[] = [1, 1.25, 1.5, 2];

/**
 * How close a broker's loan is to the forced sale: a bar of the loan against what the holding is
 * worth, full when the broker sells, wine as it nears; and what the holding is worth, and how far
 * it may fall before the sale.
 */
function MarginGauge({ assetId }: { assetId: string }) {
  const t = useT('finance.plans');
  const { content, names, fmt } = useWords();
  const { shown } = useRound();
  const margin = quoteMargin(content, shown, assetId);
  if (margin.owed === 0 || margin.value <= 0 || margin.dropToCallBp === null) return null;
  // The share of the way to the sale: the loan as a share of the holding, against the share at which the broker sells.
  const way = Math.min(1, (margin.owed * 100) / (margin.value * margin.callPct));
  const near = way >= 0.85;
  return (
    <View style={{ marginTop: 4 }}>
      <ReadText size={12} tone="ink-300">{t('gaugeOn', { name: names.assets[assetId]?.name ?? assetId, value: fmt.money(margin.value) })}</ReadText>
      <View
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(way * 100)}
        aria-label={t('gaugeLabel')}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(way * 100) }}
        style={{ marginTop: 4, height: 6, width: '100%', backgroundColor: COLORS['night-900'] }}
      >
        <View style={{ height: '100%', width: `${way * 100}%`, backgroundColor: COLORS[near ? 'wine-300' : 'gold-500'] }} />
      </View>
      <ReadText size={12} tone={near ? 'wine-300' : 'ink-300'} style={{ marginTop: 2 }}>{margin.dropToCallBp > 0 ? t('marginDrop', { pct: fmt.rate(margin.dropToCallBp) }) : t('marginNow')}</ReadText>
    </View>
  );
}

/** What is owed to the broker on a holding, and how far its price may fall before he sells it. Nothing for a holding bought outright. */
function MarginLine({ assetId }: { assetId: string }) {
  const t = useT('finance.plans');
  const { content, fmt } = useWords();
  const { shown } = useRound();
  const margin = quoteMargin(content, shown, assetId);
  if (margin.owed === 0 || margin.dropToCallBp === null) return null;
  return <Small tone="wine-300">{`${t('marginOwed', { amount: fmt.money(margin.owed) })} · ${margin.dropToCallBp > 0 ? t('marginDrop', { pct: fmt.rate(margin.dropToCallBp) }) : t('marginNow')}`}</Small>;
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
  const plans = useMemo(() => quotePlans(shown), [shown]);
  const open = plans.find((plan) => plan.assetId === editing);
  let total = 0;
  for (const plan of plans) total += plan.amount;

  return (
    <Panel title={t('title')} label={t('title')}>
      {plans.length === 0 ? (
        <ReadText size={14} lineHeight={14 * SNUG} tone="ink-300">{t('none')}</ReadText>
      ) : (
        <ReadText size={13} tone="ink-200" style={{ marginBottom: 4 }}>{t('total', { amount: fmt.money(total) })}</ReadText>
      )}
      <View role="list">
        {plans.map((plan, i) => {
          const run = preview.plans.find((x) => x.assetId === plan.assetId);
          const missed = run !== undefined && run.reason !== null;
          const standing = view.player.plans.some((x) => x.assetId === plan.assetId);
          const edge = plan.priceVsAverageBp;
          return (
            <View key={plan.assetId} role="listitem" style={i === 0 ? null : { borderTopWidth: 2, borderTopColor: COLORS['night-900'] }}>
              <PlanRow onPress={() => setEditing(plan.assetId)}>
                <TickerBadge ticker={names.assets[plan.assetId].ticker} kind={content.assets.find((asset) => asset.id === plan.assetId)?.class ?? 'equity'} logo={assetLogo[plan.assetId]} />
                <View style={{ minWidth: 0, flex: 1 }}>
                  <ReadText numberOfLines={1}>{names.assets[plan.assetId].name}</ReadText>
                  <Small tone="ink-300">{plan.rounds > 0 ? t('putIn', { amount: fmt.money(plan.invested), rounds: plan.rounds }) : t('starts')}</Small>
                  {edge !== null && edge !== 0 ? <Small tone={edge > 0 ? 'teal-300' : 'wine-300'}>{t(edge > 0 ? 'priceAbove' : 'priceBelow', { pct: fmt.rate(Math.abs(edge)) })}</Small> : null}
                  {missed ? <Small tone="wine-300">{t('missed')}</Small> : !standing ? <Small tone="gold-200">{t('new')}</Small> : null}
                </View>
                <View style={{ flexShrink: 0, alignItems: 'flex-end' }}>
                  <PixelText tone="gold-500" style={{ textAlign: 'right' }}>{fmt.money(plan.amount)}</PixelText>
                  <ReadText size={11} tone="ink-300" style={{ textAlign: 'right' }}>{t('aRound')}</ReadText>
                </View>
              </PlanRow>
            </View>
          );
        })}
      </View>
      {open ? (
        <AmountSheet
          title={t('edit', { name: names.assets[open.assetId].name })}
          // What the plan takes this round is cash again once the plan is being changed.
          max={planMax(p.cash + (preview.plans.find((x) => x.assetId === open.assetId)?.reason === null ? open.amount : 0), preview.income.salary)}
          start={open.amount}
          onClose={() => setEditing(null)}
          onConfirm={(amount) => setOrder(isPlanFor(open.assetId), planOrder(view, open.assetId, amount))}
          footer={
            <View style={{ marginTop: 8 }}>
              <Button
                variant="danger"
                wide
                onPress={() => {
                  if (setOrder(isPlanFor(open.assetId), planOrder(view, open.assetId, 0))) setEditing(null);
                }}
              >
                {t('stop')}
              </Button>
            </View>
          }
        >
          <Explain style={{ marginBottom: 8 }}>{t('editHint')}</Explain>
          {open.basis > 0 ? (
            <View style={{ marginBottom: 12 }}>
              <Row size={14} left={t('held')} right={fmt.money(open.value)} />
              <Row size={14} left={t('cost')} right={fmt.money(open.basis)} />
            </View>
          ) : null}
        </AmountSheet>
      ) : null}
    </Panel>
  );
}

/** A plan's line, to be pressed: 44 at least, its parts in a row 12 apart (the web's `flex min-h-11 items-center gap-3 py-2` button). */
function PlanRow({ onPress, children }: { onPress(): void; children: ReactNode }) {
  const press = usePress({ onPress });
  return (
    <Pressable accessibilityRole="button" onPress={press} style={{ flexDirection: 'row', minHeight: TOUCH, width: '100%', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
      {children}
    </Pressable>
  );
}

// ------------------------------------------------------------------------------------------------
// Market

const KINDS: AssetKind[] = ['fund', 'bond', 'stock', 'crypto', 'gold'];
const KIND_TITLE: Record<AssetKind, string> = { fund: 'funds', bond: 'bonds', stock: 'stocks', crypto: 'crypto', gold: 'gold' };

/**
 * The price of an asset since the start of the life, read at a glance: a line of its price round by
 * round over a dashed line where it started, green above it and red below, the change since then in
 * big type, and the ages along the bottom. A round of rise or fall is a dot on the line. The line is the
 * kit's `LineChart` (the web's svg, smooth as the web's is); it is drawn only while the sheet that buys is open.
 */
function PriceChart({ values, label }: { values: number[]; label: string }) {
  const t = useT('finance.market');
  const { content } = useWords();
  const last = values[values.length - 1] ?? 1;
  const change = Math.round((last - 1) * 100);
  const up = last >= 1;
  const ageAtRound = (round: number) => START_AGE + round * content.yearsPerRound;
  return (
    // The web's `figure frame bg-night-900 px-2 pb-1.5 pt-2`.
    <Framed kind="frame" style={{ backgroundColor: COLORS['night-900'], paddingHorizontal: 8, paddingBottom: 6, paddingTop: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, paddingHorizontal: 4 }}>
        <ReadText size={12} tone="ink-300" style={{ flexShrink: 1 }}>{t('sinceStart')}</ReadText>
        <PixelText size={20} lineHeight={20} tone={up ? 'teal-300' : 'wine-300'}>{`${change > 0 ? '+' : ''}${change}%`}</PixelText>
      </View>
      <View style={{ marginTop: 4 }}>
        <LineChart points={values} tone={up ? 'teal' : 'wine'} label={label} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 }}>
        <ReadText size={11} tone="ink-300">{String(ageAtRound(0))}</ReadText>
        <ReadText size={11} tone="ink-300">{String(ageAtRound(values.length - 1))}</ReadText>
      </View>
    </Framed>
  );
}

function Market() {
  const t = useT('finance.market');
  const { content } = useWords();
  const { view, p, world } = useRound();
  const opened = useContext(FinanceOpened);
  // Where a scene says so, the sheet of one asset is open from the start.
  const [buying, setBuying] = useState<AssetDef | null>(() => content.assets.find((asset) => opened.sheet === `buy-${asset.id}`) ?? null);
  // The same for every row and every drawing, so a row is drawn again only when what it shows changes (`MarketRow` is memoised).
  const buy = useCallback((asset: AssetDef) => setBuying(asset), []);
  const skill = p.life.financeSkill;
  // What needs more Finance than the player has is not on the market at all; a class with nothing open is left out. Worked out once for the round's
  // prices and the player's Finance, with what each asset did this round and what it pays: an order changes none of them.
  const shelves = useMemo(
    () =>
      KINDS.map((kind) => ({
        kind,
        assets: content.assets.filter((asset) => assetKind(asset) === kind && (asset.minFinanceSkill ?? 0) <= skill).map((asset) => ({ asset, change: world.assetReturnBp[asset.id], pays: assetYieldBp(asset, world) })),
      })).filter((shelf) => shelf.assets.length > 0),
    [content, skill, world],
  );

  return (
    <View style={{ gap: 12 }}>
      {shelves.map(({ kind, assets }) => (
        <Panel key={kind} title={t(KIND_TITLE[kind])}>
          {assets.map(({ asset, change, pays }) => (
            <MarketRow
              key={asset.id}
              asset={asset}
              change={change}
              pays={pays}
              // A standing plan shows where the asset is listed: what it buys each round.
              plan={p.plans.find((x) => x.assetId === asset.id)?.amount ?? null}
              opening={view.round === 0}
              onBuy={buy}
            />
          ))}
        </Panel>
      ))}

      {buying ? <BuySheet asset={buying} onClose={() => setBuying(null)} /> : null}
    </View>
  );
}

/**
 * An asset on the market, to be pressed to buy it: its mark, its name, what it pays and what a plan buys of it, and what it did this round (a dash in
 * the first, which has no round before it). Drawn again only when one of these changes: an order of another asset leaves it as it is.
 */
const MarketRow = memo(function MarketRow({ asset, change, pays, plan, opening, onBuy }: { asset: AssetDef; change: number; pays: number; plan: number | null; opening: boolean; onBuy(asset: AssetDef): void }) {
  const t = useT('finance.market');
  const { names, fmt } = useWords();
  const press = usePress({ onPress: () => onBuy(asset) });
  const planned = plan === null ? null : `${pays > 0 ? ' · ' : ''}${t('planned', { amount: fmt.compact(plan) })}`;
  return (
    <Pressable accessibilityRole="button" onPress={press} style={{ flexDirection: 'row', minHeight: TOUCH, width: '100%', alignItems: 'center', gap: 12, paddingVertical: 6 }}>
      <AssetMark asset={asset} />
      <View style={{ minWidth: 0, flex: 1 }}>
        <ReadText numberOfLines={1}>{names.assets[asset.id].name}</ReadText>
        {/* What it pays, and the plan in teal beside it. With neither, the web's line holds a lone space, which takes no height: there is no line. */}
        {pays > 0 ? (
          <ReadText size={12} tone="ink-300" after={planned === null ? undefined : [{ text: planned, tone: 'teal-300' }]}>{t('yield', { rate: fmt.rate(pays) })}</ReadText>
        ) : planned !== null ? (
          <ReadText size={12} tone="teal-300">{planned}</ReadText>
        ) : null}
      </View>
      <PixelText tone={opening ? 'ink-300' : change >= 0 ? 'teal-300' : 'wine-300'} style={{ textAlign: 'right' }}>{opening ? '—' : fmt.change(change)}</PixelText>
    </Pressable>
  );
});

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
  // Bought once, part of it may be borrowed from the broker: a quarter more, half as much again, or as much again.
  const [gear, setGear] = useState<Gear>(1);
  const margin = useMemo(() => quoteMargin(content, shown, asset.id), [content, shown, asset.id]);
  const canGear = margin.lock === null && margin.canDouble;
  // The price since the start of the life: the rounds played, which nothing in the sheet changes.
  const history = useMemo(() => priceHistory(view, asset.id), [view, asset.id]);
  // 1.25, 1.5, 2, in the language's own way of writing them.
  const gearText = (value: Gear) => fmt.factor(value * 100).replace(/[.,]?0+$/, '');
  /**
   * What the broker lends on a purchase of `a` at the gear chosen: never past the share of the
   * holding it may lend on, so a gear too high for what is already owed lends what it still can.
   */
  const lent = (a: number): number => {
    if (!canGear || gear === 1) return 0;
    const most = Math.floor((margin.maxPct * (margin.value + a) - 100 * margin.owed) / (100 - margin.maxPct));
    return Math.max(0, Math.min(Math.round(a * (gear - 1)), most));
  };
  /** What a purchase of `a` comes to with the loan: the holding, the loan, the interest a round, and the fall that would make the broker sell. */
  const geared = (a: number) => {
    const loan = lent(a);
    const owed = margin.owed + loan;
    const value = margin.value + a + loan;
    return {
      total: a + loan,
      loan,
      perRound: Math.round((loan * margin.rateBp * content.yearsPerRound) / 10_000),
      dropBp: owed > 0 && value > 0 ? 10_000 - Math.ceil((owed * 100 * 10_000) / (value * margin.callPct)) : null,
    };
  };
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
          : addOrder(lent(a) > 0 ? { type: 'buy', assetId: asset.id, amount: a, margin: lent(a) } : { type: 'buy', assetId: asset.id, amount: a })
      }
      preview={
        each || gear === 1 || !canGear
          ? undefined
          : (a) => {
              const g = geared(a);
              return g.loan > 0 ? (
                <ReadText size={12} lineHeight={12 * SNUG} tone="gold-200" style={{ textAlign: 'center' }}>
                  {`${plans('gearBuys', { total: fmt.money(g.total), loan: fmt.money(g.loan) })}\n${plans('gearCost', { cost: fmt.money(g.perRound) })}${g.dropBp !== null ? ` · ${plans('marginDrop', { pct: fmt.rate(g.dropBp) })}` : ''}`}
                </ReadText>
              ) : null;
            }
      }
      footer={
        // Margin is not spoken of until the player has the skill for it: a closed switch teaches nothing to someone years from it.
        each || margin.lock === 'needs-finance-skill' ? null : (
          <View role="region" aria-label={plans('marginTitle')} style={{ marginTop: 12, borderTopWidth: 2, borderTopColor: COLORS['night-900'], paddingTop: 12 }}>
            <ReadText size={13} tone="ink-300" style={{ marginBottom: 6 }}>{plans('marginTitle')}</ReadText>
            {canGear ? (
              <Segmented<Gear>
                label={plans('marginTitle')}
                value={gear}
                onChange={setGear}
                options={GEARS.map((value) => ({ value, label: value === 1 ? plans('gearNone') : `×${gearText(value)}` }))}
              />
            ) : null}
            <ReadText size={12} lineHeight={12 * SNUG} tone={canGear ? 'ink-300' : 'gold-200'} style={{ marginTop: 6 }}>
              {margin.lock !== null
                ? text.reasons[margin.lock]
                : !margin.canDouble
                  ? plans('marginFull', { pct: margin.maxPct })
                  : gear === 1
                    ? plans('gearAbout', { rate: fmt.rate(margin.rateBp) })
                    : plans('gearRisk', { gear: gearText(gear), call: margin.callPct })}
            </ReadText>
          </View>
        )
      }
    >
      <View style={{ marginBottom: 12 }}>
        <Segmented<'once' | 'each'>
          label={plans('how')}
          value={each ? 'each' : 'once'}
          onChange={(how) => setEach(how === 'each')}
          options={[
            { value: 'once', label: plans('once'), hint: plans('onceHint') },
            { value: 'each', label: plans('each'), hint: plans('eachHint') },
          ]}
        />
      </View>
      {each ? <ReadText size={13} lineHeight={13 * SNUG} tone="ink-200" style={{ marginBottom: 8 }}>{planned ? plans('already', { amount: fmt.money(planned.amount) }) : plans('editHint')}</ReadText> : null}
      <ReadText size={14} tone="ink-200" style={{ marginBottom: 8 }}>{text.assets[asset.id].blurb}</ReadText>
      <PriceChart values={history} label={t('history')} />
      {Object.hasOwn(p.positions, asset.id) ? (
        <ReadText size={12} tone="ink-300" style={{ marginTop: 4, marginBottom: 12, textAlign: 'right' }}>{t('youHold', { amount: fmt.money(p.positions[asset.id].value) })}</ReadText>
      ) : (
        <View style={{ marginBottom: 12 }} />
      )}
    </AmountSheet>
  );
}

// ------------------------------------------------------------------------------------------------
// Property

function BuyHome({ typeId, onClose }: { typeId: string; onClose(): void }) {
  const t = useT('finance.property');
  const common = useT('common');
  const { content, text, fmt } = useWords();
  const { shown } = useRound();
  const addOrder = useGame((s) => s.addOrder);
  const quote = useMemo(() => quoteProperty(content, shown, typeId), [content, shown, typeId]);
  const [mortgage, setMortgage] = useState<'fixed' | 'variable' | 'none'>(quote.canBorrow ? 'fixed' : 'none');
  const [down, setDown] = useState(quote.minDown);
  // What nobody can live in is bought to let, and there is nothing to choose.
  const [rented, setRented] = useState(quote.letOnly);
  const cashDown = mortgage === 'none' ? quote.price : down;
  const step = Math.max(100_000, Math.round(quote.price / 100 / 100_000) * 100_000);

  return (
    <Sheet open onClose={onClose} title={t(quote.letOnly ? 'buyLetTitle' : 'buyTitle', { home: homeName(text, typeId, shown.player.cityId) })} closeLabel={common('close')}>
      <View style={{ gap: 12 }}>
        <View style={{ alignItems: 'center' }}>
          <Bare style={{ padding: 4 }}>
            <Sprite id={propertyArt(typeId, shown.player.cityId)} fallback={HOME} />
          </Bare>
        </View>
        <Panel>
          <Row left={t('price')} right={fmt.money(quote.price)} />
          <Row left={t('purchaseTax')} right={fmt.money(quote.purchaseTax)} />
          {rented ? <Row left={t('rent')} right={<Figure tone="teal-300">{fmt.signed(quote.rentAnnual)}</Figure>} /> : null}
        </Panel>

        <View>
          <SheetHeading below={6}>{t('mortgage')}</SheetHeading>
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
        </View>

        {mortgage === 'none' ? null : (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <SheetHeading>{t('down')}</SheetHeading>
              <PixelText size={17}>{fmt.money(down)}</PixelText>
            </View>
            <Slider value={down} min={quote.minDown} max={quote.price - 1} step={step} onChange={(value) => setDown(Math.max(quote.minDown, Math.min(quote.price - 1, value)))} label={t('down')} valueText={fmt.money(down)} />
          </View>
        )}

        {/* Letting it out takes Finance: without it, it is a home to live in, and nothing is said of letting. */}
        {quote.letOnly || !quote.canRentOut ? null : (
          <View>
            <SheetHeading below={6}>{t('use')}</SheetHeading>
            <Segmented<'live' | 'rent'>
              label={t('use')}
              value={rented ? 'rent' : 'live'}
              onChange={(value) => setRented(value === 'rent')}
              options={[
                { value: 'live', label: t('liveIn') },
                { value: 'rent', label: t('rentOut') },
              ]}
            />
          </View>
        )}

        <PixelText size={17} tone="gold-500" style={{ textAlign: 'center' }}>{t('payNow', { amount: fmt.money(cashDown + quote.purchaseTax) })}</PixelText>
        <Button
          variant="primary"
          wide
          // Something only a landlord can own is not for sale to anyone else: the line above says why.
          disabled={quote.letOnly && !quote.canRentOut}
          onPress={() => {
            if (addOrder({ type: 'buyProperty', typeId, downPayment: mortgage === 'none' ? 0 : down, mortgage, rented })) onClose();
          }}
        >
          {t('buy')}
        </Button>
      </View>
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
  const quote = useMemo(() => quoteOwnedProperty(content, shown, propertyId), [content, shown, propertyId]);
  // Sold while its sheet was open: there is nothing left to show.
  if (!property || !quote) return null;
  const gain = quote.value - quote.paid;

  return (
    <Sheet open onClose={onClose} title={homeName(text, property.typeId, property.cityId)} closeLabel={common('close')}>
      <View style={{ gap: 12 }}>
        <View style={{ alignItems: 'center' }}>
          <Bare style={{ padding: 4 }}>
            <Sprite id={propertyArt(property.typeId, property.cityId)} fallback={HOME} />
          </Bare>
        </View>
        <PixelText size={13} tone="ink-300" style={{ textAlign: 'center', textTransform: 'uppercase', letterSpacing: 13 * 0.05 }}>{names.cities[property.cityId]}</PixelText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 }}>
          <Tag tone={quote.rented || quote.livedIn ? 'good' : 'plain'}>{quote.rented ? t('rented') : quote.livedIn ? t('livedIn') : t('empty')}</Tag>
          {quote.livedIn && quote.status > 0 ? <Tag tone="good">{t('status', { n: quote.status })}</Tag> : null}
          {/* A grand home not lived in is a standing all the same: half its status, for the two best. */}
          {quote.estateStatus > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Sprite id="icon.estates" />
              <Tag tone="good">{t('estateStatus', { n: quote.estateStatus })}</Tag>
            </View>
          ) : null}
        </View>
        {quote.estateStatus > 0 ? <ReadText size={12} lineHeight={12 * SNUG} tone="ink-300" style={{ textAlign: 'center' }}>{t('estateHint')}</ReadText> : null}

        <Panel>
          <Row left={t('worth')} right={<Figure tone="gold-500">{fmt.money(quote.value)}</Figure>} />
          <Row left={t('paid')} right={fmt.money(quote.paid)} />
          <Row left={t('gain')} right={<Figure tone={gain < 0 ? 'wine-300' : 'teal-300'}>{fmt.signed(gain)}</Figure>} />
          {quote.letOnly || quote.rented ? <Row left={t('rent')} right={<Figure tone="teal-300">{fmt.signed(quote.rentAnnual)}</Figure>} /> : <Row left={t('wouldLet')} right={fmt.money(quote.rentAnnual)} />}
        </Panel>

        <Panel title={t('mortgage')}>
          {quote.mortgage ? (
            <>
              <Row left={t('owed')} right={<Figure tone="wine-300">{fmt.money(quote.mortgage.principal)}</Figure>} />
              <Row left={quote.mortgage.variable ? t('variable') : t('fixed')} right={t('rateNow', { rate: fmt.rate(quote.mortgage.rateBp) })} />
              {/* The web's `font-sans text-[13px]` inside the figure's `pixel`: the reading face, which the pixel text's `font-size-adjust` reaches. */}
              <Row left={t('term')} right={<ReadText size={adjustedRead(13)} lineHeight={13 * 1.1} style={{ letterSpacing: 15 * 0.03, textAlign: 'right' }}>{debt('left', { rounds: quote.mortgage.roundsLeft })}</ReadText>} />
            </>
          ) : (
            <ReadText size={14} tone="ink-300">{t('ownedOutright')}</ReadText>
          )}
        </Panel>

        <View>
          {/* The web's Row with `frame bg-night-700 px-3`. */}
          <Framed kind="frame" style={{ backgroundColor: COLORS['night-700'], paddingHorizontal: 12 }}>
            <Row
              left={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
                  <Sprite id={saleSignArt(property.cityId)} size={SIGN} />
                  <PixelText size={16} numberOfLines={1} style={{ flexShrink: 1 }}>{t('netOnSale')}</PixelText>
                </View>
              }
              right={<Figure tone="gold-500" size={18}>{fmt.money(quote.netOnSale)}</Figure>}
            />
          </Framed>
          <ReadText size={12} tone="ink-300" style={{ marginTop: 6, textAlign: 'center' }}>{t('netOnSaleHint')}</ReadText>
        </View>
      </View>
    </Sheet>
  );
}

/** What a home owned says of itself: let out, lived in, or standing empty. */
type HomeState = 'rented' | 'livedIn' | 'empty';

function PropertyTab() {
  const knows = useKnows();
  const rules = useGame((s) => s.rules);
  const t = useT('finance.property');
  const { content, names } = useWords();
  const { view, shown, p } = useRound();
  const setOrder = useGame((s) => s.setOrder);
  const addOrder = useGame((s) => s.addOrder);
  const [buying, setBuying] = useState<string | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  const [toSell, setToSell] = useState<string | null>(null);
  // The same for every row and every drawing, so a row is drawn again only when what it shows changes (`OwnedHome` and `HomeTile` are memoised).
  const open = useCallback((id: string) => setOpened(id), []);
  const sell = useCallback((id: string) => setToSell(id), []);
  const buy = useCallback((typeId: string) => setBuying(typeId), []);
  const rent = useCallback(
    (propertyId: string, to: boolean, was: boolean) =>
      setOrder((order: Order) => order.type === 'setRented' && order.propertyId === propertyId, was === to ? null : { type: 'setRented', propertyId, rented: to }),
    [setOrder],
  );
  const lodgerBefore = view.player.life.lodger;
  const lodge = useCallback((on: boolean) => setOrder((order: Order) => order.type === 'setLodger', on === lodgerBefore ? null : { type: 'setLodger', on }), [setOrder, lodgerBefore]);
  const canLodge = knows('setLodger');

  // What each home owned shows, the engine's quotes of it worked out once for the round as it stands.
  const owned = useMemo(() => {
    const home = homeOf(shown.player, content);
    // A home put up for sale this round stays in its place until the round is played: were it to
    // vanish, the next one would slide under the thumb that just pressed "Sell".
    const now = shown.player.properties;
    const before = view.player.properties;
    const selling = before.filter((was) => !now.some((is) => is.id === was.id));
    const listed = [...before.map((was) => now.find((is) => is.id === was.id) ?? was), ...now.filter((is) => !before.some((was) => was.id === is.id))];
    return listed.map((property) => {
      const original = before.find((x) => x.id === property.id);
      const sold = selling.some((x) => x.id === property.id);
      const mortgage = (sold ? view.player.debts : shown.player.debts).find((d) => d.id === property.mortgageId);
      // Which home the player lives in is the engine's to say: it is one, however many they own in town.
      const state: HomeState = property.rented ? 'rented' : home?.id === property.id ? 'livedIn' : 'empty';
      // Whether it can be lived in is the engine's to say, like its price; what a year of letting it brings is the engine's figure, shown for what is let now.
      const quote = quoteOwnedProperty(content, shown, property.id);
      const lodger = sold || !canLodge ? null : (quote?.lodger ?? null);
      return {
        id: property.id,
        typeId: property.typeId,
        cityId: property.cityId,
        value: property.value,
        rent: property.rented ? (quote?.rentAnnual ?? null) : null,
        estate: quote?.estateStatus ?? 0,
        state,
        mortgageLeft: mortgage ? mortgage.principal : null,
        sold,
        mine: original !== undefined,
        wasRented: original?.rented ?? false,
        rented: property.rented,
        letOnly: quoteProperty(content, shown, property.typeId).letOnly,
        lodgerOn: lodger ? lodger.on : null,
        lodgerAnnual: lodger ? lodger.annual : 0,
        lodgerStatus: lodger ? lodger.statusLost : 0,
      };
    });
  }, [content, view, shown, canLodge]);

  // Somewhere to live, and what is only bought to let: two shelves, each with its cheapest first. Only what this city sells, and what the rules the
  // life is played under know; what can only be let is offered only to someone with the Finance to let it: without it, that shelf is not there.
  const shelves = useMemo(() => {
    const quoted = content.propertyTypes.filter((type) => rulesSell(rules, type.id)).map((type) => ({ type, quote: quoteProperty(content, shown, type.id) }));
    return ([false, true] as const).map((letOnly) => ({ letOnly, tiles: quoted.filter(({ quote }) => quote.soldHere && quote.letOnly === letOnly && (!quote.letOnly || quote.canRentOut)) }));
  }, [content, shown, rules]);

  return (
    <View style={{ gap: 12 }}>
      <Panel title={t('owned')} label={t('owned')}>
        {owned.length === 0 ? <ReadText size={14} tone="ink-300">{t('ownedNone')}</ReadText> : null}
        {owned.map((home, i) => (
          <OwnedHome key={home.id} {...home} last={i === owned.length - 1} onOpen={open} onRent={rent} onSell={sell} onLodger={lodge} />
        ))}
      </Panel>

      {opened ? <OwnedPropertySheet propertyId={opened} onClose={() => setOpened(null)} /> : null}

      {shelves.map(({ letOnly, tiles }) => {
        if (tiles.length === 0) return null;
        const title = t(letOnly ? 'letTitle' : 'title', { city: names.cities[p.cityId] });
        return (
          <Panel key={String(letOnly)} title={title} label={title}>
            {/* Two side by side on a phone, each drawn whole at its own size, as tall as the taller of the two (the web's grid): 4 on each side of
                each, the row made 8 wider than the panel, so the gap between two is 8 and the outer edges are the panel's. */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, rowGap: 8 }}>
              {tiles.map(({ type, quote }) => (
                <HomeTile
                  key={type.id}
                  typeId={type.id}
                  cityId={p.cityId}
                  price={quote.price}
                  down={quote.minDown + quote.purchaseTax}
                  letOnly={quote.letOnly}
                  lets={quote.rentAnnual}
                  status={type.status}
                  onBuy={buy}
                />
              ))}
            </View>
          </Panel>
        );
      })}
      {buying ? <BuyHome typeId={buying} onClose={() => setBuying(null)} /> : null}
      {toSell ? <SellPropertySheet propertyId={toSell} onClose={() => setToSell(null)} onSell={() => addOrder({ type: 'sellProperty', propertyId: toSell })} /> : null}
    </View>
  );
}

/**
 * A home the player owns, a line of the list: its picture, its name, its city, its worth, what it brings, and how it stands; under it what can be done with
 * it (let it or stop, sell it), and the lodger of the home lived in. Drawn again only when one of these changes.
 */
const OwnedHome = memo(function OwnedHome({
  id,
  typeId,
  cityId,
  value,
  rent,
  estate,
  state,
  mortgageLeft,
  sold,
  mine,
  wasRented,
  rented,
  letOnly,
  lodgerOn,
  lodgerAnnual,
  lodgerStatus,
  last,
  onOpen,
  onRent,
  onSell,
  onLodger,
}: {
  id: string;
  typeId: string;
  cityId: string;
  value: number;
  rent: number | null;
  estate: number;
  state: HomeState;
  mortgageLeft: number | null;
  sold: boolean;
  mine: boolean;
  wasRented: boolean;
  rented: boolean;
  letOnly: boolean;
  lodgerOn: boolean | null;
  lodgerAnnual: number;
  lodgerStatus: number;
  last: boolean;
  onOpen(id: string): void;
  onRent(id: string, to: boolean, was: boolean): void;
  onSell(id: string): void;
  onLodger(on: boolean): void;
}) {
  const t = useT('finance.property');
  const { text, names, fmt } = useWords();
  const open = usePress({ onPress: () => onOpen(id), disabled: sold });
  return (
    <View style={[{ paddingVertical: 8 }, last ? null : { borderBottomWidth: 2, borderBottomColor: COLORS['night-900'] }]}>
      {/* A tap on the home itself opens everything about it. What can be done with it stays on the buttons below. */}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: sold }} disabled={sold} onPress={open} style={{ flexDirection: 'row', width: '100%', alignItems: 'center', gap: 12 }}>
        <Bare>
          <Sprite id={propertyArt(typeId, cityId)} fallback={HOME} />
        </Bare>
        <View style={{ minWidth: 0, flex: 1 }}>
          <PixelText size={17}>{homeName(text, typeId, cityId)}</PixelText>
          <ReadText size={13} tone="ink-200">{names.cities[cityId]}</ReadText>
          <PixelText size={17} tone="gold-500" style={{ marginTop: 4 }}>{fmt.money(value)}</PixelText>
          {rent !== null ? <PixelText size={14} tone="teal-300">{t('rentYear', { amount: fmt.money(rent) })}</PixelText> : null}
          {estate > 0 ? <PixelText size={14} tone="gold-500">{t('estateStatus', { n: estate })}</PixelText> : null}
          <ReadText size={12} tone="ink-300" style={{ marginTop: 4 }}>{`${t(state)}${mortgageLeft !== null ? ` · ${t('mortgageLeft', { amount: fmt.money(mortgageLeft) })}` : ''}`}</ReadText>
        </View>
      </Pressable>
      {sold ? (
        <View style={{ marginTop: 8 }}>
          <Button variant="secondary" wide disabled onPress={nothing}>
            <Sprite id={saleSignArt(cityId)} size={SIGN} />
            {t('selling')}
          </Button>
        </View>
      ) : mine ? (
        // The web's `grid gap-2`, two columns but for what is only let.
        <View style={{ marginTop: 8, flexDirection: 'row', gap: 8 }}>
          {/* What nobody can live in is let for as long as it is owned: there is nothing to switch. */}
          {letOnly ? null : (
            <Button variant="secondary" cell onPress={() => onRent(id, !rented, wasRented)}>
              {rented ? t('stopRenting') : t('startRenting')}
            </Button>
          )}
          {/* A sale is told in full before it is ordered: what comes in, what goes, what stops. */}
          <Button variant="danger" cell onPress={() => onSell(id)}>
            {t('sell', { amount: fmt.compact(value) })}
          </Button>
        </View>
      ) : null}
      {/* The home lived in, with a room to spare: it can take a lodger. */}
      {lodgerOn !== null ? (
        <View style={{ marginTop: 8 }}>
          <Toggle on={lodgerOn} onChange={onLodger} label={t('lodger')} hint={t('lodgerHint', { amount: fmt.money(lodgerAnnual), status: lodgerStatus })} icon="icon.rent_room" />
        </View>
      ) : null}
    </View>
  );
});

/**
 * A kind of property on the shelf, to be pressed to buy it (the web's `TILE`): its picture, its name, its price, the least it takes in cash, and what living
 * in it is worth or, for what cannot be lived in, what it lets for. Half the row, as tall as the other half. Drawn again only when what it shows changes.
 */
const HomeTile = memo(function HomeTile({ typeId, cityId, price, down, letOnly, lets, status, onBuy }: { typeId: string; cityId: string; price: number; down: number; letOnly: boolean; lets: number; status: number; onBuy(typeId: string): void }) {
  const t = useT('finance.property');
  const { text, fmt } = useWords();
  return (
    <View style={{ width: '50%', paddingHorizontal: 4 }}>
      <Raised place={{ flexGrow: 1 }} style={{ flexGrow: 1, alignItems: 'center', gap: 4, padding: 8 }} onPress={() => onBuy(typeId)}>
        <Bare style={{ width: '100%', paddingVertical: 4 }}>
          <Sprite id={propertyArt(typeId, cityId)} fallback={HOME} />
        </Bare>
        <ReadText size={14} lineHeight={14 * TIGHT} style={{ marginTop: 2, textAlign: 'center' }}>{homeName(text, typeId, cityId)}</ReadText>
        <PixelText size={18} tone="gold-500" style={{ textAlign: 'center' }}>{fmt.compact(price)}</PixelText>
        <ReadText size={11} lineHeight={11 * TIGHT} tone="ink-200" style={{ textAlign: 'center' }}>{t('minDown', { amount: fmt.compact(down) })}</ReadText>
        {/* A home says what living in it is worth; what cannot be lived in says what it lets for. (The tag in a box of its own, centred as the web's inline tag is.) */}
        {letOnly ? (
          <ReadText size={12} lineHeight={12 * TIGHT} tone="teal-300" style={{ textAlign: 'center' }}>{t('lets', { amount: fmt.compact(lets) })}</ReadText>
        ) : (
          <View>
            <Tag tone="good">{t('status', { n: status })}</Tag>
          </View>
        )}
      </Raised>
    </View>
  );
});

/**
 * What selling a property comes to, before it is ordered: the price, the mortgage it pays off, the tax
 * on the gain this round, and what is left in cash; then what stops, the rent it brought, the home
 * lived in, the status it gave. The figures are the engine's: the round as planned, with and without
 * the sale (worked out once while the sheet is open, and again only if the orders change).
 */
function SellPropertySheet({ propertyId, onClose, onSell }: { propertyId: string; onClose(): void; onSell(): void }) {
  const t = useT('finance.property');
  const common = useT('common');
  const { content, text, names, fmt } = useWords();
  const { view } = useRound();
  const orders = useGame((s) => s.orders);
  const property = view.player.properties.find((x) => x.id === propertyId);
  const sale = useMemo(() => {
    const quote = quoteOwnedProperty(content, view, propertyId);
    if (!quote) return null;
    const before = previewRound(content, view, { orders });
    const after = previewRound(content, view, { orders: [...orders, { type: 'sellProperty', propertyId }] });
    return { quote, tax: Math.max(0, after.tax.total - before.tax.total), living: after.expenses.living - before.expenses.living };
  }, [content, view, orders, propertyId]);
  if (!property || !sale) return null;
  const { quote, tax } = sale;
  const mortgage = quote.mortgage?.principal ?? 0;
  const kept = quote.value - mortgage - tax;
  const housing = Math.round(sale.living / content.yearsPerRound);
  const minus = (amount: number) => <Figure tone="wine-300">{`−${fmt.money(amount)}`}</Figure>;
  return (
    <Sheet open onClose={onClose} title={t('sellTitle', { home: homeName(text, property.typeId, property.cityId) })} closeLabel={common('close')}>
      <View style={{ gap: 8 }}>
        <ReadText size={13} tone="ink-200">{names.cities[property.cityId]}</ReadText>
        <Row left={t('sellPrice')} right={fmt.money(quote.value)} />
        {mortgage > 0 ? <Row left={t('sellMortgage')} right={minus(mortgage)} /> : null}
        {tax > 0 ? <Row left={t('sellTax')} sub={t('sellGain', { amount: fmt.money(Math.max(0, quote.value - quote.paid)) })} right={minus(tax)} /> : null}
        <Row left={<PixelText numberOfLines={1} style={{ flexShrink: 1 }}>{t('sellKept')}</PixelText>} right={<Figure tone="gold-500">{fmt.money(kept)}</Figure>} />
        {quote.rented ? <Row left={t('sellRentLost')} right={<Figure tone="wine-300">{`−${common('perYear', { amount: fmt.money(quote.rentAnnual) })}`}</Figure>} /> : null}
        {quote.livedIn ? <ReadText size={13} lineHeight={13 * SNUG} tone="ink-200">{housing > 0 ? t('sellHomeRent', { amount: fmt.money(housing) }) : t('sellHome')}</ReadText> : null}
        {quote.status > 0 ? <ReadText size={13} lineHeight={13 * SNUG} tone="ink-200">{t('sellStatus', { n: quote.status })}</ReadText> : null}
        <Button
          variant="danger"
          wide
          onPress={() => {
            onSell();
            onClose();
          }}
        >
          {t('sellDo', { amount: fmt.money(kept) })}
        </Button>
        <ReadText size={12} tone="ink-300" style={{ textAlign: 'center' }}>{t('sellUndo')}</ReadText>
      </View>
    </Sheet>
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
  const loan = useMemo(() => quoteLoan(content, shown), [content, shown]);
  let total = 0;
  for (const debt of p.debts) total += debt.principal;

  return (
    <View style={{ gap: 12 }}>
      <Panel>
        {p.debts.length === 0 ? <ReadText size={14} tone="ink-300">{t('none')}</ReadText> : <Row left={t('total')} right={fmt.money(total)} />}
        {p.debts.map((debt) => (
          <View key={debt.id} style={{ borderTopWidth: 2, borderTopColor: COLORS['night-900'], paddingVertical: 8 }}>
            {/* On a phone the way to pay it off is under the name (the web's `sm:hidden` one), so the name has the row: it is cut to its line, as the web cuts it. */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Bare style={{ width: 32, height: 32 }}>
                <Sprite id={debtArt(debt)} />
              </Bare>
              <View style={{ minWidth: 0, flex: 1 }}>
                <ReadText numberOfLines={1}>{debtLabel(words, debt, p.properties)}</ReadText>
              </View>
              <PixelText>{fmt.money(debt.principal)}</PixelText>
            </View>
            {/* Under the name, so a long one is not cut short: what it costs and what is left, and the way to pay it off. */}
            <View style={{ marginTop: 4, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, paddingLeft: 44 }}>
              <View style={{ minWidth: 0, flexShrink: 1 }}>
                <ReadText size={12} tone="ink-300">
                  {/* A broker's loan has no term: it is paid back when the holding is sold. */}
                  {`${t('rate', { rate: fmt.rate(debtRateBp(debt, content, world, p)) })}${debt.kind === 'margin' ? '' : ` · ${t('left', { rounds: debt.kind === 'creditCard' ? 0 : debt.roundsLeft })}`}`}
                </ReadText>
                {debt.kind === 'margin' && debt.forAsset ? <MarginGauge assetId={debt.forAsset} /> : null}
                {/* A mortgage can be switched between fixed and variable: said under it, opened in a sheet. Not while it rests from the last switch. */}
                <SwitchLink debtId={debt.id} onOpen={() => setSwitching(debt.id)} />
              </View>
              {/* A loan from another player is paid by its term: there is nothing to pay off early. */}
              {debt.peer === undefined ? (
                <Button variant="secondary" onPress={() => setRepaying(debt)} disabled={p.cash <= 0}>
                  {t('repay')}
                </Button>
              ) : null}
            </View>
          </View>
        ))}
      </Panel>

      <Panel>
        {loan.lockedUntilRound !== null ? (
          <ReadText size={14} tone="wine-300">{t('noCredit', { age: ageAt(content, loan.lockedUntilRound) })}</ReadText>
        ) : loan.room <= 0 ? (
          <ReadText size={14} tone="ink-300">{t('borrowNone')}</ReadText>
        ) : (
          <>
            <ReadText size={14} tone="ink-200" style={{ marginBottom: 8 }}>{t('borrowHint', { amount: fmt.money(loan.room), rate: fmt.rate(loan.rateBp), years: loan.termRounds * content.yearsPerRound })}</ReadText>
            <Button variant="secondary" wide onPress={() => setBorrowing(true)}>
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
              <View style={{ borderTopWidth: 2, borderBottomWidth: 2, borderColor: COLORS['night-900'], paddingVertical: 4 }}>
                {/* One figure a round, the average: the first is a little more and the last a little less. */}
                <Row left={t('perRound')} right={fmt.money(Math.round((a + plan.interest) / plan.payments.length))} />
                <Row left={t('repayTotal')} sub={t('interestPart', { interest: fmt.money(plan.interest), rate: fmt.rate(loan.rateBp) })} right={<Figure tone="wine-300">{fmt.money(a + plan.interest)}</Figure>} />
              </View>
            );
          }}
        />
      ) : null}
    </View>
  );
}

/** Where the line under the way to switch a mortgage is drawn (`underline underline-offset-2` on a line of 12 × 1.45): drawn, as iOS puts a font's underline where the font says. */
const SWITCH_LINE = webBaseline('read', 400, 12, 12 * 1.45) + 2;
/**
 * Its touch, the 44 a thumb needs (the kit's `reach`): it reaches up over the line of what the debt costs, 2 above it (which takes no touch), and down into
 * its row's foot (8); the button beside it is in a column of its own.
 */
const SWITCH_REACH = reach(12 * 1.45, { above: 2 + 12 * 1.45, below: 8 });

/** The way into switching a mortgage: what it would become, or that it is being switched this round. Nothing while it may not be switched. */
function SwitchLink({ debtId, onOpen }: { debtId: string; onOpen(): void }) {
  const knows = useKnows();
  const t = useT('finance.debt');
  const { content } = useWords();
  const { view, world } = useRound();
  const ordered = useGame((s) => s.orders.some((order) => order.type === 'switchMortgage' && order.debtId === debtId));
  const press = usePress({ onPress: onOpen });
  const quote = mortgageSwitch(view.player, debtId, content, world, view.round);
  if (!knows('switchMortgage') || quote === null || (quote.lock === 'switch-resting' && !ordered)) return null;
  const tone = ordered ? 'teal-300' : 'sky-300';
  return (
    // The web's button is as wide as its words (inline in its column): its underline is theirs.
    <Pressable accessibilityRole="button" onPress={press} style={{ ...SWITCH_REACH.style, marginTop: 2 - SWITCH_REACH.top, alignSelf: 'flex-start' }}>
      <View>
        <ReadText size={12} tone={tone}>{ordered ? t(quote.to === 'fixed' ? 'switchingToFixed' : 'switchingToVariable') : t(quote.to === 'fixed' ? 'switchToFixed' : 'switchToVariable')}</ReadText>
        <View style={{ position: 'absolute', left: 0, right: 0, top: SWITCH_LINE, height: 1, backgroundColor: COLORS[tone] }} />
      </View>
    </Pressable>
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
  const ordered = useGame((s) => s.orders.some((order) => order.type === 'switchMortgage' && order.debtId === debtId));
  const setOrder = useGame((s) => s.setOrder);
  const debt = view.player.debts.find((d) => d.id === debtId);
  const quote = mortgageSwitch(view.player, debtId, content, world, view.round);
  if (!debt || quote === null) return null;
  const same = (order: Order) => order.type === 'switchMortgage' && order.debtId === debtId;
  const toFixed = quote.to === 'fixed';
  const yearly = (bp: number) => Math.round((debt.principal * bp) / 10_000);
  const rates = world.news.find((h) => h.topic === 'rates');
  return (
    <Sheet open onClose={onClose} title={t(toFixed ? 'switchTitleFixed' : 'switchTitleVariable')} closeLabel={common('close')}>
      <View style={{ gap: 8 }}>
        <ReadText size={14} lineHeight={14 * SNUG} tone="ink-200">{debtLabel(words, debt, view.player.properties)}</ReadText>
        <ReadText size={13} lineHeight={13 * SNUG} tone="ink-200">{t(toFixed ? 'switchAboutFixed' : 'switchAboutVariable')}</ReadText>
        <Row left={t('switchRate')} right={`${fmt.rate(quote.rateNowBp)} → ${fmt.rate(quote.rateAfterBp)}`} />
        <Row left={t('switchInterest')} right={`${fmt.money(yearly(quote.rateNowBp))} → ${fmt.money(yearly(quote.rateAfterBp))}`} />
        <Row left={t('switchFee', { pct: toFixed ? content.debt.switchFeePct.toFixed : content.debt.switchFeePct.toVariable })} right={<Figure tone="wine-300">{fmt.money(quote.fee)}</Figure>} />
        {/* What the paper of the round says of rates, if it says anything: the one hint there is of where they go. */}
        {rates ? <ReadText size={12} lineHeight={12 * SNUG} tone="ink-300" italic>{t('switchPaper', { headline: headlineText(words, rates, view.round) })}</ReadText> : null}
        <ReadText size={12} lineHeight={12 * SNUG} tone="ink-300">{t('switchRest', { rounds: content.debt.switchRestRounds })}</ReadText>
        {quote.lock === 'not-enough-cash' && !ordered ? (
          <ReadText size={13} tone="wine-300">{words.text.reasons['not-enough-cash']}</ReadText>
        ) : (
          <Button
            variant={ordered ? 'secondary' : 'primary'}
            wide
            onPress={() => {
              setOrder(same, ordered ? null : { type: 'switchMortgage', debtId });
              onClose();
            }}
          >
            {ordered ? t('switchUndo') : t('switchDo', { fee: fmt.money(quote.fee) })}
          </Button>
        )}
      </View>
    </Sheet>
  );
}

// ------------------------------------------------------------------------------------------------
// The basket

/** The line under "Undo" (`underline underline-offset-4` on a line of 13 × 1.45): drawn, as iOS puts a font's underline where the font says. */
const UNDO_LINE = webBaseline('read', 400, 13, 13 * 1.45) + 4;

/** What was just taken out of the basket, and the way to put it back. */
function PutBack() {
  const t = useT('finance');
  const undoRemove = useGame((s) => s.undoRemove);
  const press = usePress({ onPress: undoRemove });
  return (
    <View role="status" accessibilityLiveRegion="polite" style={{ flexDirection: 'row', minHeight: TOUCH, alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <ReadText size={13} tone="ink-300" style={{ flexShrink: 1 }}>{t('removed')}</ReadText>
      <Pressable accessibilityRole="button" onPress={press} style={{ minHeight: TOUCH, paddingHorizontal: 8, justifyContent: 'center' }}>
        <View>
          <ReadText size={13} tone="sky-300">{t('undo')}</ReadText>
          <View style={{ position: 'absolute', left: 0, right: 0, top: UNDO_LINE, height: 1, backgroundColor: COLORS['sky-300'] }} />
        </View>
      </Pressable>
    </View>
  );
}

/** One order in the basket, and the button that takes it out. */
function Ordered({ label, onRemove }: { label: string; onRemove(): void }) {
  const t = useT('finance');
  const remove = usePress({ onPress: onRemove });
  return (
    <View role="listitem">
      <Framed kind="frame" style={{ backgroundColor: COLORS['night-600'], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 4, paddingLeft: 12, paddingRight: 4 }}>
        <ReadText numberOfLines={1} style={{ flexShrink: 1 }}>{label}</ReadText>
        <Pressable accessibilityRole="button" accessibilityLabel={`${t('remove')}: ${label}`} onPress={remove} style={{ width: TOUCH, height: TOUCH, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}>
          <PixelText size={18} tone="wine-300">{'✕'}</PixelText>
        </Pressable>
      </Framed>
    </View>
  );
}

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
  const preview = useGame((s) => s.preview);
  const removeOrder = useGame((s) => s.removeOrder);
  const undo = useGame((s) => s.undo);
  if (!view) return null;
  const moving = view.player.life.movingTo;
  // What was just taken out can be put back, until the basket changes again.
  const putBack = undo !== null ? <PutBack /> : null;
  if (orders.length === 0 && !moving) {
    return (
      <>
        <ReadText size={14} tone="ink-300" style={{ paddingVertical: 4 }}>{t('basketEmpty')}</ReadText>
        {putBack}
      </>
    );
  }

  return (
    <>
      {/* The basket at a glance: how many orders, and the cash they leave before the round is played. */}
      {orders.length > 0 && preview ? (
        <ReadText size={13} tone="ink-200" style={{ marginBottom: 8 }}>
          {preview.player.cash === view.player.cash
            ? t('basketCount', { count: orders.length })
            : t('basketSummary', { count: orders.length, from: words.fmt.money(view.player.cash), to: words.fmt.money(preview.player.cash) })}
        </ReadText>
      ) : null}
      <View role="list" aria-label={t('basketTitle')} style={{ gap: 8 }}>
        {moving ? (
          <View role="listitem">
            <Framed kind="frame" style={{ backgroundColor: COLORS['night-600'], minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 12, paddingVertical: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0, flexShrink: 1 }}>
                <Sprite id={cityIcon(moving)} />
                <ReadText numberOfLines={1} style={{ flexShrink: 1 }}>{labels('move', { city: words.names.cities[moving] })}</ReadText>
              </View>
              <Tag>{t('decided')}</Tag>
            </Framed>
          </View>
        ) : null}
        {orders.map((order, i) => (
          <Ordered key={i} label={orderLabel(words, labels, view.player, order)} onRemove={() => removeOrder(i)} />
        ))}
      </View>
      {putBack}
    </>
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

// ------------------------------------------------------------------------------------------------
// The shell

/**
 * What each tab draws. A tab whose body a later task brings is null, and is not shown: a player never meets an empty tab. Task 14 the way of
 * life; Task 15 the shop, taxes and businesses (the shop's view, the web's `shopView`, is then kept by the panel). Showing one is its line here.
 */
const TAB_BODIES: Readonly<Record<TabId, ComponentType | null>> = {
  portfolio: Portfolio,
  market: Market,
  property: PropertyTab,
  business: null,
  debt: DebtTab,
  lifestyle: null,
  shop: null,
  taxes: null,
};

/**
 * The tabs a life is offered, the web's own rule: a guided first life opens them one by one, with their tips (`TAB_FROM_ROUND`), and the debt
 * tab early for someone who already owes something, so what is owed is always in sight. Of these, Finance shows those it draws.
 */
export function offeredTabs(guided: boolean, round: number, inDebt: boolean): TabId[] {
  return guided ? TABS.filter((id) => round >= (TAB_FROM_ROUND[id] ?? 0) || (id === 'debt' && inDebt)) : TABS;
}

/** The tabs on screen, worked out again only when one of what decides them changes. */
function useTabs(): TabId[] {
  // A guided first life opens the tabs one by one, with their tips.
  const guidedLife = useGuided();
  const introduces = useIntroducesTabs();
  const guided = guidedLife && introduces;
  const round = useGame((s) => s.view?.round ?? 0);
  // A guided life opens the debt tab early for someone who already owes something: what is owed is always in sight.
  const inDebt = useGame((s) => (s.view?.player.debts.length ?? 0) > 0);
  return useMemo(() => offeredTabs(guided, round, inDebt).filter((id) => TAB_BODIES[id] !== null), [guided, round, inDebt]);
}

/** The tab on screen, shared by the row of tabs and the panel under it. */
const FinanceTab = createContext<{ tab: TabId; setTab(tab: TabId): void } | null>(null);
function useFinanceTab() {
  const value = useContext(FinanceTab);
  if (!value) throw new Error('the finances must be inside a FinanceShell');
  return value;
}

/**
 * Keeps the tab of the finances on screen for the row of tabs and the panel, wherever Play puts them. A change of tab draws those two again,
 * and nothing else: what is inside it is not drawn again for it. Each finance phase opens on the portfolio (or on the tab a scene names).
 */
export function FinanceShell({ children }: { children: ReactNode }) {
  const opened = useContext(FinanceOpened);
  const [tab, setTab] = useState<TabId>(() => TABS.find((id) => id === opened.tab) ?? 'portfolio');
  const value = useMemo(() => ({ tab, setTab }), [tab]);
  return <FinanceTab.Provider value={value}>{children}</FinanceTab.Provider>;
}

/** The row of the finances' tabs, the second sticky row under the Hud's figures (the web's `sticky … bg-night-800` strip): as wide as the column, its tabs 12 in, scrolling sideways when they do not fit. */
export function FinanceTabs() {
  const t = useT('finance');
  const { tab, setTab } = useFinanceTab();
  const tabs = useTabs();
  return (
    <View style={{ marginHorizontal: -GUTTER }}>
      <Tabs<TabId> label={t('tabsLabel')} tabs={tabs.map((id) => ({ id, label: t(`tabs.${id}`) }))} value={tab} onChange={setTab} />
    </View>
  );
}

/** The finance phase: the panel of the tab on screen (the web's `role="tabpanel"`, `pt-1`; the column's gutter is its `px-3`). */
export function Finance() {
  const t = useT('finance');
  const { tab, setTab } = useFinanceTab();
  // The next finance phase opens on the portfolio again, as the web's, whose Finance is made anew each round.
  useEffect(() => () => setTab('portfolio'), [setTab]);
  const Body = TAB_BODIES[tab];
  return (
    <View role="tabpanel" aria-label={t(`tabs.${tab}`)} style={{ paddingTop: 4 }}>
      {Body ? <Body /> : null}
    </View>
  );
}

/**
 * What the finances say over the screen: why an order was refused, and that taking one out took others with it, which must not happen without a word.
 * In the screen's `fixed`, so the panel is not drawn again for either (and over a sheet that is open: the kit's toast is drawn in it).
 */
export function FinanceToasts() {
  const t = useT('finance');
  const { text } = useWords();
  const refusal = useGame((s) => s.refusal);
  const clearRefusal = useGame((s) => s.clearRefusal);
  const alsoRemoved = useGame((s) => s.alsoRemoved);
  const clearAlsoRemoved = useGame((s) => s.clearAlsoRemoved);
  return (
    <>
      <Toast message={refusal ? `${t('refused')}: ${text.reasons[refusal]}` : null} onDone={clearRefusal} />
      {/* Taking one order out can take others with it; that must not happen without a word. */}
      <Toast message={alsoRemoved > 0 && !refusal ? t('alsoRemoved', { count: alsoRemoved }) : null} onDone={clearAlsoRemoved} ms={4_000} />
    </>
  );
}
