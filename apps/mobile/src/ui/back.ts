/*
 * The phone's counterpart of the web's ui/back.ts, for the one thing a screen asks of it: to be told when the sheets
 * are gone. (The rest of that file is the browser's Back button closing a sheet; the phone's Back is a Modal's
 * `onRequestClose`, which the Sheet answers by itself.)
 *
 * A screen that closes its sheets and then moves on, or ends something under them, must not do it while a sheet is
 * still leaving: on iOS a Modal takes a moment to dismiss, and a screen changed under it is left with a view
 * controller that is half gone. Each open Sheet is counted here (`sheetOpened`) and says when its Modal has dismissed
 * (the Modal's `onDismiss` on iOS; at once where the platform hides a Modal as it is told to).
 */

/** The sheets that are open, or leaving and not gone yet. */
let open = 0;
/** Who waits for every sheet to be gone. */
const waiting: Array<() => void> = [];

function settle(): void {
  if (open === 0) for (const done of waiting.splice(0)) done();
}

/**
 * Counts a sheet that has opened. Returns what to call when its Modal has dismissed (or the sheet has left the screen
 * with its parent): once is enough, a second call counts for nothing.
 */
export function sheetOpened(): () => void {
  open += 1;
  let counted = true;
  return () => {
    if (!counted) return;
    counted = false;
    open -= 1;
    settle();
  };
}

/** Resolves once every sheet that is open has closed and its Modal has dismissed: at once if none is open. */
export function sheetsGone(): Promise<void> {
  return new Promise((done) => {
    waiting.push(done);
    settle();
  });
}
