// @vitest-environment jsdom
import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { memoryServices, renderGame } from '../../testing/render';
import { useGame } from '../context';
import { CardsStandIn } from './PlayStandIns';

afterEach(cleanup);

/** Says where the game stands, so a test knows it has opened. */
function Status() {
  return <span>{`game ${useGame((s) => s.status)}`}</span>;
}

/*
 * The stand-ins of Play's parts that later tasks bring are all in one file, so each task deletes its own. What they must do meanwhile: keep a life
 * playable, and never leave a stage with nothing on it and nothing to press.
 */
describe('the cards, until Task 11 brings them', () => {
  it('shows the card waiting and its choices, so a life can be played on', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    renderGame(<CardsStandIn />, services);
    expect(await screen.findByText(/^Card 1 of \d/)).toBeTruthy();
    expect(within(screen.getByRole('group', { name: /^Your choices/ })).getAllByRole('button').length).toBeGreaterThan(0);
  });

  it('says the game is opening, not an empty stage, while no card is waiting', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    while (session.view().phase === 'cards') await session.answerCard(0);
    renderGame(<><CardsStandIn /><Status /></>, services);
    // The game is open, at the finances: no card is waiting.
    await screen.findByText('game playing');
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
