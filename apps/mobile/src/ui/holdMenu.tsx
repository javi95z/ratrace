import { useRef, useState, type ReactElement } from 'react';
import { View, type AccessibilityActionEvent, type AccessibilityActionInfo } from 'react-native';
import { useHaptic } from './haptic';
import { Button } from './kit';
import { Sheet } from './overlay';

/*
 * What can be done with something, opened by a long press, as a phone's own lists open a thing's menu: the long press is felt (`hold`), and a sheet
 * names the thing and lists what can be done, each choice taken once the sheet has gone (a choice that opens a sheet of its own never opens it over
 * this one). A screen reader has the same choices as the thing's own actions, with no menu. The thing's own buttons stay: the menu is the hand's
 * shortcut, never the only way. (On the web nothing: `holdMenu.web.tsx`, a browser's long press and right click are its own.)
 */

/** One thing that can be done: its words, and the doing. `danger` for what cannot be had back once the round is played (a sale). */
export interface HoldAction {
  label: string;
  onPress(): void;
  danger?: boolean;
}

/** What a pressable is given to open the menu: its long press, and the same choices for a screen reader. */
export interface Held {
  onLongPress?(): void;
  delayLongPress?: number;
  accessibilityActions?: AccessibilityActionInfo[];
  onAccessibilityAction?(event: AccessibilityActionEvent): void;
}

/** How long a press is held before it is a long press: Android's own (iOS's menus wait about as long). */
export const HOLD_MS = 400;

/**
 * The menu of a thing, named `title`, with `actions` (those that cannot be done now left out by the caller): what its pressable is given (`held`),
 * and the sheet to draw beside it (`menu`). Nothing to hold where there is nothing to do.
 */
export function useHoldMenu({ title, closeLabel, actions }: { title: string; closeLabel: string; actions: readonly HoldAction[] }): { held: Held; menu: ReactElement | null } {
  const haptic = useHaptic();
  const [open, setOpen] = useState(false);
  // The choice taken, done once the sheet has gone.
  const chosen = useRef<(() => void) | null>(null);
  const latest = useRef(actions);
  latest.current = actions;
  if (actions.length === 0) return { held: {}, menu: null };
  const held: Held = {
    delayLongPress: HOLD_MS,
    onLongPress: () => {
      haptic('hold');
      setOpen(true);
    },
    accessibilityActions: actions.map((action, at) => ({ name: `hold-${at}`, label: action.label })),
    onAccessibilityAction: (event) => {
      const at = Number(event.nativeEvent.actionName.replace('hold-', ''));
      latest.current[at]?.onPress();
    },
  };
  const menu = (
    <Sheet
      open={open}
      onClose={() => setOpen(false)}
      onGone={() => {
        const run = chosen.current;
        chosen.current = null;
        run?.();
      }}
      title={title}
      closeLabel={closeLabel}
    >
      <View style={{ gap: 8, paddingBottom: 4 }}>
        {actions.map((action) => (
          <Button
            key={action.label}
            variant={action.danger ? 'danger' : 'secondary'}
            wide
            onPress={() => {
              chosen.current = action.onPress;
              setOpen(false);
            }}
          >
            {action.label}
          </Button>
        ))}
      </View>
    </Sheet>
  );
  return { held, menu };
}
