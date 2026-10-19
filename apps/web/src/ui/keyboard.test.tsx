// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import en from '@ratrace/i18n/messages/en.json';
import { acceleratedRangeKey, KeyboardHint, KeyboardProvider, useKeyboardScope } from './keyboard';

afterEach(cleanup);

function Shortcut({ run }: { run(): void }) {
  useKeyboardScope((event) => {
    if (event.key !== 'Enter' || (!event.ctrlKey && !event.metaKey) || event.repeat) return false;
    run();
    return true;
  });
  return (
    <div>
      <input aria-label="Name" />
      <button>Action <KeyboardHint>Ctrl/⌘ ↵</KeyboardHint></button>
    </div>
  );
}

const draw = (ui: ReactNode) => render(<NextIntlClientProvider locale="en" messages={en}><KeyboardProvider>{ui}</KeyboardProvider></NextIntlClientProvider>);

describe('keyboard scopes', () => {
  it('runs a shortcut once, ignores key repeat and never steals keys from an editable field', async () => {
    const user = userEvent.setup();
    const run = vi.fn();
    draw(<Shortcut run={run} />);
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(run).toHaveBeenCalledTimes(1);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, repeat: true, bubbles: true }));
    expect(run).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('textbox', { name: 'Name' }));
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('shows key hints only after a keyboard key and hides them again after a pointer', async () => {
    const user = userEvent.setup();
    draw(<Shortcut run={() => {}} />);
    expect(document.documentElement.dataset.input).toBe('pointer');
    await user.keyboard('{Tab}');
    expect(document.documentElement.dataset.input).toBe('keyboard');
    await user.pointer({ keys: '[MouseLeft]', target: screen.getByRole('button') });
    expect(document.documentElement.dataset.input).toBe('pointer');
  });

  it('opens contextual help with question mark unless focus is in a field', async () => {
    const user = userEvent.setup();
    draw(<Shortcut run={() => {}} />);
    await user.keyboard('?');
    expect(screen.getByRole('dialog', { name: 'Keyboard controls' })).toBeTruthy();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('textbox', { name: 'Name' }));
    await user.keyboard('?');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('accelerated range keys', () => {
  const event = (key: string, shiftKey = false) => ({ key, shiftKey } as ReactKeyboardEvent<HTMLInputElement>);
  it('moves ten steps with Shift, pages by ten percent, and reaches both ends', () => {
    expect(acceleratedRangeKey(event('ArrowRight', true), 100, 1000, 10)).toBe(200);
    expect(acceleratedRangeKey(event('ArrowLeft', true), 50, 1000, 10)).toBe(0);
    expect(acceleratedRangeKey(event('PageUp'), 100, 1000, 10)).toBe(200);
    expect(acceleratedRangeKey(event('PageDown'), 50, 1000, 10)).toBe(0);
    expect(acceleratedRangeKey(event('Home'), 500, 1000, 10)).toBe(0);
    expect(acceleratedRangeKey(event('End'), 500, 1000, 10)).toBe(1000);
    expect(acceleratedRangeKey(event('ArrowRight'), 100, 1000, 10)).toBeNull();
  });
});
