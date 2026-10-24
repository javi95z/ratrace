// @vitest-environment jsdom
import { CONTENT_VERSION } from '@ratrace/content';
import { formatFor } from '@ratrace/core/lib/format';
import type { FinishedRun } from '@ratrace/core/session/types';
import type { RoundActions, RoundState } from '@ratrace/core/game/store';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { ENGINE_VERSION } from '@ratrace/engine';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { roomServer } from '../../../../web/src/testing/roomServer';
import { useGame } from '../context';
import { memoryServices, renderGame, router } from '../../testing/render';
import { Counted, settled } from '../../testing/renders';
import type { Renders } from '../../testing/renders';
import { Records } from './Records';

afterEach(cleanup);

// react-native-web drops a pressable's hint (iOS and Android say it): the hints the screen gives are kept here, with the list that draws every row.
const hints = vi.hoisted(() => [] as string[]);
vi.mock('react-native', async (original) => {
  const native = await original<typeof import('react-native')>();
  const { everyRow } = await import('../../testing/fakes');
  return {
    ...native,
    FlatList: everyRow(native.FlatList as never),
    Pressable: (props: { accessibilityHint?: string }) => {
      if (props.accessibilityHint !== undefined) hints.push(props.accessibilityHint);
      return createElement(native.Pressable, props as never);
    },
  };
});
afterEach(() => {
  hints.length = 0;
});

const run = (runId: string, over: Partial<FinishedRun> = {}): FinishedRun => ({
  format: 1, runId, engineVersion: 'e', contentVersion: 'c', lifeId: 'nurse', seed: 's', log: [], finishedAt: Date.UTC(2026, 9, 13, 12), score: 300, netWorth: 50_000_000, status: 20,
  escapedAtRound: null, bankruptcies: 0, history: [300_000, 2_000_000, 50_000_000], badges: [], cities: ['madrid'], verified: false, ...over,
});

/** The region of the personal bests, once the lives are read. */
const bestsOf = async () => screen.findByRole('region', { name: 'Personal bests' });
/** A best's line: the row of the list of bests that holds its label. */
const bestRow = (bests: HTMLElement, label: string) => within(bests).getByText(label).closest('[role="listitem"]') as HTMLElement;
/** The list of the past lives, named as the web's section is: the page's own list, under its heading. */
const historyOf = async () => {
  await screen.findByRole('heading', { name: 'Past lives' });
  return screen.getByRole('list', { name: 'Past lives' });
};
/** The lines of the past lives: the lines of that list itself (the bests above them are a list of their own, in its header). */
const livesOf = async () => {
  const history = await historyOf();
  return within(history).getAllByRole('listitem').filter((item) => item.parentElement?.closest('[role="list"]') === history);
};
/** A sheet, by its title. */
const sheetOf = (title: string) => screen.getByRole('heading', { name: title }).closest('[aria-modal="true"]') as HTMLElement;

describe('the records', () => {
  it('says there is nothing yet before a first life is finished', async () => {
    renderGame(<Records />, memoryServices());
    expect(await screen.findByText('No life finished yet. Your first one will appear here.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'History' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Personal bests' })).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: 'Back' }));
    expect(router.dismissTo).toHaveBeenCalledWith('/en');
  });

  it('says it is reading the device until the lives are read', async () => {
    renderGame(<Records />, memoryServices());
    expect(screen.getByText('Loading…')).toBeTruthy();
    await screen.findByText('No life finished yet. Your first one will appear here.');
    expect(screen.queryByText('Loading…')).toBeNull();
  });

  it('shows the personal bests, each with the life that holds it', async () => {
    const services = memoryServices();
    await services.store.addRun(run('a', { lifeId: 'nurse', score: 310, netWorth: 90_000_000, status: 15, escapedAtRound: 14, finishedAt: 1 }));
    await services.store.addRun(run('b', { lifeId: 'engineer', score: 420, netWorth: 40_000_000, status: 60, bankruptcies: 2, finishedAt: 2 }));
    renderGame(<Records />, services);

    const bests = await bestsOf();
    expect(within(bests).getByRole('heading', { name: 'Personal bests' })).toBeTruthy();
    expect(bestRow(bests, 'Best score').textContent).toContain('420');
    expect(bestRow(bests, 'Best score').textContent).toContain('Software engineer');
    expect(bestRow(bests, 'Greatest net worth').textContent).toContain('$900,000');
    expect(bestRow(bests, 'Greatest net worth').textContent).toContain('Nurse');
    expect(bestRow(bests, 'Youngest escape').textContent).toContain('age 50');
    expect(bestRow(bests, 'Most status').textContent).toContain('60');
    expect(screen.getByText('2 lives lived')).toBeTruthy();
    expect(screen.getByText('1 escape')).toBeTruthy();
    expect(screen.getByText('2 bankruptcies')).toBeTruthy();
  });

  it('says so when nobody has escaped yet', async () => {
    const services = memoryServices();
    await services.store.addRun(run('a'));
    renderGame(<Records />, services);
    const bests = await bestsOf();
    expect(bestRow(bests, 'Youngest escape').textContent).toContain('None yet');
    expect(bestRow(bests, 'Youngest escape').textContent).toContain('—');
  });

  it('lists every past life, the latest first, a line each, and opens the whole of one on a tap', async () => {
    const services = memoryServices();
    await services.store.addRun(run('old', { lifeId: 'nurse', score: 301, finishedAt: Date.UTC(2026, 0, 5, 12), badges: ['first_100k'] }));
    await services.store.addRun(run('new', { lifeId: 'civil_servant', score: 402, finishedAt: Date.UTC(2026, 9, 13, 12), escapedAtRound: 12, badges: ['first_100k', 'escaped', 'millionaire'], cities: ['madrid', 'dubai'] }));
    renderGame(<Records />, services);

    const lives = await livesOf();
    expect(lives).toHaveLength(2);
    // Each line says that it opens the whole of its life (the web's `aria-haspopup="dialog"`, in the phone's own words).
    expect(hints).toContain('Shows the whole of this life');
    expect(lives[0].textContent).toContain('Civil servant');
    expect(lives[0].textContent).toContain('402');
    expect(lives[0].textContent).toContain('13 Oct 2026');
    expect(lives[1].textContent).toContain('Nurse');
    // Each line has the face the life is chosen by, on the sky of the city it begins in.
    expect(lives[0].querySelector('[data-sprite="portrait.civil_servant.22"]')).not.toBeNull();
    expect(lives[0].querySelector('[data-sprite^="backdrop."]')).not.toBeNull();
    // The rest is in a sheet.
    fireEvent.click(within(lives[0]).getByRole('button'));
    const sheet = sheetOf('Civil servant');
    expect(sheet.textContent).toContain('Score 402');
    expect(sheet.textContent).toContain('Out at 46');
    expect(sheet.textContent).toContain('3 badges');
    expect(sheet.textContent).toContain('Madrid · Dubai');
    expect(sheet.textContent).toContain('After inflation');
    expect(within(sheet).getByRole('img', { name: 'Net worth through this life' })).toBeTruthy();
    // And it closes.
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Civil servant' })).toBeNull());
  });

  it('tells a life that never left the rat race so, in the colour of the rest of its lines', async () => {
    const services = memoryServices();
    await services.store.addRun(run('stuck', { lifeId: 'engineer', score: 250, netWorth: 12_345_600, badges: [] }));
    renderGame(<Records />, services);
    fireEvent.click(within((await livesOf())[0]).getByRole('button'));
    const sheet = sheetOf('Software engineer');
    expect(sheet.textContent).toContain('Never escaped · No badges');
    // The net worth at the end, short, as the web writes it.
    expect(sheet.textContent).toContain(formatFor('en').compact(12_345_600));
  });

  it('marks the lives the server played, which are the ones in the rankings', async () => {
    const services = memoryServices();
    await services.store.addRun(run('casual-1', { finishedAt: Date.UTC(2026, 9, 12) }));
    await services.store.addRun(run('ranked-1', { ranked: true, seed: '', finishedAt: Date.UTC(2026, 9, 13) }));
    renderGame(<Records />, services);
    const lives = await livesOf();
    expect(lives).toHaveLength(2);
    expect(within(lives[0]).getByText('Ranked')).toBeTruthy();
    expect(within(lives[1]).queryByText('Ranked')).toBeNull();
    // Its sheet says so too, with the week of the challenge it was.
    fireEvent.click(within(lives[0]).getByRole('button'));
    expect(within(sheetOf('Nurse')).getByText('Ranked')).toBeTruthy();
  });

  it('tells a practice of a week\'s challenge in its sheet', async () => {
    const services = memoryServices();
    await services.store.addRun(run('practice-1', { challenge: '2026-W42' }));
    renderGame(<Records />, services);
    fireEvent.click(within((await livesOf())[0]).getByRole('button'));
    expect(within(sheetOf('Nurse')).getByText('Practice 2026-W42')).toBeTruthy();
  });

  it('names the list of past lives as the web names its section, and has none while no life is finished', async () => {
    renderGame(<Records />, memoryServices());
    await screen.findByText('No life finished yet. Your first one will appear here.');
    expect(screen.queryByRole('list', { name: 'Past lives' })).toBeNull();
    cleanup();
    const services = memoryServices();
    await services.store.addRun(run('a'));
    renderGame(<Records />, services);
    const history = await historyOf();
    // The page above the lines is the list's header; its lines are the lives, each a button that opens its sheet.
    expect((await livesOf()).map((life) => within(life).getAllByRole('button').length)).toEqual([1]);
    expect(history.contains(screen.getByRole('region', { name: 'Personal bests' }))).toBe(true);
  });

  it('has no multiplayer section for a player who has played none, signed in or not', async () => {
    const services = memoryServices();
    await services.store.addRun(run('alone'));
    renderGame(<Records />, services);
    await livesOf();
    expect(screen.queryByRole('region', { name: 'Multiplayer' })).toBeNull();
    expect(screen.queryByText('Multiplayer')).toBeNull();
    cleanup();
    renderGame(<Records />, { ...memoryServices(), rooms: () => roomServer().link('cccccccc-cccc-4ccc-8ccc-cccccccccccc'), schedule: () => () => {} });
    expect(await screen.findByText('No life finished yet. Your first one will appear here.')).toBeTruthy();
    await settled();
    expect(screen.queryByRole('region', { name: 'Multiplayer' })).toBeNull();
  });

  it('lists the multiplayer games over, with where the player came and everyone in a sheet, even before a life of their own', async () => {
    const HOST = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const versions = { engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION };
    const server = roomServer();
    const opened = (await server.ask(HOST, { action: 'open', lifeId: 'nurse', seconds: 90, ...versions })).body.room as { id: string; code: string };
    await server.ask(B, { action: 'join', code: opened.code, ...versions });
    await server.ask(HOST, { action: 'start', roomId: opened.id });
    for (let guard = 0; guard < 50 && server.db.rooms.get(opened.id)?.status !== 'finished'; guard++) {
      server.wait(96_000);
      await server.ask(HOST, { action: 'state', roomId: opened.id });
    }
    // B's phone keeps their life in the game among its finished ones, under the id of that life.
    const services = memoryServices();
    const gameId = server.db.members.find((m) => m.user_id === B)?.game_id as string;
    await services.store.addRun(run(gameId, { lifeId: 'nurse', score: 300, room: true }));
    renderGame(<Records />, { ...services, rooms: () => server.link(B), schedule: () => () => {} });
    const section = await screen.findByRole('region', { name: 'Multiplayer' });
    // That life is told with its game, not again among the lives lived alone.
    expect(screen.queryByRole('list', { name: 'Past lives' })).toBeNull();
    const row = within(section).getByRole('button', { name: /Nurse/ });
    expect(row.textContent).toMatch(/#[12] of 2/);
    expect(row.textContent).toContain('2 players');
    fireEvent.click(row);
    const sheet = sheetOf('Nurse');
    expect(within(within(sheet).getAllByRole('list')[0]).getAllByRole('listitem')).toHaveLength(2);
    expect(within(sheet).getByText('You')).toBeTruthy();
    // Everyone's city and job, and the player's own life in it.
    expect(within(sheet).getAllByText(/Madrid · /)).toHaveLength(2);
    expect(within(sheet).getByRole('region', { name: 'Your life' }).textContent).toContain('Score 300');
    expect(within(sheet).getByText(/1:30 a round/)).toBeTruthy();
    // A whole game played on the server first: a few seconds alone, more on a busy machine.
  }, 60_000);

  it('opens with the sheet of a game it is given open, once the games are known (a scene\'s initial state)', async () => {
    const HOST = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const versions = { engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION };
    const server = roomServer();
    const opened = (await server.ask(HOST, { action: 'open', lifeId: 'nurse', seconds: 90, ...versions })).body.room as { id: string; code: string };
    await server.ask(B, { action: 'join', code: opened.code, ...versions });
    await server.ask(HOST, { action: 'start', roomId: opened.id });
    for (let guard = 0; guard < 50 && server.db.rooms.get(opened.id)?.status !== 'finished'; guard++) {
      server.wait(96_000);
      await server.ask(HOST, { action: 'state', roomId: opened.id });
    }
    renderGame(<Records game={opened.id} />, { ...memoryServices(), rooms: () => server.link(HOST), schedule: () => () => {} });
    const heading = await screen.findByRole('heading', { name: 'Nurse' }, { timeout: 10_000 });
    const sheet = heading.closest('[aria-modal="true"]') as HTMLElement;
    expect(within(within(sheet).getAllByRole('list')[0]).getAllByRole('listitem')).toHaveLength(2);
  }, 60_000);

  it('lists the lives of games with others the phone keeps where the server tells of no game, each opening in a sheet', async () => {
    const services = memoryServices();
    await services.store.addRun(run('together', { lifeId: 'engineer', score: 444, room: true }));
    await services.store.addRun(run('alone', { lifeId: 'nurse' }));
    // The server knows of no game of theirs.
    renderGame(<Records />, { ...services, rooms: () => roomServer().link('cccccccc-cccc-4ccc-8ccc-cccccccccccc'), schedule: () => () => {} });
    const section = await screen.findByRole('region', { name: 'Multiplayer' });
    const line = within(section).getByRole('button', { name: /Software engineer/ });
    expect(line.textContent).toContain('444');
    // Among the lives alone, only the nurse's.
    expect((await livesOf()).map((life) => life.textContent)).toEqual([expect.stringContaining('Nurse')]);
    fireEvent.click(line);
    expect(sheetOf('Software engineer').textContent).toContain('444');
  });

  it('opens with the sheet of a life it is given open, once the lives are read (a scene\'s initial state)', async () => {
    const services = memoryServices();
    await services.store.addRun(run('a', { lifeId: 'nurse', finishedAt: 1 }));
    await services.store.addRun(run('b', { lifeId: 'engineer', score: 444, finishedAt: 2 }));
    renderGame(<Records opened="a" />, services);
    expect((await screen.findByRole('heading', { name: 'Nurse' })).closest('[aria-modal="true"]')).not.toBeNull();
    expect(screen.queryByRole('heading', { name: 'Software engineer' })).toBeNull();
  });

  it('speaks Spanish', async () => {
    const services = memoryServices();
    await services.store.addRun(run('a', { escapedAtRound: 14 }));
    renderGame(<Records />, services, 'es');
    expect(await screen.findByRole('heading', { name: 'Historial' })).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Tus mejores marcas' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Vidas pasadas' })).toBeTruthy();
    // The nurse holds every best, and is the one past life.
    expect(screen.getAllByText('Enfermera')).toHaveLength(5);
  });
});

describe('what the records are drawn again for', () => {
  it('is not drawn again by a change of the game it does not show: a life begun, the news left, a card answered', async () => {
    const services = memoryServices();
    await services.store.addRun(run('a'));
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
          <Records />
        </Counted>
      </>,
      services,
    );
    await livesOf();
    await settled(() => probe.state?.start('nurse'));
    await settled(() => probe.state?.leaveNews());
    const before = renders.count;
    await settled(() => probe.state?.pick(0));
    await settled(() => probe.state?.afterCard());
    expect(probe.state?.view?.answered).toBe(1);
    expect(renders.count).toBe(before);
  });

  it('draws a line of a past life once: opening its sheet draws none of the lines again', async () => {
    const services = memoryServices();
    await services.store.addRun(run('a', { lifeId: 'nurse', finishedAt: 1 }));
    await services.store.addRun(run('b', { lifeId: 'engineer', finishedAt: 2 }));
    renderGame(<Records />, services);
    const lives = await livesOf();
    const { spriteRenders } = await import('../../testing/render');
    const before = spriteRenders.get('portrait.nurse.22');
    fireEvent.click(within(lives[0]).getByRole('button'));
    expect(sheetOf('Software engineer')).not.toBeNull();
    expect(spriteRenders.get('portrait.nurse.22')).toBe(before);
  });
});
