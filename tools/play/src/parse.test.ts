import { content, lives, textFor } from '@ratrace/content';
import type { Locale } from '@ratrace/content';
import { createGame } from '@ratrace/engine';
import type { GameState } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { plain } from './format';
import { commandWords, find, parse, parseAmount } from './parse';
import type { Scene } from './parse';

function scene(change: (state: GameState) => void = () => {}, locale: Locale = 'en'): Scene {
  const state = createGame({ content: { ...content, cards: [] }, start: { ...lives[0].start, cash: 1_000_000 } }, 'parse');
  change(state);
  const { text, names } = textFor(locale);
  return { content, state, names, text, locale };
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
    expect(parseAmount('всё', 70_000)).toBe(70_000);
    expect(parseAmount('все', 70_000)).toBe(70_000);
    expect(parseAmount('ВСЁ', 70_000)).toBe(70_000);
    expect(parseAmount('50%', 70_000)).toBe(35_000);
    expect(parseAmount('100%', 70_000)).toBe(70_000);
  });

  it('refuses what is not a positive amount', () => {
    for (const typed of [undefined, '', '0', '-5', 'lots', '5x', '1e9', '150%', 'NaN', '5 000']) expect(parseAmount(typed, 70_000)).toBeNull();
    expect(parseAmount('all', 0)).toBeNull();
    expect(parseAmount('50%', 1)).toBeNull();
  });
});

describe('parseAmount, in the language of the player', () => {
  it('reads a dot as thousands and a comma as decimals in Spanish, and the other way round in English', () => {
    expect(parseAmount('12.345', 0, 'es')).toBe(1_234_500);
    expect(parseAmount('1.234.567', 0, 'es')).toBe(123_456_700);
    expect(parseAmount('12,5', 0, 'es')).toBe(1_250);
    expect(parseAmount('1,5k', 0, 'es')).toBe(150_000);
    expect(parseAmount('12,345', 0, 'en')).toBe(1_234_500);
    expect(parseAmount('12.5', 0, 'en')).toBe(1_250);
    expect(parseAmount('12,345', 0)).toBe(1_234_500);
  });

  it('reads what fits only one way that way, whatever the language', () => {
    expect(parseAmount('1.5k', 0, 'es')).toBe(150_000);
    expect(parseAmount('1,5k', 0, 'en')).toBe(150_000);
    expect(parseAmount('2.50', 0, 'es')).toBe(250);
    expect(parseAmount('1.234,56', 0, 'en')).toBe(123_456);
    expect(parseAmount('1,234.56', 0, 'es')).toBe(123_456);
  });

  it('reads a percentage with a decimal comma', () => {
    expect(parseAmount('12,5%', 80_000, 'es')).toBe(10_000);
    expect(parseAmount('12.5%', 80_000, 'en')).toBe(10_000);
  });

  it('still refuses what is no amount', () => {
    for (const typed of ['1.2.3', '1,2,3', '.5', '5.', ',5', '1..5', '1,,5', '1.234.56,7.8']) {
      expect(parseAmount(typed, 70_000, 'es'), typed).toBeNull();
      expect(parseAmount(typed, 70_000, 'en'), typed).toBeNull();
      expect(parseAmount(typed, 70_000, 'ru'), typed).toBeNull();
    }
  });

  it('reads a space between thousands and a comma as decimals in Russian, with the space or without', () => {
    expect(parseAmount('1 500', 0, 'ru')).toBe(150_000);
    expect(parseAmount('1500', 0, 'ru')).toBe(150_000);
    expect(parseAmount('12 345,6', 0, 'ru')).toBe(1_234_560);
    expect(parseAmount('12345,6', 0, 'ru')).toBe(1_234_560);
    expect(parseAmount('1 234 567', 0, 'ru')).toBe(123_456_700);
    expect(parseAmount('12,5', 0, 'ru')).toBe(1_250);
    expect(parseAmount('$1 500', 0, 'ru')).toBe(150_000);
    expect(parseAmount('12,5%', 80_000, 'ru')).toBe(10_000);
    expect(parseAmount('50%', 70_000, 'ru')).toBe(35_000);
  });

  it('reads k and m in Russian with either decimal mark, and in either alphabet', () => {
    expect(parseAmount('1,5k', 0, 'ru')).toBe(150_000);
    expect(parseAmount('1.5k', 0, 'ru')).toBe(150_000);
    expect(parseAmount('5k', 0, 'ru')).toBe(500_000);
    expect(parseAmount('1,5m', 0, 'ru')).toBe(150_000_000);
    // The Cyrillic к looks the same as the Latin k, and is the one under a Russian player's fingers.
    expect(parseAmount('5к', 0, 'ru')).toBe(500_000);
    expect(parseAmount('1,5К', 0, 'ru')).toBe(150_000);
    expect(parseAmount('1,5м', 0, 'ru')).toBe(150_000_000);
  });

  it('reads in Russian what only another language writes, as that language would', () => {
    // A dot is a decimal mark to a Russian reader before it is anything else.
    expect(parseAmount('12.5', 0, 'ru')).toBe(1_250);
    expect(parseAmount('12.5%', 80_000, 'ru')).toBe(10_000);
    expect(parseAmount('1,234,567', 0, 'ru')).toBe(123_456_700);
    expect(parseAmount('1.234.567', 0, 'ru')).toBe(123_456_700);
    expect(parseAmount('1,234.56', 0, 'ru')).toBe(123_456);
    expect(parseAmount('1.234,56', 0, 'ru')).toBe(123_456);
  });

  it('takes a space for thousands only in Russian', () => {
    for (const typed of ['5 000', '1 500', '12 345,6', '1 500k', '$5 000', '10 000%']) {
      expect(parseAmount(typed, 70_000, 'en'), typed).toBeNull();
      expect(parseAmount(typed, 70_000, 'es'), typed).toBeNull();
      expect(parseAmount(typed, 70_000), typed).toBeNull();
    }
  });

  it('refuses in Russian the spaces that group nothing', () => {
    for (const typed of ['1 50', '15 00', '1  500', ' 1500', '1500 ', '1 2 3', '1 5000', '1234 567', '1 500 пожалуйста', '1 500,', '1,5 00', '0', '0 000']) {
      expect(parseAmount(typed, 70_000, 'ru'), typed).toBeNull();
    }
  });
});

describe('plain', () => {
  it('reads Latin letters as it always did: lower case, no accents, nothing but letters and digits', () => {
    expect(plain('Dubái')).toBe('dubai');
    expect(plain('DUBAI')).toBe('dubai');
    expect(plain('Nueva York')).toBe('nuevayork');
    expect(plain('habitación')).toBe('habitacion');
    expect(plain('S&P 500')).toBe('sp500');
    expect(plain('Hermès Birkin')).toBe('hermesbirkin');
    expect(plain('ñandú, ¿sí?')).toBe('nandusi');
    expect(plain('ăğ')).toBe('ag');
    expect(plain('???')).toBe('');
  });

  it('keeps Cyrillic letters, reads ё as е, and leaves й a letter of its own', () => {
    expect(plain('Жильё')).toBe('жилье');
    expect(plain('жилье')).toBe('жилье');
    expect(plain('ВСЁ')).toBe('все');
    expect(plain('Нью-Йорк')).toBe('ньюйорк');
    expect(plain('Дубай')).toBe('дубай');
    expect(plain('Дубай')).not.toBe(plain('Дубаи'));
    // Typed with the dots and the breve as marks of their own, as some keyboards send them.
    expect(plain('жилье\u0308')).toBe('жилье');
    expect(plain('Дубаи\u0306')).toBe('дубай');
    expect(plain('Машино-место')).toBe('машиноместо');
    expect(plain('Пиджак Zara')).toBe('пиджакzara');
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
    expect(orderOf('finance porsche')).toEqual({ type: 'buyItem', itemId: 'car_porsche_911', financed: true });
    expect(orderOf('financiar porsche')).toEqual({ type: 'buyItem', itemId: 'car_porsche_911', financed: true });
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

  it('understands Russian words and names, with ё or with е', () => {
    const s = scene((state) => (state.player.positions.bitcoin = { value: 123_456, basis: 1 }), 'ru');
    expect(orderOf('купить золото 500', s)).toEqual({ type: 'buy', assetId: 'gold', amount: 50_000 });
    expect(orderOf('КУПИТЬ msci 5к', s)).toEqual({ type: 'buy', assetId: 'msci_world', amount: 500_000 });
    expect(orderOf('продать btc всё', s)).toEqual({ type: 'sell', assetId: 'bitcoin', amount: 123_456 });
    expect(orderOf('продать btc все', s)).toEqual({ type: 'sell', assetId: 'bitcoin', amount: 123_456 });
    expect(orderOf('отложить всё', s)).toEqual({ type: 'depositIn', amount: 1_000_000 });
    expect(orderOf('пенсия 500', s)).toEqual({ type: 'pensionIn', amount: 50_000 });
    expect(orderOf('занять 10k', s)).toEqual({ type: 'borrow', amount: 1_000_000 });
    expect(orderOf('жильё студия', s)).toEqual({ type: 'buyProperty', typeId: 'studio', downPayment: 3_360_000, mortgage: 'fixed', rented: false });
    expect(orderOf('жилье студия', s)).toMatchObject({ type: 'buyProperty', typeId: 'studio' });
    expect(orderOf('жильё студия 50% плавающая сдать', s)).toEqual({ type: 'buyProperty', typeId: 'studio', downPayment: 8_400_000, mortgage: 'variable', rented: true });
    expect(orderOf('жильё студия фиксированная', s)).toMatchObject({ type: 'buyProperty', typeId: 'studio', mortgage: 'fixed' });
    expect(orderOf('жильё пентхаус наличными', s)).toMatchObject({ type: 'buyProperty', typeId: 'penthouse', mortgage: 'none' });
    expect(orderOf('жильё машино-место', s)).toMatchObject({ type: 'buyProperty', typeId: 'parking' });
    expect(run('жильё замок', s)).toEqual({ kind: 'error', problem: 'unknown-home' });
    expect(orderOf('взять rolex submariner', s)).toEqual({ type: 'buyItem', itemId: 'watch_rolex' });
    expect(orderOf('взять пиджак', s)).toEqual({ type: 'buyItem', itemId: 'fashion_blazer' });
    expect(orderOf('рассрочка porsche', s)).toEqual({ type: 'buyItem', itemId: 'car_porsche_911', financed: true });
    expect(orderOf('сбыть полёт на вертолёте', s)).toEqual({ type: 'sellItem', itemId: 'air_helicopter' });
    expect(orderOf('сбыть полет на вертолете', s)).toEqual({ type: 'sellItem', itemId: 'air_helicopter' });
    expect(orderOf('жизнь 0', s)).toEqual({ type: 'setLifestyle', tier: 0 });
    expect(orderOf('жизнь люкс', s)).toEqual({ type: 'setLifestyle', tier: 3 });
    expect(orderOf('жизнь Эконом', s)).toEqual({ type: 'setLifestyle', tier: 0 });
    expect(run('жизнь ???', s)).toEqual({ kind: 'error', problem: 'bad-tier' });
    expect(orderOf('комната', s)).toEqual({ type: 'setRentTier', tier: 0 });
    expect(orderOf('квартира', s)).toEqual({ type: 'setRentTier', tier: 1 });
    expect(orderOf('страховка здоровье', s)).toEqual({ type: 'setInsurance', insurance: 'health', on: true });
    expect(orderOf('страховка жильё нет', s)).toEqual({ type: 'setInsurance', insurance: 'home', on: false });
    expect(orderOf('страховка жилье да', s)).toEqual({ type: 'setInsurance', insurance: 'home', on: true });
    expect(orderOf('страховка жизнь', s)).toEqual({ type: 'setInsurance', insurance: 'life', on: true });
    expect(run('страховка кот', s)).toEqual({ kind: 'error', problem: 'unknown-insurance' });
    expect(orderOf('переехать Дубай', s)).toEqual({ type: 'moveCity', cityId: 'dubai' });
    expect(orderOf('переехать нью-йорк', s)).toEqual({ type: 'moveCity', cityId: 'new_york' });
    expect(orderOf('переехать нью йорк', s)).toEqual({ type: 'moveCity', cityId: 'new_york' });
    expect(orderOf('переехать лон', s)).toEqual({ type: 'moveCity', cityId: 'london' });
    expect(run('переехать атлантида', s)).toEqual({ kind: 'error', problem: 'unknown-city' });
    expect(orderOf('сверхурочные', s)).toEqual({ type: 'focus', action: 'overtime' });
    expect(orderOf('учиться', s)).toEqual({ type: 'focus', action: 'studyCareer' });
    expect(orderOf('искать', s)).toEqual({ type: 'focus', action: 'jobHunt' });
    expect(run('танцевать', s)).toEqual({ kind: 'error', problem: 'unknown-command' });
    expect(run('купить', s)).toEqual({ kind: 'error', problem: 'missing-words' });
  });

  it('reads the Russian screens and controls', () => {
    const s = scene(() => {}, 'ru');
    for (const [typed, view] of [['помощь', 'help'], ['я', 'me'], ['новости', 'news'], ['рынок', 'market'], ['портфель', 'portfolio'], ['магазин', 'shop'], ['налоги', 'tax'], ['города', 'cities'], ['недвижимость', 'homes'], ['планы', 'orders']]) {
      expect(run(typed, s), typed).toEqual({ kind: 'view', view });
    }
    expect(run('отменить', s)).toEqual({ kind: 'undo' });
    expect(run('готово', s)).toEqual({ kind: 'done' });
    expect(run('  ГОТОВО  ', s)).toEqual({ kind: 'done' });
    // Typed in Cyrillic it looks the same as the Latin "ok".
    expect(run('ок', s)).toEqual({ kind: 'done' });
    expect(run('выйти', s)).toEqual({ kind: 'quit' });
    // The words of one language are understood in the others, as the Spanish ones are in English.
    expect(run('готово')).toEqual({ kind: 'done' });
    expect(run('done', s)).toEqual({ kind: 'done' });
    expect(run('listo', s)).toEqual({ kind: 'done' });
  });

  it('gives every command a word in each language, written the way a typed word is read', () => {
    for (const [command, words] of Object.entries(commandWords)) {
      // Spanish and English share "pension"; every other command has a word of its own in each of the three.
      expect(words.length, command).toBeGreaterThanOrEqual(command === 'pension' ? 2 : 3);
      expect(words.filter((word) => /^[а-я]+$/.test(word)).length, command).toBeGreaterThanOrEqual(1);
      for (const word of words) expect(plain(word) || word, word).toBe(word);
    }
    const all = Object.values(commandWords).flat();
    expect(new Set(all).size).toBe(all.length);
  });

  it('reads a Russian amount typed with spaces between its thousands', () => {
    const s = scene((state) => {
      state.player.deposit = 400_000;
      state.player.debts.push({ id: 'debt-7', kind: 'personalLoan', principal: 300_000, fixedRateBp: 700, roundsLeft: 2 });
    }, 'ru');
    expect(orderOf('купить msci 1 500', s)).toEqual({ type: 'buy', assetId: 'msci_world', amount: 150_000 });
    expect(orderOf('купить msci 1500', s)).toEqual({ type: 'buy', assetId: 'msci_world', amount: 150_000 });
    expect(orderOf('купить msci 1,5k', s)).toEqual({ type: 'buy', assetId: 'msci_world', amount: 150_000 });
    expect(orderOf('купить msci 1.5k', s)).toEqual({ type: 'buy', assetId: 'msci_world', amount: 150_000 });
    expect(orderOf('отложить 2 000', s)).toEqual({ type: 'depositIn', amount: 200_000 });
    expect(orderOf('снять 1 000', s)).toEqual({ type: 'depositOut', amount: 100_000 });
    expect(orderOf('снять всё', s)).toEqual({ type: 'depositOut', amount: 400_000 });
    expect(orderOf('пенсия 1 000', s)).toEqual({ type: 'pensionIn', amount: 100_000 });
    expect(orderOf('занять 10 000', s)).toEqual({ type: 'borrow', amount: 1_000_000 });
    // The first number is the debt, the rest is the amount.
    expect(orderOf('погасить 1 500', s)).toEqual({ type: 'repay', debtId: 'debt-7', amount: 50_000 });
    expect(orderOf('погасить 1 1 500', s)).toEqual({ type: 'repay', debtId: 'debt-7', amount: 150_000 });
    expect(orderOf('погасить 1 всё', s)).toEqual({ type: 'repay', debtId: 'debt-7', amount: 300_000 });
    // Copied from the screen, where the spaces between thousands do not break.
    expect(orderOf('отложить 2\u00A0000', s)).toEqual({ type: 'depositIn', amount: 200_000 });
    // What does not add up to one amount is refused, not cut short at its first word.
    expect(run('купить msci 1 50', s)).toEqual({ kind: 'error', problem: 'bad-amount' });
    expect(run('отложить 1 500 сейчас', s)).toEqual({ kind: 'error', problem: 'bad-amount' });
    expect(run('отложить', s)).toEqual({ kind: 'error', problem: 'missing-words' });
    expect(run('купить msci', s)).toEqual({ kind: 'error', problem: 'bad-amount' });
  });

  it('still reads the amount as one word in English and Spanish', () => {
    expect(orderOf('buy msci 5000 now')).toEqual({ type: 'buy', assetId: 'msci_world', amount: 500_000 });
    expect(orderOf('ahorrar 1200 $', scene(() => {}, 'es'))).toEqual({ type: 'depositIn', amount: 120_000 });
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

  it('reads a typed amount in the language of the game', () => {
    expect(orderOf('comprar msci 12.345', scene(() => {}, 'es'))).toEqual({ type: 'buy', assetId: 'msci_world', amount: 1_234_500 });
    expect(orderOf('buy msci 12,345')).toEqual({ type: 'buy', assetId: 'msci_world', amount: 1_234_500 });
  });

  it('reads yes and no with or without an accent', () => {
    const owner = scene((state) => {
      state.player.properties.push({ id: 'p1', cityId: state.player.cityId, typeId: 'studio', value: 1, basis: 1, rented: false, mortgageId: null });
    }, 'es');
    expect(orderOf('alquilar 1 sí', owner)).toEqual({ type: 'setRented', propertyId: 'p1', rented: true });
    expect(orderOf('alquilar 1 SÍ', owner)).toEqual({ type: 'setRented', propertyId: 'p1', rented: true });
    expect(orderOf('alquilar 1 si', owner)).toEqual({ type: 'setRented', propertyId: 'p1', rented: true });
    expect(orderOf('alquilar 1 no', owner)).toEqual({ type: 'setRented', propertyId: 'p1', rented: false });
    expect(orderOf('seguro salud sí', owner)).toEqual({ type: 'setInsurance', insurance: 'health', on: true });
  });

  it('reads да and нет', () => {
    const owner = scene((state) => {
      state.player.properties.push({ id: 'p1', cityId: state.player.cityId, typeId: 'studio', value: 1, basis: 1, rented: false, mortgageId: null });
    }, 'ru');
    expect(orderOf('сдать 1 да', owner)).toEqual({ type: 'setRented', propertyId: 'p1', rented: true });
    expect(orderOf('сдать 1 ДА', owner)).toEqual({ type: 'setRented', propertyId: 'p1', rented: true });
    expect(orderOf('сдать 1 нет', owner)).toEqual({ type: 'setRented', propertyId: 'p1', rented: false });
    expect(run('сдать 1 наверное', owner)).toEqual({ kind: 'error', problem: 'needs-on-off' });
    expect(run('сдать 4 да', owner)).toEqual({ kind: 'error', problem: 'unknown-number' });
    expect(orderOf('продатьжильё 1', owner)).toEqual({ type: 'sellProperty', propertyId: 'p1' });
    expect(orderOf('продатьжилье 1', owner)).toEqual({ type: 'sellProperty', propertyId: 'p1' });
    expect(orderOf('страховка здоровье нет', owner)).toEqual({ type: 'setInsurance', insurance: 'health', on: false });
    // And the yes and no of the other languages still switch things in Russian.
    expect(orderOf('сдать 1 on', owner)).toEqual({ type: 'setRented', propertyId: 'p1', rented: true });
  });

  it('does not take punctuation for the first lifestyle', () => {
    for (const line of ['lifestyle ???', 'vida ???', 'жизнь ???', 'lifestyle !', 'lifestyle 4', 'lifestyle -1']) {
      expect(run(line), line).toEqual({ kind: 'error', problem: 'bad-tier' });
    }
    expect(orderOf('lifestyle 0')).toEqual({ type: 'setLifestyle', tier: 0 });
  });
});
