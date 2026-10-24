import { linkLocale } from '../game/context';
import { pageOfLink } from '../game/pages';

/**
 * The phone's own links (`theratrace://<page>`: a notice's, an invitation's, the app's bare address) made the page of the game they name, in the phone's
 * language (`/es/room?code=K7Q2XM`): the pages are under their language, as the web's, and a link of the app has none. Google's way back
 * (`theratrace://auth`) and the development routes go where they went. Run by the router for the link that opened the app and for each one after.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return pageOfLink(path, linkLocale());
  } catch {
    // A link that cannot be read goes where the router would have taken it.
    return path;
  }
}
