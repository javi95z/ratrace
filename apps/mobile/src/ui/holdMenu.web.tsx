import type { ReactElement } from 'react';
import type { AccessibilityActionEvent, AccessibilityActionInfo } from 'react-native';

/** Nothing on the web: a browser's long press and right click are its own (the phone's is `holdMenu.tsx`). */
export interface HoldAction {
  label: string;
  onPress(): void;
  danger?: boolean;
}
export interface Held {
  onLongPress?(): void;
  delayLongPress?: number;
  accessibilityActions?: AccessibilityActionInfo[];
  onAccessibilityAction?(event: AccessibilityActionEvent): void;
}
export const HOLD_MS = 400;
export function useHoldMenu(menu: { title: string; closeLabel: string; actions: readonly HoldAction[] }): { held: Held; menu: ReactElement | null } {
  void menu;
  return { held: {}, menu: null };
}
