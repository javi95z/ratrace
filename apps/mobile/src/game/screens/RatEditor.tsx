import { mayWear, prizeOf, RAT_COLOURS, RAT_LAYERS, ratSprite } from '@ratrace/core/game/avatar';
import type { RankId } from '@ratrace/content';
import type { RatColour, RatLayer, RatLook } from '@ratrace/core/game/avatar';
import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { PixelRatio, Pressable, ScrollView, View, type GestureResponderEvent, type ScrollViewInstance } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '../../ui/animations';
import { closeOnBack } from '../../ui/back';
import { useIsDesk } from '../../ui/desk';
import { Framed } from '../../ui/Frame';
import { useHaptic } from '../../ui/haptic';
import { onHardwareBack } from '../../ui/hardwareBack';
import { focusedMark, focusMarked, onKeys, tabStop } from '../../ui/keyboard';
import { Button, pressDown, Raised, usePress } from '../../ui/kit';
import { LinkText } from '../../ui/LinkText';
import { Sheet } from '../../ui/overlay';
import { SCREEN_TOP } from '../../ui/Page';
import { RAT_GROUND } from '../../ui/rat';
import { useDrawnFirst } from '../../ui/drawnFirst';
import { PerfDrawn } from '../../ui/perf';
import { choiceSprites, RatChoices, RatLayers, type RatChoice, type RatPlace } from '../../ui/RatAvatar';
import { readAhead } from '../../ui/spriteImages';
import { spriteOf } from '../../ui/sprites';
import { PixelText, ReadText } from '../../ui/text';
import { COLORS, EXTRA, GUTTER, SHELL_WIDTH, TOUCH } from '../../ui/theme';
import { useT } from '../context';
import { crispSize, CHOICES_SHARE, GAP, pagedLayout, placeOfChoice, stepChoice, wholeLayout, type PickerLayout } from './ratPicker';

/** Each colour, by the word for it: the key of each is written out. */
const COLOUR_NAME: Record<RatColour, string> = {
  gold: 'colours.gold',
  teal: 'colours.teal',
  wine: 'colours.wine',
  sky: 'colours.sky',
  coral: 'colours.coral',
  emerald: 'colours.emerald',
  cream: 'colours.cream',
  slate: 'colours.slate',
};

/** A part of the rat the player changes: one of its layers, or the colour of its ground. */
export type RatPart = RatLayer | 'colour';

/** Every part, in the row of them, all in sight at once: the rat itself, what it wears, what is behind it. */
export const RAT_PARTS: readonly RatPart[] = ['body', 'face', 'outfit', 'hat', 'eyes', 'backdrop', 'colour'];

/**
 * How each part's choices frame the rat, as shares of the choice's box (the web's `size-[125%] -ml-[16%] -mt-[6%]`: the rat that large, that far
 * left and up, cut by the box): the whole of it for the fur and what is behind it; closer, on the part itself, for what is worn: the whole rat shows
 * a hat, a pair of glasses or a collar too small to tell one from another.
 */
const FRAME: Record<RatLayer, { size: number; left: number; top: number }> = {
  body: { size: 1.25, left: -0.16, top: -0.06 },
  backdrop: { size: 1.25, left: -0.16, top: -0.06 },
  outfit: { size: 1.6, left: -0.34, top: -0.52 },
  hat: { size: 1.65, left: -0.42, top: 0 },
  face: { size: 2, left: -0.76, top: -0.62 },
  eyes: { size: 2, left: -0.76, top: -0.62 },
};
const placeOf = (layer: RatLayer, side: number): RatPlace => {
  const frame = FRAME[layer];
  return { x: frame.left * side, y: frame.top * side, w: frame.size * side, h: frame.size * side };
};

/**
 * The rat every choice is shown on: one fur, one face, nothing worn, on a plain ground. A choice shows what it offers, and stays as it is whatever
 * else the player picks; the rat as it will be is the big one above the choices.
 */
const BASE: RatLook = { colour: 'slate', body: 'brown', face: 'calm', outfit: null, hat: null, eyes: null, backdrop: null };

/** What a choice shows: the piece alone on the plain rat, nothing at all, or a colour. */
function shownOf(part: RatPart, key: string): RatLook {
  if (part === 'colour') return { ...BASE, colour: key as RatColour };
  return key === 'none' ? BASE : ({ ...BASE, [part]: key } as RatLook);
}

/** The piece each part's button in the row of parts shows: one that says the part at a glance. */
const ICON_PIECE: Record<RatLayer, string> = { body: 'brown', face: 'grin', outfit: 'suit', hat: 'tophat', eyes: 'sunglasses', backdrop: 'city' };
/** The colours the colour's button shows, four squares of them. */
const ICON_COLOURS: readonly RatColour[] = ['gold', 'teal', 'coral', 'sky'];

/** One choice of a part: a piece, nothing at all, or a colour. */
interface Choice {
  key: string;
  label: string;
  /** How it is won, when the player has not won it yet. */
  locked: string | null;
}

/** What stands round a choice's picture inside its square: the frame's padding and the picture's border, each side. */
const AROUND = 2 * 4 + 2 * 2;
/** How far into a choice its picture starts. */
const FRAMED = 4 + 2;
/** The cross of nothing worn: the web's `size-5`. */
const NONE_MARK = 20;
/** Room round a page of choices, so the gold ring of the one chosen (4 outside it) is never cut by the strip's edge. */
const EDGE = 6;
/** The row of parts' height, and the line of the part's name and its pages. */
const PARTS_HEIGHT = TOUCH;
const NAME_HEIGHT = 20;
/** Room between the editor's rows. */
const ROW_GAP = 10;
/** How far a finger goes sideways on the rat before it is a swipe; and how far the rat follows it, at most. */
const SWIPE = 32;
const FOLLOW = 48;
/** The editor's width at a desk: the rat on the left, the choices on the right. */
const DESK_EDITOR = 960;

/**
 * The player's rat, on a screen of its own, with no scroll: the rat large at the top, the row of its parts under it (the fur, the face, what it wears
 * on its body, its head and its eyes, what is behind it, the colour of its ground), and the choices of the part picked, two rows a page, paged
 * sideways. The rat swiped to the side wears the next choice of the part, or the one before (passing over a prize not won yet). A prize not won says
 * how it is won, in a sheet. Nothing is kept until Save: the way back leaves the rat as it was. At a desk the rat stands on the left and every choice
 * of the part on the right, with no pages. `part` is the part picked from the start (a scene's initial state).
 */
export function RatEditor({
  look,
  earned,
  rank,
  badgeName,
  rankName,
  onSave,
  onClose,
  part: first = 'body',
}: {
  look: RatLook;
  earned: Record<string, unknown>;
  rank: RankId;
  badgeName: (id: string) => string;
  rankName: (rank: RankId) => string;
  onSave: (next: RatLook) => void;
  onClose: () => void;
  part?: RatPart;
}) {
  const t = useT('player');
  const common = useT('common');
  const ranks = useT('rankings');
  const haptic = useHaptic();
  const desk = useIsDesk();
  const inset = useSafeAreaInsets();
  const [draft, setDraft] = useState(look);
  const [part, setPart] = useState<RatPart>(first);
  const [told, setTold] = useState<{ title: string; how: string } | null>(null);
  const [room, setRoom] = useState({ width: 0, height: 0 });

  // The way back leaves the rat as it was: the browser's Back on the web, Android's Back on the phone, as the arrow at the head does.
  const closing = useRef(onClose);
  useEffect(() => {
    closing.current = onClose;
  });
  useEffect(() => closeOnBack(() => closing.current()), []);
  useEffect(
    () =>
      onHardwareBack(() => {
        closing.current();
        return true;
      }),
    [],
  );

  /** The pieces of a layer that are drawn, and whether the player may wear each. */
  const piecesOf = (layer: RatLayer) =>
    (RAT_LAYERS[layer] as readonly string[]).filter((piece) => spriteOf(ratSprite(layer, piece)) !== null).map((piece) => ({ piece, open: mayWear(layer, piece, earned, rank) }));

  /** A rat put together by chance from what the player may wear: always a fur and a face, the rest worn or not. */
  const byChance = (): RatLook => {
    const any = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];
    const open = (layer: RatLayer) => piecesOf(layer).filter((one) => one.open).map((one) => one.piece);
    const maybe = (layer: RatLayer) => any([null, ...open(layer)]);
    return {
      ...draft,
      colour: any(RAT_COLOURS),
      body: any(open('body')) as RatLook['body'],
      face: any(open('face')) as RatLook['face'],
      outfit: maybe('outfit') as RatLook['outfit'],
      hat: maybe('hat') as RatLook['hat'],
      eyes: maybe('eyes') as RatLook['eyes'],
      backdrop: maybe('backdrop') as RatLook['backdrop'],
    };
  };

  const choicesOf = (of: RatPart): Choice[] => {
    if (of === 'colour') return RAT_COLOURS.map((colour) => ({ key: colour, label: t(COLOUR_NAME[colour]), locked: null }));
    const drawn: Choice[] = piecesOf(of).map(({ piece, open }) => {
      const prize = prizeOf(of, piece);
      const how = prize === null || open ? null : 'badge' in prize ? t('locked', { badge: badgeName(prize.badge) }) : t('lockedRank', { rank: rankName(prize.rank) });
      return { key: piece, label: t(`pieces.${of}.${piece}`), locked: how };
    });
    // A rat always has a fur and a face: only what it wears may be left off.
    return of === 'body' || of === 'face' ? drawn : [{ key: 'none', label: t('none'), locked: null }, ...drawn];
  };
  const keyOf = (of: RatPart, rat: RatLook): string => (of === 'colour' ? rat.colour : (rat[of] ?? 'none'));

  // Every part's pictures read ahead once the editor is on screen: a part picked for the first time then has them all, and is drawn at once.
  const shown = useDrawnFirst();
  const aheadOf = useRef(() => RAT_PARTS.flatMap((one) => choiceSprites(choicesOf(one).map((choice) => pictureOf(one, choice, 0, 0, 100)))));
  useEffect(() => {
    if (shown) readAhead(aheadOf.current());
  }, [shown]);

  // What a choice asks of the rat as it is when asked: the choices are drawn once, and their one callback reads the latest.
  const latest = useRef({ draft, part });
  useEffect(() => {
    latest.current = { draft, part };
  });
  const choose = useCallback(
    (of: RatPart, key: string, choice: { label: string; locked: string | null }) => {
      if (choice.locked !== null) {
        setTold({ title: choice.label, how: choice.locked });
        return;
      }
      const now = latest.current.draft;
      if (keyOf(of, now) === key) return;
      haptic('select');
      const value = of !== 'colour' && key === 'none' ? null : key;
      setDraft({ ...now, [of]: value } as RatLook);
    },
    [haptic],
  );

  const list = choicesOf(part);
  const chosenAt = Math.max(0, list.findIndex((choice) => choice.key === keyOf(part, draft)));
  /** The rat swiped (or stepped by a key, or a screen reader's adjustment) to the next choice of the part, or the one before. */
  const step = (way: 1 | -1) => {
    const to = stepChoice(list, chosenAt, way);
    if (to !== chosenAt) choose(part, list[to].key, list[to]);
  };
  const pickPart = (next: RatPart) => {
    if (next === part) return;
    haptic('select');
    setPart(next);
  };

  // How the editor's room is shared out, once it is laid out: on a phone the rat takes what the parts and two rows of choices leave; at a desk the
  // rat has the left of it, the parts and every choice the right.
  const { width, height } = room;
  const pickerWidth = desk ? Math.min(480, Math.floor(width / 2)) : width;
  const gridWidth = Math.max(0, pickerWidth - 2 * EDGE);
  const gridRoom = desk ? height - PARTS_HEIGHT - NAME_HEIGHT - 2 * ROW_GAP - 2 * EDGE : CHOICES_SHARE * height - 2 * EDGE;
  const layout = desk ? wholeLayout(gridWidth, gridRoom, list.length) : pagedLayout(gridWidth, gridRoom, list.length);
  const stripHeight = layout.rows * layout.tile + (layout.rows - 1) * GAP + 2 * EDGE;
  const ratRoom = desk ? Math.min(width - pickerWidth - 2 * ROW_GAP, height) : height - PARTS_HEIGHT - NAME_HEIGHT - stripHeight - 3 * ROW_GAP;
  const ratSize = crispSize(Math.max(0, Math.min(desk ? ratRoom : width - 2 * TOUCH, ratRoom) - 12), PixelRatio.get());
  const laidOut = width > 0 && height > 0;
  const column = desk ? DESK_EDITOR : SHELL_WIDTH;

  const stage = (
    <RatStage
      look={draft}
      size={ratSize}
      label={t(`layers.${part}`)}
      value={list[chosenAt]?.label ?? ''}
      onStep={step}
    />
  );
  const picker = (
    <View style={{ width: pickerWidth, gap: ROW_GAP }}>
      <PartBar label={t('layer')} value={part} width={pickerWidth} nameOf={(one) => t(`layers.${one}`)} onChange={pickPart} />
      <ChoiceStrip
        key={part}
        part={part}
        name={t(`layers.${part}`)}
        choices={list}
        chosen={chosenAt}
        layout={layout}
        width={pickerWidth}
        height={stripHeight}
        paged={!desk}
        onChoose={choose}
      />
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <PerfDrawn name={`player: ${part}`} />
      <View style={{ flex: 1, paddingLeft: inset.left, paddingRight: inset.right }}>
      <View style={{ flex: 1, width: '100%', maxWidth: column, alignSelf: 'center', paddingHorizontal: GUTTER, paddingTop: SCREEN_TOP, paddingBottom: 12, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Raised label={common('back')} bg="night-700" onPress={onClose} style={{ width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' }}>
            <PixelText size={18} tone="ink-200">{'←'}</PixelText>
          </Raised>
          <View accessibilityRole="header" style={{ flexShrink: 1 }}>
            <PixelText size={24} tone="gold-500">{t('rat')}</PixelText>
          </View>
        </View>
        <View
          testID="rat-editor"
          onLayout={(event) => {
            const { width: w, height: h } = event.nativeEvent.layout;
            setRoom((was) => (was.width === w && was.height === h ? was : { width: w, height: h }));
          }}
          style={{ flex: 1, minHeight: 0 }}
        >
          {/* Drawn from the start, for a screen reader; seen once its room is known. */}
          {desk ? (
            <View style={{ flex: 1, flexDirection: 'row', gap: 2 * ROW_GAP, opacity: laidOut ? 1 : 0 }}>
              <View style={{ flex: 1, minWidth: 0 }}>{stage}</View>
              <View style={{ justifyContent: 'center' }}>{picker}</View>
            </View>
          ) : (
            <View style={{ flex: 1, gap: ROW_GAP, opacity: laidOut ? 1 : 0 }}>
              <View style={{ height: Math.max(0, ratRoom) }}>{stage}</View>
              {picker}
            </View>
          )}
        </View>
      </View>
      </View>
      {/* The foot: the page's bottom bar (`BottomBar`), as wide as the editor's column. */}
      <View style={{ backgroundColor: COLORS['night-900'], paddingTop: 12, paddingBottom: Math.max(12, inset.bottom), paddingLeft: inset.left, paddingRight: inset.right }}>
        <View style={{ width: '100%', maxWidth: column, alignSelf: 'center', paddingHorizontal: GUTTER, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <ByChance
            label={t('byChance')}
            onPress={() => {
              haptic('select');
              setDraft(byChance());
            }}
          />
          <Button
            variant="primary"
            onPress={() => {
              haptic('confirm');
              onSave(draft);
              onClose();
            }}
          >
            {ranks('save')}
          </Button>
        </View>
      </View>
      <Sheet open={told !== null} onClose={() => setTold(null)} title={told?.title ?? ''} closeLabel={common('close')}>
        <ReadText size={15} tone="ink-200">{told?.how ?? ''}</ReadText>
      </Sheet>
    </View>
  );
}

/**
 * The rat as it will be, as large as its room lets every pixel of it be as sharp as the next, on the ground of its colour. Swiped sideways it wears
 * the next choice of the part picked (to the left) or the one before (to the right), following the finger a little as it goes (not under reduced
 * motion). A screen reader adjusts it as a slider of the part's choices, a keyboard by its arrows.
 */
function RatStage({ look, size, label, value, onStep }: { look: RatLook; size: number; label: string; value: string; onStep: (way: 1 | -1) => void }) {
  const still = useReducedMotion();
  const shift = useSharedValue(0);
  const moved = useAnimatedStyle(() => ({ transform: [{ translateX: shift.value }] }));
  const from = useRef<{ x: number; y: number } | null>(null);
  const pointOf = (event: GestureResponderEvent) => {
    const native = event.nativeEvent as unknown as { pageX?: number; pageY?: number; changedTouches?: ArrayLike<{ pageX: number; pageY: number }> };
    const touch = native.changedTouches?.[0] ?? native;
    return { x: touch.pageX ?? 0, y: touch.pageY ?? 0 };
  };
  const settle = () => {
    shift.value = still ? 0 : withTiming(0, { duration: 150 });
  };
  const keys = onKeys((event) => {
    const way = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (way === 0) return false;
    onStep(way);
    return true;
  });
  return (
    <View
      {...keys}
      focusable
      {...tabStop(true)}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: value }}
      aria-valuetext={value}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => onStep(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
      onTouchStart={(event) => {
        from.current = pointOf(event);
      }}
      onTouchMove={(event) => {
        if (from.current === null || still) return;
        const dx = pointOf(event).x - from.current.x;
        shift.value = Math.max(-FOLLOW, Math.min(FOLLOW, dx * 0.35));
      }}
      onTouchEnd={(event) => {
        const start = from.current;
        from.current = null;
        settle();
        if (start === null) return;
        const end = pointOf(event);
        const dx = end.x - start.x;
        if (Math.abs(dx) >= SWIPE && Math.abs(dx) > Math.abs(end.y - start.y)) onStep(dx < 0 ? 1 : -1);
      }}
      onTouchCancel={() => {
        from.current = null;
        settle();
      }}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
    >
      <View aria-hidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <PixelText size={18} tone="ink-300">{'‹'}</PixelText>
        <Animated.View style={moved}>
          <Framed kind="double" tone={{ ring: 'gold-500' }} style={{ backgroundColor: COLORS[RAT_GROUND[look.colour]] }}>
            <View style={{ width: size, height: size, overflow: 'hidden' }}>
              {size > 0 ? <RatLayers look={look} size={size} /> : null}
            </View>
          </Framed>
        </Animated.View>
        <PixelText size={18} tone="ink-300">{'›'}</PixelText>
      </View>
    </View>
  );
}

/**
 * The row of the rat's parts, every one in sight: a button each, showing the part on the plain rat (the colour as four squares of colours), the one
 * picked ringed in gold. A list of tabs, the arrows moving along it on the web.
 */
function PartBar({ label, value, width, nameOf, onChange }: { label: string; value: RatPart; width: number; nameOf: (part: RatPart) => string; onChange: (part: RatPart) => void }) {
  const count = RAT_PARTS.length;
  const cell = (width - (count - 1) * GAP) / count;
  const side = Math.max(0, Math.min(TOUCH - 4, cell - 4));
  const keys = onKeys((event) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0 && event.key !== 'Home' && event.key !== 'End') return false;
    const at = RAT_PARTS.indexOf(value);
    const next = event.key === 'Home' ? RAT_PARTS[0] : event.key === 'End' ? RAT_PARTS[count - 1] : RAT_PARTS[(at + step + count) % count];
    onChange(next);
    focusMarked('rat-part', next);
    return true;
  });
  // The parts' pictures on one canvas over the row, each in the middle of its cell; the colour's squares are views of their own.
  const top = (PARTS_HEIGHT - side) / 2;
  const pictures: RatChoice[] =
    side > 0
      ? RAT_PARTS.flatMap((part, i) => {
          if (part === 'colour') return [];
          const left = i * (cell + GAP) + (cell - side) / 2;
          const shown = shownOf(part, ICON_PIECE[part]);
          return [
            {
              x: left,
              y: top,
              side,
              ground: RAT_GROUND[shown.colour],
              rat: part === 'backdrop' ? null : { look: shown, place: placeOf(part, side) },
              backdrop: part === 'backdrop' ? shown.backdrop : null,
              faint: false,
              locked: false,
            },
          ];
        })
      : [];
  return (
    <View {...keys} accessibilityRole="tablist" accessibilityLabel={label} style={{ flexDirection: 'row', gap: GAP, height: PARTS_HEIGHT }}>
      {RAT_PARTS.map((part) => (
        <PartButton key={part} part={part} label={nameOf(part)} on={part === value} side={side} onPress={() => onChange(part)} />
      ))}
      {side > 0 ? <RatChoices width={width} height={PARTS_HEIGHT} choices={pictures} /> : null}
    </View>
  );
}

function PartButton({ part, label, on, side, onPress }: { part: RatPart; label: string; on: boolean; side: number; onPress: () => void }) {
  const press = usePress({ onPress });
  return (
    <Pressable
      {...{ dataSet: { ratPart: part } }}
      {...tabStop(on)}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      aria-selected={on}
      onPress={press}
      style={({ pressed }) => ({ ...pressDown(pressed), flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' })}
    >
      <Framed kind="raised" style={{ width: side, height: side, backgroundColor: COLORS['night-700'] }}>
        {part === 'colour' ? (
          <View aria-hidden style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap' }}>
            {ICON_COLOURS.map((colour) => (
              <View key={colour} style={{ width: '50%', height: '50%', backgroundColor: COLORS[RAT_GROUND[colour]] }} />
            ))}
          </View>
        ) : null}
      </Framed>
      {on ? <View pointerEvents="none" style={{ position: 'absolute', width: side + 8, height: side + 8, borderWidth: 2, borderColor: COLORS['gold-500'], pointerEvents: 'none' }} /> : null}
    </Pressable>
  );
}

/**
 * A choice's picture on its page's canvas, its square at `x`, `y` (inside its frame and border), on its ground: the piece on the plain rat (closer
 * on what is worn), a backdrop alone, or a colour's ground only; faint and locked where it is a prize not won yet.
 */
function pictureOf(part: RatPart, choice: Choice, x: number, y: number, tile: number): RatChoice {
  const shown = shownOf(part, choice.key);
  const side = tile - AROUND;
  const locked = choice.locked !== null;
  return {
    x: x + FRAMED,
    y: y + FRAMED,
    side,
    ground: RAT_GROUND[shown.colour],
    rat: part === 'colour' || part === 'backdrop' ? null : { look: shown, place: placeOf(part, side) },
    backdrop: part === 'backdrop' ? shown.backdrop : null,
    faint: locked,
    locked,
  };
}

/**
 * The choices of the part picked: under its name, two rows a page, paged sideways with a dot for each page (a phone), or every one of them at once
 * (a desk). A radio group: the arrows of the web's keyboard move along it (up and down by a row), passing over a prize not won yet; the page with the
 * one chosen is brought into sight (at once under reduced motion).
 */
function ChoiceStrip({
  part,
  name,
  choices,
  chosen,
  layout,
  width,
  height,
  paged,
  onChoose,
}: {
  part: RatPart;
  name: string;
  choices: Choice[];
  chosen: number;
  layout: PickerLayout;
  width: number;
  height: number;
  paged: boolean;
  onChoose: (part: RatPart, key: string, choice: Choice) => void;
}) {
  const still = useReducedMotion();
  const strip = useRef<ScrollViewInstance>(null);
  const [page, setPage] = useState(() => Math.floor(chosen / layout.perPage));
  const chosenPage = Math.floor(chosen / layout.perPage);
  // The page of the one chosen is in sight: from the start, and when a swipe of the rat or a key takes the choice to another page.
  const first = useRef(true);
  useEffect(() => {
    if (!paged || layout.tile <= 0) return;
    strip.current?.scrollTo({ x: chosenPage * width, animated: !first.current && !still });
    first.current = false;
    setPage(chosenPage);
  }, [chosenPage, paged, width, layout.tile, still]);

  const keys = onKeys((event) => {
    const focused = focusedMark('rat-choice');
    const from = Math.max(0, focused === null ? chosen : choices.findIndex((choice) => `${part}.${choice.key}` === focused));
    let to: number | null = null;
    if (event.key === 'ArrowRight') to = stepChoice(choices, from, 1);
    else if (event.key === 'ArrowLeft') to = stepChoice(choices, from, -1);
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const at = from + (event.key === 'ArrowDown' ? layout.columns : -layout.columns);
      to = at >= 0 && at < choices.length && choices[at].locked === null ? at : from;
    } else if (event.key === 'Home') to = stepChoice(choices, choices.length - 1, 1);
    else if (event.key === 'End') to = stepChoice(choices, 0, -1);
    if (to === null) return false;
    const choice = choices[to];
    onChoose(part, choice.key, choice);
    focusMarked('rat-choice', `${part}.${choice.key}`);
    return true;
  });

  const pages = Array.from({ length: layout.pages }, (_, at) => choices.slice(at * layout.perPage, (at + 1) * layout.perPage));
  const drawn = layout.tile > 0;
  const pageOf = (items: Choice[], at: number) => {
    const offset = at * layout.perPage;
    const pictures = drawn ? items.map((choice, i) => {
      const place = placeOfChoice(i, layout, width);
      return pictureOf(part, choice, EDGE + place.x, EDGE + place.y, layout.tile);
    }) : [];
    return (
      <View key={at} style={{ width, height }}>
        {items.map((choice, i) => {
          const place = placeOfChoice(i, layout, width);
          return (
            <ChoiceTile
              key={choice.key}
              part={part}
              choice={choice}
              on={offset + i === chosen}
              tile={layout.tile}
              left={EDGE + place.x}
              top={EDGE + place.y}
              onChoose={onChoose}
            />
          );
        })}
        {drawn ? <RatChoices width={width} height={height} choices={pictures} /> : null}
        {/* Nothing worn is said with a cross, over its picture: the rat without the piece looks much like the rest. */}
        {drawn && at === 0 && items[0]?.key === 'none' ? (
          <NoneMark left={EDGE + FRAMED + layout.tile - AROUND - 2 - NONE_MARK} top={EDGE + FRAMED + 2} />
        ) : null}
      </View>
    );
  };

  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: NAME_HEIGHT }}>
        <PixelText size={13} tone="ink-300" style={{ flexShrink: 1, textTransform: 'uppercase', letterSpacing: 13 * 0.05 }}>{name}</PixelText>
        {paged && layout.pages > 1 ? <PageDots count={layout.pages} at={page} /> : null}
      </View>
      <View role="tabpanel" aria-label={name}>
      <View {...keys} accessibilityRole="radiogroup" accessibilityLabel={name}>
        {paged ? (
          <ScrollView
            ref={strip}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={32}
            onScroll={(event) => {
              const at = Math.round(event.nativeEvent.contentOffset.x / Math.max(1, width));
              setPage((was) => (was === at ? was : at));
            }}
            style={{ width, height, flexGrow: 0 }}
          >
            {pages.map(pageOf)}
          </ScrollView>
        ) : (
          pageOf(choices, 0)
        )}
      </View>
      </View>
    </View>
  );
}

/** A dot for each page of choices, the one in sight lit: a picture only (the choices themselves are what a screen reader reads). */
function PageDots({ count, at }: { count: number; at: number }) {
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', gap: 6 }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} {...{ dataSet: { pageDot: i === at ? 'on' : 'off' } }} style={{ width: 6, height: 6, backgroundColor: COLORS[i === at ? 'gold-500' : 'night-600'] }} />
      ))}
    </View>
  );
}

/** The cross on the picture of nothing worn (the web's `absolute right-0.5 top-0.5 size-5 bg-night-900/85`, a bold ✕ of 13 in cream). */
function NoneMark({ left, top }: { left: number; top: number }) {
  return (
    <View aria-hidden pointerEvents="none" style={{ position: 'absolute', left, top, width: NONE_MARK, height: NONE_MARK, alignItems: 'center', justifyContent: 'center', backgroundColor: EXTRA.label, pointerEvents: 'none' }}>
      <ReadText size={13} weight={600} tone="cream" lineHeight={13}>{'✕'}</ReadText>
    </View>
  );
}

/**
 * A choice, as it is pressed and said: its frame and the border of its picture (the picture itself is its page's canvas's), the one chosen ringed in
 * gold, a prize not won yet said as such (pressed, it says how it is won). Drawn again only when it is chosen or let go, or its prize is won.
 */
const ChoiceTile = memo(function ChoiceTile({ part, choice, on, tile, left, top, onChoose }: { part: RatPart; choice: Choice; on: boolean; tile: number; left: number; top: number; onChoose: (part: RatPart, key: string, choice: Choice) => void }) {
  const press = usePress({ onPress: () => onChoose(part, choice.key, choice) });
  return (
    <Pressable
      {...{ dataSet: { ratChoice: `${part}.${choice.key}`, ...(choice.locked === null ? null : { locked: 'true' }) } }}
      {...tabStop(on)}
      accessibilityRole="radio"
      accessibilityLabel={choice.label}
      // How a prize is won, said after its name.
      accessibilityHint={choice.locked ?? undefined}
      accessibilityState={{ checked: on }}
      aria-checked={on}
      onPress={press}
      style={{ position: 'absolute', left, top, width: tile, height: tile }}
    >
      <Framed kind="raised" style={{ backgroundColor: COLORS['night-700'], padding: 4 }}>
        <View style={{ width: '100%', aspectRatio: 1, borderWidth: 2, borderColor: COLORS['night-900'] }} />
      </Framed>
      {on ? <View pointerEvents="none" style={{ position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, borderWidth: 2, borderColor: COLORS['gold-500'], pointerEvents: 'none' }} /> : null}
    </Pressable>
  );
});

/** The rat put together by chance: words underlined, 44 high and as wide as they are. */
function ByChance({ label, onPress }: { label: string; onPress: () => void }): ReactNode {
  const press = usePress({ onPress });
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={press} style={{ minHeight: TOUCH, flexShrink: 1, justifyContent: 'center', paddingRight: 12 }}>
      <LinkText size={14} offset={4} tone="ink-200">{label}</LinkText>
    </Pressable>
  );
}
