// @vitest-environment jsdom
import { act, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { frameAt, KEYFRAMES } from '../../ui/motion';
import { memoryServices, renderGame } from '../../testing/render';
import { PAGE_TURN_MS, PageTurn } from './PageTurn';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('the calendar between rounds', () => {
  it('tears the old age off over the new one, out of the way of every tap, and goes', () => {
    vi.useFakeTimers();
    const done = vi.fn();
    const { container } = renderGame(<PageTurn from={24} to={26} onDone={done} />, memoryServices());
    const calendar = container.querySelector('[data-motion-only]') as HTMLElement;
    // Decoration only: nothing of it is read out, and a tap goes through it to the page.
    expect(calendar.getAttribute('aria-hidden')).toBe('true');
    expect(getComputedStyle(calendar).pointerEvents).toBe('none');
    expect(calendar.querySelector('[data-page="torn"]')?.textContent).toContain('24');
    expect(calendar.querySelector('[data-page="new"]')?.textContent).toContain('26');
    expect(calendar.textContent).toContain('YEARS OLD');
    expect(done).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(PAGE_TURN_MS - 1));
    expect(done).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(done).toHaveBeenCalledOnce();
  });

  it('takes as long as the web\'s, and its two pages move as the web\'s do: the new one shown and put away, the old one torn off from its top left corner', () => {
    expect(PAGE_TURN_MS).toBe(1500);
    expect(KEYFRAMES.page.ms).toBe(PAGE_TURN_MS);
    vi.useFakeTimers();
    const { container } = renderGame(<PageTurn from={22} to={24} onDone={() => {}} />, memoryServices());
    const torn = container.querySelector('[data-page="torn"]') as HTMLElement;
    expect(torn.style.transformOrigin).toBe('top left');
  });

  it('can be held at one moment of its run, for a picture of it: each page as its animation is then', () => {
    const { container } = renderGame(<PageTurn from={22} to={24} onDone={() => {}} held={445} />, memoryServices());
    const torn = container.querySelector('[data-page="torn"]') as HTMLElement;
    const tear = frameAt('tear', 445 / KEYFRAMES.tear.ms);
    expect(Number(torn.style.opacity)).toBeCloseTo(tear.opacity, 5);
    expect(torn.style.transform).toContain(`rotate(${tear.rotate}deg)`);
    const shown = container.querySelector('[data-turn]') as HTMLElement;
    expect(Number(shown.style.opacity)).toBeCloseTo(frameAt('page', 445 / KEYFRAMES.page.ms).opacity, 5);
  });
});
