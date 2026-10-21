import { adviserQuip } from '@ratrace/core/game/quips';
import { ageAt } from '@ratrace/core/game/present';
import { effectiveTax, quoteEvasion } from '@ratrace/engine';
import type { GameView, Order, RoundPreview } from '@ratrace/engine';
import { useMemo } from 'react';
import { View } from 'react-native';
import { Bar, Button, Panel, Segmented, Toggle } from '../../ui/kit';
import { ReadText, SNUG } from '../../ui/text';
import { COLORS } from '../../ui/theme';
import { useGame, useT, useWords } from '../context';
import { Explain } from './Explain';

type Want = { blackPct: number; shell: boolean; hideCrypto: boolean };

/**
 * The one order that leaves what is hidden as asked: only what differs from how the life stands is
 * ordered, and nothing at all when nothing differs, so choosing what is already so takes it back.
 */
export function evasionOrder(view: GameView, want: Want): Order | null {
  const now = view.player.life.evasion;
  const order: Extract<Order, { type: 'setEvasion' }> = { type: 'setEvasion' };
  if (want.blackPct !== now.blackPct) order.blackPct = want.blackPct;
  if (want.shell !== now.shell) order.shell = want.shell;
  if (want.hideCrypto !== now.hideCrypto) order.hideCrypto = want.hideCrypto;
  return Object.keys(order).length > 1 ? order : null;
}

/** Words that run on in one paragraph, the empty ones left out (the web's JSX leaves a space HTML does not draw, and the phone would). */
const joined = (...parts: string[]): string => parts.filter((part) => part !== '').join(' ');

/**
 * What the player hides from the tax office, and what it risks, beside the tax it lowers. Every
 * figure is the engine's, as the round will be played with the orders given so far (worked out once for each round as it stands).
 */
export function EvasionPanel({ shown, preview }: { shown: GameView; preview: RoundPreview }) {
  const t = useT('finance.evasion');
  const { content, fmt } = useWords();
  const view = useGame((s) => s.view);
  const setOrder = useGame((s) => s.setOrder);
  const city = content.cities.find((each) => each.id === shown.player.cityId);
  const tax = city ? effectiveTax(city, shown.timeline[shown.round]) : null;
  const gainsBp = tax?.capitalGainsBp ?? 0;
  // What an offshore company cuts is the tax on investments: gains, dividends (at the residency's rate, where one is held) and rent taxed apart from salary.
  const dividendBp = shown.player.life.residency && city?.residency ? city.residency.dividendBp : (tax?.dividendBp ?? 0);
  const investmentTaxed = tax !== null && (gainsBp > 0 || dividendBp > 0 || (!tax.rentAsIncome && tax.rentBp > 0));
  // Where nothing is taxed there is nothing to hide, unless something hidden elsewhere is still in force.
  const taxFree = tax !== null && [...tax.incomeRatesBp, tax.capitalGainsBp, tax.dividendBp, tax.rentBp].every((rate) => rate === 0);
  const quote = useMemo(() => quoteEvasion(content, shown, preview.evaded, preview.noInvoiceSold), [content, shown, preview]);
  if (!view || (taxFree && !quote.shell && !quote.hideCrypto && quote.blackPct === 0)) return null;
  const want: Want = { blackPct: quote.blackPct, shell: quote.shell, hideCrypto: quote.hideCrypto };
  const change = (part: Partial<Want>) => setOrder((order) => order.type === 'setEvasion', evasionOrder(view, { ...want, ...part }));
  const saved = (amount: number) => (amount > 0 ? t('saved', { amount: fmt.money(amount) }) : t('savedNothing'));

  // Where nothing is taxed, what is still hidden from elsewhere can only be given up: one line, one button.
  if (taxFree) {
    return (
      <Panel title={t('title')} label={t('title')}>
        <ReadText size={13} lineHeight={13 * SNUG} tone="ink-200">{t('taxFree')}</ReadText>
        <View style={{ marginTop: 8 }}>
          <Button variant="secondary" wide onPress={() => change({ blackPct: 0, shell: false, hideCrypto: false })}>
            {t('stopHiding')}
          </Button>
        </View>
      </Panel>
    );
  }

  return (
    <Panel title={t('title')} label={t('title')}>
      <View style={{ gap: 12 }}>
        <Explain>{t('about')}</Explain>
        <Segmented<number>
          label={t('black')}
          value={quote.blackPct}
          onChange={(blackPct) => change({ blackPct })}
          options={quote.blackPcts.map((pct) => ({ value: pct, label: pct === 0 ? t('blackNone') : t('blackPct', { pct }), disabled: pct > 0 && !quote.canBlack }))}
        />
        <ReadText size={12} tone="ink-300" style={{ marginTop: -4 }}>{quote.canBlack ? (quote.blackPct > 0 ? saved(quote.evaded.black) : t('blackHint')) : t('blackNoJob')}</ReadText>
        {/* An offshore company is offered only to someone who knows how to run one, where investments are taxed, or to whoever already has one. */}
        {quote.shell || (quote.shellLock === null && investmentTaxed) ? (
          <Toggle
            on={quote.shell}
            onChange={(shell) => change({ shell })}
            label={t('shell')}
            hint={joined(t('shellHint', { pct: quote.shellTaxCutPct, fee: fmt.money(quote.shellFeeAnnual) }), quote.shell ? saved(quote.evaded.shell) : '')}
          />
        ) : null}
        {/* Crypto gains are taxed as the city taxes any gain: where it taxes none, there is nothing to hide. */}
        {quote.hideCrypto || gainsBp > 0 ? (
          <Toggle
            on={quote.hideCrypto}
            onChange={(hideCrypto) => change({ hideCrypto })}
            label={t('crypto')}
            hint={quote.hideCrypto ? saved(quote.evaded.crypto) : t('cryptoHint', { rate: fmt.rate(gainsBp), age: ageAt(content, content.evasion.cryptoReportRound) })}
          />
        ) : null}

        {/* What it risks, set off by a rule: never a box inside a box. */}
        <View role="region" aria-label={t('risk')} style={{ gap: 6, borderTopWidth: 2, borderTopColor: COLORS['night-900'], paddingTop: 12 }}>
          <Bar value={quote.suspicionAfter} max={100} label={t('suspicion')} tone="gold" />
          <ReadText size={13}>{t('chance', { pct: quote.auditChancePct })}</ReadText>
          {/* How hard the tax office of this city looks: the same hiding is riskier in New York than in Bangkok. */}
          <ReadText size={12} tone="ink-300">{t(quote.taxOfficePct > 100 ? 'officeStrict' : quote.taxOfficePct < 80 ? 'officeLax' : 'officeUsual')}</ReadText>
          {quote.bill.total > 0 ? (
            <ReadText size={13} lineHeight={13 * SNUG} tone="wine-300">
              {t('bill', { total: fmt.money(quote.bill.total), evaded: fmt.money(quote.bill.evaded), fine: fmt.money(quote.bill.fine), goods: fmt.money(quote.bill.goods) })}
            </ReadText>
          ) : null}
          <ReadText size={12} lineHeight={12 * SNUG} tone="ink-300">{t('limit', { years: quote.limitationYears, status: content.evasion.auditStatus })}</ReadText>
          {/* The adviser's word: who speaks in small gold capitals, what they say in italics, one paragraph. */}
          <ReadText size={12} lineHeight={12 * SNUG} after={[{ text: `${t('advisor.title')}: `.toUpperCase(), tone: 'gold-200', pixel: true, tracking: 12 * 0.05 }, { text: t(`advisor.${adviserQuip(quote.suspicionAfter)}`), tone: 'ink-200', italic: true }]}>
            {''}
          </ReadText>
        </View>
      </View>
    </Panel>
  );
}
