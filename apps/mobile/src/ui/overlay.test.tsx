// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { View } from 'react-native';
import { EXTRA, COLORS } from './theme';
import { sheetsGone } from './back';
import { Sheet, Tabs, Toast } from './overlay';
import { Picker } from './Picker';
import { rea } from './testing/reanimated';
import { TapProvider } from './tap';

// The Modal is told how it is used (transparent, no animation of its own) and what Back does. It shows its children while
// it is visible, as every platform's does; telling that it has dismissed (iOS's onDismiss) is the test's to do.
const modal = vi.hoisted(() => ({ props: null as Record<string, unknown> | null }));
const platform = vi.hoisted(() => ({ OS: 'web' }));
vi.mock('react-native', async () => {
  const rn = await vi.importActual<Record<string, unknown> & { Platform: object }>('react-native-web');
  return {
    ...rn,
    Platform: { ...rn.Platform, get OS() { return platform.OS; } },
    AccessibilityInfo: { isReduceMotionEnabled: () => Promise.resolve(false), addEventListener: () => ({ remove() {} }) },
    Modal: (props: { children: React.ReactNode; visible?: boolean } & Record<string, unknown>) => {
      modal.props = props;
      return <div data-modal data-visible={String(props.visible !== false)}>{props.visible === false ? null : props.children}</div>;
    },
  };
});
vi.mock('./Sprite', () => ({ Sprite: ({ id }: { id: string }) => <div data-sprite={id} /> }));
// Reanimated needs the worklets runtime: the shared reactive fake stands in for it.
vi.mock('react-native-reanimated', async () => (await import('./testing/reanimated')).reanimatedFake());
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 20, left: 0, right: 0 }) }));

beforeEach(() => {
  vi.useFakeTimers();
  rea.assigned.length = 0;
  platform.OS = 'web';
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
};

function sheet(props: Partial<React.ComponentProps<typeof Sheet>> = {}) {
  const onClose = vi.fn();
  render(
    <Sheet open onClose={onClose} title="Title" closeLabel="Close" {...props}>
      <button>inside</button>
    </Sheet>,
  );
  return onClose;
}

test('a sheet that is not open draws nothing', () => {
  sheet({ open: false });
  expect(screen.queryByText('Title')).toBeNull();
});

test('pressing the backdrop closes the sheet; pressing inside the panel does not', () => {
  const onClose = sheet();
  fireEvent.click(screen.getByText('inside'));
  fireEvent.click(screen.getByText('Title'));
  expect(onClose).not.toHaveBeenCalled();
  const backdrop = document.body.querySelector('[data-testid="sheet-backdrop"]') as HTMLElement;
  expect(backdrop.style.backgroundColor.replace(/ /g, '')).toBe(EXTRA.backdrop.replace(/ /g, ''));
  fireEvent.click(backdrop);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('the close button is 44 pt, named by closeLabel, and closes', () => {
  const onClose = sheet();
  const close = screen.getByLabelText('Close');
  expect(close.style.width).toBe('44px');
  expect(close.style.height).toBe('44px');
  fireEvent.click(close);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('the title is a header, and the panel is night-800', () => {
  sheet();
  expect(screen.getByText('Title').closest('[role="heading"]')).not.toBeNull();
  let el: HTMLElement | null = screen.getByText('inside');
  while (el && el.style.backgroundColor === '') el = el.parentElement;
  expect(el!.style.backgroundColor).toBe(rgb(COLORS['night-800']));
});

test('the Modal is transparent, plays no animation of its own, and is modal for a screen reader', () => {
  sheet();
  expect(modal.props).toMatchObject({ transparent: true, animationType: 'none', visible: true });
  expect(document.body.querySelector('[aria-modal="true"]')).not.toBeNull();
});

test('Android Back (onRequestClose) closes the sheet and does nothing else', () => {
  const onClose = vi.fn();
  const other = vi.fn();
  render(
    <TapProvider value={other}>
      <Sheet open onClose={onClose} title="Title" closeLabel="Close">
        <span>inside</span>
      </Sheet>
    </TapProvider>,
  );
  (modal.props!.onRequestClose as () => void)();
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(other).not.toHaveBeenCalled();
});

test('Back closes the sheet even with back off, which has no effect on native', () => {
  const onClose = sheet({ back: false });
  (modal.props!.onRequestClose as () => void)();
  expect(onClose).toHaveBeenCalledTimes(1);
});

function Wrapper({ open }: { open: boolean }) {
  return (
    <Sheet open={open} onClose={() => {}} title="Title" closeLabel="Close">
      <span>inside</span>
    </Sheet>
  );
}
const modals = () => Array.from(document.querySelectorAll('[data-modal]')).map((el) => el.getAttribute('data-visible'));
const panelStyle = () => (screen.getByText('inside').closest('[style*="opacity"]') as HTMLElement).style;
const wait = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

test('a sheet that stays mounted rises at every opening, from its first frame to its end after 280 ms', async () => {
  const { rerender } = render(<Wrapper open={false} />);
  await wait(1000);
  for (let i = 0; i < 2; i++) {
    rerender(<Wrapper open />);
    expect(panelStyle().opacity).toBe('0');
    expect(panelStyle().transform).toContain('translateY(8px)');
    await wait(279);
    expect(panelStyle().opacity).toBe('0');
    await wait(2);
    expect(panelStyle().opacity).toBe('1');
    rerender(<Wrapper open={false} />);
  }
});

test('a toast calls onDone after 2600 ms and not before', () => {
  const onDone = vi.fn();
  render(<Toast message="Saved" onDone={onDone} />);
  expect(screen.getByText('Saved')).toBeTruthy();
  act(() => void vi.advanceTimersByTime(2599));
  expect(onDone).not.toHaveBeenCalled();
  act(() => void vi.advanceTimersByTime(1));
  expect(onDone).toHaveBeenCalledTimes(1);
});

test('a toast with no message draws nothing and never finishes', () => {
  const onDone = vi.fn();
  render(<Toast message={null} onDone={onDone} />);
  act(() => void vi.advanceTimersByTime(5000));
  expect(onDone).not.toHaveBeenCalled();
});

test('a toast is announced politely', () => {
  render(<Toast message="Saved" onDone={() => {}} />);
  expect(screen.getByRole('alert').getAttribute('aria-live')).toBe('polite');
});

/** The class react-native-web gives a View that takes no press at all (`pointerEvents="none"`), read from one drawn here. */
function noTouch(): string {
  const { container, unmount } = render(<View pointerEvents="none" />);
  const found = [...(container.firstElementChild as HTMLElement).classList].find((name) => name.startsWith('r-pointerEvents-'));
  unmount();
  if (found === undefined) throw new Error('react-native-web gave no class for none');
  return found;
}

test('a toast said while a sheet is open is drawn over the sheet, in its window, as the web\'s (z 60 over the sheet\'s 50); with none open, where the screen put it', () => {
  // The screen's own layer (its `fixed`), and a sheet over it: a Modal, a window of its own, which nothing of the screen is drawn over.
  function Screen({ open, message }: { open: boolean; message: string | null }) {
    return (
      <>
        <div data-screen>
          <Toast message={message} onDone={() => {}} />
        </div>
        <Sheet open={open} onClose={() => {}} title="Pension plan" closeLabel="Close">
          <button>inside</button>
        </Sheet>
      </>
    );
  }
  const inModal = (el: Element) => el.closest('[data-modal]') !== null;
  const { rerender } = render(<Screen open message={null} />);
  rerender(<Screen open message="Not possible: not enough cash" />);
  const toast = screen.getByRole('alert');
  expect(toast.textContent).toBe('Not possible: not enough cash');
  expect(inModal(toast)).toBe(true);
  // Drawn after the panel, so over it, and taking no touch from it.
  const panel = screen.getByRole('heading', { name: 'Pension plan' });
  expect(panel.compareDocumentPosition(toast) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(toast.classList.contains(noTouch())).toBe(true);
  // Once is all: the screen's own place draws nothing meanwhile.
  expect(screen.getAllByRole('alert')).toHaveLength(1);
  // With the sheet gone, it is where the screen put it.
  rerender(<Screen open={false} message="Not possible: not enough cash" />);
  const back = screen.getByRole('alert');
  expect(inModal(back)).toBe(false);
  expect(back.closest('[data-screen]')).not.toBeNull();
});

test('a toast already shown when a sheet opens is carried over into it as it stands: said once (no second live region, no second rise), and so back', () => {
  function Screen({ open }: { open: boolean }) {
    return (
      <>
        <Toast message="Not possible: not enough cash" onDone={() => {}} />
        <Sheet open={open} onClose={() => {}} title="Pension plan" closeLabel="Close">
          <span>in</span>
        </Sheet>
      </>
    );
  }
  const { rerender } = render(<Screen open={false} />);
  const first = screen.getByRole('alert');
  // Shown on the screen first: it rises, and the screen reader is told (Android's live region; iOS is told once by the toast itself).
  expect(first.getAttribute('aria-live')).toBe('polite');
  const rises = rea.assigned.length;
  rerender(<Screen open />);
  const carried = screen.getByRole('alert');
  expect(carried.closest('[data-modal]')).not.toBeNull();
  expect(carried.getAttribute('aria-live')).not.toBe('polite');
  // The sheet rises; the toast in it does not.
  expect(rea.assigned.length).toBe(rises + 1);
  // And back on the screen when the sheet goes: still said once, and no rise.
  rerender(<Screen open={false} />);
  const back = screen.getByRole('alert');
  expect(back.closest('[data-modal]')).toBeNull();
  expect(back.getAttribute('aria-live')).not.toBe('polite');
  expect(rea.assigned.length).toBe(rises + 1);
});

test('a toast said while a sheet is open is drawn in it first, and said there', () => {
  function Screen({ message }: { message: string | null }) {
    return (
      <>
        <Toast message={message} onDone={() => {}} />
        <Sheet open onClose={() => {}} title="Pension plan" closeLabel="Close">
          <span>in</span>
        </Sheet>
      </>
    );
  }
  const { rerender } = render(<Screen message={null} />);
  // (The sheet's own rise is among them.)
  const rises = rea.assigned.length;
  rerender(<Screen message="Not possible: not enough cash" />);
  const toast = screen.getByRole('alert');
  expect(toast.closest('[data-modal]')).not.toBeNull();
  expect(toast.getAttribute('aria-live')).toBe('polite');
  expect(rea.assigned.length).toBe(rises + 1);
});

test('a toast over a sheet still finishes on time, once', () => {
  const onDone = vi.fn();
  render(
    <>
      <Toast message="Saved" onDone={onDone} />
      <Sheet open onClose={() => {}} title="T" closeLabel="Close">
        <span>in</span>
      </Sheet>
    </>,
  );
  expect(screen.getAllByText('Saved')).toHaveLength(1);
  act(() => void vi.advanceTimersByTime(2600));
  expect(onDone).toHaveBeenCalledTimes(1);
});

const TABS = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta' },
];

test('Tabs calls onChange with the pressed tab; the chosen one is selected', () => {
  const onChange = vi.fn();
  render(<Tabs label="Sections" tabs={TABS} value="a" onChange={onChange} />);
  expect(screen.getByRole('tablist')).toBeTruthy();
  expect(screen.getByText('Alpha').closest('[role="tab"]')!.getAttribute('aria-selected')).toBe('true');
  expect(screen.getByText('Beta').closest('[role="tab"]')!.getAttribute('aria-selected')).toBe('false');
  fireEvent.click(screen.getByText('Beta'));
  expect(onChange).toHaveBeenCalledWith('b');
});

test('the active tab is cream on ink-900, the others night-700 on ink-200', () => {
  render(<Tabs tabs={TABS} value="a" onChange={() => {}} />);
  const back = (text: string) => {
    let el: HTMLElement | null = screen.getByText(text);
    while (el && el.style.backgroundColor === '') el = el.parentElement;
    return el!.style.backgroundColor;
  };
  expect(back('Alpha')).toBe(rgb(COLORS.cream));
  expect(back('Beta')).toBe(rgb(COLORS['night-700']));
  expect(screen.getByText('Alpha').parentElement!.style.color).toBe(rgb(COLORS['ink-900']));
  expect(screen.getByText('Beta').parentElement!.style.color).toBe(rgb(COLORS['ink-200']));
});

test('a tab press makes the tap sound', () => {
  const tap = vi.fn();
  render(
    <TapProvider value={tap}>
      <Tabs tabs={TABS} value="a" onChange={() => {}} />
    </TapProvider>,
  );
  fireEvent.click(screen.getByText('Beta'));
  expect(tap).toHaveBeenCalledTimes(1);
});

const OPTIONS = [
  { value: 'x', label: 'Ex', icon: 'icon-x' },
  { value: 'y', label: 'Why', face: 'face-y' },
  { value: 'z', label: 'Zed' },
];

test('a Picker shows what is chosen, opens its list in a sheet, and picking closes it', () => {
  const onChange = vi.fn();
  render(<Picker label="Letter" value="y" options={OPTIONS} onChange={onChange} closeLabel="Close" />);
  const button = screen.getByLabelText('Letter: Why');
  expect(screen.queryByRole('radiogroup')).toBeNull();
  fireEvent.click(button);
  expect(screen.getByRole('radiogroup')).toBeTruthy();
  const options = screen.getAllByRole('radio');
  expect(options.map((o) => o.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
  fireEvent.click(screen.getByText('Zed'));
  expect(onChange).toHaveBeenCalledWith('z');
  expect(screen.queryByRole('radiogroup')).toBeNull();
});

test('a Picker whose value is not in the list shows the first option', () => {
  render(<Picker label="Letter" value={null as unknown as string} options={OPTIONS} onChange={() => {}} closeLabel="Close" />);
  expect(screen.getByLabelText('Letter: Ex')).toBeTruthy();
});

/** The state of a promise, after the microtasks queued so far. */
async function settledAfter(promise: Promise<void>): Promise<boolean> {
  let done = false;
  void promise.then(() => (done = true));
  await act(async () => {});
  return done;
}

test('a sheet that closes tells its Modal it is hidden, and stays until the Modal has dismissed (iOS says so with onDismiss)', async () => {
  platform.OS = 'ios';
  const { rerender } = render(<Wrapper open />);
  expect(modals()).toEqual(['true']);
  rerender(<Wrapper open={false} />);
  expect(modal.props).toMatchObject({ visible: false });
  expect(screen.queryByText('inside')).toBeNull();
  // Still mounted, so that the dismissal can be heard.
  expect(modals()).toEqual(['false']);
  await wait(599);
  expect(modals()).toEqual(['false']);
  act(() => (modal.props!.onDismiss as () => void)());
  expect(modals()).toEqual([]);
});

test('sheetsGone waits for a sheet that is open, and for its Modal to dismiss once it has closed', async () => {
  platform.OS = 'ios';
  expect(await settledAfter(sheetsGone())).toBe(true);
  const { rerender } = render(<Wrapper open />);
  const gone = sheetsGone();
  expect(await settledAfter(gone)).toBe(false);
  rerender(<Wrapper open={false} />);
  // Closed by its parent, not gone: the Modal has not said it has dismissed.
  expect(await settledAfter(gone)).toBe(false);
  act(() => (modal.props!.onDismiss as () => void)());
  expect(await settledAfter(gone)).toBe(true);
});

test('where the platform hides a Modal as it is told to and says nothing of it (Android), the sheet is gone as soon as it is hidden', async () => {
  platform.OS = 'android';
  const { rerender } = render(<Wrapper open />);
  const gone = sheetsGone();
  expect(await settledAfter(gone)).toBe(false);
  rerender(<Wrapper open={false} />);
  expect(await settledAfter(gone)).toBe(true);
  expect(modals()).toEqual([]);
});

test('a Modal on iOS that was never shown says nothing when it is hidden: the sheet is let go after 600 ms, and nobody waits for ever', async () => {
  platform.OS = 'ios';
  const { rerender } = render(<Wrapper open />);
  rerender(<Wrapper open={false} />);
  const gone = sheetsGone();
  await wait(599);
  expect(await settledAfter(gone)).toBe(false);
  await wait(2);
  expect(await settledAfter(gone)).toBe(true);
  expect(modals()).toEqual([]);
});

test('a sheet whose parent goes away with it counts for nothing from then on', async () => {
  platform.OS = 'ios';
  const { unmount } = render(<Wrapper open />);
  const gone = sheetsGone();
  expect(await settledAfter(gone)).toBe(false);
  unmount();
  expect(await settledAfter(gone)).toBe(true);
});

test('every sheet that is open is waited for, not only the last', async () => {
  platform.OS = 'android';
  const { rerender } = render(
    <>
      <Wrapper open />
      <Sheet open onClose={() => {}} title="Other" closeLabel="Close">
        <span>other</span>
      </Sheet>
    </>,
  );
  const gone = sheetsGone();
  rerender(
    <>
      <Wrapper open={false} />
      <Sheet open onClose={() => {}} title="Other" closeLabel="Close">
        <span>other</span>
      </Sheet>
    </>,
  );
  expect(await settledAfter(gone)).toBe(false);
  rerender(
    <>
      <Wrapper open={false} />
      <Sheet open={false} onClose={() => {}} title="Other" closeLabel="Close">
        <span>other</span>
      </Sheet>
    </>,
  );
  expect(await settledAfter(gone)).toBe(true);
});

test('a sheet that opens again while it is still leaving is one sheet, shown, and is waited for', async () => {
  platform.OS = 'ios';
  const { rerender } = render(<Wrapper open />);
  rerender(<Wrapper open={false} />);
  rerender(<Wrapper open />);
  expect(modals()).toEqual(['true']);
  expect(screen.getAllByText('inside')).toHaveLength(1);
  // The Modal that was leaving is gone: its dismissal, heard late, closes nothing.
  const gone = sheetsGone();
  expect(await settledAfter(gone)).toBe(false);
  rerender(<Wrapper open={false} />);
  act(() => (modal.props!.onDismiss as () => void)());
  expect(await settledAfter(gone)).toBe(true);
});

test('a dismissal the Modal reports while the sheet is open takes nothing from it', async () => {
  platform.OS = 'ios';
  render(<Wrapper open />);
  expect(modal.props!.onDismiss).toBeUndefined();
  expect(screen.getByText('inside')).toBeTruthy();
  expect(await settledAfter(sheetsGone())).toBe(false);
});
