import type { Translate } from '@ratrace/core/game/present';
import { useTranslations } from 'use-intl';

/**
 * The web's twin of `ownWords.ts`. In a browser the Next web's words are the true ones (a newer version: reload the page; this browser is not
 * saving; another tab), so each of the phone's own words is said as the Next web says it, where the Next web says it. A word of the phone's that
 * the Next web has no counterpart of (the picture saved to the photos, a room of another version of the app) is the phone's still.
 */
const WEB: Readonly<Record<string, string>> = {
  lostNewer: 'home.lostNewer',
  lostWaiting: 'home.lostWaiting',
  movedGone: 'home.movedGone',
  notSaved: 'common.notSaved',
  moved: 'play.moved',
};

export function useOwnT(): Translate {
  const all = useTranslations() as unknown as Translate;
  return (key, values) => all(WEB[key] ?? `phone.${key}`, values);
}

/** The section of the legal notice's words: on the web, the Next web's notice (`legal`), section for section the phone's. */
export const LEGAL_SECTION = 'legal';
