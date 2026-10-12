import { content, lives, textFor } from '@ratrace/content';
import type { Locale } from '@ratrace/content';
import { createGame, indexed, quoteProperty, scoreBreakdown } from '@ratrace/engine';
import type { GameState } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { formatFor } from './format';
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
    for (const locale of ['en', 'es'] as const) {
      const fmt = formatFor(locale);
      for (const cents of [0, -0, 40, -40, -49]) {
        expect(fmt.money(cents), `${locale} ${cents}`).not.toMatch(/[−-]/);
        expect(fmt.signed(cents), `${locale} ${cents}`).toMatch(/^\+[^−-]*$/);
      }
      expect(fmt.signed(-51)).toMatch(/^−[^+]*1/);
      expect(fmt.signed(-12_345_00)).toMatch(/^−/);
      expect(fmt.signed(12_345_00)).toMatch(/^\+/);
    }
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
    expect(pen.ui.escapeLost).not.toBe(pen.ui.escaped);
  });

  it('describes a renovation by the dollars it adds to the home, at today’s prices', () => {
    const state = game((s) => {
      s.timeline[0] = { ...s.timeline[0], priceLevel: s.timeline[0].priceLevel * 2 };
    });
    const phrases = screens.effectPhrases(pen, state, { homeValue: 2_000_000 });
    expect(phrases).toEqual([`home value +${pen.fmt.money(indexed(2_000_000, state.timeline[0]))}`]);
    expect(phrases[0]).toContain('$40,000');
  });
});
