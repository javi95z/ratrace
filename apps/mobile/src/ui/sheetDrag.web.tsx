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

/** The grip: the grabber and the title row. A finger on it never scrolls the page (`touch-action: none`), so its pointer events are the drag's. */
export function SheetGrip({ children }: { drag: SheetPull; enabled: boolean; children: ReactNode }) {
  return <View {...{ dataSet: { sheetGrip: true } }} style={{ touchAction: 'none' } as object}>{children}</View>;
}

/** The sheet's body, which scrolls: marked for the panel's listener, which reads how far it is scrolled. */
export function SheetScroll({ drag, enabled, children, ...props }: ScrollViewProps & { drag: SheetPull; enabled: boolean; children: ReactNode }) {
  void drag;
  void enabled;
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

/** A field's own presses (a caret placed, a word chosen) are never a drag of the sheet. */
const FIELD = 'input, textarea, select, [contenteditable="true"]';

/** Follows the presses on a sheet's panel, and makes the ones that become drags down (or a grip's, up) the sheet's pull. Returns what stops it. */
export function followDrags(box: HTMLElement, pull: () => SheetPull): () => void {
  type Press = { id: number; x: number; y: number; grip: boolean; dragging: boolean; trail: Array<{ t: number; y: number }> };
  let press: Press | null = null;
  let eatClick = false;
  let selecting = '';

  const down = (event: PointerEvent) => {
    if (press || !event.isPrimary || event.button !== 0) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest(FIELD)) return;
    const grip = target.closest('[data-sheet-grip]') !== null;
    if (!grip) {
      const scroll = target.closest('[data-sheet-scroll]');
      if (scroll && scroll.scrollTop > 0) return;
    }
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, grip, dragging: false, trail: [] };
  };
  const move = (event: PointerEvent) => {
    if (!press || event.pointerId !== press.id) return;
    const dx = event.clientX - press.x;
    const dy = event.clientY - press.y;
    if (!press.dragging) {
      if (Math.abs(dx) < GRAB && Math.abs(dy) < GRAB) return;
      // Sideways is a slider's or a strip of tabs'; up from the body is its scroll.
      if (Math.abs(dx) >= Math.abs(dy) || (!press.grip && dy < 0)) {
        press = null;
        return;
      }
      press.dragging = true;
      try {
        box.setPointerCapture(event.pointerId);
      } catch {
        // A pointer the browser has already let go of: its moves still come to the panel while they are over it.
      }
      selecting = box.style.userSelect;
      box.style.userSelect = 'none';
      window.getSelection()?.removeAllRanges();
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
    press = null;
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
  // A finger dragging the sheet does not scroll the page under it, nor the body (which is at its top): its moves are the drag's.
  const touchMove = (event: TouchEvent) => {
    if (press?.dragging && event.cancelable) event.preventDefault();
  };
  const click = (event: MouseEvent) => {
    if (!eatClick) return;
    eatClick = false;
    event.preventDefault();
    event.stopPropagation();
  };

  box.addEventListener('pointerdown', down);
  box.addEventListener('pointermove', move);
  box.addEventListener('pointerup', up);
  box.addEventListener('pointercancel', cancel);
  box.addEventListener('touchmove', touchMove, { passive: false });
  box.addEventListener('click', click, true);
  return () => {
    box.removeEventListener('pointerdown', down);
    box.removeEventListener('pointermove', move);
    box.removeEventListener('pointerup', up);
    box.removeEventListener('pointercancel', cancel);
    box.removeEventListener('touchmove', touchMove);
    box.removeEventListener('click', click, true);
  };
}
