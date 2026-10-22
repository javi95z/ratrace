// @vitest-environment jsdom
import { content, CONTENT_VERSION, lives } from '@ratrace/content';
import { LocalSessions } from '@ratrace/core/session/local';
import { MemoryStore } from '@ratrace/core/session/memory';
import type { GameSession, SavedGame } from '@ratrace/core/session/types';
import { ENGINE_VERSION } from '@ratrace/engine';
import { MirroredStore } from '@ratrace/online/mirror';
import type { AccountSaves, DeviceChange } from '@ratrace/online/types';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Text } from 'react-native';
import { afterEach, describe, expect, it } from 'vitest';
import { onlineOver } from '../../online';
import { accountCloud, fromGoogle, heldBrowser } from '../../testing/accountCloud';
import { authBrowser } from '../../testing/fakes';
import { renderGame, router } from '../../testing/render';
import { sheetOpened } from '../../ui/back';
import { servicesOver, useGame } from '../context';
import type { Services } from '../context';
import { Home } from './Home';

/*
 * The account's copy of the player's things, as the front door shows it: the web's cases (apps/web/src/game/screens/CloudSaves.test.tsx), on the
 * phone, over the real account, mirror and follower around a store in memory, with only the project and the page stood in for. And the phone's
 * own: a guest whose Google account is already a player's is taken into it, and the life waiting in that account is offered, never put over the
 * phone's own.
 */

afterEach(cleanup);

const VERSIONS = { engine: ENGINE_VERSION, content: CONTENT_VERSION };
const NO_PAGE = { onOnline: () => () => {}, onShown: () => () => {}, now: () => 0 };

/** Ids, seeds and a clock of a device of its own, so that two devices never make the same life. */
function depsOf(name: string) {
  let ids = 0;
  let clock = 1_000;
  return { newId: () => `${name}-${(ids += 1)}`, newSeed: () => `seed-${name}`, now: () => (clock += 1) };
}

/**
 * A device of the player: the real account, mirror and follower around a store in memory, over the project. What the mirror would send "a little
 * later" waits until the test says `later`.
 */
function deviceOf(project: ReturnType<typeof accountCloud>, name: string, device = new MemoryStore()) {
  const scheduled: Array<() => Promise<void>> = [];
  const noted = () => {
    let ids: string[] = [];
    return { read: () => ids, write: (next: string[]) => void (ids = next) };
  };
  const online = onlineOver(device, {
    connect: async () => project.cloud,
    address: () => null,
    clean: () => undefined,
    page: NO_PAGE,
    remember: noted(),
    keepRefused: noted(),
    schedule: (run) => void scheduled.push(run),
    newId: () => `${name}-renamed`,
  });
  const deps = depsOf(name);
  const sessions = new LocalSessions(online.store, content, lives, deps);
  const services: Services = { ...servicesOver(online, deps), tapGuardMs: 0 };
  const later = async () => {
    for (const run of scheduled.splice(0)) await run();
  };
  return { services, sessions, online, device, later };
}

/** Plays a life a few rounds on. */
async function play(session: GameSession, rounds: number) {
  for (let i = 0; i < rounds && !session.view().finished; i++) {
    while (session.view().phase === 'cards') await session.answerCard(0);
    await session.playRound({ orders: [] });
  }
}

describe('a player with an account, on two devices', { timeout: 60_000 }, () => {
  it('finds on the second device the life lived on the first, and is told where their things are', async () => {
    const project = accountCloud({ signedIn: { id: 'player-1', is_anonymous: true, email: undefined } });

    const phone = deviceOf(project, 'phone');
    renderGame(<Home />, phone.services);
    // Signed in with no form, and nothing yet to save: everything there is, is in the account, which goes unsaid.
    await screen.findByRole('link', { name: 'New life' });
    expect(screen.queryByRole('status')).toBeNull();

    const session = await phone.sessions.start('nurse');
    await play(session, 1);
    // Saving to the account goes on unsaid.
    expect(screen.queryByRole('status')).toBeNull();
    await phone.later();
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    expect(project.held('player-1').games).toHaveLength(1);
    expect(project.held('player-1').games[0]).toMatchObject({ id: 'phone-1', lifeId: 'nurse', round: 1 });
    cleanup();

    // Another device, with nothing on it, signed in as the same player.
    const tablet = deviceOf(project, 'tablet');
    renderGame(<Home />, tablet.services);
    const carry = await screen.findByRole('link', { name: /Continue your life/ });
    expect(carry.textContent).toContain('Nurse · age 24');
    // It appeared where there was nothing: there is nothing to explain, and nothing is offered besides.
    expect(screen.queryByText(/another tab or on another device/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Pick up the life from your other device/ })).toBeNull();
  });
});

describe('a guest whose Google account is already a player\'s, on the phone', { timeout: 60_000 }, () => {
  /**
   * The player's account (`member-1`) holds a life of an engineer, played three rounds on the web; the phone, a guest who has never signed in, has a
   * nurse of its own.
   */
  async function twoLives() {
    const project = accountCloud({ existing: 'member-1' });
    // The web, signed in as the player: it plays its life, and the account has it.
    project.state.user = { id: 'member-1', is_anonymous: false, email: 'ana.garcia@example.com' };
    const web = new MirroredStore(new MemoryStore(), () => project.cloud, { content, lives, versions: VERSIONS, newId: () => 'web-renamed', schedule: () => undefined });
    await play(await new LocalSessions(web, content, lives, depsOf('web')).start('engineer'), 3);
    await web.sync();
    expect(project.held('member-1').games).toHaveLength(1);
    // The phone, where nobody has signed in: a guest is made as the game opens.
    project.state.user = null;
    const phone = deviceOf(project, 'phone');
    await phone.sessions.start('nurse');
    renderGame(<Home />, phone.services);
    await screen.findByRole('link', { name: /Continue your life/ });
    const keep = await screen.findByRole('button', { name: 'Sign in with Google' });
    return { project, phone, keep };
  }

  /** Keeps the account with Google: Google says the account is a player's already, and the second trip signs the player in. */
  async function signIn(keep: HTMLElement) {
    const second = heldBrowser();
    authBrowser.queued.push(fromGoogle.taken, second.answer);
    fireEvent.click(keep);
    // Between the two trips the front door says what is happening, and offers nothing yet.
    expect((await screen.findByRole('status')).textContent).toBe('You already have an account. Signing you in…');
    expect(screen.queryByRole('button', { name: /Pick up the life from your other device/ })).toBeNull();
    await act(async () => second.back(fromGoogle.linked));
  }

  it('offers the life waiting in the account once the player is in it, and never puts it over the phone\'s own', async () => {
    const { phone, keep } = await twoLives();
    await signIn(keep);
    const offer = await screen.findByRole('button', { name: /Pick up the life from your other device/ });
    expect(offer.textContent).toContain('Software engineer · age 28');
    expect(screen.getByRole('region', { name: 'Account' }).textContent).toContain('Linked to Google');
    // The phone's own life is the one to continue, as it was, on the phone and on the screen.
    expect(screen.getByRole('link', { name: /Continue your life/ }).textContent).toContain('Nurse');
    expect(((await phone.device.loadGame()) as SavedGame).lifeId).toBe('nurse');
  });

  it('opens the account\'s life when the player picks it up, after asking, and plays it', async () => {
    const { phone, keep } = await twoLives();
    await signIn(keep);
    fireEvent.click(await screen.findByRole('button', { name: /Pick up the life from your other device/ }));
    const sheet = screen.getByRole('heading', { name: 'A life on another device' }).closest('[aria-modal="true"]') as HTMLElement;
    expect(sheet.textContent).toContain('Software engineer, age 28, in');
    expect(sheet.textContent).toContain('Picking it up here ends the life on this device: Nurse, age 22.');
    const pushedWithSheet: boolean[] = [];
    router.push.mockImplementation(() => void pushedWithSheet.push(screen.queryByRole('heading', { name: 'A life on another device' }) !== null));
    // A sheet still leaving, as an iOS Modal takes a moment to dismiss: the game is opened only once it has gone.
    const leaving = sheetOpened();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Pick it up here' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'A life on another device' })).toBeNull());
    await waitFor(async () => expect(((await phone.device.loadGame()) as SavedGame).lifeId).toBe('engineer'));
    await new Promise((done) => setTimeout(done, 50));
    expect(router.push).not.toHaveBeenCalled();
    act(() => leaving());
    await waitFor(() => expect(pushedWithSheet).toEqual([false]));
    expect(router.push).toHaveBeenCalledWith('/play');
    expect(screen.getByRole('link', { name: /Continue your life/ }).textContent).toContain('Software engineer');
    expect(((await phone.device.loadGame()) as SavedGame).lifeId).toBe('engineer');
    expect(screen.queryByRole('button', { name: /Pick up the life from your other device/ })).toBeNull();
  });

  it('keeps the phone\'s life when the player ends the account\'s instead', async () => {
    const { project, phone, keep } = await twoLives();
    await signIn(keep);
    fireEvent.click(await screen.findByRole('button', { name: /Pick up the life from your other device/ }));
    fireEvent.click(screen.getByRole('button', { name: 'End it' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /Pick up the life from your other device/ })).toBeNull());
    expect(screen.getByRole('link', { name: /Continue your life/ }).textContent).toContain('Nurse');
    expect(((await phone.device.loadGame()) as SavedGame).lifeId).toBe('nurse');
    expect(router.push).not.toHaveBeenCalledWith('/play');
    // The account is told a little later that the life is over: never offered again, here or anywhere.
    await act(async () => phone.later());
    expect(project.held('member-1').games.find((game) => game.lifeId === 'engineer')?.status).toBe('abandoned');
  });
});

describe('what the account changes on the phone, as the game shows it', { timeout: 60_000 }, () => {
  /** The game with an account's copy that the test moves by hand. */
  function game() {
    const store = new MemoryStore();
    const sessions = new LocalSessions(store, content, lives, { ...depsOf('life'), newSeed: () => 'seed' });
    const changed = new Set<(what: DeviceChange) => void>();
    const saves: AccountSaves = {
      status: () => 'saved',
      offer: () => null,
      subscribe: () => () => {},
      onDeviceChanged: (listener) => (changed.add(listener), () => changed.delete(listener)),
      takeOffer: async () => false,
      declineOffer: async () => {},
    };
    const tell = (what: DeviceChange) => act(() => [...changed].forEach((listener) => listener(what)));
    return { store, sessions, saves, tell, changed };
  }
  function Standing() {
    const gameId = useGame((s) => s.gameId);
    const moved = useGame((s) => s.moved);
    const round = useGame((s) => s.view?.round ?? null);
    return <Text testID="standing">{`${gameId} round ${round}${moved ? ' moved' : ''}`}</Text>;
  }

  it('opens a life that was given a new id as the same life, with nothing to explain', async () => {
    const g = game();
    await g.sessions.start('nurse');
    renderGame(<Standing />, { sessions: g.sessions, store: g.store, saves: g.saves, tapGuardMs: 0 });
    await waitFor(() => expect(screen.getByTestId('standing').textContent).toBe('life-1 round 0'));
    await g.store.saveGame({ ...((await g.store.loadGame()) as SavedGame), gameId: 'life-renamed' });
    g.tell('renamed');
    await waitFor(() => expect(screen.getByTestId('standing').textContent).toBe('life-renamed round 0'));
  });

  it('opens a life the account brought further along as it now stands, and says that it moved', async () => {
    const g = game();
    const session = await g.sessions.start('nurse');
    renderGame(<Standing />, { sessions: g.sessions, store: g.store, saves: g.saves, tapGuardMs: 0 });
    await waitFor(() => expect(screen.getByTestId('standing').textContent).toBe('life-1 round 0'));
    await play(session, 1);
    g.tell('game');
    await waitFor(() => expect(screen.getByTestId('standing').textContent).toBe('life-1 round 1 moved'));
  });

  it('stops listening to the account when the game leaves the screen', async () => {
    const g = game();
    const { unmount } = renderGame(<Standing />, { sessions: g.sessions, store: g.store, saves: g.saves, tapGuardMs: 0 });
    await waitFor(() => expect(g.changed.size).toBe(1));
    unmount();
    expect(g.changed.size).toBe(0);
  });
});
