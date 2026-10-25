import { createContext, memo, useContext, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { sourceOf, uriOf, useSpriteImage, useSpriteImages, type SpriteImage } from './spriteImages.web';
import { CHECKER, FALLBACK, reportMissing, spriteBox, spriteOf, type Size, type SpriteScale } from './sprites';
import { COLORS, grey as greyOf } from './theme';

/*
 * The web export's twin of `Sprite.tsx` (Metro picks it for the web; it names its sibling twins by their whole names, as the type checker, which knows
 * no platforms, would otherwise read the phone's). The same props and the same boxes, as the Next web draws them (its `Sprite.tsx`):
 * a plain `<img>` on whole pixels, never smoothed, with no Skia and no canvas.
 */

/** Pixel art is never smoothed: each art pixel becomes a block of whole device pixels. On the web a style, laid on every picture. */
export const PIXELATED = { imageRendering: 'pixelated' } as const satisfies CSSProperties;

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
  /** Where in its box the picture is drawn, and how large, where that is not the whole box (the web's `background-size: cover` on a banner: larger than the box, centred on it, cut by it). */
  place?: Size & { x: number; y: number };
  /** Draws only the outline of the sprite, filled with night-900: something not owned yet. */
  silhouette?: boolean;
  /** Draws it through the web's `grayscale` filter: a picture on a card the web greys whole, a badge not yet earned. */
  grey?: boolean;
  style?: ViewStyle;
  /** Laid over the picture in its box, where it can blend with it (the rainbow of a legendary card). */
  children?: ReactNode;
}

/** The web's placeholder: two 45° gradients, 8 px apart, which draw a checkerboard of 4 px cells, night-700 at the top left, whatever the scale. */
const checkerStyle = (): CSSProperties => {
  const [cells, ground] = [COLORS[CHECKER.cells], COLORS[CHECKER.ground]];
  return {
    backgroundImage: `linear-gradient(45deg, ${cells} 25%, transparent 25%, transparent 75%, ${cells} 75%), linear-gradient(45deg, ${cells} 25%, ${ground} 25%, ${ground} 75%, ${cells} 75%)`,
    backgroundSize: `${CHECKER.cell * 2}px ${CHECKER.cell * 2}px`,
    backgroundPosition: `0 0, ${CHECKER.cell}px ${CHECKER.cell}px`,
  };
};

/** A box of the checkerboard, laid at `x`, `y` of the box that holds it. */
function Checker({ id, x = 0, y = 0, w, h }: { id: string; x?: number; y?: number; w: number; h: number }): ReactNode {
  return <div data-sprite-missing={id} style={{ position: 'absolute', left: x, top: y, width: w, height: h, ...checkerStyle() }} />;
}

/** The picture itself: an `<img>` of whole pixels laid at its place in the box that holds it, which cuts it. `onBroken` is told if the browser cannot draw the file. */
function Picture({ uri, at, alt = '', grey = false, onBroken }: { uri: string; at: Size & { x: number; y: number }; alt?: string; grey?: boolean; onBroken: () => void }): ReactNode {
  return (
    // A plain <img>: sprites are tiny, already final, and must not be resampled by an image optimiser.
    <img
      src={uri}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      width={at.w}
      height={at.h}
      draggable={false}
      decoding="async"
      onError={onBroken}
      style={{ display: 'block', position: 'absolute', left: at.x, top: at.y, width: at.w, height: at.h, userSelect: 'none', filter: grey ? 'grayscale(1)' : undefined, ...PIXELATED }}
    />
  );
}

/**
 * One pixel-art sprite, an `<img>`, drawn at once with its address, size and name (in the export's HTML too, as the Next web's: the browser fetches
 * it with the page, before any script, and the front door's mascot, its largest picture, is painted with its first text). Its file is also read once
 * for the whole app (spriteImages), which counts it among the reads under way until it is in and tells of a file that does not load. A sprite that
 * does not exist, or does not load, shows the checkerboard at the fallback size and is logged once: the game is playable without art.
 */
function SpriteBox({ id, scale = 1, alt = '', fallback = FALLBACK, size, place, silhouette = false, grey = false, style, children }: Props): ReactNode {
  const art = useContext(ArtScale);
  const box = size ?? spriteBox(id, scale, art, fallback);
  const source = spriteOf(id) !== null ? sourceOf(id) : undefined;
  const uri = source !== undefined ? uriOf(source) : null;
  const known = uri !== null;
  if (!known) reportMissing(id, 'missing');
  const { failed } = useSpriteImage(known ? id : null);
  // A file the browser could not draw: told once, and the checkerboard (the id it was seen for, so another sprite starts afresh).
  const [broken, setBroken] = useState<string | null>(null);
  const at = place ?? { x: 0, y: 0, ...box };
  const named = alt !== '' && !silhouette;
  const placeholder = !known || failed || broken === id;

  return (
    <View
      // The picture names itself; the checkerboard in its place is named here.
      role={named && placeholder ? 'img' : undefined}
      aria-label={named && placeholder ? alt : undefined}
      aria-hidden={named ? undefined : true}
      style={[{ width: box.w, height: box.h, flexShrink: 0, overflow: 'hidden' }, style]}
    >
      {/* The box is its size from the start, so nothing moves when the picture arrives. */}
      {placeholder ? (
        <Checker id={id} w={box.w} h={box.h} />
      ) : silhouette ? (
        // The sprite is the mask, the colour is the palette's: no black that the palette does not have.
        <div
          aria-hidden
          data-silhouette={id}
          style={{
            position: 'absolute',
            left: at.x,
            top: at.y,
            width: at.w,
            height: at.h,
            backgroundColor: grey ? greyOf(COLORS['night-900']) : COLORS['night-900'],
            maskImage: `url("${uri}")`,
            WebkitMaskImage: `url("${uri}")`,
            maskSize: '100% 100%',
            WebkitMaskSize: '100% 100%',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
            ...PIXELATED,
          }}
        />
      ) : (
        <>
          <Picture
            uri={uri}
            at={at}
            alt={alt}
            grey={grey}
            onBroken={() => {
              reportMissing(id, 'did not load');
              setBroken(id);
            }}
          />
          {/* A plain box, not a View: react-native-web's View is `z-index: 0`, a stacking context that kept what is laid over the picture from
              blending with it (a legendary card's rainbow, `mix-blend-mode: overlay`, was a veil). As on the phone (drawn in the sprite's canvas), it
              takes no touch. */}
          {children ? <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>{children}</div> : null}
        </>
      )}
    </View>
  );
}

/** Two boxes alike (a size, a place, a fallback): the same numbers, as callers write a new one each time they draw. */
const sameBox = (a: Partial<Size & { x: number; y: number }> | undefined, b: Partial<Size & { x: number; y: number }> | undefined): boolean =>
  a === b || (a !== undefined && b !== undefined && a.w === b.w && a.h === b.h && a.x === b.x && a.y === b.y);

/**
 * A sprite is drawn again only when what it draws changes: a line that holds it drawn again for its words leaves its picture alone. Its boxes are
 * compared by their numbers; its style and what it draws over the picture by identity.
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

/** A picture laid in a box with others: its sprite, where it lies in the box, the size it is drawn at, and whether through the grey filter. */
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
 * Pictures laid one over the other in one box of `size`, the first at the bottom, each as `Sprite` draws one (nearest neighbour into its box, the grey
 * filter where asked, the checkerboard where it has no picture), and cut by the box: a portrait on its sky, a medal in its rim, a loop's frames.
 * The pictures are read first, and the box is filled once every one of them is in (or has failed), as `Sprite` fills its own, so a box of layers
 * never shows some of its pictures and not the rest. Drawn again only when what it draws changes (its layers compared by their numbers).
 */
export const SpriteLayers = memo(
  function SpriteLayers({ size, layers, alt = '', style }: { size: Size; layers: readonly SpriteLayer[]; alt?: string; style?: ViewStyle }): ReactNode {
    const known = layers.map((layer) => spriteOf(layer.id) !== null && sourceOf(layer.id) !== undefined);
    for (const [i, layer] of layers.entries()) if (!known[i]) reportMissing(layer.id, 'missing');
    const images = useSpriteImages(layers.map((layer, i) => (known[i] ? layer.id : null)));
    // Every picture in, or failed (or with no file at all): only then is anything drawn, as a sprite is.
    const ready = images.every((state, i) => !known[i] || state.failed || state.image !== null);
    return (
      <View
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        style={[{ width: size.w, height: size.h, flexShrink: 0, overflow: 'hidden' }, style]}
      >
        {ready ? layers.map((layer, i) => <LayerPicture key={`${i}:${layer.id}`} layer={layer} picture={known[i] ? images[i] : null} />) : null}
      </View>
    );
  },
  (a, b) => a.alt === b.alt && a.style === b.style && a.size.w === b.size.w && a.size.h === b.size.h && sameLayers(a.layers, b.layers),
);

/** One picture of a box of layers, as read: the `<img>`, or the checkerboard in its place where it failed or has no file (`picture` null). */
function LayerPicture({ layer, picture }: { layer: SpriteLayer; picture: SpriteImage | null }): ReactNode {
  const [broken, setBroken] = useState(false);
  const { id, x, y, w, h, grey = false } = layer;
  if (picture === null || picture.failed || picture.image === null || broken) return <Checker id={id} x={x} y={y} w={w} h={h} />;
  return (
    <Picture
      uri={picture.image.uri}
      at={{ x, y, w, h }}
      grey={grey}
      onBroken={() => {
        reportMissing(id, 'did not load');
        setBroken(true);
      }}
    />
  );
}

/**
 * The frames of a loop side by side in one box, each drawn into a box of `frame` (`SpriteLayers`): a loop shows one at a time by moving the strip
 * under a box of one frame (Loop.tsx). Drawn again only when its frames or their box change.
 */
export const SpriteStrip = memo(
  function SpriteStrip({ ids, frame }: { ids: readonly string[]; frame: Size }): ReactNode {
    const layers = ids.map((id, i) => ({ id, x: i * frame.w, y: 0, w: frame.w, h: frame.h }));
    return <SpriteLayers size={{ w: frame.w * ids.length, h: frame.h }} layers={layers} />;
  },
  (a, b) => a.frame.w === b.frame.w && a.frame.h === b.frame.h && a.ids.length === b.ids.length && a.ids.every((id, i) => id === b.ids[i]),
);
