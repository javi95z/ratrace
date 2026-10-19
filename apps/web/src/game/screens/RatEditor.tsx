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
const PARTS: Part[] = ['body', 'face', 'outfit', 'hat', 'eyes', 'backdrop', 'colour'];

/** One choice of a part: a piece, nothing at all, or a colour. */
interface Choice {
  key: string;
  label: string;
  look: RatLook;
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
  const [part, setPart] = useState<Part>('body');

  const choices = (): Choice[] => {
    if (part === 'colour') return RAT_COLOURS.map((colour) => ({ key: colour, label: t(COLOUR_NAME[colour]), look: { ...look, colour }, locked: null }));
    const pieces = (RAT_LAYERS[part] as readonly string[]).filter((piece) => spriteOf(ratSprite(part, piece)) !== null);
    const drawn: Choice[] = pieces.map((piece) => {
      const prize = prizeOf(part, piece);
      const how = prize === null || mayWear(part, piece, earned, rank) ? null : 'badge' in prize ? t('locked', { badge: badgeName(prize.badge) }) : t('lockedRank', { rank: rankName(prize.rank) });
      return { key: piece, label: t(`pieces.${part}.${piece}`), look: { ...look, [part]: piece } as RatLook, locked: how };
    });
    // A rat always has a fur and a face: only what it wears may be left off.
    return part === 'body' || part === 'face' ? drawn : [{ key: 'none', label: t('none'), look: { ...look, [part]: null }, locked: null }, ...drawn];
  };
  const chosen = (choice: Choice) => (part === 'colour' ? look.colour === choice.key : (look[part] ?? 'none') === choice.key);

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label={t('layer')} className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
        {PARTS.map((each) => (
          <button
            key={each}
            type="button"
            role="tab"
            aria-selected={each === part}
            onClick={() => setPart(each)}
            className={`pixel min-h-11 px-1 text-[13px] ${each === part ? 'frame-gold bg-night-600 text-gold-500' : 'frame-raised bg-night-700 text-ink-200'}`}
          >
            {t(`layers.${each}`)}
          </button>
        ))}
      </div>
      <div role="radiogroup" aria-label={t(`layers.${part}`)} className="grid grid-cols-5 gap-1.5">
        {choices().map((choice) => {
          const on = chosen(choice);
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
              <span aria-hidden className={`relative flex aspect-square w-full overflow-hidden border-2 border-night-900 ${GROUND[choice.look.colour]}`}>
                {/* A colour is only the ground: shown alone, as the rat would hide it behind itself and any backdrop. */}
                {part === 'colour' ? null : <RatLayers look={choice.look} className={`size-[125%] shrink-0 -ml-[16%] -mt-[6%] ${choice.locked ? 'opacity-40 grayscale' : ''}`} />}
                {choice.locked ? (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <Sprite id="icon.locked" />
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
