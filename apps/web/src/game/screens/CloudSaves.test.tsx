// @vitest-environment jsdom
import { content, lives } from '@ratrace/content';
import { act, cleanup, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useGame } from '@/game/context';
import type { Services } from '@/game/context';
import { onlineOver } from '@/online';
import type { CloudGame, Progress } from '@/online/merge';
import type { CloudRun } from '@/online/mirror';
import type { Cloud } from '@/online/supabase';
import type { AccountSaves, DeviceChange } from '@/online/types';
import { LocalSessions } from '@/session/local';
import { MemoryStore } from '@/session/memory';
import type { SavedGame } from '@/session/types';
import { renderGame } from '@/testing/render';
import { Home } from './Home';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
}));

afterEach(cleanup);

/** One player's account in the cloud, kept in memory. Whoever connects to it is that player. */
function accountInTheCloud() {
  const held = { games: [] as CloudGame[], progress: null as Progress | null, runs: [] as CloudRun[], clock: 0 };
  const cloud: Cloud = {
    currentUser: async () => ({ id: 'player-1', is_anonymous: true, email: undefined }),
    signInAsGuest: async () => null,
    linkGoogle: async () => true,
    signInWithGoogle: async () => true,
    ensureProfile: async () => {},
    onUser: () => () => {},
    playingGames: async () => held.games.filter((game) => game.status === 'playing'),
    pushGame: async (upload) => {
      const next: CloudGame = { ...upload, status: 'playing', updatedAt: new Date(Date.UTC(2026, 9, 13, 10, 0, (held.clock += 1))).toISOString() };
      held.games = [...held.games.filter((game) => game.id !== upload.id), next];
      return 'saved';
    },
    abandonGame: async (id) => {
      for (const game of held.games) if (game.id === id) game.status = 'abandoned';
    },
    loadProgress: async () => held.progress,
    saveProgress: async (progress) => {
      held.progress = progress;
    },
    listRuns: async () => held.runs,
    finishRun: async () => 'done',
    rankedLife: async () => null,
    giveUpRanked: async () => {},
    ranked: {} as Cloud['ranked'],
    community: {} as Cloud['community'],
  };
  return { cloud, held };
}

/**
 * A device of that player: the real account, the real mirror and the real follower, around a
 * store in memory. Only the cloud and the page are stand-ins. What the mirror would send "a
 * little later" waits until the test says `later`.
 */
function deviceOf(cloud: Cloud, name: string) {
  const scheduled: Array<() => Promise<void>> = [];
  let noted: string[] = [];
  const online = onlineOver(new MemoryStore(), {
    connect: async () => cloud,
    address: () => 'http://localhost/en',
    clean: () => {},
    page: { onOnline: () => () => {}, onShown: () => () => {}, now: () => 0 },
    remember: { read: () => noted, write: (ids) => (noted = ids) },
    schedule: (run) => scheduled.push(run),
    newId: () => 'never',
  });
  let ids = 0;
  let clock = 1_000;
  const sessions = new LocalSessions(online.store, content, lives, { newId: () => `${name}-${(ids += 1)}`, newSeed: () => `seed-${name}`, now: () => (clock += 1) });
  const services: Services = { sessions, store: online.store, account: online.account, saves: online.saves, tapGuardMs: 0 };
  const later = async () => {
    for (const run of scheduled.splice(0)) await run();
  };
  return { services, sessions, later };
}

describe('a player with an account, on two devices', { timeout: 60_000 }, () => {
  it('finds on the second device the life lived on the first, and is told where their things are', async () => {
    const { cloud, held } = accountInTheCloud();

    const phone = deviceOf(cloud, 'phone');
    renderGame(<Home />, phone.services);
    // Signed in with no form, and nothing yet to save: everything there is, is in the account.
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Saved to your account'));
    expect(screen.getByRole('region', { name: 'Account' }).textContent).toContain('You are playing as a guest');

    const session = await phone.sessions.start('nurse');
    while (session.view().phase === 'cards') await session.answerCard(0);
    await session.playRound({ orders: [] });
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Saving to your account…'));
    await phone.later();
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Saved to your account'));
    expect(held.games).toHaveLength(1);
    expect(held.games[0]).toMatchObject({ id: 'phone-1', lifeId: 'nurse', round: 1 });
    cleanup();

    // Another device, with nothing on it, signed in as the same player.
    const laptop = deviceOf(cloud, 'laptop');
    renderGame(<Home />, laptop.services);
    const carry = await screen.findByRole('link', { name: /Continue your life/ });
    expect(carry.textContent).toContain('Nurse · age 24');
    // It appeared where there was nothing: there is nothing to explain, and nothing is offered besides.
    expect(screen.queryByText(/another tab or on another device/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Continue the life in your account/ })).toBeNull();
  });
});

describe('what the account changes on the device, as the game shows it', { timeout: 60_000 }, () => {
  /** The game with an account's copy that the test moves by hand. */
  function game() {
    const store = new MemoryStore();
    let ids = 0;
    let clock = 1_000;
    const sessions = new LocalSessions(store, content, lives, { newId: () => `life-${(ids += 1)}`, newSeed: () => 'seed', now: () => (clock += 1) });
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
    return <p data-testid="standing">{`${gameId} round ${round}${moved ? ' moved' : ''}`}</p>;
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
    while (session.view().phase === 'cards') await session.answerCard(0);
    await session.playRound({ orders: [] });
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

