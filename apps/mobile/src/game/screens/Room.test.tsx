// @vitest-environment jsdom
import { CONTENT_VERSION } from '@ratrace/content';
import { ENGINE_VERSION } from '@ratrace/engine';
import type { RoundActions, RoundState } from '@ratrace/core/game/store';
import { sceneStore } from '@ratrace/core/testing/scenes';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { roomServer } from '../../../../web/src/testing/roomServer';
import { clipboard } from '../../testing/fakes';
import { memoryServices, renderGame, router, spriteRenders } from '../../testing/render';
import { Counted, settled, steady } from '../../testing/renders';
import type { Renders } from '../../testing/renders';
import { COLORS } from '../../ui/theme';
import { useGame } from '../context';
import type { Services } from '../context';
import { End } from './End';
import { Home } from './Home';
import { Room } from './Room';

// The phone's share sheet (React Native's `Share`): what it was handed, and how the player left it. And the platform a test plays on.
const shared = vi.hoisted(() => ({ asked: [] as Array<Record<string, unknown>>, action: 'sharedAction' as string }));
const platform = vi.hoisted(() => ({ OS: 'android' }));
vi.mock('react-native', async (original) => {
  const native = await original<typeof import('react-native')>();
  return {
    ...native,
    Platform: { ...native.Platform, get OS() { return platform.OS; }, select: (options: Record<string, unknown>) => options[platform.OS] ?? options.default },
    Share: {
      sharedAction: 'sharedAction',
      dismissedAction: 'dismissedAction',
      share: async (content: Record<string, unknown>) => (shared.asked.push(content), { action: shared.action }),
    },
  };
});
// A player's rat is a canvas: here a box that counts its drawings, by the rat (a seat is drawn again only when what it shows changes).
const rats = vi.hoisted(() => new Map<string, number>());
vi.mock('../../ui/RatAvatar', async () => {
  const { createElement } = await import('react');
  return {
    RatAvatar: ({ look }: { look: unknown }) => {
      const key = JSON.stringify(look);
      rats.set(key, (rats.get(key) ?? 0) + 1);
      return createElement('div', { 'data-rat': key });
    },
  };
});

// Lives played a round at a time on the server: a moment alone, several times that on a busy machine.
vi.setConfig({ testTimeout: 120_000 });

afterEach(() => {
  cleanup();
  rats.clear();
  shared.asked.length = 0;
  shared.action = 'sharedAction';
  platform.OS = 'android';
});

const HOST = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const VERSIONS = { engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION };

/** The game's services for `user`, with the rooms of `server` behind them and no clock of the page's own: the test moves the room. What is counted is kept. */
function inRooms(server = roomServer(), user = HOST) {
  const counted: unknown[] = [];
  const services: Services = { ...memoryServices(), rooms: () => server.link(user), schedule: () => () => {}, track: (event) => void counted.push(event) };
  return { server, services, counted };
}

/** A room HOST opened and B joined, and its id and code. */
async function lobby(server: ReturnType<typeof roomServer>, seconds = 180) {
  const opened = await server.ask(HOST, { action: 'open', lifeId: 'nurse', seconds, ...VERSIONS });
  const room = opened.body.room as { id: string; code: string };
  await server.ask(B, { action: 'join', code: room.code, ...VERSIONS });
  return room;
}

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

/** Asks the server as another player, and lets the page hear that the room changed. */
async function meanwhile(ask: () => Promise<unknown>) {
  await act(async () => {
    await ask();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const press = (element: HTMLElement) => fireEvent.click(element);
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const disabled = (element: HTMLElement) => element.getAttribute('aria-disabled') === 'true';
const type = (field: HTMLElement, text: string) => fireEvent.change(field, { target: { value: text } });
const sheetOf = async (title: string) => (await screen.findByRole('heading', { name: title })).closest('[aria-modal="true"]') as HTMLElement;
const region = (name: string | RegExp) => screen.getByRole('region', { name });

/** `#rrggbb` as the browser computes it. */
const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
};
/** Whether something is drawn on gold: its own box, or the frame inside it. */
const onGold = (element: HTMLElement) => [element, ...element.querySelectorAll<HTMLElement>('*')].some((one) => getComputedStyle(one).backgroundColor === rgb(COLORS['gold-500']));

describe('the way to the rooms', () => {
  it('is on the front door only for a player with an account, and leads back to their room once they are in one', async () => {
    const plain = renderGame(<Home />, memoryServices());
    await screen.findByRole('link', { name: 'New life' });
    expect(screen.queryByRole('link', { name: /Multiplayer/ })).toBeNull();
    plain.unmount();

    const { server, services } = inRooms();
    renderGame(<Home />, services);
    press(await screen.findByRole('link', { name: /Multiplayer/ }));
    expect(router.push).toHaveBeenCalledWith('/room');
    cleanup();
    const room = await lobby(server);
    renderGame(<Home />, services);
    const back = await screen.findByRole('link', { name: /Back to your game/ });
    expect(back.textContent).toContain('Waiting to start · 2 of 6');
    cleanup();
    // Started, the game waits for the player: it is the door's first button, in gold, with the time left; a new life is not gold.
    await server.ask(HOST, { action: 'start', roomId: room.id });
    renderGame(<Home />, services);
    const turn = await screen.findByRole('link', { name: /Your turn · \d:\d\d left/ });
    expect(screen.getAllByRole('link')[0]).toBe(turn);
    expect(onGold(turn)).toBe(true);
    expect(onGold(screen.getByRole('link', { name: 'New life' }))).toBe(false);
  });

  it('says rooms need an account and a connection where there is none', async () => {
    renderGame(<Room />, memoryServices());
    expect(await screen.findByText('Multiplayer needs an account and a connection.')).toBeTruthy();
  });

  it('says when the games cannot be reached, and asks again when told to', async () => {
    const { server, services } = inRooms();
    server.network.down = true;
    renderGame(<Room />, services);
    expect(await screen.findByText('The games cannot be reached just now.')).toBeTruthy();
    server.network.down = false;
    press(button('Try again'));
    expect(await screen.findByRole('button', { name: 'Start a game' })).toBeTruthy();
  });
});

describe('opening and joining a room', () => {
  it('opens one with the life and the time a round may take, and shows its code, its life and who is in it', async () => {
    const { services } = inRooms();
    renderGame(<Room />, services);
    press(await screen.findByRole('button', { name: 'Start a game' }));
    const sheet = await sheetOf('Start a game');
    press(within(sheet).getByRole('radio', { name: '1:30' }));
    press(within(sheet).getByRole('radio', { name: /Software engineer/ }));
    expect(within(sheet).getByRole('radio', { name: /Software engineer/ }).getAttribute('aria-checked')).toBe('true');
    press(within(sheet).getByRole('button', { name: 'Start the game' }));

    const code = await screen.findByRole('region', { name: 'Game code' });
    expect(within(code).getByText(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/)).toBeTruthy();
    expect(screen.getByText('Software engineer')).toBeTruthy();
    expect(screen.getByText('1:30 a round')).toBeTruthy();
    const members = region('In the game: 1 of 6');
    expect(within(members).getByText('Host')).toBeTruthy();
    expect(within(members).getByText('You')).toBeTruthy();
    expect(disabled(button('Start'))).toBe(true);
    expect(screen.getByText('At least one more must join to start.')).toBeTruthy();
  });

  it('opens one of a round a day, and says what that is for', async () => {
    const { services } = inRooms();
    renderGame(<Room />, services);
    press(await screen.findByRole('button', { name: 'Start a game' }));
    const sheet = await sheetOf('Start a game');
    expect(within(sheet).getByText(/the clock plays for them/)).toBeTruthy();
    expect(within(within(sheet).getByRole('radiogroup', { name: 'Time for each round' })).getAllByRole('radio').map((radio) => radio.textContent)).toEqual(['1:30', '3:00', '5:00', '12 h', '1 day']);
    press(within(sheet).getByRole('radio', { name: '1 day' }));
    expect(within(sheet).getByText(/a notice tells you when the next begins/)).toBeTruthy();
    press(within(sheet).getByRole('button', { name: 'Start the game' }));
    expect(await screen.findByText('1 day a round')).toBeTruthy();
  });

  it('copies the link to the game, the web\'s own address, and says so', async () => {
    const { services, counted } = inRooms();
    renderGame(<Room />, services);
    press(await screen.findByRole('button', { name: 'Start a game' }));
    press(within(await sheetOf('Start a game')).getByRole('button', { name: 'Start the game' }));
    const code = await screen.findByRole('region', { name: 'Game code' });
    // The link is not written out: it is shared or copied.
    expect(within(code).queryByText(/room\?code=/)).toBeNull();
    press(within(code).getByRole('button', { name: 'Copy link' }));
    expect(await screen.findByText('Link copied.')).toBeTruthy();
    const shown = within(code).getByText(/^[A-Z0-9]{6}$/).textContent;
    expect(clipboard.text).toBe(`https://ratrace-plum.vercel.app/en/room?code=${shown}`);
    expect(counted).toContainEqual({ name: 'share', what: 'invite' });
  });

  it('shares the link with the web\'s words through the phone\'s share sheet: beside the words on iOS, inside them on Android', async () => {
    const { services, counted } = inRooms();
    renderGame(<Room />, services, 'es');
    press(await screen.findByRole('button', { name: 'Crear una partida' }));
    press(within(await sheetOf('Crear una partida')).getByRole('button', { name: 'Crear la partida' }));
    const code = await screen.findByRole('region', { name: 'Código de la partida' });
    const shown = within(code).getByText(/^[A-Z0-9]{6}$/).textContent as string;
    const link = `https://ratrace-plum.vercel.app/es/room?code=${shown}`;
    press(within(code).getByRole('button', { name: 'Compartir' }));
    await waitFor(() => expect(shared.asked).toHaveLength(1));
    expect(shared.asked[0]).toEqual({ title: 'Multijugador', message: `Juega conmigo a The Rat Race en multijugador. Partida ${shown} ${link}` });
    await waitFor(() => expect(counted).toContainEqual({ name: 'share', what: 'invite' }));
    platform.OS = 'ios';
    counted.length = 0;
    shared.action = 'dismissedAction';
    press(within(code).getByRole('button', { name: 'Compartir' }));
    await waitFor(() => expect(shared.asked).toHaveLength(2));
    expect(shared.asked[1]).toEqual({ message: `Juega conmigo a The Rat Race en multijugador. Partida ${shown}`, url: link });
    // Turned down: nothing was shared, and nothing is counted.
    await settled();
    expect(counted).not.toContainEqual({ name: 'share', what: 'invite' });
  });

  it('joins by the code an invitation carries (the route\'s `code`), and waits for the host', async () => {
    const server = roomServer();
    const opened = await server.ask(HOST, { action: 'open', lifeId: 'nurse', seconds: 180, ...VERSIONS });
    const code = (opened.body.room as { code: string }).code;
    const { services, counted } = inRooms(server, B);
    renderGame(<Room code={code.toLowerCase()} />, services);
    const invitation = await screen.findByRole('region', { name: 'You are invited to the game' });
    expect(within(invitation).getByText(code)).toBeTruthy();
    // Come by a link, there is nothing else to do here: no game to open, no other code to type.
    expect(screen.queryByRole('button', { name: 'Start a game' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Game code' })).toBeNull();
    press(within(invitation).getByRole('button', { name: 'Join the game' }));
    expect(await screen.findByText('Waiting for the host to start.')).toBeTruthy();
    expect(region('In the game: 2 of 6')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
    expect(counted).toContainEqual({ name: 'game_join', via: 'link' });
  });

  it('takes no invitation from a code that is not one: the door is the door', async () => {
    const { services } = inRooms();
    renderGame(<Room code="ab-12" />, services);
    expect(await screen.findByRole('textbox', { name: 'Game code' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'You are invited to the game' })).toBeNull();
  });

  it('keeps a typed code to six letters and digits, in capitals, and joins with it once it has six', async () => {
    const server = roomServer();
    const opened = await server.ask(HOST, { action: 'open', lifeId: 'nurse', seconds: 180, ...VERSIONS });
    const code = (opened.body.room as { code: string }).code;
    const { services, counted } = inRooms(server, B);
    renderGame(<Room />, services);
    const field = await screen.findByRole('textbox', { name: 'Game code' });
    type(field, `${code.slice(0, 2).toLowerCase()}-${code.slice(2, 4)} `);
    expect((field as HTMLInputElement).value).toBe(code.slice(0, 4));
    expect(disabled(button('Join'))).toBe(true);
    type(field, `${code.toLowerCase()}99`);
    expect((field as HTMLInputElement).value).toBe(code);
    press(button('Join'));
    expect(await screen.findByText('Waiting for the host to start.')).toBeTruthy();
    expect(counted).toContainEqual({ name: 'game_join', via: 'code' });
  });

  it('says why a code was turned away', async () => {
    const { services } = inRooms();
    renderGame(<Room />, services);
    type(await screen.findByRole('textbox', { name: 'Game code' }), 'zzzzzz');
    press(button('Join'));
    expect((await screen.findByRole('alert')).textContent).toBe('No game has that code.');
  });

  it('tells a code on other rules to update the app, not to reload a page', async () => {
    const server = roomServer();
    const opened = await server.ask(HOST, { action: 'open', lifeId: 'nurse', seconds: 180, ...VERSIONS });
    const room = opened.body.room as { id: string; code: string };
    // The game is on newer rules than this app: it was opened on a version the app is not on yet.
    Object.assign(server.db.rooms.get(room.id) as object, { engine_version: '99.0.0' });
    const { services } = inRooms(server, B);
    renderGame(<Room />, services);
    type(await screen.findByRole('textbox', { name: 'Game code' }), room.code);
    press(button('Join'));
    expect((await screen.findByRole('alert')).textContent).toBe('That game plays another version. Update the app and try again.');
  });

  it('asks the host before leaving the lobby, and says it closes the room for everyone', async () => {
    const server = roomServer();
    await lobby(server);
    const { services } = inRooms(server);
    renderGame(<Room />, services);
    press(await screen.findByRole('button', { name: 'Leave the game' }));
    const sheet = await sheetOf('Leave the game?');
    expect(within(sheet).getByText('You started it: leaving ends it for everyone.')).toBeTruthy();
    press(within(sheet).getByRole('button', { name: 'Leave' }));
    expect(await screen.findByRole('button', { name: 'Start a game' })).toBeTruthy();
    expect((await server.ask(B, { action: 'mine' })).body.room).toBeNull();
  });

  it('lets a player who joined leave at once, asking nothing', async () => {
    const server = roomServer();
    await lobby(server);
    const { services } = inRooms(server, B);
    renderGame(<Room />, services);
    press(await screen.findByRole('button', { name: 'Leave the game' }));
    expect(await screen.findByRole('button', { name: 'Start a game' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Leave the game?' })).toBeNull();
  });

  it('names the player in the lobby, where the others will see it, and checks how the name is written first', async () => {
    const server = roomServer();
    await lobby(server);
    const { services } = inRooms(server);
    const renamed: string[] = [];
    const community = { rename: async (name: string) => (renamed.push(name), server.db.names.set(HOST, name), 'ok' as const) };
    renderGame(<Room />, { ...services, community: () => community as never });
    press(await screen.findByRole('button', { name: 'Name yourself' }));
    const sheet = await sheetOf('Your name');
    const field = within(sheet).getByRole('textbox', { name: 'Name' });
    type(field, 'no');
    press(within(sheet).getByRole('button', { name: 'Save' }));
    expect(await within(sheet).findByRole('alert')).toBeTruthy();
    expect(renamed).toEqual([]);
    type(field, 'Rata_Uno');
    press(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(renamed).toEqual(['Rata_Uno']));
    expect(await within(region('In the game: 2 of 6')).findByText('Rata_Uno')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Change' })).toBeTruthy();
  });
});

describe('a room on other rules', () => {
  it('says a started game on rules the app lacks cannot be played here, in the phone\'s words, and offers to leave it', async () => {
    const server = roomServer();
    const room = await lobby(server);
    await server.ask(HOST, { action: 'start', roomId: room.id });
    // The game is on newer rules than this app: it was begun on a version the app is not on yet.
    Object.assign(server.db.rooms.get(room.id) as object, { engine_version: '99.0.0' });
    const { services } = inRooms(server);
    renderGame(<Room />, services);
    expect(await screen.findByText('This game plays another version. Update the app to play it.')).toBeTruthy();
    // Never the web's words, and never the life: no round to play, no news to read.
    expect(screen.queryByText(/Reload the page/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'See what life brings' })).toBeNull();
    press(button('Leave the game'));
    expect(await screen.findByRole('button', { name: 'Start a game' })).toBeTruthy();
    expect((await server.ask(HOST, { action: 'mine' })).body.room).toBeNull();
  });
});

describe('a public game', () => {
  it('takes a seat from the door, says how long until it starts and that rats fill it, and anyone may start it now', async () => {
    const { server, services, counted } = inRooms();
    renderGame(<Room />, services);
    expect(await screen.findByText(/If nobody turns up, bot rats fill the table/)).toBeTruthy();
    press(button('Quick game'));
    const clock = await screen.findByRole('region', { name: 'Looking for players' });
    expect(within(clock).getByRole('timer').textContent).toMatch(/^Starts in [12]:\d\d$/);
    expect(within(clock).getByText('If no more players turn up, bot rats fill the table.')).toBeTruthy();
    expect(counted).toContainEqual({ name: 'game_join', via: 'quick' });
    // Nobody hosts a public game: no tag says so, and leaving asks nothing.
    const members = region('In the game: 1 of 6');
    expect(within(members).queryByText('Host')).toBeNull();
    press(button('Start now'));
    // Alone, with three rats: the lobby gives way to the life.
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Looking for players' })).toBeNull());
    expect(server.db.members.filter((m) => m.user_id !== HOST)).toHaveLength(3);
    expect([...server.db.rooms.values()][0].status).toBe('playing');
  });

  it('invites someone to a public game from its clock, through the share sheet', async () => {
    const { services } = inRooms();
    renderGame(<Room />, services);
    press(await screen.findByRole('button', { name: 'Quick game' }));
    const clock = await screen.findByRole('region', { name: 'Looking for players' });
    press(within(clock).getByRole('button', { name: 'Invite someone' }));
    await waitFor(() => expect(shared.asked).toHaveLength(1));
    expect(String(shared.asked[0].message)).toMatch(/^Play The Rat Race with me in multiplayer\. Game [A-Z0-9]{6} https:\/\/ratrace-plum\.vercel\.app\/en\/room\?code=[A-Z0-9]{6}$/);
  });

  it('starts by itself once its time has come, while the player watches its lobby', async () => {
    const server = roomServer();
    await server.ask(B, { action: 'quick', ...VERSIONS });
    const { services } = inRooms(server);
    renderGame(<Room />, services);
    press(await screen.findByRole('button', { name: 'Quick game' }));
    // Seated in the lobby B was waiting in.
    expect(await screen.findByRole('region', { name: 'In the game: 2 of 6' })).toBeTruthy();
    await meanwhile(async () => {
      server.wait(120_000);
      // Whoever looks first starts it; this page hears of it.
      await server.ask(B, { action: 'state', roomId: server.db.members[0].room_id });
    });
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Looking for players' })).toBeNull(), { timeout: 5_000 });
  });

  it('says on the front door how long until the public game starts', async () => {
    const { server, services } = inRooms();
    await server.ask(HOST, { action: 'quick', ...VERSIONS });
    renderGame(<Home />, services);
    const back = await screen.findByRole('link', { name: /Back to your game/ });
    expect(back.textContent).toMatch(/Looking for players · [12]:\d\d/);
  });

  it('counts its clock down once a second, not once a frame: only the clock is drawn again', async () => {
    const { services } = inRooms();
    const renders: Renders = { count: 0 };
    renderGame(
      <Counted into={renders}>
        <Room />
      </Counted>,
      services,
    );
    press(await screen.findByRole('button', { name: 'Quick game' }));
    const timer = within(await screen.findByRole('region', { name: 'Looking for players' })).getByRole('timer');
    await steady(() => rats.size);
    const before = renders.count;
    const seats = [...rats.values()];
    // The life everyone lives, in the lobby's own panel: drawn again only if the lobby is.
    const portrait = document.querySelector('[data-sprite^="portrait."]')!.getAttribute('data-sprite')!;
    const lobbyDrawn = spriteRenders.get(portrait);
    const shown = timer.textContent;
    // A tenth of a second at a time, each drawn as it ends (`act` draws what it was told at its end): a clock told every frame is drawn every time.
    for (let tenth = 0; tenth < 23; tenth++) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
    }
    expect(timer.textContent).not.toBe(shown);
    // Two or three seconds gone by: as many drawings, and none of the seats.
    expect(renders.count - before).toBeGreaterThanOrEqual(1);
    expect(renders.count - before).toBeLessThanOrEqual(5);
    expect([...rats.values()]).toEqual(seats);
    expect(spriteRenders.get(portrait)).toBe(lobbyDrawn);
  });
});

describe('public games: who is waiting, and who is gone', () => {
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
});

describe('a public game of a round a day', () => {
  it('is chosen by its pace on the door, and its lobby says how such a game is played', async () => {
    const { server, services } = inRooms();
    renderGame(<Room />, services);
    const pace = await screen.findByRole('radiogroup', { name: 'Pace' });
    press(within(pace).getByRole('radio', { name: 'Now and then' }));
    expect(screen.getByText(/A round a day with whoever is looking for a game/)).toBeTruthy();
    press(button('Game now and then'));
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
    renderGame(<Room />, services);
    // Played together, none is waiting; a round a day, one is.
    await screen.findByRole('radiogroup', { name: 'Pace' });
    await settled();
    expect(screen.queryByText(/looking for players right now/)).toBeNull();
    press(screen.getByRole('radio', { name: 'Now and then' }));
    expect((await screen.findByRole('status')).textContent).toBe('1 game is looking for players right now');
  });
});

describe('a quick game from the end of a life alone', () => {
  it('takes a seat in a public game for a player with an account, and goes to it', async () => {
    const server = roomServer();
    const counted: unknown[] = [];
    const services: Services = { ...memoryServices(await sceneStore('end-bankrupt')), rooms: () => server.link(HOST), schedule: () => () => {}, track: (event) => void counted.push(event) };
    renderGame(<End />, services);
    expect(await screen.findByText('In a quick game everyone lives the same life in the same world, and whoever ends with the most points wins.', {}, { timeout: 10_000 })).toBeTruthy();
    press(screen.getByRole('button', { name: 'Quick game' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/room'));
    expect(server.db.members.map((m) => m.user_id)).toEqual([HOST]);
    expect(counted).toContainEqual({ name: 'game_join', via: 'quick' });
  });

  it('is not offered with no account', async () => {
    renderGame(<End />, memoryServices(await sceneStore('end-bankrupt')));
    await screen.findByRole('link', { name: 'Home' }, { timeout: 10_000 });
    expect(screen.queryByText('Up for taking on others?')).toBeNull();
  });
});

describe('what the lobby draws again', () => {
  it('draws no seat again when another player comes or goes: only the seat that changed', async () => {
    const server = roomServer();
    // Each in a rat of their own, so each seat's drawings are counted apart.
    for (const [user, rat] of [[HOST, 'rat_gold'], [B, 'rat_teal'], [C, 'rat_wine']]) server.db.avatars.set(user, rat);
    const room = await lobby(server);
    const { services } = inRooms(server);
    renderGame(<Room />, services);
    await screen.findByRole('region', { name: 'In the game: 2 of 6' });
    await steady(() => [...rats.entries()]);
    const host = screen.getByText('Rat AAAA').closest('[role="listitem"]')!.querySelector('[data-rat]')!.getAttribute('data-rat')!;
    const b = screen.getByText('Rat BBBB').closest('[role="listitem"]')!.querySelector('[data-rat]')!.getAttribute('data-rat')!;
    const [hostDrawn, bDrawn] = [rats.get(host), rats.get(b)];
    await meanwhile(() => server.ask(C, { action: 'join', code: room.code, ...VERSIONS }));
    expect(await screen.findByRole('region', { name: 'In the game: 3 of 6' })).toBeTruthy();
    expect(screen.getByText('Rat CCCC')).toBeTruthy();
    expect(new Set([host, b, screen.getByText('Rat CCCC').closest('[role="listitem"]')!.querySelector('[data-rat]')!.getAttribute('data-rat')]).size).toBe(3);
    expect([rats.get(host), rats.get(b)]).toEqual([hostDrawn, bDrawn]);
    await meanwhile(() => server.ask(C, { action: 'leave', roomId: room.id }));
    expect(await screen.findByRole('region', { name: 'In the game: 2 of 6' })).toBeTruthy();
    expect([rats.get(host), rats.get(b)]).toEqual([hostDrawn, bDrawn]);
  });

  it('is not drawn again by a change of the game it does not show: a life begun, the news left, a card answered', async () => {
    const server = roomServer();
    await lobby(server);
    const { services } = inRooms(server);
    const renders: Renders = { count: 0 };
    const probe: { state: (RoundState & RoundActions) | null } = { state: null };
    function Probe() {
      probe.state = useGame((s) => s);
      return null;
    }
    renderGame(
      <>
        <Probe />
        <Counted into={renders}>
          <Room />
        </Counted>
      </>,
      services,
    );
    await screen.findByRole('region', { name: 'In the game: 2 of 6' });
    await settled(() => probe.state?.start('nurse'));
    await settled(() => probe.state?.leaveNews());
    await steady(() => renders.count);
    const before = renders.count;
    await settled(() => probe.state?.pick(0));
    await settled(() => probe.state?.afterCard());
    expect(probe.state?.view?.answered).toBe(1);
    expect(renders.count).toBe(before);
  });
});
