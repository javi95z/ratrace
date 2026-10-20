import { Children, Fragment, type ReactNode } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import type { Tone } from '@ratrace/core/game/present';
import { Framed } from './Frame';
import { GOLD, WINE, type FrameTone } from './frames';
import { PixelText, ReadText } from './text';
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
const sink = (pressed: boolean): ViewStyle => ({ transform: [{ translateY: pressed ? 2 : 0 }] });

interface PressProps {
  onPress: () => void;
  disabled?: boolean;
  children: ReactNode;
}

function usePress({ onPress, disabled }: Pick<PressProps, 'onPress' | 'disabled'>): () => void {
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
  // As on the web: named only when given a label; named by its title where it has one, so the
  // title is said once, and by the label itself where it has none.
  const name = label === undefined ? undefined : has ? String(title) : label;
  return (
    <Framed
      kind="bevel"
      accessible={name !== undefined}
      accessibilityRole={name !== undefined ? 'summary' : undefined}
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
      <PixelText size={12} tone={fg} style={{ lineHeight: 15 }}>{String(children)}</PixelText>
    </View>
  );
}

/** Holds an icon or the picture of a thing straight on the surface it is on, with nothing behind it. */
export function Bare({ children }: { children: ReactNode }) {
  return <View style={{ flexShrink: 0, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' }}>{children}</View>;
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
