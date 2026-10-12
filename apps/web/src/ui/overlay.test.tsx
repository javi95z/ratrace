// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Sheet, Tabs, Toast } from './overlay';

afterEach(cleanup);

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

  it('stops the page behind it from scrolling, and lets it scroll again afterwards', async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(document.body.style.overflow).toBe('hidden');
    await user.keyboard('{Escape}');
    expect(document.body.style.overflow).toBe('');
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
