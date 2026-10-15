// @vitest-environment jsdom
import { act, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { memoryServices, renderGame } from '@/testing/render';
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
    expect(calendar.getAttribute('aria-hidden')).toBe('true');
    expect(calendar.className).toContain('pointer-events-none');
    expect(calendar.querySelector('.animate-tear')?.textContent).toContain('24');
    expect(calendar.textContent).toContain('26');
    expect(done).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(PAGE_TURN_MS));
    expect(done).toHaveBeenCalledOnce();
  });
});
