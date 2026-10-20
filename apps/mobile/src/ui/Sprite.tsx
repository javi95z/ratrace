import { Canvas, Fill, FilterMode, Group, Image, MipmapMode, Path, Skia, type SkImage } from '@shopify/react-native-skia';
import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { sourceOf, useSpriteImage } from './spriteImages';
import { CHECKER, checkerCells, FALLBACK, reportMissing, spriteBox, spriteOf, type Size, type SpriteScale } from './sprites';
import { COLORS } from './theme';

/** Pixel art is never smoothed: each art pixel becomes a block of whole device pixels. */
export const PIXELATED = { filter: FilterMode.Nearest, mipmap: MipmapMode.None };

/** How many points one art pixel takes on this stage (the web's `--art`): one on a phone, two where there is room. */
export const ArtScale = createContext(1);

export { sourceOf };

interface Props {
  id: string;
  /** Whole points per art pixel, or `'art'` for the stage's scale. */
  scale?: SpriteScale;
  /** What the picture shows, for someone who cannot see it. Leave empty when the text beside it already says so. */
  alt?: string;
  /** The size to reserve when the sprite is missing. */
  fallback?: Size;
  /** Draws only the outline of the sprite, filled with night-900: something not owned yet. */
  silhouette?: boolean;
  style?: ViewStyle;
}

/**
 * One pixel-art sprite, drawn pixel for pixel with Skia (nearest neighbour: React Native's Image cannot be told not to
 * smooth). Its picture is decoded once for the whole app and shared (spriteImages). A sprite that does not exist, or
 * does not load, shows the web's checkerboard at the fallback size and is logged once: the game is playable without art.
 */
export function Sprite({ id, scale = 1, alt = '', fallback = FALLBACK, silhouette = false, style }: Props): ReactNode {
  const art = useContext(ArtScale);
  const box = spriteBox(id, scale, art, fallback);
  const known = spriteOf(id) !== null && sourceOf(id) !== undefined;
  if (!known) reportMissing(id, 'missing');
  const { image, failed } = useSpriteImage(known ? id : null);

  return (
    <View
      accessible={alt !== '' && !silhouette}
      accessibilityRole={alt && !silhouette ? 'image' : undefined}
      accessibilityLabel={alt && !silhouette ? alt : undefined}
      aria-hidden={alt && !silhouette ? undefined : true}
      importantForAccessibility={alt && !silhouette ? 'yes' : 'no-hide-descendants'}
      style={[{ width: box.w, height: box.h, flexShrink: 0 }, style]}
    >
      {/* While it loads the box is already there, empty (no canvas yet), so nothing moves when it arrives. */}
      {!known || failed ? <Checker w={box.w} h={box.h} /> : image ? <Drawn image={image} box={box} silhouette={silhouette} /> : null}
    </View>
  );
}

/** The decoded sprite on a canvas of its box. */
function Drawn({ image, box, silhouette }: { image: SkImage; box: Size; silhouette: boolean }) {
  return (
    <Canvas style={{ width: box.w, height: box.h }}>
      {silhouette ? (
        // The sprite is the mask, the colour is the palette's.
        <Group layer>
          <Image image={image} x={0} y={0} width={box.w} height={box.h} fit="fill" sampling={PIXELATED} />
          <Fill color={COLORS['night-900']} blendMode="srcIn" />
        </Group>
      ) : (
        <Image image={image} x={0} y={0} width={box.w} height={box.h} fit="fill" sampling={PIXELATED} />
      )}
    </Canvas>
  );
}

/** The web's placeholder: an 8 pt checkerboard of night-600 and night-700, whatever the scale. */
export function Checker({ w, h }: Size): ReactNode {
  const path = useMemo(() => {
    const b = Skia.PathBuilder.Make();
    for (const c of checkerCells(w, h)) b.addRect(Skia.XYWHRect(c.x, c.y, c.w, c.h));
    return b.detach();
  }, [w, h]);
  return (
    <Canvas style={{ width: w, height: h }}>
      <Fill color={COLORS[CHECKER.ground]} />
      <Path path={path} color={COLORS[CHECKER.cells]} />
    </Canvas>
  );
}
