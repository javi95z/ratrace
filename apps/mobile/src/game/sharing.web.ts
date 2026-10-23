import { copy } from '../ui/copy.web';
import type { PictureShare } from './sharing';

/*
 * The web export's twin of `sharing.ts` (Metro picks it for the web). A browser needs no file on a device: the picture is a file in memory
 * (`new File`), handed to the browser's share sheet where it takes files (`navigator.share({ files, title, text })`, after `navigator.canShare`), and saved
 * by a link to an object address of it, as the Next web does. A link to a game goes to the share sheet, else to the clipboard.
 */

/** Whether a share sheet turned down by the player (it rejects with an `AbortError`) is what ended a share: that is not a failure. */
const turnedDown = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';

/** Whether the browser has a share sheet that takes this file. */
export function canShareFile(file: File): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
}

/** Hands the file to the browser's share sheet, with `title` and the `text` that goes with it. True once shared; false where the player turned the sheet down; any other failure throws. */
export async function shareFile(file: File, title: string, text: string): Promise<boolean> {
  try {
    await navigator.share({ files: [file], title, text });
    return true;
  } catch (error) {
    if (turnedDown(error)) return false;
    throw error;
  }
}

export type { PictureShare };

/** A PNG's bytes as a file in memory. */
const fileOf = (png: Uint8Array, fileName: string) => new File([png as BlobPart], fileName, { type: 'image/png' });

const browserShare: PictureShare = {
  available: () => Promise.resolve(typeof navigator !== 'undefined' && typeof navigator.share === 'function'),
  async send(png, fileName, title, invite) {
    const file = fileOf(png, fileName);
    return canShareFile(file) ? shareFile(file, title, invite) : false;
  },
  async save(png, fileName) {
    // A link to the picture's object, clicked the way the player would click the page's own, then let go of.
    const url = URL.createObjectURL(fileOf(png, fileName));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return 'saved';
  },
};

/** The browser's share sheet, for a picture. */
export const usePictureShare = (): PictureShare => browserShare;

/**
 * The browser's share sheet, for a link and the words that go with it (an invitation to a game): `navigator.share({ title, text, url })`. Where the browser
 * has none, the link goes to the clipboard instead (the Next web's Copy link), and true says it is there. False where the player turned the sheet down, or the
 * clipboard would not take it; a sheet that could not open throws.
 */
export async function shareLink(title: string, text: string, url: string): Promise<boolean> {
  if (typeof navigator.share !== 'function') return copy(url, () => {});
  try {
    await navigator.share({ title, text, url });
    return true;
  } catch (error) {
    if (turnedDown(error)) return false;
    throw error;
  }
}
