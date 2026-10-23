import { ratSprite } from '@ratrace/core/game/avatar';
import type { RatLook } from '@ratrace/core/game/avatar';
import { memo, type CSSProperties, type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { AVATAR_BOX, RAT_GROUND, piecesOf, type RatPiece } from './rat';
import { PIXELATED } from './Sprite.web';
import { sourceOf, useSpriteImages, type SpritePicture } from './spriteImages.web';
import { spriteOf } from './sprites';
import { COLORS, type ColorToken } from './theme';

/*
 * The web export's twin of `RatAvatar.tsx` (Metro picks it for the web). The rat is its layers one over another in one box, as the Next web's
 * `RatAvatar.tsx` stacks them: an `<img>` each, a body under clothes cut by its clip as a CSS mask, a prize not won yet faded by CSS. No canvas.
 */

/** Where something stands in a box, and how large it is drawn, in points. */
export type RatPlace = { x: number; y: number; w: number; h: number };

/** A layer of the rat: its picture laid over the whole of the place it stands in, nearest neighbour. */
const layerStyle = (at: RatPlace): CSSProperties => ({ position: 'absolute', left: 0, top: 0, width: at.w, height: at.h, userSelect: 'none', ...PIXELATED });

/** A picture of a sprite as the rat's layers draw it: no name (the rat is named by whoever draws it), never dragged. */
function Layer({ uri, at }: { uri: string; at: RatPlace }): ReactNode {
  return <img src={uri} alt="" aria-hidden width={at.w} height={at.h} draggable={false} decoding="async" style={layerStyle(at)} />;
}

/** The pieces of a rat laid in a box at `at`, back to front, each body cut by its clip (a piece or a clip not in yet: left off). */
function RatStack({ pieces, at, pictureOf }: { pieces: readonly RatPiece[]; at: RatPlace; pictureOf: (id: string) => SpritePicture | null | undefined }): ReactNode {
  return (
    <div style={{ position: 'absolute', left: at.x, top: at.y, width: at.w, height: at.h }}>
      {pieces.map((piece) => {
        const picture = pictureOf(piece.id);
        if (!picture) return null;
        if (piece.clip === null) return <Layer key={piece.id} uri={picture.uri} at={at} />;
        const clip = pictureOf(piece.clip);
        // The body waits for its clip, never showing uncut.
        if (!clip) return null;
        const mask = `url("${clip.uri}")`;
        return (
          <div key={piece.id} style={{ position: 'absolute', left: 0, top: 0, width: at.w, height: at.h, maskImage: mask, WebkitMaskImage: mask, maskSize: '100% 100%', WebkitMaskSize: '100% 100%', maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat', ...PIXELATED }}>
            <Layer uri={picture.uri} at={at} />
          </div>
        );
      })}
    </div>
  );
}

/** The sprites a rat draws: every piece and the clip of its body. */
const idsOfRat = (pieces: readonly RatPiece[]): string[] => pieces.flatMap((piece) => (piece.clip ? [piece.id, piece.clip] : [piece.id]));

/**
 * A player's rat, its layers one over another in one box, the whole 128 px rat filling `size` points. Under clothes, the body is cut to what they
 * let show of it (its clip as a mask), so no fur shows down its back past them. A piece without art is left off; one still loading is not drawn yet,
 * and the body waits for its clip, never showing uncut.
 */
function RatBox({ look, size }: { look: RatLook; size: number }): ReactNode {
  const pieces = piecesOf(look);
  const ids = idsOfRat(pieces);
  // Each is loaded once for the whole app (spriteImages), so two rats of one look read every piece once.
  const images = useSpriteImages(ids);
  const byId = new Map(ids.map((id, i) => [id, images[i]?.image ?? null]));
  return (
    <View aria-hidden style={{ width: size, height: size }}>
      <RatStack pieces={pieces} at={{ x: 0, y: 0, w: size, h: size }} pictureOf={(id) => byId.get(id)} />
    </View>
  );
}

/** Two looks alike, piece for piece: a rat is drawn again only when one of its pieces changes, never for a new object of the same look. */
const sameLook = (a: RatLook, b: RatLook): boolean =>
  a === b || (a.colour === b.colour && a.body === b.body && a.face === b.face && a.outfit === b.outfit && a.hat === b.hat && a.eyes === b.eyes && a.backdrop === b.backdrop);

/** The rat in its box, drawn again only when what it draws changes: its pieces or its size. */
export const RatLayers = memo(RatBox, (a, b) => sameLook(a.look, b.look) && a.size === b.size);

/**
 * One choice of a grid of rats (`RatChoices`): its box (`x`, `y`, `side` square), the ground it stands on, and what it shows there: a rat (at `place`
 * in the box, which cuts it: closer on the part it offers), a backdrop alone filling the box, or nothing (a colour, only its ground). `faint` draws the
 * picture through the web's `opacity-40 grayscale` (a prize not won yet), `locked` the lock over it.
 */
export interface RatChoice {
  x: number;
  y: number;
  side: number;
  ground: ColorToken;
  rat: { look: RatLook; place: RatPlace } | null;
  backdrop: string | null;
  faint: boolean;
  locked: boolean;
}

/** The lock over a prize not won yet, at its art size, in the middle of its choice. */
const LOCK = 'icon.locked';
const LOCK_SIZE = 32;

/** The sprites a grid of choices draws: every piece of every rat, every body's clip, every backdrop, and the lock where one is drawn. */
function idsOf(choices: readonly RatChoice[]): string[] {
  const ids = new Set<string>();
  for (const choice of choices) {
    if (choice.rat) idsOfRat(piecesOf(choice.rat.look)).forEach((id) => ids.add(id));
    if (choice.backdrop !== null) ids.add(ratSprite('backdrop', choice.backdrop));
    if (choice.locked) ids.add(LOCK);
  }
  return [...ids];
}

/** The sprites a grid of choices draws, for reading them ahead of the grid (a tab not opened yet): see `RatChoices`. */
export const choiceSprites = (choices: readonly RatChoice[]): string[] => idsOf(choices);

/** Two grids alike, choice for choice. */
const sameChoices = (a: readonly RatChoice[], b: readonly RatChoice[]): boolean =>
  a === b ||
  (a.length === b.length &&
    a.every((one, i) => {
      const two = b[i];
      return (
        one.x === two.x && one.y === two.y && one.side === two.side && one.ground === two.ground && one.backdrop === two.backdrop && one.faint === two.faint && one.locked === two.locked &&
        (one.rat === two.rat || (one.rat !== null && two.rat !== null && sameLook(one.rat.look, two.rat.look) && one.rat.place.x === two.rat.place.x && one.rat.place.y === two.rat.place.y && one.rat.place.w === two.rat.place.w && one.rat.place.h === two.rat.place.h))
      );
    }));

/**
 * The pictures of a grid of choices of the rat, every one in ONE box of `width` x `height`: each choice's ground, its picture cut to its box, and its
 * lock. What is pressed is laid over it by the screen, which draws nothing of the pictures itself. Its pictures are read first, and the box is filled
 * once every one of them is in (or has failed), as `SpriteLayers` fills its own. Drawn again only when a choice changes (its box, its picture, its
 * lock), never for the rat the player is wearing. The rats are never put together into one picture as on the phone (ratPicture.web.ts): the browser fades and cuts them.
 */
export const RatChoices = memo(
  function RatChoices({ width, height, choices }: { width: number; height: number; choices: readonly RatChoice[] }): ReactNode {
    const ids = idsOf(choices);
    const known = ids.map((id) => spriteOf(id) !== null && sourceOf(id) !== undefined);
    const images = useSpriteImages(ids.map((id, i) => (known[i] ? id : null)));
    const ready = images.every((state, i) => !known[i] || state.failed || state.image !== null);
    const byId = new Map(ids.map((id, i) => [id, images[i]?.image ?? null]));
    const pictureOf = (id: string) => byId.get(id);
    return (
      <View aria-hidden style={{ position: 'absolute', top: 0, left: 0, width, height, pointerEvents: 'none' }}>
        {ready
          ? choices.map((choice, i) => {
              const backdrop = choice.backdrop === null ? null : pictureOf(ratSprite('backdrop', choice.backdrop));
              const lock = choice.locked ? pictureOf(LOCK) : null;
              return (
                <div key={i} style={{ position: 'absolute', left: choice.x, top: choice.y, width: choice.side, height: choice.side, overflow: 'hidden', backgroundColor: COLORS[choice.ground] }}>
                  {/* A prize not won yet is faded whole: the backdrop and the rat together. */}
                  <div data-faint={choice.faint ? '' : undefined} style={{ position: 'absolute', left: 0, top: 0, width: choice.side, height: choice.side, ...(choice.faint ? { opacity: 0.4, filter: 'grayscale(1)' } : null) }}>
                    {backdrop ? <Layer uri={backdrop.uri} at={{ x: 0, y: 0, w: choice.side, h: choice.side }} /> : null}
                    {choice.rat ? <RatStack pieces={piecesOf(choice.rat.look)} at={choice.rat.place} pictureOf={pictureOf} /> : null}
                  </div>
                  {lock ? (
                    <img
                      src={lock.uri}
                      alt=""
                      aria-hidden
                      width={LOCK_SIZE}
                      height={LOCK_SIZE}
                      draggable={false}
                      style={{ position: 'absolute', left: (choice.side - LOCK_SIZE) / 2, top: (choice.side - LOCK_SIZE) / 2, width: LOCK_SIZE, height: LOCK_SIZE, userSelect: 'none', ...PIXELATED }}
                    />
                  ) : null}
                </div>
              );
            })
          : null}
      </View>
    );
  },
  (a, b) => a.width === b.width && a.height === b.height && sameChoices(a.choices, b.choices),
);

/**
 * A player's rat in a box: at the size of a line of a list (`sm`, 32), a heading (`md`, 44) or the profile
 * (`lg`, 96), with the web's 2 pt night-900 border inside the box and the rat's colour as its ground.
 */
export function RatAvatar({ look, size = 'sm', style }: { look: RatLook; size?: 'sm' | 'md' | 'lg'; style?: ViewStyle }): ReactNode {
  const box = AVATAR_BOX[size];
  return (
    <View
      aria-hidden
      style={[
        {
          width: box,
          height: box,
          flexShrink: 0,
          overflow: 'hidden',
          borderWidth: AVATAR_BOX.border,
          borderColor: COLORS['night-900'],
          backgroundColor: COLORS[RAT_GROUND[look.colour]],
        },
        style,
      ]}
    >
      <RatLayers look={look} size={box - 2 * AVATAR_BOX.border} />
    </View>
  );
}
