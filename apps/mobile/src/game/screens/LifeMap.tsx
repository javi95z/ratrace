import { lives, MAP_ART, MAP_PLACES } from '@ratrace/content';
import type { Milestone } from '@ratrace/content';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { RouteLayer, type Place } from '../../ui/RouteLayer';
import { Sprite } from '../../ui/Sprite';
import { spriteOf } from '../../ui/sprites';
import { COLORS } from '../../ui/theme';

/** The cities a life lived in, in the order it came to them: where it began, then every move. */
export function routeOf(lifeId: string, story: readonly Milestone[]): string[] {
  const start = lives.find((life) => life.id === lifeId)?.start.cityId;
  const route = start ? [start] : [];
  for (const m of story) if (m.kind === 'moved' && route[route.length - 1] !== m.cityId) route.push(m.cityId);
  return route;
}

export { routeLights } from '../../ui/RouteLayer';

/**
 * The world at night with the way a life went across it: a gold line from city to city, a light on each one lived in, the last brightest. Drawn as
 * wide as there is room, up to the map's own size, its pixels square at any width (nearest neighbour), with the route drawn over it (the kit's `RouteLayer`, in the map's own canvas on the phone).
 */
export function LifeMap({ route, label }: { route: readonly string[]; label: string }) {
  const map = spriteOf(MAP_ART);
  const places = route.map((city) => MAP_PLACES[city]).filter((place): place is Place => place !== undefined);
  // The width the map is drawn at, once the page has laid it out: its box has the map's shape from the first frame, so nothing moves when it is drawn.
  const [width, setWidth] = useState<number | null>(null);
  const key = places.map((place) => `${place.x},${place.y}`).join(' ');
  const ratio = map ? map.h / map.w : 1;
  // Made again only for another width or another route: the map's canvas is drawn again only then (the Sprite compares what it draws over its picture).
  const over = useMemo(() => {
    if (width === null) return null;
    return <RouteLayer places={places} width={width} ratio={ratio} />;
    // The route is the places' own numbers (`key`), not the array, which is made anew each drawing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, key, ratio]);
  if (!map || places.length === 0) return null;
  return (
    <View role="img" aria-label={label} style={{ width: '100%', maxWidth: map.w, alignSelf: 'center', borderWidth: 2, borderColor: COLORS['night-900'], overflow: 'hidden' }}>
      <View style={{ width: '100%', aspectRatio: map.w / map.h }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {width !== null ? (
          <Sprite id={MAP_ART} size={{ w: width, h: width * ratio }}>
            {over}
          </Sprite>
        ) : null}
      </View>
    </View>
  );
}
