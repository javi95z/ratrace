import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Framed } from './Frame';
import { GOLD } from './frames';
import { sink, usePress } from './kit';
import { Sheet } from './overlay';
import { Sprite } from './Sprite';
import { ReadText } from './text';
import { COLORS, TOUCH } from './theme';

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
 * 32-pixel icon, or of a 44-pixel one for a line of a list.
 */
export function Face({ id, size = 'sm' }: { id: string; size?: 'sm' | 'md' }) {
  const box = size === 'md' ? 44 : 32;
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" style={{ width: box, height: box, flexShrink: 0, overflow: 'hidden' }}>
      <Sprite id={id} fallback={{ w: 64, h: 64 }} style={{ position: 'absolute', left: size === 'md' ? -10 : -16, top: size === 'md' ? -4 : -6 }} />
    </View>
  );
}

/** What stands beside an option: its face, or its icon. */
const mark = (option: { icon?: string; face?: string }): ReactNode => (option.face ? <Face id={option.face} /> : option.icon ? <Sprite id={option.icon} /> : null);

function Option<T>({ option, selected, onPick }: { option: PickerOption<T>; selected: boolean; onPick: () => void }) {
  const press = usePress({ onPress: onPick });
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} aria-checked={selected} onPress={press}>
      <Framed
        kind={selected ? 'bevel' : 'frame'}
        tone={selected ? GOLD : {}}
        style={{
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
  return (
    <View style={{ gap: 4 }}>
      <ReadText size={13} tone="ink-200">{label}</ReadText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${chosen.label}`}
        accessibilityState={{ expanded: open }}
        onPress={show}
        style={({ pressed }) => ({ ...sink(pressed), width: '100%' })}
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
            {options.map((option) => (
              <Option
                key={String(option.value)}
                option={option}
                selected={option.value === value}
                onPick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              />
            ))}
          </View>
        </Sheet>
      ) : null}
    </View>
  );
}
