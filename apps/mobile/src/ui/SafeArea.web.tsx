import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { SafeAreaInsetsContext, SafeAreaProvider } from 'react-native-safe-area-context';

/**
 * The web's twin of `SafeArea.tsx`. expo-router's provider on the web gives every screen no safe areas at all (its `SafeAreaProvider` answers zero
 * insets, so that streamed pages hydrate unchanged), and a page that reaches under an iPhone's notch and home bar (`viewport-fit=cover`, app/+html.tsx,
 * as the Next web's) would draw under them. The screens are given what the browser gives the page (`env(safe-area-inset-*)`), and clear it as the
 * Next web's `pt-safe` and `pb-safe` do.
 *
 * They are read here, not by the library's provider: an installed iPhone page reads no safe areas for a moment as it opens or as the status bar
 * changes (a call, the island's pill), and the library takes them again only on a transition of its probe's padding, which WebKit does not always
 * run, or on a resize of the window, so the page was left under the status bar. A probe padded by them changes size with them, which a
 * ResizeObserver hears; the window's own changes are heard as well. The library's provider still gives the screens its frame.
 */
export function SafeArea({ children }: { children: ReactNode }): ReactNode {
  return (
    <SafeAreaProvider style={{ flex: 1 }}>
      <BrowserInsets>{children}</BrowserInsets>
    </SafeAreaProvider>
  );
}

type Insets = { top: number; bottom: number; left: number; right: number };

const NONE: Insets = { top: 0, bottom: 0, left: 0, right: 0 };

const px = (value: string): number => Number.parseFloat(value) || 0;

function BrowserInsets({ children }: { children: ReactNode }): ReactNode {
  // The page's HTML is drawn with none (no browser), as the router's provider gives it; the browser's own come once it has the page.
  const [insets, setInsets] = useState<Insets>(NONE);
  useEffect(() => {
    const probe = document.createElement('div');
    probe.dataset.safeAreaProbe = '';
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText =
      'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.appendChild(probe);
    const read = () => {
      const style = window.getComputedStyle(probe);
      const next = { top: px(style.paddingTop), bottom: px(style.paddingBottom), left: px(style.paddingLeft), right: px(style.paddingRight) };
      setInsets((now) => (now.top === next.top && now.bottom === next.bottom && now.left === next.left && now.right === next.right ? now : next));
    };
    read();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(read);
    observer?.observe(probe, { box: 'border-box' });
    const view = window.visualViewport;
    const heard: Array<[EventTarget, string]> = [
      [window, 'resize'],
      [window, 'orientationchange'],
      [window, 'pageshow'],
      [document, 'visibilitychange'],
    ];
    if (view) heard.push([view, 'resize']);
    for (const [target, type] of heard) target.addEventListener(type, read);
    return () => {
      observer?.disconnect();
      for (const [target, type] of heard) target.removeEventListener(type, read);
      probe.remove();
    };
  }, []);
  return <SafeAreaInsetsContext.Provider value={insets}>{children}</SafeAreaInsetsContext.Provider>;
}
