import { setStringAsync } from 'expo-clipboard';

/**
 * Puts a text on the phone's clipboard (a friend's code, a room's link) and, once it is there, tells the player so: `tell` shows the web's toast
 * (`Toast` with the screen's "copied": "Code copied", "Link copied."), as its screens do after `navigator.clipboard.writeText`. Where the
 * clipboard does not take it nothing is told, as on the web: the text is on screen to be copied by hand. True where it was copied.
 */
export async function copy(text: string, tell: () => void): Promise<boolean> {
  try {
    if (!(await setStringAsync(text))) return false;
  } catch {
    return false;
  }
  tell();
  return true;
}
