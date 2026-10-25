import { Pressable } from 'react-native';
import Animated from 'react-native-reanimated';
import { EXTRA } from './theme';

/** A pressable whose look can follow a shared value: the backdrop, which fades as its sheet is pulled down. */
const FadingPressable = Animated.createAnimatedComponent(Pressable);

/*
 * What makes an open sheet a dialog, by platform. On the phone the sheet's window is modal to the screen reader (`accessibilityViewIsModal`), its
 * backdrop a pressable that closes it, and nothing else is asked: its Modal is a window of its own. The web's twin (`sheetDialog.web.tsx`) makes
 * it the dialog the Next web's Sheet is: named by its title, its panel given the focus, Tab kept inside it, the page behind it inert
 * (docs/keyboard.md, "Focus and dialogs").
 */

/** What the sheet's whole window is given (the box round the backdrop and the panel): modal to the screen reader. */
export function sheetRootProps(): Record<string, unknown> {
  return { accessibilityViewIsModal: true, 'aria-modal': true };
}

/** What the sheet's Modal is given (on the web, its dialog named by the title called `titleId`). Nothing on the phone. */
export function sheetModalProps(titleId: string): Record<string, unknown> {
  void titleId;
  return {};
}

/** What the sheet's panel is given (on the web, the focus's place). Nothing on the phone. */
export function sheetPanelProps(): Record<string, unknown> {
  return {};
}

/**
 * The dimmed page round the panel, which closes the sheet when it is tapped (the Next web's `data-sheet-backdrop`), and fades as the panel is pulled
 * down (`dim`). Never said by a screen reader.
 */
export function SheetBackdrop({ onClose, dim }: { onClose(): void; dim?: object }) {
  return (
    <FadingPressable
      testID="sheet-backdrop"
      accessible={false}
      importantForAccessibility="no"
      onPress={onClose}
      style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: EXTRA.backdrop }, dim]}
    />
  );
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
