import { assetKind, assetLogo, cityIcon, crestArt, debtArt, homeName, insuranceArt, itemArt, lifestyleArt, propertyArt, rentTierIcon, RISK_ART, saleSignArt, START_AGE, USED_ART } from '@ratrace/content';
import type { AssetKind } from '@ratrace/content';
import { escapeShift } from '@ratrace/core/game/escapeShift';
import type { EscapeShift } from '@ratrace/core/game/escapeShift';
import { TAB_FROM_ROUND } from '@ratrace/core/game/guide';
import { ageAt, debtLabel, headlineText, jobFocusName, loanPlan, orderLabel, priceHistory } from '@ratrace/core/game/present';
import { rulesSell } from '@ratrace/core/game/rules';
import { applyBp, assetYieldBp, debtRateBp, depositRateBp, effectiveTax, focusLeft, homeOf, indexed, mortgageSwitch, previewRound, quoteItem, quoteLiving, quoteLoan, quoteMargin, quoteMove, quoteOwnedProperty, quotePlans, quoteProperty, quoteSkills, quoteWork, workModeOf } from '@ratrace/engine';
import type { AssetDef, CityDef, Debt, FocusAction, GameView, InsuranceKind, ItemDef, ItemQuote, LifestyleTier, Order, PlayerState, RentTier, UsedQuote, WorkMode, WorldState } from '@ratrace/engine';
import { createContext, memo, useCallback, useContext, useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { Pressable, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePop, useSink } from '../../ui/animations';
import { LineChart } from '../../ui/charts';
import { Framed } from '../../ui/Frame';
import { GOLD } from '../../ui/frames';
import { adjustedRead, webLine } from '../../ui/fonts';
import { useDrawnFirst, whenShown } from '../../ui/drawnFirst';
import { Bar, Bare, Button, Figure, LineTag, Panel, Raised, reach, Row, Segmented, Tag, TickerBadge, Toggle, useOnce, usePress } from '../../ui/kit';
import { LinkText } from '../../ui/LinkText';
import { useHoldMenu } from '../../ui/holdMenu';
import { Sheet, Tabs, Toast } from '../../ui/overlay';
import { PerfDrawn } from '../../ui/perf';
import { Slider } from '../../ui/Slider';
import { Sparks } from '../../ui/Sparks';
import { useIsWide } from '../../ui/desk';
import { dialogOpen, focusedMark, focusMarked, onKeys, stepMarked, useKeyboardScope } from '../../ui/keyboard';
import { Sprite } from '../../ui/Sprite';
import { LEVEL_3 } from '../../ui/headingLevel';
import { PixelText, ReadText, SNUG, TIGHT } from '../../ui/text';
import { BODY, COLORS, GUTTER, SHELL_WIDTH, TOUCH, type ColorToken } from '../../ui/theme';
import { SwipeAway } from '../../ui/SwipeAway';
import { TabSwipe } from '../../ui/TabSwipe';
import { useGame, useGuided, useIntroducesTabs, useKnows, useSettings, useT, useWords } from '../context';
import { AmountSheet } from './AmountSheet';
import { BusinessTab } from './Business';
import { CareerMoves } from './CareerMoves';
import { EvasionPanel } from './Evasion';
import { Explain } from './Explain';
import { splitMastered, useFocusNote, type FocusNote } from './focusNote';
import { Payouts, portfolioQuote, PortfolioGlance } from './Glance';
import { HealthCoverNote } from './HealthCover';
import { useShown } from './Hud';
import { FinanceTab, TABS, type TabId } from './financeTab';
import { ItemCost } from './ItemCost';
import { ItemUses } from './ItemUses';
import { realStatus, StatusNote } from './StatusNote';
import { FocusSwitch, LifeUses, MasteredLine, TeaseUse, useFocusOrdered, useSetFocus } from './Work';

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
 * Task 12 brought the portfolio, Task 13 the market, property and debt, Task 14 the way of life (and the cities: the sheet of every city, and the
 * one a card offers to move to, `CityPreview`), Task 15 the shop, the taxes and the businesses (Business.tsx, Evasion.tsx): each a line of `TAB_BODIES`.
 * The lists a tab draws are short (22 assets in all, the homes and lets a city sells, a life's homes, debts and businesses): drawn whole, each row
 * memoised where a list can be long (the market's, the homes'), so an order draws again only the rows it changes. The shop's sixty-odd things are
 * the one long list: its shelves are drawn a few a frame and its tiles are memoised (`Shop`, and why not a FlatList there).
 */



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
 * sheet that buys that asset; `move`: the way of life's sheet of every city; `item-<id>`: the shop's sheet of that thing).
 */
export const FinanceOpened = createContext<{ tab?: string; sheet?: string }>({});

/** What the keyboard moves among in a tab's panel, ↓ and ↑ (the web's `data-finance-item`): its rows and tiles that open or buy something. */
const ITEM = { dataSet: { financeItem: true } } as const;

/** A heading in a sheet (the web's `h3 pixel text-[14px] uppercase tracking-wider text-ink-200`). */
function SheetHeading({ children, below = 0 }: { children: string; below?: number }) {
  return (
    <View accessibilityRole="header" {...LEVEL_3} style={{ marginBottom: below }}>
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

/**
 * What a choice leaves of the way out, a year at a time: passive income after tax beside the outgoings, in the warning's colour when the
 * choice is what sends a covered life back into the rat race (`escapeShift`, null for a life far from it). Said aloud as it changes. A
 * purchase's is a note of its sheet, in the middle; a change of the way of life's, a line of its panel.
 */
function EscapeLine({ shift, buying }: { shift: EscapeShift | null; buying: boolean }) {
  const t = useT('finance.escapeAfter');
  const { fmt } = useWords();
  if (shift === null) return null;
  const key = buying ? (shift.back ? 'buyBack' : 'buy') : shift.back ? 'changeBack' : 'change';
  return (
    <View accessibilityLiveRegion="polite">
      <ReadText size={buying ? 13 : 12} tone={shift.back ? 'wine-300' : 'ink-300'} style={buying ? { textAlign: 'center' } : undefined}>
        {t(key, { passive: fmt.compact(shift.passiveAnnual), outgoings: fmt.compact(shift.outgoingsAnnual) })}
      </ReadText>
    </View>
  );
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
  const sellAll = useCallback((asset: AssetDef, amount: number) => void addOrder({ type: 'sell', assetId: asset.id, amount }), [addOrder]);
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
        <Pressable {...ITEM} accessibilityRole="button" onPress={openPension} style={{ borderTopWidth: 2, borderTopColor: COLORS['night-900'], paddingTop: 6 }}>
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
            onSellAll={sellAll}
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
const Holding = memo(function Holding({ asset, value, gain, pays, planned, sellable, onBuy, onSell, onSellAll }: { asset: AssetDef; value: number; gain: number; pays: number | null; planned: number; sellable: number; onBuy(asset: AssetDef): void; onSell(asset: AssetDef): void; onSellAll(asset: AssetDef, amount: number): void }) {
  const t = useT('finance.portfolio');
  const menuWords = useT('phone.menu');
  const common = useT('common');
  const { names, fmt } = useWords();
  const buy = usePress({ onPress: () => onBuy(asset) });
  // Held, on the phone: buy more, sell some, or sell it all (an order in the basket, taken back as any other).
  const { held, menu } = useHoldMenu({
    title: names.assets[asset.id].name,
    closeLabel: common('close'),
    actions: [
      { label: menuWords('buyMore'), onPress: () => onBuy(asset) },
      ...(sellable > 0 ? [{ label: t('sell'), onPress: () => onSell(asset) }, { label: menuWords('sellAll'), onPress: () => onSellAll(asset, sellable), danger: true }] : []),
    ],
  });
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}>
      {/* The holding opens the same sheet as the market: to buy more of it, once or every round. */}
      <Pressable {...ITEM} {...held} accessibilityRole="button" onPress={buy} style={{ flexDirection: 'row', minHeight: TOUCH, minWidth: 0, flex: 1, alignItems: 'center', gap: 12 }}>
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
      {menu}
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
    <Pressable {...ITEM} accessibilityRole="button" onPress={press} style={{ flexDirection: 'row', minHeight: TOUCH, width: '100%', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
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
  const { locale } = useSettings();
  const caption = webLine([['read', 12, 12 * BODY.lineHeight], ['pixel', 20, 20]], locale);
  return (
    // The web's `figure frame bg-night-900 px-2 pb-1.5 pt-2`.
    <Framed kind="frame" style={{ backgroundColor: COLORS['night-900'], paddingHorizontal: 8, paddingBottom: 6, paddingTop: 8 }}>
      {/* The web's `flex items-baseline`: the words (a reading 12, the page's line of 1.45) and the figure (a pixel 20, `leading-none`) on the browser's
          baseline, the caption as tall as the browser makes it (a native row on its texts' baselines is taller: the kit moves glyphs inside their boxes). */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, paddingHorizontal: 4, height: caption.height }}>
        <ReadText size={12} tone="ink-300" style={{ flexShrink: 1, marginTop: caption.tops[0] }}>{t('sinceStart')}</ReadText>
        <PixelText size={20} lineHeight={20} tone={up ? 'teal-300' : 'wine-300'} style={{ marginTop: caption.tops[1] }}>{`${change > 0 ? '+' : ''}${change}%`}</PixelText>
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
    <Pressable {...ITEM} accessibilityRole="button" onPress={press} style={{ flexDirection: 'row', minHeight: TOUCH, width: '100%', alignItems: 'center', gap: 12, paddingVertical: 6 }}>
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
  const { view, shown } = useRound();
  const orders = useGame((s) => s.orders);
  const rules = useGame((s) => s.rules);
  const addOrder = useGame((s) => s.addOrder);
  const quote = useMemo(() => quoteProperty(content, shown, typeId), [content, shown, typeId]);
  const [mortgage, setMortgage] = useState<'fixed' | 'variable' | 'none'>(quote.canBorrow ? 'fixed' : 'none');
  const [down, setDown] = useState(quote.minDown);
  // What nobody can live in is bought to let, and there is nothing to choose.
  const [rented, setRented] = useState(quote.letOnly);
  const cashDown = mortgage === 'none' ? quote.price : down;
  const order = useMemo<Order>(() => ({ type: 'buyProperty', typeId, downPayment: mortgage === 'none' ? 0 : down, mortgage, rented }), [typeId, down, mortgage, rented]);
  // What the home would leave of the way out, as it is set up now: its taxes and upkeep, the mortgage's payments, a rent if let.
  const shift = useMemo(() => escapeShift(content, view, orders, [...orders, order], rules), [content, view, orders, order, rules]);
  const step = Math.max(100_000, Math.round(quote.price / 100 / 100_000) * 100_000);
  const { locale } = useSettings();
  const downLine = webLine([['pixel', 14, 14 * 1.1], ['pixel', 17, 17 * 1.1]], locale);

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
            {/* The web's `flex items-baseline`: the heading (a pixel 14) and the amount (a pixel 17) on the browser's baseline. */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', height: downLine.height }}>
              <View style={{ marginTop: downLine.tops[0] }}>
                <SheetHeading>{t('down')}</SheetHeading>
              </View>
              <PixelText size={17} style={{ marginTop: downLine.tops[1] }}>{fmt.money(down)}</PixelText>
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
        <EscapeLine shift={shift} buying />
        <Button
          variant="primary"
          wide
          // Something only a landlord can own is not for sale to anyone else: the line above says why.
          disabled={quote.letOnly && !quote.canRentOut}
          onPress={() => {
            if (addOrder(order)) onClose();
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
  const menuWords = useT('phone.menu');
  const common = useT('common');
  const { text, names, fmt } = useWords();
  const open = usePress({ onPress: () => onOpen(id), disabled: sold });
  // Held, on the phone: everything about it, and what its buttons below do.
  const { held, menu } = useHoldMenu({
    title: homeName(text, typeId, cityId),
    closeLabel: common('close'),
    actions: sold
      ? []
      : [
          { label: menuWords('details'), onPress: () => onOpen(id) },
          ...(mine && !letOnly ? [{ label: rented ? t('stopRenting') : t('startRenting'), onPress: () => onRent(id, !rented, wasRented) }] : []),
          ...(mine ? [{ label: t('sell', { amount: fmt.compact(value) }), onPress: () => onSell(id), danger: true }] : []),
        ],
  });
  return (
    <View style={[{ paddingVertical: 8 }, last ? null : { borderBottomWidth: 2, borderBottomColor: COLORS['night-900'] }]}>
      {/* A tap on the home itself opens everything about it. What can be done with it stays on the buttons below. */}
      <Pressable {...ITEM} {...held} accessibilityRole="button" accessibilityState={{ disabled: sold }} disabled={sold} onPress={open} style={{ flexDirection: 'row', width: '100%', alignItems: 'center', gap: 12 }}>
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
      {menu}
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
      <Raised marks={ITEM.dataSet} place={{ flexGrow: 1 }} style={{ flexGrow: 1, alignItems: 'center', gap: 4, padding: 8 }} onPress={() => onBuy(typeId)}>
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
  const wide = useIsWide();
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
            {/* On a phone the way to pay it off is under the name (the web's `sm:hidden` one), so the name has the row: it is cut to its line, as the web cuts it.
                From the web's `sm` up there is room for it beside what is owed (its `max-sm:hidden` one). */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Bare style={{ width: 32, height: 32 }}>
                <Sprite id={debtArt(debt)} />
              </Bare>
              <View style={{ minWidth: 0, flex: 1 }}>
                <ReadText numberOfLines={1}>{debtLabel(words, debt, p.properties)}</ReadText>
              </View>
              <PixelText>{fmt.money(debt.principal)}</PixelText>
              {wide && debt.peer === undefined ? (
                <Button variant="secondary" onPress={() => setRepaying(debt)} disabled={p.cash <= 0}>
                  {t('repay')}
                </Button>
              ) : null}
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
              {!wide && debt.peer === undefined ? (
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
    // The web's button is as wide as its words (inline in its column): its underline is theirs, under every line they wrap to (`underline-offset-2`).
    <Pressable accessibilityRole="button" onPress={press} style={{ ...SWITCH_REACH.style, marginTop: 2 - SWITCH_REACH.top, alignSelf: 'flex-start' }}>
      <LinkText size={12} offset={2} tone={tone}>
        {ordered ? t(quote.to === 'fixed' ? 'switchingToFixed' : 'switchingToVariable') : t(quote.to === 'fixed' ? 'switchToFixed' : 'switchToVariable')}
      </LinkText>
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
// Cities

/** A crest as its art draws it where it is missing (the web's fallback), and drawn into a square of 36 on a row of the cities (`size-9`, `!h-full !w-full`). */
const CREST = { w: 64, h: 64 } as const;
const CREST_ROW = { w: 36, h: 36 } as const;

/** A city a card offers to move to, beside the one the player lives in: the same comparison as in the finances, nothing to order. */
export function CityPreview({ cityId, view, onClose }: { cityId: string; view: GameView; onClose(): void }) {
  const common = useT('common');
  const { content, names } = useWords();
  const city = content.cities.find((x) => x.id === cityId);
  // The year there, worked out once for the life as it stands.
  const quote = useMemo(() => (city ? quoteMove(content, view, city.id) : null), [content, view, city]);
  if (!city || !quote) return null;
  return (
    <Sheet open onClose={onClose} title={names.cities[city.id]} closeLabel={common('close')}>
      <CityDetail city={city} quote={quote} p={view.player} world={view.timeline[view.round]} onBack={onClose} onMoved={onClose} asked />
    </Sheet>
  );
}

// ------------------------------------------------------------------------------------------------
// Lifestyle

/** Small capitals over a list (the web's `text-[11px] uppercase tracking-wider text-ink-300`). */
function SmallCaps({ children }: { children: string }) {
  return <ReadText size={11} tone="ink-300" style={{ textTransform: 'uppercase', letterSpacing: 11 * 0.05 }}>{children}</ReadText>;
}

/**
 * One line of a year in a city: what it is here, and what it would be there, the better of the two in green (the web's `flex items-baseline
 * justify-between gap-2 py-1`; `strong`, the line that sums the year up, set off by a rule and in the pixel face).
 */
function Versus({ label, here, there, more = 'better', strong = false }: { label: string; here: number; there?: number; more?: 'better' | 'worse'; strong?: boolean }) {
  const { fmt } = useWords();
  const { locale } = useSettings();
  const gain = there === undefined ? 0 : more === 'better' ? there - here : here - there;
  const tone: ColorToken = gain > 0 ? 'teal-300' : gain < 0 ? 'wine-300' : 'cream';
  // The web's `flex items-baseline`: the label (a pixel 15, or a reading 14 in the page's line of 1.45) and the figures (pixel 15s) on the browser's baseline,
  // the row as tall as the browser makes it (a native row on its texts' baselines stood 5 points taller: the kit moves glyphs inside their boxes).
  const line = webLine([strong ? ['pixel', 15, 15 * 1.1] : ['read', 14, 14 * BODY.lineHeight], ['pixel', 15, 15 * 1.1]], locale);
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, paddingVertical: 4 }, strong ? { borderTopWidth: 2, borderTopColor: COLORS['night-900'], paddingTop: 6 } : null]}>
      <View style={{ flexShrink: 1, minWidth: 0, height: line.height }}>
        {strong ? (
          <PixelText numberOfLines={1} style={{ marginTop: line.tops[0] }}>{label}</PixelText>
        ) : (
          <ReadText size={14} numberOfLines={1} style={{ marginTop: line.tops[0] }}>{label}</ReadText>
        )}
      </View>
      <View style={{ flexShrink: 0, flexDirection: 'row', alignItems: 'flex-start', marginTop: line.tops[1] }}>
        {there === undefined ? (
          <PixelText size={15} style={{ textAlign: 'right' }}>{fmt.money(here)}</PixelText>
        ) : (
          <>
            <PixelText size={15} tone="ink-300">{fmt.compact(here)}</PixelText>
            <View aria-hidden style={{ marginHorizontal: 4 }}>
              <PixelText size={15} tone="ink-300">{'→'}</PixelText>
            </View>
            <PixelText size={15} tone={tone}>{fmt.compact(there)}</PixelText>
          </>
        )}
      </View>
    </View>
  );
}

/**
 * Every city, and for each the player's own year there beside the year they have: pay, tax, costs
 * and what is left, as the move would leave them. All of it is the engine's quote, worked out once for the round as it stands; each city's row is
 * drawn again only when what it shows changes.
 */
function MoveSheet({ onClose }: { onClose(): void }) {
  const t = useT('finance.lifestyle');
  const common = useT('common');
  const { content, names } = useWords();
  const { shown, p, world } = useRound();
  // One city at a time in full; the list is short, a row a city.
  const [chosen, setChosen] = useState<string | null>(null);
  const choose = useCallback((cityId: string) => setChosen(cityId), []);
  const quotes = useMemo(() => content.cities.map((city) => ({ city, quote: quoteMove(content, shown, city.id) })), [content, shown]);
  // Where the year leaves the most first, the city lived in at the top.
  const listed = useMemo(() => {
    const here = quotes.find((entry) => entry.city.id === p.cityId);
    const others = quotes.filter((entry) => entry.city.id !== p.cityId).sort((a, b) => b.quote.there.leftAnnual - a.quote.there.leftAnnual);
    return [...(here ? [here] : []), ...others];
  }, [quotes, p.cityId]);
  const open = chosen ? quotes.find((entry) => entry.city.id === chosen) : undefined;

  return (
    <Sheet open onClose={onClose} title={open ? names.cities[open.city.id] : t('moveTitle')} closeLabel={common('close')}>
      {open ? (
        <CityDetail city={open.city} quote={open.quote} p={p} world={world} onBack={() => setChosen(null)} onMoved={onClose} />
      ) : (
        <View style={{ gap: 8 }}>
          <Explain>{t('moveAbout', { level: content.life.skills.languagesKeepRungFrom })}</Explain>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <SmallCaps>{t('left')}</SmallCaps>
          </View>
          <View role="list" style={{ gap: 6 }}>
            {listed.map(({ city, quote }) => {
              const home = city.id === p.cityId;
              const gain = quote.there.leftAnnual - quote.here.leftAnnual;
              return (
                <CityRow
                  key={city.id}
                  cityId={city.id}
                  home={home}
                  left={home ? quote.here.leftAnnual : quote.there.leftAnnual}
                  tone={home ? 'cream' : gain > 0 ? 'teal-300' : gain < 0 ? 'wine-300' : 'cream'}
                  onOpen={choose}
                />
              );
            })}
          </View>
        </View>
      )}
    </Sheet>
  );
}

/**
 * A city on the list, to be pressed to open it (the web's `frame-raised flex min-h-12 w-full items-center gap-2 bg-night-600 px-2 py-1.5`, gold for
 * the city lived in): its crest, its name, and what the year leaves there. Drawn again only when one of these changes.
 */
const CityRow = memo(function CityRow({ cityId, home, left, tone, onOpen }: { cityId: string; home: boolean; left: number; tone: ColorToken; onOpen(cityId: string): void }) {
  const t = useT('finance.lifestyle');
  const { names, fmt } = useWords();
  return (
    <View role="listitem">
      <Raised tone={home ? GOLD : undefined} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 6 }} onPress={() => onOpen(cityId)}>
        <Bare style={{ width: 36, height: 36 }}>
          <Sprite id={crestArt(cityId)} fallback={CREST} size={CREST_ROW} />
        </Bare>
        <View style={{ flex: 1, minWidth: 0 }}>
          <PixelText size={16} numberOfLines={1}>{names.cities[cityId]}</PixelText>
          {/* Inline after the name's block, in a line of the page's words (the web's span round both is no flex box). */}
          {home ? <LineTag tone="good">{t('here')}</LineTag> : null}
        </View>
        <PixelText size={16} tone={tone} style={{ flexShrink: 0, textAlign: 'right' }}>{fmt.compact(left)}</PixelText>
      </Raised>
    </View>
  );
});

/**
 * A city beside the one the player lives in: what it is, what the year would leave there beside here, and the figures behind that folded away
 * until asked for; then what a move costs, and the move itself. In the finances it is where a move is ordered; shown from a card that offers a
 * move (`asked`), it only compares: the card says what the move costs.
 */
function CityDetail({ city, quote, p, world, onBack, onMoved, asked = false }: { city: CityDef; quote: ReturnType<typeof quoteMove>; p: PlayerState; world: WorldState; onBack(): void; onMoved(): void; asked?: boolean }) {
  const t = useT('finance.lifestyle');
  const { content, text, names, fmt } = useWords();
  const setOrder = useGame((s) => s.setOrder);
  const [numbers, setNumbers] = useState(false);
  const job = p.life.career;
  const years = content.yearsPerRound;
  const here = city.id === p.cityId;
  const tax = effectiveTax(city, world);
  const { here: now, there } = quote;
  /** A line of what the move brings (the web's `li` of `text-[13px] leading-snug`). */
  const said = (words: string, tone: ColorToken = 'cream') => (
    <View role="listitem">
      <ReadText size={13} lineHeight={13 * SNUG} tone={tone}>{words}</ReadText>
    </View>
  );

  return (
    <View role="region" aria-label={names.cities[city.id]} style={{ gap: 8 }}>
      {asked ? null : (
        // The web's `self-start`: as wide as its words.
        <View style={{ alignSelf: 'flex-start' }}>
          <Button variant="quiet" size={14} onPress={onBack}>
            {t('allCities')}
          </Button>
        </View>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Sprite id={crestArt(city.id)} fallback={CREST} />
        <View style={{ flexShrink: 1, minWidth: 0 }}>
          {/* Inline before the tagline, in a line of the page's words (the web's `div.min-w-0` round both is no flex box). */}
          {here ? <LineTag tone="good">{t('here')}</LineTag> : null}
          <ReadText size={13} lineHeight={13 * SNUG} tone="ink-300">{text.cities[city.id].tagline}</ReadText>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Tag tone="good">{t('cityStatus', { n: city.prestige })}</Tag>
      </View>

      {here ? null : (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
          <SmallCaps>{t('yearHere')}</SmallCaps>
          <View aria-hidden>
            <SmallCaps>{'→'}</SmallCaps>
          </View>
          <SmallCaps>{t('yearThere')}</SmallCaps>
        </View>
      )}
      <Versus strong label={t('left')} here={now.leftAnnual} there={here ? undefined : there.leftAnnual} />
      {/* The web's quiet button (`text-[14px]`, as wide as the sheet), which says whether what it folds is open. */}
      <Raised expanded={numbers} bg="night-700" style={{ paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }} onPress={() => setNumbers((open) => !open)}>
        <PixelText size={14} tone="ink-200" style={{ textAlign: 'center' }}>{t(numbers ? 'hideNumbers' : 'showNumbers')}</PixelText>
      </Raised>
      {numbers ? (
        <View>
          <Versus label={t('yourPay')} here={now.payAnnual} there={here ? undefined : there.payAnnual} />
          {now.partnerAnnual > 0 || there.partnerAnnual > 0 ? <Versus label={t('partnerPay')} here={now.partnerAnnual} there={here ? undefined : there.partnerAnnual} /> : null}
          <Versus label={t('incomeTax')} here={now.taxAnnual} there={here ? undefined : there.taxAnnual} more="worse" />
          <Versus label={t('costs')} here={now.costAnnual} there={here ? undefined : there.costAnnual} more="worse" />
          <ReadText size={12} tone="ink-300" style={{ marginTop: 4 }}>
            {t('taxRates', { income: tax.incomeRatesBp.map((rate) => fmt.rate(rate)).join(' · '), gains: fmt.rate(tax.capitalGainsBp) })}
          </ReadText>
        </View>
      ) : null}

      {here || asked ? null : (
        <>
          <View role="list" style={{ marginVertical: 4, gap: 4 }}>
            {/* How far it is, beside what it costs: the further, the dearer. */}
            {said(city.distanceKm?.[p.cityId] ? t('moveCostFar', { amount: fmt.money(quote.cost), km: fmt.number(city.distanceKm[p.cityId]) }) : t('moveCost', { amount: fmt.money(quote.cost) }))}
            {/* Going home: what is waiting there, said before the move is ordered. */}
            {quote.home ? said(t(quote.home.helped ? 'homeHelped' : 'homeBack'), 'teal-300') : null}
            {job && quote.rungsLost > 0 && there.level !== null ? said(t('moveRung', { title: text.careers[job.id].levels[there.level] }), 'wine-300') : null}
            {/* A move that costs no rung still pays a little less for its first round there. Older rules know nothing of it. */}
            {job && (quote.payCutPct ?? 0) > 0 ? said(t('moveSettling', { pct: fmt.rate((quote.payCutPct ?? 0) * 100) }), 'wine-300') : null}
            {quote.partnerIdleRounds > 0 ? said(t('movePartner', { years: quote.partnerIdleRounds * years }), 'wine-300') : null}
            {/* Said before the move is ordered: what belongs to this city does not come along. */}
            {quote.lapses.length > 0 ? said(t('moveLapses', { items: quote.lapses.map((id) => names.items[id]).join(', ') }), 'wine-300') : null}
          </View>
          <Button
            variant="secondary"
            wide
            onPress={() => {
              if (setOrder((order) => order.type === 'moveCity', { type: 'moveCity', cityId: city.id })) onMoved();
            }}
          >
            {t('moveHere')}
          </Button>
        </>
      )}
    </View>
  );
}

const INSURANCES: readonly InsuranceKind[] = ['health', 'home', 'life'];

/** Status points with their sign: +3, −3, 0. */
const points = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

/**
 * Props alike, for a memoised control: each the same value, a list compared value by value (its words and figures are made anew each time the tab
 * is drawn, and are the same while the round leaves them so).
 */
function alike<P extends object>(a: P, b: P): boolean {
  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  const keys = Object.keys(x);
  return (
    keys.length === Object.keys(y).length &&
    keys.every((key) => {
      const one = x[key];
      const other = y[key];
      return Object.is(one, other) || (Array.isArray(one) && Array.isArray(other) && one.length === other.length && one.every((value, i) => Object.is(value, other[i])));
    })
  );
}

/**
 * The way of life, in panels as the web's tab lays it: how the job is done, the round's focus at work and in study, the life's own uses of it, how
 * and where the player lives, the insurances, and the city. Every control is a memoised piece given what it shows, and orders through the round
 * store's one `setOrder`: pressing one draws again that one, and leaves every other as it is (the engine's quotes of the round are worked out once
 * for it, here).
 *
 * The tab is several screens tall: it draws the panels of work and study first (what a phone shows with the tab), and the rest once those are on
 * screen (`useDrawnFirst`): all of it at once kept the tab from the screen for some thirty pictures and nine hundred views (measured, the parity report).
 */
function Lifestyle() {
  const knows = useKnows();
  const t = useT('finance.lifestyle');
  const wording = useT('work');
  const common = useT('common');
  const words = useWords();
  const { content, text, fmt } = words;
  const { view, shown, p } = useRound();
  const ordered = useFocusOrdered();
  const backOrdered = useGame((s) => s.orders.some((order) => order.type === 'backToWork'));
  const moveOrdered = useGame((s) => s.orders.some((order) => order.type === 'moveCity'));
  const setOrder = useGame((s) => s.setOrder);
  const focus = useSetFocus();
  // Where a scene says so, the sheet of every city is open from the start.
  const opened = useContext(FinanceOpened);
  const [moving, setMoving] = useState(opened.sheet === 'move');
  const move = useCallback(() => setMoving(true), []);
  // The panels under the first screen, once the first are on it.
  const rest = useDrawnFirst();
  const living = useMemo(() => quoteLiving(content, shown), [content, shown]);
  // What each use of focus is worth to this player, counting what they own.
  const work = useMemo(() => quoteWork(content, shown), [content, shown]);
  const skills = useMemo(() => quoteSkills(content, shown), [content, shown]);
  const career = p.life.career ? content.careers.find((c) => c.id === p.life.career?.id) : undefined;
  const has = (action: FocusAction) => ordered.includes(action);
  const left = focusLeft(p);
  const note = useFocusNote();
  const jobUses = career
    ? ([
        ['overtime', t('overtime'), t('overtimeHint', { pct: career.overtimePct })],
        ['studyCareer', t('study'), t('studyHint', { n: work.studySkill })],
        ['jobHunt', t('hunt'), t('huntHint', { pct: work.jobHuntChancePct })],
        ['askRaise', t('raise'), t('raiseHint', { chance: work.raise.chancePct, pct: work.raise.pct })],
      ] as const)
        .filter(([action]) => knows(`focus:${action}`))
        .map(([action, label, gives]) => ({ action, label: jobFocusName(words, career.id, action, label), note: note(work, action, gives) }))
    : [];
  const learn = splitMastered([
    { action: skills.finance.study, label: text.focusActions[skills.finance.study], note: note(work, skills.finance.study, t('learnHint', { n: skills.finance.studyPoints, skill: wording('finance'), level: skills.finance.level })) },
    ...skills.skills.flatMap((skill) =>
      skill.study === null ? [] : [{ action: skill.study, label: text.focusActions[skill.study], note: note(work, skill.study, t('learnHint', { n: skill.studyPoints, skill: text.skills[skill.skill], level: skill.level })) }],
    ),
  ]);
  const perYear = (cents: number) => common('perYear', { amount: fmt.compact(cents) });
  // A use that cannot be had now (asked too lately, or not open to this player) is not shown at all; one out of reach of the focus left is, its
  // switch off, since taking another back gives the focus for it.
  const switchOf = (use: { action: FocusAction; label: string; note: FocusNote }) => {
    const on = has(use.action);
    if (use.note.locked && !on) return null;
    return <FocusSwitch key={use.action} action={use.action} on={on} disabled={!on && left < 1} label={use.label} hint={use.note.hint} burnout={use.note.burnout} onFocus={focus} />;
  };

  return (
    <View style={{ gap: 12 }}>
      {/* How the job is done, apart from the focus: half the day anywhere, and from home where the job allows it, a few rungs up. */}
      {career && knows('setWorkMode') ? (
        <WorkModes
          current={work.workMode.current}
          remote={work.workMode.remote}
          before={workModeOf(view.player, content)}
          hint={
            work.workMode.current === 'office'
              ? t('officeHint')
              : work.workMode.current === 'remote'
                ? t('remoteHint', { focus: work.workMode.rules.remote.focus, hunt: work.workMode.rules.remote.huntOffPct })
                : t('partTimeHint', { focus: work.workMode.rules.partTime.focus, pay: work.workMode.rules.partTime.payPct })
          }
        />
      ) : null}

      <Panel title={t('work')}>
        {career ? (
          <View style={{ gap: 8 }}>
            <ReadText size={13} tone="ink-300">{t('focusLeft', { left, total: work.focus.total })}</ReadText>
            {jobUses.map(switchOf)}
            <CareerMoves work={work} left={left} />
          </View>
        ) : work.backToWork && knows('backToWork') ? (
          // Left for a business: the way back, a rung lower.
          <View style={{ gap: 6 }}>
            <Button variant={backOrdered ? 'primary' : 'secondary'} onPress={() => setOrder((order) => order.type === 'backToWork', backOrdered ? null : { type: 'backToWork' })}>
              {t('back', { job: text.careers[work.backToWork.careerId].levels[work.backToWork.level] })}
            </Button>
            <ReadText size={12} lineHeight={12 * SNUG} tone="ink-300">{t('backHint')}</ReadText>
          </View>
        ) : (
          <ReadText size={14} tone="ink-300">{t('noJob')}</ReadText>
        )}
      </Panel>

      {/* Skills of one's own: each a point of focus, and no job needed. What is mastered is only named, on one line. */}
      <Panel title={t('learn')} label={t('learn')}>
        <View style={{ gap: 8 }}>
          {learn.open.length > 0 ? <ReadText size={13} tone="ink-300">{t('learnAbout')}</ReadText> : null}
          {learn.open.map(switchOf)}
          <MasteredLine names={learn.mastered.map((use) => use.label)} />
        </View>
      </Panel>

      {rest ? (
        <>
          {/* What focus is for besides work and study: the family, and a rest. */}
          <LifeUses left={left} title={t('time')} />

      {/* With friends, a round's focus can go on teasing one of them: here too, beside the rest of the focus. */}
      <TeaseUse left={left} title={t('rivals')} />

      <Tiers
        value={p.lifestyleTier}
        before={view.player.lifestyleTier}
        min={p.life.minLifestyleTier}
        hints={living.tiers.map(perYear)}
        status={`${t('tierStatus')} ${text.lifestyleTiers.map((name, tier) => `${name} ${points(living.lifestyleStatus[tier])}`).join(' · ')}${living.worse.frugal ? ` · ${t('frugalLate', { age: ageAt(content, living.worse.frugal.fromRound), n: -living.worse.frugal.status })}` : ''}`}
      />

      <Rents
        value={p.life.rentTier}
        before={view.player.life.rentTier}
        hints={living.rentTiers ? ([0, 1] as const).map((tier) => perYear(living.rentTiers?.[tier] ?? 0)) : null}
        status={`${t('tierStatus')} ${text.rentTiers.map((name, tier) => `${name} ${points(living.rentStatus[tier])}`).join(' · ')}${living.worse.room ? ` · ${t('roomLate', { age: ageAt(content, living.worse.room.fromRound), n: -living.worse.room.status })}` : ''}`}
      />

      <Panel title={t('insurance')}>
        <View style={{ gap: 8 }}>
          {INSURANCES.map((kind) => (
            <InsuranceSwitch
              key={kind}
              kind={kind}
              on={p.life.insurance[kind]}
              before={view.player.life.insurance[kind]}
              disabled={kind === 'health' && living.health.refused && !p.life.insurance.health}
              hint={common('perYear', { amount: fmt.money(living.insurance[kind]) })}
            />
          ))}
          <HealthCoverNote living={living} />
        </View>
      </Panel>

          <CityPanel cityId={p.cityId} movingTo={p.life.movingTo} moveOrdered={moveOrdered} onMove={move} />
          <PerfDrawn name="tab: lifestyle, every panel" />
        </>
      ) : null}
      {moving ? <MoveSheet onClose={() => setMoving(false)} /> : null}
    </View>
  );
}

/**
 * What a change of the way of life ordered leaves of the way out (`EscapeLine`): the basket with it against the basket without it. Nothing
 * while it is not ordered. It reads the basket itself, so the memoised panel it stands in is not drawn again for every order.
 */
function LivingEscape({ type }: { type: 'setLifestyle' | 'setRentTier' }) {
  const { content } = useWords();
  const view = useGame((s) => s.view);
  const orders = useGame((s) => s.orders);
  const rules = useGame((s) => s.rules);
  const shift = useMemo(
    () => (view && orders.some((order) => order.type === type) ? escapeShift(content, view, orders.filter((order) => order.type !== type), orders, rules) : null),
    [content, view, orders, type, rules],
  );
  return shift ? (
    <View style={{ marginTop: 8 }}>
      <EscapeLine shift={shift} buying={false} />
    </View>
  ) : null;
}

/** How the job is done (the web's panel of a Segmented and its hint, `-mt-1` under it): drawn again only when one of these changes. */
const WorkModes = memo(function WorkModes({ current, remote, before, hint }: { current: WorkMode; remote: boolean; before: WorkMode; hint: string }) {
  const t = useT('finance.lifestyle');
  const setOrder = useGame((s) => s.setOrder);
  return (
    <Panel title={t('mode')}>
      <View style={{ gap: 8 }}>
        <Segmented<WorkMode>
          label={t('mode')}
          value={current}
          onChange={(mode) => setOrder((order) => order.type === 'setWorkMode', mode === before ? null : { type: 'setWorkMode', mode })}
          options={(['office', 'remote', 'partTime'] as const).filter((mode) => mode !== 'remote' || remote).map((mode) => ({ value: mode, label: t(mode) }))}
        />
        <ReadText size={12} tone="ink-300" style={{ marginTop: -4 }}>{hint}</ReadText>
      </View>
    </Panel>
  );
});

/** How the player lives, two to a row (the web's `grid-cols-2`), what each costs a year, and what each does to status. Drawn again only when one of these changes. */
const Tiers = memo(function Tiers({ value, before, min, hints, status }: { value: LifestyleTier; before: LifestyleTier; min: number; hints: readonly string[]; status: string }) {
  const t = useT('finance.lifestyle');
  const { text } = useWords();
  const setOrder = useGame((s) => s.setOrder);
  return (
    <Panel title={t('tier')}>
      <Segmented<LifestyleTier>
        label={t('tier')}
        columns={2}
        value={value}
        onChange={(tier) => setOrder((order) => order.type === 'setLifestyle', tier === before ? null : { type: 'setLifestyle', tier })}
        options={([0, 1, 2, 3] as const).map((tier) => ({ value: tier, label: text.lifestyleTiers[tier], icon: lifestyleArt[tier], hint: hints[tier], disabled: tier < min }))}
      />
      <ReadText size={12} tone="ink-300" style={{ marginTop: 8 }}>{status}</ReadText>
      {min > 0 ? <ReadText size={12} tone="ink-300" style={{ marginTop: 8 }}>{t('tierFloor')}</ReadText> : null}
      <LivingEscape type="setLifestyle" />
    </Panel>
  );
}, alike);

/** Where the player lives, a room or a flat, for someone who rents (`hints` null for an owner, who pays none). Drawn again only when one of these changes. */
const Rents = memo(function Rents({ value, before, hints, status }: { value: RentTier; before: RentTier; hints: readonly string[] | null; status: string }) {
  const t = useT('finance.lifestyle');
  const { text } = useWords();
  const setOrder = useGame((s) => s.setOrder);
  return (
    <Panel title={t('home')}>
      {hints ? (
        <>
          <Segmented<RentTier>
            label={t('home')}
            value={value}
            onChange={(tier) => setOrder((order) => order.type === 'setRentTier', tier === before ? null : { type: 'setRentTier', tier })}
            options={([0, 1] as const).map((tier) => ({ value: tier, label: text.rentTiers[tier], icon: rentTierIcon[tier], hint: hints[tier] }))}
          />
          <ReadText size={12} tone="ink-300" style={{ marginTop: 8 }}>{status}</ReadText>
          <LivingEscape type="setRentTier" />
        </>
      ) : (
        <ReadText size={14} tone="ink-300">{t('ownerNote')}</ReadText>
      )}
    </Panel>
  );
}, alike);

/** A cover, as a switch: ordered on or off against what the life had (the same as it had is no order). Drawn again only when what it shows changes. */
const InsuranceSwitch = memo(function InsuranceSwitch({ kind, on, before, disabled, hint }: { kind: InsuranceKind; on: boolean; before: boolean; disabled: boolean; hint: string }) {
  const { text } = useWords();
  const setOrder = useGame((s) => s.setOrder);
  return (
    <Toggle
      on={on}
      onChange={(next) => setOrder((order) => order.type === 'setInsurance' && order.insurance === kind, next === before ? null : { type: 'setInsurance', insurance: kind, on: next })}
      disabled={disabled}
      label={text.insurance[kind]}
      icon={insuranceArt[kind]}
      hint={hint}
    />
  );
});

/** The city the player lives in, and the way to another, or the move ordered and the way to stay (the web's last panel). Drawn again only when one of these changes. */
const CityPanel = memo(function CityPanel({ cityId, movingTo, moveOrdered, onMove }: { cityId: string; movingTo: string | null; moveOrdered: boolean; onMove(): void }) {
  const t = useT('finance.lifestyle');
  const { text, names } = useWords();
  const setOrder = useGame((s) => s.setOrder);
  return (
    <Panel title={t('city')}>
      <View style={{ marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Bare style={{ width: 36, height: 36 }}>
          <Sprite id={cityIcon(cityId)} />
        </Bare>
        <View style={{ flexShrink: 1, minWidth: 0 }}>
          <PixelText size={18}>{names.cities[cityId]}</PixelText>
          <ReadText size={13} lineHeight={13 * SNUG} tone="ink-200">{text.cities[cityId].tagline}</ReadText>
        </View>
      </View>
      {movingTo ? (
        <>
          <ReadText size={14} tone="gold-500" style={{ marginBottom: 8 }}>{t('moving', { city: names.cities[movingTo] })}</ReadText>
          {moveOrdered ? (
            <Button variant="secondary" wide onPress={() => setOrder((order) => order.type === 'moveCity', null)}>
              {t('stay')}
            </Button>
          ) : null}
        </>
      ) : (
        <Button variant="secondary" wide onPress={onMove}>
          {/* The web's `-my-1`: the sign takes 4 less above and below than it is tall. */}
          <Sprite id="icon.move" style={MOVE_SIGN} />
          {t('move')}
        </Button>
      )}
    </Panel>
  );
});
const MOVE_SIGN = { marginVertical: -4 } as const;

// ------------------------------------------------------------------------------------------------
// Shop

type ShopView = 'affordable' | 'all';

/** The picture of a thing where it is missing (the web's fallback), and the box it stands in on a tile: as tall as a watch, as wide as the thing needs (`h-16 min-w-16`). */
const THING = { w: 64, h: 64 } as const;
const THING_BOX = { height: 64, minWidth: 64 } as const;

/**
 * The same thing second hand, set off by a rule under the new one: what it costs, what it gives at
 * its age, and the repairs that may come. Paid in cash only.
 */
function SecondHand({ used, onBought }: { used: UsedQuote; onBought(): void }) {
  const t = useT('finance.shop');
  const { content, text, fmt } = useWords();
  return (
    <View role="region" aria-label={t('usedTitle')} style={{ gap: 8, borderTopWidth: 2, borderTopColor: COLORS['night-900'], paddingTop: 12 }}>
      {/* The web's `pixel flex items-center gap-2 text-[14px] uppercase tracking-[0.1em] text-gold-200`. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Sprite id={USED_ART} />
        <PixelText size={14} tone="gold-200" style={{ flexShrink: 1, textTransform: 'uppercase', letterSpacing: 14 * 0.1 }}>{t('usedTitle')}</PixelText>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 }}>
        {/* What it adds, as for a new one: a better one of its kind owned counts first. */}
        {used.statusReal > 0 ? <Tag tone="good">{t('status', { n: used.statusReal })}</Tag> : null}
        <Tag>{t('usedAge', { years: used.ageRounds * content.yearsPerRound })}</Tag>
      </View>
      {used.statusReal < used.status ? (
        <ReadText size={13} lineHeight={13 * SNUG} tone="ink-300" style={{ textAlign: 'center' }}>{t(used.statusReal <= 0 ? 'statusNone' : 'statusLess', { n: used.statusReal, of: used.status })}</ReadText>
      ) : null}
      <ReadText size={13} lineHeight={13 * SNUG} tone="ink-300" style={{ textAlign: 'center' }}>
        {`${t('usedRisk', { pct: used.repairChancePct, amount: fmt.money(used.repairCost) })} ${t('usedWarranty')}`}
      </ReadText>
      <Button variant="secondary" wide disabled={used.lock !== null} onPress={onBought}>
        {t('buyUsed', { amount: fmt.money(used.price) })}
      </Button>
      {used.lock !== null ? (
        <ReadText size={13} tone="wine-300" style={{ textAlign: 'center' }}>{text.reasons[used.lock]}</ReadText>
      ) : (
        <ReadText size={13} tone="ink-300" style={{ textAlign: 'center' }}>{t('resale', { amount: fmt.money(used.resale) })}</ReadText>
      )}
    </View>
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
    <View role="region" aria-label={t('noInvoiceTitle')} style={{ gap: 8, borderTopWidth: 2, borderTopColor: COLORS['night-900'], paddingTop: 12 }}>
      <PixelText size={14} tone="gold-200" style={{ textTransform: 'uppercase', letterSpacing: 14 * 0.1 }}>{t('noInvoiceTitle')}</PixelText>
      <ReadText size={13} lineHeight={13 * SNUG} tone="ink-300" style={{ textAlign: 'center' }}>
        {t('noInvoiceRisk', { pct: offer.discountPct, suspicion: content.evasion.noInvoiceSaleSuspicion, goods: content.evasion.auditGoodsPct })}
      </ReadText>
      <Button variant="secondary" wide disabled={offer.lock !== null} onPress={onBought}>
        {t('buyNoInvoice', { amount: fmt.money(offer.price) })}
      </Button>
      {offer.lock !== null ? <ReadText size={13} tone="wine-300" style={{ textAlign: 'center' }}>{text.reasons[offer.lock]}</ReadText> : null}
    </View>
  );
}

/**
 * A thing looked at closely: what it does to status, what it is good for, what it costs to keep and what it would sell for, and every way the shop
 * has of buying it (new, on instalments, second hand, without an invoice), or of selling it or taking the order back. An order taken closes the
 * sheet, and is given once: a second tap before the sheet has gone (a double tap) gives nothing. One refused leaves it open, the refusal said.
 */
function ItemSheet({ itemId, onClose }: { itemId: string; onClose(): void }) {
  const t = useT('finance.shop');
  const common = useT('common');
  const { content, text, names, fmt } = useWords();
  const { view, shown, p } = useRound();
  const orders = useGame((s) => s.orders);
  const rules = useGame((s) => s.rules);
  const inBasket = orders.some((order) => order.type === 'buyItem' && order.itemId === itemId);
  const addOrder = useGame((s) => s.addOrder);
  const setOrder = useGame((s) => s.setOrder);
  const once = useOnce();
  const quote = useMemo(() => quoteItem(content, shown, itemId), [content, shown, itemId]);
  // What buying it would leave of the way out, its upkeep counted: paid at once, and on instalments, whose payments count too.
  const offered = quote.forSale && !inBasket && !p.life.items.some((owned) => owned.itemId === itemId);
  const shift = useMemo(() => (offered ? escapeShift(content, view, orders, [...orders, { type: 'buyItem', itemId }], rules) : null), [content, view, orders, itemId, offered, rules]);
  const financedShift = useMemo(
    () => (offered && quote.finance?.lock === null ? escapeShift(content, view, orders, [...orders, { type: 'buyItem', itemId, financed: true }], rules) : null),
    [content, view, orders, itemId, offered, quote.finance, rules],
  );
  const item = content.items.find((x) => x.id === itemId);
  if (!item) return null;
  const plan = quote.finance;
  const held = p.life.items.find((owned) => owned.itemId === item.id);
  const years = content.yearsPerRound;
  const done = (give: () => boolean) => {
    if (once(give)) onClose();
  };
  const note = (words: string, size: 13 | 14 = 13) => <ReadText size={size} tone="ink-300" style={{ textAlign: 'center' }}>{words}</ReadText>;

  return (
    <Sheet open onClose={onClose} title={names.items[item.id]} closeLabel={common('close')}>
      <View style={{ gap: 12 }}>
        <View style={{ alignItems: 'center' }}>
          <Bare style={{ padding: 8 }}>
            <Sprite id={itemArt(item.id)} scale={2} fallback={THING} />
          </Bare>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 }}>
          <Tag tone={realStatus(quote) > 0 ? 'good' : undefined}>{t('status', { n: realStatus(quote) })}</Tag>
          {quote.status < quote.statusNew ? <Tag>{t('statusWas', { n: quote.statusNew })}</Tag> : null}
          {quote.upkeepAnnual > 0 ? <Tag tone="bad">{t('upkeep', { amount: fmt.money(quote.upkeepAnnual) })}</Tag> : null}
          {item.kind === 'experience' ? <Tag>{t('lasts', { years: item.boostRounds * years })}</Tag> : null}
        </View>
        <StatusNote quote={quote} owned={held !== undefined} />
        <ItemUses item={item} />
        {quote.ages ? note(t(quote.status < quote.statusNew ? 'aged' : 'ages')) : null}
        {quote.local ? note(t('local', { city: names.cities[p.cityId] })) : null}
        {item.kind === 'durable' && !held && quote.forSale ? note(t('resale', { amount: fmt.money(quote.resale) })) : null}
        <ItemCost quote={quote} />

        {inBasket ? (
          <Button variant="secondary" wide onPress={() => done(() => setOrder((order) => order.type === 'buyItem' && order.itemId === item.id, null))}>
            {common('cancel')}
          </Button>
        ) : held ? (
          quote.sellable ? (
            <Button variant="danger" wide onPress={() => done(() => addOrder({ type: 'sellItem', itemId: item.id }))}>
              {item.kind === 'membership' ? t('cancel') : t('sell', { amount: fmt.money(held.value) })}
            </Button>
          ) : held.roundsLeft !== null ? (
            note(t('spent', { years: held.roundsLeft * years }), 14)
          ) : (
            // What only life can give, a degree for one, is not the player's to sell.
            note(t('cardOnly'), 14)
          )
        ) : quote.forSale ? (
          <>
            <EscapeLine shift={shift} buying />
            <Button variant="primary" wide onPress={() => done(() => addOrder({ type: 'buyItem', itemId: item.id }))}>
              {t('buy', { amount: fmt.money(quote.price) })}
            </Button>
            {plan ? (
              <View style={{ gap: 6 }}>
                <Button variant="secondary" wide disabled={plan.lock !== null} onPress={() => done(() => addOrder({ type: 'buyItem', itemId: item.id, financed: true }))}>
                  {t('finance', { amount: fmt.money(plan.down) })}
                </Button>
                {plan.lock !== null ? (
                  <ReadText size={13} tone="wine-300" style={{ textAlign: 'center' }}>{text.reasons[plan.lock]}</ReadText>
                ) : (
                  note(`${t('financeTerms', { loan: fmt.money(plan.loan), rate: fmt.rate(plan.rateBp), years: plan.termRounds * years, annual: fmt.money(plan.annual) })} ${t('financeKept')}`)
                )}
                {/* On instalments it is said only where it is worse than paying at once: where the payments are what send the life back. */}
                {financedShift?.back && !shift?.back ? <EscapeLine shift={financedShift} buying /> : null}
              </View>
            ) : null}
            {quote.used ? <SecondHand used={quote.used} onBought={() => done(() => addOrder({ type: 'buyItem', itemId: item.id, used: true }))} /> : null}
            {quote.noInvoice ? <NoInvoice offer={quote.noInvoice} onBought={() => done(() => addOrder({ type: 'buyItem', itemId: item.id, noInvoice: true }))} /> : null}
          </>
        ) : (
          note(t('cardOnly'), 14)
        )}
      </View>
    </Sheet>
  );
}

/** A thing on a shelf, and how the shop quotes it this round. */
type ShelfItem = { item: ItemDef; quote: ItemQuote; owned: boolean };

/** A thing is in reach if any way the shop offers it can actually be used today. */
const inReach = ({ quote, owned }: ShelfItem, cash: number) =>
  owned || quote.price <= cash || quote.finance?.lock === null || quote.used?.lock === null || quote.noInvoice?.lock === null;

/**
 * The shelves drawn in the frame the shop is opened, and a few more each time the last are on the screen, in the order the kinds of things are
 * listed: the whole shop at once is some sixty tiles, each a picture on a canvas, and the tab would stop for all of them. They are counted in shelves on screen (a kind with nothing in
 * reach takes no frame of its own), and drawn by kind: a shelf once drawn stays, whatever view is asked for (asking for everything or for what is in
 * reach only adds or takes away tiles of the shelves drawn, and shelves further on).
 *
 * Why not a list that draws only what is on screen (`FlatList`): the shop is the panel of a tab in Play's one scrolling page (`StickyScreen`, under
 * the Hud and the row of tabs), and a list inside a scroll of the same direction is given the whole height of its rows by it: it cannot tell what is
 * on screen, so it draws every row all the same (in batches, and React Native warns against it). The page itself would have to be the list, for the
 * one tab. Drawn a few shelves at a time, each tile memoised, the shop costs what a FlatList would here, without it.
 */
const SHELVES_FIRST = 2;
const SHELVES_STEP = 2;

/** From how wide a shelf (its own width, the web's `@container`) a tile lays its picture beside its words: `@min-[400px]`. */
const SHELF_ROW = 400;
/**
 * How wide a shelf will be on a screen this wide, before it is laid out: the column (at most the shell's 448, its gutter of 12 each side inside it) less
 * the panel's 12 each side. A tablet's shelf is 400, a phone's narrower: the first frame has the tiles as they will stay, and the measure confirms it.
 */
const shelfOn = (screen: number) => Math.min(screen, SHELL_WIDTH) - 2 * GUTTER - 2 * 12;

function Shop({ view, onViewChange }: { view: ShopView; onViewChange(view: ShopView): void }) {
  const t = useT('finance.shop');
  const { content, text } = useWords();
  const { shown, p } = useRound();
  // Where a scene says so, a thing's sheet is open from the start (`item-<id>`).
  const opened = useContext(FinanceOpened);
  const [open, setOpen] = useState<string | null>(() => (opened.sheet?.startsWith('item-') ? opened.sheet.slice('item-'.length) : null));
  // The same for every tile and every drawing, so a tile is drawn again only when what it shows changes (`ShelfTile` is memoised).
  const onOpen = useCallback((itemId: string) => setOpen(itemId), []);
  const ladders = useMemo(() => [...new Set(content.items.map((item) => item.ladder))], [content]);
  // Every thing the city sells, quoted once for the round as it stands. The shelf of a city holds what that city sells: what is sold only elsewhere is not shown at all.
  const shelves = useMemo(
    () =>
      ladders.map((ladder) => ({
        ladder,
        items: content.items
          .filter((item) => item.ladder === ladder)
          .map((item) => ({ item, quote: quoteItem(content, shown, item.id), owned: shown.player.life.items.some((owned) => owned.itemId === item.id) }))
          .filter((entry) => entry.quote.soldHere),
      })),
    [content, ladders, shown],
  );
  // In reach, a shelf with nothing on it is left out; with nothing at all, one line says so.
  const visible = useMemo(
    () => shelves.map(({ ladder, items }) => ({ ladder, items: view === 'all' ? items : items.filter((entry) => inReach(entry, p.cash)) })).filter(({ items }) => items.length > 0),
    [shelves, view, p.cash],
  );
  // How far down the kinds the shelves are drawn (an index of `ladders`, every shelf before it drawn): past the next few kinds with something on them.
  const onShelf = useMemo(() => new Set(visible.map(({ ladder }) => ladder)), [visible]);
  const past = useCallback(
    (from: number, more: number) => {
      let seen = 0;
      for (let at = from; at < ladders.length; at++) if (onShelf.has(ladders[at]) && ++seen === more) return at + 1;
      return ladders.length;
    },
    [ladders, onShelf],
  );
  const [upTo, setUpTo] = useState(() => past(0, SHELVES_FIRST));
  // The next shelves once the last are on the screen and the phone draws at its pace again (not the next frame: each frame of shelves would then
  // follow the one before without a frame between, and the tab's first screen would wait for the last shelf; measured, the parity report).
  useEffect(() => {
    if (upTo >= ladders.length) return;
    return whenShown(() => setUpTo((now) => past(now, SHELVES_STEP)));
  }, [upTo, ladders.length, past]);

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 6 }}>
        <Segmented<ShopView> label={t('viewLabel')} options={(['affordable', 'all'] as const).map((value) => ({ value, label: t(value) }))} value={view} onChange={onViewChange} />
        <ReadText size={12} lineHeight={12 * SNUG} tone="ink-300" style={{ textAlign: 'center' }}>{t(view === 'affordable' ? 'affordableHint' : 'allHint')}</ReadText>
      </View>
      {visible.length === 0 ? <ReadText size={13} tone="ink-300" style={{ paddingVertical: 12, textAlign: 'center' }}>{t('noneAffordable')}</ReadText> : null}
      {visible.map(({ ladder, items }) => (ladders.indexOf(ladder) < upTo ? <Shelf key={ladder} title={text.ladders[ladder]} items={items} onOpen={onOpen} /> : null))}
      {upTo >= ladders.length ? <PerfDrawn name="tab: shop, every shelf" /> : null}
      {open ? <ItemSheet itemId={open} onClose={() => setOpen(null)} /> : null}
    </View>
  );
}

/**
 * A shelf: the things of a kind, always two a row, so a car is drawn whole whatever the width (the web's `grid-cols-2 gap-2`: 4 on each side of
 * each tile, the row made 8 wider than the panel, so the gap between two is 8 and the outer edges are the panel's). It measures its own width, as
 * the web's `@container` does, and tells its tiles when there is room for the picture beside the words (once, when that changes; until it is laid
 * out, as wide as the screen makes it). Memoised: its things are worked out once for the round as it stands, so the shop putting more shelves on
 * screen draws only the new ones.
 */
const Shelf = memo(function Shelf({ title, items, onOpen }: { title: string; items: readonly ShelfItem[]; onOpen(itemId: string): void }) {
  const { width: screen } = useWindowDimensions();
  const [wide, setWide] = useState(() => shelfOn(screen) >= SHELF_ROW);
  const laid = useCallback((event: LayoutChangeEvent) => setWide(event.nativeEvent.layout.width >= SHELF_ROW), []);
  return (
    <Panel title={title}>
      <View onLayout={laid}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, rowGap: 8 }}>
          {items.map(({ item, quote, owned }) => (
            <ShelfTile key={item.id} itemId={item.id} owned={owned} ownedUsed={quote.ownedUsed} price={quote.price} status={realStatus(quote)} focus={item.perks?.focus ?? 0} wide={wide} onOpen={onOpen} />
          ))}
        </View>
      </View>
    </Panel>
  );
});

/**
 * A thing on the shelf: the tile of the game, its picture and its words. In a narrow shelf the picture sits above the words, centred; with room,
 * beside them (the web's `@min-[400px]:flex-row`). What is already owned wears a gold edge, so the shelf shows at a glance what is left to want.
 * Half its row, as tall as the other half. Drawn again only when what it shows changes.
 */
const ShelfTile = memo(function ShelfTile({ itemId, owned, ownedUsed, price, status, focus, wide, onOpen }: { itemId: string; owned: boolean; ownedUsed: boolean; price: number; status: number; focus: number; wide: boolean; onOpen(itemId: string): void }) {
  const t = useT('finance.shop');
  const { names, fmt } = useWords();
  return (
    <View style={{ width: '50%', paddingHorizontal: 4 }}>
      <Raised
        marks={ITEM.dataSet}
        tone={owned ? GOLD : {}}
        place={{ flexGrow: 1, minWidth: 0 }}
        style={{ flexGrow: 1, flexDirection: wide ? 'row' : 'column', alignItems: 'center', gap: wide ? 8 : 4, padding: 6 }}
        onPress={() => onOpen(itemId)}
      >
        {/* As tall as a watch, as wide as the thing needs: a car is twice as wide as it is tall. */}
        <Bare style={THING_BOX}>
          <Sprite id={itemArt(itemId)} fallback={THING} />
        </Bare>
        <View style={{ minWidth: 0, flex: 1, alignSelf: wide ? undefined : 'stretch', alignItems: wide ? 'flex-start' : 'center', gap: 2 }}>
          <ReadText size={13} lineHeight={13 * TIGHT} numberOfLines={2} style={{ textAlign: wide ? 'left' : 'center' }}>{names.items[itemId]}</ReadText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: wide ? 'flex-start' : 'center', columnGap: 8, rowGap: 2 }}>
            <PixelText size={15} lineHeight={15} tone={owned ? 'teal-300' : 'gold-500'}>{owned ? t(ownedUsed ? 'ownedUsed' : 'owned') : fmt.compact(price)}</PixelText>
            {/* What it does to the player's status all told, not its own status: a lesser thing beside a better one adds little or none. (Each tag in
                the line of the web's `whitespace-nowrap` span round it, a reading line of 15, as the web's inline tag stands in it.) */}
            <LineTag tone={status > 0 ? 'good' : undefined}>{t('status', { n: status })}</LineTag>
            {/* A long trip is a rest too: the focus it gives says so beside the status. */}
            {focus ? <LineTag tone="good">{t('focusTag', { n: focus })}</LineTag> : null}
          </View>
        </View>
      </Raised>
    </View>
  );
});

/** The shop's view, kept by the panel while the finances are open (the web's Finance keeps it), so a look at another tab leaves it as it was. */
const ShopViewKept = createContext<{ view: ShopView; setView(view: ShopView): void }>({ view: 'affordable', setView: () => {} });
function ShopTab() {
  const { view, setView } = useContext(ShopViewKept);
  return <Shop view={view} onViewChange={setView} />;
}

// ------------------------------------------------------------------------------------------------
// Taxes: the round as it will resolve

/**
 * The tax residency a city offers, for whoever lives there: what it costs and what it saves, and the
 * switch. Nothing is shown in a city that offers none.
 */
function Residency() {
  const knows = useKnows();
  const t = useT('finance.taxes');
  const { content, names, fmt } = useWords();
  const { view, p, world } = useRound();
  const orders = useGame((s) => s.orders);
  const setOrder = useGame((s) => s.setOrder);
  const city = content.cities.find((x) => x.id === p.cityId);
  const offer = city?.residency;
  const held = view.player.life.residency;
  const offered = city !== undefined && offer !== undefined && knows('setResidency');
  // What it comes to this round, in the engine's figures: the round as planned with it and without it, the fee and the tax both (worked out once
  // for the orders as they stand, and only where the panel is drawn: a residency offered, and rules that know it).
  const yearly = useMemo(() => {
    if (!offered || !offer) return 0;
    const others = orders.filter((order) => order.type !== 'setResidency');
    const cashWith = previewRound(content, view, { orders: held ? others : [...others, { type: 'setResidency', on: true }] }).cashAfter;
    const cashWithout = previewRound(content, view, { orders: held ? [...others, { type: 'setResidency', on: false }] : others }).cashAfter;
    return Math.round((cashWith - cashWithout) / content.yearsPerRound);
  }, [content, view, orders, held, offer, offered]);
  if (!offered || !city || !offer) return null;
  const title = t('residencyTitle', { city: names.cities[p.cityId] });
  return (
    <Panel title={title} label={title}>
      <Toggle
        on={p.life.residency}
        onChange={(on) => setOrder((order) => order.type === 'setResidency', on === view.player.life.residency ? null : { type: 'setResidency', on })}
        label={t('residency')}
        hint={t('residencyHint', { fee: fmt.money(indexed(offer.feeAnnual, world)), rate: fmt.rate(offer.dividendBp), usual: fmt.rate(effectiveTax(city, world).dividendBp) })}
      />
      <ReadText size={13} lineHeight={13 * SNUG} tone={yearly > 0 ? 'teal-300' : 'ink-300'} style={{ marginTop: 8 }}>
        {yearly > 0 ? t('residencySaves', { amount: fmt.money(yearly) }) : t('residencyCosts', { amount: fmt.money(-yearly) })}
      </ReadText>
      <ReadText size={12} lineHeight={12 * SNUG} tone="ink-300" style={{ marginTop: 4 }}>{t('residencyWhy')}</ReadText>
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
    <View style={{ gap: 12 }}>
      <Panel title={t('tax', { years })}>
        <Row left={t('incomeTax')} right={fmt.signed(-tax.income)} />
        <Row left={t('investmentTax')} right={fmt.signed(-tax.investment)} />
        <Row left={t('propertyTax')} right={fmt.signed(-tax.property)} />
        {preview.purchaseTaxPaid > 0 ? <Row left={t('purchaseTax')} right={fmt.signed(-preview.purchaseTaxPaid)} /> : null}
        {eaten > 0 ? (
          // The web's `mt-1 border-t-2 border-night-900 pt-2 text-ink-300` on the line: its words in ink too.
          <Row
            style={{ marginTop: 4, borderTopWidth: 2, borderTopColor: COLORS['night-900'], paddingTop: 8 }}
            left={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
                <Sprite id={RISK_ART.inflation} />
                <ReadText numberOfLines={1} tone="ink-300" style={{ flexShrink: 1 }}>{t('inflationTax')}</ReadText>
              </View>
            }
            sub={t('inflationHint', { cash: fmt.money(p.cash), pct: (eatenPct * 100).toFixed(1), years })}
            right={<Figure tone="ink-300">{fmt.signed(-eaten)}</Figure>}
          />
        ) : null}
      </Panel>
      <Residency />
      <EvasionPanel shown={shown} preview={preview} />
      <Panel>
        <Row left={t('cashNow')} right={fmt.money(p.cash)} />
        <Row left={<PixelText size={17} numberOfLines={1} style={{ flexShrink: 1 }}>{t('cashAfter')}</PixelText>} right={<Figure size={19} tone={preview.cashAfter < 0 ? 'wine-300' : 'gold-500'}>{fmt.money(preview.cashAfter)}</Figure>} />
        {preview.cashAfter < 0 ? <ReadText size={13} tone="wine-300" style={{ marginTop: 4 }}>{t('shortfall')}</ReadText> : null}
        <ReadText size={12} tone="ink-300" style={{ marginTop: 8 }}>{t('exact')}</ReadText>
      </Panel>
      <Panel title={t('escapeTitle')}>
        <View style={{ marginBottom: 6, flexDirection: 'row', justifyContent: 'space-between' }}>
          <PixelText size={14}>{fmt.money(escape.passiveAfterTax)}</PixelText>
          <PixelText size={14} tone="ink-300">{fmt.money(escape.outgoings)}</PixelText>
        </View>
        <Bar value={escape.passiveAfterTax} max={escape.outgoings} label={t('escapeTitle')} />
        <ReadText size={12} tone="ink-300" style={{ marginTop: 8 }}>{t('escapeHint')}</ReadText>
      </Panel>
    </View>
  );
}

// ------------------------------------------------------------------------------------------------
// The basket

/** What was just taken out of the basket, and the way to put it back. */
function PutBack() {
  const t = useT('finance');
  const undoRemove = useGame((s) => s.undoRemove);
  const press = usePress({ onPress: undoRemove });
  return (
    <View role="status" accessibilityLiveRegion="polite" style={{ flexDirection: 'row', minHeight: TOUCH, alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <ReadText size={13} tone="ink-300" style={{ flexShrink: 1 }}>{t('removed')}</ReadText>
      <Pressable accessibilityRole="button" onPress={press} style={{ minHeight: TOUCH, paddingHorizontal: 8, justifyContent: 'center' }}>
        {/* `underline underline-offset-4` on a line of 13 × 1.45. */}
        <LinkText size={13} offset={4}>{t('undo')}</LinkText>
      </Pressable>
    </View>
  );
}

/** One order in the basket, and the button that takes it out. */
/** The space between the basket's rows. */
const ORDERS_GAP = 8;

/** An order in the basket: taken out by its button, or on the phone swiped to the left (`SwipeAway`). */
function Ordered({ label, onRemove }: { label: string; onRemove(): void }) {
  const t = useT('finance');
  const remove = usePress({ onPress: onRemove });
  return (
    <View role="listitem">
      <SwipeAway label={t('remove')} gap={ORDERS_GAP} onAway={onRemove}>
        <Framed kind="frame" style={{ backgroundColor: COLORS['night-600'], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 4, paddingLeft: 12, paddingRight: 4 }}>
          <ReadText numberOfLines={1} style={{ flexShrink: 1 }}>{label}</ReadText>
          <Pressable accessibilityRole="button" accessibilityLabel={`${t('remove')}: ${label}`} onPress={remove} style={{ width: TOUCH, height: TOUCH, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}>
            <PixelText size={18} tone="wine-300">{'✕'}</PixelText>
          </Pressable>
        </Framed>
      </SwipeAway>
    </View>
  );
}

/**
 * Each order's own key, for as long as it is in the basket: the same order keeps its row (and a row swiped away is never handed to the order after
 * it), whatever its place. Taking one out leaves the others the same orders; one put back is a new row.
 */
const orderKeys = new WeakMap<Order, number>();
let lastOrderKey = 0;
const keyOfOrder = (order: Order): number => {
  let key = orderKeys.get(order);
  if (key === undefined) {
    key = ++lastOrderKey;
    orderKeys.set(order, key);
  }
  return key;
};

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
      <View role="list" aria-label={t('basketTitle')} style={{ gap: ORDERS_GAP }}>
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
          <Ordered key={keyOfOrder(order)} label={orderLabel(words, labels, view.player, order)} onRemove={() => removeOrder(i)} />
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
 * What each tab draws: all eight of the web's, each a line here (a tab with no body would be null, and not shown: a player never meets an empty
 * tab). The shop's view, the web's `shopView`, is kept by the panel (`ShopViewKept`).
 */
const TAB_BODIES: Readonly<Record<TabId, ComponentType | null>> = {
  portfolio: Portfolio,
  market: Market,
  property: PropertyTab,
  business: BusinessTab,
  debt: DebtTab,
  lifestyle: Lifestyle,
  shop: ShopTab,
  taxes: Taxes,
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
  // On the web, [ and ] move between tabs from anywhere on the stage, without going back to the tab strip first (docs/keyboard.md).
  useKeyboardScope((event) => {
    if ((event.key !== '[' && event.key !== ']') || event.altKey || event.ctrlKey || event.metaKey || dialogOpen()) return false;
    const next = tabs[(tabs.indexOf(tab) + (event.key === ']' ? 1 : -1) + tabs.length) % tabs.length];
    setTab(next);
    requestAnimationFrame(() => focusMarked('tab', next));
    return true;
  });
  return (
    <View style={{ marginHorizontal: -GUTTER }}>
      <Tabs<TabId> label={t('tabsLabel')} tabs={tabs.map((id) => ({ id, label: t(`tabs.${id}`) }))} value={tab} onChange={setTab} />
    </View>
  );
}

/** The finance phase: the panel of the tab on screen (the web's `role="tabpanel"`, `pt-1`; the column's gutter is its `px-3`), swiped to the next on the phone. */
export function Finance() {
  const t = useT('finance');
  const { tab, setTab } = useFinanceTab();
  const tabs = useTabs();
  // The next finance phase opens on the portfolio again, as the web's, whose Finance is made anew each round; and its shop on what is in reach.
  useEffect(() => () => setTab('portfolio'), [setTab]);
  const [shopView, setShopView] = useState<ShopView>('affordable');
  const shop = useMemo(() => ({ view: shopView, setView: setShopView }), [shopView]);
  const Body = TAB_BODIES[tab];
  // On the web, ↓ and ↑ (Home, End) move among the panel's rows that open or buy something, and Escape goes back to the tab that is on.
  const items = onKeys((event) => {
    if (focusedMark('finance-item') === null) return false;
    if (event.key === 'Escape') return focusMarked('tab', tab);
    return stepMarked('finance-item', event.key);
  });
  return (
    <View {...items} role="tabpanel" aria-label={t(`tabs.${tab}`)} style={{ paddingTop: 4 }}>
      <PerfDrawn name={`tab: ${tab}`} />
      {/* Swiped sideways, the panel turns to the tab beside it, as a phone's own paged tabs (nothing on the web). */}
      <TabSwipe tabs={tabs} value={tab} onChange={setTab}>
        <ShopViewKept.Provider value={shop}>{Body ? <Body /> : null}</ShopViewKept.Provider>
      </TabSwipe>
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
