import { File, Paths } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';

/*
 * How a picture leaves the phone: its share sheet, handed the picture as a file. The web hands its browser's share sheet a file it makes in memory
 * (`navigator.share`); the phone's needs one on the device, so the picture is written to the app's cache first, where the system may clear it.
 * A screen reaches this through the game's context (`usePictureShare`), never the device itself.
 */

/** The phone's share sheet, for a picture. */
export interface PictureShare {
  /** Whether the phone has a share sheet to hand a file to. */
  available(): Promise<boolean>;
  /** Writes the picture (a PNG) to the cache as `fileName`, in place of one of that name, and hands it to the share sheet: `title` heads the sheet where the phone shows one (Android). */
  send(png: Uint8Array, fileName: string, title: string): Promise<void>;
}

const phoneShare: PictureShare = {
  available: () => isAvailableAsync(),
  async send(png, fileName, title) {
    const file = new File(Paths.cache, fileName);
    file.create({ overwrite: true });
    await file.write(png);
    await shareAsync(file.uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: title });
  },
};

/** The phone's share sheet. */
export const usePictureShare = (): PictureShare => phoneShare;
