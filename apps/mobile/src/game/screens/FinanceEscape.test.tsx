// @vitest-environment jsdom
import { content } from '@ratrace/content';
import type { GameSession } from '@ratrace/core/session/types';
import { escapeProgress } from '@ratrace/engine';
import type { GameView } from '@ratrace/engine';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { memoryServices, renderGame } from '../../testing/render';
import { COLORS } from '../../ui/theme';
import { FinanceOpened } from './Finance';
import { Play } from './Play';

/*
 * What a choice in the finances leaves of the way out: a purchase whose upkeep sends a life just out of the rat race back into it is said in the
 * warning's colour before it is made, a choice that leaves it out is said plainly, and a life far from the way out is told nothing.
 */

afterEach(cleanup);

const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
const sheetTitled = (title: string) => screen.getByRole('heading', { name: title }).closest('[aria-modal="true"]') as HTMLElement;

/** The nurse's view with this much in savings, and cash enough for anything the shop sells. */
const withSavings = (view: GameView, deposit: number): GameView => ({ ...view, player: { ...view.player, deposit, cash: view.player.cash + 200_000_00 } });

/** The least savings whose interest covers the nurse's life: out of the rat race by a hair. */
function hairOut(view: GameView): number {
  let low = 0;
  let high = 100_000_000_00;
  while (high - low > 100_00) {
    const mid = Math.floor((low + high) / 2);
    const escape = escapeProgress(content, withSavings(view, mid));
    if (escape.passiveAfterTax >= escape.outgoings) high = mid;
    else low = mid;
  }
  return high;
}

/** A nurse at the finances of her first round, with the savings `deposit` makes of the least that covers her life; Play drawn as `opened` says. */
async function nurse(deposit: (hair: number) => number, opened: { tab: string; sheet?: string }) {
  const services = memoryServices();
  const real = await services.sessions.start('nurse');
  while (real.view().phase === 'cards') await real.answerCard(0);
  const saved = deposit(hairOut(real.view()));
  const session: GameSession = { gameId: real.gameId, lifeId: real.lifeId, view: () => withSavings(real.view(), saved), history: () => real.history(), bankruptcies: () => 0, story: () => [], badges: () => [], answerCard: (option) => real.answerCard(option), playRound: (choices) => real.playRound(choices) };
  services.sessions.resume = async () => ({ lost: null, session });
  renderGame(
    <FinanceOpened value={opened}>
      <Play />
    </FinanceOpened>,
    services,
  );
}

/** The line that says what a choice leaves of the way out, and the colour it is said in. */
const lineIn = (box: HTMLElement, start: string) => {
  const line = within(box).getByText((_, el) => el?.textContent?.startsWith(start) === true && el.children.length === 0);
  return { text: line.textContent ?? '', style: line.closest('[style*="color"]')?.getAttribute('style') ?? '' };
};

describe('what a purchase leaves of the way out', () => {
  it('warns, in the warning colour, of a club whose fees send a life just out of the rat race back into it', async () => {
    await nurse((hair) => hair, { tab: 'shop', sheet: 'item-member_club' });
    const sheet = await waitFor(() => sheetTitled('Soho House'));
    const line = lineIn(sheet, 'After buying: passive ');
    expect(line.text).toMatch(/^After buying: passive \S+ \/ outgoings \S+\. Back in the rat race\.$/);
    expect(line.style).toContain(rgb(COLORS['wine-300']));
    // Said where the screen reader hears it change.
    expect(within(sheet).getByText(line.text).closest('[aria-live="polite"]')).not.toBeNull();
  });

  it('says the figures plainly where the life stays out', async () => {
    await nurse((hair) => hair * 3, { tab: 'shop', sheet: 'item-member_club' });
    const sheet = await waitFor(() => sheetTitled('Soho House'));
    const line = lineIn(sheet, 'After buying: passive ');
    expect(line.text).not.toContain('rat race');
    expect(line.style).toContain(rgb(COLORS['ink-300']));
  });

  it('says nothing to a life far from the way out', async () => {
    await nurse(() => 0, { tab: 'shop', sheet: 'item-member_club' });
    const sheet = await waitFor(() => sheetTitled('Soho House'));
    expect(within(sheet).queryByText(/^After buying/)).toBeNull();
  });
});

describe('what a change of the way of life leaves of the way out', () => {
  it('warns under the choice of how to live once a dearer one is ordered, and says nothing before', async () => {
    await nurse((hair) => hair, { tab: 'lifestyle' });
    const tiers = await screen.findByRole('radiogroup', { name: 'How you live' }, { timeout: 15_000 });
    expect(screen.queryByText(/^With this change/)).toBeNull();
    fireEvent.click(within(tiers).getAllByRole('radio')[3]);
    const panel = tiers.parentElement as HTMLElement;
    const line = await waitFor(() => lineIn(panel, 'With this change: passive '));
    expect(line.text).toMatch(/Back in the rat race\.$/);
    expect(line.style).toContain(rgb(COLORS['wine-300']));
  });
});
