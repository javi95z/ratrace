// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { content, CONTENT_VERSION, lives } from '@ratrace/content';
import { ENGINE_VERSION } from '@ratrace/engine';
import type { Account, AccountState } from '@/online/types';
import { LocalSessions } from '@/session/local';
import { MemoryStore } from '@/session/memory';
import { RankedSessions } from '@/session/ranked';
import { GameSessions } from '@/session/sessions';
import { newProfile } from '@/session/types';
import type { RankedGame, SavedGame } from '@/session/types';
import { rankedServer } from '@/testing/rankedServer';
import { memoryServices, renderGame, setWidth } from '@/testing/render';
import { NewLife } from './NewLife';

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
  useRouter: () => router,
  usePathname: () => '/new',
}));

beforeEach(() => {
  setWidth('phone');
  router.push.mockClear();
  router.replace.mockClear();
});
afterEach(cleanup);

const saved = async (services: ReturnType<typeof memoryServices>) => (await services.store.loadGame()) as SavedGame | null;

describe('choosing a life', () => {
  it('offers the three starting lives, and shows what unlocks the others', async () => {
    renderGame(<NewLife />, memoryServices());
    expect(screen.queryByText('Weekly challenge')).toBeNull();
    const lives = screen.getAllByRole('radio');
    expect(lives).toHaveLength(16);
    expect(lives.filter((life) => !(life as HTMLButtonElement).disabled).map((life) => within(life).getByText(/Nurse|Software engineer|Civil servant/).textContent)).toEqual([
      'Nurse', 'Software engineer', 'Civil servant',
    ]);
    expect(screen.getAllByText(/To unlock/)).toHaveLength(13);
  });

  it('opens a life the player has unlocked, and marks it', async () => {
    const services = memoryServices();
    await services.store.saveProfile({ ...newProfile(), unlocked: { rider: { at: 5, gameId: 'g' } } });
    const user = userEvent.setup();
    renderGame(<NewLife />, services);
    const rider = await screen.findByRole('radio', { name: /^Delivery rider/ });
    await waitFor(() => expect((rider as HTMLButtonElement).disabled).toBe(false));
    expect(screen.getAllByText(/To unlock/)).toHaveLength(12);
    await user.click(rider);
    await user.click(screen.getByRole('button', { name: 'Start this life' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/play'));
    expect((await saved(services))?.lifeId).toBe('rider');
  });

  it('starts the life chosen and goes to it, leaving no way back onto this screen', async () => {
    const services = memoryServices();
    const user = userEvent.setup();
    renderGame(<NewLife />, services);
    await user.click(screen.getByRole('radio', { name: /^Software engineer/ }));
    await user.click(screen.getByRole('button', { name: 'Start this life' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/play'));
    // Pushed, the Back button of a phone would land here again, one tap away from ending the life.
    expect(router.push).not.toHaveBeenCalled();
    expect((await saved(services))?.lifeId).toBe('engineer');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('asks before it ends a life in progress, and ends nothing unless told to', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    while (session.view().phase === 'cards') await session.answerCard(0);
    await session.playRound({ orders: [] });
    const user = userEvent.setup();
    renderGame(<NewLife />, services);

    await user.click(await screen.findByRole('radio', { name: /^Civil servant/ }));
    await user.click(screen.getByRole('button', { name: 'Start this life' }));
    const entries = history.length;
    const ask = await screen.findByRole('dialog', { name: 'End the life you are living?' });
    expect(within(ask).getByText('Nurse, age 24. It ends here and is not recorded.')).toBeTruthy();
    // Saying yes replaces this page with the game. An entry for the question would be the one replaced, and this page would stay behind it.
    expect(history.length).toBe(entries);
    expect((history.state as { ratraceSheet?: boolean } | null)?.ratraceSheet).not.toBe(true);
    expect((await saved(services))?.lifeId).toBe('nurse');
    expect(router.replace).not.toHaveBeenCalled();

    await user.click(within(ask).getByRole('button', { name: 'Keep my life' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect((await saved(services))?.lifeId).toBe('nurse');

    await user.click(screen.getByRole('button', { name: 'Start this life' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'End it and start this one' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/play'));
    expect(await saved(services)).toMatchObject({ lifeId: 'civil_servant', log: [] });
  });

  it('does not ask when the last life is already over', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    while (!session.view().finished) {
      while (session.view().phase === 'cards') await session.answerCard(0);
      await session.playRound({ orders: [] });
    }
    const user = userEvent.setup();
    renderGame(<NewLife />, services);
    await screen.findAllByRole('radio');
    await waitFor(async () => expect((await saved(services))?.state.finished).toBe(true));
    await user.click(screen.getByRole('button', { name: 'Start this life' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/play'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect((await saved(services))?.state.finished).toBe(false);
  });
});
describe('choosing between a ranked life and a casual one', () => {
  /** Someone is signed in, and the services remember how each life was asked for. */
  function signedIn(state: AccountState = { kind: 'guest', userId: 'u', notice: null }) {
    const services = memoryServices();
    const asked: Array<{ ranked?: boolean } | undefined> = [];
    const start = services.sessions.start.bind(services.sessions);
    services.sessions.start = (lifeId: string, options?: { ranked?: boolean }) => {
      asked.push(options);
      return start(lifeId);
    };
    const account: Account = { state: () => state, subscribe: () => () => {}, start: async () => {}, keepWithGoogle: async () => true, useExistingAccount: async () => true, dismissNotice: () => {} };
    return { services: { ...services, account }, asked };
  }

  it('offers a ranked life to a player who is signed in, on by default, and says what it means', async () => {
    const { services, asked } = signedIn();
    const user = userEvent.setup();
    renderGame(<NewLife />, services);
    // Two ways to play, side by side: ranked is chosen, and each says in a few words what it is.
    const mode = await screen.findByRole('radiogroup', { name: 'How to play' });
    const ranked = within(mode).getByRole('radio', { name: /^Ranked/ });
    expect(ranked.getAttribute('aria-checked')).toBe('true');
    expect(ranked.textContent).toContain('Counts in the rankings · online');
    expect(within(mode).getByRole('radio', { name: /^Free/ }).textContent).toContain('Just for you · offline');
    await user.click(screen.getByRole('button', { name: 'Start this life' }));
    await waitFor(() => expect(asked).toEqual([{ ranked: true }]));
  });

  it('starts a casual life when the player turns it off', async () => {
    const { services, asked } = signedIn();
    const user = userEvent.setup();
    renderGame(<NewLife />, services);
    await user.click(await screen.findByRole('radio', { name: /^Free/ }));
    await user.click(screen.getByRole('button', { name: 'Start this life' }));
    await waitFor(() => expect(asked).toEqual([{ ranked: false }]));
  });

  it('offers no ranked life where nobody is signed in, and asks for none', async () => {
    const { services, asked } = signedIn({ kind: 'offline' });
    const user = userEvent.setup();
    renderGame(<NewLife />, services);
    await screen.findAllByRole('radio');
    expect(screen.queryByRole('radiogroup', { name: 'How to play' })).toBeNull();
    expect(screen.queryByText(/will not be ranked/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Start this life' }));
    await waitFor(() => expect(asked).toEqual([{ ranked: false }]));
  });

  it('says so, before the life begins, when there is an account and no connection', async () => {
    const online = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    try {
      const { services, asked } = signedIn();
      const user = userEvent.setup();
      renderGame(<NewLife />, services, 'es');
      expect(await screen.findByText('Sin conexión: esta vida no será clasificatoria.')).toBeTruthy();
      expect(screen.queryByRole('switch', { name: /Vida clasificatoria/ })).toBeNull();
      await user.click(screen.getByRole('button', { name: 'Empezar esta vida' }));
      await waitFor(() => expect(asked).toEqual([{ ranked: false }]));
    } finally {
      online.mockRestore();
    }
  });
});

describe('a ranked life in progress on another device', { timeout: 60_000 }, () => {
  const guest: AccountState = { kind: 'guest', userId: 'u', notice: null };
  const account: Account = { state: () => guest, subscribe: () => () => {}, start: async () => {}, keepWithGoogle: async () => true, useExistingAccount: async () => true, dismissNotice: () => {} };
  /** A device of the player, over a server of ranked lives several devices can share. */
  function deviceOf(server: ReturnType<typeof rankedServer>, versions = { engine: ENGINE_VERSION, content: CONTENT_VERSION }) {
    const store = new MemoryStore();
    let ids = 0;
    let clock = 0;
    const deps = { newId: () => `local-${(ids += 1)}`, newSeed: () => `seed-${ids}`, now: () => (clock += 1) };
    const sessions = new GameSessions(store, new LocalSessions(store, content, lives, deps), new RankedSessions(() => server.api, store, content, lives, versions, deps), versions);
    return { sessions, store, account, tapGuardMs: 0 };
  }
  /** The phone is a round into a ranked life as a nurse. The desk, which this test draws, knows nothing of it. */
  async function twoDevices() {
    const server = rankedServer();
    const phone = deviceOf(server);
    const there = await phone.sessions.start('nurse', { ranked: true });
    while (there.view().phase === 'cards') await there.answerCard(0);
    await there.playRound({ orders: [] });
    return { server, there, desk: deviceOf(server) };
  }

  it('is not ended by starting another: the player is asked, and nothing begins meanwhile', async () => {
    const { server, there, desk } = await twoDevices();
    const user = userEvent.setup();
    renderGame(<NewLife />, desk);
    await user.click(await screen.findByRole('button', { name: 'Start this life' }));
    const sheet = await screen.findByRole('dialog', { name: 'A ranked life in progress' });
    expect(sheet.textContent).toContain('Nurse, round 2 of 20. You have it in progress on another device, and you can have only one.');
    expect(router.replace).not.toHaveBeenCalled();
    expect(server.games.get(there.gameId)?.status).toBe('playing');
    expect(await desk.store.loadGame()).toBeNull();
    // Left as it is.
    await user.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(server.games.get(there.gameId)?.status).toBe('playing');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('is taken up on this device when the player would rather go on with it', async () => {
    const { server, there, desk } = await twoDevices();
    const user = userEvent.setup();
    renderGame(<NewLife />, desk);
    await user.click(await screen.findByRole('button', { name: 'Start this life' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'A ranked life in progress' })).getByRole('button', { name: 'Continue that life' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/play'));
    expect(((await desk.store.loadGame()) as RankedGame).gameId).toBe(there.gameId);
    expect(server.games.get(there.gameId)?.status).toBe('playing');
    expect(server.games.size).toBe(1);
  });

  it('is ended, and the new life begun, only when the player says so', async () => {
    const { server, there, desk } = await twoDevices();
    const user = userEvent.setup();
    renderGame(<NewLife />, desk);
    await user.click(screen.getByRole('radio', { name: /Software engineer/ }));
    await user.click(await screen.findByRole('button', { name: 'Start this life' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'A ranked life in progress' })).getByRole('button', { name: 'End it and start this one' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/play'));
    expect(server.games.get(there.gameId)?.status).toBe('abandoned');
    expect((await desk.store.loadGame()) as RankedGame).toMatchObject({ ranked: true, lifeId: 'engineer' });
  });

  it('cannot be taken up here when it was begun under older rules, and the sheet says so', async () => {
    const { server, there, desk } = await twoDevices();
    (server.games.get(there.gameId) as { engine_version: string }).engine_version = '0.0.1';
    const user = userEvent.setup();
    renderGame(<NewLife />, desk, 'es');
    await user.click(await screen.findByRole('button', { name: 'Empezar esta vida' }));
    const sheet = await screen.findByRole('dialog', { name: 'Una vida clasificatoria en curso' });
    expect(sheet.textContent).toContain('Empezó con otras reglas y no se puede seguir en este dispositivo.');
    expect(within(sheet).queryByRole('button', { name: 'Seguir con esa vida' })).toBeNull();
    expect(within(sheet).getByRole('button', { name: 'Terminarla y empezar esta' })).toBeTruthy();
  });

  it('says so when that life cannot be taken up just now, and keeps the question open', async () => {
    const { server, desk } = await twoDevices();
    const user = userEvent.setup();
    renderGame(<NewLife />, desk);
    await user.click(await screen.findByRole('button', { name: 'Start this life' }));
    const sheet = await screen.findByRole('dialog', { name: 'A ranked life in progress' });
    server.state.down = true;
    await user.click(within(sheet).getByRole('button', { name: 'Continue that life' }));
    expect((await within(sheet).findByRole('alert')).textContent).toBe('The server did not answer. Try again.');
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe('a life that cannot be started', () => {
  it('says so, starts nothing, and can be tried again', async () => {
    const services = memoryServices();
    let refuse = true;
    const start = services.sessions.start.bind(services.sessions);
    services.sessions.start = (lifeId: string) => (refuse ? Promise.reject(new Error('the server refused to start a ranked life: bad-request')) : start(lifeId));
    const user = userEvent.setup();
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderGame(<NewLife />, services);
    await user.click(await screen.findByRole('button', { name: 'Start this life' }));
    expect((await screen.findByRole('alert')).textContent).toBe('The life could not be started. Try again.');
    expect(router.replace).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: 'Start this life' }) as HTMLButtonElement).disabled).toBe(false);
    refuse = false;
    await user.click(screen.getByRole('button', { name: 'Start this life' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/play'));
    expect(screen.queryByRole('alert')).toBeNull();
    quiet.mockRestore();
  });
});
