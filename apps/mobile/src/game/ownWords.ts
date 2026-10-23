import type { Translate } from '@ratrace/core/game/present';
import { useT } from './words';

/**
 * The app's own words, where the web's tell a phone player something false or impossible ("reload the page", "this browser"): on the phone, the
 * messages' `phone.*` (a newer version: update the app; this phone is not saving). The web's twin (`ownWords.web.ts`) says the Next web's.
 */
export const useOwnT = (): Translate => useT('phone');

/** The section of the legal notice's words: on the phone, the phone's own notice (`phone.legal`). */
export const LEGAL_SECTION = 'phone.legal';
