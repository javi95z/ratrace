// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryStore } from '@/session/memory';
import { memoryServices, renderGame } from '@/testing/render';
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

describe('the front door', () => {
  it('offers a new life to someone new, and says where it will be kept', async () => {
    renderGame(<Home />, memoryServices());
    expect((await screen.findByRole('link', { name: 'New life' })).getAttribute('href')).toBe('/new');
    expect(screen.queryByRole('link', { name: /Continue your life/ })).toBeNull();
    expect(screen.getByText('Your life is saved on this device after every step.')).toBeTruthy();
  });

  it('leads to the collection and to the records', async () => {
    renderGame(<Home />, memoryServices());
    expect((await screen.findByRole('link', { name: 'Collection' })).getAttribute('href')).toBe('/collection');
    expect(screen.getByRole('link', { name: 'Records' }).getAttribute('href')).toBe('/records');
  });

  it('offers the life in progress first, with who and where', async () => {
    const services = memoryServices();
    await services.sessions.start('engineer');
    renderGame(<Home />, services);
    const carry = await screen.findByRole('link', { name: /Continue your life/ });
    expect(carry.getAttribute('href')).toBe('/play');
    expect(carry.textContent).toContain('Software engineer · age 22 · Madrid');
    expect(screen.getByRole('link', { name: 'New life' })).toBeTruthy();
  });

  it('offers a look at the life that just ended, and nothing to continue', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    while (!session.view().finished) {
      while (session.view().phase === 'cards') await session.answerCard(0);
      await session.playRound({ orders: [] });
    }
    renderGame(<Home />, services);
    expect((await screen.findByRole('link', { name: 'See how your last life ended' })).getAttribute('href')).toBe('/play');
    expect(screen.queryByRole('link', { name: /Continue your life/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'New life' })).toBeTruthy();
  });

  it('says so plainly when the browser is not saving, instead of promising that it is', async () => {
    renderGame(<Home />, memoryServices(new MemoryStore(), { savingOff: true }));
    expect((await screen.findByRole('alert')).textContent).toContain('This browser is not saving right now');
    expect(screen.queryByText(/saved on this device/)).toBeNull();
  });

  it('explains a saved life that could not be opened', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    await services.store.saveGame({ ...((await services.store.loadGame()) as never as object), contentVersion: '0.0.1' } as never);
    renderGame(<Home />, services);
    expect((await screen.findByRole('status')).textContent).toContain('played under older rules');
  });

  it('tells apart a saved life from a newer version of the game', async () => {
    const services = memoryServices();
    await services.sessions.start('nurse');
    await services.store.saveGame({ ...((await services.store.loadGame()) as never as object), format: 2 } as never);
    renderGame(<Home />, services);
    expect((await screen.findByRole('status')).textContent).toContain('newer version of the game');
  });
});
