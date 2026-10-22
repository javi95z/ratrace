// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { badges, rarityOf } from '@ratrace/content';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { memoryServices, renderGame } from '@/testing/render';
import { styleOf } from '@/testing/stylesheet';
import { Celebrations } from './Celebrations';
import { RARITY_GLOW } from './rarityStyle';

const shown = vi.hoisted(() => ({ earned: [] as string[] }));
vi.mock('@/game/context', async (original) => {
  const real = await original<typeof import('@/game/context')>();
  return { ...real, useGame: (select: (state: { earned: string[]; unlocked: string[] }) => unknown) => select({ earned: shown.earned, unlocked: [] }) };
});

afterEach(cleanup);
const idOf = (rarity: string) => badges.find((badge) => rarityOf(badge.id) === rarity)!.id;

/** The gold frame's four hard strips, as box-shadows. */
const GOLD_FRAME = ['0 -2px 0 0 var(--color-gold-900)', '0 2px 0 0 var(--color-gold-900)', '-2px 0 0 0 var(--color-gold-900)', '2px 0 0 0 var(--color-gold-900)'];

describe('a badge earned', () => {
  it('shows its rarity, with a glow that grows', () => {
    shown.earned = [idOf('rare'), idOf('common')];
    renderGame(<Celebrations />, memoryServices());
    const [rare, common] = screen.getAllByRole('status');
    expect(within(rare).getByText('Rare')).toBeTruthy();
    expect(rare.className.split(' ')).toEqual(expect.arrayContaining(['frame', 'frame-gold', RARITY_GLOW.rare]));
    expect(within(common).getByText('Common')).toBeTruthy();
    expect(RARITY_GLOW.common).toBe('');
    expect(common.className).not.toContain('glow');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('draws the glow of its rarity under its gold frame, both of them, as the stylesheet compiles them', async () => {
    shown.earned = [idOf('uncommon'), idOf('rare'), idOf('legendary'), idOf('common')];
    renderGame(<Celebrations />, memoryServices());
    const cards = screen.getAllByRole('status');
    const glows = { uncommon: '0 0 6px rgba(240,230,210,0.35)', rare: '0 0 12px rgba(233,177,60,0.6)', legendary: '0 0 20px rgba(94,224,200,0.7)' };
    for (const [i, rarity] of (['uncommon', 'rare', 'legendary'] as const).entries()) {
      const style = await styleOf(cards[i].className);
      // The frame's strips first, drawn over the glow, which is the last shadow: none of them lost to another rule of the same layer.
      expect(style.get('box-shadow'), rarity).toBe([...GOLD_FRAME, glows[rarity]].join(', '));
    }
    // A bronze badge has none: the frame alone, with nothing drawn under it.
    expect((await styleOf(cards[3].className)).get('box-shadow')).toBe([...GOLD_FRAME, '0 0 #0000'].join(', '));
    // The glow belongs to the card that names it: never handed down to what is inside it, as a gold frame's colours are not.
    expect(readFileSync(join(__dirname, '../../app/globals.css'), 'utf8')).toMatch(/@property --glow \{\s*syntax: '\*';\s*inherits: false;\s*\}/);
  });

  it('takes the whole screen for a legendary one, until the player moves on, in any language', async () => {
    shown.earned = [idOf('legendary')];
    const user = userEvent.setup();
    renderGame(<Celebrations />, memoryServices());
    const card = screen.getByRole('dialog');
    expect(within(card).getByText('Legendary badge')).toBeTruthy();
    await user.click(within(card).getByRole('button', { name: 'Continue' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    // The small card stays with the step's result.
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('speaks Spanish and Russian', () => {
    shown.earned = [idOf('legendary')];
    renderGame(<Celebrations />, memoryServices(), 'es');
    expect(screen.getByText('Insignia legendaria')).toBeTruthy();
    cleanup();
    renderGame(<Celebrations />, memoryServices(), 'ru');
    expect(screen.getByText('Легендарный значок')).toBeTruthy();
  });
});
