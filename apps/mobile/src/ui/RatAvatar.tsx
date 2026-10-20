import { Canvas, Group, Image, type SkImage } from '@shopify/react-native-skia';
import type { RatLayer, RatLook } from '@ratrace/core/game/avatar';
import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { AVATAR_BOX, RAT_GROUND, piecesOf } from './rat';
import { PIXELATED } from './Sprite';
import { useSpriteImage } from './spriteImages';
import { COLORS } from './theme';

const useLayer = (id: string | null | undefined) => useSpriteImage(id).image;

/**
 * A player's rat, its layers one over another on one canvas, the whole 128 px rat filling `size` points.
 * Under clothes, the body is cut to what they let show of it (its clip as a `dstIn` mask), so no fur shows
 * down its back past them. A piece without art is left off; one still loading is not drawn yet, and the
 * body waits for its clip, never showing uncut.
 */
export function RatLayers({ look, size }: { look: RatLook; size: number }): ReactNode {
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

  const draw = (image: SkImage, blendMode?: 'dstIn') => (
    <Image image={image} x={0} y={0} width={size} height={size} fit="fill" sampling={PIXELATED} blendMode={blendMode} />
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
