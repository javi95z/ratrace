import { useContext, useState, type ReactNode } from 'react';
import { Platform, TextInput, View, type ReturnKeyTypeOptions, type ViewStyle } from 'react-native';
import { Framed } from './Frame';
import { oneFace } from './fonts';
import { Language } from './text';
import { COLORS, EXTRA, TOUCH } from './theme';

/*
 * The web's text fields (apps/web/src/game/screens/Rankings.tsx's `FIELD`, the friend code beside it, Room.tsx's room code), in the game's look:
 *   text  `sunk min-h-11 w-full bg-night-900 px-3 text-[16px] text-cream`: a name (the rankings, the profile, a room's seat);
 *   code  the same, `uppercase tracking-[0.12em]`: a friend's code;
 *   room  `pixel frame sunk min-h-11 w-full bg-night-900 px-3 text-[22px] tracking-[0.3em] text-cream placeholder:text-ink-500`: a room's code,
 *         letters and digits only, upper-cased, six at most (its `onChange`);
 *   amount RoomLoans.tsx's `type="number"` field, `frame min-h-11 bg-night-900 px-3 text-[18px] text-cream`: whole dollars, digits only, on the
 *         phone's number pad (the browser's number field takes nothing else either).
 * `sunk` is drawn after `frame` in the web's stylesheet and wins: no outline round the room code either, only the sunk edge, night-900 on night-900.
 * Focused, the web's `:focus-visible` (a text field is always focus-visible in Chrome): a gold-200 outline 3 thick, 3 off the box.
 */

export type FieldKind = 'text' | 'code' | 'room' | 'amount';

const LOOK: Record<FieldKind, { role: 'read' | 'pixel'; size: number; tracking: number; placeholder: string; frame: 'sunk' | 'frame' }> = {
  text: { role: 'read', size: 16, tracking: 0, placeholder: EXTRA.placeholder, frame: 'sunk' },
  code: { role: 'read', size: 16, tracking: 0.12, placeholder: EXTRA.placeholder, frame: 'sunk' },
  room: { role: 'pixel', size: 22, tracking: 0.3, placeholder: COLORS['ink-500'], frame: 'sunk' },
  amount: { role: 'read', size: 18, tracking: 0, placeholder: EXTRA.placeholder, frame: 'frame' },
};

/** A room's code is six letters and digits (Room.tsx's `slice(0, 6)`). */
const ROOM_LENGTH = 6;

/** The web's `:focus-visible`: an outline this thick, this far off the box. */
const RING = 3;
const RING_OFFSET = 3;

/**
 * What a field keeps of what was typed or pasted: a code upper-cased (the web shows a friend's code `uppercase`; the phone holds it so), a room's
 * code its letters and digits only, and never more than the field takes (a paste past `maxLength`).
 */
export function cleanField(kind: FieldKind, text: string, maxLength: number | undefined): string {
  const kept = kind === 'room' ? text.replace(/[^A-Za-z0-9]/g, '').toUpperCase() : kind === 'code' ? text.toUpperCase() : kind === 'amount' ? text.replace(/[^0-9]/g, '') : text;
  return maxLength === undefined ? kept : kept.slice(0, maxLength);
}

interface TextFieldProps {
  /** What a screen reader calls it (the web's `<label>` round it, or its `aria-label`). */
  label: string;
  value: string;
  onChangeText(text: string): void;
  kind?: FieldKind;
  /** The most it takes; a room's code takes six. */
  maxLength?: number;
  placeholder?: string;
  /** The keyboard's return key (`go` where it sends, `done` where it closes). */
  returnKeyType?: ReturnKeyTypeOptions;
  /** The return key pressed: the web's form sent. */
  onSubmitEditing?(): void;
  autoFocus?: boolean;
  editable?: boolean;
  /** Holds the focused look without the focus (and the keyboard): the kit page, as its `Pressed` holds a press. */
  focused?: boolean;
  /** Where its parent places it (a share of a row, beside a button). It stretches across a column, as the web's `w-full`. */
  place?: ViewStyle;
}

/**
 * A text field in the game's look, 44 high. A native field takes one font for all it holds, so it is set in the face the kit's runs give what it
 * holds (its placeholder while it is empty), in the page's language (`oneFace`): Chakra for a Latin name on every page, Exo 2 for a Russian one,
 * Jersey for a room's code; the platform draws what that face lacks.
 */
export function TextField({ label, value, onChangeText, kind = 'text', maxLength, placeholder, returnKeyType, onSubmitEditing, autoFocus, editable, focused = false, place }: TextFieldProps): ReactNode {
  const language = useContext(Language);
  const [focus, setFocus] = useState(false);
  const look = LOOK[kind];
  const max = maxLength ?? (kind === 'room' ? ROOM_LENGTH : undefined);
  const face = oneFace(value === '' ? (placeholder ?? '') : value, look.role, 400, language);
  const spacing = look.tracking * look.size;
  return (
    <View style={[{ alignSelf: 'stretch' }, place]}>
      <Framed kind={look.frame} style={{ backgroundColor: COLORS['night-900'] }}>
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={(text) => onChangeText(cleanField(kind, text, max))}
          // A room's code is cleaned, then cut (`cleanField`): the phone's own limit would cut a paste first ('k7-q2 xm' to 'k7-q2 '), and its
          // code would come out short. The web's `maxLength={6}` does the same; holding the cut back is the phone's improvement on it.
          maxLength={kind === 'room' ? undefined : max}
          placeholder={placeholder}
          placeholderTextColor={look.placeholder}
          autoCapitalize={kind === 'text' || kind === 'amount' ? 'none' : 'characters'}
          keyboardType={kind === 'amount' ? 'number-pad' : 'default'}
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing === undefined ? undefined : () => onSubmitEditing()}
          autoFocus={autoFocus}
          editable={editable}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          // The caret in the text's colour, as the browser's (`caret-color: auto`). iOS's `selectionColor` is the caret's colour and the selection's
          // tint, which it lightens itself; Android's is the selection's highlight, opaque under the cream text, so there it is a cream the text
          // can be read through (`EXTRA.selection`) and the caret is its own `cursorColor`.
          {...(Platform.OS === 'android' ? { cursorColor: COLORS.cream, selectionColor: EXTRA.selection } : { selectionColor: COLORS.cream })}
          style={{
            minHeight: TOUCH,
            paddingHorizontal: 12,
            paddingVertical: 0,
            color: COLORS.cream,
            fontFamily: face.family,
            fontSize: look.size * face.scale,
            includeFontPadding: false,
            textAlignVertical: 'center',
            // No letter spacing at all where there is none: on iOS a spacing of 0 turns the font's kerning off.
            ...(spacing ? { letterSpacing: spacing } : null),
          }}
        />
      </Framed>
      {focus || focused ? (
        <View
          testID="focus-ring"
          style={{ position: 'absolute', top: -(RING + RING_OFFSET), left: -(RING + RING_OFFSET), right: -(RING + RING_OFFSET), bottom: -(RING + RING_OFFSET), borderWidth: RING, borderColor: COLORS['gold-200'], pointerEvents: 'none' }}
        />
      ) : null}
    </View>
  );
}
