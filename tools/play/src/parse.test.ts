import { content, lives, textFor } from '@ratrace/content';
import { createGame } from '@ratrace/engine';
import type { GameState } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { find, parse, parseAmount } from './parse';
import type { Scene } from './parse';

function scene(change: (state: GameState) => void = () => {}, locale: 'en' | 'es' = 'en'): Scene {
  const state = createGame({ content: { ...content, cards: [] }, start: { ...lives[0].start, cash: 1_000_000 } }, 'parse');
  change(state);
  const { text, names } = textFor(locale);
  return { content, state, names, text };
}
const run = (line: string, s: Scene = scene()) => parse(line, s);
const orderOf = (line: string, s: Scene = scene()) => {
  const command = run(line, s);
  return command.kind === 'order' ? command.order : command;
};

describe('parseAmount', () => {
  it('reads dollars in the ways people type them', () => {
    expect(parseAmount('5000', 0)).toBe(500_000);
    expect(parseAmount('5,000', 0)).toBe(500_000);
    expect(parseAmount('$5,000', 0)).toBe(500_000);
    expect(parseAmount('5k', 0)).toBe(500_000);
    expect(parseAmount('1.5m', 0)).toBe(150_000_000);
    expect(parseAmount('12.34', 0)).toBe(1_234);
  });

  it('reads "all" and a percentage of what there is', () => {
    expect(parseAmount('all', 70_000)).toBe(70_000);
    expect(parseAmount('todo', 70_000)).toBe(70_000);
    expect(parseAmount('50%', 70_000)).toBe(35_000);
    expect(parseAmount('100%', 70_000)).toBe(70_000);
  });

  it('refuses what is not a positive amount', () => {
    for (const typed of [undefined, '', '0', '-5', 'lots', '5x', '1e9', '150%', 'NaN', '5 000']) expect(parseAmount(typed, 70_000)).toBeNull();
    expect(parseAmount('all', 0)).toBeNull();
    expect(parseAmount('50%', 1)).toBeNull();
  });
});

describe('find', () => {
  const funds = [{ id: 'gold_miners' }, { id: 'gold' }, { id: 'goldman' }];
  const by = (typed: string) => find(funds, typed, (f) => [f.id])?.id;

  it('prefers an exact match to the start of an earlier name', () => {
    expect(by('gold')).toBe('gold');
    expect(by('GOLD')).toBe('gold');
    expect(by('goldm')).toBe('gold_miners');
    expect(by('goldma')).toBe('goldman');
    expect(by('silver')).toBeUndefined();
    expect(by('')).toBeUndefined();
    expect(by('!!!')).toBeUndefined();
  });
});

describe('parse', () => {
  it('reads trades by ticker, by id and by the start of a name, in any case', () => {
    expect(orderOf('buy msci 5000')).toEqual({ type: 'buy', assetId: 'msci_world', amount: 500_000 });
    expect(orderOf('BUY NVDA 1k')).toEqual({ type: 'buy', assetId: 'nvidia', amount: 100_000 });
    expect(orderOf('buy coca 250')).toEqual({ type: 'buy', assetId: 'coca_cola', amount: 25_000 });
    expect(orderOf('buy gold all')).toEqual({ type: 'buy', assetId: 'gold', amount: 1_000_000 });
    expect(orderOf('buy sp500 50%')).toEqual({ type: 'buy', assetId: 'sp500', amount: 500_000 });
  });

  it('sells all of a position', () => {
    const s = scene((state) => (state.player.positions.bitcoin = { value: 123_456, basis: 1 }));
    expect(orderOf('sell btc all', s)).toEqual({ type: 'sell', assetId: 'bitcoin', amount: 123_456 });
    expect(orderOf('sell btc 100', s)).toEqual({ type: 'sell', assetId: 'bitcoin', amount: 10_000 });
    expect(run('sell gold all', s)).toEqual({ kind: 'error', problem: 'bad-amount' });
  });

  it('reads savings, pension and loans', () => {
    const s = scene((state) => {
      state.player.deposit = 40_000;
      state.player.debts.push({ id: 'debt-7', kind: 'personalLoan', principal: 300_000, fixedRateBp: 700, roundsLeft: 2 });
    });
    expect(orderOf('save 2000', s)).toEqual({ type: 'depositIn', amount: 200_000 });
    expect(orderOf('withdraw all', s)).toEqual({ type: 'depositOut', amount: 40_000 });
    expect(orderOf('pension 500', s)).toEqual({ type: 'pensionIn', amount: 50_000 });
    expect(orderOf('borrow 10k', s)).toEqual({ type: 'borrow', amount: 1_000_000 });
    expect(orderOf('repay 1 all', s)).toEqual({ type: 'repay', debtId: 'debt-7', amount: 300_000 });
    expect(orderOf('repay 1 1000', s)).toEqual({ type: 'repay', debtId: 'debt-7', amount: 100_000 });
    expect(run('repay 2 100', s)).toEqual({ kind: 'error', problem: 'unknown-number' });
  });

  it('buys a home with the smallest down payment by default, or as told', () => {
    // A studio in Madrid costs 60% of 280,000 = 168,000, and the bank lends 80%.
    expect(orderOf('home studio')).toEqual({ type: 'buyProperty', typeId: 'studio', downPayment: 3_360_000, mortgage: 'fixed', rented: false });
    expect(orderOf('home studio 50% variable rent')).toEqual({ type: 'buyProperty', typeId: 'studio', downPayment: 8_400_000, mortgage: 'variable', rented: true });
    expect(orderOf('home flat cash')).toEqual({ type: 'buyProperty', typeId: 'flat', downPayment: 0, mortgage: 'none', rented: false });
    expect(run('home castle')).toEqual({ kind: 'error', problem: 'unknown-home' });
  });

  it('sells and rents out homes by their number', () => {
    const s = scene((state) => state.player.properties.push({ id: 'property-3', cityId: 'madrid', typeId: 'flat', value: 1, basis: 1, rented: false, mortgageId: null }));
    expect(orderOf('sellhome 1', s)).toEqual({ type: 'sellProperty', propertyId: 'property-3' });
    expect(orderOf('rent 1 on', s)).toEqual({ type: 'setRented', propertyId: 'property-3', rented: true });
    expect(orderOf('rent 1 off', s)).toEqual({ type: 'setRented', propertyId: 'property-3', rented: false });
    expect(run('rent 1 maybe', s)).toEqual({ kind: 'error', problem: 'needs-on-off' });
    expect(run('sellhome 4', s)).toEqual({ kind: 'error', problem: 'unknown-number' });
  });

  it('shops by number, by id and by name', () => {
    const rolex = content.items.findIndex((item) => item.id === 'watch_rolex') + 1;
    expect(orderOf(`get ${rolex}`)).toEqual({ type: 'buyItem', itemId: 'watch_rolex' });
    expect(orderOf('get watch_rolex')).toEqual({ type: 'buyItem', itemId: 'watch_rolex' });
    expect(orderOf('get rolex submariner')).toEqual({ type: 'buyItem', itemId: 'watch_rolex' });
    expect(orderOf('drop porsche')).toEqual({ type: 'sellItem', itemId: 'car_porsche_911' });
    expect(run('get jetpack')).toEqual({ kind: 'error', problem: 'unknown-item' });
  });

  it('reads the ways of living', () => {
    expect(orderOf('lifestyle 0')).toEqual({ type: 'setLifestyle', tier: 0 });
    expect(orderOf('lifestyle lavish')).toEqual({ type: 'setLifestyle', tier: 3 });
    expect(run('lifestyle 7')).toEqual({ kind: 'error', problem: 'bad-tier' });
    expect(orderOf('room')).toEqual({ type: 'setRentTier', tier: 0 });
    expect(orderOf('flat')).toEqual({ type: 'setRentTier', tier: 1 });
    expect(orderOf('insure health')).toEqual({ type: 'setInsurance', insurance: 'health', on: true });
    expect(orderOf('insure home off')).toEqual({ type: 'setInsurance', insurance: 'home', on: false });
    expect(run('insure pet')).toEqual({ kind: 'error', problem: 'unknown-insurance' });
    expect(orderOf('move new york')).toEqual({ type: 'moveCity', cityId: 'new_york' });
    expect(orderOf('move dub')).toEqual({ type: 'moveCity', cityId: 'dubai' });
    expect(run('move atlantis')).toEqual({ kind: 'error', problem: 'unknown-city' });
    expect(orderOf('overtime')).toEqual({ type: 'focus', action: 'overtime' });
    expect(orderOf('study')).toEqual({ type: 'focus', action: 'studyCareer' });
    expect(orderOf('hunt')).toEqual({ type: 'focus', action: 'jobHunt' });
  });

  it('understands Spanish words, names and accents', () => {
    const s = scene(() => {}, 'es');
    expect(orderOf('comprar oro 500', s)).toEqual({ type: 'buy', assetId: 'gold', amount: 50_000 });
    expect(orderOf('ahorrar todo', s)).toEqual({ type: 'depositIn', amount: 1_000_000 });
    expect(orderOf('casa estudio', s)).toMatchObject({ type: 'buyProperty', typeId: 'studio' });
    expect(orderOf('casa ático contado', s)).toMatchObject({ type: 'buyProperty', typeId: 'penthouse', mortgage: 'none' });
    expect(orderOf('vida austero', s)).toEqual({ type: 'setLifestyle', tier: 0 });
    expect(orderOf('habitación', s)).toEqual({ type: 'setRentTier', tier: 0 });
    expect(orderOf('seguro salud', s)).toEqual({ type: 'setInsurance', insurance: 'health', on: true });
    expect(orderOf('mudar Dubái', s)).toEqual({ type: 'moveCity', cityId: 'dubai' });
    expect(orderOf('mudar nueva york', s)).toEqual({ type: 'moveCity', cityId: 'new_york' });
    expect(orderOf('estudiar', s)).toEqual({ type: 'focus', action: 'studyCareer' });
    expect(run('listo', s)).toEqual({ kind: 'done' });
    expect(run('cartera', s)).toEqual({ kind: 'view', view: 'portfolio' });
  });

  it('reads the screens and the controls', () => {
    for (const [typed, view] of [['help', 'help'], ['?', 'help'], ['me', 'me'], ['news', 'news'], ['market', 'market'], ['port', 'portfolio'], ['shop', 'shop'], ['tax', 'tax'], ['cities', 'cities'], ['homes', 'homes'], ['orders', 'orders']]) {
      expect(run(typed)).toEqual({ kind: 'view', view });
    }
    expect(run('undo')).toEqual({ kind: 'undo' });
    expect(run('done')).toEqual({ kind: 'done' });
    expect(run('  DONE  ')).toEqual({ kind: 'done' });
    expect(run('quit')).toEqual({ kind: 'quit' });
    expect(run('')).toEqual({ kind: 'empty' });
    expect(run('   ')).toEqual({ kind: 'empty' });
  });

  it('says what is wrong instead of guessing', () => {
    expect(run('dance')).toEqual({ kind: 'error', problem: 'unknown-command' });
    expect(run('buy')).toEqual({ kind: 'error', problem: 'missing-words' });
    expect(run('buy tulips 100')).toEqual({ kind: 'error', problem: 'unknown-asset' });
    expect(run('buy msci')).toEqual({ kind: 'error', problem: 'bad-amount' });
    expect(run('buy msci lots')).toEqual({ kind: 'error', problem: 'bad-amount' });
    expect(run('save -5')).toEqual({ kind: 'error', problem: 'bad-amount' });
    expect(run('__proto__ 5')).toEqual({ kind: 'error', problem: 'unknown-command' });
    expect(run('constructor')).toEqual({ kind: 'error', problem: 'unknown-command' });
  });
});
