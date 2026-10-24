# Keyboard play

The game can be played without a pointing device. Keyboard behaviour is an interaction contract,
not a set of screen-specific event listeners.

## Global contract

- `Tab` and `Shift + Tab` move between controls. Composite controls expose one Tab stop and use
  arrows internally.
- `Escape` closes the active sheet and restores focus to the control that opened it.
- `?` opens a localised, context-sensitive keyboard reference when no sheet or editable field has
  the keyboard.
- `Ctrl + Enter` or `Command + Enter` presses the current safe primary round action. Repeated
  keydown events are ignored and destructive confirmations never register as primary actions.
- Shortcuts do not run from inputs, text areas, selects, editable content or text boxes. Browser,
  operating-system and assistive-technology modifier chords are left alone.
- Key badges appear only after keyboard input. Pointer input hides them again, so the touch UI
  keeps its original density.

The shortcut registry is centralised in `src/ui/keyboard.tsx`. A scope returns `true` only when it
consumes an event. Active scopes run by priority, which lets a dialog take precedence over a stage
and a stage over a global command.

## Composite controls

| Control | Keys | Behaviour |
| --- | --- | --- |
| Tabs | Left, Right, Home, End | Select and focus the adjacent, first or last tab. |
| Finance tabs | `[`, `]` | From anywhere on the finance stage, select and focus the previous or next tab. |
| Segmented radio group | Left, Right, Home, End | Select and focus an enabled option; disabled options are skipped. |
| Life picker | Up, Down, Home, End, text | Select an unlocked life, or find one by its localised name. |
| Card choices | Up, Down, Home, End, 1–4 | Move focus among available choices. A digit chooses that available option at once; a held digit never answers the next card. Enter or Space uses the focused native button. |
| Shop view | Left, Right, Home, End | Recommended, in reach or all: a segmented radio group. |
| Finance lists | Up, Down, Home, End, Escape | Move among actionable rows; Escape returns to the selected finance tab. |
| Amount slider | arrows, Shift + arrows, Page Up/Down, Home, End | Move one step, ten steps, roughly 10%, or to either limit. |

## Focus and dialogs

Sheets trap Tab, close on Escape, make the page behind them inert and restore their opener. Each
sheet may choose its initial focus. Amount sheets use the slider; informational sheets can use the
panel or close control. If a focused row is removed, focus moves to the row now occupying the same
position, or the preceding row at the end of the list.

Stage changes focus the named stage. When the player entered the card stage with a keyboard, the
first available card choice becomes the continuation point. Focused controls scroll into the nearest
visible area and use a high-contrast pixel outline distinct from selected gold or cream states.

Desktop play exposes skip links for the current round, profile, news, orders and round actions.
They stay outside the visual layout until focused.

## Verification

Unit tests cover modality, priority-safe shortcuts, editable-field exclusion, key repeat, help,
dialog focus, inert background content, roving Tab stops, disabled choices, life typeahead, cards,
and amount acceleration. The representative play-screen test advances from news and
answers a card with the keyboard alone. Any new composite control should add its key contract to
this document and a focused unit test before it ships.

## The app's web (apps/mobile)

The Expo app's web export keeps this contract in `apps/mobile/src/ui/keyboard.web.tsx` (the phone's
twin, `keyboard.tsx`, does nothing). Two things differ from the Next web's listener, because the
controls are react-native-web's:

- **The page's shortcuts are heard in the capture phase, before the control in focus.** A
  react-native-web pressable keeps Enter from the page once it has the focus (it stops the event at
  React's root), so a bubbling listener would never hear Ctrl + Enter over a focused button. A
  shortcut therefore takes precedence over a focused control's own handler for the same key: a
  screen must not register a page shortcut for a key one of its composite controls uses while both
  are on screen (today the cards' arrows and digits, the finances' `[` and `]`, and Ctrl + Enter are
  never on screen with such a control).
- **No page shortcut takes a key from inside a sheet.** A sheet's keys are its own (Escape, its
  controls, an amount's Ctrl + Enter); the Next web gets this from the order of its listeners.

A composite control hears its own keys where it stands (`onKeys`). React bubbles events out of a
portal through the components that drew it, so a sheet opened from inside a control would hand its
keys to that control: `onKeys` leaves alone a key whose target is inside a sheet the control is not
in. Sheets are dialogs as the Next web's are (`apps/mobile/src/ui/sheetDialog.web.tsx`): the one
dialog (react-native-web's Modal's) is named by the title, the panel takes the focus (or its Close,
or an amount's slider), Tab goes round the panel's controls, the backdrop can take no focus, the
page behind is inert while any sheet is open, a focused row taken out hands the focus to
the row in its place, and the focus goes back to the opener when the sheet closes.
