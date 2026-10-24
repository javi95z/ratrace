// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Segmented } from './kit';
import { View } from 'react-native';
import { acceleratedRangeKey, isEditableTarget, KeyboardListener, onKeys, useKeyboardHelp, useKeyboardScope } from './keyboard.web';
import { Sheet, Tabs } from './overlay';
import { Slider } from './Slider';

/*
 * The keyboard's contract on the web (docs/keyboard.md, the Next web's apps/web/src/ui/keyboard.tsx): shortcuts by priority, never from a field;
 * the kit's composite controls each one Tab stop, moved through with their arrows; the amount slider's steps.
 */

afterEach(cleanup);

const press = (init: KeyboardEventInit, on: Element = document.activeElement ?? document.body) => act(() => void fireEvent.keyDown(on, init));

describe('the shortcuts', () => {
  it('hand a key to the highest priority first, the others never seeing what it took, and none of them a key typed in a field', () => {
    const low = vi.fn(() => true);
    const high = vi.fn((event: { key: string }) => event.key === 'x');
    function Page() {
      useKeyboardScope(low, { priority: 0 });
      useKeyboardScope(high, { priority: 20 });
      return <input aria-label="field" />;
    }
    render(
      <>
        <KeyboardListener />
        <Page />
      </>,
    );
    press({ key: 'x' }, document.body);
    expect(high).toHaveBeenCalledTimes(1);
    expect(low).not.toHaveBeenCalled();
    press({ key: 'y' }, document.body);
    expect(low).toHaveBeenCalledTimes(1);
    press({ key: 'x' }, screen.getByLabelText('field'));
    expect(high).toHaveBeenCalledTimes(2);
    expect(isEditableTarget(screen.getByLabelText('field'))).toBe(true);
  });

  it('open the reference with ?, but not with a modifier, and not over a sheet', () => {
    function Shown() {
      return <p>{useKeyboardHelp().open ? 'open' : 'shut'}</p>;
    }
    render(
      <>
        <KeyboardListener />
        <Shown />
        <div aria-modal="true" />
      </>,
    );
    press({ key: '?' }, document.body);
    expect(screen.getByText('shut')).toBeTruthy();
    cleanup();
    render(
      <>
        <KeyboardListener />
        <Shown />
      </>,
    );
    press({ key: '?', ctrlKey: true }, document.body);
    expect(screen.getByText('shut')).toBeTruthy();
    press({ key: '?' }, document.body);
    expect(screen.getByText('open')).toBeTruthy();
  });
});

describe('the kit\'s composite controls', () => {
  it('tabs: one Tab stop, ← → round the ends, Home and End, each selected and given the focus', () => {
    function Strip() {
      const [on, setOn] = useState<'a' | 'b' | 'c'>('a');
      return <Tabs label="Tabs" tabs={[{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }]} value={on} onChange={(id) => setOn(id as 'a' | 'b' | 'c')} />;
    }
    render(<Strip />);
    const tab = (name: string) => screen.getByRole('tab', { name });
    expect([tab('A'), tab('B'), tab('C')].map((one) => one.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
    act(() => tab('A').focus());
    press({ key: 'ArrowLeft' });
    expect(tab('C').getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tab('C'));
    press({ key: 'ArrowRight' });
    expect(document.activeElement).toBe(tab('A'));
    press({ key: 'End' });
    expect(document.activeElement).toBe(tab('C'));
    press({ key: 'Home' });
    expect(document.activeElement).toBe(tab('A'));
    expect([tab('A'), tab('B'), tab('C')].map((one) => one.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
  });

  it('a segmented choice: the arrows of its way, skipping what cannot be chosen', () => {
    function Choice() {
      const [on, setOn] = useState('one');
      return (
        <Segmented
          label="Choice"
          value={on}
          onChange={(next) => setOn(String(next))}
          options={[
            { value: 'one', label: 'One' },
            { value: 'two', label: 'Two', disabled: true },
            { value: 'three', label: 'Three' },
          ]}
        />
      );
    }
    render(<Choice />);
    const radio = (name: string) => screen.getByRole('radio', { name });
    act(() => radio('One').focus());
    press({ key: 'ArrowRight' });
    expect(radio('Three').getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(radio('Three'));
    press({ key: 'ArrowRight' });
    expect(document.activeElement).toBe(radio('One'));
    // Up and down are not a row's.
    press({ key: 'ArrowDown' });
    expect(document.activeElement).toBe(radio('One'));
  });

  it('the amount slider: an arrow a step, Shift ten, a page about a tenth, Home and End the ends', () => {
    function Amount() {
      const [value, setValue] = useState(500);
      return <Slider label="Amount" value={value} min={0} max={1000} step={10} onChange={setValue} />;
    }
    render(<Amount />);
    const slider = screen.getByRole('slider', { name: 'Amount' });
    expect(slider.getAttribute('tabindex')).toBe('0');
    const now = () => slider.getAttribute('aria-valuenow');
    act(() => slider.focus());
    press({ key: 'ArrowRight' });
    expect(now()).toBe('510');
    press({ key: 'ArrowLeft', shiftKey: true });
    expect(now()).toBe('410');
    press({ key: 'PageUp' });
    expect(now()).toBe('510');
    press({ key: 'End' });
    expect(now()).toBe('1000');
    press({ key: 'ArrowUp' });
    expect(now()).toBe('1000');
    press({ key: 'Home' });
    expect(now()).toBe('0');
  });

  it('keeps every money control\'s acceleration', () => {
    expect(acceleratedRangeKey({ key: 'ArrowRight', shiftKey: true }, 100, 1000, 10)).toBe(200);
    expect(acceleratedRangeKey({ key: 'PageDown', shiftKey: false }, 100, 1000, 10)).toBe(0);
    expect(acceleratedRangeKey({ key: 'ArrowRight', shiftKey: false }, 100, 1000, 10)).toBeNull();
  });
});

describe('a control\'s own keys', () => {
  it('are not handed a key from a sheet it opened, which React bubbles to it out of the sheet\'s portal', async () => {
    const heard = vi.fn(() => true);
    render(
      <View {...(onKeys(heard) as object)}>
        <button type="button">row</button>
        <Sheet open onClose={() => {}} title="Inside" closeLabel="Close">
          <button type="button">in the sheet</button>
        </Sheet>
      </View>,
    );
    const inside = await screen.findByText('in the sheet');
    press({ key: 'ArrowDown' }, inside);
    expect(heard).not.toHaveBeenCalled();
    press({ key: 'ArrowDown' }, screen.getByText('row'));
    expect(heard).toHaveBeenCalledTimes(1);
  });
});
