import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { ScrollView, View, type ScrollViewProps } from 'react-native';
import { GRAB } from './sheetPull';
import type { SheetPull } from './useSheetPull';

/*
 * The web export's twin of `sheetDrag.tsx` (Metro picks it for the web): a sheet dragged down with the page's own pointer events, a mouse's, a pen's
 * or a finger's, so that the first page loads none of the gesture handler (`GestureRoot.web.tsx`). The panel listens (`useDragSurface`); the grip and
 * the body are only marked, for it to tell them apart (`data-sheet-grip`, `data-sheet-scroll`). The grip drags the sheet whichever way the pointer
 * goes; the body only while it is scrolled to its top and the pointer goes down, so a long sheet still scrolls. A press moves nothing, so a button
 * still gets its click; a drag that began on one, let go, gives it none.
 */

/** How far back the speed of a pointer let go is read, in milliseconds: a drag that stopped before it was lifted was let go still. */
const SPEED_MS = 100;
/** A finger on the body is claimed for a pull once it has gone this far down, and clearly down (`CLAIM_SLANT` times its sideways). */
const CLAIM = 4;
const CLAIM_SLANT = 1.5;

/** The grip: the grabber and the title row. A finger on it never scrolls the page (`touch-action: none`), so its pointer events are the drag's. */
export function SheetGrip({ children }: { drag: SheetPull; enabled: boolean; children: ReactNode }) {
  return <View {...{ dataSet: { sheetGrip: true } }} style={{ touchAction: 'none' } as object}>{children}</View>;
}

/** The sheet's body, which scrolls: marked for the panel's listener, which reads how far it is scrolled. */
export function SheetScroll({ drag, enabled, atHalf, children, ...props }: ScrollViewProps & { drag: SheetPull; enabled: boolean; atHalf?: boolean; children: ReactNode }) {
  void drag;
  void enabled;
  // The web's sheets have one height (`useSheetPull`'s `half` is the phone's).
  void atHalf;
  return (
    <ScrollView {...props} {...{ dataSet: { sheetScroll: true } }}>
      {children}
    </ScrollView>
  );
}

/** The panel listens to the pointers on it while dragging is `enabled`, telling the sheet's pull what they do. */
export function useDragSurface(panel: RefObject<unknown>, drag: SheetPull, enabled: boolean): void {
  const latest = useRef(drag);
  useEffect(() => {
    latest.current = drag;
  });
  useEffect(() => {
    const box = panel.current;
    if (!enabled || !(box instanceof HTMLElement)) return;
    return followDrags(box, () => latest.current);
  }, [panel, enabled]);
}

/**
 * How fast a drag was going as it was let go at `now`, in points a second (down positive): over its last moves (`trail`, the last `SPEED_MS` of
 * them), and nothing if it stood still longer than that before it was lifted.
 */
export function speedOf(trail: ReadonlyArray<{ t: number; y: number }>, now: number): number {
  const first = trail[0];
  const last = trail[trail.length - 1];
  if (!first || !last || last.t <= first.t || now - last.t > SPEED_MS) return 0;
  return ((last.y - first.y) / (last.t - first.t)) * 1000;
}

/**
 * What a press is never a drag of the sheet from: a field (a caret placed, a word chosen), and a control that drags itself, a slider (its role) or
 * whatever the kit marks so (`data-sheet-nodrag`).
 */
const NO_DRAG = 'input, textarea, select, [contenteditable="true"], [role="slider"], [data-sheet-nodrag]';

/**
 * Follows the presses on a sheet's panel, and makes the ones that become drags down (or a grip's, up) the sheet's pull. Returns what stops it.
 *
 * A press is followed on the whole window from the moment it lands until it is let go, so that a pointer led off the panel (a mouse has no hold on
 * what it pressed) is never lost, and a move with no button down ends it. The body is pulled by a finger or a pen, never a mouse, whose drag there
 * selects text. A finger on the body at its top is claimed once it goes clearly down (`CLAIM`, `touchmove` kept from scrolling), before a phone's
 * browser takes it for a scroll of its own; one that goes up or sideways (a strip of tabs in the sheet) is the browser's, and the press is let go.
 * That listener is the panel's from the sheet's opening, so that a phone's browser knows of it before a touch lands (Chrome asks only the listeners
 * there then whether it may scroll), and it does nothing unless a press may become a pull. A new press replaces one whose release never came.
 */
export function followDrags(box: HTMLElement, pull: () => SheetPull): () => void {
  type Press = { id: number; x: number; y: number; grip: boolean; dragging: boolean; claimed: boolean; trail: Array<{ t: number; y: number }> };
  const view = box.ownerDocument.defaultView ?? window;
  let press: Press | null = null;
  let eatClick = false;
  let selecting = '';

  const down = (event: PointerEvent) => {
    if (!event.isPrimary || event.button !== 0) return;
    if (press) {
      if (event.pointerId === press.id) return;
      // A primary pointer again: the last one was let go where nothing told the page.
      if (press.dragging) pull().cancel();
      letGo();
    }
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest(NO_DRAG)) return;
    const grip = target.closest('[data-sheet-grip]') !== null;
    if (!grip) {
      if (event.pointerType === 'mouse') return;
      const scroll = target.closest('[data-sheet-scroll]');
      if (scroll && scroll.scrollTop > 0) return;
    }
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, grip, dragging: false, claimed: false, trail: [] };
    listen();
  };
  const move = (event: PointerEvent) => {
    if (!press || event.pointerId !== press.id) return;
    // No button down: its release was never seen (let go where nothing told the page).
    if (event.buttons === 0) return finish(event, false);
    const dx = event.clientX - press.x;
    const dy = event.clientY - press.y;
    if (!press.dragging) {
      if (Math.abs(dx) < GRAB && Math.abs(dy) < GRAB) return;
      // Sideways is a slider's or a strip of tabs'; up from the body is its scroll.
      if (Math.abs(dx) >= Math.abs(dy) || (!press.grip && dy < 0)) return letGo();
      press.dragging = true;
      try {
        box.setPointerCapture(event.pointerId);
      } catch {
        // A pointer the browser has already let go of: its moves still come to the window.
      }
      selecting = box.style.userSelect;
      box.style.userSelect = 'none';
      view.getSelection()?.removeAllRanges();
      pull().begin(dy);
    }
    const now = event.timeStamp;
    press.trail.push({ t: now, y: dy });
    while (press.trail.length > 2 && now - press.trail[0].t > SPEED_MS) press.trail.shift();
    pull().move(dy);
  };
  const finish = (event: PointerEvent, lifted: boolean) => {
    if (!press || event.pointerId !== press.id) return;
    const was = press;
    letGo();
    if (!was.dragging) return;
    box.style.userSelect = selecting;
    if (box.hasPointerCapture?.(event.pointerId)) box.releasePointerCapture(event.pointerId);
    if (!lifted) return pull().cancel();
    const dy = event.clientY - was.y;
    pull().end(dy, speedOf(was.trail, event.timeStamp));
    // The click a drag let go over a button would give it is the drag's.
    eatClick = true;
    setTimeout(() => void (eatClick = false), 0);
  };
  const up = (event: PointerEvent) => finish(event, true);
  const cancel = (event: PointerEvent) => finish(event, false);
  // A finger's moves while it may become a drag: dragging, none scrolls the page or the body; on the body at its top, the first going down is claimed
  // for the sheet, the first going up (or sideways) left to the scroll.
  const touchMove = (event: TouchEvent) => {
    if (!press) return;
    if (!press.dragging && !press.grip && !press.claimed) {
      // A second finger (a pinch) is never a pull.
      if (event.touches.length !== 1) return letGo();
      const touch = event.touches[0];
      const dx = Math.abs(touch.clientX - press.x);
      const dy = touch.clientY - press.y;
      // Up, or as much sideways as down: the browser's, for good. A hair either way: not yet anyone's.
      if (dy <= -CLAIM || (dx >= CLAIM && dy <= CLAIM_SLANT * dx)) return letGo();
      if (dy < CLAIM || dy <= CLAIM_SLANT * dx) return;
      press.claimed = true;
    }
    if (event.cancelable) event.preventDefault();
  };
  const click = (event: MouseEvent) => {
    if (!eatClick) return;
    eatClick = false;
    event.preventDefault();
    event.stopPropagation();
  };

  function listen() {
    view.addEventListener('pointermove', move);
    view.addEventListener('pointerup', up);
    view.addEventListener('pointercancel', cancel);
  }
  /** The press is over (let go, taken by the browser, or left to the scroll): nothing more is listened to until the next. */
  function letGo() {
    press = null;
    view.removeEventListener('pointermove', move);
    view.removeEventListener('pointerup', up);
    view.removeEventListener('pointercancel', cancel);
  }

  box.addEventListener('pointerdown', down);
  box.addEventListener('touchmove', touchMove, { passive: false });
  box.addEventListener('click', click, true);
  return () => {
    letGo();
    box.removeEventListener('pointerdown', down);
    box.removeEventListener('touchmove', touchMove);
    box.removeEventListener('click', click, true);
  };
}
