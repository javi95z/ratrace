/*
 * What the front door holds on the phone, beside the web's (`frontDoor.web.ts`): a phone app's front door keeps to what is played, and its language
 * and its small print are in its settings, where a phone's own apps keep them. (The language is the phone's to start with: `deviceLanguages`.)
 */

/** Whether the language's square stands in the front door's corner, beside the settings' gear. */
export const LANGUAGE_IN_CORNER = false;
/** Whether the way to the privacy and legal notice is in the settings, at their foot, rather than at the front door's. */
export const LEGAL_IN_SETTINGS = true;
