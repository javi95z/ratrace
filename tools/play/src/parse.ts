import { quoteProperty } from '@ratrace/engine';
import type { Content, FocusAction, GameState, InsuranceKind, Order } from '@ratrace/engine';
import type { ContentText, Locale, Names } from '@ratrace/content';
import { plain } from './format';

export type View = 'help' | 'me' | 'news' | 'market' | 'portfolio' | 'shop' | 'tax' | 'cities' | 'homes' | 'orders';

export type Problem =
  | 'unknown-command'
  | 'missing-words'
  | 'bad-amount'
  | 'unknown-asset'
  | 'unknown-item'
  | 'unknown-city'
  | 'unknown-home'
  | 'unknown-number'
  | 'unknown-insurance'
  | 'needs-on-off'
  | 'bad-tier';

export type Command =
  | { kind: 'order'; order: Order }
  | { kind: 'view'; view: View }
  | { kind: 'undo' }
  | { kind: 'done' }
  | { kind: 'quit' }
  | { kind: 'empty' }
  | { kind: 'error'; problem: Problem };

/** What the parser needs to turn words into ids and amounts. */
export interface Scene {
  content: Content;
  /** The state in the finance phase, as it will stand once the orders typed so far have run. */
  state: GameState;
  names: Names;
  text: ContentText;
  /** The language the player types amounts in. */
  locale: Locale;
}

/**
 * Every word a command answers to, in every language. The first is the one the English help shows.
 * Each is written as `plain` leaves a typed word, so without accents, and with е where Russian writes ё.
 */
const WORDS = {
  buy: ['buy', 'comprar', 'купить'],
  sell: ['sell', 'vender', 'продать'],
  save: ['save', 'ahorrar', 'отложить'],
  withdraw: ['withdraw', 'retirar', 'снять'],
  pension: ['pension', 'пенсия'],
  borrow: ['borrow', 'pedir', 'занять'],
  repay: ['repay', 'pagar', 'погасить'],
  home: ['home', 'casa', 'жилье'],
  sellhome: ['sellhome', 'vendercasa', 'продатьжилье'],
  rent: ['rent', 'alquilar', 'сдать'],
  get: ['get', 'adquirir', 'взять'],
  finance: ['finance', 'financiar', 'рассрочка'],
  drop: ['drop', 'soltar', 'сбыть'],
  lifestyle: ['lifestyle', 'vida', 'жизнь'],
  room: ['room', 'habitacion', 'комната'],
  flat: ['flat', 'piso', 'квартира'],
  insure: ['insure', 'seguro', 'страховка'],
  move: ['move', 'mudar', 'переехать'],
  overtime: ['overtime', 'extras', 'сверхурочные'],
  study: ['study', 'estudiar', 'учиться'],
  hunt: ['hunt', 'buscar', 'искать'],
  help: ['help', 'ayuda', 'помощь', '?'],
  me: ['me', 'yo', 'я'],
  news: ['news', 'noticias', 'новости'],
  market: ['market', 'mercado', 'рынок'],
  portfolio: ['port', 'portfolio', 'cartera', 'портфель'],
  shop: ['shop', 'tienda', 'магазин'],
  tax: ['tax', 'impuestos', 'налоги'],
  cities: ['cities', 'ciudades', 'города'],
  homes: ['homes', 'casas', 'недвижимость'],
  orders: ['orders', 'ordenes', 'планы'],
  undo: ['undo', 'deshacer', 'отменить'],
  // The Cyrillic «ок» looks the same as the Latin "ok".
  done: ['done', 'listo', 'готово', 'ok', 'ок'],
  quit: ['quit', 'salir', 'выйти'],
} as const;

type Word = keyof typeof WORDS;
const VIEWS: readonly Word[] = ['help', 'me', 'news', 'market', 'portfolio', 'shop', 'tax', 'cities', 'homes', 'orders'];
const FOCUS: Partial<Record<Word, FocusAction>> = { overtime: 'overtime', study: 'studyCareer', hunt: 'jobHunt' };

// An amount is read as it is typed, so «всё» is here with its dots and without. The rest go through `plain`, like the commands.
const ALL = ['all', 'todo', 'всё', 'все'];
const ON = ['on', 'si', 'yes', 'да'];
const OFF = ['off', 'no', 'нет'];
const INSURANCE: Record<InsuranceKind, string[]> = {
  health: ['health', 'salud', 'здоровье'],
  home: ['home', 'hogar', 'жилье'],
  life: ['life', 'vida', 'жизнь'],
  liability: ['liability', 'civil', 'ответственность'],
};
/** How a home is paid for, after its kind: with no mortgage, or with a variable one. Anything else is a fixed one. */
const NO_MORTGAGE = ['cash', 'contado', 'наличными'];
const VARIABLE = ['variable', 'плавающая'];

const wordOf = (typed: string): Word | undefined => {
  const key = plain(typed) || typed;
  return (Object.keys(WORDS) as Word[]).find((word) => (WORDS[word] as readonly string[]).includes(key));
};

/** How each language writes a number. Russian sets its thousands apart with a space: 12 345,6. */
const SEPARATORS: Record<Locale, { thousands: string; decimal: string }> = {
  en: { thousands: ',', decimal: '.' },
  es: { thousands: '.', decimal: ',' },
  ru: { thousands: ' ', decimal: ',' },
};
/** The thousands marks may be left out: 12345 is a number in every language. */
const NUMBER_SHAPE = (thousands: string, decimal: string) => new RegExp(`^(?:\\d{1,3}(?:\\${thousands}\\d{3})+|\\d+)(?:\\${decimal}\\d+)?$`);

/** Whether a language's amounts can be several words long, because a space stands between their thousands. */
const spaced = (locale: Locale) => SEPARATORS[locale].thousands === ' ';

/**
 * The languages a number is read in, in turn: the player's own, then the others. A language that
 * puts a space between thousands is tried only for its own players: to everyone else "5 000" is
 * two words, and the rest of what such a language writes the others already read.
 */
const readers = (locale: Locale): Locale[] => [locale, ...(Object.keys(SEPARATORS) as Locale[]).filter((other) => other !== locale && !spaced(other))];

/**
 * A number as the player's language writes it: 12.345 is twelve thousand in Spanish and twelve
 * and a bit in English. What cannot be read that way is read as the other languages would, so
 * 1.5k and 1,5k mean the same to everyone. Null if it is no number in any of them.
 */
function readNumber(typed: string, locale: Locale): number | null {
  for (const reader of readers(locale)) {
    const { thousands, decimal } = SEPARATORS[reader];
    if (NUMBER_SHAPE(thousands, decimal).test(typed)) return Number(typed.split(thousands).join('').replace(decimal, '.'));
  }
  return null;
}

/**
 * An amount in cents. Accepts 5000, 5,000, 5k, 1.5m, a percentage of `whole`, or "all", with the
 * thousands and decimal marks of the player's language. Returns null for anything that is not a positive amount.
 * The k and the m may be Cyrillic: к looks the same, and is the one a Russian keyboard has.
 */
export function parseAmount(typed: string | undefined, whole: number, locale: Locale = 'en'): number | null {
  if (typed === undefined) return null;
  const word = typed.toLowerCase();
  if (ALL.includes(word)) return whole > 0 ? whole : null;
  if (word.endsWith('%')) {
    const share = readNumber(word.slice(0, -1), locale);
    if (share === null || share > 100) return null;
    const amount = Math.floor((whole * share) / 100);
    return amount > 0 ? amount : null;
  }
  // A space is let through for the language that groups with one; no other language reads a number with a space in it.
  const match = /^\$?([\d., ]+)([kmкм]?)$/.exec(word);
  const value = match ? readNumber(match[1], locale) : null;
  if (!match || value === null) return null;
  const scale = match[2] === 'k' || match[2] === 'к' ? 1_000 : match[2] === 'm' || match[2] === 'м' ? 1_000_000 : 1;
  const cents = Math.round(value * scale * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

/** The entry whose id, short name or name the words point at: an exact match first, then the start of a name. */
export function find<T>(entries: readonly T[], typed: string, labels: (entry: T) => string[]): T | undefined {
  const wanted = plain(typed);
  if (wanted === '') return undefined;
  return (
    entries.find((entry) => labels(entry).some((label) => plain(label) === wanted)) ??
    entries.find((entry) => labels(entry).some((label) => plain(label).startsWith(wanted)))
  );
}

/** The nth thing in a list, counting from one as the screens do. */
const nth = <T>(list: readonly T[], typed: string | undefined): T | undefined =>
  typed !== undefined && /^\d+$/.test(typed) ? list[Number(typed) - 1] : undefined;

const error = (problem: Problem): Command => ({ kind: 'error', problem });
const order = (value: Order): Command => ({ kind: 'order', order: value });

/** Turns a typed line into a command. It never throws, and it changes nothing. */
export function parse(line: string, scene: Scene): Command {
  const words = line.trim().split(/\s+/).filter((w) => w !== '');
  if (words.length === 0) return { kind: 'empty' };
  const word = wordOf(words[0]);
  if (word === undefined) return error('unknown-command');
  const args = words.slice(1);
  const { content, state, names, text, locale } = scene;
  const p = state.player;

  if (VIEWS.includes(word)) return { kind: 'view', view: word as View };
  if (word === 'undo' || word === 'done' || word === 'quit') return { kind: word };
  const focus = FOCUS[word];
  if (focus) return order({ type: 'focus', action: focus });
  if (word === 'room') return order({ type: 'setRentTier', tier: 0 });
  if (word === 'flat') return order({ type: 'setRentTier', tier: 1 });
  if (args.length === 0) return error('missing-words');

  const asset = () => find(content.assets, args[0], (a) => [a.id, names.assets[a.id].ticker, names.assets[a.id].name]);
  // The amount is one word, and what follows it is not read. Where thousands are set apart with a space
  // it is every word that is left, so that "1 500" is fifteen hundred and never one.
  const amountFrom = (at: number): string | undefined => (spaced(locale) && args.length > at ? args.slice(at).join(' ') : args[at]);

  switch (word) {
    case 'buy': {
      const found = asset();
      if (!found) return error('unknown-asset');
      const amount = parseAmount(amountFrom(1), p.cash, locale);
      return amount === null ? error('bad-amount') : order({ type: 'buy', assetId: found.id, amount });
    }
    case 'sell': {
      const found = asset();
      if (!found) return error('unknown-asset');
      const held = Object.hasOwn(p.positions, found.id) ? p.positions[found.id].value : 0;
      const amount = parseAmount(amountFrom(1), held, locale);
      return amount === null ? error('bad-amount') : order({ type: 'sell', assetId: found.id, amount });
    }
    case 'save':
    case 'pension':
    case 'borrow': {
      const amount = parseAmount(amountFrom(0), p.cash, locale);
      if (amount === null) return error('bad-amount');
      return order(word === 'save' ? { type: 'depositIn', amount } : word === 'pension' ? { type: 'pensionIn', amount } : { type: 'borrow', amount });
    }
    case 'withdraw': {
      const amount = parseAmount(amountFrom(0), p.deposit, locale);
      return amount === null ? error('bad-amount') : order({ type: 'depositOut', amount });
    }
    case 'repay': {
      const debt = nth(p.debts, args[0]);
      if (!debt) return error('unknown-number');
      const amount = parseAmount(amountFrom(1), Math.min(debt.principal, p.cash), locale);
      return amount === null ? error('bad-amount') : order({ type: 'repay', debtId: debt.id, amount });
    }
    case 'home': {
      const type = find(content.propertyTypes, args[0], (t) => [t.id, text.propertyTypes[t.id]]);
      if (!type) return error('unknown-home');
      const rest = args.slice(1).map((w) => w.toLowerCase());
      const rented = rest.some((w) => WORDS.rent.includes(w as never));
      // The engine's own figures: the price, and the smallest down payment a bank takes.
      const { price, minDown } = quoteProperty(content, state, type.id);
      if (rest.some((w) => NO_MORTGAGE.includes(w))) {
        return order({ type: 'buyProperty', typeId: type.id, downPayment: 0, mortgage: 'none', rented });
      }
      const share = rest.find((w) => /^\d+(?:\.\d+)?%?$/.test(w));
      const downPayment = share === undefined ? minDown : Math.ceil((price * Number(share.replace('%', ''))) / 100);
      if (!(downPayment > 0)) return error('bad-amount');
      const mortgage = rest.some((w) => VARIABLE.includes(w)) ? 'variable' : 'fixed';
      return order({ type: 'buyProperty', typeId: type.id, downPayment, mortgage, rented });
    }
    case 'sellhome': {
      const property = nth(p.properties, args[0]);
      return property ? order({ type: 'sellProperty', propertyId: property.id }) : error('unknown-number');
    }
    case 'rent': {
      const property = nth(p.properties, args[0]);
      if (!property) return error('unknown-number');
      // Without accents, so that "sí" is "si".
      const flag = plain(args[1] ?? '');
      if (!ON.includes(flag) && !OFF.includes(flag)) return error('needs-on-off');
      return order({ type: 'setRented', propertyId: property.id, rented: ON.includes(flag) });
    }
    case 'get':
    case 'finance':
    case 'drop': {
      const typed = args.join(' ');
      const item = nth(content.items, args.length === 1 ? args[0] : undefined) ?? find(content.items, typed, (i) => [i.id, names.items[i.id]]);
      if (!item) return error('unknown-item');
      if (word === 'drop') return order({ type: 'sellItem', itemId: item.id });
      return order(word === 'finance' ? { type: 'buyItem', itemId: item.id, financed: true } : { type: 'buyItem', itemId: item.id });
    }
    case 'lifestyle': {
      // A name is matched by its start, so a word with no letters in it must not match every name.
      const wanted = plain(args[0]);
      const tier = /^[0-3]$/.test(args[0]) ? Number(args[0]) : wanted === '' ? -1 : text.lifestyleTiers.findIndex((label) => plain(label).startsWith(wanted));
      if (tier !== 0 && tier !== 1 && tier !== 2 && tier !== 3) return error('bad-tier');
      return order({ type: 'setLifestyle', tier });
    }
    case 'insure': {
      const wanted = plain(args[0]);
      const kind = (Object.keys(INSURANCE) as InsuranceKind[]).find((k) => INSURANCE[k].includes(wanted));
      if (!kind) return error('unknown-insurance');
      const flag = plain(args[1] ?? 'on');
      if (!ON.includes(flag) && !OFF.includes(flag)) return error('needs-on-off');
      return order({ type: 'setInsurance', insurance: kind, on: ON.includes(flag) });
    }
    case 'move': {
      const city = find(content.cities, args.join(' '), (c) => [c.id, names.cities[c.id]]);
      return city ? order({ type: 'moveCity', cityId: city.id }) : error('unknown-city');
    }
    default:
      return error('unknown-command');
  }
}

/** Every word of each command. */
export const commandWords = WORDS;
