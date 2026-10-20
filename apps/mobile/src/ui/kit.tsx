import { Children, createContext, Fragment, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import type { Tone } from '@ratrace/core/game/present';
import { Framed } from './Frame';
import { CREAM, GOLD, WINE, type FrameTone } from './frames';
import { Sprite } from './Sprite';
import { PixelText, ReadText, TIGHT } from './text';
import { useTap } from './tap';
import { COLORS, TOUCH, type ColorToken } from './theme';

/** Text a piece can carry: a number is a string to be set. */
type Words = string | number;

/**
 * Each string or number among the children is set in its own text; anything else (an icon, a sprite)
 * is placed as it is. React Native cannot hold a bare string outside a Text.
 */
function setIn(child: ReactNode, text: (s: string) => ReactNode): ReactNode[] {
  return Children.toArray(child).map((c, i) => (
    <Fragment key={i}>{typeof c === 'string' || typeof c === 'number' ? text(String(c)) : c}</Fragment>
  ));
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'quiet';

const BUTTON: Record<ButtonVariant, { bg: ColorToken; fg: ColorToken; tone: FrameTone }> = {
  // Gold is kept for the one thing a screen most wants the player to do.
  primary: { bg: 'gold-500', fg: 'ink-900', tone: GOLD },
  secondary: { bg: 'night-600', fg: 'cream', tone: {} },
  danger: { bg: 'wine-700', fg: 'cream', tone: WINE },
  quiet: { bg: 'night-700', fg: 'ink-200', tone: {} },
};

/** The web's `active:translate-y-[2px]`: the pressable, and the frame with it, sinks 2 pt while held. */
export const sink = (pressed: boolean): ViewStyle => ({ transform: [{ translateY: pressed ? 2 : 0 }] });

interface PressProps {
  onPress: () => void;
  disabled?: boolean;
  children: ReactNode;
}

export function usePress({ onPress, disabled }: Pick<PressProps, 'onPress' | 'disabled'>): () => void {
  const tap = useTap();
  return () => {
    if (disabled) return;
    tap();
    onPress();
  };
}

/** A pixel button. Never smaller than 44 pt, so a thumb can hit it. */
export function Button({ variant, wide = false, disabled = false, onPress, children }: PressProps & { variant: ButtonVariant; wide?: boolean }) {
  const { bg, fg, tone } = BUTTON[variant];
  const press = usePress({ onPress, disabled });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={press}
      style={({ pressed }) => ({
        ...sink(pressed && !disabled),
        opacity: disabled ? 0.45 : 1,
        ...(wide ? { width: '100%' } : { alignSelf: 'flex-start' }),
      })}
    >
      <Framed
        kind="raised"
        tone={tone}
        style={{
          backgroundColor: COLORS[bg],
          minHeight: TOUCH,
          paddingHorizontal: 16,
          paddingVertical: 8,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {setIn(children, (s) => (
          <PixelText size={17} tone={fg} style={{ textAlign: 'center' }}>{s}</PixelText>
        ))}
      </Framed>
    </Pressable>
  );
}

/**
 * Something to buy, as a tile in a grid: the same navy as every other surface, lit and raised
 * because it can be pressed. The picture inside sits straight on it, in a `Bare`.
 */
export function Tile({ onPress, disabled = false, children }: PressProps) {
  const press = usePress({ onPress, disabled });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={press}
      style={({ pressed }) => ({ ...sink(pressed && !disabled), opacity: disabled ? 0.45 : 1 })}
    >
      <Framed
        kind="raised"
        style={{
          backgroundColor: COLORS['night-600'],
          minHeight: TOUCH,
          padding: 8,
          alignItems: 'center',
          gap: 4,
        }}
      >
        {children}
      </Framed>
    </Pressable>
  );
}

/** The title of a panel: a gold tab that hangs over its top edge. */
export function TabTitle({ children }: { children: Words }) {
  return (
    <View pointerEvents="none" accessibilityRole="header" style={{ position: 'absolute', top: -12, left: 8, right: 8, flexDirection: 'row' }}>
      <Framed
        kind="tab"
        style={{ backgroundColor: COLORS['gold-500'], paddingHorizontal: 8, paddingTop: 4, paddingBottom: 2, flexShrink: 1 }}
      >
        <PixelText size={14} tone="ink-900" numberOfLines={1} style={{ letterSpacing: 1.4 }}>{String(children).toUpperCase()}</PixelText>
      </Framed>
    </View>
  );
}

/**
 * A navy panel with a lit pixel frame. With a title, the title hangs on a gold tab. `label` names
 * the panel for a screen reader.
 */
export function Panel({ children, title, label }: { children: ReactNode; title?: Words; label?: string }) {
  const has = title !== undefined && title !== '';
  // Never `accessible`: on iOS that would fold the panel into one element and hide its buttons.
  // The name is only a label on the box; the screen reader reaches every child. As on the web: named only when given a label; named by its title where it has one, so the
  // title is said once, and by the label itself where it has none.
  const name = label === undefined ? undefined : has ? String(title) : label;
  return (
    <Framed
      kind="bevel"
      accessibilityLabel={name}
      style={{
        backgroundColor: COLORS['night-700'],
        padding: 12,
        ...(has ? { marginTop: 12, paddingTop: 20 } : null),
      }}
    >
      {has ? <TabTitle>{title}</TabTitle> : null}
      {children}
    </Framed>
  );
}

const TONE: Record<Tone, { bg: ColorToken; fg: ColorToken }> = {
  good: { bg: 'teal-800', fg: 'cream' },
  bad: { bg: 'wine-700', fg: 'cream' },
  plain: { bg: 'night-600', fg: 'ink-200' },
};

/** A small label that says what something does. Green helps, red costs. */
export function Tag({ tone = 'plain', children }: { tone?: Tone; children: Words }) {
  const { bg, fg } = TONE[tone];
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: COLORS[bg], paddingHorizontal: 6, paddingVertical: 2 }}>
      <PixelText size={12} tone={fg} style={{ lineHeight: 12 * TIGHT }}>{String(children)}</PixelText>
    </View>
  );
}

/** Holds an icon or the picture of a thing straight on the surface it is on, with nothing behind it. */
export function Bare({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  // Placed as its parent places its children, as the web's inline-flex is in a flex box: centred in a Tile.
  return <View style={[{ flexShrink: 0, alignItems: 'center', justifyContent: 'center' }, style]}>{children}</View>;
}

/** A dark well, sunk into the page. It is the backdrop of a portrait; icons and things go in a `Bare`. */
export function Well({ children }: { children: ReactNode }) {
  return (
    <Framed
      kind="sunk"
      style={{ backgroundColor: COLORS['ink-900'], flexShrink: 0, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' }}
    >
      {children}
    </Framed>
  );
}

/** A line of a list: something on the left, something on the right. */
export function Row({ left, right, sub }: { left: ReactNode; right?: ReactNode; sub?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 6 }}>
      <View style={{ flexShrink: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {setIn(left, (s) => <ReadText numberOfLines={1} style={{ flexShrink: 1 }}>{s}</ReadText>)}
        </View>
        {sub ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {setIn(sub, (s) => <ReadText size={12} tone="ink-300" numberOfLines={1} style={{ flexShrink: 1 }}>{s}</ReadText>)}
          </View>
        ) : null}
      </View>
      {right !== undefined ? (
        <View style={{ flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {setIn(right, (s) => <PixelText style={{ textAlign: 'right' }}>{s}</PixelText>)}
        </View>
      ) : null}
    </View>
  );
}

const FIGURE_TONE = { gold: 'gold-500', teal: 'teal-300', wine: 'wine-300', cream: 'cream' } as const satisfies Record<string, ColorToken>;

/**
 * The one figure a screen or a sheet is about: always this size and this gold, so the eye finds
 * it in the same place everywhere. A tone says when it is good news or bad.
 */
export function KeyFigure({ children, tone = 'gold' }: { children: Words; tone?: keyof typeof FIGURE_TONE }) {
  return (
    <PixelText size={28} tone={FIGURE_TONE[tone]} style={{ lineHeight: 28, fontVariant: ['tabular-nums'] }}>
      {String(children)}
    </PixelText>
  );
}

/** The width of the row a Stat stands in, which is what the web's container queries ask. Null until measured. */
const StatRowWidth = createContext<{ width: number | null } | null>(null);

/**
 * The HUD's row of figures: three Stats of equal width. It measures itself and tells them how much
 * room there is, as the web's `@container` does, so a narrow phone drops the icons and shrinks the numbers.
 */
export function StatRow({ children }: { children: ReactNode }) {
  const [width, setWidth] = useState<number | null>(null);
  return (
    <StatRowWidth.Provider value={{ width }}>
      <View testID="stat-row" onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', gap: 6 }}>
        {children}
      </View>
    </StatRowWidth.Provider>
  );
}

/** The web's rules for a figure by the width of its container (all inclusive at the top): icon gone to 340, 14 pt to 357, 15 pt to 371. */
export function statLook(width: number | null): { icon: boolean; size: number } {
  if (width === null) return { icon: true, size: 16 };
  if (width <= 340) return { icon: false, size: 16 };
  if (width <= 357) return { icon: true, size: 14 };
  if (width <= 371) return { icon: true, size: 15 };
  return { icon: true, size: 16 };
}

const STAT_TONE = { good: 'teal-300', bad: 'wine-300' } as const satisfies Record<string, ColorToken>;

/**
 * One figure of the HUD: an icon, a number, and what the number is. Inside a container too narrow
 * for three of them side by side, the icon steps aside. The container is the `StatRow` it stands in;
 * alone, it measures itself. With `onOpen` it is a raised button that opens what the figure means.
 */
export function Stat({ icon, value, label, tone, hint, onOpen, style }: { icon: string; value: Words; label: Words; tone?: 'good' | 'bad'; hint?: string; onOpen?: () => void; style?: ViewStyle }) {
  const row = useContext(StatRowWidth);
  // Until the first measure the icon is shown, as on a roomy phone.
  const [own, setOwn] = useState<number | null>(null);
  const { icon: showIcon, size } = statLook(row ? row.width : own);
  const press = usePress({ onPress: onOpen ?? (() => {}), disabled: false });
  const said = [`${String(value)}, ${String(label)}`, hint].filter(Boolean).join('. ');
  const body = (
    <>
      {showIcon ? (
        <View style={{ width: 32, height: 32, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}>
          <Sprite id={icon} />
        </View>
      ) : null}
      <View style={{ flexShrink: 1, minWidth: 0 }}>
        <PixelText size={size} tone={tone ? STAT_TONE[tone] : 'cream'} numberOfLines={1} tracking={false}>
          {String(value)}
        </PixelText>
        <ReadText size={11} tone="ink-200" numberOfLines={1} style={{ lineHeight: 11 * TIGHT }}>{String(label)}</ReadText>
      </View>
    </>
  );
  const box: ViewStyle = {
    backgroundColor: COLORS['night-700'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 4,
    ...(showIcon ? null : { paddingHorizontal: 8 }),
  };
  return (
    <View
      testID="stat"
      style={[{ minWidth: 0 }, row ? { flex: 1 } : null, style]}
      onLayout={row ? undefined : (e: LayoutChangeEvent) => setOwn(e.nativeEvent.layout.width)}
    >
      {onOpen ? (
        // One that opens something stands off the page like every other thing that can be pressed.
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={said}
          onPress={press}
          style={({ pressed }) => sink(pressed)}
        >
          <Framed kind="raised" style={{ ...box, minHeight: TOUCH }}>
            {body}
            {/* Out of the flow, so it takes no width from the number. */}
            <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', bottom: 2, right: 4 }}>
              <PixelText size={10} tone="ink-300" style={{ lineHeight: 10 }}>▸</PixelText>
            </View>
          </Framed>
        </Pressable>
      ) : (
        // Nothing inside can be pressed, so it reads as one thing.
        <View accessible accessibilityLabel={said}>
          <Framed kind="bevel" style={box}>{body}</Framed>
        </View>
      )}
    </View>
  );
}

/** The colours of a lit lamp: its light, bright along the top and deep along the bottom. */
const LAMP = {
  gold: { base: 'gold-500', hi: 'gold-200', lo: 'gold-700' },
  teal: { base: 'teal-300', hi: 'sky-100', lo: 'teal-600' },
} as const satisfies Record<string, { base: ColorToken; hi: ColorToken; lo: ColorToken }>;

const LAMPS = 16;

/**
 * A track of sixteen lamps that light from the left. With `door`, the track ends at a door: the
 * way out of the rat race, which stands open once the last lamp is lit.
 */
export function Bar({ value, max, label, tone = 'gold', door = false }: { value: number; max: number; label: string; tone?: 'gold' | 'teal'; door?: boolean }) {
  const share = max <= 0 ? (value > 0 ? 1 : 0) : Math.max(0, Math.min(1, value / max));
  const filled = Math.floor(share * LAMPS + 1e-9);
  const open = filled === LAMPS;
  const lamp = LAMP[tone];
  return (
    // The web's `frame sunk`: both utilities set the box-shadow and `sunk` comes later, so only the sunk edge is drawn.
    <Framed
      kind="sunk"
      style={{ backgroundColor: COLORS['night-900'], padding: 3, flexDirection: 'row', alignItems: 'center', gap: 2 }}
    >
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(share * 100) }}
        aria-valuenow={Math.round(share * 100)}
        // The gaps between the lamps are the well showing through.
        style={{ flex: 1, minWidth: 0, flexDirection: 'row', gap: 2, height: 10 }}
      >
        {Array.from({ length: LAMPS }, (_, i) =>
          i < filled ? (
            <Framed key={i} testID="lamp-lit" kind="lamp" tone={{ hi: lamp.hi, lo: lamp.lo }} style={{ flex: 1, backgroundColor: COLORS[lamp.base] }} />
          ) : (
            <View key={i} testID="lamp-dark" style={{ flex: 1, backgroundColor: COLORS['night-600'] }} />
          ),
        )}
      </View>
      {door ? (
        // A door drawn in six pixels: a leaf, its frame, and a gold handle. Open, it is all light.
        <View
          testID="door"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          {...{ dataSet: { state: open ? 'open' : 'shut' } }}
          // The web's column of 14, the door 2 in from its left: 12 wide, 14 tall.
          style={{ width: 12, height: 14, marginLeft: 2, backgroundColor: COLORS[open ? 'gold-200' : 'teal-600'] }}
        >
          {open ? null : (
            <>
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: COLORS['teal-800'] }} />
              <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: COLORS['teal-800'] }} />
              <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 2, backgroundColor: COLORS['teal-800'] }} />
              <View style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 2, backgroundColor: COLORS['teal-800'] }} />
              <View style={{ position: 'absolute', right: 3, top: 6, width: 2, height: 2, backgroundColor: COLORS['gold-200'] }} />
            </>
          )}
        </View>
      ) : null}
    </Framed>
  );
}

const BADGE = {
  bond: { bg: 'sky-500', fg: 'cream', hi: 'sky-300', lo: 'night-500' },
  equity: { bg: 'teal-800', fg: 'cream', hi: 'teal-600', lo: 'night-800' },
  crypto: { bg: 'gold-700', fg: 'ink-900', hi: 'gold-500', lo: 'gold-900' },
  gold: { bg: 'gold-500', fg: 'ink-900', hi: 'gold-200', lo: 'gold-700' },
} as const satisfies Record<string, { bg: ColorToken; fg: ColorToken; hi: ColorToken; lo: ColorToken }>;

/**
 * An asset by its look: its brand mark on its own where it has one, its ticker on the colour of
 * its class where it has not. The name is always written beside it, so the mark is decoration.
 */
export function TickerBadge({ ticker, kind, logo }: { ticker: string; kind: keyof typeof BADGE; logo?: string }) {
  const frame: ViewStyle = { width: 56, height: 36, flexShrink: 0, alignItems: 'center', justifyContent: 'center' };
  if (logo) {
    return (
      <View style={frame}>
        <Sprite id={logo} />
      </View>
    );
  }
  const look = BADGE[Object.hasOwn(BADGE, kind) ? kind : 'equity'];
  return (
    <Framed kind="lamp" tone={{ hi: look.hi, lo: look.lo }} style={{ ...frame, backgroundColor: COLORS[look.bg] }}>
      <PixelText size={14} tone={look.fg} numberOfLines={1}>{ticker}</PixelText>
    </Framed>
  );
}

interface Choice<T> {
  value: T;
  label: Words;
  disabled?: boolean;
  hint?: Words;
  /** A sprite drawn above the label. */
  icon?: string;
}

function Segment<T extends string | number>({ option, on, onChange, wide }: { option: Choice<T>; on: boolean; onChange(value: T): void; wide: boolean }) {
  const disabled = option.disabled ?? false;
  const press = usePress({ onPress: () => onChange(option.value), disabled });
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: on, disabled }}
      aria-checked={on}
      disabled={disabled}
      onPress={press}
      style={({ pressed }) => ({ ...sink(pressed && !disabled), opacity: disabled ? 0.4 : 1, ...(wide ? { flex: 1, minWidth: 0 } : null) })}
    >
      <Framed
        kind="raised"
        tone={on ? CREAM : {}}
        style={{
          backgroundColor: COLORS[on ? 'cream' : 'night-600'],
          minHeight: TOUCH,
          paddingHorizontal: 4,
          paddingVertical: 6,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {option.icon ? (
          <View style={{ width: 36, height: 36, marginBottom: 4, alignItems: 'center', justifyContent: 'center' }}>
            <Sprite id={option.icon} />
          </View>
        ) : null}
        <PixelText size={14} tone={on ? 'ink-900' : 'ink-200'} style={{ textAlign: 'center' }}>{String(option.label)}</PixelText>
        {option.hint !== undefined ? (
          <ReadText size={11} tone={on ? 'ink-500' : 'ink-200'} style={{ textAlign: 'center', lineHeight: 11 * TIGHT }}>{String(option.hint)}</ReadText>
        ) : null}
      </Framed>
    </Pressable>
  );
}

/** A row (or a column) of choices of which exactly one is on. `label` names the group for a screen reader. */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  orientation = 'horizontal',
}: {
  label: string;
  options: Array<Choice<T>>;
  value: T;
  onChange(value: T): void;
  orientation?: 'horizontal' | 'vertical';
}) {
  const row = orientation === 'horizontal';
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{ flexDirection: row ? 'row' : 'column', gap: 8 }}
    >
      {options.map((option) => (
        <Segment key={String(option.value)} option={option} on={option.value === value} onChange={onChange} wide={row} />
      ))}
    </View>
  );
}

/** An on/off switch with its label, the whole row pressable. `icon` is a sprite shown before the label. */
export function Toggle({ on, onChange, label, hint, disabled = false, icon }: { on: boolean; onChange(on: boolean): void; label: Words; hint?: Words; disabled?: boolean; icon?: string }) {
  const press = usePress({ onPress: () => onChange(!on), disabled });
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled }}
      aria-checked={on}
      disabled={disabled}
      onPress={press}
      style={({ pressed }) => ({ ...sink(pressed && !disabled), opacity: disabled ? 0.4 : 1, width: '100%' })}
    >
      <Framed
        kind="raised"
        style={{
          backgroundColor: COLORS['night-600'],
          minHeight: TOUCH,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 8,
          paddingRight: 12,
          paddingLeft: icon ? 8 : 12,
        }}
      >
        {icon ? (
          <View style={{ width: 36, height: 36, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}>
            <Sprite id={icon} />
          </View>
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <PixelText size={15}>{String(label)}</PixelText>
          {hint !== undefined ? <ReadText size={12} tone="ink-200" style={{ lineHeight: 12 * TIGHT }}>{String(hint)}</ReadText> : null}
        </View>
        {/* `frame sunk` on the web, where the later `sunk` wins: a sunk edge and no outline. */}
        <Framed
          kind="sunk"
          testID="switch"
          style={{ width: 40, height: 20, flexShrink: 0, backgroundColor: COLORS[on ? 'teal-600' : 'night-900'] }}
        >
          <Knob on={on} />
        </Framed>
      </Framed>
    </Pressable>
  );
}

/** The switch's knob: it slides between its two sides in 150 ms, as the web's `transition-[left]`; on first draw it is simply there. */
function Knob({ on }: { on: boolean }) {
  const left = useRef(new Animated.Value(on ? 20 : 0)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const run = Animated.timing(left, { toValue: on ? 20 : 0, duration: 150, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: false });
    run.start();
    return () => run.stop();
  }, [on, left]);
  return (
    <Animated.View testID="knob" style={{ position: 'absolute', top: 0, left, width: 20, height: 20, backgroundColor: COLORS.cream }}>
      <Framed kind="lamp" tone={{ hi: 'white', lo: 'ink-200' }} style={{ width: 20, height: 20, backgroundColor: COLORS.cream }} />
    </Animated.View>
  );
}
