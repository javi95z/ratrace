// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createElement, useState } from 'react';
import type { ReactNode } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryServices, renderGame } from '../../testing/render';

// The slider's gesture is the phone's (the gesture handler's native side cannot be loaded here, and the kit's own test drives it): a stand-in
// that keeps what the sheet hands it, and draws the adjustable a screen reader finds.
type SliderProps = { value: number; min: number; max: number; step: number; onChange(value: number): void; label: string; valueText?: string; hint?: string };
const sliders = vi.hoisted(() => [] as SliderProps[]);
vi.mock('../../ui/Slider', () => ({
  Slider: (props: SliderProps) => {
    sliders.push(props);
    return createElement('div', { role: 'slider', 'aria-label': props.label, 'aria-valuenow': props.value, 'aria-valuetext': props.valueText });
  },
}));

const { AmountSheet, sliderStep } = await import('./AmountSheet');

const slider = () => sliders[sliders.length - 1];
/** The slider moved, as a finger on it would move it. */
const slide = (value: number) => act(() => slider().onChange(value));

beforeEach(() => {
  sliders.length = 0;
});
afterEach(cleanup);

/** A sheet as a screen opens it: mounted while it is open, and gone once it says it is closed. */
function Example({ confirmed, start, max = 10_000, taken = true, children, footer, preview }: { confirmed(amount: number): void; start?: number; max?: number; taken?: boolean; children?: ReactNode; footer?: ReactNode; preview?: (amount: number) => ReactNode }) {
  const [open, setOpen] = useState(true);
  return open ? (
    <AmountSheet
      title="Move money"
      max={max}
      start={start}
      onClose={() => setOpen(false)}
      onConfirm={(amount) => {
        confirmed(amount);
        return taken;
      }}
      footer={footer}
      preview={preview}
    >
      {children}
    </AmountSheet>
  ) : null;
}

const sheet = () => screen.getByRole('heading', { name: 'Move money' }).closest('[aria-modal="true"]') as HTMLElement;

describe('an amount on a slider', () => {
  it('is the one control: it opens on the amount given, steps a round number of dollars, says the amount aloud, and has no field for an exact amount', async () => {
    const confirmed = vi.fn();
    renderGame(<Example confirmed={confirmed} start={1_000} />, memoryServices());
    const here = sheet();
    // A hundredth of a hundred dollars is a dollar: about two hundred stops on the track.
    expect(sliderStep(10_000)).toBe(100);
    expect(sliderStep(1_000_000)).toBe(5_000);
    expect(sliderStep(50_000_000_000)).toBe(50_000_000);
    expect(slider()).toMatchObject({ value: 1_000, min: 0, max: 10_000, step: 100, label: 'Amount', valueText: '$10', hint: 'Up to $100' });
    expect(within(here).getByRole('slider', { name: 'Amount' })).toBeTruthy();
    // What a screen reader hears of the slider is the amount, as money, and it follows the slider.
    expect(within(here).getByText('$10')).toBeTruthy();
    slide(2_000);
    expect(slider()).toMatchObject({ value: 2_000, valueText: '$20' });
    expect(within(here).getByText('$20')).toBeTruthy();
    // Nothing to type an amount in: the web has no such field either.
    expect(here.querySelector('input, textarea, [role="spinbutton"], [role="textbox"]')).toBeNull();
    expect(within(here).getByText('Up to $100')).toBeTruthy();
    // The keyboard's help is the web's, for a keyboard: a phone has none.
    expect(within(here).queryByText(/Arrow keys/)).toBeNull();

    // A quarter, a half, all of it.
    fireEvent.click(within(here).getByRole('button', { name: '25%' }));
    expect(slider().value).toBe(2_500);
    fireEvent.click(within(here).getByRole('button', { name: '50%' }));
    expect(slider().value).toBe(5_000);
    fireEvent.click(within(here).getByRole('button', { name: '100%' }));
    expect(slider().value).toBe(10_000);

    fireEvent.click(within(here).getByRole('button', { name: 'Confirm $100' }));
    expect(confirmed).toHaveBeenCalledWith(10_000);
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Move money' })).toBeNull());
  });

  it('opens on nothing unless told, and its button waits for an amount', () => {
    const confirmed = vi.fn();
    renderGame(<Example confirmed={confirmed} />, memoryServices());
    expect(slider().value).toBe(0);
    const button = within(sheet()).getByRole('button', { name: 'Confirm $0' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(button);
    expect(confirmed).not.toHaveBeenCalled();
    // Never more than there is, whatever it was opened on.
    cleanup();
    renderGame(<Example confirmed={confirmed} start={50_000} />, memoryServices());
    expect(slider().value).toBe(10_000);
  });

  it('holds an amount to the ends of the track', () => {
    renderGame(<Example confirmed={() => {}} start={1_000} />, memoryServices());
    slide(-500);
    expect(slider().value).toBe(0);
    slide(99_999);
    expect(slider().value).toBe(10_000);
    slide(Number.NaN);
    expect(slider().value).toBe(0);
  });

  it('stays open when what it was for cannot be done: the screen said no', () => {
    const confirmed = vi.fn();
    renderGame(<Example confirmed={confirmed} start={3_000} taken={false} />, memoryServices());
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Confirm $30' }));
    expect(confirmed).toHaveBeenCalledWith(3_000);
    expect(screen.getByRole('heading', { name: 'Move money' })).toBeTruthy();
  });

  it('shows what it is for above the amount, what the amount comes to under the slider once there is one, and another way out under the button', () => {
    const preview = (amount: number) => <p>{`comes to ${amount}`}</p>;
    renderGame(<Example confirmed={() => {}} preview={preview} footer={<p>another way</p>}><p>what it is for</p></Example>, memoryServices());
    const here = sheet();
    expect(within(here).getByText('what it is for')).toBeTruthy();
    expect(within(here).getByText('another way')).toBeTruthy();
    expect(within(here).queryByText(/comes to/)).toBeNull();
    slide(4_000);
    expect(within(here).getByText('comes to 4000')).toBeTruthy();
    // In the web's order: what it is for, the amount, the slider, the chips, what it comes to, how much there is, the button, the way out.
    const text = here.textContent ?? '';
    const order = ['what it is for', '$40', '25%', 'comes to 4000', 'Up to $100', 'Confirm $40', 'another way'].map((part) => text.indexOf(part));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('says there is nothing to move when there is nothing, with no slider and no button', () => {
    renderGame(<Example confirmed={() => {}} max={0} />, memoryServices());
    const here = sheet();
    expect(within(here).getByText('There is nothing to move.')).toBeTruthy();
    expect(within(here).queryByRole('slider')).toBeNull();
    expect(within(here).queryByRole('button', { name: /Confirm/ })).toBeNull();
  });

  it('says the amount as it changes: a live region for TalkBack, and on iOS, where there is none, the amount a chip set, said aloud', () => {
    const was = Platform.OS;
    const said = vi.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    try {
      Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
      renderGame(<Example confirmed={() => {}} start={1_000} />, memoryServices());
      const here = sheet();
      // The amount is a polite live region (the web's `<output aria-live>`).
      expect(within(here).getByText('$10').closest('[aria-live="polite"]')).not.toBeNull();
      fireEvent.click(within(here).getByRole('button', { name: '50%' }));
      expect(said).toHaveBeenLastCalledWith('$50');
      fireEvent.click(within(here).getByRole('button', { name: '100%' }));
      expect(said).toHaveBeenLastCalledWith('$100');
      // A drag of the slider is the slider's to say: its value is read as it moves.
      said.mockClear();
      slide(2_000);
      expect(said).not.toHaveBeenCalled();
      cleanup();
      // TalkBack hears the live region; nothing is said over it.
      Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
      renderGame(<Example confirmed={() => {}} start={1_000} />, memoryServices());
      fireEvent.click(within(sheet()).getByRole('button', { name: '50%' }));
      expect(said).not.toHaveBeenCalled();
    } finally {
      said.mockRestore();
      Object.defineProperty(Platform, 'OS', { value: was, configurable: true });
    }
  });

  it('speaks the game\'s language', () => {
    renderGame(<Example confirmed={() => {}} start={1_000} />, memoryServices(), 'es');
    expect(slider()).toMatchObject({ label: 'Importe' });
    expect(within(sheet()).getByRole('button', { name: /^Confirmar/ })).toBeTruthy();
  });
});
