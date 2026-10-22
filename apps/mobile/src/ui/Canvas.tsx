import { Canvas as SkiaCanvas, type CanvasProps, type CanvasRef } from '@shopify/react-native-skia';
import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { scheduleOnUI } from 'react-native-worklets';

/** What is used of Skia's views: asking one, by its id, to draw again. */
interface ViewApi {
  requestRedraw(id: number): void;
}
const viewApi = (): ViewApi | undefined => (globalThis as { SkiaViewApi?: ViewApi }).SkiaViewApi;

/**
 * On the UI thread: asks each canvas to draw again. What a worklet is given is copied to the UI runtime: should Skia's views ever come through
 * without their way to ask (a copy that loses a host object's methods), nothing is asked, rather than an error thrown on the UI thread, which a
 * release build would not survive.
 */
function drawAgain(api: ViewApi | undefined, ids: number[]): void {
  'worklet';
  if (api?.requestRedraw === undefined) return;
  for (const id of ids) api.requestRedraw(id);
  // And once more on the next frame: an ask the canvas let go because a drawing was under way at that moment (one started by another of Skia's own
  // asks, or a frame of the picture before it) is made again after that drawing, so the last picture handed is the last one drawn.
  requestAnimationFrame(() => {
    for (const id of ids) api.requestRedraw(id);
  });
}

/** The canvases handed a drawing since the last ask: asked together, once the drawings handed to them are in. */
const handed = new Set<RefObject<CanvasRef | null>>();
let asking: ReturnType<typeof setTimeout> | null = null;

function askAgain(canvas: RefObject<CanvasRef | null>): void {
  const api = viewApi();
  if (api === undefined) return;
  handed.add(canvas);
  // A timer: Skia hands the drawing over twice, in its commit and a microtask after it (below), so this runs after both.
  asking ??= setTimeout(() => {
    asking = null;
    const ids = [...handed].flatMap((one) => (one.current ? [one.current.getNativeId()] : []));
    handed.clear();
    if (ids.length > 0) scheduleOnUI(drawAgain, api, ids);
  }, 0);
}

/**
 * Drawn last inside the canvas, by Skia: told each time Skia commits the canvas's drawing. Skia hands that drawing to the view twice, each time
 * asking the view from the JS thread to draw it: in its commit (`resetAfterCommit`, before this is told), and again a microtask later, once the
 * update its `render` awaits has resolved.
 */
function Handed({ canvas }: { canvas: RefObject<CanvasRef | null> }): null {
  useLayoutEffect(() => askAgain(canvas));
  return null;
}

/**
 * Every canvas the app draws on: Skia's, asked once more to draw each drawing it is handed, from the UI thread.
 *
 * On iOS, react-native-skia (2.14) hands a canvas its drawing from the JS thread, twice a commit (in the commit, and a microtask
 * after it), and asks it there to draw, while the canvas draws on the main thread; asked while it is still drawing, the canvas
 * lets the request go (`RNSkView::requestRedraw` keeps one flag for "asked", and clears it once the drawing under way is done).
 * That drawing was the one before, so the new one is never drawn: an icon left blank or a picture left as it was, until something
 * else redraws the canvas. Seen on a busy phone as a screen opens: its canvases are handed their pictures while they draw for the
 * first time. The UI thread is the main thread: asked from there, after both hand-overs, the canvas is asked once any drawing
 * under way is over, and it draws its last drawing.
 */
export function Canvas({ children, ...props }: Omit<CanvasProps, 'ref'>): ReactNode {
  const canvas = useRef<CanvasRef>(null);
  return (
    <SkiaCanvas ref={canvas} {...props}>
      {children}
      <Handed canvas={canvas} />
    </SkiaCanvas>
  );
}
