// @vitest-environment jsdom
import { cleanup, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FinishedRun } from '@/session/types';
import { memoryServices, renderGame } from '@/testing/render';
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
    expect(screen.getByRole('heading', { level: 1, name: 'Records' })).toBeTruthy();
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

  it('lists every past life, the latest first, with its score, how it ended and its graph', async () => {
    const services = memoryServices();
    await services.store.addRun(run('old', { lifeId: 'nurse', score: 301, finishedAt: Date.UTC(2026, 0, 5, 12), badges: ['first_100k'] }));
    await services.store.addRun(run('new', { lifeId: 'civil_servant', score: 402, finishedAt: Date.UTC(2026, 9, 13, 12), escapedAtRound: 12, badges: ['first_100k', 'escaped', 'millionaire'], cities: ['madrid', 'dubai'] }));
    renderGame(<Records />, services);

    const history = await screen.findByRole('region', { name: 'Past lives' });
    const lives = within(history).getAllByRole('listitem');
    expect(lives).toHaveLength(2);
    expect(lives[0].textContent).toContain('Civil servant');
    expect(lives[0].textContent).toContain('Score 402');
    expect(lives[0].textContent).toContain('Out at 46');
    expect(lives[0].textContent).toContain('3 badges');
    expect(lives[0].textContent).toContain('13 Oct 2026');
    expect(lives[0].textContent).toContain('Madrid · Dubai');
    expect(within(lives[0]).getByRole('img', { name: 'Net worth through this life' })).toBeTruthy();
    expect(lives[1].textContent).toContain('Nurse');
    expect(lives[1].textContent).toContain('Never escaped');
    expect(lives[1].textContent).toContain('1 badge');
  });
});
