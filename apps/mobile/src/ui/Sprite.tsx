import { ColorMatrix, Fill, FilterMode, Group, Image, MipmapMode, Path, Rect, Skia, type SkImage } from '@shopify/react-native-skia';
import { createContext, memo, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { Canvas } from './Canvas';
import { sourceOf, useSpriteImage } from './spriteImages';
import { CHECKER, checkerCells, FALLBACK, reportMissing, spriteBox, spriteOf, type Size, type SpriteScale } from './sprites';
import { COLORS, GREYSCALE, grey as greyOf } from './theme';

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
  /** The box the picture is drawn into, in points, where the web forces one (`!h-4 !w-4`, `!w-full`): nearest neighbour into it, whatever its art size and `scale`. */
  size?: Size;
  /**
   * Where in its box the picture is drawn, and how large, where that is not the whole box (the web's `background-size: cover` on a
   * banner: larger than the box, centred on it, cut by it). It may fall at a fraction of a point, as the browser's does: the canvas is
   * laid out on whole device pixels, the picture in it is not.
   */
  place?: Size & { x: number; y: number };
  /** Draws only the outline of the sprite, filled with night-900: something not owned yet. */
  silhouette?: boolean;
  /** Draws it through the web's `grayscale` filter (`GREYSCALE`): a picture on a card the web greys whole, a badge not yet earned. */
  grey?: boolean;
  style?: ViewStyle;
  /** Skia nodes drawn over the picture in its own canvas, where they can blend with it (the rainbow of a legendary card). */
  children?: ReactNode;
}

/**
 * One pixel-art sprite, drawn pixel for pixel with Skia (nearest neighbour: React Native's Image cannot be told not to
 * smooth). Its picture is decoded once for the whole app and shared (spriteImages). A sprite that does not exist, or
 * does not load, shows the web's checkerboard at the fallback size and is logged once: the game is playable without art.
 */
function SpriteBox({ id, scale = 1, alt = '', fallback = FALLBACK, size, place, silhouette = false, grey = false, style, children }: Props): ReactNode {
  const art = useContext(ArtScale);
  const box = size ?? spriteBox(id, scale, art, fallback);
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
      {!known || failed ? <Checker w={box.w} h={box.h} /> : image ? <Drawn image={image} box={box} place={place ?? { x: 0, y: 0, ...box }} silhouette={silhouette} grey={grey}>{children}</Drawn> : null}
    </View>
  );
}

/** Two boxes alike (a size, a place, a fallback): the same numbers, as callers write a new one each time they draw. */
const sameBox = (a: Partial<Size & { x: number; y: number }> | undefined, b: Partial<Size & { x: number; y: number }> | undefined): boolean =>
  a === b || (a !== undefined && b !== undefined && a.w === b.w && a.h === b.h && a.x === b.x && a.y === b.y);

/**
 * A sprite is drawn again only when what it draws changes: a line that holds it drawn again for its words leaves its canvas alone (each drawing of a
 * canvas is a new recording handed to Skia). Its boxes are compared by their numbers; its style and what it draws over the picture by identity.
 */
export const Sprite = memo(
  SpriteBox,
  (a, b) =>
    a.id === b.id &&
    a.scale === b.scale &&
    a.alt === b.alt &&
    a.silhouette === b.silhouette &&
    a.grey === b.grey &&
    a.style === b.style &&
    a.children === b.children &&
    sameBox(a.size, b.size) &&
    sameBox(a.place, b.place) &&
    sameBox(a.fallback, b.fallback),
);

/** The decoded sprite on a canvas of its box. */
function Drawn({ image, box, place, silhouette, grey, children }: { image: SkImage; box: Size; place: Size & { x: number; y: number }; silhouette: boolean; grey: boolean; children?: ReactNode }) {
  return (
    <Canvas style={{ width: box.w, height: box.h }}>
      {silhouette ? (
        // The sprite is the mask, the colour is the palette's.
        <Group layer>
          <Image image={image} x={place.x} y={place.y} width={place.w} height={place.h} fit="fill" sampling={PIXELATED} />
          <Fill color={grey ? greyOf(COLORS['night-900']) : COLORS['night-900']} blendMode="srcIn" />
        </Group>
      ) : (
        <Image image={image} x={place.x} y={place.y} width={place.w} height={place.h} fit="fill" sampling={PIXELATED}>
          {grey ? <ColorMatrix matrix={GREYSCALE as number[]} /> : null}
        </Image>
      )}
      {children}
    </Canvas>
  );
}

/** The checkerboard's night-600 cells in a w x h box, as one path. */
function useCheckerPath(w: number, h: number) {
  return useMemo(() => {
    const b = Skia.PathBuilder.Make();
    for (const c of checkerCells(w, h)) b.addRect(Skia.XYWHRect(c.x, c.y, c.w, c.h));
    return b.detach();
  }, [w, h]);
}

/** The web's placeholder: an 8 pt checkerboard of night-600 and night-700, whatever the scale. */
export function Checker({ w, h }: Size): ReactNode {
  const path = useCheckerPath(w, h);
  return (
    <Canvas style={{ width: w, height: h }}>
      <Fill color={COLORS[CHECKER.ground]} />
      <Path path={path} color={COLORS[CHECKER.cells]} />
    </Canvas>
  );
}

/** A picture laid on a canvas with others: its sprite, where it lies on the canvas, the box it is drawn into, and whether through the grey filter. */
export interface SpriteLayer {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  grey?: boolean;
}

const sameLayers = (a: readonly SpriteLayer[], b: readonly SpriteLayer[]): boolean =>
  a === b || (a.length === b.length && a.every((one, i) => one.id === b[i].id && one.x === b[i].x && one.y === b[i].y && one.w === b[i].w && one.h === b[i].h && one.grey === b[i].grey));

/**
 * Pictures laid one over the other on one canvas of `size`, the first at the bottom, each as `Sprite` draws one (nearest neighbour into its box, the
 * grey filter where asked, the checkerboard where it has no picture), and cut by the canvas: a portrait on its sky, a medal in its rim, a loop's frames.
 * One canvas, not one a picture: each canvas is a layer of its own that the UI thread makes and draws the first time it is shown, and a list of rows of
 * two pictures each (the records, the collection's badges) or a page of loops (the round's ledger) took twice as many and more, with the frames a fling
 * dropped while they were made (measured, the parity report's performance part). Pixel for pixel what the pictures on canvases of their own drew: each
 * lies on the same whole device pixels. Drawn again only when what it draws changes (its layers compared by their numbers).
 */
export const SpriteLayers = memo(
  function SpriteLayers({ size, layers, alt = '', style }: { size: Size; layers: readonly SpriteLayer[]; alt?: string; style?: ViewStyle }): ReactNode {
    return (
      <View
        accessible={alt !== ''}
        accessibilityRole={alt ? 'image' : undefined}
        accessibilityLabel={alt || undefined}
        aria-hidden={alt ? undefined : true}
        importantForAccessibility={alt ? 'yes' : 'no-hide-descendants'}
        style={[{ width: size.w, height: size.h, flexShrink: 0 }, style]}
      >
        <Canvas style={{ width: size.w, height: size.h }}>
          {layers.map((layer, i) => (
            <LayerPicture key={`${i}:${layer.id}`} {...layer} />
          ))}
        </Canvas>
      </View>
    );
  },
  (a, b) => a.alt === b.alt && a.style === b.style && a.size.w === b.size.w && a.size.h === b.size.h && sameLayers(a.layers, b.layers),
);

/** One picture of a canvas of layers: once decoded, or the checkerboard in its box where it has none. */
function LayerPicture({ id, x, y, w, h, grey = false }: SpriteLayer): ReactNode {
  const known = spriteOf(id) !== null && sourceOf(id) !== undefined;
  if (!known) reportMissing(id, 'missing');
  const { image, failed } = useSpriteImage(known ? id : null);
  const path = useCheckerPath(w, h);
  if (!known || failed) {
    return (
      <Group transform={[{ translateX: x }, { translateY: y }]}>
        <Rect x={0} y={0} width={w} height={h} color={COLORS[CHECKER.ground]} />
        <Path path={path} color={COLORS[CHECKER.cells]} />
      </Group>
    );
  }
  if (!image) return null;
  return (
    <Image image={image} x={x} y={y} width={w} height={h} fit="fill" sampling={PIXELATED}>
      {grey ? <ColorMatrix matrix={GREYSCALE as number[]} /> : null}
    </Image>
  );
}

/**
 * The frames of a loop side by side on one canvas, each drawn into a box of `frame` (`SpriteLayers`): a loop shows one at a time by moving the strip
 * under a box of one frame (Loop.tsx). Drawn again only when its frames or their box change.
 */
export const SpriteStrip = memo(
  function SpriteStrip({ ids, frame }: { ids: readonly string[]; frame: Size }): ReactNode {
    const layers = useMemo(() => ids.map((id, i) => ({ id, x: i * frame.w, y: 0, w: frame.w, h: frame.h })), [ids, frame.w, frame.h]);
    return <SpriteLayers size={{ w: frame.w * ids.length, h: frame.h }} layers={layers} />;
  },
  (a, b) => a.frame.w === b.frame.w && a.frame.h === b.frame.h && a.ids.length === b.ids.length && a.ids.every((id, i) => id === b.ids[i]),
);
