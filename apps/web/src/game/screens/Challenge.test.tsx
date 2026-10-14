// @vitest-environment jsdom
import { textFor } from '@ratrace/content';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChallengeChoice, ChallengeRanking, Community } from '@/online/types';
import { memoryServices, renderGame } from '@/testing/render';
import { ChallengeResult, topTenth } from './Challenge';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/play',
}));

afterEach(cleanup);

const cards = textFor('en').text.cards;
const show = (ranking: ChallengeRanking | null, choices: ChallengeChoice[] | null) => {
  const community = { challengeRanking: async () => ranking, challengeChoices: async () => choices } as unknown as Community;
  return renderGame(<ChallengeResult week="2026-W42" />, { ...memoryServices(), community: () => community });
};

describe('the best tenth of a challenge', () => {
  it('is a tenth of those who took part, rounded up, and never less than the first', () => {
    expect([0, 1, 9, 10, 11, 20, 101].map(topTenth)).toEqual([1, 1, 1, 1, 2, 2, 11]);
  });
});

describe('the result of the week’s attempt', () => {
  it('says where it stands, and the three choices fewest others made, the least followed first, with all of them in a sheet', async () => {
    const user = userEvent.setup();
    show(
      { rows: [{ place: 2, userId: 'me', nickname: null, score: 900, finishedAt: 0, mine: true }], entrants: 30 },
      [
        { cardId: 'health_illness', option: 0, same: 9, answered: 10 },
        { cardId: 'tax_advisor', option: 1, same: 3, answered: 10 },
        { cardId: 'career_raise', option: 1, same: 1, answered: 4 },
        { cardId: 'late_will', option: 1, same: 5, answered: 10 },
        // A card this build does not know is left out, rather than shown with no name.
        { cardId: 'gone_card', option: 0, same: 1, answered: 100 },
      ],
    );
    expect(await screen.findByText('Place 2 of 30 · Top 10%')).toBeTruthy();
    const rare = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(rare).toEqual([
      `"${cards.career_raise.title}": you chose "${cards.career_raise.options[1].label}", like 25% of 4.`,
      `"${cards.tax_advisor.title}": you chose "${cards.tax_advisor.options[1].label}", like 30% of 10.`,
      `"${cards.late_will.title}": you chose "${cards.late_will.options[1].label}", like 50% of 10.`,
    ]);
    await user.click(screen.getByRole('button', { name: 'See all your choices (4)' }));
    const sheet = screen.getByRole('dialog', { name: "Your choices, beside everyone's" });
    expect(within(sheet).getAllByRole('listitem')).toHaveLength(4);
    expect(within(sheet).getAllByRole('listitem')[0].textContent).toContain(cards.health_illness.title);
  });

  it('shows nothing while there is nothing to say', async () => {
    const { container } = show(null, null);
    await Promise.resolve();
    expect(container.textContent).toBe('');
  });
});
