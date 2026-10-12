import { propertyPrice } from '@ratrace/engine';
import type { Content, FocusAction, GameState, InsuranceKind, Order } from '@ratrace/engine';
import type { ContentText, Names } from '@ratrace/content';
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
}

/** Every word a command answers to, in both languages. The first is the one the help shows. */
const WORDS = {
  buy: ['buy', 'comprar'],
  sell: ['sell', 'vender'],
  save: ['save', 'ahorrar'],
  withdraw: ['withdraw', 'retirar'],
  pension: ['pension'],
  borrow: ['borrow', 'pedir'],
  repay: ['repay', 'pagar'],
  home: ['home', 'casa'],
  sellhome: ['sellhome', 'vendercasa'],
  rent: ['rent', 'alquilar'],
  get: ['get', 'adquirir'],
  drop: ['drop', 'soltar'],
  lifestyle: ['lifestyle', 'vida'],
  room: ['room', 'habitacion'],
  flat: ['flat', 'piso'],
  insure: ['insure', 'seguro'],
  move: ['move', 'mudar'],
  overtime: ['overtime', 'extras'],
  study: ['study', 'estudiar'],
  hunt: ['hunt', 'buscar'],
  help: ['help', 'ayuda', '?'],
  me: ['me', 'yo'],
  news: ['news', 'noticias'],
  market: ['market', 'mercado'],
  portfolio: ['port', 'portfolio', 'cartera'],
  shop: ['shop', 'tienda'],
  tax: ['tax', 'impuestos'],
  cities: ['cities', 'ciudades'],
  homes: ['homes', 'casas'],
  orders: ['orders', 'ordenes'],
  undo: ['undo', 'deshacer'],
  done: ['done', 'listo', 'ok'],
  quit: ['quit', 'salir'],
} as const;

type Word = keyof typeof WORDS;
const VIEWS: readonly Word[] = ['help', 'me', 'news', 'market', 'portfolio', 'shop', 'tax', 'cities', 'homes', 'orders'];
const FOCUS: Partial<Record<Word, FocusAction>> = { overtime: 'overtime', study: 'studyCareer', hunt: 'jobHunt' };

const ALL = ['all', 'todo'];
const ON = ['on', 'si', 'yes'];
const OFF = ['off', 'no'];
const INSURANCE: Record<InsuranceKind, string[]> = {
  health: ['health', 'salud'],
  home: ['home', 'hogar'],
  life: ['life', 'vida'],
  liability: ['liability', 'civil'],
};

const wordOf = (typed: string): Word | undefined => {
  const key = plain(typed) || typed;
  return (Object.keys(WORDS) as Word[]).find((word) => (WORDS[word] as readonly string[]).includes(key));
};

/**
 * An amount in cents. Accepts 5000, 5,000, 5k, 1.5m, a percentage of `whole`, or "all".
 * Returns null for anything that is not a positive amount.
 */
export function parseAmount(typed: string | undefined, whole: number): number | null {
  if (typed === undefined) return null;
  const word = typed.toLowerCase();
  if (ALL.includes(word)) return whole > 0 ? whole : null;
  const percent = /^(\d+(?:\.\d+)?)%$/.exec(word);
  if (percent) {
    const amount = Math.floor((whole * Number(percent[1])) / 100);
    return Number(percent[1]) <= 100 && amount > 0 ? amount : null;
  }
  const match = /^\$?(\d[\d,]*(?:\.\d+)?)([km]?)$/.exec(word);
  if (!match) return null;
  const scale = match[2] === 'k' ? 1_000 : match[2] === 'm' ? 1_000_000 : 1;
  const cents = Math.round(Number(match[1].replace(/,/g, '')) * scale * 100);
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
  const { content, state, names, text } = scene;
  const p = state.player;
  const world = state.timeline[state.round];

  if (VIEWS.includes(word)) return { kind: 'view', view: word as View };
  if (word === 'undo' || word === 'done' || word === 'quit') return { kind: word };
  const focus = FOCUS[word];
  if (focus) return order({ type: 'focus', action: focus });
  if (word === 'room') return order({ type: 'setRentTier', tier: 0 });
  if (word === 'flat') return order({ type: 'setRentTier', tier: 1 });
  if (args.length === 0) return error('missing-words');

  const asset = () => find(content.assets, args[0], (a) => [a.id, names.assets[a.id].ticker, names.assets[a.id].name]);

  switch (word) {
    case 'buy': {
      const found = asset();
      if (!found) return error('unknown-asset');
      const amount = parseAmount(args[1], p.cash);
      return amount === null ? error('bad-amount') : order({ type: 'buy', assetId: found.id, amount });
    }
    case 'sell': {
      const found = asset();
      if (!found) return error('unknown-asset');
      const held = Object.hasOwn(p.positions, found.id) ? p.positions[found.id].value : 0;
      const amount = parseAmount(args[1], held);
      return amount === null ? error('bad-amount') : order({ type: 'sell', assetId: found.id, amount });
    }
    case 'save':
    case 'pension':
    case 'borrow': {
      const amount = parseAmount(args[0], p.cash);
      if (amount === null) return error('bad-amount');
      return order(word === 'save' ? { type: 'depositIn', amount } : word === 'pension' ? { type: 'pensionIn', amount } : { type: 'borrow', amount });
    }
    case 'withdraw': {
      const amount = parseAmount(args[0], p.deposit);
      return amount === null ? error('bad-amount') : order({ type: 'depositOut', amount });
    }
    case 'repay': {
      const debt = nth(p.debts, args[0]);
      if (!debt) return error('unknown-number');
      const amount = parseAmount(args[1], Math.min(debt.principal, p.cash));
      return amount === null ? error('bad-amount') : order({ type: 'repay', debtId: debt.id, amount });
    }
    case 'home': {
      const type = find(content.propertyTypes, args[0], (t) => [t.id, text.propertyTypes[t.id]]);
      if (!type) return error('unknown-home');
      const rest = args.slice(1).map((w) => w.toLowerCase());
      const rented = rest.some((w) => WORDS.rent.includes(w as never));
      const price = propertyPrice(content, world, p.cityId, type.id);
      if (rest.some((w) => w === 'cash' || w === 'contado')) {
        return order({ type: 'buyProperty', typeId: type.id, downPayment: 0, mortgage: 'none', rented });
      }
      const share = rest.find((w) => /^\d+(?:\.\d+)?%?$/.test(w));
      const smallest = price - Math.round((price * content.debt.mortgageMaxLtvBp) / 10_000);
      const downPayment = share === undefined ? smallest : Math.ceil((price * Number(share.replace('%', ''))) / 100);
      if (!(downPayment > 0)) return error('bad-amount');
      const mortgage = rest.includes('variable') ? 'variable' : 'fixed';
      return order({ type: 'buyProperty', typeId: type.id, downPayment, mortgage, rented });
    }
    case 'sellhome': {
      const property = nth(p.properties, args[0]);
      return property ? order({ type: 'sellProperty', propertyId: property.id }) : error('unknown-number');
    }
    case 'rent': {
      const property = nth(p.properties, args[0]);
      if (!property) return error('unknown-number');
      const flag = (args[1] ?? '').toLowerCase();
      if (!ON.includes(flag) && !OFF.includes(flag)) return error('needs-on-off');
      return order({ type: 'setRented', propertyId: property.id, rented: ON.includes(flag) });
    }
    case 'get':
    case 'drop': {
      const typed = args.join(' ');
      const item = nth(content.items, args.length === 1 ? args[0] : undefined) ?? find(content.items, typed, (i) => [i.id, names.items[i.id]]);
      if (!item) return error('unknown-item');
      return order(word === 'get' ? { type: 'buyItem', itemId: item.id } : { type: 'sellItem', itemId: item.id });
    }
    case 'lifestyle': {
      const tier = /^[0-3]$/.test(args[0]) ? Number(args[0]) : text.lifestyleTiers.findIndex((label) => plain(label).startsWith(plain(args[0])));
      if (tier !== 0 && tier !== 1 && tier !== 2 && tier !== 3) return error('bad-tier');
      return order({ type: 'setLifestyle', tier });
    }
    case 'insure': {
      const wanted = plain(args[0]);
      const kind = (Object.keys(INSURANCE) as InsuranceKind[]).find((k) => INSURANCE[k].includes(wanted));
      if (!kind) return error('unknown-insurance');
      const flag = (args[1] ?? 'on').toLowerCase();
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

/** The first word of each command, for the help screen. */
export const commandWords = WORDS;
