import { COLORS } from './theme';

/*
 * The pure side of the screens' own small drawings: the news page's dashed rule, the gold rays behind a portrait, and the route over the life's map.
 * The phone draws them on a Skia canvas (`DashedRule.tsx`, `Rays.tsx`, `RouteLayer.tsx`), the web export as SVG (their `.web.tsx` twins); both read
 * the same numbers from here, so the two cannot part ways on a dash, a ray or a light.
 */

/** Chrome's dashes on a border `width` thick (a dashed rule): each three times as long as it is thick, two widths apart at best. */
export const DASH = 3;
const GAP = 2;

/**
 * Where the dashes of a dashed rule `length` long start, as Chrome lays them (its `SelectBestDashGap`): a dash at each end, and the gap between
 * them stretched or shrunk from its preferred two widths to whichever whole count of dashes leaves it nearest to that.
 */
export function dashesOf(length: number, width = 1): number[] {
  const dash = DASH * width;
  const gap = GAP * width;
  const fewest = Math.floor((length + gap) / (dash + gap));
  const most = fewest + 1;
  const fewGap = (length - fewest * dash) / (fewest - 1);
  const mostGap = (length - most * dash) / (most - 1);
  const [count, between] = mostGap <= 0 || Math.abs(fewGap - gap) < Math.abs(mostGap - gap) ? [fewest, fewGap] : [most, mostGap];
  return Array.from({ length: count }, (_, i) => i * (dash + between));
}

/** The dashes of a rule `length` long and 1 high, as one path: a box of `DASH` by 1 at each place `dashesOf` gives. Nothing for a rule not yet measured. */
export function ruleOf(length: number | null): string {
  return length === null ? '' : dashesOf(length).map((x) => `M${x} 0h${DASH}v1h-${DASH}Z`).join(' ');
}

/**
 * The web's `repeating-conic-gradient(from 0deg at 50% 100%, gold-700 0 10deg, gold-900 10deg 20deg)` in a box `w` by `h`: rays of
 * gold from the middle of its foot, every other ten degrees, the first one from straight up turning clockwise. The gold-700 rays, as one path.
 */
export function raysOf(w: number, h: number): string {
  const reach = 2 * Math.max(w, h);
  const at = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return `${(w / 2 + reach * Math.sin(rad)).toFixed(2)} ${(h - reach * Math.cos(rad)).toFixed(2)}`;
  };
  return Array.from({ length: 18 }, (_, i) => `M${w / 2} ${h} L${at(i * 20)} L${at(i * 20 + 10)} Z`).join(' ');
}

/** Where a city lies on the map: `x` as a fraction of the map's width, `y` as a fraction of its height, as the content's `MAP_PLACES` give them. */
export type Place = { x: number; y: number };

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
