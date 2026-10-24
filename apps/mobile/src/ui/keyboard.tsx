import type { ReactNode } from 'react';

/*
 * The keyboard's controls, the web's (`keyboard.web.tsx`, after the Next web's apps/web/src/ui/keyboard.tsx and docs/keyboard.md). A phone has no
 * keyboard to play with: every piece is here, with the web twin's exports, and does nothing.
 */

/** Where the keyboard's reference says what is useful: the screen in front. */
export type KeyboardContextName = 'general' | 'new-life' | 'cards' | 'finance' | 'play';

/** A key pressed, as the browser tells it. */
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

/** A shortcut: true when it took the key. */
export type Shortcut = (event: KeyEvent) => boolean | void;

/** Whether a game can be played with a keyboard here: on the web. */
export const HAS_KEYBOARD = false;

/** Whether the field a key went to keeps every key for itself. Nothing on a phone. */
export function isEditableTarget(target: unknown): boolean {
  void target;
  return false;
}

/** Whether the player is using a keyboard (the last thing they did was a key, not a pointer). Never on a phone. */
export function useKeyboardMode(): boolean {
  return false;
}

/** Registers a shortcut while `active`, by `priority`. Nothing on a phone. */
export function useKeyboardScope(shortcut: Shortcut, options: { active?: boolean; priority?: number } = {}): void {
  void shortcut;
  void options;
}

/** Says which shortcuts are useful on the screen in front. Nothing on a phone. */
export function useKeyboardContext(context: KeyboardContextName): void {
  void context;
}

/** The keyboard's reference: never open on a phone. */
export function useKeyboardHelp(): { open: boolean; context: KeyboardContextName; show(): void; close(): void } {
  return { open: false, context: 'general', show: () => undefined, close: () => undefined };
}

/** Hears the keyboard on the page. Nothing on a phone. */
export function KeyboardListener(): ReactNode {
  return null;
}

/** A key's cap, drawn as the web draws its `.keycap`. Nothing on a phone. */
export function Keycap({ children }: { children: string }): ReactNode {
  void children;
  return null;
}

/** A shortcut's badge in the corner of what it presses, once the player uses a keyboard. Nothing on a phone. */
export function KeyboardHint({ children }: { children: string }): ReactNode {
  void children;
  return null;
}

/** What a box is given to hear the keys pressed in it (`onKeyDown`, on the web). Nothing on a phone. */
export function onKeys(handler: Shortcut): Record<string, never> {
  void handler;
  return {};
}

/** Gives the focus to what is marked `data-<mark>="<value>"`. Nothing on a phone. */
export function focusMarked(mark: string, value: string | number): boolean {
  void mark;
  void value;
  return false;
}

/** Presses what is marked `data-<mark>="<value>"` (or the first marked `data-<mark>` that can be pressed). Nothing on a phone. */
export function pressMarked(mark: string, value?: string | number): boolean {
  void mark;
  void value;
  return false;
}

/** The mark of what has the focus (`data-<mark>`), or null. Nothing on a phone. */
export function focusedMark(mark: string): string | null {
  void mark;
  return null;
}

/** Moves the focus among what is marked `data-<mark>` that can be pressed, by `key` (↓ ↑ Home End). Nothing on a phone. */
export function stepMarked(mark: string, key: string): boolean {
  void mark;
  void key;
  return false;
}

/** A composite control's one Tab stop: only the control that is on takes the Tab key (the web's `tabIndex`). Nothing on a phone. */
export function tabStop(on: boolean): Record<string, never> {
  void on;
  return {};
}

/** Whether a sheet is open over the page. Not asked on a phone. */
export function dialogOpen(): boolean {
  return false;
}

/**
 * An amount slider's keys, as every money control of the web has them (`acceleratedRangeKey`): Shift and an arrow, ten steps; Page Up and Down,
 * about a tenth; Home and End, the ends. Null for any other key (a plain arrow is one step, the slider's own).
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
