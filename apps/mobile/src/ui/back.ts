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

/*
 * Every sheet its screen asks to be open, by how it is closed (its `onClose`, as the player closes it: the backdrop, Close, Back). A notice tapped closes
 * them all so (`closeAllSheets`), as a page left on the web takes its sheets with it: nothing is left open behind the screen the notice opens.
 */
const closers = new Set<{ close(): void }>();
/** Counts a sheet its screen asks to be open, by how it is closed. Returns what to call when it is asked no more. */
export function sheetAsked(sheet: { close(): void }): () => void {
  closers.add(sheet);
  return () => void closers.delete(sheet);
}
/** Closes every sheet that is open, each as the player would close it. One that will not close (a question being answered) stays open. */
export function closeAllSheets(): void {
  for (const sheet of [...closers]) {
    try {
      sheet.close();
    } catch {
      // A sheet that cannot be closed stays: `sheetsGone` says so to whoever waits.
    }
  }
}

/*
 * Every sheet shut at once, whatever its screen holds (`closeEverySheet`): the game is about to start again under them (the player signed out), and
 * a sheet is not left presented while the screens under it are taken away. Each closes as a sheet closes (the Sheet reads `sheetsShut`), so
 * `sheetsGone` tells when they are gone. They may open again once the game has started again (`openSheetsAgain`): the screens drawn anew have none open.
 */
let shutting = false;
/** Who holds the sheets shut (a start of the game again, a tap on a notice): they open again once every one has let go. */
const holders = new Set<symbol>();
const shutListeners = new Set<() => void>();
export const subscribeShut = (listener: () => void): (() => void) => {
  shutListeners.add(listener);
  return () => void shutListeners.delete(listener);
};
/** True while every sheet is shut. */
export const sheetsShut = (): boolean => shutting;
function setShutting(now: boolean): void {
  if (shutting === now) return;
  shutting = now;
  for (const listener of [...shutListeners]) listener();
}
/**
 * Shuts every sheet there is, until what it returns is called, and every other who shut them has let go too: a tap on a notice that lands while the
 * game starts again does not open the sheets under the start (or the other way round).
 */
export function closeEverySheet(): () => void {
  const holder = Symbol('shut');
  holders.add(holder);
  setShutting(true);
  return () => {
    if (holders.delete(holder)) setShutting(holders.size > 0);
  };
}
/** Lets the sheets open again, whoever shut them: for a game taken away whole, and a test's teardown. */
export const openSheetsAgain = (): void => {
  holders.clear();
  setShutting(false);
};

/**
 * The sheets taken away whole while they were shown, each holding its turn until its Modal has gone (overlay.tsx's `endTurnOnceGone`): what lets each
 * go. Kept here, where nothing is imported, so that a test's teardown reaches it without loading the kit.
 */
const holding = new Set<() => void>();
export const holdingTurn = (letGo: () => void): (() => void) => {
  holding.add(letGo);
  return () => void holding.delete(letGo);
};
/** Lets every turn held by a sheet already taken away go at once. For a test's teardown only (testing/setup.ts): the next test's sheets wait for none. */
export function letHeldTurnsGo(): void {
  for (const letGo of [...holding]) letGo();
}

/**
 * Tells the browser's Back about a sheet that has opened, on the web (`back.web.ts`): its history gets an entry of the sheet's own. The phone's Back
 * is the Modal's `onRequestClose`, which the Sheet answers by itself: nothing to do here. Returns what to call when it closes.
 */
export function closeOnBack(close: () => void): () => void {
  void close;
  return () => undefined;
}
