// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { EXTRA, COLORS } from './theme';
import { Sheet, Tabs, Toast } from './overlay';
import { Picker } from './Picker';
import { TapProvider } from './tap';

// The Modal is told how it is used (transparent, no animation of its own) and what Back does.
const modal = vi.hoisted(() => ({ props: null as Record<string, unknown> | null }));
vi.mock('react-native', async () => {
  const rn = await vi.importActual<Record<string, unknown>>('react-native-web');
  return {
    ...rn,
    Modal: (props: { children: React.ReactNode } & Record<string, unknown>) => {
      modal.props = props;
      return <div data-modal>{props.children}</div>;
    },
  };
});
vi.mock('./Sprite', () => ({ Sprite: ({ id }: { id: string }) => <div data-sprite={id} /> }));
// Reanimated needs the worklets runtime; the rise itself is pinned in animations.test.tsx.
vi.mock('react-native-reanimated', async () => {
  const { View } = await import('react-native');
  return { default: { View } };
});
vi.mock('./animations', () => ({ useRise: () => ({}) }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 20, left: 0, right: 0 }) }));

beforeEach(() => vi.useFakeTimers());
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

test('with back off, Back does not close the sheet', () => {
  const onClose = sheet({ back: false });
  (modal.props!.onRequestClose as () => void)();
  expect(onClose).not.toHaveBeenCalled();
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
