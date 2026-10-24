/*
 * The browser's Back closing the sheet on top, as the Next web's `ui/back.ts` does it, word for word (`back.ts` holds the rest, shared with the
 * phone, and asks this file whether the history is settled):
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
  settled();
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
  if (sheets.length > 0 || own > 0 || !onGuard()) return settled();
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

/** Who is told each time the history may have settled (`back.ts`, whose waiters for the sheets to be gone wait for the history too). */
const listeners = new Set<() => void>();
function settled(): void {
  for (const listener of [...listeners]) listener();
}

/** Whether no sheet's entry is in the history or on its way out of it: a page that moves on now is not taken back by a step still coming. */
export function historySettled(): boolean {
  return sheets.length === 0 && own === 0 && tidying === null;
}

/** Tells `listener` each time the history may have settled. Returns what stops telling it. */
export function onHistorySettled(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
