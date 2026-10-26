import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useIsWide } from './desk';
import { Framed } from './Frame';
import { GOLD } from './frames';
import { pressDown, usePress } from './kit';
import { Sheet } from './overlay';
import { Sprite, SpriteLayers } from './Sprite';
import { spriteBox } from './sprites';
import { ReadText } from './text';
import { COLORS, TOUCH } from './theme';
import { useHaptic } from './haptic';

export interface PickerOption<T> {
  value: T;
  label: string;
  /** A sprite beside the label. */
  icon?: string;
  /** A portrait beside the label, of which only the face is shown, at the size of an icon. */
  face?: string;
}

/**
 * The face of a 64-pixel portrait, cut out of it at its own size, never shrunk: in the space of a
 * 32-pixel icon, or of a 44-pixel one for a line of a list. A `backdrop` (a city's sky) lies behind it, its middle at the
 * middle of the box.
 */
export function Face({ id, size = 'sm', backdrop }: { id: string; size?: 'sm' | 'md'; backdrop?: string }) {
  const box = size === 'md' ? 44 : 32;
  // The sky and the face on one canvas of the box, which cuts both (SpriteLayers): one picture to make and draw for a line of a list, not two.
  const layers = useMemo(() => {
    const face = spriteBox(id, 1, 1, PORTRAIT);
    const sky = backdrop ? spriteBox(backdrop, 1, 1, PORTRAIT) : null;
    return [
      ...(backdrop && sky ? [{ id: backdrop, x: (box - sky.w) / 2, y: (box - sky.h) / 2, ...sky }] : []),
      { id, x: size === 'md' ? -10 : -16, y: size === 'md' ? -4 : -6, ...face },
    ];
  }, [id, backdrop, box, size]);
  return <SpriteLayers size={{ w: box, h: box }} layers={layers} />;
}

/** A portrait's box where its art is missing. */
const PORTRAIT = { w: 64, h: 64 };

/** What stands beside an option: its face, or its icon. */
const mark = (option: { icon?: string; face?: string }): ReactNode => (option.face ? <Face id={option.face} /> : option.icon ? <Sprite id={option.icon} /> : null);

function Option<T>({ option, selected, onPick, half = false }: { option: PickerOption<T>; selected: boolean; onPick: () => void; half?: boolean }) {
  const press = usePress({ onPress: onPick });
  return (
    <Pressable style={half ? { flex: 1, minWidth: 0 } : undefined} accessibilityRole="radio" accessibilityState={{ checked: selected }} aria-checked={selected} onPress={press}>
      <Framed
        kind={selected ? 'bevel' : 'frame'}
        tone={selected ? GOLD : {}}
        style={{
          flexGrow: half ? 1 : 0,
          backgroundColor: COLORS[selected ? 'night-600' : 'night-700'],
          minHeight: TOUCH,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 12,
          paddingVertical: 6,
        }}
      >
        {mark(option)}
        <View style={{ flex: 1, minWidth: 0 }}>
          <ReadText numberOfLines={1} tone={selected ? 'gold-200' : 'cream'}>{option.label}</ReadText>
        </View>
        {selected ? <ReadText tone="gold-500">{'✓'}</ReadText> : null}
      </Framed>
    </Pressable>
  );
}

/**
 * A choice among many, in the game's own look: a raised button showing what is chosen, which opens
 * the whole list in a sheet. Picking closes it.
 */
export function Picker<T extends string | null>({ label, value, options, onChange, closeLabel }: { label: string; value: T; options: ReadonlyArray<PickerOption<T>>; onChange(value: T): void; closeLabel: string }) {
  const [open, setOpen] = useState(false);
  const chosen = options.find((option) => option.value === value) ?? options[0];
  const show = usePress({ onPress: () => setOpen(true) });
  // From the web's `sm` up the options stand two to a row (`grid-cols-1 sm:grid-cols-2`), each pair as tall as its taller.
  const wide = useIsWide();
  const haptic = useHaptic();
  const each = (option: PickerOption<T>) => (
    <Option
      key={String(option.value)}
      option={option}
      selected={option.value === value}
      half={wide}
      onPick={() => {
        // Another option taken is felt, as a phone's own picker ticks; the one already chosen is not.
        if (option.value !== value) haptic('select');
        onChange(option.value);
        setOpen(false);
      }}
    />
  );
  const rows: Array<ReadonlyArray<PickerOption<T>>> = [];
  for (let at = 0; at < options.length; at += 2) rows.push(options.slice(at, at + 2));
  return (
    <View style={{ gap: 4 }}>
      <ReadText size={13} tone="ink-200">{label}</ReadText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${chosen.label}`}
        accessibilityState={{ expanded: open }}
        onPress={show}
        style={({ pressed }) => ({ ...pressDown(pressed), width: '100%' })}
      >
        <Framed kind="raised" style={{ backgroundColor: COLORS['night-600'], minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 }}>
          {mark(chosen)}
          <View style={{ flex: 1, minWidth: 0 }}>
            <ReadText size={16} numberOfLines={1}>{chosen.label}</ReadText>
          </View>
          <View aria-hidden importantForAccessibility="no-hide-descendants">
            <ReadText size={12} tone="gold-500">{'▼'}</ReadText>
          </View>
        </Framed>
      </Pressable>
      {open ? (
        <Sheet open onClose={() => setOpen(false)} title={label} closeLabel={closeLabel}>
          <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ gap: 6 }}>
            {wide
              ? rows.map((row) => (
                  <View key={String(row[0].value)} style={{ flexDirection: 'row', gap: 6 }}>
                    {row.map(each)}
                    {/* A last one alone keeps to its half, as in the web's grid. */}
                    {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
                  </View>
                ))
              : options.map(each)}
          </View>
        </Sheet>
      ) : null}
    </View>
  );
}
