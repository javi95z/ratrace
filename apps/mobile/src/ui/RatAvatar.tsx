import { ColorMatrix, Group, Image, Paint, Rect, rect, type SkImage } from '@shopify/react-native-skia';
import { ratSprite } from '@ratrace/core/game/avatar';
import type { RatLayer, RatLook } from '@ratrace/core/game/avatar';
import { memo, type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { Canvas } from './Canvas';
import { AVATAR_BOX, RAT_GROUND, piecesOf, type RatPiece } from './rat';
import { PIXELATED } from './Sprite';
import { sourceOf, useSpriteImage, useSpriteImages } from './spriteImages';
import { spriteOf } from './sprites';
import { COLORS, GREYSCALE, type ColorToken } from './theme';

const useLayer = (id: string | null | undefined) => useSpriteImage(id).image;

/** The pieces of a rat drawn into a box on a canvas, back to front, each body cut by its clip (a piece or a clip not in yet: left off). */
function drawRat(pieces: readonly RatPiece[], at: RatPlace, imageOf: (id: string) => SkImage | null | undefined): ReactNode[] {
  const draw = (image: SkImage, key: string, blendMode?: 'dstIn') => (
    <Image key={key} image={image} x={at.x} y={at.y} width={at.w} height={at.h} fit="fill" sampling={PIXELATED} blendMode={blendMode} />
  );
  return pieces.map((piece) => {
    const image = imageOf(piece.id);
    if (!image) return null;
    if (piece.clip === null) return draw(image, piece.id);
    const clip = imageOf(piece.clip);
    if (!clip) return null;
    return (
      <Group key={piece.id} layer>
        {draw(image, 'piece')}
        {draw(clip, 'clip', 'dstIn')}
      </Group>
    );
  });
}

/**
 * A player's rat, its layers one over another on one canvas, the whole 128 px rat filling `size` points. Under clothes, the body is cut to what they
 * let show of it (its clip as a `dstIn` mask), so no fur shows down its back past them. A piece without art is left off; one still loading is not
 * drawn yet, and the body waits for its clip, never showing uncut.
 */
function RatCanvas({ look, size }: { look: RatLook; size: number }): ReactNode {
  const pieces = piecesOf(look);
  const of = (layer: RatLayer) => pieces.find((p) => p.layer === layer);
  // One image per layer, always in this order: hooks may not come and go with the look. Each is decoded once for the
  // whole app (spriteImages), so two rats of one look read every piece once.
  const images: Partial<Record<RatLayer, SkImage | null>> = {
    backdrop: useLayer(of('backdrop')?.id),
    body: useLayer(of('body')?.id),
    face: useLayer(of('face')?.id),
    outfit: useLayer(of('outfit')?.id),
    eyes: useLayer(of('eyes')?.id),
    hat: useLayer(of('hat')?.id),
  };
  const clip = useLayer(of('body')?.clip);
  const byId = new Map<string, SkImage | null | undefined>(pieces.map((piece) => [piece.id, images[piece.layer]]));
  const clipId = of('body')?.clip;
  if (clipId) byId.set(clipId, clip);
  return <Canvas style={{ width: size, height: size }}>{drawRat(pieces, { x: 0, y: 0, w: size, h: size }, (id) => byId.get(id))}</Canvas>;
}

/** Two looks alike, piece for piece: a rat is drawn again only when one of its pieces changes, never for a new object of the same look. */
const sameLook = (a: RatLook, b: RatLook): boolean =>
  a === b || (a.colour === b.colour && a.body === b.body && a.face === b.face && a.outfit === b.outfit && a.hat === b.hat && a.eyes === b.eyes && a.backdrop === b.backdrop);

/** The rat on its canvas, drawn again only when what it draws changes: its pieces or its size. */
export const RatLayers = memo(RatCanvas, (a, b) => sameLook(a.look, b.look) && a.size === b.size);

/** Where something stands on a canvas, and how large it is drawn, in points. */
export type RatPlace = { x: number; y: number; w: number; h: number };

/**
 * One choice of a grid of rats (`RatChoices`): its box on the canvas (`x`, `y`, `side` square), the ground it stands on, and what it shows there:
 * a rat (at `place` in the box, which cuts it: closer on the part it offers), a backdrop alone filling the box, or nothing (a colour, only its
 * ground). `faint` draws the picture through the web's `opacity-40 grayscale` (a prize not won yet), `locked` the lock over it.
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

/** The web's `grayscale` and `opacity-40` together, on the whole picture of a choice: each colour its grey, at 40%. */
const FAINT: number[] = [...GREYSCALE.slice(0, 15), 0, 0, 0, 0.4, 0];

/** The sprites a grid of choices draws: every piece of every rat, every body's clip, every backdrop, and the lock where one is drawn. */
function idsOf(choices: readonly RatChoice[]): string[] {
  const ids = new Set<string>();
  for (const choice of choices) {
    if (choice.rat) for (const piece of piecesOf(choice.rat.look)) [piece.id, ...(piece.clip ? [piece.clip] : [])].forEach((id) => ids.add(id));
    if (choice.backdrop !== null) ids.add(ratSprite('backdrop', choice.backdrop));
    if (choice.locked) ids.add(LOCK);
  }
  return [...ids];
}

/** Two grids alike, choice for choice. */
const sameChoices = (a: readonly RatChoice[], b: readonly RatChoice[]): boolean =>
  a === b ||
  (a.length === b.length &&
    a.every((one, i) => {
      const two = b[i];
      return (
        one.x === two.x && one.y === two.y && one.side === two.side && one.ground === two.ground && one.backdrop === two.backdrop && one.faint === two.faint && one.locked === two.locked &&
        (one.rat === two.rat || (one.rat !== null && two.rat !== null && sameLook(one.rat.look, two.rat.look) && one.rat.place.x === two.rat.place.x && one.rat.place.y === two.rat.place.y && one.rat.place.w === two.rat.place.w))
      );
    }));

/**
 * The pictures of a grid of choices of the rat, every one on ONE canvas of `width` x `height`: each choice's ground, its picture cut to its box, and
 * its lock. A canvas is a view of its own that the UI thread makes and draws, with a surface of its own: a tab of forty-odd choices was forty-odd of
 * them made in one press. What is pressed is laid over the canvas by the screen, which draws nothing of the pictures itself. Its pictures are read
 * first, and the canvas is put in once every one of them is in (or has failed), as `SpriteLayers` puts its own. Drawn again only when a choice
 * changes (its box, its picture, its lock), never for the rat the player is wearing.
 */
export const RatChoices = memo(
  function RatChoices({ width, height, choices }: { width: number; height: number; choices: readonly RatChoice[] }): ReactNode {
    const ids = idsOf(choices);
    const known = ids.map((id) => spriteOf(id) !== null && sourceOf(id) !== undefined);
    const images = useSpriteImages(ids.map((id, i) => (known[i] ? id : null)));
    const ready = images.every((state, i) => !known[i] || state.failed || state.image !== null);
    const byId = new Map(ids.map((id, i) => [id, images[i]?.image ?? null]));
    const imageOf = (id: string) => byId.get(id);
    const lock = imageOf(LOCK);
    return (
      <View aria-hidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, width, height, pointerEvents: 'none' }}>
        {ready ? (
          <Canvas style={{ width, height }}>
            {choices.map((choice, i) => {
              const box = { x: choice.x, y: choice.y, w: choice.side, h: choice.side };
              const backdrop = choice.backdrop === null ? null : imageOf(ratSprite('backdrop', choice.backdrop));
              return (
                <Group key={i} clip={rect(box.x, box.y, box.w, box.h)}>
                  <Rect x={box.x} y={box.y} width={box.w} height={box.h} color={COLORS[choice.ground]} />
                  <Group layer={choice.faint ? <Paint><ColorMatrix matrix={FAINT} /></Paint> : undefined}>
                    {backdrop ? <Image image={backdrop} x={box.x} y={box.y} width={box.w} height={box.h} fit="fill" sampling={PIXELATED} /> : null}
                    {choice.rat ? drawRat(piecesOf(choice.rat.look), { x: box.x + choice.rat.place.x, y: box.y + choice.rat.place.y, w: choice.rat.place.w, h: choice.rat.place.h }, imageOf) : null}
                  </Group>
                  {choice.locked && lock ? (
                    <Image image={lock} x={box.x + (box.w - LOCK_SIZE) / 2} y={box.y + (box.h - LOCK_SIZE) / 2} width={LOCK_SIZE} height={LOCK_SIZE} fit="fill" sampling={PIXELATED} />
                  ) : null}
                </Group>
              );
            })}
          </Canvas>
        ) : null}
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
      importantForAccessibility="no-hide-descendants"
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
