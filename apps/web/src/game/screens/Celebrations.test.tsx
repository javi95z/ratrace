// @vitest-environment jsdom
import { badges, rarityOf } from '@ratrace/content';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { memoryServices, renderGame } from '@/testing/render';
import { Celebrations } from './Celebrations';

const shown = vi.hoisted(() => ({ earned: [] as string[] }));
vi.mock('@/game/context', async (original) => {
  const real = await original<typeof import('@/game/context')>();
  return { ...real, useGame: (select: (state: { earned: string[]; unlocked: string[] }) => unknown) => select({ earned: shown.earned, unlocked: [] }) };
});

afterEach(cleanup);
const idOf = (rarity: string) => badges.find((badge) => rarityOf(badge.id) === rarity)!.id;

describe('a badge earned', () => {
  it('shows its rarity and the band of lives it stands for, with a glow that grows', () => {
    shown.earned = [idOf('rare'), idOf('common')];
    renderGame(<Celebrations />, memoryServices());
    const [rare, common] = screen.getAllByRole('status');
    expect(within(rare).getByText('2 to 10 in 100 lives')).toBeTruthy();
    expect(rare.className).toContain('shadow-');
    expect(within(common).getByText('More than 30 in 100 lives')).toBeTruthy();
    expect(common.className).not.toContain('shadow-');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('takes the whole screen for a legendary one, until the player moves on, in any language', async () => {
    shown.earned = [idOf('legendary')];
    const user = userEvent.setup();
    renderGame(<Celebrations />, memoryServices());
    const card = screen.getByRole('dialog');
    expect(within(card).getByText('Legendary badge')).toBeTruthy();
    expect(within(card).queryByText(/in 100 lives/)).toBeNull();
    await user.click(within(card).getByRole('button', { name: 'Continue' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    // The small card stays with the step's result.
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('speaks Spanish and Russian', () => {
    shown.earned = [idOf('legendary')];
    renderGame(<Celebrations />, memoryServices(), 'es');
    expect(screen.getByText('Insignia legendaria')).toBeTruthy();
    expect(screen.queryByText(/Menos de 2 de cada 100/)).toBeNull();
    cleanup();
    renderGame(<Celebrations />, memoryServices(), 'ru');
    expect(screen.getByText('Легендарный значок')).toBeTruthy();
    expect(screen.queryByText(/Менее чем в 2 из 100/)).toBeNull();
  });
});
