/**
 * Loads this page again as a new document: what the page held in its memory goes, and it starts afresh from what the browser holds. A file of its
 * own, so that the tests of what loads it can hear it (a test's browser goes nowhere).
 */
export function reloadDocument(): void {
  window.location.reload();
}
