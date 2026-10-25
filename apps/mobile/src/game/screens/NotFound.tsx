import { Unmatched } from 'expo-router';

/*
 * The page of nothing: an address the game has no page at (`app/+not-found.tsx`), or a page in a language it does not have (`InLanguage.tsx`). On
 * the web the game's own, in the address's language (`NotFound.web.tsx`, the Next web's 404). On the phone the router's own, as it always was.
 */
export function NotFound() {
  return <Unmatched />;
}
