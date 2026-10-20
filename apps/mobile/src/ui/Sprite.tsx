import { Canvas, Fill, FilterMode, Group, Image, MipmapMode, Path, Skia, useImage } from '@shopify/react-native-skia';
import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { View, type ImageSourcePropType, type ViewStyle } from 'react-native';
import { SOURCES } from '../sprites/sources';
import { CHECKER, checkerCells, FALLBACK, reportMissing, spriteBox, spriteOf, type Size, type SpriteScale } from './sprites';
import { COLORS } from './theme';

/** Pixel art is never smoothed: each art pixel becomes a block of whole device pixels. */
export const PIXELATED = { filter: FilterMode.Nearest, mipmap: MipmapMode.None };

/** How many points one art pixel takes on this stage (the web's `--art`): one on a phone, two where there is room. */
export const ArtScale = createContext(1);

/** What Skia is given for a sprite's file (a Metro asset id). */
export const sourceOf = (id: string): ImageSourcePropType | undefined => (Object.hasOwn(SOURCES, id) ? SOURCES[id] : undefined);

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
 * One pixel-art sprite, drawn pixel for pixel with Skia. A sprite that does not exist (or does not load)
 * shows the web's checkerboard at the fallback size and is logged once: the game is playable without art.
 */
export function Sprite({ id, scale = 1, alt = '', fallback = FALLBACK, silhouette = false, style }: Props): ReactNode {
  const art = useContext(ArtScale);
  const [failed, setFailed] = useState<string | null>(null);
  const box = spriteBox(id, scale, art, fallback);
  const source = spriteOf(id) && failed !== id ? sourceOf(id) : undefined;
  if (source === undefined) reportMissing(id, failed === id ? 'did not load' : 'missing');

  return (
    <View
      accessible={alt !== '' && !silhouette}
      accessibilityRole={alt && !silhouette ? 'image' : undefined}
      accessibilityLabel={alt && !silhouette ? alt : undefined}
      aria-hidden={alt && !silhouette ? undefined : true}
      importantForAccessibility={alt && !silhouette ? 'yes' : 'no-hide-descendants'}
      style={[{ width: box.w, height: box.h, flexShrink: 0 }, style]}
    >
      {source === undefined ? (
        <Checker w={box.w} h={box.h} />
      ) : (
        <Drawn
          key={id}
          source={source}
          box={box}
          silhouette={silhouette}
          onError={() => {
            reportMissing(id, 'did not load');
            setFailed(id);
          }}
        />
      )}
    </View>
  );
}

/** The loaded sprite; while it loads the box is already there, empty, so nothing moves when it arrives. */
function Drawn({ source, box, silhouette, onError }: { source: ImageSourcePropType; box: Size; silhouette: boolean; onError: () => void }) {
  const image = useImage(source as number, onError);
  return (
    <Canvas style={{ width: box.w, height: box.h }}>
      {image &&
        (silhouette ? (
          // The sprite is the mask, the colour is the palette's.
          <Group layer>
            <Image image={image} x={0} y={0} width={box.w} height={box.h} fit="fill" sampling={PIXELATED} />
            <Fill color={COLORS['night-900']} blendMode="srcIn" />
          </Group>
        ) : (
          <Image image={image} x={0} y={0} width={box.w} height={box.h} fit="fill" sampling={PIXELATED} />
        ))}
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
