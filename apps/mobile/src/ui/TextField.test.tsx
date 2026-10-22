// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useState } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { PIXEL_X_HEIGHT } from '@ratrace/core/game/share';
import { X_HEIGHT } from './fontCoverage';
import { oneFace } from './fonts';
import { paintOf } from './testing/paint';
import { Language } from './text';
import { COLORS, EXTRA } from './theme';
import { cleanField, TextField, type FieldKind } from './TextField';

// Records the props every native field is given (react-native-web drops what only a phone reads: the caret's and the selection's colours), and
// the platform is the test's to say.
const fields = vi.hoisted(() => [] as Array<Record<string, unknown>>);
const platform = vi.hoisted(() => ({ OS: 'web' }));
vi.mock('react-native', async (orig) => {
  const rn = (await orig()) as typeof import('react-native');
  const Recorded = (props: Record<string, unknown>) => {
    fields.push(props);
    return <rn.TextInput {...(props as Record<string, unknown>)} />;
  };
  return { ...rn, TextInput: Recorded, Platform: { ...rn.Platform, get OS() { return platform.OS; } } };
});

afterEach(() => {
  cleanup();
  fields.length = 0;
  platform.OS = 'web';
});

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
};

// The web's fields, as its screens write them: the phone's field is held to these classes.
const rankings = readFileSync(join(__dirname, '../../../web/src/game/screens/Rankings.tsx'), 'utf8');
const room = readFileSync(join(__dirname, '../../../web/src/game/screens/Room.tsx'), 'utf8');
const loans = readFileSync(join(__dirname, '../../../web/src/game/screens/RoomLoans.tsx'), 'utf8');

/** A field whose value is the caller's state, as a screen holds it. */
function Held({ kind, maxLength, start = '', onChange }: { kind?: FieldKind; maxLength?: number; start?: string; onChange?: (text: string) => void }) {
  const [value, setValue] = useState(start);
  return (
    <TextField
      label="Field"
      kind={kind}
      maxLength={maxLength}
      value={value}
      onChangeText={(text) => {
        onChange?.(text);
        setValue(text);
      }}
    />
  );
}

const input = () => screen.getByLabelText('Field') as HTMLInputElement;
/** The box the field is drawn in: the nearest element above the input that paints a background. */
const boxOf = (el: HTMLElement) => {
  let cur: HTMLElement | null = el.parentElement;
  while (cur && cur.style.backgroundColor === '') cur = cur.parentElement;
  return cur!;
};
const stripsOf = (box: HTMLElement) =>
  Array.from(box.children)
    .map((child) => child as HTMLElement)
    .filter((child) => child.style.position === 'absolute' && child.tagName !== 'INPUT');

test('the web\'s fields are still the classes the phone draws: `FIELD`, the friend code\'s, the room code\'s', () => {
  expect(rankings).toContain("export const FIELD = 'sunk min-h-11 w-full bg-night-900 px-3 text-[16px] text-cream';");
  expect(rankings).toContain('className={`${FIELD} uppercase tracking-[0.12em]`}');
  expect(room).toContain('className="pixel frame sunk min-h-11 w-full bg-night-900 px-3 text-[22px] tracking-[0.3em] text-cream placeholder:text-ink-500"');
  expect(room).toContain(".replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6)");
});

test('a field is the web\'s `FIELD`: a night-900 box with the sunk edge (no outline), 44 high, 12 in from each side, Chakra 16 in cream', () => {
  render(<Held />);
  const field = input();
  const box = boxOf(field);
  expect(box.style.backgroundColor).toBe(rgb(COLORS['night-900']));
  // `sunk`: two strips inside the box, along its top and its left, night-900; nothing outside it (the room code's `frame` loses to `sunk`).
  const strips = stripsOf(box);
  expect(strips.map(paintOf)).toEqual([rgb(COLORS['night-900']), rgb(COLORS['night-900'])]);
  for (const strip of strips) {
    expect(strip.style.top).toBe('0px');
    expect(strip.style.left).toBe('0px');
  }
  expect(field.style.minHeight).toBe('44px');
  expect(field.style.paddingLeft).toBe('12px');
  expect(field.style.paddingRight).toBe('12px');
  expect(field.style.fontFamily).toContain('ChakraPetch_400Regular');
  expect(field.style.fontSize).toBe('16px');
  expect(field.style.color).toBe(rgb(COLORS.cream));
  // No letter spacing at all: on iOS a spacing of 0 turns the font's kerning off.
  expect(field.style.letterSpacing).toBe('');
  // Tailwind's preflight: a placeholder is the text's colour at half.
  expect(field.style.getPropertyValue('--placeholderTextColor')).toBe(EXTRA.placeholder);
  expect(EXTRA.placeholder).toBe('rgba(244,241,228,0.5)');
});

test('focused, it has the web\'s `:focus-visible` ring: gold-200, 3 thick, 3 off the box; it goes with the focus', () => {
  render(<Held />);
  const ring = () => document.querySelector('[data-testid="focus-ring"]') as HTMLElement | null;
  expect(ring()).toBeNull();
  act(() => void fireEvent.focus(input()));
  const shown = ring()!;
  expect(shown).not.toBeNull();
  expect(shown.style.borderTopWidth).toBe('3px');
  expect(shown.style.borderTopColor).toBe(rgb(COLORS['gold-200']));
  for (const side of ['top', 'left', 'right', 'bottom'] as const) expect(shown.style[side], side).toBe('-6px');
  // It takes no touch: a tap on it is the field's, or what lies under it.
  expect(shown.style.pointerEvents).toBe('none');
  act(() => void fireEvent.blur(input()));
  expect(ring()).toBeNull();
});

test('a field held focused (the kit page) has the ring without the keyboard', () => {
  render(<TextField label="Field" value="" onChangeText={() => {}} focused />);
  expect(document.querySelector('[data-testid="focus-ring"]')).not.toBeNull();
});

test('the length limit holds, whatever is typed or pasted', () => {
  const onChange = vi.fn();
  render(<Held maxLength={16} onChange={onChange} />);
  expect(input().maxLength).toBe(16);
  fireEvent.change(input(), { target: { value: 'abcdefghijklmnopqrstuvwxyz' } });
  expect(onChange).toHaveBeenLastCalledWith('abcdefghijklmnop');
  expect(input().value).toBe('abcdefghijklmnop');
});

test('a name is as typed: no capitals forced, no correction, no spelling, nothing filled in', () => {
  render(<Held />);
  fireEvent.change(input(), { target: { value: 'ratty_99' } });
  expect(input().value).toBe('ratty_99');
  expect(input().getAttribute('autocapitalize')).toBe('none');
  expect(input().getAttribute('autocorrect')).toBe('off');
  expect(input().getAttribute('spellcheck')).toBe('false');
  expect(input().getAttribute('autocomplete')).toBe('off');
});

test('a code is upper-cased as it is typed, and asked of the keyboard in capitals, with the web\'s 0.12 em of tracking', () => {
  const onChange = vi.fn();
  render(<Held kind="code" maxLength={12} onChange={onChange} />);
  fireEvent.change(input(), { target: { value: 'ab12cd' } });
  expect(onChange).toHaveBeenLastCalledWith('AB12CD');
  expect(input().value).toBe('AB12CD');
  expect(input().getAttribute('autocapitalize')).toBe('characters');
  expect(input().getAttribute('autocorrect')).toBe('off');
  expect(parseFloat(input().style.letterSpacing)).toBeCloseTo(16 * 0.12, 5);
  expect(input().style.fontFamily).toContain('ChakraPetch_400Regular');
});

test('a room code is the web\'s: letters and digits only, upper-cased, six at most, in the pixel face at 22 with 0.3 em of tracking and an ink-500 placeholder', () => {
  const onChange = vi.fn();
  render(<Held kind="room" onChange={onChange} />);
  fireEvent.change(input(), { target: { value: 'k7-q2 xm9' } });
  expect(onChange).toHaveBeenLastCalledWith('K7Q2XM');
  // Cleaned, then cut: the phone's own `maxLength` would cut a paste first ('k7-q2 ' and nothing more), so a room's field leaves it to the cleaning.
  expect(input().maxLength).toBe(-1);
  expect(fields.at(-1)!.maxLength).toBeUndefined();
  fireEvent.change(input(), { target: { value: 'K7Q2XMA' } });
  expect(onChange).toHaveBeenLastCalledWith('K7Q2XM');
  expect(input().style.fontFamily).toContain('Jersey15_400Regular');
  expect(parseFloat(input().style.fontSize)).toBeCloseTo((22 * PIXEL_X_HEIGHT) / X_HEIGHT.Jersey15_400Regular, 3);
  expect(parseFloat(input().style.letterSpacing)).toBeCloseTo(22 * 0.3, 5);
  expect(input().style.getPropertyValue('--placeholderTextColor')).toBe(COLORS['ink-500']);
});

test('what a field keeps of what is typed, by its kind', () => {
  expect(cleanField('text', 'Ratty 99', 16)).toBe('Ratty 99');
  expect(cleanField('text', 'x'.repeat(20), 16)).toBe('x'.repeat(16));
  expect(cleanField('code', 'ab-12', 12)).toBe('AB-12');
  expect(cleanField('room', 'k7-q2 xm9', 6)).toBe('K7Q2XM');
  expect(cleanField('room', 'abc', undefined)).toBe('ABC');
  expect(cleanField('text', 'anything', undefined)).toBe('anything');
  expect(cleanField('amount', '$2,5x00', undefined)).toBe('2500');
});

test('a loan\'s amount is the web\'s number field: framed, night-900, Chakra 18 in cream, digits only, on the number pad', () => {
  expect(loans).toContain('className="frame min-h-11 bg-night-900 px-3 text-[18px] text-cream"');
  const onChange = vi.fn();
  render(<Held kind="amount" onChange={onChange} />);
  const field = input();
  expect(field.getAttribute('inputmode')).toBe('numeric');
  expect(field.style.fontSize).toBe('18px');
  expect(field.style.fontFamily).toContain('ChakraPetch_400Regular');
  expect(field.style.minHeight).toBe('44px');
  expect(boxOf(field).style.backgroundColor).toBe(rgb(COLORS['night-900']));
  fireEvent.change(field, { target: { value: '1.000 $' } });
  expect(onChange).toHaveBeenLastCalledWith('1000');
});

test('it is named for a screen reader, asks the keyboard for its return key, and is sent with it', () => {
  const onSubmit = vi.fn();
  render(<TextField label="Friend code" kind="code" value="AB12" onChangeText={() => {}} returnKeyType="go" onSubmitEditing={onSubmit} />);
  const field = screen.getByLabelText('Friend code');
  expect(field.getAttribute('enterkeyhint')).toBe('go');
  fireEvent.keyDown(field, { key: 'Enter' });
  expect(onSubmit).toHaveBeenCalledTimes(1);
});

test('one face for what a field holds: the kit\'s runs where they give one, else the first of the language\'s stack that draws all of it', () => {
  // English: Chakra for reading, Jersey for the pixel face.
  expect(oneFace('Ratty_99', 'read', 400, 'en').family).toBe('ChakraPetch_400Regular');
  expect(oneFace('K7Q2XM', 'pixel', 400, 'en').family).toBe('Jersey15_400Regular');
  // Russian: a Latin name is Chakra's, as the web's page draws it; a Cyrillic one Exo 2's; a mix the face that draws both, Exo 2.
  expect(oneFace('Ratty_99', 'read', 400, 'ru').family).toBe('ChakraPetch_400Regular');
  expect(oneFace('Иван', 'read', 400, 'ru').family).toBe('Exo2_400Regular');
  expect(oneFace('Иван_99', 'read', 400, 'ru').family).toBe('Exo2_400Regular');
  // The pixel face in Russian: Oswald draws the Cyrillic and the digits, scaled to the pixel stack's small letters.
  const oswald = oneFace('Код 7', 'pixel', 400, 'ru');
  expect(oswald.family).toBe('Oswald_500Medium');
  expect(oswald.scale).toBeCloseTo(PIXEL_X_HEIGHT / X_HEIGHT.Oswald_500Medium, 5);
  // Empty, the stack's first.
  expect(oneFace('', 'read', 400, 'ru').family).toBe('ChakraPetch_400Regular');
  expect(oneFace('', 'pixel', 400, 'en').family).toBe('Jersey15_400Regular');
});

test('on a Russian page the field takes the face of what it holds, or of its placeholder while it is empty', () => {
  const { rerender } = render(
    <Language.Provider value="ru">
      <TextField label="Field" value="Иван" onChangeText={() => {}} />
    </Language.Provider>,
  );
  expect(input().style.fontFamily).toContain('Exo2_400Regular');
  rerender(
    <Language.Provider value="ru">
      <TextField label="Field" value="Ratty" onChangeText={() => {}} />
    </Language.Provider>,
  );
  expect(input().style.fontFamily).toContain('ChakraPetch_400Regular');
  rerender(
    <Language.Provider value="ru">
      <TextField label="Field" value="" placeholder="Ваше имя" onChangeText={() => {}} />
    </Language.Provider>,
  );
  expect(input().style.fontFamily).toContain('Exo2_400Regular');
});

test('the field stands where its parent places it (a share of a row, beside a button)', () => {
  render(<TextField label="Field" value="" onChangeText={() => {}} place={{ flex: 1 }} />);
  let outer: HTMLElement | null = input();
  while (outer && outer.style.flexGrow !== '1') outer = outer.parentElement;
  expect(outer).not.toBeNull();
});

test('the caret is cream on both platforms; iOS tints the selection cream as well, Android, whose highlight is opaque under cream text, a cream it can be read through', () => {
  platform.OS = 'ios';
  render(<TextField label="Field" value="Ratty" onChangeText={() => {}} />);
  expect(fields.at(-1)).toMatchObject({ selectionColor: COLORS.cream });
  cleanup();
  platform.OS = 'android';
  render(<TextField label="Field" value="Ratty" onChangeText={() => {}} />);
  expect(fields.at(-1)).toMatchObject({ cursorColor: COLORS.cream, selectionColor: EXTRA.selection });
  expect(EXTRA.selection).toBe('rgba(244,241,228,0.35)');
});
