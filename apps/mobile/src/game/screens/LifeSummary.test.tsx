// @vitest-environment jsdom
import { lives } from '@ratrace/content';
import { difficultyOf } from '@ratrace/core/game/difficulty';
import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { memoryServices, renderGame } from '../../testing/render';
import { COLORS } from '../../ui/theme';
import { Difficulty, LifeBrief, LifeSummary } from './LifeSummary';

afterEach(cleanup);

const WORD: Record<number, string> = { 1: 'easy', 2: 'normal', 3: 'hard' };
const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
};

describe('how hard a life is', () => {
  it('is dots, one to three of them filled, and names its level for whoever does not see them', () => {
    for (const life of lives) {
      renderGame(<Difficulty lifeId={life.id} />, memoryServices());
      const level = difficultyOf(life.id);
      const dots = screen.getByRole('img', { name: `Difficulty: ${WORD[level]}` });
      expect(dots.textContent, life.id).toBe('●●●');
      // As many in gold as the level, the rest dimmed.
      const dim = Array.from(dots.querySelectorAll<HTMLElement>('*')).find((node) => node.style.color === rgb(COLORS['ink-500']));
      expect(dim?.textContent ?? '', life.id).toBe('●'.repeat(3 - level));
      cleanup();
    }
  });

  it('is the word itself where there is room for it', () => {
    renderGame(<Difficulty lifeId="nurse" word />, memoryServices());
    expect(screen.getByText('easy')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
    cleanup();
    renderGame(<Difficulty lifeId="rider" word />, memoryServices());
    expect(screen.getByText('hard')).toBeTruthy();
  });

  it('is said in the language in use', () => {
    renderGame(<Difficulty lifeId="engineer" />, memoryServices(), 'es');
    expect(screen.getByRole('img', { name: 'Dificultad: media' })).toBeTruthy();
  });
});

describe('a life as a small tile shows it', () => {
  it('is its name, the city it starts in and how hard it is', () => {
    renderGame(<LifeBrief lifeId="engineer" />, memoryServices());
    expect(screen.getByText('Software engineer')).toBeTruthy();
    expect(screen.getByText('Tokyo')).toBeTruthy();
    expect(document.querySelector('[data-sprite="icon.city_tokyo"]')).not.toBeNull();
    expect(screen.getByRole('img', { name: 'Difficulty: normal' })).toBeTruthy();
  });

  it('draws nothing for a life there is not', () => {
    const { container } = renderGame(<LifeBrief lifeId="nobody" />, memoryServices());
    expect(container.textContent).toBe('');
  });
});

describe('a life as it is chosen', () => {
  it('is its name and who lives it, how hard it is, where it starts and with how much, and what it is good at and what holds it back', () => {
    const { container } = renderGame(<LifeSummary lifeId="nurse" light />, memoryServices());
    expect(container.textContent).toContain('Nurse · Lucía');
    expect(screen.getByText('easy')).toBeTruthy();
    expect(screen.getByText('Madrid')).toBeTruthy();
    expect(container.querySelector('[data-sprite="icon.city_madrid"]')).not.toBeNull();
    expect(container.querySelector('[data-sprite="icon.cash"]')).not.toBeNull();
    expect(container.textContent).toMatch(/Starts in Madrid with .+/);
    expect(container.textContent).toMatch(/＋ .+/);
    expect(container.textContent).toMatch(/− .+/);
  });

  it('says the money of the start in the language in use', () => {
    const { container } = renderGame(<LifeSummary lifeId="engineer" />, memoryServices(), 'es');
    expect(container.textContent).toMatch(/Empieza en Tokio con/);
    expect(container.textContent).toContain('Ingeniero de software · Haruto');
  });

  it('writes the one who lives it in Cyrillic for Russian', () => {
    const { container } = renderGame(<LifeSummary lifeId="nurse" />, memoryServices(), 'ru');
    expect(container.textContent).toContain('Люсия');
  });

  it('keeps what is for a screen reader and what is for the eyes apart: the sentence is read, the city and the cash drawn are not read twice', () => {
    const { container } = renderGame(<LifeSummary lifeId="nurse" light />, memoryServices());
    const hidden = Array.from(container.querySelectorAll('[aria-hidden="true"]')).filter((node) => node.textContent?.includes('Madrid'));
    expect(hidden.length).toBeGreaterThan(0);
    const sentence = within(container).getByText(/^Starts in Madrid with /);
    expect(hidden.some((node) => node.contains(sentence))).toBe(false);
  });

  it('draws nothing for a life there is not', () => {
    const { container } = renderGame(<LifeSummary lifeId="nobody" />, memoryServices());
    expect(container.textContent).toBe('');
  });
});
