// @vitest-environment jsdom
import { challengeOf, lives, textFor, weekOf } from '@ratrace/content';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Account, AccountState, ChallengeChoice, ChallengeRanking, Community } from '@/online/types';
import type { SavedGame } from '@/session/types';
import { memoryServices, renderGame } from '@/testing/render';
import { ChallengeResult, topTenth, WeeklyChallenge, WeeklyChallengeCard } from './Challenge';

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
  useRouter: () => router,
  usePathname: () => '/challenge',
}));

beforeEach(() => {
  router.push.mockClear();
  router.replace.mockClear();
});
afterEach(cleanup);

const cards = textFor('en').text.cards;
const show = (ranking: ChallengeRanking | null, choices: ChallengeChoice[] | null) => {
  const community = { challengeRanking: async () => ranking, challengeChoices: async () => choices } as unknown as Community;
  return renderGame(<ChallengeResult week="2026-W42" />, { ...memoryServices(), community: () => community });
};

describe('the weekly challenge page', () => {
  const week = challengeOf(weekOf(Date.now()), lives);
  if (!week) throw new Error('no challenge this week');
  const lifeName = textFor('en').text.lives[week.lifeId].name;
  const ruleName: Record<string, string> = { indexOnly: 'Index funds only', noLoans: 'No loans', noMoving: 'No moving', noProperty: 'No property', startInDebt: 'Start in debt' };
  const saved = async (services: ReturnType<typeof memoryServices>) => (await services.store.loadGame()) as SavedGame | null;

  /** A signed-in player and what the account says of this week's one ranked attempt. */
  function withAccount(entry: { entered: boolean; score: number | null } | null) {
    const services = memoryServices();
    const asked: unknown[] = [];
    const start = services.sessions.start.bind(services.sessions);
    services.sessions.start = (lifeId: string, options?: { ranked?: boolean; challenge?: string; replace?: string }) => {
      asked.push({ lifeId, ...options });
      // There is no server in this view test; begin the same challenge locally after remembering the request.
      return start(lifeId, options?.challenge ? { challenge: options.challenge } : undefined);
    };
    const guest: AccountState = { kind: 'guest', userId: 'u', notice: null };
    const account: Account = { state: () => guest, subscribe: () => () => {}, start: async () => {}, keepWithGoogle: async () => true, useExistingAccount: async () => true, dismissNotice: () => {} };
    const community = { challengeEntry: async () => entry } as unknown as Community;
    return { services: { ...services, account, community: () => community }, asked };
  }

  it('shows the life and rule on its own page and practises from there without an account', async () => {
    const services = memoryServices();
    const user = userEvent.setup();
    renderGame(<WeeklyChallenge />, services);
    expect(screen.getByRole('heading', { name: 'Weekly challenge' })).toBeTruthy();
    expect(screen.getByText(lifeName)).toBeTruthy();
    expect(screen.getByText(ruleName[week.rule])).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Play the challenge (one attempt)' })).toBeNull();
    expect(screen.getByText('To play the attempt that counts, sign in. You can still practise.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Practise' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/play'));
    expect(await saved(services)).toMatchObject({ lifeId: week.lifeId, challenge: week.week });
  });

  it('offers the one ranked attempt to a signed-in player who has not used it', async () => {
    const { services, asked } = withAccount({ entered: false, score: null });
    const user = userEvent.setup();
    renderGame(<WeeklyChallenge />, services);
    await user.click(await screen.findByRole('button', { name: 'Play the challenge (one attempt)' }));
    await waitFor(() => expect(asked).toEqual([{ lifeId: week.lifeId, ranked: true, challenge: week.week, replace: undefined }]));
  });

  it('shows a completed attempt and leaves practice available', async () => {
    const { services } = withAccount({ entered: true, score: 777 });
    renderGame(<WeeklyChallenge />, services);
    expect(await screen.findByText("You have played this week's challenge: 777 points.")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Play the challenge (one attempt)' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Practise' })).toBeTruthy();
  });
});

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

describe('the weekly challenge on the front door', () => {
  const draw = (community: Partial<Community> | null) => renderGame(<WeeklyChallengeCard />, { ...memoryServices(), community: () => community as Community | null });

  it('says the attempt is still to play, and how long the week has left', async () => {
    draw({ challengeEntry: async () => ({ entered: false, score: null }) });
    expect(await screen.findByText(/^To play · ends (today|in \d days?)$/)).toBeTruthy();
  });

  it('says where the player came once they have played it', async () => {
    const ranking: ChallengeRanking = { rows: [{ place: 3, userId: 'me', nickname: null, score: 300, finishedAt: 0, mine: true }] as unknown as ChallengeRanking['rows'], entrants: 41 };
    draw({ challengeEntry: async () => ({ entered: true, score: 300 }), challengeRanking: async () => ranking });
    expect(await screen.findByText('Played · #3 of 41')).toBeTruthy();
  });

  it('says how long is left to a player with no account', async () => {
    draw(null);
    expect(await screen.findByText(/^To play · /)).toBeTruthy();
  });
});

