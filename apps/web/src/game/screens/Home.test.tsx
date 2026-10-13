// @vitest-environment jsdom
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { content, CONTENT_VERSION, lives } from '@ratrace/content';
import { ENGINE_VERSION } from '@ratrace/engine';
import type { Account, AccountLife, AccountSaves, AccountState } from '@/online/types';
import { LocalSessions } from '@/session/local';
import { MemoryStore } from '@/session/memory';
import { rankedNote, RankedSessions } from '@/session/ranked';
import type { RankedApi } from '@/session/ranked';
import { GameSessions } from '@/session/sessions';
import { rankedServer } from '@/testing/rankedServer';
import { memoryServices, renderGame } from '@/testing/render';
import { Home } from './Home';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: went, replace: vi.fn() }),
  usePathname: () => '/',
}));
const went = vi.hoisted(() => vi.fn());

afterEach(() => {
  cleanup();
  went.mockClear();
});

/** An account holding a different life, which remembers what it was asked and does it. */
function accountWith(life: AccountLife | null, take: () => Promise<void> = async () => {}) {
  let offered = life;
  const watching = new Set<() => void>();
  const asked: string[] = [];
  const offer = (next: AccountLife | null) => {
    offered = next;
    for (const listener of watching) listener();
  };
  const gone = () => offer(null);
  const saves: AccountSaves = {
    status: () => 'saved',
    offer: () => offered,
    subscribe: (listener) => (watching.add(listener), () => watching.delete(listener)),
    onDeviceChanged: () => () => {},
    takeOffer: async () => {
      asked.push('take');
      await take();
      gone();
      return true;
    },
    declineOffer: async () => {
      asked.push('decline');
      gone();
    },
  };
  return { saves, asked, offer };
}
const elsewhere: AccountLife = { gameId: 'g-9', lifeId: 'engineer', round: 4, cityId: 'madrid' };

describe('the front door', () => {
  it('offers a new life to someone new, and says where it will be kept', async () => {
    renderGame(<Home />, memoryServices());
    expect((await screen.findByRole('link', { name: 'New life' })).getAttribute('href')).toBe('/new');
    expect(screen.queryByRole('link', { name: /Continue your life/ })).toBeNull();
    expect(screen.getByText('Your life is saved on this device after every step.')).toBeTruthy();
  });

  it('keeps the switches a tap away, behind the settings, and the language in sight', async () => {
    const user = userEvent.setup();
    renderGame(<Home />, memoryServices());
    await screen.findByRole('link', { name: 'New life' });
    expect(within(screen.getByRole('group', { name: 'Language' })).getAllByRole('link').map((link) => link.textContent)).toEqual(['English', 'Español', 'Русский']);
    expect(screen.queryAllByRole('switch')).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const sheet = screen.getByRole('dialog', { name: 'Settings' });
    expect(within(sheet).getAllByRole('switch').map((toggle) => toggle.getAttribute('aria-checked'))).toEqual(['true', 'false', 'true']);
    // What is switched there is switched for good.
    await user.click(within(sheet).getByRole('switch', { name: /^Sound/ }));
    expect(within(sheet).getByRole('switch', { name: /^Sound/ }).getAttribute('aria-checked')).toBe('false');
  });

  it('leads to the collection and to the records', async () => {
    renderGame(<Home />, memoryServices());
    expect((await screen.findByRole('link', { name: 'Collection' })).getAttribute('href')).toBe('/collection');
    expect(screen.getByRole('link', { name: 'Records' }).getAttribute('href')).toBe('/records');
  });

  it('leads to the rankings where someone is signed in, and shows no way to them where nobody is', async () => {
    renderGame(<Home />, memoryServices());
    await screen.findByRole('link', { name: 'Records' });
    expect(screen.queryByRole('link', { name: 'Rankings' })).toBeNull();
    cleanup();
    const guest: AccountState = { kind: 'guest', userId: 'u', notice: null };
    const account: Account = { state: () => guest, subscribe: () => () => {}, start: async () => {}, keepWithGoogle: async () => true, useExistingAccount: async () => true, dismissNotice: () => {} };
    renderGame(<Home />, { ...memoryServices(), account });
    expect((await screen.findByRole('link', { name: 'Rankings' })).getAttribute('href')).toBe('/rankings');
  });

  it('shows the ranked life the device has only a note of, once there is someone signed in to ask the server for it', async () => {
    // The page opens before anyone is signed in. A note the account left here, never opened, has nothing to show yet.
    const server = rankedServer();
    const versions = { engine: ENGINE_VERSION, content: CONTENT_VERSION };
    const deps = { newId: () => 'local-1', newSeed: () => 'seed-1', now: () => 1 };
    const elsewhere = new MemoryStore();
    const there = await new GameSessions(elsewhere, new LocalSessions(elsewhere, content, lives, deps), new RankedSessions(() => server.api, elsewhere, content, lives, versions, deps), versions).start('nurse', { ranked: true });
    const store = new MemoryStore();
    await store.saveGame(rankedNote({ gameId: there.gameId, lifeId: 'nurse', engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION }));
    let api: RankedApi | null = null;
    let state: AccountState = { kind: 'offline' };
    const watching = new Set<() => void>();
    const account: Account = { state: () => state, subscribe: (listener) => (watching.add(listener), () => watching.delete(listener)), start: async () => {}, keepWithGoogle: async () => true, useExistingAccount: async () => true, dismissNotice: () => {} };
    const sessions = new GameSessions(store, new LocalSessions(store, content, lives, deps), new RankedSessions(() => api, store, content, lives, versions, deps), versions);
    renderGame(<Home />, { sessions, store, account, tapGuardMs: 0 });
    await screen.findByRole('link', { name: 'New life' });
    expect(screen.queryByRole('link', { name: /Continue your life/ })).toBeNull();
    // Sign-in lands, a moment after the page opened.
    api = server.api;
    state = { kind: 'guest', userId: 'u', notice: null };
    act(() => watching.forEach((listener) => listener()));
    expect(await screen.findByRole('link', { name: /Continue your life/ })).toBeTruthy();
    expect(server.games.get(there.gameId)?.status).toBe('playing');
  });

  it('offers the life in progress first, with who and where', async () => {
    const services = memoryServices();
    await services.sessions.start('engineer');
    renderGame(<Home />, services);
    const carry = await screen.findByRole('link', { name: /Continue your life/ });
    expect(carry.getAttribute('href')).toBe('/play');
    expect(carry.textContent).toContain('Software engineer · age 22 · Madrid');
    expect(screen.getByRole('link', { name: 'New life' })).toBeTruthy();
  });

  it('offers a look at the life that just ended, and nothing to continue', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    while (!session.view().finished) {
      while (session.view().phase === 'cards') await session.answerCard(0);
      await session.playRound({ orders: [] });
    }
    renderGame(<Home />, services);
    expect((await screen.findByRole('link', { name: 'See how your last life ended' })).getAttribute('href')).toBe('/play');
    expect(screen.queryByRole('link', { name: /Continue your life/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'New life' })).toBeTruthy();
  });

  it('says so plainly when the browser is not saving, instead of promising that it is', async () => {
    renderGame(<Home />, memoryServices(new MemoryStore(), { savingOff: true }));
    expect((await screen.findByRole('alert')).textContent).toContain('This browser is not saving right now');
    expect(screen.queryByText(/saved on this device/)).toBeNull();
  });

  it('explains a saved life that could not be opened', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    await services.store.saveGame({ ...((await services.store.loadGame()) as never as object), contentVersion: '0.0.1' } as never);
    renderGame(<Home />, services);
    expect((await screen.findByRole('status')).textContent).toContain('played under older rules');
  });

  it('tells apart a saved life from a newer version of the game', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    await services.store.saveGame({ ...((await services.store.loadGame()) as never as object), format: 2 } as never);
    renderGame(<Home />, services);
    expect((await screen.findByRole('status')).textContent).toContain('newer version of the game');
  });

  it('offers nothing from the account when it holds no other life', async () => {
    renderGame(<Home />, memoryServices());
    await screen.findByRole('link', { name: 'New life' });
    expect(screen.queryByRole('button', { name: /life in your account/ })).toBeNull();
  });

  it('offers the life waiting in the account, and asks before it ends the one on this device', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    // Taking it puts the account's life on the device, as the real thing does.
    const other = memoryServices();
    const { saves, asked } = accountWith(elsewhere, async () => {
      await other.sessions.start('engineer');
      await services.store.saveGame((await other.store.loadGame()) as never);
    });
    const user = userEvent.setup();
    renderGame(<Home />, { ...services, saves });
    const offer = await screen.findByRole('button', { name: /Continue the life in your account/ });
    expect(offer.textContent).toContain('Software engineer · age 30 · Madrid');
    // Nothing has been asked of the account yet, and the life on this device is still the one to continue.
    expect(asked).toEqual([]);
    expect(screen.getByRole('link', { name: /Continue your life/ }).textContent).toContain('Nurse');

    await user.click(offer);
    const sheet = screen.getByRole('dialog', { name: 'A life in your account' });
    expect(sheet.textContent).toContain('Continuing it ends the life you have on this device: Nurse, age 22.');
    await user.click(within(sheet).getByRole('button', { name: 'Continue that life' }));
    await waitFor(() => expect(went).toHaveBeenCalledWith('/play'));
    expect(asked).toEqual(['take']);
    // The game on screen is the one that was taken.
    expect(screen.getByRole('link', { name: /Continue your life/ }).textContent).toContain('Software engineer');
    expect(screen.queryByRole('button', { name: /Continue the life in your account/ })).toBeNull();
  });

  it('lets the player end the life in the account instead, and keeps the one on this device', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    const { saves, asked, offer } = accountWith(elsewhere);
    const user = userEvent.setup();
    renderGame(<Home />, { ...services, saves });
    await user.click(await screen.findByRole('button', { name: /Continue the life in your account/ }));
    await user.click(screen.getByRole('button', { name: 'End that life' }));
    expect(asked).toEqual(['decline']);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByRole('button', { name: /Continue the life in your account/ })).toBeNull();
    expect(screen.getByRole('link', { name: /Continue your life/ }).textContent).toContain('Nurse');
    expect(went).not.toHaveBeenCalled();
    // Another life offered later is offered: the question does not ask itself.
    act(() => offer({ ...elsewhere, gameId: 'g-10', round: 7 }));
    expect(screen.getByRole('button', { name: /Continue the life in your account/ }).textContent).toContain('age 36');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not open the question by itself for another life, after the one it was asked about went away under it', async () => {
    const { saves, offer } = accountWith(elsewhere);
    const user = userEvent.setup();
    renderGame(<Home />, { ...memoryServices(), saves });
    await user.click(await screen.findByRole('button', { name: /Continue the life in your account/ }));
    expect(screen.getByRole('dialog', { name: 'A life in your account' })).toBeTruthy();
    // The other device ends that life while the sheet is open.
    act(() => offer(null));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // Later the account brings another. It is offered; "End that life" is not put in front of anyone unasked.
    act(() => offer({ ...elsewhere, gameId: 'g-11', lifeId: 'nurse' }));
    expect(screen.getByRole('button', { name: /Continue the life in your account/ }).textContent).toContain('Nurse');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the life the account brings after the page has opened', async () => {
    const { saves, offer } = accountWith(null);
    renderGame(<Home />, { ...memoryServices(), saves });
    await screen.findByRole('link', { name: 'New life' });
    expect(screen.queryByRole('button', { name: /Continue the life in your account/ })).toBeNull();
    act(() => offer(elsewhere));
    expect(screen.getByRole('button', { name: /Continue the life in your account/ })).toBeTruthy();
  });

  it('warns of nothing when no life is being lived on this device', async () => {
    const { saves } = accountWith(elsewhere);
    const user = userEvent.setup();
    renderGame(<Home />, { ...memoryServices(), saves }, 'es');
    await user.click(await screen.findByRole('button', { name: /Continuar la vida de tu cuenta/ }));
    const sheet = screen.getByRole('dialog', { name: 'Una vida en tu cuenta' });
    expect(sheet.textContent).toContain('Ingeniero de software, 30 años, en Madrid. La dejaste en otro dispositivo.');
    expect(sheet.textContent).not.toContain('termina la vida');
  });
});
