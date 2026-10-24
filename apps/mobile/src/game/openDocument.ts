/**
 * The phone has no documents to open: its pages are the router's screens, and a language is spoken where the player is (`useLanguage.ts`). The web
 * export's twin opens a page of the site as a new document (`openDocument.web.ts`); this one, of the same shape, does nothing.
 */
export function openDocument(address: string, how: 'push' | 'replace'): void {
  void address;
  void how;
}
