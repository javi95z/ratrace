// @vitest-environment jsdom
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { content, CONTENT_VERSION, lives, textFor } from '@ratrace/content';
import { ENGINE_VERSION, previewCard } from '@ratrace/engine';
import { useGame } from '@/game/context';
import type { Community } from '@/online/types';
import { LocalSessions } from '@/session/local';
import { MemoryStore } from '@/session/memory';
import { RankedSessions } from '@/session/ranked';
import { GameSessions } from '@/session/sessions';
import type { GameSession, SavedGame } from '@/session/types';
import { rankedServer } from '@/testing/rankedServer';
import { memoryServices, renderGame, setWidth } from '@/testing/render';
import { COMPARE_MIN } from './End';
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
  it('can advance a safe action and choose cards with the keyboard alone', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await screen.findByRole('heading', { name: 'News' });
    await user.keyboard('{Control>}{Enter}{/Control}');
    const choices = await screen.findByRole('group', { name: /^Your choices/ });
    const enabled = within(choices).getAllByRole('button').filter((choice) => !(choice as HTMLButtonElement).disabled);
    await waitFor(() => expect(enabled).toContain(document.activeElement));
    if (enabled.length > 1) {
      const index = Number((enabled[1] as HTMLElement).dataset.cardOption);
      await user.keyboard(String(index + 1));
      expect(document.activeElement).toBe(enabled[1]);
      enabled[0].focus();
      await user.keyboard('{ArrowDown}');
      expect(document.activeElement).toBe(enabled[1]);
    }
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('heading', { name: 'What happened' })).toBeTruthy();
  });

  it('does not repeat the primary action while a key is held down', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    renderGame(<Play />, services);
    await screen.findByRole('heading', { name: 'News' });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, repeat: true, bubbles: true }));
    expect(screen.queryByRole('group', { name: /^Your choices/ })).toBeNull();
    expect(screen.getByRole('heading', { name: 'News' })).toBeTruthy();
  });

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
    // Every headline is a clipping that says what it is about, in a word and a picture.
    const clippings = within(screen.getByRole('region', { name: 'News' })).getAllByRole('listitem');
    const news = ((await services.store.loadGame()) as SavedGame).state.timeline[0].news;
    expect(news.length).toBeGreaterThan(0);
    const SUBJECT = { regime: 'Economy', crypto: 'Crypto', rates: 'Interest rates', inflation: 'Inflation', property: 'Housing' };
    expect(clippings.map((clipping) => clipping.querySelector('[data-topic]')?.textContent)).toEqual(news.map((headline) => SUBJECT[headline.topic]));
    for (const clipping of clippings) expect(clipping.querySelector('img')).not.toBeNull();
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
    // How last round's headlines turned out is not told: working that out is the player's.
    expect(screen.queryByRole('heading', { name: "Last round's headlines" })).toBeNull();
    expect(screen.queryByText(/seven in ten/)).toBeNull();
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
    for (const label of ['Work', 'Money sense', 'Focus this round', 'Income statement, per year', 'Balance sheet', 'Net worth']) {
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
    // The score counts up as it is shown; it is read out as it ends.
    expect(within(score).getByLabelText(new Intl.NumberFormat('en-US').format(run.score))).toBeTruthy();
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

    // The picture to share is shown to someone else: it speaks of the life, not to the player.
    const written: string[] = [];
    const pen = { fillRect() {}, drawImage() {}, measureText: () => ({ width: 1 }), fillText: (line: string) => written.push(line) };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => pen as never);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((done: BlobCallback) => done(new Blob(['png'], { type: 'image/png' })));
    URL.createObjectURL = vi.fn(() => 'blob:picture');
    URL.revokeObjectURL = vi.fn();
    // No sprite arrives in a test: each is left out, and the rest is drawn.
    vi.stubGlobal('Image', class { onerror: (() => void) | null = null; set src(_: string) { queueMicrotask(() => this.onerror?.()); } });
    await user.click(button('Share this life'));
    await screen.findByRole('img', { name: /^Civil servant: score/ });
    expect(written).toContain(run.escapedAtRound === null ? 'Never left the rat race' : `Out of the rat race at ${22 + run.escapedAtRound * 2}`);
    expect(written.some((line) => /\byou\b/i.test(line))).toBe(false);
    await user.keyboard('{Escape}');
    vi.unstubAllGlobals();
    vi.restoreAllMocks();

    // The page is closed on the score and opened again: the score is still there.
    expect(((await services.store.loadGame()) as SavedGame).state.finished).toBe(true);
    cleanup();
    renderGame(<Play />, memoryServices(services.store));
    expect(await screen.findByRole('heading', { name: 'The end' })).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Score' })).getByLabelText(new Intl.NumberFormat('en-US').format(run.score))).toBeTruthy();
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
    // On a card the choices come first: a tip must never push them off a small screen.
    const choices = screen.getByRole('group', { name: /^Your choices/ });
    expect(choices.compareDocumentPosition(screen.getByRole('note', { name: 'Guide' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Left unread, a tip is still there the next time its stage comes round.
    const options = within(choices).getAllByRole('button');
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
    // The button is gone and the keyboard is not left nowhere: the stage has the focus again.
    expect(document.activeElement).toBe(screen.getByRole('main'));
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
        gameId: real.gameId, lifeId: real.lifeId, view: () => real.view(), history: () => real.history(), bankruptcies: () => 0, story: () => [], badges: () => [],
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
    const real = await services.sessions.start('nurse');
    // A round that earns a badge and unlocks a life, whatever is played.
    services.sessions.resume = async () => ({
      lost: null,
      session: {
        gameId: real.gameId, lifeId: real.lifeId, view: () => real.view(), history: () => real.history(), bankruptcies: () => 0, story: () => [], badges: () => ['millionaire'],
        answerCard: (option: number) => real.answerCard(option),
        playRound: async (choices) => ({ ...(await real.playRound(choices)), earned: ['millionaire'], unlocked: ['heir'] }),
      },
    });
    const user = userEvent.setup();
    renderGame(<Play />, services);
    await user.click(await screen.findByRole('button', { name: 'See what life brings' }));
    await answerHand(user);
    await user.click(button('Play the round'));
    await screen.findByRole('heading', { name: 'Two years later' });
    const news = screen.getAllByRole('status').map((note) => note.textContent ?? '');
    expect(news.some((text) => text.includes('Badge earned') && text.includes('Millionaire') && text.includes('Be worth a million'))).toBe(true);
    expect(news.some((text) => text.includes('New life unlocked') && text.includes('Heir'))).toBe(true);
    // Gone with the ledger: the next round opens without them.
    await user.click(button('Next round'));
    await screen.findByRole('button', { name: 'See what life brings' });
    expect(screen.queryByText('Badge earned')).toBeNull();
  });

  it('says why a choice is locked in full strength, and dims only the choice', async () => {
    const services = memoryServices();
    // Played on, without the screen, to a card with a choice that is locked.
    let session = await services.sessions.start('nurse');
    const waiting = () => {
      const view = session.view();
      return view.phase === 'cards' ? previewCard(content, view, view.hand[view.answered]) : [];
    };
    for (let tries = 0; !waiting().some((option) => option.lock !== null); tries++) {
      if (tries > 2000) throw new Error('no life met a locked choice');
      if (session.view().finished) session = await services.sessions.start('nurse');
      else if (session.view().phase === 'cards') await session.answerCard(waiting().findIndex((option) => option.available));
      else await session.playRound({ orders: [] });
    }
    const at = waiting().findIndex((option) => option.lock !== null);
    const lock = waiting()[at].lock as NonNullable<ReturnType<typeof waiting>[number]['lock']>;
    const user = userEvent.setup();
    renderGame(<Play />, memoryServices(services.store));
    // A hand not begun opens on the news; one begun opens on the card that waits.
    await screen.findByRole('heading', { level: 1 });
    const begin = screen.queryByRole('button', { name: 'See what life brings' });
    if (begin) await user.click(begin);

    const locked = within(await screen.findByRole('group', { name: /^Your choices/ })).getAllByRole('button')[at] as HTMLButtonElement;
    expect(locked.disabled).toBe(true);
    const dimmed = (node: Element) => node.closest('[class*="opacity-"]') !== null;
    const reason = within(locked).getByText(textFor('en').text.optionLocks[lock]);
    // The reason is what the player needs to read: nothing on the way up to it takes its strength away.
    expect(dimmed(reason)).toBe(false);
    // What cannot be chosen is dimmed.
    expect(dimmed(within(locked).getByText('Locked').previousElementSibling as Element)).toBe(true);
  });

  it('gives one tip a visit, and hands the focus back to the stage when a tip is read', async () => {
    const services = memoryServices();
    // The stage tips are read; the ones that wait for the second round are not.
    await services.store.saveProfile({ ...(await services.store.loadProfile()), guide: { seen: ['news', 'cards', 'finance', 'ledger', 'ratRace'], off: false } });
    const session = await services.sessions.start('nurse');
    await playRounds(session, 1);
    while (session.view().phase === 'cards') await session.answerCard(0);
    const user = userEvent.setup();
    renderGame(<Play />, services);
    const tip = await screen.findByRole('note', { name: 'Guide' });
    expect(tip.textContent).toContain('Cash earns nothing');
    await user.click(within(tip).getByRole('button', { name: 'Got it' }));
    // The next tip in line waits for the next visit: nothing takes the place of the one just read.
    expect(screen.queryByRole('note', { name: 'Guide' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('main'));
    await waitFor(async () => expect((await services.store.loadProfile()).guide.seen).toContain('invest'));
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
    expect((await screen.findByRole('alert')).textContent).toBe('This life was played on in another tab or on another device. Here is where it stands now.');
    expect(screen.getByText('Age 24')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'See what life brings' })).toBeTruthy();
  });

  it('offers a way out when the game itself fails, instead of a button that does nothing', async () => {
    const services = memoryServices();
    const real = await services.sessions.start('nurse');
    services.sessions.resume = async () => ({
      lost: null,
      session: { ...real, gameId: real.gameId, lifeId: real.lifeId, view: () => real.view(), history: () => real.history(), bankruptcies: () => 0, story: () => [], badges: () => [], answerCard: () => Promise.reject(new Error('broken')), playRound: () => Promise.reject(new Error('broken')) },
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

describe('a ranked life on the play screen', { timeout: 60_000 }, () => {
  /** The game over sessions of both kinds, a server of ranked lives the test holds, and a button that starts a ranked life. */
  function rankedGame() {
    const server = rankedServer();
    const store = new MemoryStore();
    let ids = 0;
    let clock = 0;
    const deps = { newId: () => `local-${(ids += 1)}`, newSeed: () => `seed-${ids}`, now: () => (clock += 1) };
    const versions = { engine: ENGINE_VERSION, content: CONTENT_VERSION };
    const sessions = new GameSessions(store, new LocalSessions(store, content, lives, deps), new RankedSessions(() => server.api, store, content, lives, versions, deps), versions);
    function Begin() {
      const start = useGame((s) => s.start);
      const status = useGame((s) => s.status);
      return status === 'playing' ? null : (
        <button type="button" onClick={() => void start('nurse', { ranked: true })}>
          begin ranked
        </button>
      );
    }
    return { server, services: { sessions, store, tapGuardMs: 0 }, Begin };
  }

  it('says so when the server did not answer a step, plays nothing, and takes the step when asked again', async () => {
    const { server, services, Begin } = rankedGame();
    const user = userEvent.setup();
    renderGame(<><Begin /><Play /></>, services);
    await user.click(await screen.findByRole('button', { name: 'begin ranked' }));
    await user.click(await screen.findByRole('button', { name: 'See what life brings' }));
    server.state.down = true;
    await user.click(within(screen.getByRole('group', { name: /^Your choices/ })).getAllByRole('button')[0]);
    expect((await screen.findByRole('alert')).textContent).toBe('The server did not answer. Try again.');
    expect(screen.queryByRole('heading', { name: 'What happened' })).toBeNull();
    server.state.down = false;
    await user.click(within(screen.getByRole('group', { name: /^Your choices/ })).getAllByRole('button')[0]);
    expect(await screen.findByRole('heading', { name: 'What happened' })).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('says so when a life asked for as ranked had to begin on the device', async () => {
    const { server, services, Begin } = rankedGame();
    server.state.down = true;
    const user = userEvent.setup();
    renderGame(<><Begin /><Play /></>, services, 'es');
    await user.click(await screen.findByRole('button', { name: 'begin ranked' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Ahora mismo no se ha podido empezar una vida clasificatoria, así que esta no lo es. Se guarda en este dispositivo.');
  });

  it('takes each of its notices away once it has had time to be read, and does not show it again', async () => {
    // Time is the test's to move, and goes on by itself meanwhile, so that everything else happens as it does.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      // A step that did not get through.
      const first = rankedGame();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderGame(<><first.Begin /><Play /></>, first.services);
      await user.click(await screen.findByRole('button', { name: 'begin ranked' }));
      await user.click(await screen.findByRole('button', { name: 'See what life brings' }));
      first.server.state.down = true;
      await user.click(within(screen.getByRole('group', { name: /^Your choices/ })).getAllByRole('button')[0]);
      await screen.findByRole('alert');
      await act(() => vi.advanceTimersByTimeAsync(6_000));
      expect(screen.queryByRole('alert')).toBeNull();
      cleanup();

      // A life that had to begin on the device.
      const second = rankedGame();
      second.server.state.down = true;
      renderGame(<><second.Begin /><Play /></>, second.services);
      await user.click(await screen.findByRole('button', { name: 'begin ranked' }));
      await screen.findByRole('alert');
      await act(() => vi.advanceTimersByTimeAsync(6_000));
      expect(screen.queryByRole('alert')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('says at the end of a ranked life that it is in the rankings, and leads to them; a casual life says nothing of them', async () => {
    const ranked = rankedGame();
    await playRounds(await ranked.services.sessions.start('nurse', { ranked: true }), content.rounds);
    renderGame(<Play />, ranked.services);
    expect(await screen.findByRole('heading', { name: 'The end' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'This life is ranked: see the rankings' }).getAttribute('href')).toBe('/rankings');
    cleanup();

    const casual = rankedGame();
    await playRounds(await casual.services.sessions.start('nurse'), content.rounds);
    renderGame(<Play />, casual.services);
    expect(await screen.findByRole('heading', { name: 'The end' })).toBeTruthy();
    expect(screen.queryByText(/in the rankings/)).toBeNull();
    expect(screen.queryByRole('link', { name: /see the rankings/ })).toBeNull();
  });
});

describe('the end of a life, beside the lives of others', () => {
  /** A community that answers the comparison as told, and nothing else. */
  const others = (answer: { below: number; total: number } | null, asked: unknown[]): Community => ({
    me: async () => null,
    rename: async () => 'failed',
    ranking: async () => null,
    friends: async () => null,
    compare: async (query) => (asked.push(query), answer),
    run: async () => null,
    follow: async () => 'failed',
    unfollow: async () => false,
    challengeEntry: async () => null,
    challengeRanking: async () => null,
    challengeChoices: async () => null,
  });
  const ended = async (answer: { below: number; total: number } | null) => {
    const asked: unknown[] = [];
    const services = { ...memoryServices(), community: () => others(answer, asked) };
    await playRounds(await services.sessions.start('nurse'), content.rounds);
    renderGame(<Play />, services);
    expect(await screen.findByRole('heading', { name: 'The end' })).toBeTruthy();
    const [run] = await services.store.listRuns();
    return { asked, run };
  };

  it('says how many of the lives others played from the same start scored less', async () => {
    const { asked, run } = await ended({ below: 31, total: 40 });
    const score = screen.getByRole('group', { name: 'Score' });
    expect(await within(score).findByText('Better than 77% of the Nurse lives others have played (40).')).toBeTruthy();
    // Asked of this life and its score, however many times the screen is drawn.
    expect(asked.length).toBeGreaterThan(0);
    for (const query of asked) expect(query).toEqual({ lifeId: 'nurse', score: run.score });
  });

  it('says nothing with too few to compare with, or with nobody to ask', async () => {
    await ended({ below: 3, total: COMPARE_MIN - 1 });
    // The answer has come and gone: there is still nothing to say.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText(/lives others have played/)).toBeNull();
    cleanup();
    await ended(null);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText(/lives others have played/)).toBeNull();
  });
});
