import { ColorMatrix, Group, Image, type SkImage } from '@shopify/react-native-skia';
import type { RatLayer, RatLook } from '@ratrace/core/game/avatar';
import { memo, type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { Canvas } from './Canvas';
import { AVATAR_BOX, RAT_GROUND, piecesOf } from './rat';
import { PIXELATED } from './Sprite';
import { useSpriteImage } from './spriteImages';
import { COLORS, GREYSCALE } from './theme';

const useLayer = (id: string | null | undefined) => useSpriteImage(id).image;

/** Where the rat stands in its canvas, and how large it is drawn, in points: the canvas cuts what falls outside it. */
export type RatPlace = { x: number; y: number; w: number; h: number };

/**
 * A player's rat, its layers one over another on one canvas, the whole 128 px rat filling `size` points, or drawn at `place` in it (closer on a part
 * of it: the web's `size-[160%] -ml-[34%]` in a box that crops it). `grey` draws it through the web's `grayscale` filter (a prize not won yet).
 * Under clothes, the body is cut to what they let show of it (its clip as a `dstIn` mask), so no fur shows down its back past them. A piece without
 * art is left off; one still loading is not drawn yet, and the body waits for its clip, never showing uncut.
 */
function RatCanvas({ look, size, place, grey = false }: { look: RatLook; size: number; place?: RatPlace; grey?: boolean }): ReactNode {
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
  const at = place ?? { x: 0, y: 0, w: size, h: size };

  const draw = (image: SkImage, blendMode?: 'dstIn') => (
    <Image image={image} x={at.x} y={at.y} width={at.w} height={at.h} fit="fill" sampling={PIXELATED} blendMode={blendMode}>
      {grey && blendMode === undefined ? <ColorMatrix matrix={GREYSCALE as number[]} /> : null}
    </Image>
  );
  return (
    <Canvas style={{ width: size, height: size }}>
      {pieces.map((piece) => {
        const image = images[piece.layer];
        if (!image) return null;
        if (piece.clip === null) return <Group key={piece.id}>{draw(image)}</Group>;
        if (!clip) return null;
        return (
          <Group key={piece.id} layer>
            {draw(image)}
            {draw(clip, 'dstIn')}
          </Group>
        );
      })}
    </Canvas>
  );
}

/** Two looks alike, piece for piece: a rat is drawn again only when one of its pieces changes, never for a new object of the same look. */
const sameLook = (a: RatLook, b: RatLook): boolean =>
  a === b || (a.colour === b.colour && a.body === b.body && a.face === b.face && a.outfit === b.outfit && a.hat === b.hat && a.eyes === b.eyes && a.backdrop === b.backdrop);
const samePlace = (a: RatPlace | undefined, b: RatPlace | undefined): boolean => a === b || (a !== undefined && b !== undefined && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h);

/** The rat on its canvas, drawn again only when what it draws changes: its pieces, its size, where it stands, its grey. */
export const RatLayers = memo(RatCanvas, (a, b) => sameLook(a.look, b.look) && a.size === b.size && samePlace(a.place, b.place) && a.grey === b.grey);

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
