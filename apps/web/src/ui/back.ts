/**
 * The Back button of a phone closes the sheet on top, as it does in an app, instead of leaving the page.
 *
 * One entry is kept in the history for Back to take away, however many sheets come and go, so
 * entries never pile up. When Back takes it: if a sheet is open, that sheet closes and the entry
 * is put back; if none is, the player meant to leave, and the page goes back once more.
 * Closing a sheet by its own button never touches the history, so nothing here can race.
 */

/** The ways to close the sheets that are open, the last opened last. */
const sheets: Array<() => void> = [];
/** True while our entry is in the history. */
let guarding = false;
let listening = false;

function guard(): void {
  if (guarding) return;
  // The same address, with whatever the router keeps in the entry, so the router sees nothing new.
  history.pushState(history.state, '');
  guarding = true;
}

function onBack(): void {
  if (!guarding) return;
  guarding = false;
  const closeTop = sheets.at(-1);
  if (closeTop) {
    closeTop();
    guard();
  } else {
    history.back();
  }
}

/** Tells the Back button about a sheet that has opened. Returns what to call when it closes. */
export function closeOnBack(close: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  if (!listening) {
    window.addEventListener('popstate', onBack);
    listening = true;
  }
  sheets.push(close);
  guard();
  return () => {
    const at = sheets.lastIndexOf(close);
    if (at >= 0) sheets.splice(at, 1);
  };
}
