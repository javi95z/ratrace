import { Children, createContext, Fragment, memo, useContext, useEffect, useId, useRef, useState, type ReactNode, type Ref } from 'react';
import { Animated, Easing, Pressable, View, type HostInstance, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import type { Tone } from '@ratrace/core/game/present';
import { webBaseline } from './fonts';
import { Framed } from './Frame';
import { focusMarked, KeyboardHint, onKeys, tabStop, useKeyboardMode } from './keyboard';
import { CREAM, GOLD, WINE, type FrameCut, type FrameTone } from './frames';
import { Sprite } from './Sprite';
import { Language, PixelText, ReadText, TIGHT } from './text';
import { useTap } from './tap';
import { BODY, COLORS, TOUCH, type ColorToken } from './theme';

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
export const pressDown = (pressed: boolean): ViewStyle => ({ transform: [{ translateY: pressed ? 2 : 0 }] });

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

/**
 * The touch box of something small that is pressed (a line of small print, a tag, a link), made the 44 points a thumb needs inside its own layout,
 * taking no room: padding round it and a negative margin as large, so nothing round it moves. Its box then reaches past its place, and past its
 * parent's edge where it must: React Native looks for a touch past a parent's edge only where a child's box reaches there (a `hitSlop` past it is
 * never found, so none is used). `height` is how tall the thing is; `room` how far it may reach above and below before it would come over anything
 * else that takes a touch (the gap that is really there). It reaches half the way each side, a side short of room the rest on the other (whole
 * points in all). What neither side has room for is `short`: with `grow`, the thing takes that much more room in the layout, under it, so its box
 * is the 44 all the same; without, its box is short of 44, and the screen's test says so. Something 44 high or more reaches nothing.
 */
export function reach(height: number, room: { above: number; below: number }, { grow = false }: { grow?: boolean } = {}): { style: ViewStyle; top: number; bottom: number; short: number; box: number } {
  const need = Math.max(0, Math.ceil(TOUCH - height - 1e-9));
  if (need === 0) return { style: {}, top: 0, bottom: 0, short: 0, box: height };
  const above = Math.max(0, room.above);
  const below = Math.max(0, room.below);
  const bottom = Math.min(need - Math.min(need / 2, above), below);
  const top = Math.min(need - bottom, above);
  const short = need - top - bottom;
  const grown = grow ? short : 0;
  return {
    style: { paddingTop: top, paddingBottom: bottom + grown, marginTop: -top, marginBottom: -bottom },
    top,
    bottom,
    short,
    box: height + top + bottom + grown,
  };
}

/**
 * A pixel button. Never smaller than 44 pt, so a thumb can hit it. `size` and `padX` are the web's `text-[Npx]` and `px-N` where a screen gives
 * its Button its own (the basket's `px-3 text-[14px]`, the savings' `px-2 text-[13px]`): the web's Button takes a screen's in place of its own 17
 * and 16. `cell` is a button in a cell of a grid of
 * them (the web's `grid grid-cols-2 gap-2`, placed in a row): an equal share of the row, and as tall as the tallest in it, as the grid stretches it.
 * On the web (`ui/keyboard.web.tsx`): `primary` is the round's safe main action, which Ctrl/⌘ + Enter presses (the web's `data-primary-action`,
 * with its badge); `hint` is a shortcut's badge in its corner, the room for it kept on both sides once the player uses a keyboard, so the label stays
 * centred (the web's `padding-inline: 5.5rem`); `expanded` says that what it unfolds is open. None of it shows on a phone.
 */
export function Button({
  variant,
  wide = false,
  cell = false,
  disabled = false,
  size = 17,
  padX = 16,
  primary = false,
  hint,
  expanded,
  onPress,
  children,
}: PressProps & { variant: ButtonVariant; wide?: boolean; cell?: boolean; size?: number; padX?: number; primary?: boolean; hint?: ReactNode; expanded?: boolean }) {
  const { bg, fg, tone } = BUTTON[variant];
  const press = usePress({ onPress, disabled });
  const badge = primary ? <KeyboardHint>{'Ctrl/⌘ ↵'}</KeyboardHint> : (hint ?? null);
  // The badge's room, on both sides, once a keyboard is in use (it shows only then).
  const keyboard = useKeyboardMode() && badge !== null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, ...(expanded === undefined ? null : { expanded }) }}
      {...(expanded === undefined ? null : { 'aria-expanded': expanded })}
      {...(primary ? { dataSet: { primaryAction: true }, 'aria-keyshortcuts': 'Control+Enter Meta+Enter' } : null)}
      disabled={disabled}
      onPress={press}
      style={({ pressed }) => ({
        ...pressDown(pressed && !disabled),
        opacity: disabled ? 0.45 : 1,
        // Not wide, it is placed by its parent, as the web's inline-flex in a flex box: stretched in a column, hugging in a row.
        ...(wide ? { width: '100%' } : null),
        ...(cell ? { flex: 1, minWidth: 0 } : null),
      })}
    >
      <Framed
        kind="raised"
        tone={tone}
        style={{
          backgroundColor: COLORS[bg],
          minHeight: TOUCH,
          paddingHorizontal: keyboard ? Math.max(padX, 88) : padX,
          paddingVertical: 8,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          ...(cell ? { flexGrow: 1 } : null),
        }}
      >
        {setIn(children, (s) => (
          <PixelText size={size} tone={fg} style={{ textAlign: 'center' }}>{s}</PixelText>
        ))}
        {badge}
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
      style={({ pressed }) => ({ ...pressDown(pressed && !disabled), opacity: disabled ? 0.45 : 1 })}
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

/**
 * Anything pressed that stands off the page on a hard shadow: the web's `frame-raised` link or button, whatever is inside
 * it (a line of a menu, a square with an icon, a card that leads to a page). `tone` lights its frame (gold for the one
 * thing a screen most wants, cream for the choice made, wine for ending something), `bg` is its surface, `style` its own
 * look (padding, size, how it lays out what it holds; it is at least 44 high) and `place` where its parent puts it (a
 * share of a row, a width). `role` is what it is to a screen reader (`checked`, `selected` say what is on), `label` its
 * name where its words do not say it.
 */
export function Raised({
  onPress,
  role = 'button',
  label,
  language,
  checked,
  selected,
  expanded,
  disabled = false,
  tone = {},
  bg = 'night-600',
  style,
  place,
  testID,
  marks,
  tabbable,
  ref,
  children,
}: PressProps & {
  /** In a composite control on the web, whether it is the control's one Tab stop (the choice that is on); the arrows reach the rest. */
  tabbable?: boolean;
  /** Marks the keyboard finds it by on the web (`data-…`, react-native-web's `dataSet`): a row of the finances it moves among. */
  marks?: Record<string, string | number | boolean>;
  /** The pressable itself, for what asks something of the thing on screen (the screen reader's focus). */
  ref?: Ref<HostInstance>;
  role?: 'button' | 'link' | 'radio' | 'menuitem';
  label?: string;
  /** The language its words are in, where a screen reader would otherwise read them in the phone's (iOS; the web's `lang`). */
  language?: string;
  checked?: boolean;
  selected?: boolean;
  /** Whether what it opens is open (the web's `aria-expanded`): a menu's button. */
  expanded?: boolean;
  tone?: FrameTone;
  bg?: ColorToken;
  style?: ViewStyle;
  place?: ViewStyle;
  testID?: string;
}) {
  const press = usePress({ onPress, disabled });
  return (
    <Pressable
      ref={ref}
      {...(marks ? { dataSet: marks } : null)}
      {...(tabbable === undefined ? null : tabStop(tabbable))}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityLanguage={language}
      accessibilityState={{ disabled, ...(checked === undefined ? null : { checked }), ...(selected === undefined ? null : { selected }), ...(expanded === undefined ? null : { expanded }) }}
      {...(checked === undefined ? null : { 'aria-checked': checked })}
      {...(selected === undefined ? null : { 'aria-selected': selected })}
      {...(expanded === undefined ? null : { 'aria-expanded': expanded })}
      disabled={disabled}
      onPress={press}
      testID={testID}
      style={({ pressed }) => ({ ...pressDown(pressed && !disabled), opacity: disabled ? 0.45 : 1, ...place })}
    >
      <Framed kind="raised" tone={tone} style={{ backgroundColor: COLORS[bg], minHeight: TOUCH, ...style }}>
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
 * the panel for a screen reader. `tone` lights its frame in a colour (the web's `frame-gold`); `style` is where its parent places it.
 */
export function Panel({ children, title, label, tone, style }: { children: ReactNode; title?: Words; label?: string; tone?: FrameTone; style?: ViewStyle }) {
  const has = title !== undefined && title !== '';
  // Never `accessible`: on iOS that would fold the panel into one element and hide its buttons.
  // The name is only a label on the box; the screen reader reaches every child. As on the web: named only when given a label; named by its title where it has one, so the
  // title is said once, and by the label itself where it has none.
  const name = label === undefined ? undefined : has ? String(title) : label;
  return (
    <Framed
      kind="bevel"
      tone={tone}
      accessibilityLabel={name}
      style={{
        backgroundColor: COLORS['night-700'],
        padding: 12,
        ...(has ? { marginTop: 12, paddingTop: 20 } : null),
        ...style,
      }}
    >
      {has ? <TabTitle>{title}</TabTitle> : null}
      {children}
    </Framed>
  );
}

/**
 * A part of a `Panel` drawn across the rows of a list (the friends' panel under the ranking among friends, whose lines are rows of the page's list, so
 * that only those near the screen are drawn): the panel cut into stacked boxes with nothing between them (`FrameCut`). The top part has the title on
 * its tab and the panel's room above it; the bottom part the panel's room under it; `whole` is a panel of one part. Each part is the panel's 12 at its
 * sides and night-700, so the parts stacked are the one panel; what stands apart inside it is apart by the parts' own room (`style`), never by a gap
 * between them, which would show the page through the panel. A key of `style` left undefined is no room at all, never the panel's own taken away,
 * and the title's room (12 over the panel for its tab, 20 inside, as `Panel`'s) is the title's whatever `style` says.
 */
export function PanelPart({ part, title, children, style }: { part: FrameCut | 'whole'; title?: Words; children: ReactNode; style?: ViewStyle }) {
  const top = part === 'top' || part === 'whole';
  const bottom = part === 'bottom' || part === 'whole';
  const has = top && title !== undefined && title !== '';
  const own = Object.fromEntries(Object.entries(style ?? {}).filter(([, value]) => value !== undefined)) as ViewStyle;
  return (
    <Framed
      kind="bevel"
      cut={part === 'whole' ? undefined : part}
      style={{
        backgroundColor: COLORS['night-700'],
        paddingHorizontal: 12,
        ...(top ? { paddingTop: 12 } : null),
        ...(bottom ? { paddingBottom: 12 } : null),
        ...own,
        ...(has ? { marginTop: 12, paddingTop: 20 } : null),
      }}
    >
      {has ? <TabTitle>{title}</TabTitle> : null}
      {children}
    </Framed>
  );
}

/**
 * A few words in a frame of their own, for news or a warning (the web's `frame bg-wine-900 px-3 py-2 text-[14px]`): wine,
 * unless it is told another surface. `role` makes it a live region for a screen reader (`alert` for what has gone wrong,
 * `status` for what has happened); `center` centres the words.
 */
export function Notice({
  children,
  bg = 'wine-900',
  tone = 'cream',
  size = 14,
  role,
  center = false,
  style,
}: {
  children: string;
  bg?: ColorToken;
  tone?: ColorToken;
  size?: number;
  role?: 'alert' | 'status';
  center?: boolean;
  style?: ViewStyle;
}) {
  const body = (
    <Framed kind="frame" style={{ backgroundColor: COLORS[bg], paddingHorizontal: 12, paddingVertical: 8, ...style }}>
      <ReadText size={size} tone={tone} style={center ? { textAlign: 'center' } : undefined}>{children}</ReadText>
    </Framed>
  );
  return role ? (
    <View accessible role={role}>
      {body}
    </View>
  ) : (
    body
  );
}

const TONE: Record<Tone, { bg: ColorToken; fg: ColorToken }> = {
  good: { bg: 'teal-800', fg: 'cream' },
  bad: { bg: 'wine-700', fg: 'cream' },
  plain: { bg: 'night-600', fg: 'ink-200' },
};

/**
 * A small label that says what something does. Green helps, red costs. Its own width at the start of a column, as the web's inline block stands in a
 * block; `item` is a flex item of a row (the web's tag in an `items-center` row: beside a name, a rat, laurels), placed as the row places its items.
 */
export function Tag({ tone = 'plain', item = false, children }: { tone?: Tone; item?: boolean; children: Words }) {
  const { bg, fg } = TONE[tone];
  return (
    <View style={{ ...(item ? null : { alignSelf: 'flex-start' as const }), backgroundColor: COLORS[bg], paddingHorizontal: 6, paddingVertical: 2 }}>
      <PixelText size={12} tone={fg} lineHeight={12 * TIGHT}>{String(children)}</PixelText>
    </View>
  );
}

/**
 * A Tag that stands in a line of words, as the browser lays an inline block: the web's tag inline in a box of text (a reading 15 in the page's line
 * of 1.45 by default; `line` names another: the pixel cell of a Row's right), not a flex item of its own. The tag's baseline (its 2 of padding and
 * the pixel 12's in its line of 15) stands on the line's, and the box is as tall as the line and the tag make it together: in a reading 15, 21.75
 * with the tag a point down. Measured on the web's pages: the shop's tiles, the rung's status under the pay, the city lived in. A tag that is a flex
 * item of the web's (in a `flex flex-wrap` row of tags) is a `Tag`.
 */
export function LineTag({ tone, line = ['read', BODY.size, BODY.size * BODY.lineHeight], children }: { tone?: Tone; line?: readonly ['read' | 'pixel', number, number]; children: Words }) {
  const language = useContext(Language);
  const [role, size, height] = line;
  const strut = webBaseline(role, 400, size, height, language);
  const tag = 2 + webBaseline('pixel', 400, 12, 12 * TIGHT, language);
  const above = Math.max(strut, tag);
  return (
    <View style={{ height: above + Math.max(height - strut, 12 * TIGHT + 4 - tag), alignSelf: 'flex-start' }}>
      <View style={{ marginTop: above - tag }}>
        <Tag tone={tone}>{children}</Tag>
      </View>
    </View>
  );
}

/**
 * Where a row of tags (the web's `flex flex-wrap` of them) stands when the web holds it in an inline block of a line of words (a reading 15 in the
 * page's line of 1.45): the row's baseline is its first tag's, which stands on the line's, so the row is a point down and the box is never less than
 * the line, the strut's descent under the tags' baseline. A row of one line of tags is 2.75 shorter than its box; a row of two fills it below.
 */
export function useInlineRow(): ViewStyle {
  const language = useContext(Language);
  const strut = webBaseline('read', 400, BODY.size, BODY.size * BODY.lineHeight, language);
  const tag = 2 + webBaseline('pixel', 400, 12, 12 * TIGHT, language);
  const above = Math.max(strut, tag);
  return { paddingTop: above - tag, minHeight: above + BODY.size * BODY.lineHeight - strut };
}

/**
 * Words only a screen reader reads (the web's `sr-only`): in the tree, so a button is named by them, but clipped to a point and out of the flow,
 * so they take no room and no tap.
 */
export function SrOnly({ children }: { children: string }) {
  return (
    <View style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', pointerEvents: 'none' }}>
      <ReadText size={12}>{children}</ReadText>
    </View>
  );
}

/** Holds an icon or the picture of a thing straight on the surface it is on, with nothing behind it. */
export function Bare({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  // Placed as its parent places its children, as the web's inline-flex is in a flex box: centred in a Tile.
  return <View style={[{ flexShrink: 0, alignItems: 'center', justifyContent: 'center' }, style]}>{children}</View>;
}

/** A dark well, sunk into the page. It is the backdrop of a portrait; icons and things go in a `Bare`. `style` is its size (the web's `size-11`). */
export function Well({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <Framed
      kind="sunk"
      style={{ backgroundColor: COLORS['ink-900'], flexShrink: 0, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', ...style }}
    >
      {children}
    </Framed>
  );
}

/**
 * A line of a list: something on the left, something on the right. `size` is the size of the text it stands in (the web's Row takes its
 * parent's: a sheet of figures is `text-[14px]`); `style` is the web's `className` on it (the rule over a line that sums up the lines above).
 */
export function Row({ left, right, sub, size = BODY.size, style }: { left: ReactNode; right?: ReactNode; sub?: ReactNode; size?: number; style?: ViewStyle }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 6 }, style]}>
      <View style={{ flexShrink: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {setIn(left, (s) => <ReadText size={size} numberOfLines={1} style={{ flexShrink: 1 }}>{s}</ReadText>)}
        </View>
        {sub ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {setIn(sub, (s) => <ReadText size={12} tone="ink-300" numberOfLines={1} style={{ flexShrink: 1 }}>{s}</ReadText>)}
          </View>
        ) : null}
      </View>
      {right !== undefined ? (
        <View style={{ flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {setIn(right, (s) => <PixelText size={size} style={{ textAlign: 'right' }}>{s}</PixelText>)}
        </View>
      ) : null}
    </View>
  );
}

/**
 * A figure on the right of a `Row` in a colour of its own (the web's `<span className="text-…">` in a Row's `right`, which the Row sets in the pixel
 * face). Without `size` it is PixelText's own size (the body's 15, which is also a Row's), not whatever size the Row it stands in was given.
 */
export function Figure({ tone, size, children }: { tone: ColorToken; size?: number; children: string }) {
  return <PixelText size={size} tone={tone} style={{ textAlign: 'right' }}>{children}</PixelText>;
}

/**
 * Something done once from what is on screen (an order given from a sheet): done, a second press before the screen has gone (a double tap whose two
 * presses both land before React draws again) does nothing. Not done (an order the round refuses), it can be tried again. Armed afresh each time the
 * piece that holds it is mounted (a sheet opened again).
 */
export function useOnce(): (act: () => boolean) => boolean {
  const done = useRef(false);
  return (act) => {
    if (done.current) return false;
    done.current = act();
    return done.current;
  };
}

const FIGURE_TONE = { gold: 'gold-500', teal: 'teal-300', wine: 'wine-300', cream: 'cream' } as const satisfies Record<string, ColorToken>;

/**
 * The one figure a screen or a sheet is about: always this size and this gold, so the eye finds
 * it in the same place everywhere. A tone says when it is good news or bad.
 */
export function KeyFigure({ children, tone = 'gold' }: { children: Words; tone?: keyof typeof FIGURE_TONE }) {
  return (
    <PixelText size={28} tone={FIGURE_TONE[tone]} lineHeight={28} style={{ fontVariant: ['tabular-nums'] }}>
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
function statLook(width: number | null): { icon: boolean; size: number } {
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
 * `ref` is its box, for what asks where it stands on the screen (the cash, where coins land).
 */
export function Stat({
  icon,
  value,
  label,
  tone,
  hint,
  onOpen,
  style,
  ref,
}: {
  icon: string;
  value: Words;
  label: Words;
  tone?: 'good' | 'bad';
  hint?: string;
  onOpen?: () => void;
  style?: ViewStyle;
  ref?: Ref<HostInstance>;
}) {
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
        <ReadText size={11} tone="ink-200" numberOfLines={1} lineHeight={11 * TIGHT}>{String(label)}</ReadText>
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
      ref={ref}
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
          style={({ pressed }) => pressDown(pressed)}
        >
          <Framed kind="raised" style={{ ...box, minHeight: TOUCH }}>
            {body}
            {/* Out of the flow, so it takes no width from the number. */}
            <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', bottom: 2, right: 4 }}>
              <PixelText size={10} tone="ink-300" lineHeight={10}>▸</PixelText>
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
 * Drawn again only when one of the three changes: a line that holds it (a holding, a plan) is drawn again for its figures.
 */
export const TickerBadge = memo(function TickerBadge({ ticker, kind, logo }: { ticker: string; kind: keyof typeof BADGE; logo?: string }) {
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
});

interface Choice<T> {
  value: T;
  label: Words;
  disabled?: boolean;
  hint?: Words;
  /** A sprite drawn above the label. */
  icon?: string;
}

function Segment<T extends string | number>({ option, on, onChange, wide, mark }: { option: Choice<T>; on: boolean; onChange(value: T): void; wide: boolean; mark: string }) {
  const disabled = option.disabled ?? false;
  const press = usePress({ onPress: () => onChange(option.value), disabled });
  return (
    <Pressable
      {...{ dataSet: { segment: mark } }}
      {...tabStop(on)}
      accessibilityRole="radio"
      accessibilityState={{ checked: on, disabled }}
      aria-checked={on}
      disabled={disabled}
      onPress={press}
      style={({ pressed }) => ({ ...pressDown(pressed && !disabled), opacity: disabled ? 0.4 : 1, ...(wide ? { flex: 1, minWidth: 0 } : null) })}
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
          // Side by side the choices are as tall as the tallest, as the cells of the web's grid are.
          ...(wide ? { flexGrow: 1 } : null),
        }}
      >
        {option.icon ? (
          <View style={{ width: 36, height: 36, marginBottom: 4, alignItems: 'center', justifyContent: 'center' }}>
            <Sprite id={option.icon} />
          </View>
        ) : null}
        <PixelText size={14} tone={on ? 'ink-900' : 'ink-200'} style={{ textAlign: 'center' }}>{String(option.label)}</PixelText>
        {option.hint !== undefined ? (
          <ReadText size={11} tone={on ? 'ink-500' : 'ink-200'} lineHeight={11 * TIGHT} style={{ textAlign: 'center' }}>{String(option.hint)}</ReadText>
        ) : null}
      </Framed>
    </Pressable>
  );
}

/**
 * A row (or a column) of choices of which exactly one is on. `label` names the group for a screen reader. With `columns`
 * the choices are a grid of that many equal columns, as the web's `gridClassName` (`grid-cols-2`, `grid-cols-3` for the
 * rarities, `grid-cols-4` for the loan rates; `@min-[460px]:grid-cols-5` is only for a container wider than the phone's
 * 448): each row is as tall as its tallest choice, and a short last row leaves its columns empty, not wider.
 */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  orientation = 'horizontal',
  columns,
}: {
  label: string;
  options: Array<Choice<T>>;
  value: T;
  onChange(value: T): void;
  orientation?: 'horizontal' | 'vertical';
  columns?: number;
}) {
  const row = orientation === 'horizontal';
  // On the web the keyboard moves among them as the Next web's (docs/keyboard.md): one Tab stop, the choice that is on; the arrows of its way
  // (→ ← in a row or a grid, ↓ ↑ in a column), Home and End, each choosing an enabled one and giving it the focus.
  const group = useId();
  const markOf = (option: Choice<T>) => `${group}:${String(option.value)}`;
  const keys = onKeys((event) => {
    const forward = row ? event.key === 'ArrowRight' : event.key === 'ArrowDown';
    const backward = row ? event.key === 'ArrowLeft' : event.key === 'ArrowUp';
    if (!forward && !backward && event.key !== 'Home' && event.key !== 'End') return false;
    const enabled = options.filter((option) => !option.disabled);
    if (enabled.length === 0) return true;
    const at = Math.max(0, enabled.findIndex((option) => option.value === value));
    const next = event.key === 'Home' ? enabled[0] : event.key === 'End' ? enabled[enabled.length - 1] : enabled[(at + (forward ? 1 : -1) + enabled.length) % enabled.length];
    onChange(next.value);
    focusMarked('segment', markOf(next));
    return true;
  });
  const segment = (option: Choice<T>) => <Segment key={String(option.value)} option={option} on={option.value === value} onChange={onChange} wide mark={markOf(option)} />;
  if (columns !== undefined && columns > 0) {
    const rows: Array<Array<Choice<T>>> = [];
    for (let i = 0; i < options.length; i += columns) rows.push(options.slice(i, i + columns));
    return (
      <View {...keys} accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'column', gap: 8 }}>
        {rows.map((cells, r) => (
          <View key={r} style={{ flexDirection: 'row', gap: 8 }}>
            {cells.map(segment)}
            {Array.from({ length: columns - cells.length }, (_, i) => (
              <View key={`empty-${i}`} style={{ flex: 1, minWidth: 0 }} />
            ))}
          </View>
        ))}
      </View>
    );
  }
  return (
    <View
      {...keys}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{ flexDirection: row ? 'row' : 'column', gap: 8 }}
    >
      {options.map((option) => (
        <Segment key={String(option.value)} option={option} on={option.value === value} onChange={onChange} wide={row} mark={markOf(option)} />
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
      style={({ pressed }) => ({ ...pressDown(pressed && !disabled), opacity: disabled ? 0.4 : 1, width: '100%' })}
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
          {hint !== undefined ? <ReadText size={12} tone="ink-200" lineHeight={12 * TIGHT}>{String(hint)}</ReadText> : null}
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
