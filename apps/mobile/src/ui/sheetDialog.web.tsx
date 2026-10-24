import { View } from 'react-native';
import { EXTRA } from './theme';

/*
 * The web's twin of `sheetDialog.tsx`: an open sheet is a dialog as the Next web's Sheet is (apps/web/src/ui/overlay.tsx, docs/keyboard.md "Focus
 * and dialogs"). The dialog is react-native-web's Modal's own box (`role="dialog"`, `aria-modal`), named by the sheet's title; its panel takes the
 * focus when it is shown (or what the sheet names: its Close, an amount's slider), so Enter, the arrows and the sheet's own shortcuts start from
 * inside it, and Tab goes round the panel's controls, last to first and back, never out of it. The backdrop can take no focus at all (no
 * `tabindex`: the Modal's own trap, which tries each element in turn, passes it by), and is never said. While a sheet is open
 * the page behind it is inert: out of the Tab order and out of the screen reader's reach, counted, so that two sheets closing in either order never
 * leave the page dead. When what had the focus is taken out of the panel (an order removed from the basket) the focus goes to what now stands where
 * it stood, or the one before it at the end, or the panel. The focus goes back to what opened the sheet once it closes: react-native-web's Modal
 * does that (its focus trap).
 */

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** What a sheet takes from the page while it is open, counted (the Next web's `lockPage`): each element of the body but the sheet's own, inert. */
const held = new Map<HTMLElement, { count: number; inert: boolean }>();

function lockPage(root: HTMLElement | null): () => void {
  const nodes = [...document.body.children].filter((node): node is HTMLElement => node instanceof HTMLElement && node !== root);
  for (const node of nodes) {
    const entry = held.get(node);
    if (entry) entry.count += 1;
    else held.set(node, { count: 1, inert: Boolean(node.inert) });
    node.inert = true;
  }
  return () => {
    for (const node of nodes) {
      const entry = held.get(node);
      if (!entry) continue;
      if (--entry.count > 0) continue;
      node.inert = entry.inert;
      held.delete(node);
    }
  };
}

/** The sheet's window as it hangs off the body (react-native-web's Modal draws each into a box of its own there). */
function rootOf(box: HTMLElement): HTMLElement | null {
  let at: HTMLElement | null = box;
  while (at && at.parentElement !== document.body) at = at.parentElement;
  return at;
}

/** Nothing on the web: the dialog is the Modal's own box (`sheetModalProps`), not a box of the sheet's. */
export function sheetRootProps(): Record<string, unknown> {
  return {};
}

/** The Modal's dialog (react-native-web's `ModalContent`, which takes the Modal's other props) named by the sheet's title: the one dialog. */
export function sheetModalProps(titleId: string): Record<string, unknown> {
  return { 'aria-labelledby': titleId };
}

/** The panel can take the focus itself (not by Tab): where the sheet's keys start. */
export function sheetPanelProps(): Record<string, unknown> {
  return { tabIndex: -1, dataSet: { sheetPanel: true } };
}

/** The dimmed page round the panel, which closes the sheet when it is clicked: a box with no `tabindex`, which no focus can land on, never said. */
export function SheetBackdrop({ onClose }: { onClose(): void }) {
  return (
    <View
      testID="sheet-backdrop"
      aria-hidden
      {...{ onClick: onClose }}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: EXTRA.backdrop }}
    />
  );
}

/** How many frames a sheet is given to be shown before its first focus is let go (the Modal draws it a frame after it mounts it). */
const SHOWN_WITHIN = 10;

/**
 * Holds a sheet that is shown: its first focus (`initial`, else the panel) once the browser shows it, the page behind it inert, and a focus lost from
 * it given back. Returns what lets it go.
 */
export function holdSheet(panel: unknown, initial: () => unknown): () => void {
  if (!(panel instanceof HTMLElement)) return () => undefined;
  const box = panel;
  const unlock = lockPage(rootOf(box));

  // The first focus, once the Modal shows what it has mounted (hidden for a frame): tried each frame until it holds.
  let frame = 0;
  let tries = 0;
  const focusFirst = () => {
    const wanted = initial();
    const target = wanted instanceof HTMLElement && box.contains(wanted) ? wanted : box;
    target.focus({ preventScroll: true });
    if (document.activeElement !== target && ++tries < SHOWN_WITHIN) frame = requestAnimationFrame(focusFirst);
  };
  frame = requestAnimationFrame(focusFirst);

  // Tab goes round the panel's controls (the Next web's): past the last to the first, before the first to the last. Only for the sheet the focus is
  // in: one under it leaves the keys to the one on top.
  const onTab = (event: KeyboardEvent) => {
    const active = document.activeElement;
    if (event.key !== 'Tab' || !(active === box || box.contains(active))) return;
    const stops = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = stops[0];
    const last = stops[stops.length - 1];
    if (!first || !last) {
      event.preventDefault();
      box.focus();
    } else if (event.shiftKey && (active === first || active === box)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };
  document.addEventListener('keydown', onTab, true);

  let lastStop = 0;
  const rememberFocus = () => {
    const stops = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const at = stops.indexOf(document.activeElement as HTMLElement);
    if (at >= 0) lastStop = at;
  };
  box.addEventListener('focusin', rememberFocus);
  // When the thing that had the focus is taken out of the panel, the browser drops the focus on the body. Bring it back (and only then: a focus
  // taken by a sheet opened over this one is that sheet's).
  const watcher = new MutationObserver(() => {
    const active = document.activeElement;
    if (box.isConnected && (active === null || active === document.body)) {
      const stops = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)];
      (stops[Math.min(lastStop, Math.max(0, stops.length - 1))] ?? box).focus({ preventScroll: true });
    }
  });
  watcher.observe(box, { childList: true, subtree: true });

  return () => {
    cancelAnimationFrame(frame);
    document.removeEventListener('keydown', onTab, true);
    watcher.disconnect();
    box.removeEventListener('focusin', rememberFocus);
    unlock();
  };
}
