/*
 * The web's twin of `back.ts`: everything the phone's file does for a screen (the sheets counted until they are gone, closed all at once, shut
 * while the game starts again), and the browser's Back closing the sheet on top, as the Next web's `ui/back.ts` does it, word for word:
 *
 * While a sheet is open, one entry of the history is the sheet's own: Back takes it away, and the
 * sheet closes with it. The entry carries a mark in its own state, so what the history holds is
 * read from the history and never remembered here. A change of page, a reload or an entry the
 * router replaced cannot leave this file believing in an entry that is gone.
 *
 * - A sheet opens: the entry is added, unless the page already stands on one.
 * - Back with a sheet open: the sheet on top closes. One still open under it gets a new entry.
 * - The last sheet closes by its own button: the entry is taken out again, so entries never pile up.
 * - Back or Forward lands on an entry with no sheet to close, because the page moved on while a
 *   sheet was open: it is stepped over, so a press of Back is never spent on nothing.
 *
 * Taking the entry out is a step back that this file asks for, and a step back arrives a moment
 * after it is asked for. What happens in that moment is allowed for: a sheet that opens gets its
 * entry, and a page that changes is not taken back.
 *
 * The entry keeps whatever the router keeps in the one under it (expo-router's `id`): the router, told of the step, finds the entry it knows and
 * the page it shows, and stays on it.
 */

const MARK = 'ratraceSheet';

/** The ways to close the sheets that are open to the browser's Back, the last opened last. */
const sheets: Array<() => void> = [];
/** Steps back asked for here whose arrival has not been heard yet. Those are not the player's. */
let own = 0;
let listening = false;
let tidying: ReturnType<typeof setTimeout> | null = null;

const onGuard = (): boolean => (history.state as Record<string, unknown> | null)?.[MARK] === true;

function guard(): void {
  if (onGuard()) return;
  // The same address, with whatever the router keeps in the entry, so the router sees nothing new.
  history.pushState({ ...(history.state as Record<string, unknown> | null), [MARK]: true }, '');
}

function stepBack(): void {
  own += 1;
  history.back();
}

function onPop(): void {
  popped();
  settle();
}

function popped(): void {
  if (own > 0) {
    own -= 1;
    if (sheets.length > 0) {
      // A sheet that opened while the entry was on its way out needs one of its own.
      guard();
    } else if (onGuard()) {
      // The step was to leave the sheet's entry, and it has landed on it instead: the page moved on
      // while the step was on its way, and the step took the player's own move back. Put it back.
      history.forward();
    }
    return;
  }
  const closeTop = sheets.pop();
  if (closeTop) {
    closeTop();
    if (sheets.length > 0) guard();
  } else if (onGuard()) {
    stepBack();
  }
}

/** Takes the entry out once no sheet needs it. */
function tidy(): void {
  tidying = null;
  // Nothing to take out if a sheet has opened since, if the page has moved on, or if a step back is already on its way.
  if (sheets.length > 0 || own > 0 || !onGuard()) return settle();
  stepBack();
}

/** Tells the browser's Back about a sheet that has opened. Returns what to call when it closes. */
export function closeOnBack(close: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  if (!listening) {
    window.addEventListener('popstate', onPop);
    listening = true;
  }
  sheets.push(close);
  guard();
  return () => {
    const at = sheets.lastIndexOf(close);
    if (at >= 0) sheets.splice(at, 1);
    // Not at once: a sheet that hands over to another keeps the entry, and a page that is changing must get there first.
    if (sheets.length === 0 && tidying === null) tidying = setTimeout(tidy);
  };
}

/** The sheets that are open, or leaving and not gone yet. */
let open = 0;
/** Who waits for every sheet to be gone. */
const waiting: Array<() => void> = [];

function settle(): void {
  // Gone from the screen, and their entry gone from the history: a page that moves on then is not taken back by a step still on its way.
  if (open === 0 && sheets.length === 0 && own === 0 && tidying === null) for (const done of waiting.splice(0)) done();
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

/** Resolves once every sheet that is open has closed, its Modal dismissed and its entry out of the history: at once if none is open. */
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
