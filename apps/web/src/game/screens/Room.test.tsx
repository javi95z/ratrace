// @vitest-environment jsdom
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { content, CONTENT_VERSION } from '@ratrace/content';
import { ENGINE_VERSION } from '@ratrace/engine';
import type { SavedGame } from '@/session/types';
import { roomServer } from '@/testing/roomServer';
import { memoryServices, renderGame } from '@/testing/render';
import { Home } from './Home';
import { Room } from './Room';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className, ...rest }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: went }),
  usePathname: () => '/room',
}));
const went = vi.hoisted(() => vi.fn());

// Lives played a round at a time through the screens: a quarter of a minute alone, several times that on a busy machine.
vi.setConfig({ testTimeout: 180_000 });

afterEach(() => {
  cleanup();
  went.mockClear();
  window.history.replaceState(null, '', '/');
});

const HOST = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const VERSIONS = { engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION };

/** The game's services for `user`, with the rooms of `server` behind them and no clock of the page's own: the test moves the room. */
function inRooms(server = roomServer(), user = HOST) {
  return { server, services: { ...memoryServices(), rooms: () => server.link(user), schedule: () => () => {} } };
}

/** A room HOST opened and B joined, and its id and code. */
async function lobby(server: ReturnType<typeof roomServer>, seconds = 180) {
  const opened = await server.ask(HOST, { action: 'open', lifeId: 'nurse', seconds, ...VERSIONS });
  const room = opened.body.room as { id: string; code: string };
  await server.ask(B, { action: 'join', code: room.code, ...VERSIONS });
  return room;
}

/** Answers every card of B's hand with its first option, and plays B's round with no orders, straight on the server. */
async function bPlays(server: ReturnType<typeof roomServer>, room: string) {
  for (;;) {
    const life = (await server.ask(B, { action: 'view', roomId: room })).body as { step: number; view: { phase: string; finished: boolean } };
    if (life.view.finished) return;
    if (life.view.phase !== 'cards') {
      await act(async () => {
        await server.ask(B, { action: 'submit', roomId: room, step: life.step, orders: [] });
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      return;
    }
    await server.ask(B, { action: 'card', roomId: room, step: life.step, option: 0 });
  }
}

/** Takes the player on screen from the news of a round to its finances, answering every card with its first option. */
async function toFinance(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /See what life brings|To your finances/ }));
  for (;;) {
    if (screen.queryByRole('button', { name: /Play the round/ })) return;
    const next = screen.queryByRole('button', { name: /Next card|To your finances/ });
    if (next) {
      await user.click(next);
      continue;
    }
    const group = await screen.findByRole('group', { name: /^Your choices/ });
    const open = within(group).getAllByRole('button').find((button) => !(button as HTMLButtonElement).disabled);
    await user.click(open as HTMLElement);
  }
}

describe('the way to the rooms', () => {
  it('is on the front door only for a player with an account, and leads back to their room once they are in one', async () => {
    const plain = renderGame(<Home />, memoryServices());
    await screen.findByRole('link', { name: 'New life' });
    expect(screen.queryByRole('link', { name: /Multiplayer/ })).toBeNull();
    plain.unmount();

    const { server, services } = inRooms();
    renderGame(<Home />, services);
    expect((await screen.findByRole('link', { name: /Multiplayer/ })).getAttribute('href')).toBe('/room');
    cleanup();
    const room = await lobby(server);
    renderGame(<Home />, services);
    const back = await screen.findByRole('link', { name: /Back to your game/ });
    expect(back.textContent).toContain('Waiting to start · 2 of 6');
    cleanup();
    // Started, the game waits for the player: it is the door's first button, with the time left.
    await server.ask(HOST, { action: 'start', roomId: room.id });
    renderGame(<Home />, services);
    const turn = await screen.findByRole('link', { name: /Your turn · \d:\d\d left/ });
    expect(screen.getAllByRole('link')[0]).toBe(turn);
    expect(screen.getByRole('link', { name: 'New life' }).className).not.toContain('bg-gold-500');
  });

  it('says rooms need an account and a connection where there is none', async () => {
    renderGame(<Room />, memoryServices());
    expect(await screen.findByText('Multiplayer needs an account and a connection.')).toBeTruthy();
  });
});

describe('opening and joining a room', () => {
  it('opens one with the life and the time a round may take, and shows its code, its life and who is in it', async () => {
    const { services } = inRooms();
    const user = userEvent.setup();
    renderGame(<Room />, services);
    await user.click(await screen.findByRole('button', { name: 'Start a game' }));
    const sheet = screen.getByRole('dialog', { name: 'Start a game' });
    await user.click(within(sheet).getByRole('radio', { name: '1:30' }));
    await user.click(within(sheet).getByRole('radio', { name: /Software engineer/ }));
    await user.click(within(sheet).getByRole('button', { name: 'Start the game' }));

    const code = await screen.findByRole('region', { name: 'Game code' });
    expect(within(code).getByText(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/)).toBeTruthy();
    expect(screen.getByText('Software engineer')).toBeTruthy();
    expect(screen.getByText('1:30 a round')).toBeTruthy();
    const members = screen.getByRole('region', { name: 'In the game: 1 of 6' });
    expect(within(members).getByText('Host')).toBeTruthy();
    expect(within(members).getByText('You')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Start' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('At least one more must join to start.')).toBeTruthy();
  });

  it('opens one of a round a day, and says what that is for', async () => {
    const { services } = inRooms();
    const user = userEvent.setup();
    renderGame(<Room />, services);
    await user.click(await screen.findByRole('button', { name: 'Start a game' }));
    const sheet = screen.getByRole('dialog', { name: 'Start a game' });
    expect(within(sheet).getByText(/the clock plays for them/)).toBeTruthy();
    expect(within(within(sheet).getByRole('radiogroup', { name: 'Time for each round' })).getAllByRole('radio').map((radio) => radio.textContent)).toEqual(['1:30', '3:00', '5:00', '12 h', '1 day']);
    await user.click(within(sheet).getByRole('radio', { name: '1 day' }));
    expect(within(sheet).getByText(/a notice tells you when the next begins/)).toBeTruthy();
    await user.click(within(sheet).getByRole('button', { name: 'Start the game' }));
    expect(await screen.findByText('1 day a round')).toBeTruthy();
  });

  it('shows the link to the game, to share or copy', async () => {
    const { services } = inRooms();
    const user = userEvent.setup();
    renderGame(<Room />, services);
    await user.click(await screen.findByRole('button', { name: 'Start a game' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Start a game' })).getByRole('button', { name: 'Start the game' }));
    const code = await screen.findByRole('region', { name: 'Game code' });
    // The link is not written out: it is shared or copied.
    expect(within(code).queryByText(/room\?code=/)).toBeNull();
    await user.click(within(code).getByRole('button', { name: 'Copy link' }));
    expect(await screen.findByText('Link copied.')).toBeTruthy();
    expect(await navigator.clipboard.readText()).toMatch(/\/en\/room\?code=[A-Z0-9]{6}$/);
  });

  it('joins by the code an invitation carries, and waits for the host', async () => {
    const server = roomServer();
    const opened = await server.ask(HOST, { action: 'open', lifeId: 'nurse', seconds: 180, ...VERSIONS });
    const code = (opened.body.room as { code: string }).code;
    window.history.replaceState(null, '', `/en/room?code=${code.toLowerCase()}`);
    const { services } = inRooms(server, B);
    const user = userEvent.setup();
    renderGame(<Room />, services);
    const invitation = await screen.findByRole('region', { name: 'You are invited to the game' });
    expect(within(invitation).getByText(code)).toBeTruthy();
    // Come by a link, there is nothing else to do here: no game to open, no other code to type.
    expect(screen.queryByRole('button', { name: 'Start a game' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Game code' })).toBeNull();
    await user.click(within(invitation).getByRole('button', { name: 'Join the game' }));
    expect(await screen.findByText('Waiting for the host to start.')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'In the game: 2 of 6' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
  });

  it('says why a code was turned away', async () => {
    const { services } = inRooms();
    const user = userEvent.setup();
    renderGame(<Room />, services);
    await user.type(await screen.findByRole('textbox', { name: 'Game code' }), 'zzzzzz');
    await user.click(screen.getByRole('button', { name: 'Join' }));
    expect((await screen.findByRole('alert')).textContent).toBe('No game has that code.');
  });

  it('asks the host before leaving the lobby, and says it closes the room for everyone', async () => {
    const server = roomServer();
    await lobby(server);
    const { services } = inRooms(server);
    const user = userEvent.setup();
    renderGame(<Room />, services);
    await user.click(await screen.findByRole('button', { name: 'Leave the game' }));
    const sheet = screen.getByRole('dialog', { name: 'Leave the game?' });
    expect(within(sheet).getByText('You started it: leaving ends it for everyone.')).toBeTruthy();
    await user.click(within(sheet).getByRole('button', { name: 'Leave' }));
    expect(await screen.findByRole('button', { name: 'Start a game' })).toBeTruthy();
    expect((await server.ask(B, { action: 'mine' })).body.room).toBeNull();
  });
});

describe('a round in a room', () => {
  it('shows the time and who has played above the round, waits after playing, and shows the room\'s order once it turns', async () => {
    const server = roomServer();
    const room = await lobby(server);
    const { services } = inRooms(server);
    const user = userEvent.setup();
    renderGame(<Room />, services);
    await user.click(await screen.findByRole('button', { name: 'Start' }));
    const bar = await screen.findByRole('button', { name: /^The game: \d:\d\d left, 0 of 2 have played$/ });
    expect(bar.getAttribute('aria-haspopup')).toBe('dialog');

    await toFinance(user);
    await user.click(screen.getByRole('button', { name: /Play the round/ }));
    expect(await screen.findByText('Waiting for the others')).toBeTruthy();
    const waiting = screen.getByText('1 of 2 have played').closest('[role="status"]') as HTMLElement;
    expect(waiting.textContent).toContain('Still playing: Rat BBBB');
    expect(screen.queryByRole('button', { name: /Play the round/ })).toBeNull();

    await bPlays(server, room.id);
    expect(await screen.findByRole('region', { name: 'After round 1' }, { timeout: 5_000 })).toBeTruthy();
    const order = screen.getByRole('region', { name: 'After round 1' });
    expect(within(order).getAllByRole('listitem')).toHaveLength(2);
    expect(within(order).getByText('You')).toBeTruthy();
  });

  it('shouts to the others from the bar, one every ten seconds, and shows what they shout', async () => {
    const server = roomServer();
    const room = await lobby(server);
    await server.ask(HOST, { action: 'start', roomId: room.id });
    const { services } = inRooms(server);
    const user = userEvent.setup();
    renderGame(<Room />, services);
    await user.click(await screen.findByRole('button', { name: 'Say something' }));
    const sheet = screen.getByRole('dialog', { name: 'Say something' });
    await user.click(within(sheet).getByRole('button', { name: 'Well played!' }));
    await waitFor(() => expect(server.db.members.find((m) => m.user_id === HOST)?.shout).toBe(6));
    // Again at once: the sheet says to wait.
    await user.click(screen.getByRole('button', { name: 'Say something' }));
    expect(within(screen.getByRole('dialog', { name: 'Say something' })).getByText(/^You can say something again in \d+ s$/)).toBeTruthy();
    expect((within(screen.getByRole('dialog', { name: 'Say something' })).getByRole('button', { name: 'Hurry up!' }) as HTMLButtonElement).disabled).toBe(true);
    // What the other shouts comes to this page as it hears the room change.
    await act(async () => {
      await server.ask(B, { action: 'shout', roomId: room.id, shout: 0 });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await waitFor(() => expect(screen.getAllByRole('status').some((status) => status.textContent === 'RRat BBBB😂')).toBe(true));
  });

  it('opens the room\'s order and the way out from the bar, and asks before giving the life up', async () => {
    const server = roomServer();
    const room = await lobby(server);
    await server.ask(HOST, { action: 'start', roomId: room.id });
    const { services } = inRooms(server);
    const user = userEvent.setup();
    renderGame(<Room />, services);
    await user.click(await screen.findByRole('button', { name: /^The game:/ }));
    // The round and its time in the title; where everyone is in the round beside their name.
    const sheet = screen.getByRole('dialog', { name: /^Round 1 of \d+ · \d:\d\d left$/ });
    expect(within(sheet).getAllByRole('listitem')).toHaveLength(2);
    expect(within(sheet).getAllByText('Playing…')).toHaveLength(2);
    await user.click(within(sheet).getByRole('button', { name: 'Leave the game' }));
    const asking = screen.getByRole('dialog', { name: 'Leave the game?' });
    expect(within(asking).getByText('Your life in the game ends here. The others play on without you.')).toBeTruthy();
    await user.click(within(asking).getByRole('button', { name: 'Leave' }));
    expect(await screen.findByRole('button', { name: 'Start a game' })).toBeTruthy();
    expect(went).not.toHaveBeenCalled();
  });

  it('tells a player the rounds the clock played for them while they were away, and opens the life where it stands', async () => {
    const server = roomServer();
    const room = await lobby(server, 90);
    await server.ask(HOST, { action: 'start', roomId: room.id });
    const { services } = inRooms(server);
    renderGame(<Room />, services);
    await screen.findByRole('button', { name: /^The game:/ });
    for (let round = 0; round < 2; round++) {
      server.wait(90_000 + 5_000);
      await act(async () => {
        await server.ask(B, { action: 'state', roomId: room.id });
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }
    expect(await screen.findByText('The clock played 2 rounds for you.')).toBeTruthy();
    // Two rounds of two years each later: the life is opened where the room is.
    await waitFor(() => expect(screen.getAllByText('Age 26').length).toBeGreaterThan(0));
  });

  it('says a room on other rules than the page cannot be played here, and offers to leave it', async () => {
    const server = roomServer();
    const room = await lobby(server);
    await server.ask(HOST, { action: 'start', roomId: room.id });
    // The game began under rules this page no longer plays.
    Object.assign(server.db.rooms.get(room.id) as object, { engine_version: '0.1.0' });
    const { services } = inRooms(server);
    renderGame(<Room />, services);
    expect(await screen.findByText('This game plays another version. Reload the page to play it.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^The game:/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Leave the game' })).toBeTruthy();
  });

  it('keeps the ticking clock out of what a screen reader is told while the player waits', async () => {
    const server = roomServer();
    await lobby(server);
    const { services } = inRooms(server);
    const user = userEvent.setup();
    renderGame(<Room />, services);
    await user.click(await screen.findByRole('button', { name: 'Start' }));
    await toFinance(user);
    await user.click(screen.getByRole('button', { name: /Play the round/ }));
    await screen.findByText('Waiting for the others');
    const waiting = screen.getByText('1 of 2 have played').closest('[role="status"]') as HTMLElement;
    expect(waiting.textContent).not.toMatch(/\d:\d\d/);
  });

  it('wakes after sleeping through rounds it had played, says only how many the clock played, and never that the life moved elsewhere', async () => {
    const server = roomServer();
    const room = await lobby(server, 90);
    const { services } = inRooms(server);
    services.rooms = () => ({ ...server.link(HOST), watch: () => () => {} });
    const user = userEvent.setup();
    renderGame(<Room />, services);
    await user.click(await screen.findByRole('button', { name: 'Start' }));
    await toFinance(user);
    await user.click(screen.getByRole('button', { name: /Play the round/ }));
    await screen.findByText('Waiting for the others');
    for (let round = 0; round < 3; round++) {
      server.wait(90_000 + 5_000);
      await server.ask(B, { action: 'state', roomId: room.id });
    }
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(await screen.findByText('The clock played 2 rounds for you.')).toBeTruthy();
    expect(screen.queryByText(/played on in another tab/)).toBeNull();
  });

  it('leaves the life on the device as it was, whatever the room does', async () => {
    const server = roomServer();
    const room = await lobby(server);
    const { services } = inRooms(server);
    await services.sessions.start('engineer');
    const before = (await services.store.loadGame()) as SavedGame;
    const user = userEvent.setup();
    renderGame(<Room />, services);
    await user.click(await screen.findByRole('button', { name: 'Start' }));
    await toFinance(user);
    await user.click(screen.getByRole('button', { name: /Play the round/ }));
    await bPlays(server, room.id);
    await screen.findByRole('region', { name: 'After round 1' }, { timeout: 5_000 });
    const after = (await services.store.loadGame()) as SavedGame;
    expect(after.gameId).toBe(before.gameId);
    expect(after.log).toEqual(before.log);
    expect(after.lifeId).toBe('engineer');
  });

  it('offers a rematch at the end, opened by one and joined by the others with one press', async () => {
    const server = roomServer();
    const room = await lobby(server, 90);
    await server.ask(HOST, { action: 'start', roomId: room.id });
    // Played to its end by the clock alone.
    for (let guard = 0; guard < 50 && (server.db.rooms.get(room.id)?.status ?? '') !== 'finished'; guard++) {
      server.wait(96_000);
      await server.ask(HOST, { action: 'state', roomId: room.id });
    }
    const asB = inRooms(server, B);
    const user = userEvent.setup();
    renderGame(<Room />, asB.services);
    await user.click(await screen.findByRole('button', { name: 'Rematch' }, { timeout: 10_000 }));
    const sheet = screen.getByRole('dialog', { name: 'Rematch' });
    expect(within(sheet).getByText(/1:30 a round/)).toBeTruthy();
    expect(within(sheet).getByRole('radio', { name: /Nurse/ }).getAttribute('aria-checked')).toBe('true');
    await user.click(within(sheet).getByRole('button', { name: 'Ask for a rematch' }));
    expect(await screen.findByRole('region', { name: 'In the game: 1 of 6' })).toBeTruthy();
    cleanup();

    const asHost = inRooms(server, HOST);
    renderGame(<Room />, asHost.services);
    expect(await screen.findByText('A rematch is waiting.', {}, { timeout: 10_000 })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Join the rematch' }));
    expect(await screen.findByRole('region', { name: 'In the game: 2 of 6' })).toBeTruthy();
  });

  it('ends with the room\'s order, the player\'s place in it, and the way out of the room', async () => {
    const server = roomServer();
    const room = await lobby(server);
    await server.ask(HOST, { action: 'start', roomId: room.id });
    // Every round but the last is played straight on the server, for both.
    for (let round = 0; round < content.rounds - 1; round++) {
      for (const who of [HOST, B]) {
        for (;;) {
          const life = (await server.ask(who, { action: 'view', roomId: room.id })).body as { step: number; view: { phase: string } };
          if (life.view.phase !== 'cards') {
            await server.ask(who, { action: 'submit', roomId: room.id, step: life.step, orders: [] });
            break;
          }
          await server.ask(who, { action: 'card', roomId: room.id, step: life.step, option: 0 });
        }
      }
    }
    const { services } = inRooms(server);
    const user = userEvent.setup();
    renderGame(<Room />, services);
    await toFinance(user);
    await user.click(screen.getByRole('button', { name: /Play the round/ }));
    await bPlays(server, room.id);
    await user.click(await screen.findByRole('button', { name: /See how it ended/ }, { timeout: 5_000 }));
    const final = await screen.findByRole('region', { name: 'How the game ended' });
    expect(within(final).getByText(/^Place [12] of 2$/)).toBeTruthy();
    // Everyone in the order, and the multiplayer badges the end earned: both played alike, so both won.
    expect(final.querySelectorAll('ol > li')).toHaveLength(2);
    expect(within(within(final).getByRole('list', { name: 'New badges' })).getByText('First win')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'The end' })).toBeTruthy();
    await user.click(within(final).getByRole('button', { name: 'Leave the game' }));
    expect(await screen.findByRole('button', { name: 'Start a game' })).toBeTruthy();
    expect((await services.store.listRuns())[0]).toMatchObject({ room: true });
  });
});
