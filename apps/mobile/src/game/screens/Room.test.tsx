// @vitest-environment jsdom
import { content, CONTENT_VERSION } from '@ratrace/content';
import { ENGINE_VERSION } from '@ratrace/engine';
import type { RoomState } from '@ratrace/core/game/room';
import type { RoundActions, RoundState } from '@ratrace/core/game/store';
import { Unreachable } from '@ratrace/core/session/errors';
import type { SavedGame } from '@ratrace/core/session/types';
import { messagesFor } from '@ratrace/i18n';
import { sceneStore } from '@ratrace/core/testing/scenes';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { roomServer } from '../../../../web/src/testing/roomServer';
import { appState, clipboard } from '../../testing/fakes';
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
// A player's rat is a canvas: here a box that counts its drawings, by the rat (a seat is drawn again only when what it shows changes); a rat drawn
// larger (a shout's) is counted apart, under its own key.
const rats = vi.hoisted(() => new Map<string, number>());
vi.mock('../../ui/RatAvatar', async () => {
  const { createElement } = await import('react');
  return {
    RatAvatar: ({ look, size }: { look: unknown; size?: string }) => {
      const key = `${JSON.stringify(look)}${size === 'md' ? '/md' : ''}`;
      rats.set(key, (rats.get(key) ?? 0) + 1);
      return createElement('div', { 'data-rat': key });
    },
  };
});

// The bar's button (a Raised named for the game), counted each time it is drawn: the one piece of the bar the clock draws again.
const bars = vi.hoisted(() => ({ drawn: 0 }));
vi.mock('../../ui/kit', async (original) => {
  const kit = await original<typeof import('../../ui/kit')>();
  const { createElement } = await import('react');
  return {
    ...kit,
    Raised: (props: Parameters<typeof kit.Raised>[0]) => {
      if (props.label?.startsWith('The game: ')) bars.drawn += 1;
      return createElement(kit.Raised, props);
    },
  };
});
const barDrawn = () => bars.drawn;

// Lives played a round at a time on the server: a moment alone, several times that on a busy machine.
vi.setConfig({ testTimeout: 120_000 });

afterEach(() => {
  cleanup();
  rats.clear();
  shared.asked.length = 0;
  shared.action = 'sharedAction';
  platform.OS = 'android';
});

const en = messagesFor('en');
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
const sheetOf = async (title: string | RegExp) => (await screen.findByRole('heading', { name: title })).closest('[aria-modal="true"]') as HTMLElement;
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
    expect(router.push).toHaveBeenCalledWith('/en/room');
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

/** Answers every card of B's hand with its first option, and plays B's round with no orders, straight on the server: the page hears the room turn. */
async function bPlays(server: ReturnType<typeof roomServer>, room: string) {
  for (;;) {
    const life = (await server.ask(B, { action: 'view', roomId: room })).body as { step: number; view: { phase: string; finished: boolean } };
    if (life.view.finished) return;
    if (life.view.phase !== 'cards') {
      await meanwhile(() => server.ask(B, { action: 'submit', roomId: room, step: life.step, orders: [] }));
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
async function toFinance() {
  press(await screen.findByRole('button', { name: /See what life brings|To your finances/ }, { timeout: 10_000 }));
  for (;;) {
    if (screen.queryByRole('button', { name: /Play the round/ })) return;
    const next = screen.queryByRole('button', { name: /Next card|To your finances/ });
    if (next) {
      press(next);
      await settled();
      continue;
    }
    const group = screen.queryByRole('group', { name: /^Your choices/ });
    if (group === null) {
      await settled();
      continue;
    }
    press(within(group).getAllByRole('button').find((one) => !disabled(one)) as HTMLElement);
    await settled();
  }
}

describe('a round in a room', () => {
  it('shows the time and who has played above the round, waits after playing, and shows the room\'s order once it turns', async () => {
    const server = roomServer();
    const room = await lobby(server);
    const { services } = inRooms(server);
    renderGame(<Room />, services);
    press(await screen.findByRole('button', { name: 'Start' }));
    expect(await screen.findByRole('button', { name: /^The game: \d:\d\d left, 0 of 2 have played$/ }, { timeout: 10_000 })).toBeTruthy();

    await toFinance();
    press(button(/Play the round/));
    expect(await screen.findByText('Waiting for the others')).toBeTruthy();
    const waiting = screen.getByText('1 of 2 have played').closest('[role="status"]') as HTMLElement;
    expect(waiting.textContent).toContain('Still playing: Rat BBBB');
    expect(screen.queryByRole('button', { name: /Play the round/ })).toBeNull();

    await bPlays(server, room.id);
    const order = await screen.findByRole('region', { name: 'After round 1' }, { timeout: 5_000 });
    expect(within(order).getAllByRole('listitem')).toHaveLength(2);
    expect(within(order).getByText('You')).toBeTruthy();
    // The rivals of a game with friends are the other players: the made-up ones of a life alone are not here.
    expect(screen.queryByRole('region', { name: 'Your rivals' })).toBeNull();
    expect(router.dismissTo).not.toHaveBeenCalled();
  });

  it('stays on the room while its life cannot be opened yet, and opens it at the next look: never home', async () => {
    const server = roomServer();
    const room = await lobby(server);
    await server.ask(HOST, { action: 'start', roomId: room.id });
    // The server cannot show the life the first time it is asked: the room store's life is then none, until it asks again.
    const link = server.link(HOST);
    let fails = 1;
    const flaky = { ...link, api: { ...link.api, view: async (id: string) => (fails-- > 0 ? Promise.reject(new Unreachable('not now')) : link.api.view(id)) } };
    const { services } = inRooms(server);
    renderGame(<Room />, { ...services, rooms: () => flaky });
    await waitFor(() => expect(fails).toBeLessThan(1));
    await settled();
    expect(router.dismissTo).not.toHaveBeenCalled();
    // The next look (someone shouts) opens it where it stands.
    await meanwhile(() => server.ask(B, { action: 'shout', roomId: room.id, shout: 0 }));
    expect(await screen.findByRole('button', { name: /^The game: / }, { timeout: 5_000 })).toBeTruthy();
    expect(router.dismissTo).not.toHaveBeenCalled();
  });

  it('teases a rival from the focus of the round, and the rival is told who did it', async () => {
    const server = roomServer();
    const room = await lobby(server);
    const { services } = inRooms(server);
    renderGame(<Room />, services);
    press(await screen.findByRole('button', { name: 'Start' }));
    await toFinance();
    press(screen.getByRole('button', { name: 'Open your profile' }));
    const work = within(await sheetOf('Your life')).getByLabelText('Work');
    press(within(work).getByRole('button', { name: /^Focus this round/ }));
    const sheet = await sheetOf('Focus');
    press(within(sheet).getByRole('switch', { name: /Tease a rival/ }));
    await waitFor(() => expect(within(sheet).getByRole('radio', { name: 'Rat BBBB' }).getAttribute('aria-checked')).toBe('true'));
    press(within(sheet).getByRole('button', { name: 'Close' }));
    press(within(await sheetOf('Your life')).getByRole('button', { name: 'Close' }));
    await settled();
    press(button(/Play the round/));
    await screen.findByText('Waiting for the others');
    await bPlays(server, room.id);
    const b = (await server.ask(B, { action: 'view', roomId: room.id })).body as { events: unknown[] };
    expect(b.events).toContainEqual({ kind: 'teased', by: HOST, status: -2 });
  });

  it('names the rival who teased the player in the ledger of the round, as the room names them', async () => {
    const server = roomServer();
    server.db.names.set(B, 'Bea_7');
    const room = await lobby(server);
    const { services } = inRooms(server);
    renderGame(<Room />, services);
    press(await screen.findByRole('button', { name: 'Start' }));
    await toFinance();
    press(button(/Play the round/));
    await screen.findByText('Waiting for the others');
    // B teases the player with the round's focus.
    for (;;) {
      const life = (await server.ask(B, { action: 'view', roomId: room.id })).body as { step: number; view: { phase: string } };
      if (life.view.phase !== 'cards') {
        await meanwhile(() => server.ask(B, { action: 'submit', roomId: room.id, step: life.step, orders: [{ type: 'focus', action: 'tease', target: HOST }] }));
        break;
      }
      await server.ask(B, { action: 'card', roomId: room.id, step: life.step, option: 0 });
    }
    await screen.findByRole('region', { name: 'After round 1' }, { timeout: 5_000 });
    expect(screen.getByText(/Bea_7 (mocks|tells)/)).toBeTruthy();
  });

  it('teases a rival from the Lifestyle tab too, beside the rest of the focus', async () => {
    const server = roomServer();
    await lobby(server);
    const { services } = inRooms(server);
    renderGame(<Room />, services);
    press(await screen.findByRole('button', { name: 'Start' }));
    await toFinance();
    press(await screen.findByRole('tab', { name: 'Lifestyle' }));
    const others = await screen.findByRole('region', { name: 'The other players' });
    press(within(others).getByRole('switch', { name: /Tease a rival/ }));
    await waitFor(() => expect(within(others).getByRole('radio', { name: 'Rat BBBB' }).getAttribute('aria-checked')).toBe('true'));
  });

  it('offers a loan to another player from the room\'s order, on terms the player sets', async () => {
    const server = roomServer();
    const room = await lobby(server);
    await server.ask(HOST, { action: 'start', roomId: room.id });
    const { services } = inRooms(server);
    renderGame(<Room />, services);
    press(await screen.findByRole('button', { name: /^The game: / }, { timeout: 10_000 }));
    press(within(await sheetOf(/^Round 1 of/)).getByRole('button', { name: /Rat BBBB/ }));
    press(within(await sheetOf('Rat BBBB')).getByRole('button', { name: 'Offer a loan' }));
    const sheet = await sheetOf('Lend to Rat BBBB');
    press(within(sheet).getByRole('button', { name: '$1,000' }));
    press(within(sheet).getByRole('radio', { name: /^10(\.0)?%$/ }));
    press(within(sheet).getByRole('radio', { name: '2' }));
    expect(within(sheet).getByText(/^Rat BBBB will pay you \$\d/)).toBeTruthy();
    press(within(sheet).getByRole('button', { name: 'Offer it to Rat BBBB' }));
    await waitFor(() => expect(server.db.loans).toHaveLength(1));
    expect(server.db.loans[0]).toMatchObject({ lender: HOST, borrower: B, amount: 100_000, rate_bp: 1_000, rounds: 2, status: 'open' });
    // The offer waits on screen, and can be taken back.
    expect(await screen.findByText('You offer Rat BBBB a loan: waiting for an answer', { exact: false })).toBeTruthy();
    press(button('Withdraw'));
    await waitFor(() => expect(server.db.loans[0].status).not.toBe('open'));
  });

  it('takes a typed amount, digits only, and says when it is out of range', async () => {
    const server = roomServer();
    const room = await lobby(server);
    await server.ask(HOST, { action: 'start', roomId: room.id });
    const { services } = inRooms(server);
    renderGame(<Room />, services);
    press(await screen.findByRole('button', { name: /^The game: / }, { timeout: 10_000 }));
    press(within(await sheetOf(/^Round 1 of/)).getByRole('button', { name: /Rat BBBB/ }));
    press(within(await sheetOf('Rat BBBB')).getByRole('button', { name: 'Ask for a loan' }));
    const sheet = await sheetOf('Borrow from Rat BBBB');
    const field = within(sheet).getByRole('textbox', { name: 'Amount' }) as HTMLInputElement;
    type(field, '$2,5x00');
    expect(field.value).toBe('2500');
    expect(within(sheet).getByText(/^You will pay \$\d/)).toBeTruthy();
    type(field, '50');
    expect(within(sheet).getByText('Between $100 and $10,000,000.')).toBeTruthy();
    expect(disabled(within(sheet).getByRole('button', { name: 'Ask Rat BBBB' }))).toBe(true);
  });

  it('shows an offer from another player, and takes the answer', async () => {
    const server = roomServer();
    const room = await lobby(server);
    await server.ask(HOST, { action: 'start', roomId: room.id });
    const { services } = inRooms(server);
    renderGame(<Room />, services);
    await screen.findByRole('button', { name: /^The game: / }, { timeout: 10_000 });
    await meanwhile(() => server.ask(B, { action: 'loan', roomId: room.id, to: HOST, lend: true, amount: 200_000, rateBp: 500, rounds: 3 }));
    const offer = await screen.findByRole('region', { name: 'Rat BBBB offers you a loan' });
    expect(within(offer).getByText(/^You would pay \$[\d,]+ the first round and \$[\d,]+ in all\.$/)).toBeTruthy();
    press(within(offer).getByRole('button', { name: 'Accept' }));
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
    renderGame(<Room />, services);
    await screen.findByRole('button', { name: /^The game: / }, { timeout: 10_000 });
    await meanwhile(() => server.ask(B, { action: 'loan', roomId: room.id, to: HOST, lend: false, amount: 2_500_000, rateBp: 0, rounds: 5 }));
    const ask = await screen.findByRole('region', { name: 'Rat BBBB asks you for a loan' });
    expect(within(ask).getByText('$25,000 interest-free · 5 rounds')).toBeTruthy();
    press(within(ask).getByRole('button', { name: 'Accept' }));
    expect(await screen.findByText('You lend to Rat BBBB: the money goes when the round ends', { exact: false })).toBeTruthy();
  });

  it('shouts to the others from the bar, one every ten seconds, and shows what they shout', async () => {
    const server = roomServer();
    const room = await lobby(server);
    await server.ask(HOST, { action: 'start', roomId: room.id });
    const { services } = inRooms(server);
    renderGame(<Room />, services);
    press(await screen.findByRole('button', { name: 'Say something' }, { timeout: 10_000 }));
    press(within(await sheetOf('Say something')).getByRole('button', { name: 'Well played!' }));
    await waitFor(() => expect(server.db.members.find((m) => m.user_id === HOST)?.shout).toBe(6));
    // The player sees what they shouted, as the others do.
    await waitFor(() => expect(screen.getAllByRole('status').map((status) => status.textContent)).toContain('Rat AAAAWell played!'), { timeout: 3_000 });
    // Again at once: the sheet says to wait.
    press(button('Say something'));
    const again = await sheetOf('Say something');
    expect(within(again).getByText(/^You can say something again in \d+ s$/)).toBeTruthy();
    expect(disabled(within(again).getByRole('button', { name: 'Hurry up!' }))).toBe(true);
    press(within(again).getByRole('button', { name: 'Close' }));
    // What the other shouts comes to this page as it hears the room change, shown after the player's own while that one is still on screen.
    await meanwhile(() => server.ask(B, { action: 'shout', roomId: room.id, shout: 0 }));
    await waitFor(() => expect(screen.getAllByRole('status').some((status) => status.textContent?.endsWith('Rat BBBB😂'))).toBe(true));
  });

  it('opens the room\'s order and the way out from the bar, and asks before giving the life up', async () => {
    const server = roomServer();
    const room = await lobby(server);
    await server.ask(HOST, { action: 'start', roomId: room.id });
    const { services } = inRooms(server);
    renderGame(<Room />, services);
    press(await screen.findByRole('button', { name: /^The game:/ }, { timeout: 10_000 }));
    // The round and its time in the title; where everyone is in the round beside their name.
    const sheet = await sheetOf(/^Round 1 of \d+ · \d:\d\d left$/);
    expect(within(sheet).getAllByRole('listitem')).toHaveLength(2);
    expect(within(sheet).getAllByText('Playing…')).toHaveLength(2);
    press(within(sheet).getByRole('button', { name: 'Leave the game' }));
    const asking = await sheetOf('Leave the game?');
    expect(within(asking).getByText('Your life in the game ends here. The others play on without you.')).toBeTruthy();
    press(within(asking).getByRole('button', { name: 'Leave' }));
    expect(await screen.findByRole('button', { name: 'Start a game' })).toBeTruthy();
    expect(router.dismissTo).not.toHaveBeenCalled();
  });

  it('tells a player the rounds the clock played for them while they were away, and opens the life where it stands', async () => {
    const server = roomServer();
    const room = await lobby(server, 90);
    await server.ask(HOST, { action: 'start', roomId: room.id });
    const { services } = inRooms(server);
    renderGame(<Room />, services);
    await screen.findByRole('button', { name: /^The game:/ }, { timeout: 10_000 });
    for (let round = 0; round < 2; round++) {
      await meanwhile(async () => {
        server.wait(90_000 + 5_000);
        await server.ask(B, { action: 'state', roomId: room.id });
      });
    }
    expect(await screen.findByText('The clock played 2 rounds for you.')).toBeTruthy();
    // Two rounds of two years each later: the life is opened where the room is.
    await waitFor(() => expect(screen.getAllByText(/Age 26/).length).toBeGreaterThan(0));
  });

  it('keeps the ticking clock out of what a screen reader is told while the player waits', async () => {
    const server = roomServer();
    await lobby(server);
    const { services } = inRooms(server);
    renderGame(<Room />, services);
    press(await screen.findByRole('button', { name: 'Start' }));
    await toFinance();
    press(button(/Play the round/));
    await screen.findByText('Waiting for the others');
    const waiting = screen.getByText('1 of 2 have played').closest('[role="status"]') as HTMLElement;
    expect(waiting.textContent).not.toMatch(/\d:\d\d/);
  });

  it('wakes after sleeping through rounds it had played, says only how many the clock played, and never that the life moved elsewhere', async () => {
    const server = roomServer();
    const room = await lobby(server, 90);
    const { services } = inRooms(server);
    // Asleep: nothing is heard of the room until the app is back in front.
    renderGame(<Room />, { ...services, rooms: () => ({ ...server.link(HOST), watch: () => () => {} }) });
    press(await screen.findByRole('button', { name: 'Start' }));
    await toFinance();
    press(button(/Play the round/));
    await screen.findByText('Waiting for the others');
    for (let round = 0; round < 3; round++) {
      server.wait(90_000 + 5_000);
      await server.ask(B, { action: 'state', roomId: room.id });
    }
    await act(async () => {
      appState.set('background');
      appState.set('active');
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(await screen.findByText('The clock played 2 rounds for you.')).toBeTruthy();
    await settled();
    expect(screen.queryByText(en.phone.moved)).toBeNull();
  });

  it('leaves the life on the device as it was, whatever the room does', async () => {
    const server = roomServer();
    const room = await lobby(server);
    const { services } = inRooms(server);
    await services.sessions.start('engineer');
    const before = (await services.store.loadGame()) as SavedGame;
    renderGame(<Room />, services);
    press(await screen.findByRole('button', { name: 'Start' }));
    await toFinance();
    press(button(/Play the round/));
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
    // Over, the front door neither calls it a game to go back to nor shows its result: that is in the records.
    renderGame(<Home />, asB.services);
    const door = await screen.findByRole('link', { name: /Multiplayer/ }, { timeout: 10_000 });
    expect(door.textContent).not.toMatch(/You came #/);
    expect(screen.queryByRole('link', { name: /Back to your game|See how your game ended/ })).toBeNull();
    cleanup();
    renderGame(<Room />, asB.services);
    press(await screen.findByRole('button', { name: 'Rematch' }, { timeout: 10_000 }));
    const sheet = await sheetOf('Rematch');
    expect(within(sheet).getByText(/1:30 a round/)).toBeTruthy();
    expect(within(sheet).getByRole('radio', { name: /Nurse/ }).getAttribute('aria-checked')).toBe('true');
    press(within(sheet).getByRole('button', { name: 'Ask for a rematch' }));
    expect(await screen.findByRole('region', { name: 'In the game: 1 of 6' })).toBeTruthy();
    cleanup();

    const asHost = inRooms(server, HOST);
    renderGame(<Room />, asHost.services);
    expect(await screen.findByText('A rematch is waiting.', {}, { timeout: 10_000 })).toBeTruthy();
    press(button('Join the rematch'));
    expect(await screen.findByRole('region', { name: 'In the game: 2 of 6' })).toBeTruthy();
  });

  it('ends with the room\'s order, the player\'s place in it, and the way out of the room', async () => {
    const server = roomServer();
    const room = await lobby(server);
    await server.ask(HOST, { action: 'start', roomId: room.id });
    // Every round but the last is played straight on the server, for both.
    for (let round = 0; round < content.rounds - 1; round++) {
      for (const who of [HOST, B]) await playRoundOf(server, room.id, who);
    }
    const { services } = inRooms(server);
    renderGame(<Room />, services);
    await toFinance();
    press(button(/Play the round/));
    await bPlays(server, room.id);
    press(await screen.findByRole('button', { name: /See how it ended/ }, { timeout: 5_000 }));
    const final = await screen.findByRole('region', { name: 'How the game ended' }, { timeout: 5_000 });
    expect(within(final).getByText(/^Place [12] of 2$/)).toBeTruthy();
    // Everyone in the order, and the multiplayer badges the end earned: both played alike, so both won.
    const standings = within(final).getAllByRole('list').find((list) => list.getAttribute('aria-label') !== 'New badges')!;
    expect(within(standings).getAllByRole('listitem')).toHaveLength(2);
    expect(within(within(final).getByRole('list', { name: 'New badges' })).getByText('First win')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'The end' })).toBeTruthy();
    press(within(final).getByRole('button', { name: 'Leave the game' }));
    expect(await screen.findByRole('button', { name: 'Start a game' })).toBeTruthy();
    expect((await services.store.listRuns())[0]).toMatchObject({ room: true });
    expect(router.dismissTo).not.toHaveBeenCalled();
  });
});

describe('a public game over', () => {
  it('offers another quick game at the end, in place of a rematch', async () => {
    const server = roomServer();
    const seat = (await server.ask(HOST, { action: 'quick', ...VERSIONS })).body.room as { id: string };
    await server.ask(HOST, { action: 'start', roomId: seat.id });
    await playToTheEnd(server, seat.id, [HOST]);
    expect(server.db.rooms.get(seat.id)?.status).toBe('finished');
    const { services } = inRooms(server);
    renderGame(<Room />, services);
    const again = await screen.findByRole('button', { name: 'Another quick game' }, { timeout: 10_000 });
    expect(screen.queryByRole('button', { name: 'Rematch' })).toBeNull();
    press(again);
    expect(await screen.findByRole('region', { name: 'Looking for players' })).toBeTruthy();
  });

  it('asks another player to be friends from the end of the game, without their code', async () => {
    const server = roomServer();
    server.db.names.set(B, 'Bea_7');
    const seat = (await server.ask(HOST, { action: 'quick', ...VERSIONS })).body.room as { id: string };
    await server.ask(B, { action: 'quick', ...VERSIONS });
    await server.ask(HOST, { action: 'start', roomId: seat.id });
    await playToTheEnd(server, seat.id, [HOST, B]);
    const { services } = inRooms(server);
    renderGame(<Room />, services);
    const final = await screen.findByRole('region', { name: 'How the game ended' }, { timeout: 10_000 });
    expect(within(final).getByText('Tap a player to add them as a friend.')).toBeTruthy();
    // The rats open nothing; the other player does.
    expect(within(final).queryByRole('button', { name: /Rat$/ })).toBeNull();
    press(within(final).getByRole('button', { name: /Bea_7/ }));
    const sheet = await sheetOf('Bea_7');
    press(within(sheet).getByRole('button', { name: 'Add friend' }));
    expect(await within(sheet).findByText('Request sent.')).toBeTruthy();
    expect(server.db.requests).toEqual([{ from: HOST, to: B }]);
    expect(disabled(within(sheet).getByRole('button', { name: 'Request sent' }))).toBe(true);
  });

  it('reports a name in a public game, which the player then no longer sees', async () => {
    const server = roomServer();
    server.db.names.set(B, 'Rude_Name');
    const seat = (await server.ask(HOST, { action: 'quick', ...VERSIONS })).body.room as { id: string };
    await server.ask(B, { action: 'quick', ...VERSIONS });
    await server.ask(HOST, { action: 'start', roomId: seat.id });
    const { services } = inRooms(server);
    renderGame(<Room />, services);
    press(await screen.findByRole('button', { name: /^The game: / }, { timeout: 10_000 }));
    press(within(await sheetOf(/^Round 1 of/)).getByRole('button', { name: /Rude_Name/ }));
    const sheet = await sheetOf('Rude_Name');
    press(within(sheet).getByRole('button', { name: 'Report their name' }));
    expect(await within(sheet).findByText('Thank you. You will not see that name again.')).toBeTruthy();
    expect(server.db.reports).toMatchObject([{ reporter: HOST, reported: B }]);
    // The sheet itself now calls them by the rat their id makes of them.
    expect(await screen.findByRole('heading', { name: 'Rat BBBB' })).toBeTruthy();
  });

  it('offers no report in a game among friends', async () => {
    const server = roomServer();
    server.db.names.set(B, 'Bea_7');
    const room = await lobby(server);
    await server.ask(HOST, { action: 'start', roomId: room.id });
    const { services } = inRooms(server);
    renderGame(<Room />, services);
    press(await screen.findByRole('button', { name: /^The game: / }, { timeout: 10_000 }));
    press(within(await sheetOf(/^Round 1 of/)).getByRole('button', { name: /Bea_7/ }));
    const sheet = await sheetOf('Bea_7');
    expect(within(sheet).getByRole('button', { name: 'Offer a loan' })).toBeTruthy();
    expect(within(sheet).queryByRole('button', { name: 'Report their name' })).toBeNull();
  });
});

describe('the room\'s bar through a round turning', () => {
  it('keeps the terms of a loan being typed when the round turns under them, and the order open after', async () => {
    const server = roomServer();
    const room = await lobby(server);
    const { services } = inRooms(server);
    renderGame(<Room />, services);
    press(await screen.findByRole('button', { name: 'Start' }));
    await toFinance();
    press(button(/Play the round/));
    await screen.findByText('Waiting for the others');
    press(screen.getByRole('button', { name: /^The game: / }));
    press(within(await sheetOf(/^Round 1 of/)).getByRole('button', { name: /Rat BBBB/ }));
    press(within(await sheetOf('Rat BBBB')).getByRole('button', { name: 'Offer a loan' }));
    const field = within(await sheetOf('Lend to Rat BBBB')).getByRole('textbox', { name: 'Amount' }) as HTMLInputElement;
    type(field, '4321');
    // The last to play plays: the round turns, the stage goes from the finances to the ledger, and the bar is drawn where the ledger has it.
    await bPlays(server, room.id);
    await screen.findByRole('region', { name: 'After round 1' }, { timeout: 5_000 });
    const still = await sheetOf('Lend to Rat BBBB');
    expect((within(still).getByRole('textbox', { name: 'Amount' }) as HTMLInputElement).value).toBe('4321');
    press(within(still).getByRole('button', { name: 'Close' }));
    // The order, opened in the ledger and kept open while the next round begins.
    press(await screen.findByRole('button', { name: /^The game: / }));
    expect(await sheetOf(/^Round 2 of/)).toBeTruthy();
    press(button('Next round'));
    await screen.findByRole('heading', { name: 'News' });
    expect(await sheetOf(/^Round 2 of/)).toBeTruthy();
  });

  it('keeps the shout\'s wait when the bar moves with the stage', async () => {
    const server = roomServer();
    await lobby(server);
    const { services } = inRooms(server);
    renderGame(<Room />, services);
    press(await screen.findByRole('button', { name: 'Start' }));
    // The bar's square, once the game is on (the lobby's own way to shout goes with the lobby).
    await screen.findByRole('button', { name: /^The game: / }, { timeout: 10_000 });
    press(button('Say something'));
    press(within(await sheetOf('Say something')).getByRole('button', { name: 'Well played!' }));
    await settled();
    // To the finances: the bar is drawn over their tabs now.
    await toFinance();
    press(button('Say something'));
    expect(within(await sheetOf('Say something')).getByText(/^You can say something again in \d+ s$/)).toBeTruthy();
  });

  it('holds a shout heard while a sheet is open, and shows it its whole time once the sheet has gone', async () => {
    const server = roomServer();
    const room = await lobby(server);
    await server.ask(HOST, { action: 'start', roomId: room.id });
    const { services } = inRooms(server);
    renderGame(<Room />, services);
    press(await screen.findByRole('button', { name: /^The game: / }, { timeout: 10_000 }));
    const order = await sheetOf(/^Round 1 of/);
    const shown = () => screen.queryAllByRole('status').some((status) => status.textContent?.endsWith('Rat BBBB😂'));
    const live = new Set<unknown>();
    const set = globalThis.setTimeout;
    const clear = globalThis.clearTimeout;
    const spySet = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((run: () => void, ms?: number, ...rest: unknown[]) => {
      const id = set(() => {
        live.delete(id);
        run();
      }, ms, ...rest);
      if (ms === 4_000) live.add(id);
      return id;
    }) as typeof setTimeout);
    const spyClear = vi.spyOn(globalThis, 'clearTimeout').mockImplementation(((id: ReturnType<typeof setTimeout>) => {
      live.delete(id);
      clear(id);
    }) as typeof clearTimeout);
    try {
      await meanwhile(() => server.ask(B, { action: 'shout', roomId: room.id, shout: 0 }));
      await settled();
      // Behind the sheet: not shown, and its time not running.
      expect(shown()).toBe(false);
      expect(live.size).toBe(0);
      press(within(order).getByRole('button', { name: 'Close' }));
      await waitFor(() => expect(shown()).toBe(true));
      expect(live.size).toBe(1);
    } finally {
      spySet.mockRestore();
      spyClear.mockRestore();
    }
  });

  it('tells the loans of the round before that came to nothing for want of cash, from the player\'s side', async () => {
    const server = roomServer();
    const room = await lobby(server);
    await server.ask(HOST, { action: 'start', roomId: room.id });
    for (const who of [HOST, B]) await playRoundOf(server, room.id, who);
    // The server tells of two loans of the first round that failed: one the player was to lend, one they were to borrow.
    const link = server.link(HOST);
    const failed = (state: RoomState): RoomState => ({
      ...state,
      loans: [
        ...state.loans,
        { id: 'failed-lend', round: state.round - 1, lend: true, other: B, mine: true, amount: 100_000, rateBp: 500, rounds: 2, status: 'failed' },
        { id: 'failed-borrow', round: state.round - 1, lend: false, other: B, mine: false, amount: 200_000, rateBp: 0, rounds: 3, status: 'failed' },
      ],
    });
    const told = {
      ...link,
      api: {
        ...link.api,
        mine: async () => {
          const now = await link.api.mine();
          return now === null ? null : failed(now);
        },
        state: async (id: string) => {
          const now = await link.api.state(id);
          return now === 'gone' ? now : failed(now);
        },
      },
    };
    const { services } = inRooms(server);
    renderGame(<Room />, { ...services, rooms: () => told });
    expect(await screen.findByText('Not lent: you were short of cash', { exact: false }, { timeout: 10_000 })).toBeTruthy();
    expect(screen.getByText('Not lent: Rat BBBB was short of cash', { exact: false })).toBeTruthy();
  });
});

describe('what a room in play draws again', () => {
  it('draws no rat of the bar again when another player shouts or offers a loan elsewhere: only a seat that played', async () => {
    const server = roomServer();
    for (const [user, rat] of [[HOST, 'rat_gold'], [B, 'rat_teal'], [C, 'rat_wine']]) server.db.avatars.set(user, rat);
    const room = await lobby(server);
    await server.ask(C, { action: 'join', code: room.code, ...VERSIONS });
    await server.ask(HOST, { action: 'start', roomId: room.id });
    const { services } = inRooms(server);
    renderGame(<Room />, services);
    const bar = await screen.findByRole('button', { name: /^The game: \d:\d\d left, 0 of 3 have played$/ }, { timeout: 10_000 });
    await steady(() => [...rats.entries()]);
    const ratOf = (user: string) => [...rats.keys()].find((key) => !key.endsWith('/md') && key.includes(user === HOST ? 'gold' : user === B ? 'teal' : 'wine'))!;
    const drawn = () => [HOST, B, C].map((user) => rats.get(ratOf(user)));
    const [host, b, c] = drawn();
    const barBefore = barDrawn();
    // Another player shouts, and one offers a loan to a third: nothing the bar shows has changed.
    await meanwhile(() => server.ask(B, { action: 'shout', roomId: room.id, shout: 1 }));
    await meanwhile(() => server.ask(B, { action: 'loan', roomId: room.id, to: C, lend: true, amount: 200_000, rateBp: 500, rounds: 3 }));
    await settled();
    // (The shout shows B's rat, larger, in a toast of its own: counted apart.)
    expect(rats.get(ratOf(B) + '/md')).toBeGreaterThan(0);
    expect(drawn()).toEqual([host, b, c]);
    // Nor its button: the room's clock is the same moment at every look, though the skew measured with it moves by a few milliseconds.
    expect(barDrawn()).toBe(barBefore);
    // B plays: B's seat on the bar is drawn again, with its tick; the others are not.
    await playRoundOf(server, room.id, B);
    await meanwhile(() => server.ask(B, { action: 'state', roomId: room.id }));
    await waitFor(() => expect(bar.getAttribute('aria-label')).toMatch(/1 of 3 have played$/));
    await settled();
    expect(rats.get(ratOf(HOST))).toBe(host);
    expect(rats.get(ratOf(C))).toBe(c);
    expect(rats.get(ratOf(B))).toBeGreaterThan(b!);
  });

  it('counts the round down once a second, not once a frame: the bar\'s rats are not drawn again for it', async () => {
    const server = roomServer();
    const room = await lobby(server);
    await server.ask(HOST, { action: 'start', roomId: room.id });
    const { services } = inRooms(server);
    const renders: Renders = { count: 0 };
    renderGame(
      <Counted into={renders}>
        <Room />
      </Counted>,
      services,
    );
    const bar = await screen.findByRole('button', { name: /^The game: / }, { timeout: 10_000 });
    await steady(() => [renders.count, ...rats.values()]);
    const before = renders.count;
    const barBefore = barDrawn();
    const seats = [...rats.values()];
    const shown = bar.getAttribute('aria-label');
    for (let tenth = 0; tenth < 23; tenth++) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
    }
    expect(bar.getAttribute('aria-label')).not.toBe(shown);
    expect(renders.count - before).toBeGreaterThanOrEqual(1);
    expect(renders.count - before).toBeLessThanOrEqual(5);
    // The bar's button, the one thing that ticks: once a second over 2.3 s is two or three drawings; a clock told twice a second would be four or five.
    expect(barDrawn() - barBefore).toBeGreaterThanOrEqual(2);
    expect(barDrawn() - barBefore).toBeLessThanOrEqual(3);
    expect([...rats.values()]).toEqual(seats);
    void room;
  });

  it('draws no line of the room\'s order under the ledger again while the next round is played by another', async () => {
    const server = roomServer();
    for (const [user, rat] of [[HOST, 'rat_gold'], [B, 'rat_teal']]) server.db.avatars.set(user, rat);
    const room = await lobby(server);
    const { services } = inRooms(server);
    renderGame(<Room />, services);
    press(await screen.findByRole('button', { name: 'Start' }));
    await toFinance();
    press(button(/Play the round/));
    await bPlays(server, room.id);
    const order = await screen.findByRole('region', { name: 'After round 1' }, { timeout: 5_000 });
    const lineRat = (name: string) => within(order).getByText(name).closest('[role="listitem"]')!.querySelector('[data-rat]')!.getAttribute('data-rat')!;
    const [host, b] = [lineRat('Rat AAAA'), lineRat('Rat BBBB')];
    await steady(() => [...rats.entries()]);
    const [hostDrawn, bDrawn] = [rats.get(host), rats.get(b)];
    // B plays the next round while the player reads the ledger: who has played is the bar's, never the order's.
    await playRoundOf(server, room.id, B);
    await meanwhile(() => server.ask(B, { action: 'shout', roomId: room.id, shout: 2 }));
    await settled();
    // (B's shout shows B's rat larger, in its toast: counted apart.)
    expect(rats.get(b + '/md')).toBeGreaterThan(0);
    // B's rat in the order is the one on the bar too: the bar's seat is drawn once more, with its tick, and the order's line not at all.
    expect([rats.get(host), rats.get(b)]).toEqual([hostDrawn, bDrawn! + 1]);
    expect(screen.getByRole('button', { name: /^The game: .* 1 of 2 have played$/ })).toBeTruthy();
    expect(within(order).getAllByRole('listitem')).toHaveLength(2);
  });

  it('keeps one timer for the shouts on screen, however many come', async () => {
    const server = roomServer();
    const room = await lobby(server);
    await server.ask(C, { action: 'join', code: room.code, ...VERSIONS });
    await server.ask(HOST, { action: 'start', roomId: room.id });
    const { services } = inRooms(server);
    renderGame(<Room />, services);
    await screen.findByRole('button', { name: /^The game: / }, { timeout: 10_000 });
    const live = new Set<unknown>();
    const set = globalThis.setTimeout;
    const clear = globalThis.clearTimeout;
    const spySet = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((run: () => void, ms?: number, ...rest: unknown[]) => {
      const id = set(() => {
        live.delete(id);
        run();
      }, ms, ...rest);
      if (ms === 4_000) live.add(id);
      return id;
    }) as typeof setTimeout);
    const spyClear = vi.spyOn(globalThis, 'clearTimeout').mockImplementation(((id: ReturnType<typeof setTimeout>) => {
      live.delete(id);
      clear(id);
    }) as typeof clearTimeout);
    try {
      let most = 0;
      for (const [who, n] of [[B, 0], [C, 1], [HOST, 2]] as const) {
        await meanwhile(() => server.ask(who, { action: 'shout', roomId: room.id, shout: n }));
        await settled();
        most = Math.max(most, live.size);
      }
      await waitFor(() => expect(screen.getAllByRole('status').filter((status) => /Rat (AAAA|BBBB|CCCC)/.test(status.textContent ?? '')).length).toBeGreaterThan(0));
      expect(most).toBe(1);
    } finally {
      spySet.mockRestore();
      spyClear.mockRestore();
    }
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
    // Alone, with three rats that have played already: the lobby gives way to the life, with the room's bar over it.
    const bar = await screen.findByRole('button', { name: /^The game: \d:\d\d left, 3 of 4 have played$/ });
    expect(screen.queryByRole('region', { name: 'Looking for players' })).toBeNull();
    expect(server.db.members.filter((m) => m.user_id !== HOST)).toHaveLength(3);
    expect([...server.db.rooms.values()][0].status).toBe('playing');
    press(bar);
    const order = await sheetOf(/^Round 1 of \d+ · \d:\d\d left$/);
    expect(within(order).getAllByText('Bot')).toHaveLength(3);
    // A rat is named by its kind, and is not one to lend money to: its line opens nothing.
    expect(within(order).getAllByText(/^(Saver|Index|Crypto|Show-off|Landlord) Rat$/)).toHaveLength(3);
    expect(within(order).queryByRole('button', { name: /Rat$/ })).toBeNull();
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
    expect(await screen.findByRole('button', { name: /^The game: \d:\d\d left, 2 of 4 have played$/ }, { timeout: 5_000 })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Looking for players' })).toBeNull();
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

describe('the clocks of a room', () => {
  it('count by the game\'s clock: one held still (a scene\'s day, as the web\'s shot holds the browser\'s) holds the count still', async () => {
    const { services } = inRooms();
    // A day long past, held: the count is the server's start less the server's now, whatever the phone's clock says.
    renderGame(<Room />, { ...services, now: () => Date.UTC(2026, 9, 22, 12) });
    press(await screen.findByRole('button', { name: 'Quick game' }));
    const clock = await screen.findByRole('region', { name: 'Looking for players' });
    const first = within(clock).getByRole('timer').textContent;
    expect(first).toMatch(/^Starts in [12]:\d\d$/);
    // More than a second later, by the phone's own clock: nothing has moved.
    await act(() => new Promise((done) => setTimeout(done, 1_200)));
    expect(within(clock).getByRole('timer').textContent).toBe(first);
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
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/en/room'));
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
