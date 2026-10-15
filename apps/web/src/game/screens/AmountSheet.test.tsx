// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { memoryServices, renderGame } from '@/testing/render';
import { AmountSheet, sliderStep } from './AmountSheet';

afterEach(cleanup);

function Example({ confirmed }: { confirmed(amount: number): void }) {
  const [open, setOpen] = useState(true);
  return open ? <AmountSheet title="Move money" max={10_000} start={1_000} onClose={() => setOpen(false)} onConfirm={(amount) => { confirmed(amount); return true; }} /> : null;
}

describe('AmountSheet keyboard controls', () => {
  it('focuses the slider, supports accelerated keys, and has no field for an exact amount', async () => {
    const user = userEvent.setup();
    const confirmed = vi.fn();
    renderGame(<Example confirmed={confirmed} />, memoryServices());
    const slider = screen.getByRole('slider', { name: 'Amount' }) as HTMLInputElement;
    expect(document.activeElement).toBe(slider);
    expect(sliderStep(10_000)).toBe(100);
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
    expect(slider.value).toBe('2000');
    await user.keyboard('{PageUp}');
    expect(slider.value).toBe('3000');
    await user.keyboard('{End}');
    expect(slider.value).toBe('10000');
    expect(screen.queryByRole('spinbutton')).toBeNull();
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(confirmed).toHaveBeenCalledWith(10_000);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
