/*
 * What makes an open sheet a dialog, by platform. On the phone the sheet's window is modal to the screen reader (`accessibilityViewIsModal`), and
 * nothing else is asked: its Modal is a window of its own. The web's twin (`sheetDialog.web.ts`) makes the panel the dialog, as the Next web's
 * Sheet is: named by its title, given the focus, the page behind it inert (docs/keyboard.md, "Focus and dialogs").
 */

/** What the sheet's whole window is given (the box round the backdrop and the panel): modal to the screen reader. */
export function sheetRootProps(): Record<string, unknown> {
  return { accessibilityViewIsModal: true, 'aria-modal': true };
}

/** What the sheet's panel is given (on the web, the dialog, named by the title called `titleId`). Nothing on the phone. */
export function sheetPanelProps(titleId: string): Record<string, unknown> {
  void titleId;
  return {};
}

/**
 * Holds a sheet that is shown: on the web, its first focus (`initial`, else the panel), the page behind it inert, a focus lost from it given back.
 * Nothing on the phone. Returns what lets it go.
 */
export function holdSheet(panel: unknown, initial: () => unknown): () => void {
  void panel;
  void initial;
  return () => undefined;
}
