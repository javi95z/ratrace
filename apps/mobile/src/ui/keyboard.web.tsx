import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { View } from 'react-native';
import { PixelText } from './text';
import { COLORS } from './theme';

/*
 * The web's twin of `keyboard.tsx`: the game played without a pointing device, as the Next web plays it (apps/web/src/ui/keyboard.tsx, its contract
 * docs/keyboard.md). One listener on the page hears every key (`KeyboardListener`, mounted once by the app's root): it says whether the player is
 * using a keyboard (`useKeyboardMode`, and `data-input` on the root element, as the Next web's), and hands each key to the shortcuts registered
 * (`useKeyboardScope`), the highest priority first, until one takes it (heard before the control in focus, and never from inside a sheet); `?`
 * opens the keyboard's reference where no sheet or field has the keyboard.
 * Keys never reach a shortcut from a field being typed in, nor one already taken. The composite controls hear their own keys where they stand
 * (`onKeys`), and find what to move to by its mark (`data-…`, react-native-web's `dataSet`): `focusMarked`, `pressMarked`, `focusedMark`.
 */

/** Where the keyboard's reference says what is useful: the screen in front. */
export type KeyboardContextName = 'general' | 'new-life' | 'cards' | 'finance' | 'play';

/** A key pressed, as the browser tells it (a DOM event, or React's of it). */
export interface KeyEvent {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  repeat: boolean;
  target: unknown;
  preventDefault(): void;
  stopPropagation(): void;
}

/** A shortcut: true when it took the key; lower priorities then never see it. */
export type Shortcut = (event: KeyEvent) => boolean | void;

/** Whether a game can be played with a keyboard here: on the web. */
export const HAS_KEYBOARD = true;

/** Inputs keep every key for editing. */
export function isEditableTarget(target: unknown): boolean {
  return target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'));
}

/** A value kept outside React, which the components that read it are told of when it changes. */
function kept<T>(first: T) {
  let value = first;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next: T) {
      if (Object.is(next, value)) return;
      value = next;
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

/** Whether the last thing the player did was a key (not a pointer). */
const modality = kept(false);
/** The keyboard's reference: open or not, and for which screen. */
const help = kept(false);
const context = kept<KeyboardContextName>('general');

/** The shortcuts registered, each while it is active, by its priority. */
const scopes = new Map<symbol, { active: boolean; priority: number; shortcut: Shortcut }>();

/** Whether the player is using a keyboard: a key's badge (`KeyboardHint`) shows only then, so the touch layout keeps its density. */
export function useKeyboardMode(): boolean {
  return useSyncExternalStore(modality.subscribe, modality.get, () => false);
}

/** Registers a shortcut while `active`, by `priority`, without closing over stale screen state: the latest `shortcut` is the one heard. */
export function useKeyboardScope(shortcut: Shortcut, { active = true, priority = 0 }: { active?: boolean; priority?: number } = {}): void {
  const id = useRef(Symbol('keyboard-scope'));
  const latest = useRef(shortcut);
  latest.current = shortcut;
  useEffect(() => {
    const key = id.current;
    scopes.set(key, { active, priority, shortcut: (event) => latest.current(event) });
    return () => void scopes.delete(key);
  }, [active, priority]);
}

/** Says which shortcuts are useful on the screen in front, for the keyboard's reference. */
export function useKeyboardContext(name: KeyboardContextName): void {
  useEffect(() => {
    context.set(name);
    return () => context.set('general');
  }, [name]);
}

/** The keyboard's reference: whether it is open, for which screen, and the ways to open and close it. */
export function useKeyboardHelp(): { open: boolean; context: KeyboardContextName; show(): void; close(): void } {
  const open = useSyncExternalStore(help.subscribe, help.get, () => false);
  const name = useSyncExternalStore(context.subscribe, context.get, () => 'general' as const);
  return { open, context: name, show: () => help.set(true), close: () => help.set(false) };
}

/** Whether a sheet is open over the page. */
export function dialogOpen(): boolean {
  return typeof document !== 'undefined' && document.querySelector('[aria-modal="true"]') !== null;
}

const MODIFIERS = ['Shift', 'Control', 'Alt', 'Meta'];

/**
 * Hears the keyboard on the page, once, for the whole game: the modality (`data-input` on the root element, `pointer` or `keyboard`), the shortcuts
 * by priority, and `?` for the reference.
 */
export function KeyboardListener(): ReactNode {
  useEffect(() => {
    const root = document.documentElement;
    const mode = (keyboard: boolean) => {
      modality.set(keyboard);
      root.dataset.input = keyboard ? 'keyboard' : 'pointer';
    };
    const onPointer = () => mode(false);
    const onKey = (event: KeyboardEvent) => {
      if (!MODIFIERS.includes(event.key)) mode(true);
      // A sheet's keys are its own (its Escape, its controls, an amount's Ctrl/⌘ + Enter): the page's shortcuts are not for what is under it.
      if (event.defaultPrevented || isEditableTarget(event.target) || (event.target instanceof Element && event.target.closest('[aria-modal="true"]'))) return;
      for (const scope of [...scopes.values()].filter((entry) => entry.active).sort((a, b) => b.priority - a.priority)) {
        if (scope.shortcut(event)) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }
      if (event.key === '?' && !event.ctrlKey && !event.metaKey && !event.altKey && !dialogOpen()) {
        event.preventDefault();
        help.set(true);
      }
    };
    mode(false);
    document.addEventListener('pointerdown', onPointer, true);
    // Heard on the way down, before the control in focus: react-native-web's pressables keep Enter from the page once they have it (they stop it
    // there), and Ctrl/⌘ + Enter is the page's whatever has the focus. What a control does with its own keys (the arrows of its group) is for keys
    // no shortcut of the page takes while it is on screen.
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey, true);
      modality.set(false);
      help.set(false);
      delete root.dataset.input;
    };
  }, []);
  return null;
}

/** A key's cap (the web's `.keycap`): the pixel face at 12, gold on night-900, in a 1-pixel ink frame, at least 22 high. */
export function Keycap({ children }: { children: string }) {
  return (
    <View style={{ alignSelf: 'flex-start', minHeight: 22.4, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS['ink-300'], backgroundColor: COLORS['night-900'], paddingVertical: 0.8, paddingHorizontal: 5.6 }}>
      <PixelText size={12} lineHeight={12} tone="gold-200" numberOfLines={1}>{children}</PixelText>
    </View>
  );
}

/** A shortcut's badge in the top right corner of what it presses (`top-1 right-1`), only once the player uses a keyboard; never read out. */
export function KeyboardHint({ children }: { children: string }) {
  const keyboard = useKeyboardMode();
  if (!keyboard) return null;
  return (
    <View aria-hidden pointerEvents="none" style={{ position: 'absolute', top: 4, right: 4, zIndex: 2 }}>
      <Keycap>{children}</Keycap>
    </View>
  );
}

/** What a box is given to hear the keys pressed in it: a key `handler` takes is kept from the page (and from the shortcuts). */
export function onKeys(handler: Shortcut): { onKeyDown: (event: KeyEvent) => void } {
  return {
    onKeyDown: (event) => {
      if (isEditableTarget(event.target)) return;
      if (handler(event)) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
  };
}

const marked = (mark: string, value?: string | number): string => (value === undefined ? `[data-${mark}]` : `[data-${mark}="${CSS.escape(String(value))}"]`);
const pressable = (element: Element): boolean => element.getAttribute('aria-disabled') !== 'true' && !(element as HTMLButtonElement).disabled;

/** Gives the focus to what is marked `data-<mark>="<value>"`, and brings it into view. */
export function focusMarked(mark: string, value: string | number): boolean {
  const element = document.querySelector<HTMLElement>(marked(mark, value));
  if (!element) return false;
  element.focus();
  element.scrollIntoView?.({ block: 'nearest' });
  return true;
}

/** Presses what is marked `data-<mark>="<value>"`, or with no value the first marked `data-<mark>` that can be pressed. */
export function pressMarked(mark: string, value?: string | number): boolean {
  const element = [...document.querySelectorAll<HTMLElement>(marked(mark, value))].find(pressable);
  if (!element) return false;
  element.click();
  return true;
}

/** Gives the focus to the part of the page named `id` (the round's stage), without scrolling to it: a screen reader says where the player now is. */
export function focusPart(id: string): void {
  document.getElementById(id)?.focus({ preventScroll: true });
}

/** The mark of what has the focus (its `data-<mark>`), or null. */
export function focusedMark(mark: string): string | null {
  const active = document.activeElement;
  return active instanceof HTMLElement ? (active.closest(marked(mark))?.getAttribute(`data-${mark}`) ?? null) : null;
}

/** Moves the focus among what is marked `data-<mark>` that can be pressed, by `key`: ↓ and ↑ (round the ends), Home and End. False for any other key. */
export function stepMarked(mark: string, key: string): boolean {
  const direction = key === 'ArrowDown' ? 1 : key === 'ArrowUp' ? -1 : 0;
  if (!direction && key !== 'Home' && key !== 'End') return false;
  const items = [...document.querySelectorAll<HTMLElement>(marked(mark))].filter(pressable);
  if (items.length === 0) return false;
  const active = document.activeElement instanceof HTMLElement ? document.activeElement.closest<HTMLElement>(marked(mark)) : null;
  const at = Math.max(0, active ? items.indexOf(active) : 0);
  const next = key === 'Home' ? items[0] : key === 'End' ? items[items.length - 1] : items[(at + direction + items.length) % items.length];
  next.focus();
  next.scrollIntoView?.({ block: 'nearest' });
  return true;
}

/** A composite control's one Tab stop: only the control that is on takes the Tab key; the arrows move among the rest. */
export function tabStop(on: boolean): { tabIndex: 0 | -1 } {
  return { tabIndex: on ? 0 : -1 };
}

/**
 * An amount slider's keys, as every money control of the web has them (the Next web's `acceleratedRangeKey`): Shift and an arrow, ten steps; Page
 * Up and Down, about a tenth; Home and End, the ends. Null for any other key (a plain arrow is one step, the slider's own).
 */
export function acceleratedRangeKey(event: Pick<KeyEvent, 'key' | 'shiftKey'>, value: number, max: number, step: number): number | null {
  const direction = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 0;
  if (direction && event.shiftKey) return Math.max(0, Math.min(max, value + direction * step * 10));
  if (event.key === 'PageUp' || event.key === 'PageDown') {
    const page = Math.max(step, Math.round(max / 10 / step) * step);
    return Math.max(0, Math.min(max, value + (event.key === 'PageUp' ? page : -page)));
  }
  if (event.key === 'Home') return 0;
  if (event.key === 'End') return max;
  return null;
}
