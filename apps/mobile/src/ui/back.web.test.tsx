// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { sheetsGone } from './back';
import { Sheet } from './overlay';

/*
 * The browser's Back with a sheet open closes the sheet and stays on the page, as the Next web's (apps/web/src/ui/back.ts): while a sheet is open
 * one entry of the history is its own, marked in its state; Back takes it away and the sheet with it; a sheet closed by its own button takes its
 * entry out again, so entries never pile up. A sheet whose answer replaces the page (`back={false}`) leaves the history alone.
 */

afterEach(async () => {
  cleanup();
  // Whatever entry a test left is stepped off before the next.
  await act(async () => {
    await sheetsGone();
  });
});

const marked = () => (history.state as Record<string, unknown> | null)?.ratraceSheet === true;
/** Waits for the browser to have stepped through its history (jsdom's popstate comes as a task of its own). */
const popped = () => new Promise<void>((done) => window.addEventListener('popstate', () => setTimeout(done), { once: true }));

function Page({ back }: { back?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        open
      </button>
      <p>{open ? 'shown' : 'hidden'}</p>
      <Sheet open={open} onClose={() => setOpen(false)} title="Details" closeLabel="Close" back={back}>
        <p>inside</p>
      </Sheet>
    </>
  );
}

describe('the browser\'s Back', () => {
  it('closes the sheet that is open and stays on the page', async () => {
    const address = location.href;
    render(<Page />);
    const before = history.length;
    fireEvent.click(screen.getByText('open'));
    await screen.findByRole('heading', { name: 'Details' });
    // The sheet's own entry: the same address, marked.
    expect(history.length).toBe(before + 1);
    expect(marked()).toBe(true);
    expect(location.href).toBe(address);
    const back = popped();
    act(() => history.back());
    await act(() => back);
    await waitFor(() => expect(screen.getByText('hidden')).toBeTruthy());
    expect(screen.queryByRole('heading', { name: 'Details' })).toBeNull();
    expect(location.href).toBe(address);
    expect(marked()).toBe(false);
  });

  it('is given its entry back once a sheet closed by its own button: no entry is left to spend a Back on', async () => {
    render(<Page />);
    fireEvent.click(screen.getByText('open'));
    await screen.findByRole('heading', { name: 'Details' });
    expect(marked()).toBe(true);
    const back = popped();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await act(() => back);
    expect(screen.getByText('hidden')).toBeTruthy();
    expect(marked()).toBe(false);
    // And whoever waits for the sheets to be gone hears of it once the entry is out too.
    await act(async () => {
      await sheetsGone();
    });
  });

  it('leaves the history alone for a sheet whose answer replaces the page', async () => {
    render(<Page back={false} />);
    const before = history.length;
    fireEvent.click(screen.getByText('open'));
    await screen.findByRole('heading', { name: 'Details' });
    expect(history.length).toBe(before);
    expect(marked()).toBe(false);
  });
});
