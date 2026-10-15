// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Sheet, Tabs, Toast } from './overlay';

afterEach(async () => {
  cleanup();
  // A sheet closed at the end of a test takes its entry out of the history a moment later: the next test starts without it.
  await vi.waitFor(() => expect(onGuard()).toBe(false));
});

/** Presses the Back button of the browser and waits until the page has been told. */
async function pressBack() {
  await act(async () => {
    const told = new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
    history.back();
    await told;
  });
}
const onGuard = () => (history.state as { ratraceSheet?: boolean } | null)?.ratraceSheet === true;
/** Waits until the sheet has taken its entry out of the history again. */
const guardGone = () => vi.waitFor(() => expect(onGuard()).toBe(false));

/** A page with something behind the sheet, and a sheet whose first button removes itself when pressed. */
function Page({ onClose = () => {} }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(['one', 'two']);
  const close = () => {
    setOpen(false);
    onClose();
  };
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <button type="button">Behind</button>
      <Sheet open={open} onClose={close} title="Orders" closeLabel="Close">
        {rows.map((row) => (
          <button key={row} type="button" onClick={() => setRows(rows.filter((r) => r !== row))}>
            Remove {row}
          </button>
        ))}
      </Sheet>
    </div>
  );
}

describe('Sheet', () => {
  it('opens as a dialog with its title, takes the focus, and gives it back when closed', async () => {
    const user = userEvent.setup();
    render(<Page />);
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Open' }));
    const dialog = screen.getByRole('dialog', { name: 'Orders' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open' }));
  });

  it('closes on Escape and on a tap outside', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Page onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.click(document.querySelector('[data-sheet-backdrop]') as HTMLElement);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('still closes on Escape after the thing that had the focus is gone', async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.click(screen.getByRole('button', { name: 'Remove one' }));
    expect(screen.queryByRole('button', { name: 'Remove one' })).toBeNull();
    // The button is gone, and the focus with it. The sheet must not be left deaf to the keyboard.
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove two' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps Tab inside it, both ways round', async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    const inside = () => screen.getByRole('dialog').contains(document.activeElement);
    for (let i = 0; i < 6; i++) {
      await user.tab();
      expect(inside(), `tab ${i}`).toBe(true);
    }
    for (let i = 0; i < 6; i++) {
      await user.tab({ shift: true });
      expect(inside(), `shift tab ${i}`).toBe(true);
    }
    expect(document.activeElement).not.toBe(screen.getByRole('button', { name: 'Behind' }));
  });

  it('takes the focus back on the next Tab if something put it on the page behind', async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    const dialog = screen.getByRole('dialog');
    screen.getByRole('button', { name: 'Behind' }).focus();
    expect(dialog.contains(document.activeElement)).toBe(false);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));
    screen.getByRole('button', { name: 'Behind' }).focus();
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove two' }));
  });

  it('closes on the Back button of a phone, and stays on the page', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Page onClose={onClose} />);
    expect(onGuard()).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    // Opening a sheet puts one entry in the history for Back to take away, and marks it as its own.
    expect(onGuard()).toBe(true);
    await pressBack();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onGuard()).toBe(false);
  });

  it('takes its entry out of the history when closed by its own button, so nothing piles up', async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    const withOne = history.length;
    for (const how of ['button', 'escape', 'button']) {
      if (how === 'button') await user.click(screen.getByRole('button', { name: 'Close' }));
      else await user.keyboard('{Escape}');
      await guardGone();
      await user.click(screen.getByRole('button', { name: 'Open' }));
      await vi.waitFor(() => expect(onGuard()).toBe(true));
      expect(history.length).toBe(withOne);
    }
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('keeps its entry when one sheet hands over to another at once', async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    const back = vi.spyOn(history, 'back');
    // Closed and opened again in one breath, before anything else can happen.
    act(() => screen.getByRole('button', { name: 'Close' }).click());
    act(() => screen.getByRole('button', { name: 'Open' }).click());
    await new Promise((resolve) => setTimeout(resolve, 20));
    // The entry was never taken out, so there was no moment in which Back would have left the page.
    expect(back).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(onGuard()).toBe(true);
    back.mockRestore();
  });

  it('gives a sheet an entry of its own when it opened while the last one was still leaving the history', async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    // The step back that takes the entry out is held up, as a slow browser would hold it.
    const held = vi.spyOn(history, 'back').mockImplementation(() => {});
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await vi.waitFor(() => expect(held).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('button', { name: 'Open' }));
    held.mockRestore();
    // Now it arrives: it is the sheet's own step, not the player's, so nothing closes and the new sheet gets its entry.
    await pressBack();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(onGuard()).toBe(true);
  });

  it('asks for one step back, not two, when a sheet comes and goes while its entry is still on the way out', async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    const held = vi.spyOn(history, 'back').mockImplementation(() => {});
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await vi.waitFor(() => expect(held).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    // A second step would take the player off the page.
    expect(held).toHaveBeenCalledTimes(1);
    held.mockRestore();
    await pressBack();
    expect(onGuard()).toBe(false);
  });

  it('does not undo a change of page that happened while its entry was on the way out', async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    const held = vi.spyOn(history, 'back').mockImplementation(() => {});
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await vi.waitFor(() => expect(held).toHaveBeenCalledTimes(1));
    // The page moves on before the step back has happened; the step then takes the new page away.
    history.pushState({ page: 'next' }, '');
    held.mockRestore();
    await pressBack();
    // It was the sheet's step, not the player's: the page the player went to is put back.
    await vi.waitFor(() => expect((history.state as { page?: string } | null)?.page).toBe('next'));
    history.back();
    await vi.waitFor(() => expect(onGuard()).toBe(false));
  });

  it('steps over an entry of its own that a change of page left buried, so Back is never spent on nothing', async () => {
    const user = userEvent.setup();
    render(<Page />);
    // A sheet is open when the page moves on: its entry stays in the history, under the new page.
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(onGuard()).toBe(true);
    history.pushState({ page: 'next' }, '');
    cleanup();
    await pressBack();
    // Back landed on the sheet's entry, with no sheet to close: it goes one further on its own.
    await guardGone();
    expect((history.state as { page?: string } | null)?.page).toBeUndefined();
  });

  it('closes one sheet at a time when one stands on another', async () => {
    function Two() {
      const [under, setUnder] = useState(true);
      const [over, setOver] = useState(true);
      return (
        <div>
          <Sheet open={under} onClose={() => setUnder(false)} title="Under" closeLabel="Close under">
            <p>under</p>
          </Sheet>
          <Sheet open={over} onClose={() => setOver(false)} title="Over" closeLabel="Close over">
            <p>over</p>
          </Sheet>
        </div>
      );
    }
    render(<Two />);
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    await pressBack();
    expect(screen.queryByRole('dialog', { name: 'Over' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Under' })).toBeTruthy();
    // The one left open has an entry of its own again, for the next press.
    expect(onGuard()).toBe(true);
    await pressBack();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onGuard()).toBe(false);
  });

  it('leaves the history alone when told that Back is not its business', async () => {
    const user = userEvent.setup();
    function Plain() {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button type="button" onClick={() => setOpen(true)}>
            Ask
          </button>
          <Sheet open={open} onClose={() => setOpen(false)} title="Sure?" closeLabel="Close" back={false}>
            <button type="button">Yes</button>
          </Sheet>
        </div>
      );
    }
    render(<Plain />);
    const entries = history.length;
    await user.click(screen.getByRole('button', { name: 'Ask' }));
    expect(screen.getByRole('dialog', { name: 'Sure?' })).toBeTruthy();
    expect(history.length).toBe(entries);
    expect(onGuard()).toBe(false);
  });

  it('stops the page behind it from scrolling, and lets it scroll again afterwards', async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(document.body.style.overflow).toBe('hidden');
    await user.keyboard('{Escape}');
    expect(document.body.style.overflow).toBe('');
  });

  it('can put initial focus on the close control and makes the page behind inert', async () => {
    function Focused() {
      const [open, setOpen] = useState(false);
      return (
        <div data-page>
          <button onClick={() => setOpen(true)}>Open focused</button>
          <Sheet open={open} onClose={() => setOpen(false)} title="Focused" closeLabel="Close focused" initialFocus="close">
            <button>Inside</button>
          </Sheet>
        </div>
      );
    }
    const user = userEvent.setup();
    const { container } = render(<Focused />);
    await user.click(screen.getByRole('button', { name: 'Open focused' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close focused' }));
    expect(container.inert).toBe(true);
    await user.keyboard('{Escape}');
    expect(container.inert).toBe(false);
  });
});

describe('Tabs', () => {
  function Strip() {
    const [tab, setTab] = useState<'a' | 'b' | 'c'>('a');
    return <Tabs<'a' | 'b' | 'c'> label="Sections" tabs={[{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }]} value={tab} onChange={setTab} />;
  }

  it('marks the tab that is on, and moves with a click or the arrow keys, round the ends', async () => {
    const user = userEvent.setup();
    render(<Strip />);
    const selected = () => screen.getAllByRole('tab').find((tab) => tab.getAttribute('aria-selected') === 'true')?.textContent;
    expect(screen.getByRole('tablist', { name: 'Sections' })).toBeTruthy();
    expect(selected()).toBe('A');
    await user.click(screen.getByRole('tab', { name: 'B' }));
    expect(selected()).toBe('B');
    await user.keyboard('{ArrowRight}');
    expect(selected()).toBe('C');
    expect(document.activeElement?.textContent).toBe('C');
    await user.keyboard('{ArrowRight}');
    expect(selected()).toBe('A');
    await user.keyboard('{ArrowLeft}');
    expect(selected()).toBe('C');
    await user.keyboard('{Home}');
    expect(selected()).toBe('A');
    await user.keyboard('{End}');
    expect(selected()).toBe('C');
    // Only the tab that is on is a Tab stop.
    expect(screen.getAllByRole('tab').map((tab) => tab.tabIndex)).toEqual([-1, -1, 0]);
  });
});

describe('Toast', () => {
  it('shows a message and shows itself out', () => {
    vi.useFakeTimers();
    try {
      const onDone = vi.fn();
      const { rerender } = render(<Toast message="Not possible" onDone={onDone} ms={1_000} />);
      expect(screen.getByRole('alert').textContent).toBe('Not possible');
      vi.advanceTimersByTime(999);
      expect(onDone).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(onDone).toHaveBeenCalledTimes(1);
      rerender(<Toast message={null} onDone={onDone} />);
      expect(screen.queryByRole('alert')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
