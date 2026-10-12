// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameSession, SavedGame } from '@/session/types';
import { memoryServices, renderGame, setWidth } from '@/testing/render';
import { Play } from './Play';

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({
  // The real link also takes a language; a plain anchor has no use for it.
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
  useRouter: () => router,
  usePathname: () => '/play',
}));

beforeEach(() => {
  setWidth('phone');
  router.push.mockClear();
  router.replace.mockClear();
});
afterEach(cleanup);

type User = ReturnType<typeof userEvent.setup>;
const button = (name: string | RegExp) => screen.getByRole('button', { name });

/** Answers every card of the hand with its first option, reading each result on the way, and stops in the finances. */
async function answerHand(user: User) {
  for (;;) {
    const options = within(await screen.findByRole('group', { name: /^Your choices/ })).getAllByRole('button');
    await user.click(options[0]);
    expect(await screen.findByRole('heading', { name: 'What happened' })).toBeTruthy();
    const next = screen.queryByRole('button', { name: 'Next card' });
    if (next) await user.click(next);
    else {
      await user.click(button('To your finances'));
      return;
    }
  }
}

/** Plays whole rounds without the screen. */
async function playRounds(session: GameSession, rounds: number) {
  for (let i = 0; i < rounds; i++) {
    while (session.view().phase === 'cards') await session.answerCard(0);
    await session.playRound({ orders: [] });
  }
}

describe('the play screen', () => {
  it('sends a visitor with no life in progress back to the front door', async () => {
    renderGame(<Play />, memoryServices());
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(screen.queryByRole('button', { name: 'Play the round' })).toBeNull();
  });

  it('plays a round from the news to the ledger, and opens the next one', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    const user = userEvent.setup();
    renderGame(<Play />, services);

    expect(await screen.findByRole('heading', { name: 'News' })).toBeTruthy();
    expect(screen.getByText('Age 22')).toBeTruthy();
    expect(screen.getByText(/Round 1 of 20 · Madrid/)).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Rat race escape' })).toBeTruthy();

    await user.click(button('See what life brings'));
    expect(screen.getByText(/^Card 1 of \d/)).toBeTruthy();
    await answerHand(user);

    expect(screen.getByRole('tablist')).toBeTruthy();
    expect(screen.getByText('Cash after the round')).toBeTruthy();
    expect(button('No orders')).toBeTruthy();
    await user.click(button('Play the round'));

    expect(await screen.findByRole('heading', { name: 'Two years later' })).toBeTruthy();
    expect(screen.getByText('Age 22 to 24')).toBeTruthy();
    const ledger = screen.getByRole('table', { name: 'What came in and went out' });
    expect(within(ledger).getByText('Salary')).toBeTruthy();
    expect(within(ledger).getByText('Living costs')).toBeTruthy();
    // Where the net worth was and how it changed, said so it cannot be read as before and after.
    expect(screen.getByText(/^Was \$[\d,]+ · [+−]\$[\d,]+$/)).toBeTruthy();
    expect(((await services.store.loadGame()) as SavedGame).state.round).toBe(1);

    await user.click(button('Next round'));
    expect(await screen.findByRole('heading', { name: 'News' })).toBeTruthy();
    expect(screen.getByText('Age 24')).toBeTruthy();
    expect(screen.getByRole('heading', { name: "Last round's headlines" })).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('counts the orders of the round and lets one be taken back', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    while (session.view().phase === 'cards') await session.answerCard(0);
    const user = userEvent.setup();
    renderGame(<Play />, services);

    await user.click(await screen.findByRole('tab', { name: 'Lifestyle' }));
    await user.click(screen.getByRole('switch', { name: /^Study/ }));
    await user.click(button('1 order'));
    const basket = screen.getByRole('dialog', { name: "This round's orders" });
    await user.click(within(basket).getByRole('button', { name: 'Remove: Study' }));
    expect(within(basket).getByText(/Nothing yet/)).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(button('No orders')).toBeTruthy();
  });

  it('opens the profile from the portrait, and closes it again', async () => {
    const services = memoryServices();
    await services.sessions.start('engineer');
    const user = userEvent.setup();
    renderGame(<Play />, services);

    await user.click(await screen.findByRole('button', { name: 'Open your profile' }));
    const profile = screen.getByRole('dialog', { name: 'Your life' });
    for (const label of ['Job', 'Career skill', 'Finance skill', 'Income statement, per year', 'Balance sheet', 'Net worth']) {
      expect(within(profile).getByText(label), label).toBeTruthy();
    }
    expect(within(profile).getByRole('link', { name: /Leave to the home screen/ }).getAttribute('href')).toBe('/');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('carries on in the middle of a hand, on the card that was waiting', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    const hand = session.view().hand.length;
    await session.answerCard(0);
    renderGame(<Play />, services);
    expect(await screen.findByText(new RegExp(`^Card 2 of ${hand}`))).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'News' })).toBeNull();
  });

  it('ends on the score, with the way to another life', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('civil_servant');
    await playRounds(session, 19);
    const user = userEvent.setup();
    renderGame(<Play />, services);

    await user.click(await screen.findByRole('button', { name: 'See what life brings' }));
    await answerHand(user);
    await user.click(button('Play the round'));
    await user.click(await screen.findByRole('button', { name: 'See how it ended' }));

    expect(await screen.findByRole('heading', { name: 'The end' })).toBeTruthy();
    expect(screen.getByText('Age 62')).toBeTruthy();
    const [run] = await services.store.listRuns();
    expect(run.history).toHaveLength(21);
    const score = screen.getByRole('group', { name: 'Score' });
    expect(within(score).getByText(new Intl.NumberFormat('en-US').format(run.score))).toBeTruthy();
    expect(within(score).getByText('Wealth')).toBeTruthy();
    expect(within(score).getByText('Status')).toBeTruthy();
    expect(within(score).getByText(String(run.status))).toBeTruthy();
    expect(screen.getByRole('img', { name: /Your net worth through life/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Live another life' }).getAttribute('href')).toBe('/new');
    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('href')).toBe('/');

    // The page is closed on the score and opened again: the score is still there.
    expect(((await services.store.loadGame()) as SavedGame).state.finished).toBe(true);
    cleanup();
    renderGame(<Play />, memoryServices(services.store));
    expect(await screen.findByRole('heading', { name: 'The end' })).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Score' })).getByText(new Intl.NumberFormat('en-US').format(run.score))).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('ignores the second tap of a double tap: it does not answer the card that took the button\u2019s place', async () => {
    const services = memoryServices(undefined, { tapGuardMs: 400 });
    await services.sessions.start('nurse');
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await new Promise((resolve) => setTimeout(resolve, 450));
    await user.dblClick(await screen.findByRole('button', { name: 'See what life brings' }));
    expect(screen.getByText(/^Card 1 of \d/)).toBeTruthy();
    // Whatever now sits under the pointer was pressed at once, twice over, and nothing was answered.
    const options = within(screen.getByRole('group', { name: /^Your choices/ })).getAllByRole('button');
    await user.click(options[0]);
    expect(screen.queryByRole('heading', { name: 'What happened' })).toBeNull();
    expect(((await services.store.loadGame()) as SavedGame).state.answered).toBe(0);
    // A deliberate tap, a moment later, is taken.
    await new Promise((resolve) => setTimeout(resolve, 450));
    await user.click(options[0]);
    expect(await screen.findByRole('heading', { name: 'What happened' })).toBeTruthy();
  });

  it('says why the screen changed when the life was played on in another tab', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await screen.findByRole('button', { name: 'See what life brings' });

    // Another tab on the same device plays a whole round.
    const other = (await memoryServices(services.store).sessions.resume()).session as GameSession;
    await playRounds(other, 1);

    await user.click(button('See what life brings'));
    await user.click(within(screen.getByRole('group', { name: /^Your choices/ })).getAllByRole('button')[0]);
    expect((await screen.findByRole('alert')).textContent).toBe('This life was played on in another tab. Here is where it stands now.');
    expect(screen.getByText('Age 24')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'See what life brings' })).toBeTruthy();
  });

  it('offers a way out when the game itself fails, instead of a button that does nothing', async () => {
    const services = memoryServices();
    const real = await services.sessions.start('nurse');
    services.sessions.resume = async () => ({
      lost: null,
      session: { ...real, gameId: real.gameId, lifeId: real.lifeId, view: () => real.view(), history: () => real.history(), bankruptcies: () => 0, answerCard: () => Promise.reject(new Error('broken')), playRound: () => Promise.reject(new Error('broken')) },
    });
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await user.click(await screen.findByRole('button', { name: 'See what life brings' }));
    await user.click(within(screen.getByRole('group', { name: /^Your choices/ })).getAllByRole('button')[0]);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Something went wrong');
    expect(screen.getByRole('link', { name: 'New life' }).getAttribute('href')).toBe('/new');
    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('href')).toBe('/');
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });

  it('plays in Spanish', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    renderGame(<Play />, services, 'es');
    expect(await screen.findByRole('heading', { name: 'Noticias' })).toBeTruthy();
    expect(screen.getByText('22 años')).toBeTruthy();
  });
});

describe('the play screen on a wide screen', () => {
  beforeEach(() => setWidth('desk'));

  it('keeps the profile and the news in sight beside the round', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    while (session.view().phase === 'cards') await session.answerCard(0);
    const user = userEvent.setup();
    renderGame(<Play />, services);

    const life = await screen.findByRole('complementary', { name: 'Your life' });
    expect(within(life).getByText('Balance sheet')).toBeTruthy();
    const world = screen.getByRole('complementary', { name: 'News' });
    expect(within(world).getByRole('heading', { name: 'News' })).toBeTruthy();
    // The profile is already on screen, so the portrait opens nothing.
    expect(screen.queryByRole('button', { name: 'Open your profile' })).toBeNull();

    // The orders of the round sit beside the tabs instead of behind a button.
    await user.click(screen.getByRole('tab', { name: 'Lifestyle' }));
    await user.click(screen.getByRole('switch', { name: /^Study/ }));
    const orders = within(world).getByRole('list', { name: "This round's orders" });
    expect(within(orders).getByText('Study')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '1 order' })).toBeNull();
    await user.click(within(orders).getByRole('button', { name: 'Remove: Study' }));
    expect(within(world).getByText(/Nothing yet/)).toBeTruthy();
  });
});
