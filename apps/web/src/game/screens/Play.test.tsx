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
    // One top heading says whose life this is; the stage on screen is a named region that takes the focus.
    expect(screen.getByRole('heading', { level: 1, name: 'Nurse, age 22' })).toBeTruthy();
    const stage = () => screen.getByRole('main');
    expect(stage().getAttribute('aria-label')).toBe('News');
    expect(document.activeElement).toBe(stage());
    expect(screen.getByRole('progressbar', { name: 'Rat race escape' })).toBeTruthy();

    await user.click(button('See what life brings'));
    expect(screen.getByText(/^Card 1 of \d/)).toBeTruthy();
    expect(stage().getAttribute('aria-label')).toMatch(/^Card 1 of \d/);
    expect(document.activeElement).toBe(stage());
    await answerHand(user);

    // The tabs are named for what they are, and each panel for its tab.
    expect(screen.getByRole('tablist', { name: 'Your finances' })).toBeTruthy();
    expect(screen.getByRole('tabpanel', { name: 'Portfolio' })).toBeTruthy();
    expect(stage().getAttribute('aria-label')).toBe('Your finances');
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

    // A first life lived to the end: its badges are shown, and the life it unlocked.
    const earned = screen.getByRole('region', { name: 'Badges of this life' });
    expect(run.badges.length).toBeGreaterThan(0);
    expect(within(earned).getAllByRole('listitem')).toHaveLength(run.badges.length);
    expect(within(earned).getAllByText('New').length).toBe(run.badges.length);
    expect(screen.getByText('New life unlocked: Delivery rider')).toBeTruthy();
    // Nothing to beat in a first life, so no personal best is claimed.
    expect(screen.queryByText('New best score')).toBeNull();
    expect(screen.getByRole('link', { name: 'See your collection' }).getAttribute('href')).toBe('/collection');

    // The page is closed on the score and opened again: the score is still there.
    expect(((await services.store.loadGame()) as SavedGame).state.finished).toBe(true);
    cleanup();
    renderGame(<Play />, memoryServices(services.store));
    expect(await screen.findByRole('heading', { name: 'The end' })).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Score' })).getByText(new Intl.NumberFormat('en-US').format(run.score))).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('guides a first life: one tip a stage, each read once, and remembered', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    const user = userEvent.setup();
    renderGame(<Play />, services);

    const tip = await screen.findByRole('note', { name: 'Guide' });
    expect(tip.textContent).toContain('Every round opens with the news');
    await user.click(within(tip).getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('note', { name: 'Guide' })).toBeNull();
    await waitFor(async () => expect((await services.store.loadProfile()).guide).toEqual({ seen: ['news'], off: false }));

    await user.click(button('See what life brings'));
    expect((await screen.findByRole('note', { name: 'Guide' })).textContent).toContain('Life deals you a few cards');
    // Left unread, a tip is still there the next time its stage comes round.
    const options = within(screen.getByRole('group', { name: /^Your choices/ })).getAllByRole('button');
    await user.click(options[0]);
    await screen.findByRole('heading', { name: 'What happened' });
    expect(screen.queryByRole('note', { name: 'Guide' })).toBeNull();

    // Opened again later on the next card: what was read stays read, and what was not is offered again.
    cleanup();
    renderGame(<Play />, memoryServices(services.store));
    expect((await screen.findByRole('note', { name: 'Guide' })).textContent).toContain('Life deals you a few cards');
    expect((await services.store.loadProfile()).guide.seen).toEqual(['news']);
  });

  it('turns the guide off for good when asked to', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await user.click(within(await screen.findByRole('note', { name: 'Guide' })).getByRole('button', { name: 'Skip the guide' }));
    expect(screen.queryByRole('note', { name: 'Guide' })).toBeNull();
    await user.click(button('See what life brings'));
    expect(screen.getByText(/^Card 1 of \d/)).toBeTruthy();
    expect(screen.queryByRole('note', { name: 'Guide' })).toBeNull();
    await waitFor(async () => expect((await services.store.loadProfile()).guide.off).toBe(true));
  });

  it('does not guide someone who has already lived a life', async () => {
    const services = memoryServices();
    await playRounds(await services.sessions.start('nurse'), 20);
    await services.sessions.start('engineer');
    renderGame(<Play />, services);
    await screen.findByRole('button', { name: 'See what life brings' });
    // Give the device time to answer about past lives: the guide waits for that before it speaks.
    await waitFor(async () => expect(await services.store.listRuns()).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole('note', { name: 'Guide' })).toBeNull();
  });

  it('says nothing until the device has said whether a life was ever finished', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    // The device never answers about past lives: for all the page knows, this is a veteran.
    services.store.listRuns = () => new Promise(() => {});
    renderGame(<Play />, services);
    await screen.findByRole('button', { name: 'See what life brings' });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(screen.queryByRole('note', { name: 'Guide' })).toBeNull();
  });

  it('announces a life unlocked by a step that earned no badge', async () => {
    const services = memoryServices();
    const real = await services.sessions.start('nurse');
    services.sessions.resume = async () => ({
      lost: null,
      session: {
        gameId: real.gameId, lifeId: real.lifeId, view: () => real.view(), history: () => real.history(), bankruptcies: () => 0, badges: () => [],
        answerCard: async (option: number) => ({ ...(await real.answerCard(option)), earned: [], unlocked: ['heir'] }),
        playRound: (choices) => real.playRound(choices),
      },
    });
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await user.click(await screen.findByRole('button', { name: 'See what life brings' }));
    await user.click(within(screen.getByRole('group', { name: /^Your choices/ })).getAllByRole('button')[0]);
    await screen.findByRole('heading', { name: 'What happened' });
    const news = screen.getAllByRole('status').map((note) => note.textContent ?? '');
    expect(news.some((text) => text.includes('New life unlocked') && text.includes('Heir'))).toBe(true);
    expect(news.some((text) => text.includes('Badge earned'))).toBe(false);
  });

  it('celebrates a badge on the ledger of the round that earned it, and the life a round unlocked', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    await playRounds(session, 19);
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await user.click(await screen.findByRole('button', { name: 'See what life brings' }));
    await answerHand(user);
    await user.click(button('Play the round'));
    await screen.findByRole('heading', { name: 'Two years later' });
    // The last round of a first life: never on the card (if it was not), and the rider unlocked.
    const news = screen.getAllByRole('status').map((note) => note.textContent ?? '');
    expect(news.some((text) => text.includes('New life unlocked') && text.includes('Delivery rider'))).toBe(true);
    const [run] = await services.store.listRuns();
    const profile = await services.store.loadProfile();
    for (const id of ['no_credit_card'].filter((badge) => run.badges.includes(badge) && profile.badges[badge].at === run.finishedAt)) {
      expect(news.some((text) => text.includes('Badge earned') && text.includes('Never on the card')), id).toBe(true);
    }
  });

  it('marks a second life that beats the first', async () => {
    const services = memoryServices();
    // A first life that went badly: lavish on a nurse's pay.
    const poor = await services.sessions.start('nurse');
    for (let i = 0; i < 20; i++) {
      while (poor.view().phase === 'cards') await poor.answerCard(0);
      await poor.playRound({ orders: [{ type: 'setLifestyle', tier: 3 }] });
    }
    const better = await services.sessions.start('nurse');
    await playRounds(better, 20);
    const runs = await services.store.listRuns();
    expect(runs[0].score).toBeGreaterThan(runs[1].score);
    renderGame(<Play />, services);
    expect(await screen.findByRole('heading', { name: 'The end' })).toBeTruthy();
    expect(await screen.findByText('New best score')).toBeTruthy();
    expect(screen.getByText('Your richest life yet')).toBeTruthy();
    // The rider was unlocked by the first life, not by this one.
    expect(screen.queryByText(/New life unlocked/)).toBeNull();
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
      session: { ...real, gameId: real.gameId, lifeId: real.lifeId, view: () => real.view(), history: () => real.history(), bankruptcies: () => 0, badges: () => [], answerCard: () => Promise.reject(new Error('broken')), playRound: () => Promise.reject(new Error('broken')) },
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
