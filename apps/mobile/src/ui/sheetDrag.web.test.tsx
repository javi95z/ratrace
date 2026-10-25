// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { letHeldTurnsGo } from './back';
import { Sheet } from './overlay';
import { speedOf } from './sheetDrag.web';
import { View } from 'react-native';
import { memoryServices, renderGame } from '../testing/render';
import { AmountSheet } from '../game/screens/AmountSheet';
import { browserAt } from './testing/media';
import { rea } from './testing/reanimated';

/*
 * A sheet on the web is dragged down with the page's own pointer events (a mouse's, a pen's, a finger's): from its grip (the grabber and the title
 * row) either way, from its body only down and only from the top of what scrolls. A press that does not move is a click as before; the click a drag
 * ends with is the drag's. jsdom lays nothing out, so the panel is never measured: a flick closes it here, a slow short pull leaves it.
 */

let restore: (() => void) | null = null;
beforeEach(() => {
  vi.useFakeTimers();
  rea.assigned.length = 0;
});
afterEach(() => {
  cleanup();
  letHeldTurnsGo();
  restore?.();
  restore = null;
  vi.useRealTimers();
});

const wait = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
/** A sheet comes up from the foot of the screen as it opens; never measured here, it stands in its place a moment after (`MEASURE_BACKSTOP_MS`). */
const cameUp = () => wait(100);

type Kind = 'touch' | 'mouse' | 'pen';
/**
 * A pointer event as a browser gives it (jsdom has no PointerEvent of its own), at `y` on the page, `t` milliseconds into the drag: a finger's unless
 * said, its button down but as it is lifted (`buttons`).
 */
function pointer(type: string, target: Element, y: number, t: number, x = 100, kind: Kind = 'touch', buttons = type === 'pointerup' ? 0 : 1, id = 1) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons });
  Object.defineProperties(event, { pointerId: { value: id }, isPrimary: { value: true }, timeStamp: { value: t }, pointerType: { value: kind } });
  act(() => void target.dispatchEvent(event));
  return event;
}

/** A finger's own move, as the browser asks the page whether it may scroll with it (`preventDefault` keeps it from scrolling). */
function touchMove(target: Element, y: number, x = 100) {
  const event = new Event('touchmove', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', { value: [{ clientX: x, clientY: y }] });
  act(() => void target.dispatchEvent(event));
  return event;
}

/** A drag from `target`, from `from` to `to` on the page over `ms` milliseconds, in steps, let go there. */
function dragOn(target: Element, from: number, to: number, ms: number, kind: Kind = 'touch') {
  pointer('pointerdown', target, from, 1000, 100, kind);
  const steps = 6;
  for (let i = 1; i <= steps; i++) pointer('pointermove', target, from + ((to - from) * i) / steps, 1000 + (ms * i) / steps, 100, kind);
  pointer('pointerup', target, to, 1000 + ms, 100, kind);
}

function Owned({ refuse = false, onClose = () => {} }: { refuse?: boolean; onClose?: () => void }) {
  const [open, setOpen] = useState(true);
  const [pressed, setPressed] = useState(0);
  return (
    <Sheet
      open={open}
      onClose={() => {
        onClose();
        if (!refuse) setOpen(false);
      }}
      title="Details"
      closeLabel="Close"
    >
      <button type="button" onClick={() => setPressed((n) => n + 1)}>
        {`pressed ${pressed}`}
      </button>
    </Sheet>
  );
}

const grip = () => screen.getByText('Details');
const body = () => screen.getByRole('button', { name: /pressed/ });
const pullStyle = () => screen.getByTestId('sheet-pull').style;

describe('a sheet dragged on the web', () => {
  beforeEach(() => {
    restore = browserAt(393);
  });

  it('has a grabber, out of the reader\'s reach, and a grip a finger never scrolls the page from', async () => {
    render(<Owned />);
    await cameUp();
    expect(screen.getByTestId('sheet-grabber').getAttribute('aria-hidden')).toBe('true');
    const marked = grip().closest('[data-sheet-grip]') as HTMLElement;
    expect(marked).not.toBeNull();
    expect(marked.style.touchAction).toBe('none');
  });

  it('follows the pointer down from the grip, and closes on a quick flick, as its Close does', async () => {
    const onClose = vi.fn();
    render(<Owned onClose={onClose} />);
    await cameUp();
    pointer('pointerdown', grip(), 100, 1000);
    pointer('pointermove', grip(), 110, 1010);
    // No jump as the drag is taken: it moves from where it stood, then with the pointer.
    expect(pullStyle().transform).toBe('translateY(0px)');
    pointer('pointermove', grip(), 160, 1030);
    expect(pullStyle().transform).toBe('translateY(50px)');
    pointer('pointerup', grip(), 200, 1050);
    await wait(300);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Details')).toBeNull();
  });

  it('springs back when let go slowly short of closing, and asks nothing', async () => {
    const onClose = vi.fn();
    render(<Owned onClose={onClose} />);
    await cameUp();
    dragOn(grip(), 100, 160, 900);
    expect(rea.assigned.at(-1)).toMatchObject({ kind: 'spring', to: 0 });
    await wait(1000);
    expect(onClose).not.toHaveBeenCalled();
    expect(pullStyle().transform).toBe('translateY(0px)');
  });

  it('comes back when its owner does not close it', async () => {
    const onClose = vi.fn();
    render(<Owned refuse onClose={onClose} />);
    await cameUp();
    dragOn(grip(), 100, 300, 60);
    await wait(300);
    expect(onClose).toHaveBeenCalledTimes(1);
    await wait(400);
    expect(screen.getByText('Details')).toBeTruthy();
    expect(pullStyle().transform).toBe('translateY(0px)');
  });

  it('is dragged down from its body at the top of its scroll, but not up from it, nor down once it is scrolled', async () => {
    const onClose = vi.fn();
    render(<Owned refuse onClose={onClose} />);
    await cameUp();
    // What was played before the drags: the sheet's rise.
    rea.assigned.length = 0;
    // Up from the body is its scroll's.
    dragOn(body(), 300, 150, 60);
    expect(rea.assigned).toEqual([]);
    expect(pullStyle().transform).toBe('translateY(0px)');
    // Scrolled, down is its scroll's too.
    const scroller = body().closest('[data-sheet-scroll]') as HTMLElement;
    scroller.scrollTop = 40;
    dragOn(body(), 100, 300, 60);
    expect(rea.assigned).toEqual([]);
    // At its top, down is the sheet's.
    scroller.scrollTop = 0;
    dragOn(body(), 100, 300, 60);
    await wait(300);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('leaves a press that does not move a click, and eats the click a drag ends on', async () => {
    render(<Owned refuse />);
    await cameUp();
    pointer('pointerdown', body(), 100, 1000);
    pointer('pointermove', body(), 104, 1010);
    pointer('pointerup', body(), 104, 1020);
    fireEvent.click(body());
    expect(body().textContent).toBe('pressed 1');
    dragOn(body(), 100, 160, 900);
    fireEvent.click(body());
    expect(body().textContent).toBe('pressed 1');
    // The next press is a click again.
    await wait(1);
    fireEvent.click(body());
    expect(body().textContent).toBe('pressed 2');
  });

  it('is not dragged sideways: that is a slider\'s, or a strip of tabs\'', async () => {
    render(<Owned />);
    await cameUp();
    pointer('pointerdown', grip(), 100, 1000, 100);
    pointer('pointermove', grip(), 104, 1010, 160);
    pointer('pointermove', grip(), 200, 1020, 160);
    expect(pullStyle().transform).toBe('translateY(0px)');
    pointer('pointerup', grip(), 200, 1030, 160);
  });

  it('loses no press: one let go outside the panel ends there, and a pointer passing over it with no button down drags nothing', async () => {
    const onClose = vi.fn();
    render(<Owned onClose={onClose} />);
    await cameUp();
    const backdrop = screen.getByTestId('sheet-backdrop');
    // A mouse pressed on the grabber, led off the panel at once, let go over the dimmed page.
    pointer('pointerdown', grip(), 100, 1000, 100, 'mouse');
    pointer('pointermove', backdrop, 96, 1010, 160, 'mouse');
    pointer('pointerup', backdrop, 96, 1020, 160, 'mouse');
    // The mouse passes over the panel, no button down: nothing follows it.
    pointer('pointermove', grip(), 300, 1100, 100, 'mouse', 0);
    expect(pullStyle().transform).toBe('translateY(0px)');
    // A press whose release was never seen is dropped by the next move with no button down.
    pointer('pointerdown', grip(), 100, 2000, 100, 'mouse');
    pointer('pointermove', grip(), 300, 2010, 100, 'mouse', 0);
    expect(pullStyle().transform).toBe('translateY(0px)');
    // And the next press is a drag again.
    dragOn(grip(), 100, 300, 60, 'mouse');
    await wait(300);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('is never dragged from a control that drags itself: an amount\'s slider, or what the kit marks `data-sheet-nodrag`', async () => {
    // The game's own pieces settle on the page's clock.
    vi.useRealTimers();
    const settle = (ms: number) => act(() => new Promise((done) => setTimeout(done, ms)));
    const onClose = vi.fn();
    renderGame(<AmountSheet title="Save" max={100_000} start={10_000} onClose={onClose} onConfirm={() => true} />, memoryServices());
    await settle(100);
    const slider = await screen.findByRole('slider');
    expect(slider.getAttribute('data-sheet-nodrag')).toBe('true');
    dragOn(slider, 100, 400, 60);
    await settle(300);
    expect(onClose).not.toHaveBeenCalled();
    expect(pullStyle().transform).toBe('translateY(0px)');
    cleanup();
    render(
      <Sheet open onClose={onClose} title="Details" closeLabel="Close">
        <View testID="own-drag" {...{ dataSet: { sheetNodrag: true } }} />
      </Sheet>,
    );
    await settle(100);
    dragOn(screen.getByTestId('own-drag'), 100, 400, 60);
    await settle(300);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('claims a finger\'s clear move down from the top of its body, before the browser can take it for a scroll; up is the scroll\'s', async () => {
    render(<Owned />);
    await cameUp();
    // A hair down is not yet a pull: nothing is kept from the browser.
    pointer('pointerdown', body(), 100, 1000);
    expect(touchMove(body(), 102).defaultPrevented).toBe(false);
    expect(touchMove(body(), 105, 101).defaultPrevented).toBe(true);
    pointer('pointerup', body(), 105, 1010);
    // Up: the scroll's, and the press is let go.
    pointer('pointerdown', body(), 100, 2000);
    expect(touchMove(body(), 95).defaultPrevented).toBe(false);
    pointer('pointermove', body(), 160, 2010);
    expect(pullStyle().transform).toBe('translateY(0px)');
    pointer('pointerup', body(), 160, 2020);
    // Scrolled, a finger going down is the scroll's.
    (body().closest('[data-sheet-scroll]') as HTMLElement).scrollTop = 30;
    pointer('pointerdown', body(), 100, 3000);
    expect(touchMove(body(), 110).defaultPrevented).toBe(false);
  });

  it('never keeps a sideways swipe from the browser (a strip of tabs in the sheet), even one that starts with a hair down', async () => {
    render(<Owned />);
    await cameUp();
    pointer('pointerdown', body(), 100, 1000, 100);
    expect(touchMove(body(), 102, 103).defaultPrevented).toBe(false);
    expect(touchMove(body(), 104, 130).defaultPrevented).toBe(false);
    expect(touchMove(body(), 106, 160).defaultPrevented).toBe(false);
    pointer('pointermove', body(), 106, 1010, 160);
    expect(pullStyle().transform).toBe('translateY(0px)');
    // Down, but as much sideways: not clearly a pull.
    pointer('pointerup', body(), 106, 1020, 160);
    pointer('pointerdown', body(), 100, 2000, 100);
    expect(touchMove(body(), 106, 105).defaultPrevented).toBe(false);
  });

  it('listens to a finger on the panel from the sheet\'s opening (as a phone\'s browser must know before the touch), and does nothing unless a press may become a pull', async () => {
    const adding = vi.spyOn(window, 'addEventListener');
    render(<Owned />);
    await cameUp();
    pointer('pointerdown', body(), 100, 1000);
    // Nothing is added on the window for it: the panel's own listener, there since the sheet opened, answers.
    expect(adding.mock.calls.filter(([type]) => type === 'touchmove')).toEqual([]);
    pointer('pointerup', body(), 100, 1010);
    adding.mockRestore();
    // With no press, a finger's move on the panel is the browser's.
    expect(touchMove(body(), 150).defaultPrevented).toBe(false);
    expect(touchMove(grip(), 150).defaultPrevented).toBe(false);
  });

  it('lets a new press replace one whose release never came: a finger lifted where the page was not told blocks nothing', async () => {
    const onClose = vi.fn();
    render(<Owned onClose={onClose} />);
    await cameUp();
    pointer('pointerdown', body(), 100, 1000, 100, 'touch', 1, 1);
    // Its release is never seen; the next finger is another pointer.
    pointer('pointerdown', grip(), 100, 2000, 100, 'touch', 1, 2);
    for (let i = 1; i <= 6; i++) pointer('pointermove', grip(), 100 + i * 40, 2000 + i * 10, 100, 'touch', 1, 2);
    pointer('pointerup', grip(), 340, 2060, 100, 'touch', 0, 2);
    await wait(300);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on a flick only once it has gone FLICK_TRAVEL: a quick twitch past the slop goes back', async () => {
    const onClose = vi.fn();
    render(<Owned onClose={onClose} />);
    await cameUp();
    dragOn(grip(), 100, 120, 10, 'mouse');
    await wait(400);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('is pulled from its body by a finger or a pen, never by a mouse (which selects the text there); a mouse pulls its grip', async () => {
    const onClose = vi.fn();
    render(<Owned onClose={onClose} />);
    await cameUp();
    dragOn(body(), 100, 400, 60, 'mouse');
    await wait(300);
    expect(onClose).not.toHaveBeenCalled();
    dragOn(body(), 100, 400, 60, 'pen');
    await wait(300);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('is not dragged in the middle of a desk\'s screen, where it is a dialog: no grabber there', async () => {
    restore?.();
    restore = browserAt(1280);
    render(<Owned />);
    await cameUp();
    expect(screen.queryByTestId('sheet-grabber')).toBeNull();
    dragOn(grip(), 100, 400, 60);
    expect(pullStyle().transform).toBe('translateY(0px)');
  });
});

describe('the speed a drag is let go at', () => {
  it('is read over its last moves, and is nothing if it stood still before it was lifted', () => {
    const trail = [
      { t: 1000, y: 20 },
      { t: 1050, y: 70 },
      { t: 1100, y: 120 },
    ];
    expect(speedOf(trail, 1120)).toBe(1000);
    expect(speedOf(trail, 1201)).toBe(0);
    expect(speedOf([{ t: 1000, y: 20 }], 1010)).toBe(0);
    expect(speedOf([], 1010)).toBe(0);
    expect(speedOf([{ t: 1000, y: 120 }, { t: 1100, y: 20 }], 1110)).toBe(-1000);
  });
});
