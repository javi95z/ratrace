// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { View } from 'react-native';
import { EXTRA, COLORS } from './theme';
import { letHeldTurnsGo, sheetsGone } from './back';
import { Sheet, Tabs, Toast } from './overlay';
import { Picker } from './Picker';
import { Slider } from './Slider';
import { rea } from './testing/reanimated';
import { gestures, type PanConfig } from './testing/gestures';
import { TapProvider } from './tap';
import { ReducedMotionProvider } from './animations';

// The Modal is told how it is used (transparent, no animation of its own) and what Back does. It shows its children while
// it is visible, as every platform's does; telling that it has dismissed (iOS's onDismiss) is the test's to do.
const modal = vi.hoisted(() => ({ props: null as Record<string, unknown> | null }));
// And the box that leaves the keyboard its room: what it was told.
const avoiding = vi.hoisted(() => [] as Array<Record<string, unknown>>);
// And the keyboard put away.
const keyboard = vi.hoisted(() => ({ dismissed: 0, listeners: new Map<string, Set<() => void>>() }));
/** The keyboard comes up or goes, as the phone tells it. */
const keyboardSays = (event: string) => act(() => keyboard.listeners.get(event)?.forEach((listener) => listener()));
const platform = vi.hoisted(() => ({ OS: 'web' }));
// And how tall the panel that is pulled is laid out, which jsdom never lays out: the test says it (`laidOut`).
const pulled = vi.hoisted(() => ({ onLayout: null as null | ((event: { nativeEvent: { layout: { height: number } } }) => void) }));
vi.mock('react-native', async () => {
  const rn = await vi.importActual<Record<string, unknown> & { Platform: object }>('react-native-web');
  const { createElement, forwardRef } = await vi.importActual<typeof import('react')>('react');
  const NativeView = rn.View as React.ComponentType<Record<string, unknown>>;
  return {
    ...rn,
    View: forwardRef<unknown, Record<string, unknown>>(function View(props, ref) {
      if (props.testID === 'sheet-pull') pulled.onLayout = props.onLayout as typeof pulled.onLayout;
      return createElement(NativeView, { ...props, ref });
    }),
    Platform: { ...rn.Platform, get OS() { return platform.OS; } },
    AccessibilityInfo: { isReduceMotionEnabled: () => Promise.resolve(false), addEventListener: () => ({ remove() {} }) },
    Keyboard: {
      dismiss: () => void (keyboard.dismissed += 1),
      addListener: (event: string, listener: () => void) => {
        const set = keyboard.listeners.get(event) ?? new Set<() => void>();
        set.add(listener);
        keyboard.listeners.set(event, set);
        return { remove: () => void set.delete(listener) };
      },
    },
    KeyboardAvoidingView: (props: { children: React.ReactNode } & Record<string, unknown>) => {
      avoiding.push(props);
      return <div data-testid="keyboard-room">{props.children}</div>;
    },
    Modal: (props: { children: React.ReactNode; visible?: boolean } & Record<string, unknown>) => {
      modal.props = props;
      return <div data-modal data-visible={String(props.visible !== false)}>{props.visible === false ? null : props.children}</div>;
    },
  };
});
vi.mock('./Sprite', () => ({
  Sprite: ({ id }: { id: string }) => <div data-sprite={id} />,
  SpriteLayers: ({ layers }: { layers: Array<{ id: string }> }) => (
    <div>
      {layers.map((layer) => (
        <div key={layer.id} data-sprite={layer.id} />
      ))}
    </div>
  ),
}));
// Reanimated needs the worklets runtime: the shared reactive fake stands in for it.
vi.mock('react-native-reanimated', async () => (await import('./testing/reanimated')).reanimatedFake());
// The gesture handler's native side does not load here: its stand-in.
vi.mock('react-native-gesture-handler', async () => (await import('./testing/gestures')).gestureFake());
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 20, left: 0, right: 0 }) }));

beforeEach(() => {
  vi.useFakeTimers();
  rea.assigned.length = 0;
  gestures.pans.length = 0;
  gestures.failed.length = 0;
  platform.OS = 'web';
});
afterEach(() => {
  cleanup();
  // A sheet taken away open holds its turn a moment on the phone: let it go before the next test.
  letHeldTurnsGo();
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

test('a sheet rises over the keyboard on every platform: its window is its own, which nothing else makes smaller for it', () => {
  for (const os of ['ios', 'android']) {
    platform.OS = os;
    avoiding.length = 0;
    sheet();
    expect(avoiding.at(-1)).toMatchObject({ behavior: 'padding', style: { flex: 1 } });
    const room = screen.getByTestId('keyboard-room');
    expect(room.contains(screen.getByText('inside'))).toBe(true);
    expect(room.contains(document.body.querySelector('[data-testid="sheet-backdrop"]'))).toBe(true);
    cleanup();
    act(() => void vi.runOnlyPendingTimers());
  }
});

test('with the keyboard up, a sheet\'s foot is its own 12, not the home indicator\'s inset: the keyboard stands over the indicator (34 pt of nothing over it on an iPhone)', () => {
  for (const [os, up, down] of [['ios', 'keyboardWillShow', 'keyboardWillHide'], ['android', 'keyboardDidShow', 'keyboardDidHide']] as const) {
    platform.OS = os;
    sheet();
    const foot = () => {
      let el: HTMLElement | null = screen.getByText('inside').parentElement;
      while (el && el.style.paddingBottom === '') el = el.parentElement;
      return el?.style.paddingBottom;
    };
    // The mocked phone's inset is 20.
    expect(foot()).toBe('20px');
    keyboardSays(up);
    expect(foot()).toBe('12px');
    keyboardSays(down);
    expect(foot()).toBe('20px');
    cleanup();
    act(() => void vi.runOnlyPendingTimers());
    // Nothing listens once the sheet has gone.
    expect([...keyboard.listeners.values()].every((set) => set.size === 0)).toBe(true);
  }
});

test('a sheet puts the page\'s keyboard away as it opens: a field focused on the page never stays over the sheet', () => {
  keyboard.dismissed = 0;
  sheet({ open: false });
  expect(keyboard.dismissed).toBe(0);
  cleanup();
  sheet();
  expect(keyboard.dismissed).toBe(1);
});

test('a sheet the page takes away while it is shown keeps its turn until its Modal has gone: no other is presented while it is dismissed', () => {
  function Page({ first }: { first: boolean }) {
    return first ? (
      <Sheet key="first" open onClose={() => {}} title="First" closeLabel="Close">
        <p>first</p>
      </Sheet>
    ) : (
      <Sheet key="second" open onClose={() => {}} title="Second" closeLabel="Close">
        <p>second</p>
      </Sheet>
    );
  }
  // iOS: 600 ms, until a real phone is measured (the simulator's 16 to 25 ms were on an idle Mac, Task 14); Android: not measured (no emulator), a
  // moment.
  for (const [os, ms] of [['ios', 600], ['android', 100]] as const) {
    platform.OS = os;
    const { rerender, unmount } = render(<Page first />);
    expect(screen.getByText('first')).toBeTruthy();
    // The screen changes under it (a room started, or left): the first is taken away whole, the second opens in the same moment.
    rerender(<Page first={false} />);
    expect(screen.queryByText('first'), os).toBeNull();
    expect(screen.queryByText('second'), os).toBeNull();
    act(() => void vi.advanceTimersByTime(ms - 1));
    expect(screen.queryByText('second'), os).toBeNull();
    act(() => void vi.advanceTimersByTime(1));
    expect(screen.getByText('second'), os).toBeTruthy();
    unmount();
    act(() => void vi.runOnlyPendingTimers());
  }
  // Where a Modal is gone the moment it is taken away (react-native-web), the next is shown at once.
  platform.OS = 'web';
  const { rerender } = render(<Page first />);
  rerender(<Page first={false} />);
  expect(screen.getByText('second')).toBeTruthy();
});

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
  await wait(149);
  expect(modals()).toEqual(['false']);
  act(() => (modal.props!.onDismiss as () => void)());
  expect(modals()).toEqual([]);
});

test('a sheet asked to show keeps its turn once hidden until its Modal says it has dismissed, even closed before iOS said it was shown, however long that takes', async () => {
  platform.OS = 'ios';
  vi.useFakeTimers();
  try {
    function Page({ first, second }: { first: boolean; second: boolean }) {
      return (
        <>
          <Sheet open={first} onClose={() => {}} title="First" closeLabel="Close">
            <p>first</p>
          </Sheet>
          <Sheet open={second} onClose={() => {}} title="Second" closeLabel="Close">
            <p>second</p>
          </Sheet>
        </>
      );
    }
    const { rerender } = render(<Page first second={false} />);
    // Closed by the game before iOS has said it is shown (no `onShow`): UIKit presents it, then dismisses it, and says so only then.
    rerender(<Page first={false} second />);
    // The second is not drawn yet: the Modal last drawn is the first's, hidden.
    const shown = modal.props!;
    expect(shown.visible).toBe(false);
    // Hidden, and still being dismissed on a busy phone: the second waits, past the moment a sheet never shown is given, to just short of the
    // backstop.
    act(() => void vi.advanceTimersByTime(150));
    expect(screen.queryByText('second')).toBeNull();
    act(() => void vi.advanceTimersByTime(849));
    expect(screen.queryByText('second')).toBeNull();
    // Its word: gone, and the second is presented.
    act(() => (shown.onDismiss as () => void)());
    expect(screen.getByText('second')).toBeTruthy();
  } finally {
    vi.useRealTimers();
  }
});

test('a sheet asked to show whose Modal never says it has dismissed is let go at the backstop: no turn is held for ever', async () => {
  platform.OS = 'ios';
  vi.useFakeTimers();
  try {
    const { rerender } = render(<Wrapper open />);
    rerender(<Wrapper open={false} />);
    const gone = sheetsGone();
    act(() => void vi.advanceTimersByTime(999));
    expect(await settledAfter(gone)).toBe(false);
    act(() => void vi.advanceTimersByTime(1));
    expect(await settledAfter(gone)).toBe(true);
  } finally {
    vi.useRealTimers();
  }
});

test('a sheet whose title changes while it closes is let go when it would have been: its wait is not begun again', async () => {
  platform.OS = 'ios';
  vi.useFakeTimers();
  try {
    const titled = (open: boolean, title: string) => (
      <Sheet open={open} onClose={() => {}} title={title} closeLabel="Close">
        <p>inside</p>
      </Sheet>
    );
    const { rerender } = render(titled(true, 'One'));
    rerender(titled(false, 'One'));
    const gone = sheetsGone();
    act(() => void vi.advanceTimersByTime(900));
    rerender(titled(false, 'Two'));
    act(() => void vi.advanceTimersByTime(100));
    expect(await settledAfter(gone)).toBe(true);
  } finally {
    vi.useRealTimers();
  }
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

test('a sheet that closes says when it has gone (onGone): once its Modal has dismissed, never while it is leaving, and not for an opening it was reopened from', async () => {
  platform.OS = 'ios';
  const gone = vi.fn();
  const Gone = ({ open }: { open: boolean }) => (
    <Sheet open={open} onClose={() => {}} onGone={gone} title="Title" closeLabel="Close">
      <span>inside</span>
    </Sheet>
  );
  const { rerender } = render(<Gone open />);
  rerender(<Gone open={false} />);
  // Hidden and still leaving: another sheet presented now would come while this one's view is dismissed.
  expect(gone).not.toHaveBeenCalled();
  act(() => (modal.props!.onDismiss as () => void)());
  expect(gone).toHaveBeenCalledTimes(1);
  // Opened again while it was leaving: the opening that left says nothing, the one shown says it once it goes.
  rerender(<Gone open />);
  rerender(<Gone open={false} />);
  rerender(<Gone open />);
  await wait(700);
  expect(gone).toHaveBeenCalledTimes(1);
  rerender(<Gone open={false} />);
  act(() => (modal.props!.onDismiss as () => void)());
  expect(gone).toHaveBeenCalledTimes(2);
});

/** Two sheets side by side, as two parts of a screen open theirs (a moment of the round, a badge it earned), each open as told. */
function Two({ first, second, nested = false }: { first: boolean; second: boolean; nested?: boolean }) {
  const inner = (
    <Sheet open={second} onClose={() => {}} title="Second" closeLabel="Close">
      <span>second inside</span>
    </Sheet>
  );
  return (
    <>
      <Sheet open={first} onClose={() => {}} title="First" closeLabel="Close">
        <span>first inside</span>
        {nested ? inner : null}
      </Sheet>
      {nested ? null : inner}
    </>
  );
}
const shownSheets = () => ['first inside', 'second inside'].filter((words) => screen.queryByText(words) !== null);

test('two sheets opened side by side take turns, as iOS presents one Modal at a time: the last opened first, as the web draws it on top, then the other', () => {
  platform.OS = 'android';
  const { rerender } = render(<Two first={false} second={false} />);
  rerender(<Two first second />);
  expect(shownSheets()).toEqual(['second inside']);
  expect(modals()).toEqual(['true']);
  // The second closed and gone: the first takes its turn, rising from its first frame.
  rerender(<Two first second={false} />);
  expect(shownSheets()).toEqual(['first inside']);
  expect(modals()).toEqual(['true']);
  rerender(<Two first={false} second={false} />);
  expect(modals()).toEqual([]);
});

test('Android Back closes the sheet that is shown, and the one waiting its turn shows then', () => {
  platform.OS = 'android';
  function Kept() {
    const [open, setOpen] = useState({ first: true, second: true });
    return (
      <>
        <Sheet open={open.first} onClose={() => setOpen((now) => ({ ...now, first: false }))} title="First" closeLabel="Close">
          <span>first inside</span>
        </Sheet>
        <Sheet open={open.second} onClose={() => setOpen((now) => ({ ...now, second: false }))} title="Second" closeLabel="Close">
          <span>second inside</span>
        </Sheet>
      </>
    );
  }
  render(<Kept />);
  expect(shownSheets()).toEqual(['second inside']);
  // Back is the shown Modal's `onRequestClose`: the second closes, and the first takes its turn.
  act(() => (modal.props!.onRequestClose as () => void)());
  expect(shownSheets()).toEqual(['first inside']);
  act(() => (modal.props!.onRequestClose as () => void)());
  expect(shownSheets()).toEqual([]);
  expect(modals()).toEqual([]);
});

test('a sheet that opens while another is shown waits until that one has gone, its Modal dismissed (iOS cannot present while it dismisses)', async () => {
  platform.OS = 'ios';
  const { rerender } = render(<Two first second={false} />);
  expect(shownSheets()).toEqual(['first inside']);
  rerender(<Two first second />);
  expect(shownSheets()).toEqual(['first inside']);
  // Closed, but still leaving: the second still waits.
  rerender(<Two first={false} second />);
  expect(shownSheets()).toEqual([]);
  expect(modals()).toEqual(['false']);
  act(() => (modal.props!.onDismiss as () => void)());
  expect(shownSheets()).toEqual(['second inside']);
});

test('a sheet drawn inside another is presented by it, at once; and one closed before its turn came is never shown', () => {
  platform.OS = 'android';
  const { rerender } = render(<Two first second={false} nested />);
  rerender(<Two first second nested />);
  expect(shownSheets()).toEqual(['first inside', 'second inside']);
  expect(modals()).toEqual(['true', 'true']);
  cleanup();
  render(<Two first second={false} />);
  const waiting = render(<Two first={false} second />);
  waiting.rerender(<Two first={false} second={false} />);
  cleanup();
  // The first, taken away while shown, holds its turn until it has gone (`endTurnOnceGone`).
  act(() => void vi.runOnlyPendingTimers());
  // Nothing left waiting: a sheet opened next is shown at once.
  render(<Wrapper open />);
  expect(screen.getByText('inside')).toBeTruthy();
});

/*
 * Pulling a sheet down. Its two pans are the gesture handler's (here the stand-in's, driven as the handler would): the grip's, which goes either way,
 * and the body's, which only goes down and only from the top of what scrolls.
 */
const pans = () => {
  const grip = gestures.pans.findLast((pan) => Array.isArray(pan.activeOffsetY));
  const body = gestures.pans.findLast((pan) => typeof pan.activeOffsetY === 'number');
  return { grip: grip!, body: body! };
};
const laidOut = (height: number) => act(() => pulled.onLayout?.({ nativeEvent: { layout: { height } } }));
const pullStyle = () => (screen.getByTestId('sheet-pull') as HTMLElement).style;
const backdropOpacity = () => (document.body.querySelector('[data-testid="sheet-backdrop"]') as HTMLElement).style.opacity;
/** A drag on a pan: it activates `from` points down (the handler's slop), goes to `to`, and is let go there at `velocity`. */
function drag(pan: PanConfig, to: number, velocity = 0, from = 10) {
  act(() => {
    pan.onActivate?.({ translationY: from, velocityY: 0 });
    pan.onUpdate?.({ translationY: to, velocityY: velocity });
  });
  act(() => pan.onDeactivate?.({ translationY: to, velocityY: velocity }));
}

test('a sheet has a grabber at the top of its panel: a short bar of the kit\'s ink, square, never focused, never said', () => {
  sheet();
  const grabber = screen.getByTestId('sheet-grabber');
  expect(grabber.getAttribute('aria-hidden')).toBe('true');
  expect(grabber.querySelector('[tabindex]')).toBeNull();
  expect(grabber.getAttribute('tabindex')).toBeNull();
  const bar = grabber.firstElementChild as HTMLElement;
  expect(bar.style.backgroundColor).toBe(rgb(COLORS['ink-500']));
  expect(bar.style.width).toBe('32px');
  expect(bar.style.height).toBe('4px');
  // It stands in the panel's own top room, over the title: nothing of the panel moves for it.
  expect(grabber.style.position).toBe('absolute');
  expect(screen.getByLabelText('Close').contains(grabber)).toBe(false);
});

test('pulled down, the panel follows the finger and the dimmed page fades with it; up past its rest, it gives a little', () => {
  sheet();
  laidOut(600);
  const { grip } = pans();
  act(() => grip.onActivate?.({ translationY: 10, velocityY: 0 }));
  // No jump as the drag is taken: the panel moves from where it stood.
  expect(pullStyle().transform).toBe('translateY(0px)');
  act(() => grip.onUpdate?.({ translationY: 310, velocityY: 0 }));
  expect(pullStyle().transform).toBe('translateY(300px)');
  expect(Number(backdropOpacity())).toBeCloseTo(0.5);
  act(() => grip.onUpdate?.({ translationY: -200, velocityY: 0 }));
  const up = Number(/translateY\((-?[\d.]+)px\)/.exec(pullStyle().transform)![1]);
  expect(up).toBeLessThan(0);
  expect(up).toBeGreaterThan(-24);
  expect(backdropOpacity()).toBe('1');
});

test('a drag the phone tells late (its touches far apart) is caught up with: the panel stays under the finger, short only of the slop', () => {
  sheet();
  laidOut(600);
  const { grip } = pans();
  act(() => grip.onActivate?.({ translationY: 60, velocityY: 0 }));
  act(() => grip.onUpdate?.({ translationY: 60, velocityY: 0 }));
  expect(pullStyle().transform).toBe('translateY(50px)');
});

test('let go past a third of the panel, it slides away and then asks its owner to close it, as the close button does', async () => {
  const onClose = sheet();
  laidOut(600);
  drag(pans().grip, 260);
  expect(onClose).not.toHaveBeenCalled();
  expect(rea.assigned.at(-1)).toMatchObject({ kind: 'timing', to: 624 });
  expect(rea.assigned.at(-1)!.duration).toBeLessThanOrEqual(200);
  await wait(rea.assigned.at(-1)!.duration);
  await wait(1);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('let go short of a third, it springs back to its rest and nothing is asked', async () => {
  const onClose = sheet();
  laidOut(600);
  drag(pans().grip, 150);
  expect(rea.assigned.at(-1)).toMatchObject({ kind: 'spring', to: 0 });
  await wait(1000);
  expect(onClose).not.toHaveBeenCalled();
  expect(pullStyle().transform).toBe('translateY(0px)');
});

test('a quick flick down closes it from a short pull; a flick back up keeps it however far it was pulled', async () => {
  const onClose = sheet();
  laidOut(600);
  drag(pans().grip, 60, 1500);
  await wait(1000);
  expect(onClose).toHaveBeenCalledTimes(1);
  cleanup();
  const kept = sheet();
  laidOut(600);
  drag(pans().grip, 400, -1500);
  await wait(1000);
  expect(kept).not.toHaveBeenCalled();
});

test('a sheet whose owner does not close it comes back with the render its asking starts: it never waits off the screen', async () => {
  const onClose = sheet();
  laidOut(600);
  drag(pans().grip, 400);
  const slide = rea.assigned.at(-1)!;
  expect(slide).toMatchObject({ kind: 'timing', to: 624 });
  rea.assigned.length = 0;
  // The slide lands and the owner is asked (a moment later, on React's side): in the same moment it is on its way back.
  await wait(slide.duration);
  await wait(1);
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(rea.assigned).toEqual([expect.objectContaining({ kind: 'spring', to: 0 })]);
  await wait(1000);
  expect(pullStyle().transform).toBe('translateY(0px)');
  // And it can be pulled again.
  drag(pans().grip, 400);
  await wait(300);
  expect(onClose).toHaveBeenCalledTimes(2);
});

test('a sheet its owner closes is not brought back', async () => {
  function Owned() {
    const [open, setOpen] = useState(true);
    return (
      <Sheet open={open} onClose={() => setOpen(false)} title="Title" closeLabel="Close">
        <span>inside</span>
      </Sheet>
    );
  }
  platform.OS = 'android';
  render(<Owned />);
  laidOut(600);
  drag(pans().grip, 400);
  rea.assigned.length = 0;
  await wait(300);
  expect(modals()).toEqual([]);
  await wait(1000);
  expect(rea.assigned.filter((one) => one.kind === 'spring')).toEqual([]);
});

test('a sheet that gives its place to what comes next (the moments, one after another) comes back with it at once', async () => {
  function Moments() {
    const [at, setAt] = useState(1);
    return (
      <Sheet open={at <= 2} onClose={() => setAt((n) => n + 1)} title={`Moment ${at}`} closeLabel="Close">
        <span>{`moment ${at}`}</span>
      </Sheet>
    );
  }
  render(<Moments />);
  laidOut(600);
  drag(pans().grip, 400);
  await wait(300);
  expect(screen.getByText('moment 2')).toBeTruthy();
  expect(rea.assigned.at(-1)).toMatchObject({ kind: 'spring', to: 0 });
  await wait(1000);
  expect(pullStyle().transform).toBe('translateY(0px)');
});

test('while a drag\'s question waits for the owner, the backdrop, the Close and Android\'s Back ask nothing: a tap on a page that seems gone is no second answer', async () => {
  const onClose = sheet();
  laidOut(600);
  drag(pans().grip, 400);
  // The panel is sliding away, the owner not asked yet.
  await wait(20);
  fireEvent.click(document.body.querySelector('[data-testid="sheet-backdrop"]') as HTMLElement);
  fireEvent.click(screen.getByLabelText('Close'));
  act(() => (modal.props!.onRequestClose as () => void)());
  expect(onClose).not.toHaveBeenCalled();
  await wait(300);
  expect(onClose).toHaveBeenCalledTimes(1);
  // Answered (here: refused, it is still open), they ask again.
  fireEvent.click(document.body.querySelector('[data-testid="sheet-backdrop"]') as HTMLElement);
  expect(onClose).toHaveBeenCalledTimes(2);
});

test('a locked sheet (an account being deleted) has no grabber, gives only a little either way, and is never asked to close by a drag', async () => {
  const onClose = sheet({ locked: true });
  expect(screen.queryByTestId('sheet-grabber')).toBeNull();
  laidOut(600);
  const { grip, body } = pans();
  act(() => {
    grip.onActivate?.({ translationY: 10, velocityY: 0 });
    grip.onUpdate?.({ translationY: 400, velocityY: 0 });
  });
  const down = Number(/translateY\((-?[\d.]+)px\)/.exec(pullStyle().transform)![1]);
  expect(down).toBeGreaterThan(0);
  expect(down).toBeLessThan(24);
  act(() => grip.onDeactivate?.({ translationY: 400, velocityY: 3000 }));
  expect(rea.assigned.at(-1)).toMatchObject({ kind: 'spring', to: 0 });
  drag(body, 500, 3000);
  await wait(1000);
  expect(onClose).not.toHaveBeenCalled();
  expect(pullStyle().transform).toBe('translateY(0px)');
});

test('the spring back never carries an upward flick past the rest', () => {
  sheet();
  laidOut(600);
  drag(pans().grip, 40, -5000);
  expect(rea.assigned.at(-1)).toMatchObject({ kind: 'spring', to: 0, spring: { velocity: 0, overshootClamping: true } });
});

test('a drag the phone takes away (a cancel) springs back and asks nothing', async () => {
  const onClose = sheet();
  laidOut(600);
  const { grip } = pans();
  act(() => {
    grip.onActivate?.({ translationY: 10, velocityY: 0 });
    grip.onUpdate?.({ translationY: 500, velocityY: 0 });
  });
  act(() => grip.onDeactivate?.({ translationY: 500, velocityY: 0, canceled: true }));
  expect(rea.assigned.at(-1)).toMatchObject({ kind: 'spring', to: 0 });
  await wait(1000);
  expect(onClose).not.toHaveBeenCalled();
});

test('the body is dragged only down, and only while what it holds is scrolled to its top; the grip goes either way', () => {
  sheet();
  const { grip, body } = pans();
  expect(grip.activeOffsetY).toEqual([-10, 10]);
  expect(body.activeOffsetY).toBe(10);
  expect(body.failOffsetY).toBe(-10);
  // Sideways is a slider's.
  expect(body.failOffsetX).toEqual([-20, 20]);
  const enabled = body.enabled as { value: boolean };
  expect(enabled.value).toBe(true);
  // What scrolls is the box round the body's content (react-native-web's ScrollView: the scroller, its content's box, the content).
  const scroller = screen.getByText('inside').parentElement!.parentElement!;
  const scrolled = (y: number) => act(() => void fireEvent.scroll(scroller, { target: { scrollTop: y } }));
  scrolled(120);
  expect(enabled.value).toBe(false);
  // Scroll events come at most one a frame (`scrollEventThrottle`).
  act(() => void vi.advanceTimersByTime(50));
  scrolled(0);
  expect(enabled.value).toBe(true);
});

test('under reduced motion nothing slides or springs: the owner is asked at once, and a pull let go short is at its rest at once', async () => {
  const onClose = vi.fn();
  render(
    <ReducedMotionProvider value>
      <Sheet open onClose={onClose} title="Title" closeLabel="Close">
        <span>inside</span>
      </Sheet>
    </ReducedMotionProvider>,
  );
  laidOut(600);
  drag(pans().grip, 100);
  expect(pullStyle().transform).toBe('translateY(0px)');
  drag(pans().grip, 400);
  expect(rea.assigned).toEqual([]);
  await wait(1);
  expect(onClose).toHaveBeenCalledTimes(1);
  // Refused, it is back at its rest at once.
  await wait(1);
  expect(pullStyle().transform).toBe('translateY(0px)');
  expect(rea.assigned).toEqual([]);
});

test('a slider in a sheet holds it: pressed, the sheet\'s pan gives way to it (and to the scroll), and no drag moves the sheet', async () => {
  const onClose = vi.fn();
  render(
    <Sheet open onClose={onClose} title="Title" closeLabel="Close">
      <Slider value={5} min={0} max={10} step={1} onChange={() => {}} label="Amount" />
    </Sheet>,
  );
  laidOut(600);
  const slider = gestures.pans.findLast((pan) => pan.runOnJS === true) as PanConfig & { onBegin(event: { x: number; y: number }): void; onFinalize(event: { x: number; y: number }): void };
  const { body } = pans();
  act(() => slider.onBegin({ x: 10, y: 20 }));
  (body.onTouchesMove as (event: { handlerTag: number }) => void)({ handlerTag: 7 });
  expect(gestures.failed).toEqual([7]);
  drag(body, 400, 3000);
  await wait(400);
  expect(onClose).not.toHaveBeenCalled();
  expect(pullStyle().transform).toBe('translateY(0px)');
  // Let go, the sheet is its own again.
  act(() => slider.onFinalize({ x: 10, y: 20 }));
  (body.onTouchesMove as (event: { handlerTag: number }) => void)({ handlerTag: 8 });
  expect(gestures.failed).toEqual([7]);
  drag(body, 400, 3000);
  await wait(400);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('a sheet closed some other way while it slides away (the browser\'s Back) is not asked again: its owner is told once', async () => {
  const onClose = vi.fn();
  let closeNow = () => {};
  function Owned() {
    const [open, setOpen] = useState(true);
    closeNow = () => setOpen(false);
    return (
      <Sheet
        open={open}
        onClose={() => {
          onClose();
          setOpen(false);
        }}
        title="Title"
        closeLabel="Close"
      >
        <span>inside</span>
      </Sheet>
    );
  }
  render(<Owned />);
  laidOut(600);
  drag(pans().grip, 400);
  await wait(20);
  act(() => closeNow());
  await wait(1000);
  expect(onClose).not.toHaveBeenCalled();
});
