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
| Segmented radio group | Left, Right, Home, End | Select and focus an enabled option; disabled options are skipped. |
| Life picker | Up, Down, Home, End, text | Select an unlocked life, or find one by its localised name. |
| Card choices | Up, Down, Home, End, 1–4 | Move focus among available choices. Digits focus but do not commit. Enter or Space uses the focused native button. |
| Finance lists | Up, Down, Home, End, Escape | Move among actionable rows; Escape returns to the selected finance tab. |
| Amount slider | arrows, Shift + arrows, Page Up/Down, Home, End | Move one step, ten steps, roughly 10%, or to either limit. An adjacent number field accepts an exact value. |

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
amount acceleration and exact entry. The representative play-screen test advances from news and
answers a card with the keyboard alone. Any new composite control should add its key contract to
this document and a focused unit test before it ships.
