import { NotFound } from '../game/screens/NotFound';

/**
 * An address the game has no page at (`/es/nowhere`). On the web the game's page of nothing, in the address's language, which the export writes as
 * the site's `404.html` (`scripts/sitePieces.ts`): the Next web's 404. On the phone the router's own page, as before the game had a route of its own
 * here: the phone opens no address the game has no page at (its links are made pages by `+native-intent.tsx`).
 */
export default function NotFoundRoute() {
  return <NotFound />;
}
