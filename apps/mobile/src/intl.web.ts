/**
 * The web's twin of intl.ts. A browser has its own Intl, complete in every language the game speaks, so nothing is polyfilled: no formatjs
 * (the phone's file is what makes it weigh megabytes), and the same exports as the phone's file.
 */

/** Nothing to do: a browser reads days in its computer's own time zone, and `zone` is the phone's to give. */
export function readDaysIn(timeZone: string | null | undefined): void {
  void timeZone;
}
