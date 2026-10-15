import { content, lives, textFor } from '@ratrace/content';
import type { Locale } from '@ratrace/content';
import { createGame, indexed, quoteProperty, scoreBreakdown } from '@ratrace/engine';
import type { GameState } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { formatFor, plain } from './format';
import { commandWords } from './parse';
import * as screens from './screens';
import type { Pen } from './screens';
import { ui } from './strings';

const penFor = (locale: Locale): Pen => ({ content, ...textFor(locale), locale, ui: ui[locale], fmt: formatFor(locale) });
const pen = penFor('en');
const game = (change: (state: GameState) => void = () => {}): GameState => {
  const state = createGame({ content, start: lives[1].start }, 'screens');
  change(state);
  return state;
};

describe('money', () => {
  it('never writes a negative zero, with or without a sign', () => {
    for (const locale of ['en', 'es', 'ru'] as const) {
      const fmt = formatFor(locale);
      for (const cents of [0, -0, 40, -40, -49]) {
        expect(fmt.money(cents), `${locale} ${cents}`).not.toMatch(/[−-]/);
        // A change of nothing carries no sign at all.
        expect(fmt.signed(cents), `${locale} ${cents}`).toMatch(/^[^+−-]*$/);
      }
      expect(fmt.signed(-51)).toMatch(/^−[^+]*1/);
      expect(fmt.signed(-12_345_00)).toMatch(/^−/);
      expect(fmt.signed(12_345_00)).toMatch(/^\+/);
    }
  });

  it('writes money and rates as each language does', () => {
    const [en, es, ru] = [formatFor('en'), formatFor('es'), formatFor('ru')];
    expect(en.money(1_234_567)).toBe('$12,346');
    expect(en.signed(-30_000)).toBe('−$300');
    expect(en.rate(250)).toBe('2.5%');
    expect(en.change(-2200)).toBe('−22%');
    expect(en.number(12_345)).toBe('12,345');
    expect(es.money(1_234_567)).toBe('12.346\u00A0$');
    expect(es.rate(250)).toBe('2,5%');
    // Russian: a no-break space between thousands and before the sign, a decimal comma, the percent sign against its number.
    expect(ru.money(1_234_567)).toBe('12\u00A0346\u00A0$');
    expect(ru.money(120_000)).toBe('1\u00A0200\u00A0$');
    expect(ru.signed(120_000)).toBe('+1\u00A0200\u00A0$');
    expect(ru.signed(-30_000)).toBe('−300\u00A0$');
    expect(ru.rate(250)).toBe('2,5%');
    expect(ru.change(-2200)).toBe('−22%');
    expect(ru.number(12_345)).toBe('12\u00A0345');
  });

  it('writes a number with a set count of decimals, with the decimal mark of the language', () => {
    expect(formatFor('en').fixed(1.25, 2)).toBe('1.25');
    expect(formatFor('en').fixed(1, 2)).toBe('1.00');
    expect(formatFor('en').fixed(0.5, 1)).toBe('0.5');
    expect(formatFor('en').fixed(0.004, 3)).toBe('0.004');
    expect(formatFor('es').fixed(1.25, 2)).toBe('1,25');
    expect(formatFor('ru').fixed(1.25, 2)).toBe('1,25');
    expect(formatFor('ru').fixed(1, 2)).toBe('1,00');
    expect(formatFor('ru').fixed(0.5, 1)).toBe('0,5');
  });
});

describe('screens', () => {
  it('shows the score exactly as the engine breaks it down', () => {
    // Status now is far from the status lived, and the life escaped: any sum worked out here would differ.
    const state = game((s) => {
      s.finished = true;
      s.round = 20;
      s.timeline = Array.from({ length: 21 }, (_, round) => ({ ...s.timeline[0], round }));
      s.player.statusPoints = 400;
      s.player.statusSum = 20 * 37;
      s.player.escapedAtRound = 12;
      s.player.cash = 150_000_000;
    });
    const parts = scoreBreakdown(content, state);
    expect(parts.status).toBe(37);
    expect(parts.multiplierPct).toBeGreaterThan(100);
    const shown = screens.ending(pen, state).join('\n');
    expect(shown).toContain(`(Wealth ${parts.wealth} + Status ${parts.status}) × ${(parts.multiplierPct / 100).toFixed(2)} escape bonus = ${pen.fmt.number(parts.total)}`);
  });

  it('says how much cash a home takes, purchase tax included', () => {
    const state = game();
    const shown = screens.homes(pen, state).join('\n');
    for (const type of content.propertyTypes) {
      const quote = quoteProperty(content, state, type.id);
      expect(quote.purchaseTax).toBeGreaterThan(0);
      expect(shown).toContain(`cash needed ${pen.fmt.money(quote.minDown + quote.purchaseTax)}`);
    }
  });

  it('tells the player when the escape is lost', () => {
    expect(screens.ledger(pen, [{ kind: 'escapeLost' }]).join('\n')).toContain(pen.ui.escapeLost);
    expect(screens.ledger(penFor('es'), [{ kind: 'escapeLost' }]).join('\n')).toContain(ui.es.escapeLost);
    expect(screens.ledger(penFor('ru'), [{ kind: 'escapeLost' }]).join('\n')).toContain(ui.ru.escapeLost);
    expect(pen.ui.escapeLost).not.toBe(pen.ui.escaped);
    expect(ui.ru.escapeLost).not.toBe(ui.ru.escaped);
  });

  it('describes a renovation by the dollars it adds to the home, at today’s prices', () => {
    const state = game((s) => {
      s.timeline[0] = { ...s.timeline[0], priceLevel: s.timeline[0].priceLevel * 2 };
    });
    const phrases = screens.effectPhrases(pen, state, { homeValue: 2_000_000 });
    expect(phrases).toEqual([`home value +${pen.fmt.money(indexed(2_000_000, state.timeline[0]))}`]);
    expect(phrases[0]).toContain('$40,000');
  });

  it('names every command in the help of every language, by a word the parser answers to', () => {
    for (const locale of ['en', 'es', 'ru'] as const) {
      const named = new Set(ui[locale].help.join(' ').split(/[^\p{L}]+/u).map(plain));
      for (const [command, words] of Object.entries(commandWords)) {
        // The help is what "help" shows, and does not list itself.
        if (command !== 'help') expect(words.some((word) => named.has(word)), `${locale} ${command}`).toBe(true);
      }
    }
  });

  it('says in every language at what age the rat race was left, and for how long a debt still runs', () => {
    const escaped = game((s) => {
      s.finished = true;
      s.round = 20;
      s.timeline = Array.from({ length: 21 }, (_, round) => ({ ...s.timeline[0], round }));
      s.player.escapedAtRound = 12;
    });
    expect(screens.ending(pen, escaped).join('\n')).toContain('  You left the rat race at 46.');
    expect(screens.ending(penFor('es'), escaped).join('\n')).toContain('  Saliste de la rueda a los 46.');
    expect(screens.ending(penFor('ru'), escaped).join('\n')).toContain('  Ты вне крысиных бегов с 46 лет.');
    const never = game((s) => {
      s.finished = true;
      s.round = 20;
      s.timeline = Array.from({ length: 21 }, (_, round) => ({ ...s.timeline[0], round }));
    });
    expect(screens.ending(pen, never).join('\n')).toContain('  You never left the rat race.');
    expect(screens.ending(penFor('ru'), never).join('\n')).toContain('  Выйти из крысиных бегов не удалось.');

    const debtor = game((s) => {
      s.player.debts = [
        { id: 'd1', kind: 'personalLoan', principal: 300_000, fixedRateBp: 700, roundsLeft: 2 },
        { id: 'd2', kind: 'creditCard', principal: 50_000, fixedRateBp: 0, roundsLeft: 0 },
      ];
    });
    expect(screens.me(pen, debtor).join('\n')).toMatch(/1\. Personal loan {2}\$3,000 {2}7\.0%, 2 rounds left\n/);
    expect(screens.me(penFor('es'), debtor).join('\n')).toMatch(/, 2 rondas\n/);
    expect(screens.me(penFor('ru'), debtor).join('\n')).toMatch(/1\. Потребительский кредит {2}3\u00A0000\u00A0\$ {2}7,0%, ещё 2 раунда\n/);
    // A credit card has no term in any language.
    expect(screens.me(penFor('ru'), debtor).join('\n')).toMatch(/2\. Кредитная карта {2}500\u00A0\$ {2}\d+,\d%$/m);
  });
});

describe('Russian', () => {
  const ru = ui.ru;
  const russian = penFor('ru');

  it('counts with every form the language has', () => {
    expect([1, 2, 4, 5, 11, 12, 20, 21, 22, 25, 101, 111].map((n) => ru.columns.roundsLeft(n))).toEqual([
      'ещё 1 раунд', 'ещё 2 раунда', 'ещё 4 раунда', 'ещё 5 раундов', 'ещё 11 раундов', 'ещё 12 раундов', 'ещё 20 раундов',
      'ещё 21 раунд', 'ещё 22 раунда', 'ещё 25 раундов', 'ещё 101 раунд', 'ещё 111 раундов',
    ]);
    expect([21, 22, 24, 25, 31, 40, 41, 62].map((age) => ru.escapedAtAge(age))).toEqual([
      'Ты вне крысиных бегов с 21 года.', 'Ты вне крысиных бегов с 22 лет.', 'Ты вне крысиных бегов с 24 лет.', 'Ты вне крысиных бегов с 25 лет.',
      'Ты вне крысиных бегов с 31 года.', 'Ты вне крысиных бегов с 40 лет.', 'Ты вне крысиных бегов с 41 года.', 'Ты вне крысиных бегов с 62 лет.',
    ]);
    expect([1, 2, 3, 5, 11, 21].map((n) => ru.children(n))).toEqual(['1 ребёнок', '2 ребёнка', '3 ребёнка', '5 детей', '11 детей', '21 ребёнок']);
    expect([1, 2, 5].map((n) => ru.effects.child(n))).toEqual(['1 ребёнок', '2 ребёнка', '5 детей']);
    expect([1, 2, 4, 5, 10, 21, 22].map((years) => ru.effects.yearly('+1', years))).toEqual([
      '+1/год на 1 год', '+1/год на 2 года', '+1/год на 4 года', '+1/год на 5 лет', '+1/год на 10 лет', '+1/год на 21 год', '+1/год на 22 года',
    ]);
    expect(ru.effects.yearly('−1', null)).toBe('−1/год');
  });

  it('says what an option does in whole phrases', () => {
    const state = game();
    const phrases = screens.effectPhrases(russian, state, {
      salaryModPct: 10, salaryBoostPct: -5, careerSkill: 1, financeSkill: 1, status: -2, focus: 1,
      recurring: [{ tag: 'in', kind: 'passive', annual: 100_000, roundsLeft: 2 }, { tag: 'out', kind: 'expense', annual: 50_000, roundsLeft: null }],
      moveCity: 'london', children: 2, buyItem: { itemId: 'watch_rolex', pricePct: 100 }, invest: { assetId: 'gold', amount: 500_000 },
      pension: 100_000, loan: 200_000, property: { typeId: 'studio', pricePct: 100, downPct: 20, rented: true }, refinance: 'variable', homeValue: 2_000_000,
      lose: { pct: 30, what: 'deposit' }, lifestyleFloor: 2,
    });
    const money = (cents: number) => russian.fmt.money(indexed(cents, state.timeline[0]));
    expect(phrases).toEqual([
      '+10% к зарплате навсегда', '−5% к зарплате в этом раунде', '+1 к карьерному навыку', '+1 к Финансам', '−2 к статусу', '−1 к фокусу',
      `+${money(100_000)}/год на 4 года`, `−${money(50_000)}/год`,
      'переезд в Лондон', '2 ребёнка', 'получаешь: Rolex Submariner', `Золото на ${money(500_000)}`,
      `+${money(100_000)} в пенсионный план`, `кредит на ${money(200_000)}`, 'покупаешь: студия под сдачу', 'ипотека теперь плавающая',
      `цена жилья +${money(2_000_000)}`, 'теряешь 30%: сбережения', 'образ жизни не ниже: комфорт',
    ]);
    expect(screens.effectPhrases(russian, state, { job: { leave: true }, partner: null, sellHome: true, refinance: 'fixed', lose: { pct: 50, what: 'crypto' } })).toEqual([
      'работы больше нет', 'расставание', 'ипотека теперь фиксированная', 'продаёшь своё жильё', 'теряешь 50%: крипта',
    ]);
  });

  it('writes the score with a decimal comma', () => {
    const state = game((s) => {
      s.finished = true;
      s.round = 20;
      s.timeline = Array.from({ length: 21 }, (_, round) => ({ ...s.timeline[0], round }));
      s.player.statusSum = 20 * 37;
      s.player.escapedAtRound = 12;
      s.player.cash = 150_000_000;
    });
    const parts = scoreBreakdown(content, state);
    const factor = (parts.multiplierPct / 100).toFixed(2).replace('.', ',');
    expect(factor).toMatch(/^\d,\d\d$/);
    expect(screens.ending(russian, state).join('\n')).toContain(`Очки: (Богатство ${parts.wealth} + Статус ${parts.status}) × ${factor} бонус за выход = ${russian.fmt.number(parts.total)}`);
  });

  it('puts what was chosen in angle quotes, and what is quoted inside it in low ones', () => {
    const def = content.cards[0];
    const written = russian.text.cards[def.id];
    const shown = screens.cardResult(russian, { kind: 'card', cardId: def.id, picked: 0, option: 0, outcome: null, cash: 0 });
    expect(shown[0]).toBe(`  ${written.title}: твой выбор — «${written.options[0].label}»`);
    expect(ru.quoted('Клуб «Рассвет»')).toBe('«Клуб „Рассвет“»');
    // The other two languages are quoted as they were.
    expect(screens.cardResult(pen, { kind: 'card', cardId: def.id, picked: 0, option: 0, outcome: null, cash: 0 })[0]).toBe(`  ${pen.text.cards[def.id].title}: you chose “${pen.text.cards[def.id].options[0].label}”`);
    expect(ui.es.quoted('x')).toBe('“x”');
  });

  it('has a line of help for every line the English has, and the same problems', () => {
    expect(ru.help).toHaveLength(ui.en.help.length);
    expect(Object.keys(ru.problems).sort()).toEqual(Object.keys(ui.en.problems).sort());
    expect(Object.keys(ru.columns).sort()).toEqual(Object.keys(ui.en.columns).sort());
    expect(Object.keys(ru.effects).sort()).toEqual(Object.keys(ui.en.effects).sort());
  });

  /** Every string the Russian terminal can say: the plain ones, and what each function gives for a few numbers. */
  function everything(value: unknown, path = 'ru'): Array<[string, string]> {
    if (typeof value === 'string') return [[path, value]];
    if (typeof value === 'function') {
      const call = value as (...args: unknown[]) => string;
      const args: unknown[][] = path.endsWith('.yearly') ? [['+100', null], ['+100', 1], ['+100', 2], ['+100', 5]]
        : path.endsWith('.invest') ? [['100', 'Золото']]
        : path.endsWith('.lose') ? [[30, 'сбережения']]
        : path.endsWith('.quoted') ? [['Вариант']]
        : [[1, 20], [2, 20], [5, 20], [21, 20]];
      return args.map((list, i) => [`${path}(${i})`, call(...list)] as [string, string]);
    }
    if (typeof value !== 'object' || value === null) return [];
    return Object.entries(value).flatMap(([key, entry]) => everything(entry, `${path}.${key}`));
  }

  it('is typeset as docs/i18n/russian.md says', () => {
    const all = everything(ru);
    expect(all.length).toBeGreaterThan(150);
    const broken = (test: (sentence: string) => boolean) => all.filter(([, sentence]) => test(sentence)).map(([path]) => path);
    // Angle quotes only, one character for three dots, a dash that is a dash, a percent sign against its number.
    expect(broken((s) => /["“”‘’'`]/.test(s))).toEqual([]);
    expect(broken((s) => s.includes('...'))).toEqual([]);
    expect(broken((s) => / - | -- |[а-яё] – /i.test(s))).toEqual([]);
    expect(broken((s) => /\d %/.test(s))).toEqual([]);
    expect(broken((s) => / [,.;:!?](\s|$)/.test(s))).toEqual([]);
    expect(broken((s) => /[¿¡!]/.test(s))).toEqual([]);
    expect(broken((s) => /undefined|NaN|\{[a-z_:]+\}/.test(s))).toEqual([]);
    // No currency sign written by hand: the code formats money.
    expect(broken((s) => /[$€₽]/.test(s))).toEqual([]);
    // ё wherever it belongs. Only forms that are never right with е are listed: the list the tests of the content text
    // keep, and the words of this file that it does not have.
    const withoutYo = new RegExp(
      `(?<![а-яё])(?:${[
        'еще', 'ее', 'нее', 'мое', 'твое', 'свое', 'твоем', 'своем', 'партнер[а-я]*', 'учеба', 'учебы', 'учебе', 'учебу', 'учебой', 'заем', 'наем',
        'прием', 'приема', 'приему', 'приемом', 'приеме', 'объем[а-я]*', 'счет', 'отчет[а-я]*', 'расчет[а-я]*', 'самолет[а-я]*', 'перелет[а-я]*', 'полет[а-я]*', 'вперед',
        'идешь', 'живешь', 'берешь', 'даешь', 'ждешь', 'придешь', 'уйдешь', 'найдешь', 'начнешь', 'вернешь', 'поймешь', 'продаешь', 'отдаешь', 'сдаешь', 'остаешься', 'вернешься',
        'идет', 'живет', 'дает', 'ждет', 'придет', 'уйдет', 'растет', 'несет', 'ведет', 'продает', 'отдает', 'сдает', 'остается', 'придется', 'удается', 'вернется', 'начнется', 'найдется',
        'ребенок', 'ребенка', 'вдвоем', 'сдается', 'уберет', 'продатьжилье',
      ].join('|')})(?![а-яё])`,
      'i',
    );
    expect(broken((s) => withoutYo.test(s))).toEqual([]);
    // Written in its own letters: whatever has words has Cyrillic ones. The name of the game and the bare prompt are the same in every language.
    const latin = new Set(['ru.title', 'ru.prompt']);
    expect(broken((s) => /\p{L}/u.test(s) && !/[а-яё]/i.test(s)).filter((path) => !latin.has(path))).toEqual([]);
    // And it never tells the player whether they are a man or a woman: no ending offered both ways, no «ты» with a verb in the past.
    expect(broken((s) => /\((?:а|ла|ая|на)\)|[а-яё]\/[а-яё]{1,3}(?![а-яё])/i.test(s))).toEqual([]);
    expect(broken((s) => /(?<![а-яё])ты (?:не )?(?:уже |ещё |так и не |сам[а-я]* )?[а-яё]+(?:л|ла|лся|лась)(?![а-яё])/i.test(s))).toEqual([]);
    // A label has no full stop; a sentence has one. The lines that end in a stop here are all sentences.
    for (const key of ['chooseLife', 'age', 'news', 'cash', 'netWorth', 'resolve', 'theEnd', 'score', 'replay', 'promoted'] as const) expect(ru[key], key).not.toMatch(/[.:]$/);
    for (const key of ['tagline', 'nothingToUndo', 'escaped', 'escapeLost', 'bankrupt', 'statusNote', 'neverEscaped', 'goodbye', 'noOrders'] as const) expect(ru[key], key).toMatch(/\.$/);
    for (const [key, problem] of Object.entries(ru.problems)) expect(problem, key).toMatch(/\.$/);
  });

  it('uses the words the game already chose', () => {
    // docs/i18n/russian.md: one English word, one Russian word, everywhere.
    expect(ru.cash).toBe('Наличные');
    expect(ru.savings).toBe('Сбережения');
    expect(ru.pension).toBe('Пенсионный план');
    expect(ru.netWorth).toBe('Чистый капитал');
    expect(ru.score).toBe('Очки');
    expect(ru.wealthPoints).toBe('Богатство');
    expect(ru.focus).toBe('Фокус');
    expect(ru.careerSkill).toBe('Карьерный навык');
    expect(ru.financeSkill).toBe('Финансы');
    expect(ru.lifestyle).toBe('Образ жизни');
    expect(ru.home).toBe('Жильё');
    expect(ru.round(3, 20)).toBe('Раунд 3 из 20');
    expect(ru.card(1, 3)).toBe('КАРТА 1 из 3');
    expect(ru.headers.orders).toBe('ПЛАНЫ НА РАУНД');
    expect(ru.noOrders).toBe('Планов пока нет.');
    expect(ru.title).toBe('THE RAT RACE');
    const all = everything(ru).map(([, sentence]) => sentence).join('\n');
    // Never «счёт» for the score, «стоимость» for net worth, or «ордер» and «заявка» for a plan.
    expect(all).not.toMatch(/счёт|стоимост|ордер|заявк|приказ/i);
  });
});

