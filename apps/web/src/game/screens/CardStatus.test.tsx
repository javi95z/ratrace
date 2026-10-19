// @vitest-environment jsdom
import { content } from '@ratrace/content';
import { quoteItem } from '@ratrace/engine';
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

describe('the status a card offers', () => {
  it('is what the thing would add to this player, not what it is worth alone', async () => {
    const services = memoryServices();
    const real = await services.sessions.start('nurse');
    // A nurse who already wears an Omega, dealt the call about a Rolex: the better watch counts whole, the Omega only for a share.
    const view = (): GameView => {
      const now = real.view();
      const items = [...now.player.life.items, { itemId: 'watch_omega', value: 700_000, roundsLeft: null, paid: 700_000, age: 0 }];
      return { ...now, hand: ['life_rolex_call', ...now.hand.slice(1)], player: { ...now.player, cash: 5_000_000, life: { ...now.player.life, items } } };
    };
    const session: GameSession = { gameId: real.gameId, lifeId: real.lifeId, view, history: () => real.history(), bankruptcies: () => 0, story: () => [], badges: () => [], answerCard: (option) => real.answerCard(option), playRound: (choices) => real.playRound(choices) };
    services.sessions.resume = async () => ({ lost: null, session });
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await user.click(await screen.findByRole('button', { name: 'See what life brings' }));
    const choices = await screen.findByRole('group', { name: /^Your choices/ });
    const adds = quoteItem(content, view(), 'watch_rolex').statusReal;
    const worth = content.items.find((item) => item.id === 'watch_rolex')?.status ?? 0;
    expect(adds).toBeLessThan(worth);
    expect(within(choices).getByText(`Status +${adds}`)).toBeTruthy();
    expect(within(choices).queryByText(`Status +${worth}`)).toBeNull();
  });
});
