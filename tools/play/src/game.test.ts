import { content, lives, textFor } from '@ratrace/content';
import { createGame, previewCard } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { runGame } from './game';
import type { Io } from './game';

/** Plays from a script of answers. Once the script runs out, nobody answers and the game plays on first options. */
function scripted(answers: string[]): { io: Io; out: string[]; asked: string[] } {
  const out: string[] = [];
  const asked: string[] = [];
  const left = [...answers];
  return {
    out,
    asked,
    io: {
      print: (line) => out.push(line),
      ask: (prompt) => {
        asked.push(prompt);
        return Promise.resolve(left.length > 0 ? (left.shift() as string) : null);
      },
    },
  };
}

const text = (out: string[]) => out.join('\n');

describe('the terminal game', () => {
  it('plays a whole life with nobody at the keyboard', async () => {
    const { io, out } = scripted([]);
    const state = await runGame(io, { locale: 'en', lifeId: 'nurse', seed: 'terminal-1' });
    expect(state?.finished).toBe(true);
    expect(state?.round).toBe(20);
    const shown = text(out);
    expect(shown).toContain('THE RAT RACE');
    expect(shown).toContain('Age 22 · Round 1 of 20 · Madrid');
    expect(shown).toContain('Age 60 · Round 20 of 20');
    expect(shown).toContain('THE END · Age 62');
    expect(shown).toContain('pnpm play --life nurse --seed terminal-1 --lang en');
    expect(shown).not.toMatch(/undefined|NaN|\{[a-z_:]+\}/);
  });

  it('asks which life to live when none is given, and takes a number or a name', async () => {
    const first = scripted(['2']);
    const engineer = await runGame(first.io, { locale: 'en', seed: 'choose' });
    expect(engineer?.player.life.lifeId).toBe('engineer');
    expect(text(first.out)).toContain('1. Nurse');
    expect(text(first.out)).toContain('6. Newcomer abroad');
    expect(text(first.out)).toContain('11. Crypto kid');
    expect(first.asked[0]).toBe('Life (1-20) > ');

    const byName = scripted(['99', 'heir']);
    expect((await runGame(byName.io, { locale: 'en', seed: 'choose' }))?.player.life.lifeId).toBe('heir');
    expect((await runGame(scripted([]).io, { locale: 'en', seed: 'choose' }))?.player.life.lifeId).toBe('nurse');
  });

  it('shows each card with its options, and applies the one picked', async () => {
    const { io, out, asked } = scripted([]);
    await runGame(io, { locale: 'en', lifeId: 'engineer', seed: 'cards' });
    const shown = text(out);
    expect(shown).toContain('CARD 1 of 3');
    expect(shown).toMatch(/ {3}1\) .+/);
    expect(shown).toMatch(/You chose/i);
    expect(asked.filter((prompt) => prompt.includes('Your choice')).length).toBeGreaterThanOrEqual(60);
  });

  it('applies the option the player picks, not the first one', async () => {
    const { text: written } = textFor('en');
    const nurse = lives[0];
    // Find a seed whose first card has a second option the player may take.
    for (let i = 0; i < 50; i++) {
      const seed = `pick-${i}`;
      const start = createGame({ content, start: nurse.start }, seed);
      const cardId = start.hand[0];
      if (!previewCard(content, start, cardId)[1].available) continue;
      const { io, out } = scripted(['2']);
      await runGame(io, { locale: 'en', lifeId: 'nurse', seed });
      const card = written.cards[cardId];
      expect(text(out)).toContain(`${card.title}: you chose “${card.options[1].label}”`);
      const unanswered = scripted([]);
      await runGame(unanswered.io, { locale: 'en', lifeId: 'nurse', seed });
      expect(text(unanswered.out)).toContain(`${card.title}: you chose “${card.options[0].label}”`);
      return;
    }
    throw new Error('no seed gave an open second option');
  });

  it('takes orders, shows what they do, refuses what cannot be done, and undoes', async () => {
    // The cards of the first hand to answer, however many this seed deals, then the finance phase of the first round.
    const engineer = lives.find((life) => life.id === 'engineer');
    if (!engineer) throw new Error('no engineer');
    // A seed whose first cards leave the engineer the cash this script goes on to spend.
    const hand = createGame({ content, start: engineer.start }, 'orders-3').hand;
    const { io, out } = scripted([
      ...hand.map(() => ''),
      'save 500',
      'buy msci 1000',
      'buy msci 999999999',
      'buy btc 100',
      'dance',
      'study',
      'study',
      'orders',
      'undo',
      'orders',
      'study',
      'withdraw all',
      'tax',
      'market',
      'me',
      'shop',
      'homes',
      'cities',
      'port',
      'help',
      'done',
    ]);
    const state = await runGame(io, { locale: 'en', lifeId: 'engineer', seed: 'orders-3' });
    const shown = text(out);
    expect(shown).toContain('✓ save 500 (added)');
    expect(shown).toContain('✓ buy msci 1000 (added)');
    expect(shown).toContain('✓ study (added)');
    expect(shown).toContain('Refused: You do not have enough cash.');
    expect(shown).toContain('Refused: You need more money sense for that.');
    expect(shown).toContain("I do not know that command. Type 'help'.");
    expect(shown).toContain('Refused: You are already doing that this round.');
    expect(shown).toContain('1. save 500\n  2. buy msci 1000\n  3. study');
    expect(shown).toContain('− study (removed)');
    // Undone for real: the same order is taken again, where a second copy would be refused.
    expect(shown.split('✓ study (added)').length - 1).toBe(2);
    // "all" means all there will be once the orders typed so far have run: the 500 just saved.
    expect(shown).toContain('✓ withdraw all (added)');
    expect(shown).toContain('THIS ROUND');
    expect(shown).toContain('Escape test');
    expect(shown).toContain('MSCI   MSCI World');
    expect(shown).toContain('needs money sense 2');
    expect(shown).toContain('Rolex Submariner');
    expect(shown).toContain('Penthouse');
    expect(shown).toContain('Dubai — No income tax');
    expect(shown).toContain('PORTFOLIO');
    expect(shown).toContain('buy <asset> <amount>');
    expect(shown).toContain('RESOLVE · Age 22 → 24');
    expect(shown).toContain('Salary');
    // The orders that stood were played: the savings and the fund are still there at the end.
    expect(Object.keys(state?.player.positions ?? {})).toContain('msci_world');
  });

  it('leaves when asked to', async () => {
    const { io, out } = scripted(['', '', '', 'quit']);
    expect(await runGame(io, { locale: 'en', lifeId: 'nurse', seed: 'quit' })).toBeNull();
    expect(out[out.length - 1]).toBe(' See you next life.');
  });

  it('plays in Spanish, with Spanish orders', async () => {
    const { io, out } = scripted(['', '', '', 'ahorrar 500', 'estudiar', 'impuestos', 'listo']);
    const state = await runGame(io, { locale: 'es', lifeId: 'civil_servant', seed: 'es-1' });
    expect(state?.finished).toBe(true);
    const shown = text(out);
    expect(shown).toContain('Edad 22 · Ronda 1 de 20 · Madrid');
    expect(shown).toContain('NOTICIAS');
    expect(shown).toContain('✓ ahorrar 500 (añadida)');
    expect(shown).toContain('ESTA RONDA');
    expect(shown).toContain('Sueldo');
    expect(shown).toContain('FIN · Edad 62');
    expect(shown).not.toMatch(/undefined|NaN|\{[a-z_:]+\}/);
  });

  it('plays in Russian, with Russian orders', async () => {
    const servant = lives.find((life) => life.id === 'civil_servant');
    if (!servant) throw new Error('no civil servant');
    const hand = createGame({ content, start: servant.start }, 'ru-1').hand;
    // The first round is typed out; in every round after it the player looks at the news, studies and plays.
    const first = [
      ...hand.map(() => ''),
      'помощь',
      'я',
      'отложить 500',
      'учиться',
      'учиться',
      'танцевать',
      'купить msci 999 999 999',
      'планы',
      'отменить',
      'учиться',
      'снять всё',
      'налоги',
      'рынок',
      'портфель',
      'магазин',
      'недвижимость',
      'города',
      'готово',
    ];
    const out: string[] = [];
    const later: string[] = [];
    const io: Io = {
      print: (line) => out.push(line),
      ask: (prompt) => {
        if (first.length > 0) return Promise.resolve(first.shift() as string);
        if (/\(1[-–]\d/.test(prompt)) return Promise.resolve('1');
        if (later.length === 0) later.push('новости', 'учиться', 'готово');
        return Promise.resolve(later.shift() as string);
      },
    };
    const state = await runGame(io, { locale: 'ru', lifeId: 'civil_servant', seed: 'ru-1' });
    expect(state?.finished).toBe(true);
    expect(state?.round).toBe(20);
    const shown = text(out);
    expect(shown).toContain('THE RAT RACE');
    expect(shown).toContain('Возраст 22 · Раунд 1 из 20 · Мадрид');
    expect(shown).toContain('Возраст 60 · Раунд 20 из 20');
    expect(shown).toContain('НОВОСТИ');
    expect(shown).toContain('ТЫ  Госслужащий · Госслужба (Специалист)');
    expect(shown).toMatch(/КАРТА 1 из \d/);
    expect(shown).toMatch(/: твой выбор — «[^»]+»/);
    expect(shown).toContain('КОМАНДЫ');
    expect(shown).toContain('купить <актив> <сумма>');
    expect(shown).toContain('✓ отложить 500 (добавлено)');
    expect(shown).toContain('✓ учиться (добавлено)');
    expect(shown).toContain('Нельзя: В этом раунде ты это уже делаешь.');
    expect(shown).toContain('Не знаю такой команды. Набери «помощь».');
    // A civil servant starts knowing nothing of money: not even a fund is open yet.
    expect(shown).toContain('Нельзя: Для этого нужна финансовая грамотность повыше.');
    expect(shown).toContain('ПЛАНЫ НА РАУНД\n  1. отложить 500\n  2. учиться');
    expect(shown).toContain('− учиться (убрано)');
    // Undone for real: in the first round the same plan is taken again, where a second copy would be refused.
    expect(shown.slice(0, shown.indexOf('ИТОГИ РАУНДА')).split('✓ учиться (добавлено)').length - 1).toBe(2);
    expect(shown).toContain('✓ снять всё (добавлено)');
    expect(shown).toContain('ЭТОТ РАУНД');
    expect(shown).toContain('Тест на выход');
    expect(shown).toContain('Зарплата');
    expect(shown).toContain('MSCI   MSCI World');
    expect(shown).toContain('XAU    Золото');
    expect(shown).toContain('нужна финансовая грамотность 2');
    expect(shown).toContain('ПОРТФЕЛЬ');
    expect(shown).toContain('Rolex Submariner');
    expect(shown).toContain('НЕДВИЖИМОСТЬ · Мадрид');
    expect(shown).toContain('Пентхаус');
    expect(shown).toContain('Дубай — Подоходного налога нет');
    expect(shown).toContain('ИТОГИ РАУНДА · Возраст 22 → 24');
    expect(shown).toContain('КОНЕЦ · Возраст 62');
    expect(shown).toContain('Сыграть эту жизнь ещё раз: pnpm play --life civil_servant --seed ru-1 --lang ru');
    // Money and rates as Russian writes them: 1 200 $ and 2,5%, never $1,200 or 2.5%.
    expect(shown).toMatch(/\d\u00A0\$/);
    expect(shown).not.toMatch(/\$\d/);
    expect(shown).toMatch(/\d,\d%/);
    expect(shown).not.toMatch(/\d\.\d/);
    expect(shown).not.toMatch(/undefined|NaN|\{[a-z_:]+\}/);
    // Nothing of the other two languages is left in what the terminal itself says.
    expect(shown).not.toMatch(/\b(?:Age|Round|Cash|Savings|Salary|Refused|added|You chose|Edad|Ronda|Efectivo|Sueldo)\b/);
    expect(shown).not.toMatch(/[“”"]/);
  });

  it('leaves in Russian when asked to', async () => {
    const hand = createGame({ content, start: lives[0].start }, 'quit').hand;
    const { io, out } = scripted([...hand.map(() => ''), 'выйти']);
    expect(await runGame(io, { locale: 'ru', lifeId: 'nurse', seed: 'quit' })).toBeNull();
    expect(out[out.length - 1]).toBe(' До следующей жизни.');
  });

  it('asks in Russian which life to live', async () => {
    const { io, out, asked } = scripted(['2']);
    const engineer = await runGame(io, { locale: 'ru', seed: 'choose' });
    expect(engineer?.player.life.lifeId).toBe('engineer');
    expect(text(out)).toContain('Выбери жизнь');
    expect(text(out)).toContain('1. Медсестра');
    expect(text(out)).toContain('11. Дитя крипты');
    expect(asked[0]).toBe('Жизнь (1–20) > ');
    expect(asked.filter((prompt) => prompt.includes('Твой выбор (1–')).length).toBeGreaterThanOrEqual(content.rounds * content.life.cardsPerRound - 3);
  });

  it('settles each card before it shows the next', async () => {
    const { text: written } = textFor('en');
    const start = createGame({ content, start: lives[1].start }, 'one-by-one');
    expect(start.hand.length).toBeGreaterThanOrEqual(2);
    const { io, out } = scripted(['', '', '', 'quit']);
    await runGame(io, { locale: 'en', lifeId: 'engineer', seed: 'one-by-one' });
    const shown = text(out);
    const first = written.cards[start.hand[0]];
    const result = shown.indexOf(`${first.title}: you chose`);
    const second = shown.indexOf(`CARD 2 of ${start.hand.length}`);
    expect(result).toBeGreaterThan(0);
    expect(second).toBeGreaterThan(result);
  });

  it('plays every life to the end in every language without a hole in the text', { timeout: 60_000 }, async () => {
    // Every screen, then the word that plays the round, as each language types them.
    const typed = {
      en: ['me', 'market', 'port', 'shop', 'homes', 'cities', 'tax', 'orders', 'help', 'done'],
      es: ['me', 'market', 'port', 'shop', 'homes', 'cities', 'tax', 'orders', 'help', 'listo'],
      ru: ['я', 'рынок', 'портфель', 'магазин', 'недвижимость', 'города', 'налоги', 'планы', 'помощь', 'готово'],
    };
    for (const lifeId of ['nurse', 'engineer', 'civil_servant', 'rider', 'heir', 'newcomer', 'banker', 'doctor', 'comeback', 'founder', 'crypto_kid']) {
      for (const locale of ['en', 'es', 'ru'] as const) {
        // Take the last option of every card where it is open, to walk through as much text as possible,
        // look at every screen once a round, and play the round.
        const out: string[] = [];
        const queue: string[] = [];
        let cards = 0;
        let rounds = 0;
        const io: Io = {
          print: (line) => out.push(line),
          ask: (prompt) => {
            // The range in the prompt is written with a hyphen or, in Russian, with a dash.
            if (/\(1[-–]\d/.test(prompt)) {
              cards += 1;
              return Promise.resolve('3');
            }
            if (queue.length === 0) {
              rounds += 1;
              queue.push(...typed[locale]);
            }
            return Promise.resolve(queue.shift() as string);
          },
        };
        const state = await runGame(io, { locale, lifeId, seed: `walk-${lifeId}` });
        expect(state?.finished, `${lifeId} ${locale}`).toBe(true);
        expect(rounds, `${lifeId} ${locale}`).toBe(content.rounds);
        expect(cards, `${lifeId} ${locale}`).toBeGreaterThanOrEqual(content.rounds * content.life.cardsPerRound - 3);
        const shown = text(out);
        expect(shown, `${lifeId} ${locale}`).not.toMatch(/undefined|NaN|\{[a-z_:]+\}/);
        // No sign in front of a sign, and no minus in front of nothing.
        expect(shown, `${lifeId} ${locale}`).not.toMatch(/[+−-][−-]\s?[$\d]|[−-]\$0(?![\d.,])|[−-]0\s\$/);
      }
    }
  });
});
