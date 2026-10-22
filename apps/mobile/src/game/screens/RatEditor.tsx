import { mayWear, prizeOf, RAT_COLOURS, RAT_LAYERS, ratSprite } from '@ratrace/core/game/avatar';
import type { RankId } from '@ratrace/content';
import type { RatColour, RatLayer, RatLook } from '@ratrace/core/game/avatar';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Framed } from '../../ui/Frame';
import { pressDown, usePress } from '../../ui/kit';
import { LinkText } from '../../ui/LinkText';
import { Tabs } from '../../ui/overlay';
import { RAT_GROUND } from '../../ui/rat';
import { RatLayers, type RatPlace } from '../../ui/RatAvatar';
import { Sprite } from '../../ui/Sprite';
import { spriteOf } from '../../ui/sprites';
import { StickyPart } from '../../ui/Sticky';
import { PixelText, ReadText } from '../../ui/text';
import { COLORS, EXTRA, TOUCH } from '../../ui/theme';
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
  // How wide a choice's picture is: the page's column, laid out, shared by the five of a row. Kept across the tabs, so a tab's choices are drawn once.
  const [side, setSide] = useState(0);

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

  return (
    <StickyPart
      gap={12}
      head={
        // The rat as it will be, and the tabs, held at the top of the screen while the choices scroll under them: the rat as tall as the tabs, framed
        // as they are, then the game's own tabs.
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS['night-700'] }}>
          <View aria-hidden importantForAccessibility="no-hide-descendants" style={{ flexShrink: 0 }}>
            <Framed kind="raised" style={{ width: TOUCH, height: TOUCH, overflow: 'hidden', backgroundColor: COLORS[RAT_GROUND[look.colour]] }}>
              <RatLayers look={look} size={TOUCH} />
            </Framed>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Tabs<RatGroup> label={t('layer')} tabs={GROUP_IDS.map((id) => ({ id, label: t(`groups.${id}`) }))} value={group} onChange={setGroup} />
          </View>
        </View>
      }
    >
      <View
        role="tabpanel"
        accessibilityLabel={t(`groups.${group}`)}
        onLayout={(event) => setSide(Math.max(0, (event.nativeEvent.layout.width - (COLUMNS - 1) * GAP) / COLUMNS - AROUND))}
        style={{ gap: 12 }}
      >
        {GROUPS[group].map((part) => (
          // Each part of the tab under its own name, its choices beneath.
          <View key={part} style={{ gap: 6 }}>
            <PixelText size={13} tone="ink-300" style={{ textTransform: 'uppercase', letterSpacing: 13 * 0.05 }}>{t(`layers.${part}`)}</PixelText>
            <ChoicesOf part={part} label={t(`layers.${part}`)} choices={choices(part)} chosen={(key) => chosen(part, key)} side={side} onChoose={choose} />
          </View>
        ))}
      </View>
      <ByChance label={t('byChance')} onPress={() => onPick(byChance())} />
    </StickyPart>
  );
}

/** The choices of one part, five to a row, each the rat as it would be with it. */
function ChoicesOf({ part, label, choices, chosen, side, onChoose }: { part: Part; label: string; choices: Choice[]; chosen: (key: string) => boolean; side: number; onChoose: (part: Part, key: string, locked: string | null) => void }) {
  const rows: Choice[][] = [];
  for (let at = 0; at < choices.length; at += COLUMNS) rows.push(choices.slice(at, at + COLUMNS));
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ gap: GAP }}>
      {rows.map((row) => (
        <View key={row[0].key} style={{ flexDirection: 'row', gap: GAP }}>
          {row.map((choice) => (
            <ChoiceTile key={choice.key} part={part} choiceKey={choice.key} label={choice.label} locked={choice.locked} on={chosen(choice.key)} side={side} onChoose={onChoose} />
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
 * A choice: the piece on the plain rat (a colour only the ground, a backdrop only itself), a prize not won yet grey and faint under a lock, nothing
 * worn marked with a cross, the one chosen ringed in gold (the web's `outline-2 outline-offset-2 outline-gold-500`). Drawn again only when it is
 * chosen or let go, or its prize is won, never for a pick of another: its picture is the plain rat's, whatever the player's rat is.
 */
const ChoiceTile = memo(function ChoiceTile({ part, choiceKey, label, locked, on, side, onChoose }: { part: Part; choiceKey: string; label: string; locked: string | null; on: boolean; side: number; onChoose: (part: Part, key: string, locked: string | null) => void }) {
  const shown = useMemo(() => shownOf(part, choiceKey), [part, choiceKey]);
  const press = usePress({ onPress: () => onChoose(part, choiceKey, locked) });
  const faint = locked !== null ? { opacity: 0.4 } : null;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      // How a prize is won, said where the web's `title` shows it to a pointer: the phone's screen reader says it after the name.
      accessibilityHint={locked ?? undefined}
      accessibilityState={{ checked: on, disabled: locked !== null }}
      aria-checked={on}
      onPress={press}
      style={({ pressed }) => ({ ...pressDown(pressed), flex: 1, minWidth: 0 })}
    >
      <Framed kind="raised" style={{ backgroundColor: COLORS['night-700'], padding: 4 }}>
        {/* The picture says which it is; the name is there for a screen reader. */}
        <View
          aria-hidden
          importantForAccessibility="no-hide-descendants"
          style={{ width: '100%', aspectRatio: 1, overflow: 'hidden', borderWidth: 2, borderColor: COLORS['night-900'], backgroundColor: COLORS[RAT_GROUND[shown.colour]] }}
        >
          {/* A colour is only the ground, and a backdrop only itself: each shown alone. Anything else, on the plain rat. */}
          {part === 'colour' ? null : part === 'backdrop' ? (
            shown.backdrop === null ? null : (
              <View style={faint}>
                <Sprite id={ratSprite('backdrop', shown.backdrop)} fallback={{ w: 128, h: 128 }} size={{ w: side, h: side }} grey={locked !== null} />
              </View>
            )
          ) : (
            <View style={faint}>
              <RatLayers look={shown} size={side} place={placeOf(part, side)} grey={locked !== null} />
            </View>
          )}
          {locked !== null ? (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
              <Sprite id="icon.locked" />
            </View>
          ) : null}
          {/* Nothing worn: said with a cross, as the rat without the piece looks much like the rest. */}
          {choiceKey === 'none' ? (
            <View style={{ position: 'absolute', right: 2, top: 2, width: 20, height: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: EXTRA.label }}>
              <ReadText size={13} weight={600} tone="cream" lineHeight={13}>{'✕'}</ReadText>
            </View>
          ) : null}
        </View>
      </Framed>
      {on ? <View pointerEvents="none" style={{ position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, borderWidth: 2, borderColor: COLORS['gold-500'], pointerEvents: 'none' }} /> : null}
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
