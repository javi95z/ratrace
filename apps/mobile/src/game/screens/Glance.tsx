import { assetKind, homeName } from '@ratrace/content';
import { quotePortfolio } from '@ratrace/engine';
import type { Content, GameView, PortfolioQuote, WealthKind } from '@ratrace/engine';
import { View } from 'react-native';
import { Framed } from '../../ui/Frame';
import { webBaseline } from '../../ui/fonts';
import { KeyFigure, Panel, Row, Toggle } from '../../ui/kit';
import { PixelText, ReadText, SNUG } from '../../ui/text';
import { COLORS, type ColorToken } from '../../ui/theme';
import { useGame, useSettings, useT, useWords } from '../context';
import { useShown } from './Hud';

/** One colour a kind, the same in the bar and in its legend. */
const COLOUR: Record<WealthKind, ColorToken> = {
  cash: 'ink-300',
  savings: 'sky-300',
  pension: 'sky-500',
  equity: 'gold-500',
  bond: 'teal-300',
  crypto: 'wine-300',
  gold: 'gold-200',
  property: 'skin-500',
  business: 'teal-600',
  things: 'ink-500',
  lent: 'wine-500',
};

/**
 * The engine's quote of everything owned, once for each round as it is shown: the glance, what is paid and the holdings all read the one. Kept by
 * the player as the round's orders leave them (the store's own object, the same for every part that shows it, where each part's `shown` is its own),
 * for the same world.
 */
const quotes = new WeakMap<GameView['player'], { content: Content; timeline: GameView['timeline']; round: number; quote: PortfolioQuote }>();
export function portfolioQuote(content: Content, shown: GameView): PortfolioQuote {
  const kept = quotes.get(shown.player);
  if (kept !== undefined && kept.content === content && kept.timeline === shown.timeline && kept.round === shown.round) return kept.quote;
  const quote = quotePortfolio(content, shown);
  quotes.set(shown.player, { content, timeline: shown.timeline, round: shown.round, quote });
  return quote;
}

/**
 * Where the two words of the line over the bar stand, so their baselines meet (the web's `items-baseline`): what it is (13) and the total
 * (the key figure, 28 on a line of 28).
 */
function totalLine(language: string): { label: number; total: number } {
  const label = webBaseline('read', 400, 13, 13 * 1.45, language);
  const total = webBaseline('pixel', 400, 28, 28, language);
  const top = Math.max(label, total);
  return { label: top - label, total: top - total };
}

/**
 * Everything the player owns in one bar: what it is held in and in what shares, the one thing most
 * of it hangs on, and a warning when that is too much. Every figure is the engine's quote.
 */
export function PortfolioGlance() {
  const t = useT('finance.glance');
  const { content, text, names, fmt } = useWords();
  const { locale } = useSettings();
  const shown = useShown();
  // Worked out once for the round as it stands, not again for every drawing, nor for each part that reads it.
  const quote = portfolioQuote(content, shown);
  const top = quote.largest;
  const property = top?.kind === 'property' ? shown.player.properties.find((x) => x.id === top.id) : undefined;
  const business = top?.kind === 'business' ? shown.player.businesses.find((x) => x.id === top.id) : undefined;
  // Too much in one thing is a danger only where one thing can fall alone: a single stock or a coin.
  // A fund already holds the market, and a home or a business is how most lives hold their wealth.
  const asset = top?.kind === 'asset' ? content.assets.find((x) => x.id === top.id) : undefined;
  const risky = asset !== undefined && (assetKind(asset) === 'stock' || assetKind(asset) === 'crypto');
  const topName = !top ? '' : top.kind === 'asset' ? names.assets[top.id].name : property ? `${homeName(text, property.typeId, property.cityId)}, ${names.cities[property.cityId]}` : business ? text.businessTypes[business.typeId].name : '';
  const line = totalLine(locale);
  // The legend, two to a row (the web's `grid-cols-2`): a short last row keeps the width of a column.
  const rows: Array<typeof quote.slices> = [];
  for (let i = 0; i < quote.slices.length; i += 2) rows.push(quote.slices.slice(i, i + 2));

  return (
    <Panel title={t('title')} label={t('title')}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <ReadText size={13} tone="ink-300" style={{ marginTop: line.label, flexShrink: 1 }}>{t('total')}</ReadText>
        <View style={{ marginTop: line.total }}>
          <KeyFigure>{fmt.money(quote.total)}</KeyFigure>
        </View>
      </View>
      {quote.total > 0 ? (
        <>
          {/* The bar is a picture of the list under it, which says the same in words and figures. */}
          <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" {...{ dataSet: { glanceBar: 'true' } }}>
            {/* The web's `frame sunk`, where the later `sunk` wins: a sunk edge and no outline, covered where the slices lie. */}
            <Framed kind="sunk" style={{ marginTop: 8, height: 16, flexDirection: 'row', overflow: 'hidden', backgroundColor: COLORS['night-900'] }}>
              {quote.slices.map((slice) => (
                <View key={slice.kind} {...{ dataSet: { slice: slice.kind } }} style={{ width: `${slice.shareBp / 100}%`, backgroundColor: COLORS[COLOUR[slice.kind]] }} />
              ))}
            </Framed>
          </View>
          <View role="list" style={{ marginTop: 8, gap: 4 }}>
            {rows.map((pair) => (
              <View key={pair[0].kind} style={{ flexDirection: 'row', gap: 16 }}>
                {pair.map((slice) => (
                  <View key={slice.kind} role="listitem" style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0, flexShrink: 1 }}>
                      <View aria-hidden style={{ width: 10, height: 10, flexShrink: 0, backgroundColor: COLORS[COLOUR[slice.kind]] }} />
                      <ReadText size={13} numberOfLines={1} style={{ flexShrink: 1 }}>{t(`kinds.${slice.kind}`)}</ReadText>
                    </View>
                    <PixelText size={13} tone="ink-200" style={{ flexShrink: 0 }}>{fmt.rate(slice.shareBp)}</PixelText>
                  </View>
                ))}
                {pair.length < 2 ? <View style={{ flex: 1, minWidth: 0 }} /> : null}
              </View>
            ))}
          </View>
        </>
      ) : (
        <ReadText size={13} tone="ink-300" style={{ marginTop: 4 }}>{t('empty')}</ReadText>
      )}
      {top && quote.concentrated && risky ? (
        <View role="note" style={{ marginTop: 8, borderLeftWidth: 4, borderLeftColor: COLORS['wine-300'], paddingLeft: 8 }}>
          <ReadText size={13} lineHeight={13 * SNUG} tone="wine-300">{t('concentrated', { name: topName, pct: fmt.rate(top.shareBp) })}</ReadText>
        </View>
      ) : top && quote.invested > top.value ? (
        <ReadText size={12} lineHeight={12 * SNUG} tone="ink-300" style={{ marginTop: 8 }}>{t('largest', { name: topName, pct: fmt.rate(top.shareBp) })}</ReadText>
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
  const quote = portfolioQuote(content, shown);
  if (!view || (quote.dividendsTotal === 0 && quote.interest === 0 && !quote.reinvest)) return null;
  // On, and the round has cash for it; or on, and it has not.
  const short = quote.reinvest && quote.dividendsTotal > 0 && preview !== null && preview.reinvested === 0;

  return (
    <Panel title={t('paysTitle')} label={t('paysTitle')}>
      <Row left={t('dividends')} sub={t('dividendsHint')} right={<PixelText tone="teal-300" style={{ textAlign: 'right' }}>{fmt.signed(quote.dividendsTotal)}</PixelText>} />
      {quote.interest > 0 ? <Row left={t('interest')} right={<PixelText tone="teal-300" style={{ textAlign: 'right' }}>{fmt.signed(quote.interest)}</PixelText>} /> : null}
      <View style={{ marginTop: 8 }}>
        <Toggle
          on={quote.reinvest}
          onChange={(on) => setOrder((order) => order.type === 'setReinvest', on === view.player.reinvest ? null : { type: 'setReinvest', on })}
          label={t('reinvest')}
          hint={t(quote.reinvest ? 'reinvestOn' : 'reinvestOff')}
        />
      </View>
      {short ? <ReadText size={12} lineHeight={12 * SNUG} tone="wine-300" style={{ marginTop: 6 }}>{t('reinvestShort')}</ReadText> : null}
    </Panel>
  );
}
