import { content, lives, textFor } from '@ratrace/content';
import { createGame, viewOf } from '@ratrace/engine';
import type { Effects, GameEvent, Order } from '@ratrace/engine';
import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { formatFor } from '@/lib/format';
import en from '../../messages/en.json';
import es from '../../messages/es.json';
import ru from '../../messages/ru.json';
import { ageAt, chancePct, cityLight, debtLabel, effectTags, endingOf, headlineText, loanPlan, orderLabel, portraitAge, prizedBadge, priceHistory, roundNotes, worthBars } from './present';
import type { Translate, Words } from './present';

const words = (locale: 'en' | 'es' | 'ru'): Words => ({ content, ...textFor(locale), fmt: formatFor(locale) });
const t = (locale: 'en' | 'es' | 'ru', namespace: 'effects' | 'orders' | 'resolve'): Translate =>
  createTranslator({ locale, messages: { en, es, ru }[locale], namespace }) as unknown as Translate;

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

describe('a plan to invest, told after the round', () => {
  it('is news only when it could not buy, and then says why', () => {
    const notes = (reason: 'not-enough-cash' | null) => roundNotes(words('en'), t('en', 'resolve'), [{ kind: 'planRan', assetId: 'sp500', amount: 200_000, reason }]);
    expect(notes(null)).toEqual([]);
    expect(notes('not-enough-cash')).toEqual([{ tone: 'bad', icon: 'icon.fund', title: 'Your plan did not buy S&P 500: it needed $2,000.', hint: words('en').text.reasons['not-enough-cash'] }]);
  });
});

describe('the last picture of a life', () => {
  it('is the way out for someone who got out, an empty room for someone with nothing, and a balcony for everyone else', () => {
    expect(endingOf(true, 5_000_000)).toBe('escaped');
    expect(endingOf(true, -1)).toBe('escaped');
    expect(endingOf(false, 0)).toBe('ruined');
    expect(endingOf(false, -500)).toBe('ruined');
    expect(endingOf(false, 1)).toBe('retired');
  });
});

describe('the sky over the city', () => {
  it('is rain in a crisis or a recession, fireworks in a boom, and otherwise day for the news and night after', () => {
    const calm = { regime: 'expansion' as const, crisis: null };
    expect(cityLight(calm, true)).toBe('day');
    expect(cityLight(calm, false)).toBe('night');
    expect(cityLight({ ...calm, regime: 'boom' }, true)).toBe('boom');
    expect(cityLight({ ...calm, regime: 'boom' }, false)).toBe('boom');
    expect(cityLight({ ...calm, regime: 'recession' }, true)).toBe('crisis');
    // A crisis by name darkens the sky whatever the economy is called that round.
    expect(cityLight({ regime: 'boom', crisis: world.crisis ?? ({ id: 'crash' } as never) }, false)).toBe('crisis');
  });
});

describe('a business, in words', () => {
  it('names what a card does with one, what is ordered of one, and what became of one', () => {
    expect(tags({ business: { typeId: 'bar', capital: 4_000_000 } })).toEqual([{ tone: 'plain', text: 'You open a business: Bar' }]);
    expect(tags({ sellBusiness: { pricePct: 170 } })).toEqual([{ tone: 'good', text: 'You sell your largest business for 170% of what it is worth' }]);
    const notes = (events: GameEvent[]) => roundNotes(words('en'), t('en', 'resolve'), events);
    expect(notes([{ kind: 'businessSold', typeId: 'shop', capital: 5_000_000, price: 4_500_000 }])).toEqual([{ tone: 'good', icon: 'business.shop', title: 'You sold your business (Online shop) for $45,000.' }]);
    expect(notes([{ kind: 'businessClosed', typeId: 'bar' }])).toEqual([{ tone: 'bad', icon: 'business.bar', title: 'Your business has closed: Bar.', hint: 'There was nothing left in it.' }]);
  });
});

describe('a margin call, told after the round', () => {
  it('says what was sold, and whether the sale covered the loan', () => {
    const note = (sold: number, repaid: number) => roundNotes(words('en'), t('en', 'resolve'), [{ kind: 'marginCall', assetId: 'sp500', sold, repaid }])[0];
    expect(note(900_000, 700_000)).toEqual({ tone: 'bad', icon: 'icon.loan', title: 'The broker has sold your S&P 500.', hint: 'It fell too far for what you owed. It sold for $9,000, and $7,000 went to pay the loan.' });
    expect(note(500_000, 700_000).hint).toBe('It fell too far for what you owed. It sold for $5,000, and you had to find another $2,000.');
  });
});

describe('debts named for what they bought', () => {
  it('names a margin loan for the investment it is on', () => {
    expect(debtLabel(words('en'), { kind: 'margin', forAsset: 'sp500' })).toBe('Margin loan · S&P 500');
    expect(debtLabel(words('es'), { kind: 'margin', forAsset: 'sp500' })).toBe('Préstamo de margen · S&P 500');
  });
});

describe('the badge the end of a life cheers', () => {
  it('is the rarest won for the first time, and none when nothing rare was won', () => {
    expect(prizedBadge(['millionaire', 'ten_million', 'escaped_before_35'])?.id).toBe('escaped_before_35');
    expect(prizedBadge(['millionaire', 'supercar'])?.id).toBe('supercar');
    expect(prizedBadge(['millionaire', 'first_share'])).toBeUndefined();
    expect(prizedBadge([])).toBeUndefined();
  });
});

describe('an inspection, told after the round', () => {
  it('says what it took in all, and what of it was tax, fine and goods', () => {
    const [note] = roundNotes(words('en'), t('en', 'resolve'), [{ kind: 'audit', evaded: 300_000, fine: 150_000, goods: 50_000 }]);
    expect(note).toMatchObject({
      tone: 'bad',
      icon: 'icon.tax',
      title: 'Tax inspection: you pay $5,000.',
      hint: '$3,000 of tax, a $1,500 fine and $500 for what you bought without an invoice. Nothing is hidden any more.',
    });
  });
});

describe('a repair, told after the round', () => {
  it('names the thing bought second hand and what its repair cost, as bad news', () => {
    const [note] = roundNotes(words('en'), t('en', 'resolve'), [{ kind: 'repair', itemId: 'car_seat_ibiza', amount: 144_000 }]);
    expect(note).toMatchObject({ tone: 'bad', icon: 'icon.repair_car', title: 'Repair for your SEAT Ibiza: $1,440.' });
  });
});

describe('a move, told after the round', () => {
  it('says what it cost besides its price, and nothing when it cost nothing', () => {
    const note = (rungsLost: number, partnerIdle: boolean) =>
      roundNotes(words('en'), t('en', 'resolve'), [{ kind: 'moved', cityId: 'london', rungsLost, partnerIdle }])[0];
    expect(note(0, false)).toMatchObject({ title: 'You moved to London.', hint: undefined });
    expect(note(1, false).hint).toBe('You start a rung down, until your next promotion.');
    expect(note(1, true).hint).toBe('You start a rung down, until your next promotion. Your partner is looking for work: a round without their pay.');
  });
});

describe('debtLabel', () => {
  it('names a debt by its kind, and by the thing it bought when it bought one', () => {
    expect(debtLabel(words('en'), { kind: 'personalLoan' })).toBe('Personal loan');
    expect(debtLabel(words('en'), { kind: 'personalLoan', forItem: 'car_seat_ibiza' })).toBe('Personal loan · SEAT Ibiza');
    expect(debtLabel(words('es'), { kind: 'personalLoan', forItem: 'car_seat_ibiza' })).toBe('Préstamo personal · SEAT Ibiza');
    // A mortgage is named for the home it is on, and not for another's.
    const flat = { id: 'property-1', cityId: 'london', typeId: 'flat', value: 1, basis: 1, rented: false, mortgageId: 'debt-7' };
    expect(debtLabel(words('en'), { id: 'debt-7', kind: 'mortgageFixed' }, [flat])).toBe('Fixed mortgage · Flat in Islington, London');
    expect(debtLabel(words('es'), { id: 'debt-7', kind: 'mortgageVariable' }, [flat])).toBe('Hipoteca variable · Piso en Islington, Londres');
    expect(debtLabel(words('en'), { id: 'debt-8', kind: 'mortgageFixed' }, [flat])).toBe('Fixed mortgage');
    // A thing no longer in the game is not named.
    expect(debtLabel(words('en'), { kind: 'personalLoan', forItem: 'gone' })).toBe('Personal loan');
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
      { tone: 'good', text: '+1 Finance' },
      { tone: 'bad', text: '−2 status' },
      { tone: 'bad', text: '−2 focus' },
    ]);
  });

  it('names the skill a card teaches', () => {
    expect(tags({ skills: { languages: 3, health: -1 } })).toEqual([
      { tone: 'good', text: 'Languages +3' },
      { tone: 'bad', text: 'Health −1' },
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
      { tone: 'good', text: '+$14k/yr' },
      { tone: 'bad', text: '−$7k/yr for 12 years' },
    ]);
  });

  it('names the things an option brings', () => {
    expect(
      tags({
        job: { career: 'finance', level: 0 }, moveCity: 'london', partner: { salaryPct: 85 }, children: 1,
        buyItem: { itemId: 'watch_rolex', pricePct: 100 }, invest: { assetId: 'tesla', amount: 200_000 }, pension: 400_000, loan: 1_200_000,
        property: { typeId: 'studio', pricePct: 85, downPct: 25, rented: true }, refinance: 'fixed', homeValue: 2_000_000,
        lose: { what: 'crypto', pct: 40 }, lifestyleFloor: 1,
      }).map((tag) => tag.text),
    ).toEqual([
      'New career: Finance', 'Move to London', 'A shared life', 'A child', 'Rolex Submariner', 'Status +18', '−$150/yr', '+6 points of chance on a job hunt', '$2k into Tesla', '+$4k pension', 'Loan of $12k',
      'You buy a rental: Studio', 'Your variable mortgages go fixed, at 4.0%', 'Home value +$20k', 'Lose 40% of your crypto', 'Lifestyle at least: Normal',
    ]);
    expect(tags({ job: { leave: true }, partner: null, sellHome: true, lose: { what: 'deposit', pct: 15 } }).map((tag) => tag.text)).toEqual([
      'You stop working', 'You separate', 'You sell your home', 'Lose 15% of your savings',
    ]);
    expect(tags({ job: { levelDelta: 1 } })[0]).toEqual({ tone: 'good', text: 'A step up' });
    expect(tags({ job: { levelDelta: -1 } })[0]).toEqual({ tone: 'bad', text: 'A step down' });
  });

  it('says what a thing offered gives: its status, how long that lasts, and the price it is usually sold at', () => {
    // An upgrade at the gate: a trip, at two fifths of its price.
    expect(tags({ buyItem: { itemId: 'travel_business_class', pricePct: 40 } })).toEqual([
      { tone: 'plain', text: 'Emirates business class' },
      { tone: 'good', text: 'Status +9 for 4 years' },
      { tone: 'good', text: '+1 focus in the round after' },
      { tone: 'plain', text: 'Usually $6k' },
    ]);
    // At full price there is no bargain to name, and a thing that lasts gives its status for good.
    expect(tags({ buyItem: { itemId: 'watch_casio', pricePct: 100 } }).map((tag) => tag.text)).toEqual(['Casio F-91W', 'Status +1']);
    expect(tags({ buyItem: { itemId: 'travel_business_class', pricePct: 40 } }, 'es').map((tag) => tag.text.replace(/\u00a0/g, ' '))).toEqual([
      'Business de Emirates', 'Estatus +9 durante 4 años', '+1 de foco en la ronda siguiente', 'Precio normal 6k $',
    ]);
  });

  it('writes a renovation at today\u2019s prices, as the engine will add it', () => {
    const later = { ...world, priceLevel: world.priceLevel * 2 };
    expect(effectTags(words('en'), t('en', 'effects'), later, { homeValue: 2_000_000 })).toEqual([{ tone: 'good', text: 'Home value +$40k' }]);
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
    expect(label({ type: 'buyProperty', typeId: 'studio', downPayment: 1, mortgage: 'fixed', rented: false })).toBe('Buy a home: Studio in Koenji');
    expect(label({ type: 'buyProperty', typeId: 'studio', downPayment: 1, mortgage: 'fixed', rented: true })).toBe('Buy a rental: Studio in Koenji');
    expect(label({ type: 'sellProperty', propertyId: 'property-9' })).toBe('Sell: Flat in Chamberí');
    expect(label({ type: 'setRented', propertyId: 'property-9', rented: true })).toBe('Rent out: Flat in Chamberí');
    expect(label({ type: 'setRented', propertyId: 'property-9', rented: false })).toBe('Stop renting out: Flat in Chamberí');
    // Work is named as the player's job names it: an engineer's overtime is on call.
    expect(label({ type: 'focus', action: 'overtime' })).toBe('On-call shifts');
    expect(label({ type: 'focus', action: 'studyCareer' })).toBe('Learn a new stack');
    expect(label({ type: 'focus', action: 'jobHunt' })).toBe('Move to another company');
    expect(label({ type: 'focus', action: 'askRaise' })).toBe('Ask for a raise');
    expect(label({ type: 'focus', action: 'tease', target: 'someone' })).toBe('Tease a rival');
    expect(label({ type: 'setPlan', assetId: 'sp500', amount: 200_000 })).toBe('Invest $2,000 every round in S&P 500');
    expect(label({ type: 'setPlan', assetId: 'sp500', amount: 0 })).toBe('Stop investing in S&P 500');
    expect(label({ type: 'buy', assetId: 'sp500', amount: 100_000, margin: 100_000 })).toBe('Buy $2,000 of S&P 500 on margin (you put in $1,000)');
    expect(label({ type: 'setReinvest', on: true })).toBe('Reinvest the dividends');
    expect(label({ type: 'setReinvest', on: false })).toBe('Take the dividends as cash');
    expect(label({ type: 'buyItem', itemId: 'watch_rolex' })).toBe('Buy Rolex Submariner');
    expect(label({ type: 'buyItem', itemId: 'watch_rolex', used: true })).toBe('Buy Rolex Submariner second hand');
    expect(label({ type: 'buyItem', itemId: 'watch_rolex', used: true }, 'es')).toBe('Comprar Rolex Submariner de segunda mano');
    expect(label({ type: 'buyItem', itemId: 'watch_rolex', noInvoice: true })).toBe('Buy Rolex Submariner without an invoice');
    // What is hidden: one part for each thing the order changes.
    expect(label({ type: 'setEvasion', blackPct: 25 })).toBe('Pay under the table: 25%');
    expect(label({ type: 'setEvasion', shell: true, hideCrypto: false })).toBe('Open an offshore company · Declare crypto gains');
    expect(label({ type: 'setEvasion', blackPct: 0, shell: false }, 'es')).toBe('Sueldo en negro: 0 % · Cerrar la sociedad en el paraíso fiscal');
    expect(label({ type: 'buyItem', itemId: 'watch_rolex', financed: true })).toBe('Buy Rolex Submariner on instalments');
    expect(label({ type: 'sellItem', itemId: 'watch_rolex' })).toBe('Sell Rolex Submariner');
    expect(label({ type: 'sellItem', itemId: 'member_gym' })).toBe('Cancel Gym');
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

describe('roundNotes', () => {
  const notes = (events: GameEvent[], locale: 'en' | 'es' = 'en') => roundNotes(words(locale), t(locale, 'resolve'), events);

  it('tells who teased the player, by name, and what it cost, in each language', () => {
    for (const locale of ['en', 'es', 'ru'] as const) {
      const [note] = roundNotes(words(locale), t(locale, 'resolve'), [{ kind: 'teased', by: 'user-ana', status: -2 }], (id) => (id === 'user-ana' ? 'Ana' : '?'));
      expect(note.tone).toBe('bad');
      expect(note.title).toContain('Ana');
      expect(note.hint).toContain('2');
      expect(`${note.title} ${note.hint}`).not.toMatch(/[{}]/);
    }
  });

  it('tells what happened besides the money, the biggest news first', () => {
    const told = notes([
      { kind: 'ledger', line: 'salary', amount: 5_000_000 },
      { kind: 'orderRejected', order: {}, reason: 'not-enough-cash' },
      { kind: 'jobHunt', success: true },
      { kind: 'promoted', careerId: 'tech', level: 2 },
      { kind: 'financeSkill', level: 1 },
      { kind: 'skill', skill: 'negotiation', level: 2 },
      { kind: 'moved', cityId: 'dubai', rungsLost: 0, partnerIdle: false },
      { kind: 'lapsed', itemId: 'member_season_seat' },
      { kind: 'escaped', round: 7 },
    ]);
    expect(told.map((note) => note.title)).toEqual([
      'You are out of the rat race!',
      `Promoted: ${words('en').text.careers.tech.levels[2]}`,
      'Experience pays: Finance 1.',
      'Negotiation up: level 2.',
      'The job hunt paid off: a lasting raise.',
      'You moved to Dubai.',
      'You lost Bernabéu season seat.',
      'Not done: You do not have enough cash.',
    ]);
    expect(told[0]).toMatchObject({ tone: 'gold', hint: 'Your passive income covers your life. From here on, work is a choice.' });
    expect(told[1].tone).toBe('good');
    expect(told[6].tone).toBe('bad');
  });

  it('says when the escape is lost, and when the player goes bankrupt', () => {
    const told = notes([{ kind: 'bankrupt', proceeds: 1, debtsCleared: 2 }, { kind: 'escapeLost' }, { kind: 'jobHunt', success: false }]);
    expect(told.map((note) => [note.tone, note.title])).toEqual([
      ['bad', 'Back in the rat race'],
      ['bad', 'Bankrupt'],
      ['plain', 'The job hunt led nowhere this time.'],
    ]);
    expect(told[0].hint).toContain('no longer covers');
    expect(told[1].hint).toContain('Everything is sold');
  });

  it('has nothing to tell of a quiet round, and speaks Spanish', () => {
    expect(notes([{ kind: 'ledger', line: 'salary', amount: 1 }])).toEqual([]);
    expect(notes([{ kind: 'escapeLost' }], 'es')[0].title).toBe('De vuelta a la rueda');
  });
});

describe('worthBars', () => {
  it('draws each round as a share of the best one', () => {
    const { zero, bars } = worthBars([0, 50, 100, 25]);
    expect(zero).toBe(1);
    expect(bars).toEqual([
      { y: 1, h: 0, negative: false },
      { y: 0.5, h: 0.5, negative: false },
      { y: 0, h: 1, negative: false },
      { y: 0.75, h: 0.25, negative: false },
    ]);
  });

  it('hangs a round spent in debt below the zero line', () => {
    const { zero, bars } = worthBars([-50, 150]);
    expect(zero).toBe(0.75);
    expect(bars).toEqual([
      { y: 0.75, h: 0.25, negative: true },
      { y: 0, h: 0.75, negative: false },
    ]);
  });

  it('copes with a life that never had anything, or nothing but debt', () => {
    expect(worthBars([0, 0]).bars).toEqual([{ y: 0, h: 0, negative: false }, { y: 0, h: 0, negative: false }]);
    expect(worthBars([-10, -20])).toEqual({ zero: 0, bars: [{ y: 0, h: 0.5, negative: true }, { y: 0, h: 1, negative: true }] });
    expect(worthBars([])).toEqual({ zero: 0, bars: [] });
  });
});

describe('loanPlan', () => {
  it('charges an even slice of the loan each round, with the interest of that round on what is still owed', () => {
    // 30,000 at 10% a year, two years a round, over three rounds.
    expect(loanPlan(30_000_00, 1_000, 3, 2)).toEqual({ payments: [16_000_00, 14_000_00, 12_000_00], interest: 12_000_00 });
  });
});
