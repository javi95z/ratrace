/*
 * The web export's twin of `copy.ts` (Metro picks it for the web): the browser's own clipboard, as the Next web's screens use it
 * (`navigator.clipboard.writeText`), where the phone's is expo-clipboard's.
 */

/**
 * Puts a text on the browser's clipboard (a friend's code, a room's link) and, once it is there, tells the player so: `tell` shows the toast with the
 * screen's "copied". Where the browser keeps the clipboard to itself (a refusal, or none at all on an address that is not secure) nothing is told:
 * the text is on screen to be copied by hand. True where it was copied.
 */
export async function copy(text: string, tell: () => void): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    return false;
  }
  tell();
  return true;
}
