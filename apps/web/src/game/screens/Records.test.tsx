// @vitest-environment jsdom
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CONTENT_VERSION } from '@ratrace/content';
import { ENGINE_VERSION } from '@ratrace/engine';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FinishedRun } from '@ratrace/core/session/types';
import { memoryServices, renderGame } from '@/testing/render';
import { roomServer } from '@/testing/roomServer';
import { Records } from './Records';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className, 'aria-label': label }: { href: string; children: ReactNode; className?: string; 'aria-label'?: string }) => (
    <a href={href} className={className} aria-label={label}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/records',
}));

afterEach(cleanup);

const run = (runId: string, over: Partial<FinishedRun> = {}): FinishedRun => ({
  format: 1, runId, engineVersion: 'e', contentVersion: 'c', lifeId: 'nurse', seed: 's', log: [], finishedAt: Date.UTC(2026, 9, 13, 12), score: 300, netWorth: 50_000_000, status: 20,
  escapedAtRound: null, bankruptcies: 0, history: [300_000, 2_000_000, 50_000_000], badges: [], cities: ['madrid'], verified: false, ...over,
});

describe('the records', () => {
  it('says there is nothing yet before a first life is finished', async () => {
    renderGame(<Records />, memoryServices());
    expect(await screen.findByText('No life finished yet. Your first one will appear here.')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'History' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Personal bests' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Back' }).getAttribute('href')).toBe('/');
  });

  it('shows the personal bests, each with the life that holds it', async () => {
    const services = memoryServices();
    await services.store.addRun(run('a', { lifeId: 'nurse', score: 310, netWorth: 90_000_000, status: 15, escapedAtRound: 14, finishedAt: 1 }));
    await services.store.addRun(run('b', { lifeId: 'engineer', score: 420, netWorth: 40_000_000, status: 60, bankruptcies: 2, finishedAt: 2 }));
    renderGame(<Records />, services);

    const bests = await screen.findByRole('region', { name: 'Personal bests' });
    const row = (label: string) => within(bests).getByText(label).closest('li') as HTMLElement;
    expect(row('Best score').textContent).toContain('420');
    expect(row('Best score').textContent).toContain('Software engineer');
    expect(row('Greatest net worth').textContent).toContain('$900,000');
    expect(row('Greatest net worth').textContent).toContain('Nurse');
    expect(row('Youngest escape').textContent).toContain('age 50');
    expect(row('Most status').textContent).toContain('60');
    expect(screen.getByText('2 lives lived')).toBeTruthy();
    expect(screen.getByText('1 escape')).toBeTruthy();
    expect(screen.getByText('2 bankruptcies')).toBeTruthy();
  });

  it('says so when nobody has escaped yet', async () => {
    const services = memoryServices();
    await services.store.addRun(run('a'));
    renderGame(<Records />, services);
    const bests = await screen.findByRole('region', { name: 'Personal bests' });
    expect((within(bests).getByText('Youngest escape').closest('li') as HTMLElement).textContent).toContain('None yet');
  });

  it('lists every past life, the latest first, a line each, and opens the whole of one on a tap', async () => {
    const services = memoryServices();
    await services.store.addRun(run('old', { lifeId: 'nurse', score: 301, finishedAt: Date.UTC(2026, 0, 5, 12), badges: ['first_100k'] }));
    await services.store.addRun(run('new', { lifeId: 'civil_servant', score: 402, finishedAt: Date.UTC(2026, 9, 13, 12), escapedAtRound: 12, badges: ['first_100k', 'escaped', 'millionaire'], cities: ['madrid', 'dubai'] }));
    const user = userEvent.setup();
    renderGame(<Records />, services);

    const history = await screen.findByRole('region', { name: 'Past lives' });
    const lives = within(history).getAllByRole('listitem');
    expect(lives).toHaveLength(2);
    expect(lives[0].textContent).toContain('Civil servant');
    expect(lives[0].textContent).toContain('402');
    expect(lives[0].textContent).toContain('13 Oct 2026');
    expect(lives[1].textContent).toContain('Nurse');
    // The rest is in a sheet.
    await user.click(within(lives[0]).getByRole('button'));
    const sheet = screen.getByRole('dialog', { name: 'Civil servant' });
    expect(sheet.textContent).toContain('Score 402');
    expect(sheet.textContent).toContain('Out at 46');
    expect(sheet.textContent).toContain('3 badges');
    expect(sheet.textContent).toContain('Madrid · Dubai');
    expect(within(sheet).getByRole('img', { name: 'Net worth through this life' })).toBeTruthy();
  });

  it('marks the lives the server played, which are the ones in the rankings', async () => {
    const services = memoryServices();
    await services.store.addRun(run('casual-1', { finishedAt: Date.UTC(2026, 9, 12) }));
    await services.store.addRun(run('ranked-1', { ranked: true, seed: '', finishedAt: Date.UTC(2026, 9, 13) }));
    renderGame(<Records />, services);
    const lives = within(await screen.findByRole('region', { name: 'Past lives' })).getAllByRole('listitem');
    expect(lives).toHaveLength(2);
    expect(within(lives[0]).getByText('Ranked')).toBeTruthy();
    expect(within(lives[1]).queryByText('Ranked')).toBeNull();
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
    // B's device keeps their life in the game among its finished ones, under the id of that life.
    const services = memoryServices();
    const gameId = server.db.members.find((m) => m.user_id === B)?.game_id as string;
    await services.store.addRun(run(gameId, { lifeId: 'nurse', score: 300, room: true }));
    renderGame(<Records />, { ...services, rooms: () => server.link(B), schedule: () => () => {} });
    const section = await screen.findByRole('region', { name: 'Multiplayer' });
    // That life is told with its game, not again among the lives lived alone.
    expect(screen.queryByRole('region', { name: 'Past lives' })).toBeNull();
    const row = within(section).getByRole('button', { name: /Nurse/ });
    expect(row.textContent).toMatch(/#[12] of 2/);
    expect(row.textContent).toContain('2 players');
    await userEvent.setup().click(row);
    const sheet = screen.getByRole('dialog', { name: 'Nurse' });
    expect(within(sheet).getAllByRole('listitem')).toHaveLength(2);
    expect(within(sheet).getByText('You')).toBeTruthy();
    // Everyone's city and job, and the player's own life in it.
    expect(within(sheet).getAllByText(/Madrid · /)).toHaveLength(2);
    expect(within(sheet).getByRole('region', { name: 'Your life' }).textContent).toContain('Score 300');
    expect(within(sheet).getByText(/90 seconds|1:30/)).toBeTruthy();
    // A whole game played on the server first: a few seconds alone, more on a busy machine.
  }, 60_000);

  it('has no multiplayer section for a player who has played none', async () => {
    renderGame(<Records />, { ...memoryServices(), rooms: () => roomServer().link('cccccccc-cccc-4ccc-8ccc-cccccccccccc'), schedule: () => () => {} });
    expect(await screen.findByText('No life finished yet. Your first one will appear here.')).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('region', { name: 'Multiplayer' })).toBeNull();
  });
});
