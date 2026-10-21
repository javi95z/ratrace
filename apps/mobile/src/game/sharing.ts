import { Directory, File, Paths } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { Platform, Share } from 'react-native';

/*
 * How a picture leaves the phone: its share sheet, handed the picture as a file. The web hands its browser's share sheet a file it makes in memory,
 * with the words that bring someone into the game (`navigator.share({ files, text })`); the phone's needs the file on the device, so the picture is
 * written to a folder of the app's cache first (`share/`, emptied each time: one picture is kept, never a pile of them), where the system may clear it.
 * A screen reaches this through the game's context (`usePictureShare`), never the device itself.
 */

/** The phone's share sheet, for a picture. */
export interface PictureShare {
  /** Whether the phone has a share sheet to hand a file to. */
  available(): Promise<boolean>;
  /**
   * Writes the picture (a PNG) to the cache as `fileName` and hands it to the share sheet, with `invite` where the platform's sheet takes words beside
   * a file; `title` heads the sheet where the phone shows one (Android). True once the player has shared it, as far as the phone says.
   */
  send(png: Uint8Array, fileName: string, title: string, invite: string): Promise<boolean>;
}

const phoneShare: PictureShare = {
  available: () => isAvailableAsync(),
  async send(png, fileName, title, invite) {
    const folder = new Directory(Paths.cache, 'share');
    if (folder.exists) folder.delete();
    folder.create({ intermediates: true });
    const file = new File(folder, fileName);
    file.create();
    await file.write(png);
    // iOS's share sheet takes a file and words together: React Native's own carries both (`url` a file's address, `message` the words).
    if (Platform.OS === 'ios') return (await Share.share({ url: file.uri, message: invite })).action === Share.sharedAction;
    // Android's takes one or the other: React Native's `Share` sends words only there, so the picture goes alone, as a file, by expo-sharing.
    await shareAsync(file.uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: title });
    return true;
  },
};

/** The phone's share sheet. */
export const usePictureShare = (): PictureShare => phoneShare;
