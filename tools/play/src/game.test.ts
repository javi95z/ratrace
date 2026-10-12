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
    expect(first.asked[0]).toBe('Life (1-6) > ');

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
    // Three cards to answer, then the finance phase of the first round.
    const { io, out } = scripted([
      '', '', '',
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
    const state = await runGame(io, { locale: 'en', lifeId: 'engineer', seed: 'orders' });
    const shown = text(out);
    expect(shown).toContain('✓ save 500 (added)');
    expect(shown).toContain('✓ buy msci 1000 (added)');
    expect(shown).toContain('✓ study (added)');
    expect(shown).toContain('Refused: You do not have enough cash.');
    expect(shown).toContain('Refused: You need more finance skill for that.');
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
    expect(shown).toContain('needs finance skill 2');
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

  it('plays every life to the end in both languages without a hole in the text', async () => {
    for (const lifeId of ['nurse', 'engineer', 'civil_servant', 'rider', 'heir', 'newcomer']) {
      for (const locale of ['en', 'es'] as const) {
        // Take the last option of every card where it is open, to walk through as much text as possible.
        const { io, out } = scripted(new Array(400).fill('3'));
        const state = await runGame(io, { locale, lifeId, seed: `walk-${lifeId}` });
        expect(state === null || state.finished, `${lifeId} ${locale}`).toBe(true);
        expect(text(out), `${lifeId} ${locale}`).not.toMatch(/undefined|NaN|\{[a-z_:]+\}/);
      }
    }
  });
});
