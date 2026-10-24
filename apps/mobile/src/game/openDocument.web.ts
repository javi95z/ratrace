/**
 * Opens `address` as a new document of the site, as a link the browser follows: `push` adds it to the history (Back comes to this page again),
 * `replace` puts it in place of this page. The page in front goes with its document, every screen of its stack, its sheets, its focus and its
 * `<html lang>`; the next is the export's own HTML of that address, in its language, taken over by the app anew. A file of its own, so that the
 * tests of what opens one can hear it (a test's browser goes nowhere).
 */
export function openDocument(address: string, how: 'push' | 'replace'): void {
  if (how === 'push') window.location.assign(address);
  else window.location.replace(address);
}
