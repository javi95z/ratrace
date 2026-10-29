import { businessArt, businessStageArt, HANDOVER_ART } from '@ratrace/content';
import { reviewStars } from '@ratrace/core/game/quips';
import { quoteBusinesses } from '@ratrace/engine';
import type { BusinessesQuote, GameView, Order } from '@ratrace/engine';
import { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Framed } from '../../ui/Frame';
import { GOLD } from '../../ui/frames';
import { Bare, Button, Figure, KeyFigure, Panel, reach, Row, Segmented, Tag, Toggle, useOnce, usePress } from '../../ui/kit';
import { Sheet } from '../../ui/overlay';
import { Sprite } from '../../ui/Sprite';
import { PixelText, ReadText, SNUG } from '../../ui/text';
import { COLORS, TOUCH, type ColorToken } from '../../ui/theme';
import { useHaptic } from '../../ui/haptic';
import { useGame, useKnows, useT, useWords } from '../context';
import { AmountSheet } from './AmountSheet';
import { useShown } from './Hud';

/*
 * The businesses, as the web's Business.tsx lays them in the finances: the ones the player owns, each a line with its two switches at hand and
 * a sheet of its own, and the kinds that could be opened. Every figure is the engine's quote of the round as it stands, worked out once for it.
 */

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
function useRunning(view: GameView | null, businessId: string, payoutPct: number) {
  const setOrder = useGame((s) => s.setOrder);
  const isSetting = (order: Order) => order.type === 'setBusiness' && order.businessId === businessId;
  const isTending = (order: Order) => order.type === 'tendBusiness' && order.businessId === businessId;
  return {
    // The owner takes over from a manager: the manager goes this round, and the owner's focus runs it.
    tend: (on: boolean) => {
      if (on && view) setOrder(isSetting, settingOrder(view, businessId, { payoutPct, manager: false }));
      return setOrder(isTending, on ? { type: 'tendBusiness', businessId } : null);
    },
    // A manager takes over from the owner: their focus is given back.
    manage: (on: boolean) => {
      if (!view) return false;
      if (on) setOrder(isTending, null);
      return setOrder(isSetting, settingOrder(view, businessId, { payoutPct, manager: on }));
    },
  };
}

/** How far a small switch's touch reaches above and below it: the gap of 8 to the line it is under, and at least that much below it. */
const QUICK_REACH = reach(36, { above: 8, below: 8 });

/**
 * A small switch beside a business: on or off, with what it costs said in its label. 36 high, as the web's `min-h-9`, its touch the 44 a thumb
 * needs (`QUICK_REACH`). On, it is lit gold on teal; the web's `aria-pressed` is said as `selected`, as the cards' choices say it.
 */
function QuickSwitch({ on, disabled = false, label, onChange }: { on: boolean; disabled?: boolean; label: string; onChange(on: boolean): void }) {
  const haptic = useHaptic();
  const press = usePress({
    onPress: () => {
      haptic(on ? 'toggleOff' : 'toggleOn');
      onChange(!on);
    },
    disabled,
  });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on, disabled }}
      aria-selected={on}
      disabled={disabled}
      onPress={press}
      style={{ flex: 1, minWidth: 0, opacity: disabled ? 0.45 : 1, ...QUICK_REACH.style }}
    >
      <Framed kind="raised" tone={on ? GOLD : {}} style={{ flexGrow: 1, minHeight: 36, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS[on ? 'teal-800' : 'night-600'] }}>
        <PixelText size={13} tone={on ? 'cream' : 'ink-200'} style={{ textAlign: 'center' }}>{`${on ? '✓ ' : ''}${label}`}</PixelText>
      </Framed>
    </Pressable>
  );
}

/** A business's stars, as its customers give them: gold, and the rest of five dimmed (the web's `tracking-widest`). */
const STAR_TRACKING = 12 * 0.1;

/**
 * One business in the list: what it is worth and makes, how it is run, what its customers say, and
 * the two switches that run it, at hand without opening it. The rest is in its sheet. Given what it shows and nothing else, so an order
 * draws again only the lines it changes.
 */
const BusinessLine = memo(function BusinessLine({
  id,
  typeId,
  art,
  capital,
  profit,
  payout,
  tended,
  manager,
  managerPct,
  payoutPct,
  neglected,
  fullTime,
  standing,
  standingTended,
  focusLeft,
  first,
  onOpen,
}: {
  id: string;
  typeId: string;
  art: string;
  capital: number;
  profit: number;
  payout: number;
  tended: boolean;
  manager: boolean;
  managerPct: number;
  payoutPct: number;
  neglected: boolean;
  /** Run full time, as the round stands: there is nothing to run, by the owner's focus or a manager. */
  fullTime: boolean;
  /** The business stood before this round's orders: one opened by an order of this round is not the player's to run until the round is played. */
  standing: boolean;
  standingTended: boolean;
  focusLeft: number;
  first: boolean;
  onOpen(id: string): void;
}) {
  const t = useT('finance.business');
  const { text, fmt } = useWords();
  const view = useGame((s) => s.view);
  const run = useRunLine()({ tended, manager });
  const running = useRunning(view, id, payoutPct);
  const stars = reviewStars({ neglected, manager, profit });
  const open = usePress({ onPress: () => onOpen(id) });
  return (
    <View role="listitem" style={{ paddingVertical: 8, ...(first ? { paddingTop: 0 } : { borderTopWidth: 2, borderTopColor: COLORS['night-900'] }) }}>
      <Pressable accessibilityRole="button" aria-haspopup="dialog" onPress={open} style={{ flexDirection: 'row', minHeight: TOUCH, width: '100%', alignItems: 'center', gap: 12 }}>
        <Bare style={{ width: 64, height: 64 }}>
          <Sprite id={art} />
        </Bare>
        <View style={{ minWidth: 0, flex: 1 }}>
          <PixelText size={17} numberOfLines={1}>{text.businessTypes[typeId].name}</PixelText>
          <ReadText size={12} tone={run.tone}>{run.text}</ReadText>
          <Stars stars={stars} />
        </View>
        <View style={{ flexShrink: 0, alignItems: 'flex-end' }}>
          <PixelText size={17} tone="gold-500" style={{ textAlign: 'right' }}>{fmt.money(capital)}</PixelText>
          <ReadText size={12} tone={profit >= 0 ? 'teal-300' : 'wine-300'} style={{ textAlign: 'right' }}>{t('profitRound', { amount: fmt.signed(profit) })}</ReadText>
          <ReadText size={12} tone="ink-300" style={{ textAlign: 'right' }}>{t('paysYou', { amount: fmt.money(payout) })}</ReadText>
        </View>
      </Pressable>
      {neglected ? <ReadText size={12} lineHeight={12 * SNUG} tone="wine-300" style={{ marginTop: 4 }}>{t('neglectedShort')}</ReadText> : null}
      {standing && !fullTime ? (
        <View style={{ marginTop: 8, flexDirection: 'row', gap: 8 }}>
          <QuickSwitch on={tended && !manager} disabled={standingTended || (!tended && focusLeft < 1)} label={t('quickTend')} onChange={(on) => running.tend(on)} />
          <QuickSwitch on={manager} label={t('quickManager', { pct: managerPct })} onChange={(on) => running.manage(on)} />
        </View>
      ) : null}
    </View>
  );
});

/** A business's stars on a line of their own (the web's `span role="img" block text-[12px] tracking-widest`), named for a screen reader. */
function Stars({ stars }: { stars: number }) {
  const t = useT('finance.business');
  return (
    <View accessible role="img" aria-label={t('review.stars', { n: stars })} accessibilityLabel={t('review.stars', { n: stars })}>
      <ReadText size={12} after={[{ text: '★'.repeat(stars), tone: 'gold-500', tracking: STAR_TRACKING }, { text: '★'.repeat(5 - stars), tone: 'ink-500', tracking: STAR_TRACKING }]}>
        {''}
      </ReadText>
    </View>
  );
}

/** How a business is being run this round, in a line. */
function useRunLine() {
  const t = useT('finance.business');
  return ({ tended, manager }: { tended: boolean; manager: boolean }): { text: string; tone: ColorToken } =>
    manager ? { text: t('runManager'), tone: 'ink-300' } : tended ? { text: t('runYou'), tone: 'teal-300' } : { text: t('runNobody'), tone: 'wine-300' };
}

/** All of them at a glance: a figure over what it is (the web's `div` of `pixel text-[16px]` over `text-[11px] text-ink-300`). */
function Total({ figure, tone = 'cream', label }: { figure: string; tone?: ColorToken; label: string }) {
  return (
    <View style={{ flex: 1, minWidth: 0, alignItems: 'center' }}>
      <PixelText size={16} tone={tone} style={{ textAlign: 'center' }}>{figure}</PixelText>
      <ReadText size={11} tone="ink-300" style={{ textAlign: 'center' }}>{label}</ReadText>
    </View>
  );
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
  const onOpen = useCallback((id: string) => setOpen(id), []);
  // Worked out once for the round as it stands, not again for each drawing.
  const quote = useMemo(() => quoteBusinesses(content, shown), [content, shown]);
  // Only what the player could open: not what needs more Finance, not a trade that is not theirs, not a second of what there may be only one of.
  const offered = quote.kinds.filter((kind) => kind.lock !== 'needs-finance-skill' && kind.lock !== 'not-your-trade' && kind.lock !== 'already-owned');
  // Looked up afresh on every draw: a business sold while its sheet is open closes it.
  const opened = quote.owned.find((business) => business.id === open);
  const total = quote.owned.reduce((sum, business) => ({ capital: sum.capital + business.capital, profit: sum.profit + business.profit, payout: sum.payout + business.payout }), { capital: 0, profit: 0, payout: 0 });
  if (!view) return null;

  return (
    <View style={{ gap: 12 }}>
      <Panel title={t('yours')} label={t('yours')}>
        {quote.owned.length === 0 ? <ReadText size={14} lineHeight={14 * SNUG} tone="ink-300">{t('none')}</ReadText> : null}
        {quote.owned.length > 0 ? (
          // All of them at a glance: what they are worth, what they make this round, and what comes to the player.
          <View style={{ marginBottom: 8, flexDirection: 'row', gap: 8, borderBottomWidth: 2, borderBottomColor: COLORS['night-900'], paddingBottom: 8 }}>
            <Total figure={fmt.compact(total.capital)} tone="gold-500" label={t('totalWorth')} />
            <Total figure={fmt.signed(total.profit)} tone={total.profit >= 0 ? 'teal-300' : 'wine-300'} label={t('totalProfit')} />
            <Total figure={fmt.money(total.payout)} label={t('totalPayout')} />
          </View>
        ) : null}
        <View role="list">
          {quote.owned.map((business, i) => {
            const standing = view.player.businesses.find((x) => x.id === business.id);
            return (
              <BusinessLine
                key={business.id}
                id={business.id}
                typeId={business.typeId}
                art={grownArt(business, content.business.types)}
                capital={business.capital}
                profit={business.profit}
                payout={business.payout}
                tended={business.tended}
                manager={business.manager}
                managerPct={business.managerPct}
                payoutPct={business.payoutPct}
                neglected={business.neglected}
                fullTime={business.fullTime === true}
                standing={standing !== undefined}
                standingTended={standing?.tended ?? false}
                focusLeft={quote.focusLeft}
                first={i === 0}
                onOpen={onOpen}
              />
            );
          })}
        </View>
        {quote.owned.length > 0 ? <ReadText size={12} lineHeight={12 * SNUG} tone="ink-300" style={{ marginTop: 4 }}>{t('focusLeft', { n: quote.focusLeft })}</ReadText> : null}
      </Panel>

      <Panel title={t('open')} label={t('open')}>
        <ReadText size={13} lineHeight={13 * SNUG} tone="ink-200" style={{ marginBottom: 8 }}>{t('openAbout', { max: quote.max })}</ReadText>
        {/* Set off by rules, not boxed: the panel is the only box. */}
        <View role="list">
          {offered.map((kind, i) => (
            <View key={kind.typeId} role="listitem" style={{ paddingVertical: 12, ...(i === 0 ? { paddingTop: 0 } : { borderTopWidth: 2, borderTopColor: COLORS['night-900'] }), ...(i === offered.length - 1 ? { paddingBottom: 0 } : null) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <View style={{ flexDirection: 'row', minWidth: 0, flexShrink: 1, alignItems: 'center', gap: 8 }}>
                  <Bare style={{ width: 64, height: 64 }}>
                    <Sprite id={businessArt(kind.typeId)} />
                  </Bare>
                  <PixelText size={16} style={{ flexShrink: 1 }}>{text.businessTypes[kind.typeId].name}</PixelText>
                </View>
                <PixelText size={14} tone="gold-500" style={{ flexShrink: 0 }}>{t('from', { amount: fmt.compact(kind.minCapital) })}</PixelText>
              </View>
              <ReadText size={13} lineHeight={13 * SNUG} tone="ink-200" style={{ marginTop: 2 }}>{text.businessTypes[kind.typeId].blurb}</ReadText>
              <View style={{ marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                <Tag tone="good">{t('yield', { rate: fmt.rate(kind.yieldBp) })}</Tag>
                <Tag tone={kind.cyclePct > 0 ? 'good' : kind.cyclePct < 0 ? 'bad' : 'plain'}>{t('economy', { pct: signedPct(kind.cyclePct) })}</Tag>
                <Tag>{t('managerShare', { pct: kind.managerPct })}</Tag>
                {/* The start is the hard part: it may not survive its first round, and it takes a while to find its customers. */}
                {kind.failChancePct > 0 ? <Tag tone="bad">{t('failChance', { pct: kind.failChancePct })}</Tag> : null}
              </View>
              <ReadText size={12} lineHeight={12 * SNUG} tone="ink-300" style={{ marginTop: 4 }}>
                {t('slowStart', { first: content.business.rampPct[0] ?? 100, second: content.business.rampPct[1] ?? 100, back: content.business.failRecoverPct })}
              </ReadText>
              {kind.lock !== null ? (
                <ReadText size={12} lineHeight={12 * SNUG} tone="gold-200" style={{ marginTop: 6 }}>{text.reasons[kind.lock]}</ReadText>
              ) : shown.player.cash < kind.minCapital ? (
                <ReadText size={12} lineHeight={12 * SNUG} tone="gold-200" style={{ marginTop: 6 }}>{t('needsCash', { amount: fmt.money(kind.minCapital - shown.player.cash) })}</ReadText>
              ) : (
                <View style={{ marginTop: 8 }}>
                  <Button variant="secondary" wide onPress={() => setStarting(kind)}>
                    {t('start')}
                  </Button>
                </View>
              )}
            </View>
          ))}
        </View>
      </Panel>

      {starting ? (
        <AmountSheet
          title={t('startTitle', { name: text.businessTypes[starting.typeId].name })}
          max={shown.player.cash}
          start={starting.minCapital}
          onClose={() => setStarting(null)}
          onConfirm={(capital) => addOrder({ type: 'startBusiness', typeId: starting.typeId, capital })}
        >
          <ReadText size={14} lineHeight={14 * SNUG} tone="ink-200" style={{ marginBottom: 8 }}>{t('startHint', { min: fmt.money(starting.minCapital), scale: fmt.compact(starting.scale) })}</ReadText>
        </AmountSheet>
      ) : null}
      {opened ? <BusinessSheet business={opened} view={view} quote={quote} onClose={() => setOpen(null)} /> : null}
    </View>
  );
}

/** What the customers write about it online. It is said, not counted: the stars follow how it is run. */
function Review({ neglected, manager, profit }: { neglected: boolean; manager: boolean; profit: number }) {
  const t = useT('finance.business');
  const stars = reviewStars({ neglected, manager, profit });
  return (
    // One paragraph, as the web's: the stars, then what is said, which wraps under them. Named by the stars and the words, for a screen reader.
    <View accessible aria-label={`${t('review.stars', { n: stars })}. ${t(`review.${stars}`)}`} accessibilityLabel={`${t('review.stars', { n: stars })}. ${t(`review.${stars}`)}`}>
      <ReadText
        size={12}
        lineHeight={12 * SNUG}
        after={[
          { text: '★'.repeat(stars), tone: 'gold-500', tracking: STAR_TRACKING },
          { text: '★'.repeat(5 - stars), tone: 'ink-500', tracking: STAR_TRACKING },
          // The web's `mr-1.5` after the stars: a space, opened to the 6 the margin is.
          { text: ' ', tracking: REVIEW_GAP },
          { text: t(`review.${stars}`), tone: 'ink-200', italic: true },
        ]}
      >
        {''}
      </ReadText>
    </View>
  );
}
/** A space and its tracking, as wide as the web's `mr-1.5` (6) beside the stars' own last tracking: Chakra Petch's space is 0.26 of its size. */
const REVIEW_GAP = 6 - 12 * 0.26;

/**
 * Living from the business: once it has made a good share of the pay two rounds running, the job
 * can be left for it; run full time it says so, and what it gives. Before that, nothing is shown.
 */
function OwnBoss({ business, view }: { business: Owned; view: GameView }) {
  const knows = useKnows();
  const t = useT('finance.business');
  const { content, text } = useWords();
  const setOrder = useGame((s) => s.setOrder);
  const leaving = useGame((s) => s.orders.some((order) => order.type === 'goFullTime' && order.businessId === business.id));
  const rule = content.life.fullTime;
  const p = view.player;
  const isLeaving = (order: Order) => order.type === 'goFullTime';
  // Run full time it needs none of the owner's spare focus: an order to run it oneself would only spend a point for nothing.
  const isTending = (order: Order) => order.type === 'tendBusiness' && order.businessId === business.id;
  const go = () => {
    if (leaving) setOrder(isLeaving, null);
    else if (setOrder(isLeaving, { type: 'goFullTime', businessId: business.id })) setOrder(isTending, null);
  };
  if (business.fullTime === true) {
    return (
      <View style={{ borderLeftWidth: 4, borderLeftColor: COLORS['teal-300'], paddingLeft: 10 }}>
        <PixelText size={15} tone="teal-300">{t('fullTime.is')}</PixelText>
        <ReadText size={12} lineHeight={12 * SNUG} tone="ink-200">{t('fullTime.isHint', { pct: rule.profitPct - 100, focus: rule.focus })}</ReadText>
      </View>
    );
  }
  const strong = business.strong ?? 0;
  if (!knows('goFullTime') || p.life.career === null || p.businesses.some((x) => x.fullTime === true)) return null;
  if (strong < rule.strongRounds) return null;
  const job = text.careers[p.life.career.id].levels[p.life.career.level];
  return (
    <View style={{ gap: 6 }}>
      <Button variant={leaving ? 'primary' : 'secondary'} onPress={go}>
        {leaving ? t('fullTime.leaving') : t('fullTime.go')}
      </Button>
      <ReadText size={12} lineHeight={12 * SNUG} tone="ink-300">{t('fullTime.goHint', { job, pct: rule.profitPct - 100, focus: rule.focus })}</ReadText>
    </View>
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
  const once = useOnce();
  const run = useRunLine()(business);
  // A business opened by an order of this round is not the player's to run until the round is played.
  const standing = view.player.businesses.find((x) => x.id === business.id);
  const regime = view.timeline[view.round].regime;
  const isSetting = (order: Order) => order.type === 'setBusiness' && order.businessId === business.id;
  const isTending = (order: Order) => order.type === 'tendBusiness' && order.businessId === business.id;
  const set = (want: Partial<{ payoutPct: number; manager: boolean }>) =>
    setOrder(isSetting, settingOrder(view, business.id, { payoutPct: business.payoutPct, manager: business.manager, ...want }));
  const name = text.businessTypes[business.typeId].name;

  // One sheet at a time: putting money in takes the place of the business, and gives it back when done.
  if (investing) {
    return <AmountSheet title={t('investTitle', { name })} max={shown.player.cash} onClose={() => setInvesting(false)} onConfirm={(amount) => addOrder({ type: 'investBusiness', businessId: business.id, amount })} />;
  }

  return (
    <Sheet open onClose={onClose} title={name} closeLabel={common('close')}>
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Bare style={{ padding: 4 }}>
            <Sprite id={grownArt(business, content.business.types)} />
          </Bare>
          <View style={{ minWidth: 0, flexShrink: 1 }}>
            <KeyFigure>{fmt.money(business.capital)}</KeyFigure>
            <ReadText size={12} tone="ink-300">{t('capitalHint')}</ReadText>
          </View>
        </View>
        <ReadText size={13} tone={run.tone}>{run.text}</ReadText>
        <Review neglected={business.neglected} manager={business.manager} profit={business.profit} />

        <Panel label={t('thisRound')}>
          <PixelText size={12} tone="gold-200" style={{ marginBottom: 4, textTransform: 'uppercase', letterSpacing: 12 * 0.05 }}>{t('thisRound')}</PixelText>
          <Row left={t('profit')} sub={t('economyLine', { pct: signedPct(business.cyclePct) })} right={<Figure tone={business.profit >= 0 ? 'teal-300' : 'wine-300'}>{fmt.signed(business.profit)}</Figure>} />
          <Row left={t('payout')} right={fmt.money(business.payout)} />
          <Row left={t(business.retained >= 0 ? 'retained' : 'lost')} right={<Figure tone={business.retained < 0 ? 'wine-300' : 'cream'}>{fmt.signed(business.retained)}</Figure>} />
          {business.neglected ? <ReadText size={12} lineHeight={12 * SNUG} tone="wine-300" style={{ marginTop: 4 }}>{t('neglected', { pct: content.business.neglectProfitPct })}</ReadText> : null}
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
                  disabled={standing.tended || (!business.tended && quote.focusLeft < 1)}
                  onChange={(on) => {
                    // The owner takes over from a manager: the manager goes this round.
                    if (on) set({ manager: false });
                    setOrder(isTending, on ? { type: 'tendBusiness', businessId: business.id } : null);
                  }}
                  label={t('tend')}
                  hint={t('tendHint', { left: quote.focusLeft })}
                />
                <Toggle
                  on={business.manager}
                  onChange={(manager) => {
                    // A manager takes over from the owner: their focus is given back.
                    if (manager) setOrder(isTending, null);
                    set({ manager });
                  }}
                  label={t('manager')}
                  hint={t('managerHint', { pct: business.managerPct })}
                />
              </>
            )}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button variant="secondary" cell onPress={() => setInvesting(true)} disabled={shown.player.cash <= 0}>
                {t('invest')}
              </Button>
              <Button
                variant="danger"
                cell
                onPress={() => {
                  if (once(() => setOrder((order) => order.type === 'sellBusiness' && order.businessId === business.id, { type: 'sellBusiness', businessId: business.id }))) onClose();
                }}
              >
                <Sprite id={HANDOVER_ART} />
                {t('sell', { amount: fmt.compact(business.salePrice) })}
              </Button>
            </View>
            <ReadText size={12} lineHeight={12 * SNUG} tone="ink-300">
              {[t('sellHint', { pct: content.business.salePct[regime] }), business.salePrice > business.basis ? t('sellGain', { amount: fmt.money(business.salePrice - business.basis) }) : ''].filter((part) => part !== '').join(' ')}
            </ReadText>
          </>
        ) : (
          <ReadText size={13} lineHeight={13 * SNUG} tone="ink-200">{t('opensNow')}</ReadText>
        )}
      </View>
    </Sheet>
  );
}
