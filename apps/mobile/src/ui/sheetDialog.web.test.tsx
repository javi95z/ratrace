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
/** The panel of the dialog named `name`: where its focus starts. */
const panelOf = (name: string) => dialog(name).querySelector('[data-sheet-panel]') as HTMLElement;
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
  it('is one dialog, named by its title, whose panel takes the focus as it opens; its backdrop can take no focus and is never read', async () => {
    render(<Opener rows={['a', 'b']} />);
    fireEvent.click(screen.getByText('open'));
    await waitFor(() => expect(document.activeElement).toBe(panelOf('Details')));
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(dialog('Details').getAttribute('aria-modal')).toBe('true');
    expect(panelOf('Details').getAttribute('tabindex')).toBe('-1');
    const backdrop = screen.getByTestId('sheet-backdrop');
    expect(backdrop.hasAttribute('tabindex')).toBe(false);
    expect(backdrop.getAttribute('aria-hidden')).toBe('true');
    act(() => backdrop.focus());
    expect(document.activeElement).not.toBe(backdrop);
  });

  it('closes when its dimmed page is clicked, as the Next web\'s backdrop does, and not when its panel is', async () => {
    render(<Opener rows={['a']} />);
    fireEvent.click(screen.getByText('open'));
    await waitFor(() => expect(document.activeElement).toBe(panelOf('Details')));
    fireEvent.click(panelOf('Details'));
    expect(screen.getByRole('dialog', { name: 'Details' })).toBeTruthy();
    fireEvent.click(screen.getByTestId('sheet-backdrop'));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Details' })).toBeNull());
  });

  it('keeps Tab round the panel\'s controls, and the Modal\'s own trap never lands on the backdrop: Enter then closes nothing', async () => {
    render(<Opener rows={['a', 'b']} />);
    fireEvent.click(screen.getByText('open'));
    await waitFor(() => expect(document.activeElement).toBe(panelOf('Details')));
    const close = screen.getByRole('button', { name: 'Close' });
    const last = screen.getByText('remove b');
    // Past the last control, the first; before the first, the last.
    act(() => last.focus());
    act(() => void fireEvent.keyDown(last, { key: 'Tab' }));
    expect(document.activeElement).toBe(close);
    act(() => void fireEvent.keyDown(close, { key: 'Tab', shiftKey: true }));
    expect(document.activeElement).toBe(last);
    // The browser's Tab past the panel reaches the Modal's trailing bracket, and its trap puts the focus back inside: never on the backdrop.
    const brackets = [...dialog('Details').parentElement!.parentElement!.querySelectorAll<HTMLElement>('[tabindex="0"]')].filter((node) => !dialog('Details').contains(node));
    expect(brackets.length).toBeGreaterThan(0);
    for (const bracket of brackets) {
      act(() => bracket.focus());
      expect(document.activeElement).not.toBe(screen.getByTestId('sheet-backdrop'));
      expect(dialog('Details').contains(document.activeElement)).toBe(true);
      act(() => void fireEvent.keyDown(document.activeElement as Element, { key: 'Enter' }));
      act(() => void fireEvent.keyUp(document.activeElement as Element, { key: 'Enter' }));
    }
    expect(screen.getByRole('dialog', { name: 'Details' })).toBeTruthy();
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
    await waitFor(() => expect(document.activeElement).toBe(panelOf('First')));
    const behind = page();
    expect(behind.length).toBeGreaterThan(0);
    for (const node of behind) expect(node.inert).toBe(true);
    // The sheet over it: the first sheet's window goes inert too, the page stays so (and the first is no dialog while the second is on top).
    const firstDialog = dialog('First');
    fireEvent.click(screen.getByText('more'));
    await waitFor(() => expect(document.activeElement).toBe(panelOf('Second')));
    const firstWindow = [...document.body.children].find((node) => node.contains(firstDialog)) as HTMLElement;
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
    await waitFor(() => expect(document.activeElement).toBe(panelOf('Details')));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('hands the focus of a row taken out to the row now in its place, or the last', async () => {
    render(<Opener rows={['a', 'b', 'c']} />);
    fireEvent.click(screen.getByText('open'));
    await waitFor(() => expect(document.activeElement).toBe(panelOf('Details')));
    const b = screen.getByText('remove b');
    act(() => b.focus());
    fireEvent.click(b);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByText('remove c')));
    fireEvent.click(screen.getByText('remove c'));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByText('remove a')));
  });
});
