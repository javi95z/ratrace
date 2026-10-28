import { backdropArt, lives, portraitArt } from '@ratrace/content';
import { useMemo } from 'react';
import { Face } from '../../ui/Picker';
import { SpriteLayers } from '../../ui/Sprite';

/**
 * The face a life is chosen by, on the sky of the city it begins in: lives tell apart at a glance in a list. `size` 'lg' is the whole portrait on its
 * sky, `px` points square (a tile of the lives to choose from, the sheet of one): nearest neighbour into the box, as every sprite is drawn.
 */
export function LifeFace({ lifeId, size = 'sm', px = 64 }: { lifeId: string; size?: 'sm' | 'md' | 'lg'; px?: number }) {
  const city = lives.find((life) => life.id === lifeId)?.start.cityId;
  if (size === 'lg') return <WholeFace lifeId={lifeId} city={city} px={px} />;
  return <Face id={portraitArt(lifeId, 22)} size={size} backdrop={city ? backdropArt(city) : undefined} />;
}

/** The whole portrait over its city's sky, one canvas of the two (`SpriteLayers`). */
function WholeFace({ lifeId, city, px }: { lifeId: string; city: string | undefined; px: number }) {
  const layers = useMemo(
    () => [...(city ? [{ id: backdropArt(city), x: 0, y: 0, w: px, h: px }] : []), { id: portraitArt(lifeId, 22), x: 0, y: 0, w: px, h: px }],
    [lifeId, city, px],
  );
  return <SpriteLayers size={{ w: px, h: px }} layers={layers} />;
}
