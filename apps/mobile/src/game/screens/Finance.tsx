import { assetLogo, cityIcon } from '@ratrace/content';
import { TAB_FROM_ROUND } from '@ratrace/core/game/guide';
import { ageAt, orderLabel } from '@ratrace/core/game/present';
import { applyBp, depositRateBp, quoteMargin, quotePlans, quotePortfolio } from '@ratrace/engine';
import type { AssetDef, GameView, Order } from '@ratrace/engine';
import { createContext, useContext, useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePop, useSink } from '../../ui/animations';
import { Framed } from '../../ui/Frame';
import { webBaseline } from '../../ui/fonts';
import { Button, Panel, Row, Segmented, Tag, TickerBadge, usePress } from '../../ui/kit';
import { Sheet, Tabs, Toast } from '../../ui/overlay';
import { Sparks } from '../../ui/Sparks';
import { Sprite } from '../../ui/Sprite';
import { PixelText, ReadText, SNUG } from '../../ui/text';
import { COLORS, GUTTER, TOUCH } from '../../ui/theme';
import { useGame, useGuided, useIntroducesTabs, useKnows, useT, useWords } from '../context';
import { AmountSheet } from './AmountSheet';
import { Explain } from './Explain';
import { Payouts, PortfolioGlance } from './Glance';
import { useShown } from './Hud';
import { BuySheet } from './PlayStandIns';

/*
 * The finance phase, as the web's Finance.tsx lays it on a phone: eight tabs over one basket of orders. What the phone leaves out: the keyboard
 * (`[` and `]` between the tabs, the arrows between what a tab lists) and what is only online (what other players of a room owe, `p.lent`).
 *
 * The web's Finance is one block: its row of tabs sticks under the Hud's figures, its panel scrolls, its toasts stand over the page. On the phone
 * those are three places of Play's screen: the row is the second sticky row of its `StickyScreen` (`FinanceTabs`, the `subHeader`), the panel is
 * the stage (`Finance`), and the toasts are drawn over the screen (`FinanceToasts`, in its `fixed`). The tab on screen is shared by the row and
 * the panel (`FinanceShell`), so a change of tab draws the two of them again and nothing else.
 *
 * This task (12) brings the portfolio; the other tabs come with their tasks, each a line of `TAB_BODIES`.
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
 * scene page presses what opens it): a tab, and a sheet of that tab (`pension`: the portfolio's pension plan).
 */
export const FinanceOpened = createContext<{ tab?: TabId; sheet?: string }>({});

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
  // Worked out once for the round as it stands, not again for each drawing.
  const held = useMemo(() => content.assets.filter((asset) => Object.hasOwn(p.positions, asset.id)), [content, p.positions]);
  const dividends = useMemo(() => new Map(quotePortfolio(content, shown).dividends.map((paid) => [paid.assetId, paid.amount])), [content, shown]);
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
            onBuy={() => setBuying(asset)}
            onSell={() => setMove({ kind: 'sell', asset })}
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

/** A holding: its mark, its name and what it has made or lost, what it pays, what is owed on it, what a plan adds to it, its worth; and its sale. */
function Holding({ asset, value, gain, pays, planned, sellable, onBuy, onSell }: { asset: AssetDef; value: number; gain: number; pays: number | null; planned: number; sellable: number; onBuy(): void; onSell(): void }) {
  const t = useT('finance.portfolio');
  const { names, fmt } = useWords();
  const buy = usePress({ onPress: onBuy });
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
      <Button variant="secondary" onPress={onSell} disabled={sellable <= 0}>
        {t('sell')}
      </Button>
    </View>
  );
}

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
 * was opened plays nothing.
 */
function AssetMark({ asset }: { asset: AssetDef }) {
  const { names } = useWords();
  const count = useGame((s) => tradesOf(s.orders, asset.id));
  const lastTrade = useGame((s) => lastTradeOf(s.orders, asset.id));
  const [before] = useState(count);
  const last = count > before ? lastTrade : null;
  return (
    <Answering key={count} last={last}>
      <TickerBadge ticker={names.assets[asset.id].ticker} kind={asset.class} logo={assetLogo[asset.id]} />
      {last === 'buy' ? <Sparks colours={['gold-500', 'gold-200', 'cream']} count={8} reach={26} /> : null}
    </Answering>
  );
}

/** The mark's box, playing its jump (bought) or its shrink (sold) once from the moment it is drawn: each new order is a new box. */
function Answering({ last, children }: { last: 'buy' | 'sell' | null; children: ReactNode }) {
  const pop = usePop({ play: last === 'buy' });
  const sink = useSink({ play: last === 'sell' });
  return (
    <Animated.View {...{ dataSet: last ? { mark: last } : undefined }} style={[{ flexDirection: 'row', flexShrink: 0 }, last === 'buy' ? pop : last === 'sell' ? sink : null]}>
      {children}
    </Animated.View>
  );
}

/** How much of a purchase may be borrowed from the broker: none, a quarter more, half as much again, or as much again. */
type Gear = 1 | 1.25 | 1.5 | 2;
/** The gears the market's sheet offers (Task 13 draws that sheet). */
export const GEARS: readonly Gear[] = [1, 1.25, 1.5, 2];

/**
 * How close a broker's loan is to the forced sale: a bar of the loan against what the holding is
 * worth, full when the broker sells, wine as it nears; and what the holding is worth, and how far
 * it may fall before the sale. The debt tab draws it beside a margin loan (Task 13).
 */
export function MarginGauge({ assetId }: { assetId: string }) {
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
 * What each tab draws. A tab whose body a later task brings is null, and is not shown: a player never meets an empty tab. Task 13 the market,
 * property and debt; Task 14 the way of life; Task 15 the shop, taxes and businesses (the shop's view, the web's `shopView`, is then kept by the
 * panel). Showing one is its line here.
 */
const TAB_BODIES: Readonly<Record<TabId, ComponentType | null>> = {
  portfolio: Portfolio,
  market: null,
  property: null,
  business: null,
  debt: null,
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
  const [tab, setTab] = useState<TabId>(opened.tab ?? 'portfolio');
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
