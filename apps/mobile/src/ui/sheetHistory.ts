/*
 * The browser's Back closing a sheet (`sheetHistory.web.ts`, the Next web's `closeOnBack`). The phone's Back is a Modal's `onRequestClose`, which the
 * Sheet answers by itself: nothing is kept here, and the history is always settled.
 */

/** Tells the browser's Back about a sheet that has opened, on the web. Nothing on the phone. Returns what to call when it closes. */
export function closeOnBack(close: () => void): () => void {
  void close;
  return () => undefined;
}

/** Whether no sheet's entry is in the browser's history or on its way out of it: always, on the phone. */
export function historySettled(): boolean {
  return true;
}

/** Tells `listener` each time the history may have settled: never, on the phone. Returns what stops telling it. */
export function onHistorySettled(listener: () => void): () => void {
  void listener;
  return () => undefined;
}
