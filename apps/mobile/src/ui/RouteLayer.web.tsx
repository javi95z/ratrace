import { routeLights, type Place } from './drawings';

/*
 * The web export's twin of `RouteLayer.tsx` (Metro picks it for the web): the same line and lights, from the same numbers, as an SVG as large as the map
 * and laid over its picture (the web's `Sprite` draws its children above the `<img>`), with no Skia.
 */

export { routeLights };
export type { Place };

/** The route over the life's map (the phone's, in SVG): a gold dashed line from city to city and a light on each one lived in. */
export function RouteLayer({ places, width, ratio }: { places: readonly Place[]; width: number; ratio: number }) {
  const { line, lights } = routeLights(places, width, ratio);
  const height = width * ratio;
  return (
    <svg aria-hidden width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', top: 0, left: 0, display: 'block' }}>
      {line ? <path d={line.path} fill="none" stroke={line.color} strokeWidth={line.strokeWidth} strokeDasharray={line.dash.join(' ')} strokeLinejoin="round" /> : null}
      {lights.map((light, i) => (
        <rect key={i} x={light.x} y={light.y} width={light.size} height={light.size} fill={light.fill} stroke={light.edge} strokeWidth={light.edgeWidth} />
      ))}
    </svg>
  );
}
