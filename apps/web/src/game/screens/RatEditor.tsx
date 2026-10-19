'use client';

import { useState } from 'react';
import { mayWear, prizeOf, RAT_COLOURS, RAT_LAYERS, ratSprite } from '@ratrace/core/game/avatar';
import type { RankId } from '@ratrace/content';
import type { RatColour, RatLayer, RatLook } from '@ratrace/core/game/avatar';
import { useT } from '@/game/context';
import { GROUND, RatLayers } from '@/ui/RatAvatar';
import { Sprite, spriteOf } from '@/ui/Sprite';

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
type Group = 'body' | 'wear' | 'scene';
const GROUPS: Record<Group, Part[]> = { body: ['body', 'face'], wear: ['outfit', 'hat', 'eyes'], scene: ['backdrop', 'colour'] };
const GROUP_IDS = Object.keys(GROUPS) as Group[];

/**
 * How each part's choices frame the rat: the whole of it for the fur and what is behind it; closer,
 * on the part itself, for what is worn: the whole rat shows a hat, a pair of glasses or a collar too
 * small to tell one from another.
 */
const FRAME: Record<RatLayer, string> = {
  body: 'size-[125%] -ml-[16%] -mt-[6%]',
  backdrop: 'size-[125%] -ml-[16%] -mt-[6%]',
  outfit: 'size-[160%] -ml-[34%] -mt-[52%]',
  hat: 'size-[165%] -ml-[42%] mt-0',
  face: 'size-[200%] -ml-[76%] -mt-[62%]',
  eyes: 'size-[200%] -ml-[76%] -mt-[62%]',
};

/**
 * The rat every choice is shown on: one fur, one face, nothing worn, on a plain ground. A choice
 * shows what it offers, and stays as it is whatever else the player picks; the rat as it will be is
 * the one above the choices.
 */
const BASE: RatLook = { colour: 'slate', body: 'brown', face: 'calm', outfit: null, hat: null, eyes: null, backdrop: null };

/** One choice of a part: a piece, nothing at all, or a colour. */
interface Choice {
  key: string;
  label: string;
  look: RatLook;
  /** What the choice shows: the piece alone on the plain rat. */
  shown: RatLook;
  /** How it is won, when the player has not won it yet. */
  locked: string | null;
}

/**
 * The player's rat, a part at a time: its fur, what it wears, what it has on its face and head, what
 * is behind it and the colour of its ground. Each choice shows the rat as it would be. A piece kept
 * for a badge shows how it is won; a piece not drawn yet is not offered.
 */
export function RatEditor({ look, earned, rank, badgeName, rankName, onPick, onLocked }: { look: RatLook; earned: Record<string, unknown>; rank: RankId; badgeName: (id: string) => string; rankName: (rank: RankId) => string; onPick: (next: RatLook) => void; onLocked: (message: string) => void }) {
  const t = useT('player');
  const [group, setGroup] = useState<Group>('body');

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
    if (part === 'colour') return RAT_COLOURS.map((colour) => ({ key: colour, label: t(COLOUR_NAME[colour]), look: { ...look, colour }, shown: { ...BASE, colour }, locked: null }));
    const drawn: Choice[] = piecesOf(part).map(({ piece, open }) => {
      const prize = prizeOf(part, piece);
      const how = prize === null || open ? null : 'badge' in prize ? t('locked', { badge: badgeName(prize.badge) }) : t('lockedRank', { rank: rankName(prize.rank) });
      return { key: piece, label: t(`pieces.${part}.${piece}`), look: { ...look, [part]: piece } as RatLook, shown: { ...BASE, [part]: piece } as RatLook, locked: how };
    });
    // A rat always has a fur and a face: only what it wears may be left off.
    return part === 'body' || part === 'face' ? drawn : [{ key: 'none', label: t('none'), look: { ...look, [part]: null }, shown: BASE, locked: null }, ...drawn];
  };
  const chosen = (part: Part, choice: Choice) => (part === 'colour' ? look.colour === choice.key : (look[part] ?? 'none') === choice.key);

  return (
    <div className="flex flex-col gap-3">
      {/* The rat as it will be, and the tabs, held at the top of the screen while the choices scroll under them. */}
      <div className="sticky z-10 -mx-3 -mt-1 flex items-center gap-3 bg-night-700 px-3 py-2" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <span aria-hidden className={`flex size-16 shrink-0 overflow-hidden border-2 border-night-900 ${GROUND[look.colour]}`}>
          <RatLayers look={look} className="size-full shrink-0" />
        </span>
        <div role="tablist" aria-label={t('layer')} className="grid min-w-0 flex-1 grid-cols-3 gap-1.5">
          {GROUP_IDS.map((each) => (
            <button
              key={each}
              type="button"
              role="tab"
              aria-selected={each === group}
              onClick={() => setGroup(each)}
              className={`pixel min-h-11 px-1 text-[14px] ${each === group ? 'frame-gold bg-night-600 text-gold-500' : 'frame-raised bg-night-700 text-ink-200'}`}
            >
              {t(`groups.${each}`)}
            </button>
          ))}
        </div>
      </div>
      {GROUPS[group].map((part) => (
        // Each part of the tab under its own name, its choices beneath.
        <div key={part} className="flex flex-col gap-1.5">
          <p className="pixel text-[13px] uppercase tracking-wider text-ink-300">{t(`layers.${part}`)}</p>
          {choicesOf(part)}
        </div>
      ))}
      <button type="button" onClick={() => onPick(byChance())} className="min-h-11 self-center px-3 text-[14px] text-ink-200 underline underline-offset-4">
        {t('byChance')}
      </button>
    </div>
  );

  /** The choices of one part, each the rat as it would be with it. */
  function choicesOf(part: Part) {
    return (
      <div role="radiogroup" aria-label={t(`layers.${part}`)} className="grid grid-cols-5 gap-1.5">
        {choices(part).map((choice) => {
          const on = chosen(part, choice);
          return (
            <button
              key={choice.key}
              type="button"
              role="radio"
              aria-checked={on}
              aria-disabled={choice.locked !== null || undefined}
              aria-label={choice.label}
              title={choice.locked ?? choice.label}
              onClick={() => (choice.locked ? onLocked(choice.locked) : onPick(choice.look))}
              className={`frame-raised flex bg-night-700 p-1 ${on ? 'outline outline-2 outline-offset-2 outline-gold-500' : ''}`}
            >
              {/* The picture says which it is; the name is there for a pointer that rests on it and for a screen reader. */}
              <span aria-hidden className={`relative flex aspect-square w-full overflow-hidden border-2 border-night-900 ${GROUND[choice.shown.colour]}`}>
                {/* A colour is only the ground, and a backdrop only itself: each shown alone. Anything else, on the plain rat. */}
                {part === 'colour' ? null : part === 'backdrop' ? (
                  choice.shown.backdrop === null ? null : <Sprite id={ratSprite('backdrop', choice.shown.backdrop)} fallback={{ w: 128, h: 128 }} className={`!h-full !w-full ${choice.locked ? 'opacity-40 grayscale' : ''}`} />
                ) : (
                  <RatLayers look={choice.shown} className={`${FRAME[part]} shrink-0 ${choice.locked ? 'opacity-40 grayscale' : ''}`} />
                )}
                {choice.locked ? (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <Sprite id="icon.locked" />
                  </span>
                ) : null}
                {/* Nothing worn: said with a cross, as the rat without the piece looks much like the rest. */}
                {choice.key === 'none' ? (
                  <span className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center bg-night-900/85 font-sans text-[13px] font-bold leading-none text-cream">✕</span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    );
  }
}
