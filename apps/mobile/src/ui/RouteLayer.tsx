import { DashPathEffect, Path, Rect } from '@shopify/react-native-skia';
import { routeLights, type Place } from './drawings';

export { routeLights };
export type { Place };

/**
 * The route over the life's map, to be laid over its picture (a child of the `Sprite` that draws the map, so inside that picture's canvas): a gold
 * dashed line from city to city, and a light on each one lived in. `places` are the cities, `width` how wide the map is drawn and `ratio` its height
 * over its width. Each light is filled and then outlined before the next: the SVG's order, which matters where two cities' lights overlap.
 */
export function RouteLayer({ places, width, ratio }: { places: readonly Place[]; width: number; ratio: number }) {
  const { line, lights } = routeLights(places, width, ratio);
  return (
    <>
      {line ? (
        <Path path={line.path} style="stroke" strokeWidth={line.strokeWidth} strokeJoin="round" color={line.color}>
          <DashPathEffect intervals={line.dash} />
        </Path>
      ) : null}
      {lights.flatMap((light, i) => [
        <Rect key={`fill-${i}`} x={light.x} y={light.y} width={light.size} height={light.size} color={light.fill} />,
        <Rect key={`edge-${i}`} x={light.x} y={light.y} width={light.size} height={light.size} style="stroke" strokeWidth={light.edgeWidth} color={light.edge} />,
      ])}
    </>
  );
}
