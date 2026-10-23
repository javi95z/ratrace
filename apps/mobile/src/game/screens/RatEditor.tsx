import { mayWear, prizeOf, RAT_COLOURS, RAT_LAYERS, ratSprite } from '@ratrace/core/game/avatar';
import type { RankId } from '@ratrace/content';
import type { RatColour, RatLayer, RatLook } from '@ratrace/core/game/avatar';
import { Fragment, memo, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Framed } from '../../ui/Frame';
import { reach, usePress } from '../../ui/kit';
import { LinkText } from '../../ui/LinkText';
import { Tabs } from '../../ui/overlay';
import { RAT_GROUND } from '../../ui/rat';
import { useDrawnFirst } from '../../ui/drawnFirst';
import { PerfDrawn } from '../../ui/perf';
import { choiceSprites, RatChoices, RatLayers, type RatChoice, type RatPlace } from '../../ui/RatAvatar';
import { readAhead } from '../../ui/spriteImages';
import { spriteOf } from '../../ui/sprites';
import { StickyPart } from '../../ui/Sticky';
import { PixelText, ReadText } from '../../ui/text';
import { COLORS, EXTRA, TOUCH } from '../../ui/theme';
import { layoutTop } from '../../ui/layoutTop';
import { useT } from '../context';

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

type Part = RatLayer | 'colour';

/** The parts in three tabs: the rat itself, what it wears, and what is behind it. */
export type RatGroup = 'body' | 'wear' | 'scene';
const GROUPS: Record<RatGroup, Part[]> = { body: ['body', 'face'], wear: ['outfit', 'hat', 'eyes'], scene: ['backdrop', 'colour'] };
const GROUP_IDS = Object.keys(GROUPS) as RatGroup[];

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
 * The rat every choice is shown on: one fur, one face, nothing worn, on a plain ground. A choice
 * shows what it offers, and stays as it is whatever else the player picks; the rat as it will be is
 * the one above the choices.
 */
const BASE: RatLook = { colour: 'slate', body: 'brown', face: 'calm', outfit: null, hat: null, eyes: null, backdrop: null };

/** What a choice shows: the piece alone on the plain rat, nothing at all, or a colour. */
function shownOf(part: Part, key: string): RatLook {
  if (part === 'colour') return { ...BASE, colour: key as RatColour };
  return key === 'none' ? BASE : ({ ...BASE, [part]: key } as RatLook);
}

/** One choice of a part: a piece, nothing at all, or a colour. */
interface Choice {
  key: string;
  label: string;
  /** How it is won, when the player has not won it yet. */
  locked: string | null;
}

/** The web's grid of five (`grid-cols-5 gap-1.5`): this many to a row, this far apart. */
const COLUMNS = 5;
const GAP = 6;
/** What stands round a choice's picture inside its width: the web's `p-1` and the picture's `border-2`, each side. */
const AROUND = 2 * 4 + 2 * 2;

/**
 * The player's rat, a part at a time: its fur, what it wears, what it has on its face and head, what
 * is behind it and the colour of its ground. Each choice shows the rat as it would be. A piece kept
 * for a badge shows how it is won; a piece not drawn yet is not offered. `tab` is the tab open from the start (a scene's initial state; the
 * player opens the others by a tap).
 */
export function RatEditor({
  look,
  earned,
  rank,
  badgeName,
  rankName,
  onPick,
  onLocked,
  tab: first = 'body',
}: {
  look: RatLook;
  earned: Record<string, unknown>;
  rank: RankId;
  badgeName: (id: string) => string;
  rankName: (rank: RankId) => string;
  onPick: (next: RatLook) => void;
  onLocked: (message: string) => void;
  tab?: RatGroup;
}) {
  const t = useT('player');
  const [group, setGroup] = useState<RatGroup>(first);
  // How wide the tab is, laid out (five choices to a row of it), and how far down it each part's grid stands: where the tab's canvas draws each
  // choice. Kept across the tabs, so a tab shown again is drawn where it was at once.
  const [width, setWidth] = useState(0);
  const [tops, setTops] = useState<Partial<Record<Part, number>>>({});

  /** The pieces of a layer that are drawn, and whether the player may wear each. */
  const piecesOf = (layer: RatLayer) =>
    (RAT_LAYERS[layer] as readonly string[]).filter((piece) => spriteOf(ratSprite(layer, piece)) !== null).map((piece) => ({ piece, open: mayWear(layer, piece, earned, rank) }));

  /** A rat put together by chance from what the player may wear: always a fur and a face, the rest worn or not. */
  const byChance = (): RatLook => {
    const any = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];
    const open = (layer: RatLayer) => piecesOf(layer).filter((one) => one.open).map((one) => one.piece);
    const maybe = (layer: RatLayer) => any([null, ...open(layer)]);
    return {
      ...look,
      colour: any(RAT_COLOURS),
      body: any(open('body')) as RatLook['body'],
      face: any(open('face')) as RatLook['face'],
      outfit: maybe('outfit') as RatLook['outfit'],
      hat: maybe('hat') as RatLook['hat'],
      eyes: maybe('eyes') as RatLook['eyes'],
      backdrop: maybe('backdrop') as RatLook['backdrop'],
    };
  };

  const choices = (part: Part): Choice[] => {
    if (part === 'colour') return RAT_COLOURS.map((colour) => ({ key: colour, label: t(COLOUR_NAME[colour]), locked: null }));
    const drawn: Choice[] = piecesOf(part).map(({ piece, open }) => {
      const prize = prizeOf(part, piece);
      const how = prize === null || open ? null : 'badge' in prize ? t('locked', { badge: badgeName(prize.badge) }) : t('lockedRank', { rank: rankName(prize.rank) });
      return { key: piece, label: t(`pieces.${part}.${piece}`), locked: how };
    });
    // A rat always has a fur and a face: only what it wears may be left off.
    return part === 'body' || part === 'face' ? drawn : [{ key: 'none', label: t('none'), locked: null }, ...drawn];
  };
  const chosen = (part: Part, key: string) => (part === 'colour' ? look.colour === key : (look[part] ?? 'none') === key);

  // Every tab's pictures read ahead once the first tab is on screen: a tab pressed for the first time then has them all, and is drawn at once rather
  // than after its forty-odd pictures are read (part of its first drawing's 110 ms, measured). Once: the pictures of a tab do not change with a pick.
  const shown = useDrawnFirst();
  const aheadOf = useRef(() => GROUP_IDS.flatMap((tab) => choiceSprites(GROUPS[tab].flatMap((part) => choices(part).map((choice, i) => pictureOf(part, choice, i, 0, 0))))));
  useEffect(() => {
    if (shown) readAhead(aheadOf.current());
  }, [shown]);

  // What a press asks of the rat as it is when pressed: the choices are drawn once, and their one callback reads the latest.
  const latest = useRef({ look, onPick, onLocked });
  useEffect(() => {
    latest.current = { look, onPick, onLocked };
  });
  const choose = useCallback((part: Part, key: string, locked: string | null) => {
    const now = latest.current;
    if (locked !== null) return now.onLocked(locked);
    const value = part !== 'colour' && key === 'none' ? null : key;
    now.onPick({ ...now.look, [part]: value } as RatLook);
  }, []);

  // The choices of the tab, part by part, and the one canvas their pictures are drawn on: each choice's box where the grid lays it out, five to a
  // row of the tab's width, each part's grid as far down the tab as it was laid out. Nothing is drawn until both are known.
  const parts = GROUPS[group].map((part) => ({ part, choices: choices(part) }));
  const tile = width > 0 ? (width - (COLUMNS - 1) * GAP) / COLUMNS : 0;
  const side = Math.max(0, tile - AROUND);
  const placed = tile > 0 && parts.every(({ part }) => tops[part] !== undefined);
  const pictures: RatChoice[] = placed ? parts.flatMap(({ part, choices: list }) => list.map((choice, i) => pictureOf(part, choice, i, tops[part] as number, tile))) : [];
  const height = placed ? Math.max(...parts.map(({ part, choices: list }) => (tops[part] as number) + heightOf(list.length, tile))) : 0;
  const laid = (part: Part, y: number) => setTops((was) => (was[part] === y ? was : { ...was, [part]: y }));

  return (
    <StickyPart
      gap={12}
      head={
        // The rat as it will be, and the tabs, held at the top of the screen while the choices scroll under them: the rat as tall as the tabs, framed
        // as they are, then the game's own tabs.
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS['night-700'] }}>
          <View aria-hidden importantForAccessibility="no-hide-descendants" style={{ flexShrink: 0 }}>
            {/* The frame's strips stand outside its box, as the web's box-shadow does: what is clipped is the rat inside it, never the frame. */}
            <Framed kind="raised" style={{ width: TOUCH, height: TOUCH, backgroundColor: COLORS[RAT_GROUND[look.colour]] }}>
              <View style={{ width: TOUCH, height: TOUCH, overflow: 'hidden' }}>
                <RatLayers look={look} size={TOUCH} />
              </View>
            </Framed>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Tabs<RatGroup> label={t('layer')} tabs={GROUP_IDS.map((id) => ({ id, label: t(`groups.${id}`) }))} value={group} onChange={setGroup} />
          </View>
        </View>
      }
    >
      <PerfDrawn name={`player: ${group}`} />
      {/* Each part of the tab under its own name, its choices beneath: the names and the grids side by side in the panel, so each grid says where it
          stands in it. Over them the one canvas of their pictures, which takes no touch: a press reaches the choice under it. */}
      <View role="tabpanel" accessibilityLabel={t(`groups.${group}`)} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {parts.map(({ part, choices: list }, at) => (
          <Fragment key={part}>
            <PixelText size={13} tone="ink-300" style={{ marginTop: at === 0 ? 0 : 12, textTransform: 'uppercase', letterSpacing: 13 * 0.05 }}>{t(`layers.${part}`)}</PixelText>
            <ChoicesOf part={part} label={t(`layers.${part}`)} choices={list} chosen={(key) => chosen(part, key)} tile={tile} onChoose={choose} onLaid={laid} />
          </Fragment>
        ))}
        {placed ? <RatChoices width={width} height={height} choices={pictures} /> : null}
        {/* Nothing worn is said with a cross, over its picture: the rat without the piece looks much like the rest. */}
        {placed
          ? parts.flatMap(({ part, choices: list }) =>
              list[0]?.key === 'none' ? [<NoneMark key={`none-${part}`} left={FRAMED + side - 2 - NONE_MARK} top={(tops[part] as number) + FRAMED + 2} />] : [],
            )
          : null}
      </View>
      <ByChance label={t('byChance')} onPress={() => onPick(byChance())} />
    </StickyPart>
  );
}

/** How far into a choice its picture starts: the web's `p-1` and the picture's `border-2`. */
const FRAMED = 4 + 2;
/** The cross of nothing worn: the web's `size-5`. */
const NONE_MARK = 20;

/** How tall a part's grid of `count` choices is, each `tile` square, in rows of five `GAP` apart. */
const heightOf = (count: number, tile: number): number => {
  const rows = Math.ceil(count / COLUMNS);
  return rows * tile + Math.max(0, rows - 1) * GAP;
};

/**
 * A choice's picture on the tab's canvas: in its box (the choice's place in its grid, inside its frame and border), on its ground: the piece on the
 * plain rat (closer on what is worn), a backdrop alone, or a colour's ground only; faint and locked where it is a prize not won yet.
 */
function pictureOf(part: Part, choice: Choice, index: number, top: number, tile: number): RatChoice {
  const shown = shownOf(part, choice.key);
  const side = tile - AROUND;
  const locked = choice.locked !== null;
  return {
    x: (index % COLUMNS) * (tile + GAP) + FRAMED,
    y: top + Math.floor(index / COLUMNS) * (tile + GAP) + FRAMED,
    side,
    ground: RAT_GROUND[shown.colour],
    rat: part === 'colour' || part === 'backdrop' ? null : { look: shown, place: placeOf(part, side) },
    backdrop: part === 'backdrop' ? shown.backdrop : null,
    faint: locked,
    locked,
  };
}

/** The cross on the picture of nothing worn (the web's `absolute right-0.5 top-0.5 size-5 bg-night-900/85`, a bold ✕ of 13 in cream). */
function NoneMark({ left, top }: { left: number; top: number }) {
  return (
    <View aria-hidden pointerEvents="none" style={{ position: 'absolute', left, top, width: NONE_MARK, height: NONE_MARK, alignItems: 'center', justifyContent: 'center', backgroundColor: EXTRA.label, pointerEvents: 'none' }}>
      <ReadText size={13} weight={600} tone="cream" lineHeight={13}>{'✕'}</ReadText>
    </View>
  );
}

/** The choices of one part, five to a row: what is pressed, framed, with nothing of the pictures (the tab's canvas lies over them). */
function ChoicesOf({
  part,
  label,
  choices,
  chosen,
  tile,
  onChoose,
  onLaid,
}: {
  part: Part;
  label: string;
  choices: Choice[];
  chosen: (key: string) => boolean;
  tile: number;
  onChoose: (part: Part, key: string, locked: string | null) => void;
  onLaid: (part: Part, y: number) => void;
}) {
  const rows: Choice[][] = [];
  for (let at = 0; at < choices.length; at += COLUMNS) rows.push(choices.slice(at, at + COLUMNS));
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} onLayout={(event) => onLaid(part, layoutTop(event))} style={{ marginTop: 6, gap: GAP }}>
      {rows.map((row) => (
        <View key={row[0].key} style={{ flexDirection: 'row', gap: GAP }}>
          {row.map((choice) => (
            <ChoiceTile key={choice.key} part={part} choiceKey={choice.key} label={choice.label} locked={choice.locked} on={chosen(choice.key)} tile={tile} onChoose={onChoose} />
          ))}
          {/* A short last row leaves its other places empty, as the web's grid does: its choices are no wider. */}
          {Array.from({ length: COLUMNS - row.length }, (_, i) => (
            <View key={`empty-${i}`} style={{ flex: 1, minWidth: 0 }} />
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * A choice, as it is pressed and said: its frame and the border of its picture (the picture itself is the tab's canvas's), the one chosen ringed in
 * gold (the web's `outline-2 outline-offset-2 outline-gold-500`), a prize not won yet said as such. Its touch box is the 44 a thumb needs whatever
 * the width of the phone (`reach`). Drawn again only when it is chosen or let go, or its prize is won, never for a pick of another.
 */
const ChoiceTile = memo(function ChoiceTile({ part, choiceKey, label, locked, on, tile, onChoose }: { part: Part; choiceKey: string; label: string; locked: string | null; on: boolean; tile: number; onChoose: (part: Part, key: string, locked: string | null) => void }) {
  const press = usePress({ onPress: () => onChoose(part, choiceKey, locked) });
  const touch = reach(tile, { above: GAP / 2, below: GAP / 2 });
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      // How a prize is won, said where the web's `title` shows it to a pointer: the phone's screen reader says it after the name.
      accessibilityHint={locked ?? undefined}
      accessibilityState={{ checked: on, disabled: locked !== null }}
      aria-checked={on}
      onPress={press}
      {...{ dataSet: locked === null ? undefined : { locked: 'true' } }}
      style={[{ flex: 1, minWidth: 0 }, touch.style]}
    >
      <Framed kind="raised" style={{ backgroundColor: COLORS['night-700'], padding: 4 }}>
        <View style={{ width: '100%', aspectRatio: 1, borderWidth: 2, borderColor: COLORS['night-900'] }} />
      </Framed>
      {on ? <View pointerEvents="none" style={{ position: 'absolute', top: touch.top - 4, left: -4, right: -4, bottom: touch.bottom - 4, borderWidth: 2, borderColor: COLORS['gold-500'], pointerEvents: 'none' }} /> : null}
    </Pressable>
  );
});

/** The rat put together by chance: words underlined, as the web's `underline underline-offset-4`, 44 high and as wide as they are, in the middle. */
function ByChance({ label, onPress }: { label: string; onPress: () => void }) {
  const press = usePress({ onPress });
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={press} style={{ minHeight: TOUCH, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 12 }}>
      <LinkText size={14} offset={4} tone="ink-200">{label}</LinkText>
    </Pressable>
  );
}
