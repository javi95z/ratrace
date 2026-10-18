'use client';

import { useEffect } from 'react';

/**
 * An installed iPhone page can be left shifted when the status bar changes under it (a call, a
 * recording, a hotspot, the island's media pill): the page sits a little off the screen, the bar at
 * the foot floats mid-page and the cover of the status bar is not at the top. The browser puts it
 * right on the next scroll, so on every change of the visible area the page is scrolled by nothing
 * and the layout is measured again.
 */
export function ViewportSync() {
  useEffect(() => {
    const view = window.visualViewport;
    let frame = 0;
    const settle = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // Only when the page is out of place: the visible area is not where the layout puts it.
        if (view && Math.abs(view.offsetTop) < 1 && Math.abs(view.offsetLeft) < 1) return;
        window.scrollTo?.({ top: window.scrollY, left: 0 });
        document.documentElement.style.setProperty('--viewport-nudge', String(Date.now() % 2));
      });
    };
    const listened: Array<[EventTarget, string]> = [
      [window, 'orientationchange'],
      [window, 'pageshow'],
      [document, 'visibilitychange'],
    ];
    if (view) listened.push([view, 'resize'], [view, 'scroll']);
    for (const [target, type] of listened) target.addEventListener(type, settle);
    return () => {
      cancelAnimationFrame(frame);
      for (const [target, type] of listened) target.removeEventListener(type, settle);
    };
  }, []);
  return null;
}
