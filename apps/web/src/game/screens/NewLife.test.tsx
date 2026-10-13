// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newProfile } from '@/session/types';
import type { SavedGame } from '@/session/types';
import { memoryServices, renderGame, setWidth } from '@/testing/render';
import { NewLife } from './NewLife';

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
  useRouter: () => router,
  usePathname: () => '/new',
}));

beforeEach(() => {
  setWidth('phone');
  router.push.mockClear();
  router.replace.mockClear();
});
afterEach(cleanup);

const saved = async (services: ReturnType<typeof memoryServices>) => (await services.store.loadGame()) as SavedGame | null;

describe('choosing a life', () => {
  it('offers the three starting lives, and shows what unlocks the others', async () => {
    renderGame(<NewLife />, memoryServices());
    const lives = screen.getAllByRole('radio');
    expect(lives).toHaveLength(11);
    expect(lives.filter((life) => !(life as HTMLButtonElement).disabled).map((life) => within(life).getByText(/Nurse|Software engineer|Civil servant/).textContent)).toEqual([
      'Nurse', 'Software engineer', 'Civil servant',
    ]);
    expect(screen.getAllByText(/To unlock/)).toHaveLength(8);
  });

  it('opens a life the player has unlocked, and marks it', async () => {
    const services = memoryServices();
    await services.store.saveProfile({ ...newProfile(), unlocked: { rider: { at: 5, gameId: 'g' } } });
    const user = userEvent.setup();
    renderGame(<NewLife />, services);
    const rider = await screen.findByRole('radio', { name: /^Delivery rider/ });
    await waitFor(() => expect((rider as HTMLButtonElement).disabled).toBe(false));
    expect(screen.getAllByText(/To unlock/)).toHaveLength(7);
    await user.click(rider);
    await user.click(screen.getByRole('button', { name: 'Start this life' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/play'));
    expect((await saved(services))?.lifeId).toBe('rider');
  });

  it('starts the life chosen and goes to it, leaving no way back onto this screen', async () => {
    const services = memoryServices();
    const user = userEvent.setup();
    renderGame(<NewLife />, services);
    await user.click(screen.getByRole('radio', { name: /^Software engineer/ }));
    await user.click(screen.getByRole('button', { name: 'Start this life' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/play'));
    // Pushed, the Back button of a phone would land here again, one tap away from ending the life.
    expect(router.push).not.toHaveBeenCalled();
    expect((await saved(services))?.lifeId).toBe('engineer');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('asks before it ends a life in progress, and ends nothing unless told to', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    while (session.view().phase === 'cards') await session.answerCard(0);
    await session.playRound({ orders: [] });
    const user = userEvent.setup();
    renderGame(<NewLife />, services);

    await user.click(await screen.findByRole('radio', { name: /^Civil servant/ }));
    await user.click(screen.getByRole('button', { name: 'Start this life' }));
    const entries = history.length;
    const ask = await screen.findByRole('dialog', { name: 'End the life you are living?' });
    expect(within(ask).getByText('Nurse, age 24. It ends here and is not recorded.')).toBeTruthy();
    // Saying yes replaces this page with the game. An entry for the question would be the one replaced, and this page would stay behind it.
    expect(history.length).toBe(entries);
    expect((history.state as { ratraceSheet?: boolean } | null)?.ratraceSheet).not.toBe(true);
    expect((await saved(services))?.lifeId).toBe('nurse');
    expect(router.replace).not.toHaveBeenCalled();

    await user.click(within(ask).getByRole('button', { name: 'Keep my life' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect((await saved(services))?.lifeId).toBe('nurse');

    await user.click(screen.getByRole('button', { name: 'Start this life' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'End it and start this one' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/play'));
    expect(await saved(services)).toMatchObject({ lifeId: 'civil_servant', log: [] });
  });

  it('does not ask when the last life is already over', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    while (!session.view().finished) {
      while (session.view().phase === 'cards') await session.answerCard(0);
      await session.playRound({ orders: [] });
    }
    const user = userEvent.setup();
    renderGame(<NewLife />, services);
    await screen.findAllByRole('radio');
    await waitFor(async () => expect((await saved(services))?.state.finished).toBe(true));
    await user.click(screen.getByRole('button', { name: 'Start this life' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/play'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect((await saved(services))?.state.finished).toBe(false);
  });
});
