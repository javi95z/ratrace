import { useEffect } from 'react';
import { Dimensions, Platform } from 'react-native';

/*
 * Which way the game can be held. A phone is held upright (app.json's `orientation`), as a phone's own games are; a tablet turns every way, its
 * wide screen laying a life out in three columns (ui/desk.ts). iOS is told so by app.json (the iPad's own `UISupportedInterfaceOrientations~ipad`);
 * Android has one setting for every screen, so a tablet is let turn as the game starts. (On the web, a page turns as the browser does: nothing.)
 */

/** The shortest side of a tablet, in points: Android's own line between phones and tablets (`sw600dp`). */
export const TABLET_SIDE = 600;

/** Whether this screen is a tablet's, by its shortest side. */
export const isTablet = (): boolean => {
  const { width, height } = Dimensions.get('screen');
  return Math.min(width, height) >= TABLET_SIDE;
};

/** Lets an Android tablet turn every way, once, as the game starts. Nothing on a phone, nor on iOS, which app.json already tells. */
export function useTabletTurns(): void {
  useEffect(() => {
    if (Platform.OS !== 'android' || !isTablet()) return;
    void import('expo-screen-orientation')
      .then((orientation) => orientation.unlockAsync())
      .catch(() => undefined);
  }, []);
}
