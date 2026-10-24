// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { memoryServices, renderGame } from '../testing/render';
import { AmountSheet } from '../game/screens/AmountSheet';
import { KeyboardControls } from '../game/KeyboardHelp';
import { sheetsGone } from './back';
import { Sheet } from './overlay';

/*
 * A sheet on the web is a dialog as the Next web's is (docs/keyboard.md, "Focus and dialogs"): its panel, named by its title, takes the focus as it
 * opens (or its Close, or an amount's slider), never the backdrop; the page behind is inert while any sheet is open; a focused row taken out of it
 * hands the focus to the row now in its place; and the focus goes back to what opened it.
 */

afterEach(async () => {
  cleanup();
  await act(async () => {
    await sheetsGone();
  });
});

const dialog = (name: string) => screen.getByRole('dialog', { name });
/** The page's own boxes off the body: everything but the sheets' windows. */
const page = () => [...document.body.children].filter((node) => !node.querySelector('[role="dialog"]')) as HTMLElement[];

function Opener({ initialFocus, rows = [] }: { initialFocus?: 'panel' | 'close'; rows?: string[] }) {
  const [open, setOpen] = useState(false);
  const [left, setLeft] = useState(rows);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        open
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Details" closeLabel="Close" initialFocus={initialFocus}>
        {left.map((row) => (
          <button key={row} type="button" onClick={() => setLeft((now) => now.filter((one) => one !== row))}>
            {`remove ${row}`}
          </button>
        ))}
      </Sheet>
    </>
  );
}

describe('a sheet on the web', () => {
  it('is a dialog named by its title, whose panel takes the focus as it opens; its backdrop is never a Tab stop nor read', async () => {
    render(<Opener />);
    fireEvent.click(screen.getByText('open'));
    await waitFor(() => expect(document.activeElement).toBe(dialog('Details')));
    expect(dialog('Details').getAttribute('aria-modal')).toBe('true');
    expect(dialog('Details').getAttribute('tabindex')).toBe('-1');
    const backdrop = screen.getByTestId('sheet-backdrop');
    expect(backdrop.getAttribute('tabindex')).toBe('-1');
    expect(backdrop.getAttribute('aria-hidden')).toBe('true');
    expect(dialog('Details').contains(backdrop)).toBe(false);
  });

  it('gives the first focus to its Close where it asks for it (the keyboard\'s reference)', async () => {
    render(<Opener initialFocus="close" />);
    fireEvent.click(screen.getByText('open'));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' })));
  });

  it('opens the keyboard\'s reference with its Close in focus', async () => {
    renderGame(<KeyboardControls />, memoryServices());
    act(() => void fireEvent.keyDown(document.body, { key: '?' }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' })));
    expect(dialog('Keyboard controls')).toBeTruthy();
  });

  it('gives an amount\'s slider the first focus, so its keys and Ctrl/⌘ + Enter work at once', async () => {
    const onConfirm = vi.fn(() => true);
    renderGame(
      <>
        <KeyboardControls />
        <AmountSheet title="Save" max={100_000} start={10_000} onClose={() => {}} onConfirm={onConfirm} />
      </>,
      memoryServices(),
    );
    const slider = await screen.findByRole('slider');
    await waitFor(() => expect(document.activeElement).toBe(slider));
    act(() => void fireEvent.keyDown(slider, { key: 'Enter', ctrlKey: true }));
    expect(onConfirm).toHaveBeenCalledWith(10_000);
  });

  it('makes the page behind inert while a sheet is open, counted for a sheet over the sheet, and lets it go once the last has closed', async () => {
    function Two() {
      const [first, setFirst] = useState(false);
      const [second, setSecond] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setFirst(true)}>
            open
          </button>
          <Sheet open={first} onClose={() => setFirst(false)} title="First" closeLabel="Close first">
            <button type="button" onClick={() => setSecond(true)}>
              more
            </button>
            {/* A sheet drawn inside another is shown over it at once (overlay.tsx's turns). */}
            <Sheet open={second} onClose={() => setSecond(false)} title="Second" closeLabel="Close second">
              <p>inside</p>
            </Sheet>
          </Sheet>
        </>
      );
    }
    render(<Two />);
    fireEvent.click(screen.getByText('open'));
    await waitFor(() => expect(document.activeElement).toBe(dialog('First')));
    const behind = page();
    expect(behind.length).toBeGreaterThan(0);
    for (const node of behind) expect(node.inert).toBe(true);
    // The sheet over it: the first sheet's window goes inert too, the page stays so.
    fireEvent.click(screen.getByText('more'));
    await waitFor(() => expect(document.activeElement).toBe(dialog('Second')));
    const firstWindow = [...document.body.children].find((node) => node.contains(dialog('First'))) as HTMLElement;
    expect(firstWindow.inert).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Close second' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Second' })).toBeNull());
    expect(firstWindow.inert).toBe(false);
    for (const node of behind) expect(node.inert).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Close first' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    for (const node of behind) expect(node.inert).toBe(false);
  });

  it('gives the focus back to what opened it once it closes', async () => {
    render(<Opener />);
    const opener = screen.getByText('open');
    act(() => opener.focus());
    fireEvent.click(opener);
    await waitFor(() => expect(document.activeElement).toBe(dialog('Details')));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('hands the focus of a row taken out to the row now in its place, or the last', async () => {
    render(<Opener rows={['a', 'b', 'c']} />);
    fireEvent.click(screen.getByText('open'));
    await waitFor(() => expect(document.activeElement).toBe(dialog('Details')));
    const b = screen.getByText('remove b');
    act(() => b.focus());
    fireEvent.click(b);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByText('remove c')));
    fireEvent.click(screen.getByText('remove c'));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByText('remove a')));
  });
});
