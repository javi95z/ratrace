import Constants from 'expo-constants';
import type * as QuickActionsModule from 'expo-quick-actions';
import { Platform } from 'react-native';
import { PAGES, type Page } from './pageList';

/*
 * The app's shortcuts, held on its icon at the phone's home screen (iOS's Home Screen Quick Actions, Android's app shortcuts): a few of the game's
 * pages, opened straight from the icon, in the words of the game's language. Set by the game as it stands (`setShortcuts`: a life to continue or
 * none, an account to rank or none), and taken as a notice's tap is (`shortcutTaps`, the shape of `Push.onTap`): the sheets closed, then the page
 * opened. A real build only: Expo Go has no such module, and nothing of it is loaded there (nor on the web: `shortcuts.web.ts`).
 */

/** A shortcut: the page it opens, and what it is called. */
export interface Shortcut {
  page: Page;
  title: string;
}

type QuickActions = typeof QuickActionsModule;

/** Each shortcut's icon: one of iOS's own symbols (its own shortcuts' look, beside the system's), and on Android the game's sprite (app.json). */
const ICONS: Partial<Record<Page, { ios: string; android: string }>> = {
  play: { ios: 'symbol:play.fill', android: 'shortcut_continue' },
  challenge: { ios: 'symbol:calendar', android: 'shortcut_challenge' },
  new: { ios: 'symbol:plus', android: 'shortcut_new' },
  rankings: { ios: 'symbol:trophy', android: 'shortcut_rankings' },
};

/** The library, loaded once and only where it is there: a build of the app's own on a phone. Null anywhere else, or should it fail to load. */
let library: Promise<QuickActions | null> | null = null;
const quickActions = (): Promise<QuickActions | null> =>
  (library ??=
    (Platform.OS === 'ios' || Platform.OS === 'android') && String(Constants.executionEnvironment) !== 'storeClient'
      ? import('expo-quick-actions').then(
          (loaded) => loaded,
          () => null,
        )
      : Promise.resolve(null));

/** The page an action opens, if it is one of the game's. */
const pageOf = (action: { params?: Record<string, unknown> | null } | null | undefined): Page | null => PAGES.find((page) => page === action?.params?.page) ?? null;

/** Sets the shortcuts on the icon, in their order (iOS shows four at most, the first nearest the icon). Nothing where there are none. */
export function setShortcuts(shortcuts: readonly Shortcut[]): void {
  void quickActions()
    .then((loaded) =>
      loaded?.setItems(
        shortcuts.map((shortcut) => ({
          id: shortcut.page,
          title: shortcut.title,
          icon: (Platform.OS === 'ios' ? ICONS[shortcut.page]?.ios : ICONS[shortcut.page]?.android) ?? null,
          params: { page: shortcut.page },
        })),
      ),
    )
    .catch(() => undefined);
}

/** Whether the shortcut that opened the app has been taken: once for the app, however often the game starts again over it. */
let openedWith = false;

/**
 * The shortcuts pressed, as a notice's taps are told (`Push.onTap`): the one that opened the app, once, and each pressed while it runs.
 */
export const shortcutTaps = {
  onTap(open: (to: { page: Page; query: Record<string, string> }) => void): () => void {
    let live = true;
    let listening: { remove(): void } | null = null;
    void quickActions().then((loaded) => {
      if (!loaded || !live) return;
      const first = openedWith ? null : pageOf(loaded.initial);
      openedWith = true;
      if (first) open({ page: first, query: {} });
      listening = loaded.addListener((action) => {
        const page = pageOf(action);
        if (page) open({ page, query: {} });
      });
    });
    return () => {
      live = false;
      listening?.remove();
    };
  },
};
