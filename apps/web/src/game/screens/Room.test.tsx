// @vitest-environment jsdom
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { content, CONTENT_VERSION } from '@ratrace/content';
import { ENGINE_VERSION } from '@ratrace/engine';
import type { SavedGame } from '@ratrace/core/session/types';
import { roomServer } from '@/testing/roomServer';
import { memoryServices, renderGame, setWidth } from '@/testing/render';
import { styleOf } from '@/testing/stylesheet';
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

/** Plays every round of a game straight on the server, for each of `who`, answering each card with its first option. */
async function playToTheEnd(server: ReturnType<typeof roomServer>, room: string, who: string[]) {
  for (let guard = 0; guard < 40 && (server.db.rooms.get(room)?.status ?? '') === 'playing'; guard++) {
    for (const one of who) {
      for (;;) {
        const life = (await server.ask(one, { action: 'view', roomId: room })).body as { step: number; view: { phase: string; finished: boolean } };
        if (life.view.finished) break;
        if (life.view.phase !== 'cards') {
          await server.ask(one, { action: 'submit', roomId: room, step: life.step, orders: [] });
          break;
        }
        await server.ask(one, { action: 'card', roomId: room, step: life.step, option: 0 });
      }
    }
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
    // The rivals of a game with friends are the other players: the made-up ones of a life alone are not here.
    expect(screen.queryByRole('region', { name: 'Your rivals' })).toBeNull();
  });

  it('teases a rival from the focus of the round, and the rival is told who did it', async () => {
    setWidth('desk');
    const server = roomServer();
    const room = await lobby(server);
    const { services } = inRooms(server);
    const user = userEvent.setup();
    renderGame(<Room />, services);
    await user.click(await screen.findByRole('button', { name: 'Start' }));
    await toFinance(user);
    await user.click(within(await screen.findByRole('region', { name: 'Work' })).getByText('Focus this round'));
    const sheet = await screen.findByRole('dialog', { name: 'Focus' });
    await user.click(within(sheet).getByRole('switch', { name: /Tease a rival/ }));
    const rival = within(sheet).getByRole('radio', { name: 'Rat BBBB' });
    expect(rival.getAttribute('aria-checked')).toBe('true');
    await user.click(within(sheet).getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: /Play the round/ }));
    await screen.findByText('Waiting for the others');
    await bPlays(server, room.id);
    const b = (await server.ask(B, { action: 'view', roomId: room.id })).body as { events: unknown[] };
    expect(b.events).toContainEqual({ kind: 'teased', by: HOST, status: -2 });
  });

  it('teases a rival from the Lifestyle tab too, beside the rest of the focus', async () => {
    setWidth('desk');
    const server = roomServer();
    await lobby(server);
    const { services } = inRooms(server);
    const user = userEvent.setup();
    renderGame(<Room />, services);
    await user.click(await screen.findByRole('button', { name: 'Start' }));
    await toFinance(user);
    await user.click(await screen.findByRole('tab', { name: 'Lifestyle' }));
    const others = await screen.findByRole('region', { name: 'The other players' });
    await user.click(within(others).getByRole('switch', { name: /Tease a rival/ }));
    expect(within(others).getByRole('radio', { name: 'Rat BBBB' }).getAttribute('aria-checked')).toBe('true');
  });

  it('offers a loan to another player from the room\'s order, on terms the player sets', async () => {
    const server = roomServer();
    const room = await lobby(server);
    await server.ask(HOST, { action: 'start', roomId: room.id });
    const { services } = inRooms(server);
    const user = userEvent.setup();
    renderGame(<Room />, services);
    await user.click(await screen.findByRole('button', { name: /^The game: / }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /Rat BBBB/ }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Rat BBBB' })).getByRole('button', { name: 'Offer a loan' }));
    const sheet = await screen.findByRole('dialog', { name: 'Lend to Rat BBBB' });
    await user.click(within(sheet).getByRole('button', { name: '$1,000' }));
    await user.click(within(sheet).getByRole('radio', { name: /^10(\.0)?%$/ }));
    await user.click(within(sheet).getByRole('radio', { name: '2' }));
    expect(within(sheet).getByText(/^Rat BBBB will pay you \$\d/)).toBeTruthy();
    await user.click(within(sheet).getByRole('button', { name: 'Offer it to Rat BBBB' }));
    await waitFor(() => expect(server.db.loans).toHaveLength(1));
    expect(server.db.loans[0]).toMatchObject({ lender: HOST, borrower: B, amount: 100_000, rate_bp: 1_000, rounds: 2, status: 'open' });
    // The offer waits on screen, and can be taken back.
    expect(await screen.findByText('You offer Rat BBBB a loan: waiting for an answer')).toBeTruthy();
  });

  it('shows an offer from another player, and takes the answer', async () => {
    const server = roomServer();
    const room = await lobby(server);
    await server.ask(HOST, { action: 'start', roomId: room.id });
    const { services } = inRooms(server);
    const user = userEvent.setup();
    renderGame(<Room />, services);
    await screen.findByRole('button', { name: /^The game: / });
    await act(async () => {
      await server.ask(B, { action: 'loan', roomId: room.id, to: HOST, lend: true, amount: 200_000, rateBp: 500, rounds: 3 });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const offer = await screen.findByRole('region', { name: 'Rat BBBB offers you a loan' });
    expect(within(offer).getByText(/^You would pay \$[\d,]+ the first round and \$[\d,]+ in all\.$/)).toBeTruthy();
    await user.click(within(offer).getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(server.db.loans[0].status).toBe('accepted'));
    // Told from the player's side: who lends to whom, and when the money comes.
    expect(await screen.findByText('Rat BBBB lends to you: the money comes when the round ends', { exact: false })).toBeTruthy();
    expect(await screen.findByText(/\$2,000 at 5(\.0)?% · 3 rounds/)).toBeTruthy();
  });

  it('tells a loan at no interest as interest-free, from the side of the one who lends', async () => {
    const server = roomServer();
    const room = await lobby(server);
    await server.ask(HOST, { action: 'start', roomId: room.id });
    const { services } = inRooms(server);
    const user = userEvent.setup();
    renderGame(<Room />, services);
    await screen.findByRole('button', { name: /^The game: / });
    await act(async () => {
      await server.ask(B, { action: 'loan', roomId: room.id, to: HOST, lend: false, amount: 2_500_000, rateBp: 0, rounds: 5 });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const ask = await screen.findByRole('region', { name: 'Rat BBBB asks you for a loan' });
    expect(within(ask).getByText('$25,000 interest-free · 5 rounds')).toBeTruthy();
    await user.click(within(ask).getByRole('button', { name: 'Accept' }));
    expect(await screen.findByText('You lend to Rat BBBB: the money goes when the round ends', { exact: false })).toBeTruthy();
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
    // The player sees what they shouted, as the others do.
    await waitFor(() => expect(screen.getAllByRole('status').map((status) => status.textContent)).toContain('Rat AAAAWell played!'), { timeout: 3_000 });
    // Gold on the night, raised, with its shadow under it: both drawn, as the stylesheet compiles them (a 'shadow-*' beside the frame lost to it).
    const shout = screen.getByText('Well played!').closest<HTMLElement>('.frame-raised')!;
    expect((await styleOf(shout.className)).get('box-shadow')).toBe(
      [
        '0 -2px 0 0 var(--color-gold-900)',
        '0 2px 0 0 var(--color-gold-900)',
        '-2px 0 0 0 var(--color-gold-900)',
        '2px 0 0 0 var(--color-gold-900)',
        'inset 0 2px 0 0 var(--color-gold-200)',
        'inset 0 -3px 0 0 var(--color-gold-700)',
        '0 6px 0 -2px var(--color-gold-900)',
        '4px 4px 0 rgb(0 0 0/0.5)',
      ].join(', '),
    );
    // Again at once: the sheet says to wait.
    await user.click(screen.getByRole('button', { name: 'Say something' }));
    expect(within(screen.getByRole('dialog', { name: 'Say something' })).getByText(/^You can say something again in \d+ s$/)).toBeTruthy();
    expect((within(screen.getByRole('dialog', { name: 'Say something' })).getByRole('button', { name: 'Hurry up!' }) as HTMLButtonElement).disabled).toBe(true);
    // What the other shouts comes to this page as it hears the room change.
    await act(async () => {
      await server.ask(B, { action: 'shout', roomId: room.id, shout: 0 });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    // Shown after the player's own, while that one is still on screen.
    await waitFor(() => expect(screen.getAllByRole('status').some((status) => status.textContent?.endsWith('Rat BBBB😂'))).toBe(true));
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
    // The game is on newer rules than this page: the page was opened before they came out.
    Object.assign(server.db.rooms.get(room.id) as object, { engine_version: '99.0.0' });
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
    // Over, the front door does not call it a game to go back to: it is there for its result.
    renderGame(<Home />, asB.services);
    const result = await screen.findByRole('link', { name: /See how your game ended/ }, { timeout: 10_000 });
    expect(result.textContent).toMatch(/You came #\d of 2/);
    expect(screen.queryByRole('link', { name: /Back to your game/ })).toBeNull();
    cleanup();
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

describe('a public game', () => {
  it('takes a seat from the door, says how long until it starts and that rats fill it, and anyone may start it now', async () => {
    const { server, services } = inRooms();
    const user = userEvent.setup();
    renderGame(<Room />, services);
    expect(await screen.findByText(/If nobody turns up, bot rats fill the table/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Quick game' }));
    const clock = await screen.findByRole('region', { name: 'Looking for players' });
    expect(within(clock).getByRole('timer').textContent).toMatch(/^Starts in [12]:\d\d$/);
    expect(within(clock).getByText('If no more players turn up, bot rats fill the table.')).toBeTruthy();
    // Nobody hosts a public game: no tag says so, and leaving asks nothing.
    const members = screen.getByRole('region', { name: 'In the game: 1 of 6' });
    expect(within(members).queryByText('Host')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Start now' }));
    // Alone, with three rats that have played already.
    const bar = await screen.findByRole('button', { name: /^The game: \d:\d\d left, 3 of 4 have played$/ });
    await user.click(bar);
    const order = await screen.findByRole('dialog');
    expect(within(order).getAllByText('Bot')).toHaveLength(3);
    const rats = server.db.members.filter((m) => m.user_id !== HOST);
    expect(rats).toHaveLength(3);
    // A rat is named by its kind, and is not one to lend money to: its line opens nothing.
    expect(within(order).getAllByText(/^(Saver|Index|Crypto|Show-off|Landlord) Rat$/)).toHaveLength(3);
    expect(within(order).queryByRole('button', { name: /Rat$/ })).toBeNull();
  });

  it('starts by itself once its time has come, while the player watches its lobby', async () => {
    const server = roomServer();
    await server.ask(B, { action: 'quick', ...VERSIONS });
    const { services } = inRooms(server);
    const user = userEvent.setup();
    renderGame(<Room />, services);
    await user.click(await screen.findByRole('button', { name: 'Quick game' }));
    // Seated in the lobby B was waiting in.
    expect(await screen.findByRole('region', { name: 'In the game: 2 of 6' })).toBeTruthy();
    await act(async () => {
      server.wait(120_000);
      // Whoever looks first starts it; this page hears of it.
      await server.ask(B, { action: 'state', roomId: server.db.members[0].room_id });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(await screen.findByRole('button', { name: /^The game: \d:\d\d left, 2 of 4 have played$/ }, { timeout: 5_000 })).toBeTruthy();
  });

  it('says on the front door how long until the public game starts', async () => {
    const { server, services } = inRooms();
    await server.ask(HOST, { action: 'quick', ...VERSIONS });
    renderGame(<Home />, services);
    const back = await screen.findByRole('link', { name: /Back to your game/ });
    expect(back.textContent).toMatch(/Looking for players · [12]:\d\d/);
  });

  it('offers another quick game at the end, in place of a rematch', async () => {
    const server = roomServer();
    const seat = (await server.ask(HOST, { action: 'quick', ...VERSIONS })).body.room as { id: string };
    await server.ask(HOST, { action: 'start', roomId: seat.id });
    await playToTheEnd(server, seat.id, [HOST]);
    expect(server.db.rooms.get(seat.id)?.status).toBe('finished');
    const { services } = inRooms(server);
    const user = userEvent.setup();
    renderGame(<Room />, services);
    const again = await screen.findByRole('button', { name: 'Another quick game' }, { timeout: 10_000 });
    expect(screen.queryByRole('button', { name: 'Rematch' })).toBeNull();
    await user.click(again);
    expect(await screen.findByRole('region', { name: 'Looking for players' })).toBeTruthy();
  });
});

describe('public games: who is waiting, who is gone, and the people met', () => {
  it('says on the door and on the front page how many public games are looking for players', async () => {
    const server = roomServer();
    await server.ask(B, { action: 'quick', ...VERSIONS });
    const { services } = inRooms(server);
    renderGame(<Room />, services);
    expect((await screen.findByRole('status', {}, { timeout: 5_000 })).textContent).toBe('1 game is looking for players right now');
    cleanup();
    renderGame(<Home />, services);
    expect((await screen.findByRole('link', { name: /Multiplayer/ })).textContent).toContain('1 game is looking for players');
  });

  it('tells a player taken out of a public game why, once they are back', async () => {
    const server = roomServer();
    const seat = (await server.ask(HOST, { action: 'quick', ...VERSIONS })).body.room as { id: string };
    await server.ask(B, { action: 'quick', ...VERSIONS });
    await server.ask(B, { action: 'start', roomId: seat.id });
    // B plays; HOST lets the clock play two rounds.
    for (let round = 0; round < 2; round++) {
      await playRoundOf(server, seat.id, B);
      server.wait(186_000);
      await server.ask(B, { action: 'state', roomId: seat.id });
    }
    expect(server.db.members.find((m) => m.room_id === seat.id && m.user_id === HOST)?.left_at).not.toBeNull();
    const { services } = inRooms(server);
    renderGame(<Room />, services);
    expect(await screen.findByText('You were taken out of the public game: the clock played two rounds in a row for you.')).toBeTruthy();
  });

  it('asks another player to be friends from the end of the game, without their code', async () => {
    const server = roomServer();
    server.db.names.set(B, 'Bea_7');
    const seat = (await server.ask(HOST, { action: 'quick', ...VERSIONS })).body.room as { id: string };
    await server.ask(B, { action: 'quick', ...VERSIONS });
    await server.ask(HOST, { action: 'start', roomId: seat.id });
    await playToTheEnd(server, seat.id, [HOST, B]);
    const { services } = inRooms(server);
    const user = userEvent.setup();
    renderGame(<Room />, services);
    const final = await screen.findByRole('region', { name: 'How the game ended' }, { timeout: 10_000 });
    expect(within(final).getByText('Tap a player to add them as a friend.')).toBeTruthy();
    // The rats open nothing; the other player does.
    expect(within(final).queryByRole('button', { name: /Rat$/ })).toBeNull();
    await user.click(within(final).getByRole('button', { name: /Bea_7/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Bea_7' });
    await user.click(within(sheet).getByRole('button', { name: 'Add friend' }));
    expect(await within(sheet).findByText('Request sent.')).toBeTruthy();
    expect(server.db.requests).toEqual([{ from: HOST, to: B }]);
    expect((within(sheet).getByRole('button', { name: 'Request sent' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('reports a name in a public game, which the player then no longer sees', async () => {
    const server = roomServer();
    server.db.names.set(B, 'Rude_Name');
    const seat = (await server.ask(HOST, { action: 'quick', ...VERSIONS })).body.room as { id: string };
    await server.ask(B, { action: 'quick', ...VERSIONS });
    await server.ask(HOST, { action: 'start', roomId: seat.id });
    const { services } = inRooms(server);
    const user = userEvent.setup();
    renderGame(<Room />, services);
    await user.click(await screen.findByRole('button', { name: /^The game: / }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /Rude_Name/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Rude_Name' });
    await user.click(within(sheet).getByRole('button', { name: 'Report their name' }));
    expect(await within(sheet).findByText('Thank you. You will not see that name again.')).toBeTruthy();
    expect(server.db.reports).toMatchObject([{ reporter: HOST, reported: B }]);
    // The sheet itself now calls them by the rat their id makes of them.
    expect(await screen.findByRole('dialog', { name: 'Rat BBBB' })).toBeTruthy();
  });

  it('offers no report in a game among friends', async () => {
    const server = roomServer();
    server.db.names.set(B, 'Bea_7');
    const room = await lobby(server);
    await server.ask(HOST, { action: 'start', roomId: room.id });
    const { services } = inRooms(server);
    const user = userEvent.setup();
    renderGame(<Room />, services);
    await user.click(await screen.findByRole('button', { name: /^The game: / }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /Bea_7/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Bea_7' });
    expect(within(sheet).getByRole('button', { name: 'Offer a loan' })).toBeTruthy();
    expect(within(sheet).queryByRole('button', { name: 'Report their name' })).toBeNull();
  });
});

/** Plays one round of `who` straight on the server: every card with its first option, then no orders. */
async function playRoundOf(server: ReturnType<typeof roomServer>, room: string, who: string) {
  for (;;) {
    const life = (await server.ask(who, { action: 'view', roomId: room })).body as { step: number; view: { phase: string } };
    if (life.view.phase !== 'cards') {
      await server.ask(who, { action: 'submit', roomId: room, step: life.step, orders: [] });
      return;
    }
    await server.ask(who, { action: 'card', roomId: room, step: life.step, option: 0 });
  }
}

describe('a public game of a round a day', () => {
  it('is chosen by its pace on the door, and its lobby says how such a game is played', async () => {
    const { server, services } = inRooms();
    const user = userEvent.setup();
    renderGame(<Room />, services);
    const pace = await screen.findByRole('radiogroup', { name: 'Pace' });
    await user.click(within(pace).getByRole('radio', { name: 'Now and then' }));
    expect(screen.getByText(/A round a day with whoever is looking for a game/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Game now and then' }));
    const clock = await screen.findByRole('region', { name: 'Looking for players' });
    expect(within(clock).getByRole('timer').textContent).toMatch(/^Starts in (30:00|29:\d\d)$/);
    expect(within(clock).getByText(/a notice tells you when the next begins/)).toBeTruthy();
    expect(screen.getByText('1 day a round')).toBeTruthy();
    expect([...server.db.rooms.values()].map((room) => room.seconds)).toEqual([86_400]);
  });

  it('counts the games waiting at each pace apart', async () => {
    const server = roomServer();
    await server.ask(B, { action: 'quick', pace: 'slow', ...VERSIONS });
    const { services } = inRooms(server);
    const user = userEvent.setup();
    renderGame(<Room />, services);
    // Played together, none is waiting; a round a day, one is.
    await screen.findByRole('radiogroup', { name: 'Pace' });
    await waitFor(() => expect(services.rooms()?.api).toBeTruthy());
    expect(screen.queryByText(/looking for players right now/)).toBeNull();
    await user.click(screen.getByRole('radio', { name: 'Now and then' }));
    expect((await screen.findByRole('status')).textContent).toBe('1 game is looking for players right now');
  });
});
