// @vitest-environment jsdom
import { content } from '@ratrace/content';
import type { GameView } from '@ratrace/engine';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameSession } from '@ratrace/core/session/types';
import { memoryServices, renderGame, setWidth } from '@/testing/render';
import { Play } from './Play';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/play',
}));

beforeEach(() => setWidth('phone'));
afterEach(cleanup);

/** A nurse with rounds left to serve, dealt the commissary card first: one of its choices may add to the sentence. */
async function inside(rounds: number) {
  const services = memoryServices();
  const real = await services.sessions.start('nurse');
  const view = (): GameView => {
    const now = real.view();
    return { ...now, hand: ['crime_jail_commissary', ...now.hand.slice(1)], player: { ...now.player, life: { ...now.player.life, jailRounds: rounds } } };
  };
  const session: GameSession = { gameId: real.gameId, lifeId: real.lifeId, view, history: () => real.history(), bankruptcies: () => 0, story: () => [], badges: () => [], answerCard: (option) => real.answerCard(option), playRound: (choices) => real.playRound(choices) };
  services.sessions.resume = async () => ({ lost: null, session });
  const user = userEvent.setup();
  renderGame(<Play />, services);
  await screen.findByRole('heading', { name: 'News' });
  return user;
}

describe('prison', () => {
  it('is explained from the tag that says the player is inside, with the rounds left', async () => {
    const user = await inside(2);
    await user.click(screen.getByRole('button', { name: /^In prison/ }));
    const sheet = screen.getByRole('dialog', { name: 'Prison' });
    expect(within(sheet).getByText('2 rounds left to serve')).toBeTruthy();
    expect(within(sheet).getByText('No salary.')).toBeTruthy();
    expect(within(sheet).getByText(`Going in costs ${content.life.jail.statusLost} status.`)).toBeTruthy();
    await user.click(within(sheet).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is explained beside a card whose choices may end in it, not inside a choice', async () => {
    const user = await inside(1);
    await user.click(screen.getByRole('button', { name: 'See what life brings' }));
    const choices = await screen.findByRole('group', { name: /^Your choices/ });
    const see = screen.getByRole('button', { name: 'What happens in prison?' });
    expect(choices.contains(see)).toBe(false);
    await user.click(see);
    const sheet = screen.getByRole('dialog', { name: 'Prison' });
    expect(within(sheet).getByText('Only prison cards come up.')).toBeTruthy();
    // Asked from a card, it says nothing of rounds left.
    expect(within(sheet).queryByText(/left to serve/)).toBeNull();
  });
});
