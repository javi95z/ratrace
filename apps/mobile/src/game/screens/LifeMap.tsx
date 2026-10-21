import { lives, MAP_ART, MAP_PLACES } from '@ratrace/content';
import type { Milestone } from '@ratrace/content';
import { DashPathEffect, Path, Rect } from '@shopify/react-native-skia';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
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

type Place = { x: number; y: number };

/**
 * The web's drawing over the map (an SVG of the map's shape, a hundred units wide), in points on a map drawn `width` wide: a gold dashed line from city to
 * city (none for a life lived in one), and a light on each city, outlined in the night, the last the brightest and the largest.
 */
export function routeLights(places: readonly Place[], width: number, ratio: number) {
  const unit = width / 100;
  const at = (place: Place) => ({ x: place.x * width, y: place.y * width * ratio });
  const line =
    places.length > 1
      ? {
          path: places.map((place, i) => `${i === 0 ? 'M' : 'L'}${at(place).x} ${at(place).y}`).join(' '),
          strokeWidth: 0.6 * unit,
          dash: [1.2 * unit, 0.8 * unit],
          color: COLORS['gold-500'],
        }
      : null;
  const lights = places.map((place, i) => {
    const last = i === places.length - 1;
    const half = (last ? 1.4 : 0.9) * unit;
    return { x: at(place).x - half, y: at(place).y - half, size: (last ? 2.8 : 1.8) * unit, fill: COLORS[last ? 'cream' : 'gold-500'], edge: COLORS['night-900'], edgeWidth: 0.3 * unit };
  });
  return { line, lights };
}

/**
 * The world at night with the way a life went across it: a gold line from city to city, a light on each one lived in, the last brightest. Drawn as
 * wide as there is room, up to the map's own size, its pixels square at any width (nearest neighbour), with the route drawn over it in the map's own canvas.
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
    const { line, lights } = routeLights(places, width, ratio);
    return (
      <>
        {line ? (
          <Path path={line.path} style="stroke" strokeWidth={line.strokeWidth} strokeJoin="round" color={line.color}>
            <DashPathEffect intervals={line.dash} />
          </Path>
        ) : null}
        {/* Each light filled and then outlined, before the next: the SVG's order, which matters where two cities' lights overlap. */}
        {lights.flatMap((light, i) => [
          <Rect key={`fill-${i}`} x={light.x} y={light.y} width={light.size} height={light.size} color={light.fill} />,
          <Rect key={`edge-${i}`} x={light.x} y={light.y} width={light.size} height={light.size} style="stroke" strokeWidth={light.edgeWidth} color={light.edge} />,
        ])}
      </>
    );
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
