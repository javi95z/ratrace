import type { Page } from './pageList';

/** A shortcut: the page it opens, and what it is called (the phone's, `shortcuts.ts`). */
export interface Shortcut {
  page: Page;
  title: string;
}

/** Nothing on the web: a page has no icon to hold shortcuts on (an installed site's are its manifest's). */
export function setShortcuts(): void {}

/** Nothing on the web: no shortcut is ever pressed. */
export const shortcutTaps = {
  onTap(): () => void {
    return () => undefined;
  },
};
