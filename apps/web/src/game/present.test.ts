import { content, lives, textFor } from '@ratrace/content';
import { createGame, viewOf } from '@ratrace/engine';
import type { Effects, Order } from '@ratrace/engine';
import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { formatFor } from '@/lib/format';
import en from '../../messages/en.json';
import es from '../../messages/es.json';
import { ageAt, chancePct, effectTags, headlineText, orderLabel, portraitAge, priceHistory } from './present';
import type { Translate, Words } from './present';

const words = (locale: 'en' | 'es'): Words => ({ content, ...textFor(locale), fmt: formatFor(locale) });
const t = (locale: 'en' | 'es', namespace: 'effects' | 'orders'): Translate =>
  createTranslator({ locale, messages: locale === 'en' ? en : es, namespace }) as unknown as Translate;

const state = createGame({ content, start: lives[1].start }, 'present');
const world = state.timeline[0];
const tags = (effects: Effects, locale: 'en' | 'es' = 'en') => effectTags(words(locale), t(locale, 'effects'), world, effects);

describe('ages and portraits', () => {
  it('counts two years a round from 22', () => {
    expect(ageAt(content, 0)).toBe(22);
    expect(ageAt(content, 20)).toBe(62);
  });

  it('picks the portrait nearest in age', () => {
    expect([22, 28, 30, 41, 42, 54, 55, 62].map(portraitAge)).toEqual([22, 22, 32, 32, 45, 45, 58, 58]);
  });
});

describe('headlineText', () => {
  it('writes each kind of headline, naming the city for property', () => {
    const w = words('en');
    expect(headlineText(w, { topic: 'regime', regime: 'recession' })).toBe('Recession fears grow');
    expect(headlineText(w, { topic: 'rates', trend: 'up' })).toBe('Central bank hints at higher rates');
    expect(headlineText(w, { topic: 'property', cityId: 'new_york', trend: 'down' })).toBe('Estate agents in New York see prices falling');
    expect(headlineText(words('es'), { topic: 'property', cityId: 'new_york', trend: 'up' })).toBe('Las inmobiliarias de Nueva York ven subir los precios');
  });
});

describe('effectTags', () => {
  it('says nothing about cash, which the preview shows exactly', () => {
    expect(tags({ cash: -500_000, cashSalaryPct: 10, cashNetWorthPct: -30, protection: { insurance: 'health', coverPct: 90 } })).toEqual([]);
    expect(effectTags(words('en'), t('en', 'effects'), world, undefined)).toEqual([]);
  });

  it('marks what helps as good and what hurts as bad', () => {
    expect(tags({ salaryModPct: 5, salaryBoostPct: -40, careerSkill: 3, financeSkill: 1, status: -2, focus: 2 })).toEqual([
      { tone: 'good', text: '+5% salary for good' },
      { tone: 'bad', text: '−40% pay this round' },
      { tone: 'good', text: '+3 career skill' },
      { tone: 'good', text: '+1 finance skill' },
      { tone: 'bad', text: '−2 status' },
      { tone: 'bad', text: '−2 focus' },
    ]);
  });

  it('writes yearly income and costs, with their length', () => {
    expect(
      tags({
        recurring: [
          { tag: 'bar', kind: 'passive', annual: 1_400_000, roundsLeft: null },
          { tag: 'school', kind: 'expense', annual: 700_000, roundsLeft: 6 },
        ],
      }),
    ).toEqual([
      { tone: 'good', text: '+$14,000/yr' },
      { tone: 'bad', text: '−$7,000/yr for 12 years' },
    ]);
  });

  it('names the things an option brings', () => {
    expect(
      tags({
        job: { career: 'finance', level: 0 }, moveCity: 'london', partner: { salaryPct: 85 }, children: 1,
        buyItem: { itemId: 'watch_rolex', pricePct: 100 }, invest: { assetId: 'tesla', amount: 200_000 }, pension: 400_000, loan: 1_200_000,
        property: { typeId: 'studio', pricePct: 85, downPct: 25, rented: true }, refinance: 'fixed', homeValuePct: 9,
        lose: { what: 'crypto', pct: 40 }, lifestyleFloor: 1,
      }).map((tag) => tag.text),
    ).toEqual([
      'New career: Finance', 'Move to London', 'A shared life', 'A child', 'Rolex Submariner', '$2,000 into Tesla', '+$4,000 pension', 'Loan of $12,000',
      'You buy a rental: Studio', 'Mortgage becomes fixed', 'Home value +9%', 'Lose 40% of your crypto', 'Lifestyle at least: Normal',
    ]);
    expect(tags({ job: { leave: true }, partner: null, sellHome: true, lose: { what: 'deposit', pct: 15 } }).map((tag) => tag.text)).toEqual([
      'You stop working', 'You separate', 'You sell your home', 'Lose 15% of your savings',
    ]);
    expect(tags({ job: { levelDelta: 1 } })[0]).toEqual({ tone: 'good', text: 'A step up' });
    expect(tags({ job: { levelDelta: -1 } })[0]).toEqual({ tone: 'bad', text: 'A step down' });
  });

  it('speaks Spanish', () => {
    expect(tags({ salaryModPct: 5, children: 2, moveCity: 'london', lose: { what: 'deposit', pct: 15 } }, 'es').map((tag) => tag.text)).toEqual([
      '+5 % de sueldo para siempre', 'Te mudas a Londres', '2 hijos', 'Pierdes el 15 % de tu ahorro',
    ]);
  });
});

describe('chancePct', () => {
  it('rounds a chance the way a person would read it', () => {
    expect(chancePct(50, 100)).toBe('50');
    expect(chancePct(1, 3)).toBe('33');
    expect(chancePct(9_500, 100_000)).toBe('9.5');
    expect(chancePct(800, 100_000)).toBe('0.8');
    expect(chancePct(2, 100_000)).toBe('0.002');
    expect(chancePct(18, 100_000)).toBe('0.02');
  });
});

describe('orderLabel', () => {
  const player = structuredClone(state.player);
  player.properties.push({ id: 'property-9', cityId: 'madrid', typeId: 'flat', value: 1, basis: 1, rented: false, mortgageId: null });
  const label = (order: Order, locale: 'en' | 'es' = 'en') => orderLabel(words(locale), t(locale, 'orders'), player, order);

  it('describes every kind of order', () => {
    expect(label({ type: 'buy', assetId: 'msci_world', amount: 100_000 })).toBe('Buy MSCI World · $1,000');
    expect(label({ type: 'sell', assetId: 'bitcoin', amount: 250_000 })).toBe('Sell Bitcoin · $2,500');
    expect(label({ type: 'depositIn', amount: 50_000 })).toBe('Save $500');
    expect(label({ type: 'depositOut', amount: 50_000 })).toBe('Withdraw $500');
    expect(label({ type: 'pensionIn', amount: 50_000 })).toBe('Pension · $500');
    expect(label({ type: 'borrow', amount: 1_000_000 })).toBe('Borrow $10,000');
    expect(label({ type: 'repay', debtId: 'debt-1', amount: 100_000 })).toBe('Repay Personal loan · $1,000');
    expect(label({ type: 'buyProperty', typeId: 'studio', downPayment: 1, mortgage: 'fixed', rented: false })).toBe('Buy a home: Studio');
    expect(label({ type: 'buyProperty', typeId: 'studio', downPayment: 1, mortgage: 'fixed', rented: true })).toBe('Buy a rental: Studio');
    expect(label({ type: 'sellProperty', propertyId: 'property-9' })).toBe('Sell: Flat');
    expect(label({ type: 'setRented', propertyId: 'property-9', rented: true })).toBe('Rent out: Flat');
    expect(label({ type: 'setRented', propertyId: 'property-9', rented: false })).toBe('Stop renting out: Flat');
    expect(label({ type: 'focus', action: 'overtime' })).toBe('Overtime');
    expect(label({ type: 'focus', action: 'studyCareer' })).toBe('Study');
    expect(label({ type: 'focus', action: 'jobHunt' })).toBe('Job hunt');
    expect(label({ type: 'buyItem', itemId: 'watch_rolex' })).toBe('Buy Rolex Submariner');
    expect(label({ type: 'sellItem', itemId: 'watch_rolex' })).toBe('Sell Rolex Submariner');
    expect(label({ type: 'sellItem', itemId: 'member_gym' })).toBe('Cancel Basic-Fit');
    expect(label({ type: 'setLifestyle', tier: 0 })).toBe('Live: Frugal');
    expect(label({ type: 'setRentTier', tier: 0 })).toBe('Home: Rented room');
    expect(label({ type: 'setInsurance', insurance: 'health', on: true })).toBe('Insure: Health insurance');
    expect(label({ type: 'setInsurance', insurance: 'health', on: false })).toBe('Cancel: Health insurance');
    expect(label({ type: 'moveCity', cityId: 'dubai' })).toBe('Move to Dubai');
  });

  it('speaks Spanish', () => {
    expect(label({ type: 'moveCity', cityId: 'dubai' }, 'es')).toBe('Mudarte a Dubái');
    expect(label({ type: 'setLifestyle', tier: 0 }, 'es')).toBe('Vivir: Austero');
  });
});

describe('priceHistory', () => {
  it('follows an asset from one, round by round, and stops where the view stops', () => {
    const view = viewOf(state);
    expect(priceHistory(view, 'msci_world')).toEqual([1]);
    const later = { ...view, round: 2, timeline: state.timeline.slice(0, 3) };
    const history = priceHistory(later, 'bitcoin');
    expect(history).toHaveLength(3);
    expect(history[0]).toBe(1);
    expect(history[2]).toBe(state.timeline[2].assetIndex.bitcoin / state.timeline[0].assetIndex.bitcoin);
  });
});
