import { raysOf } from './drawings';
import { COLORS } from './theme';

/*
 * The web export's twin of `Rays.tsx` (Metro picks it for the web): the same square and the same rays, as an SVG, with no Skia and no canvas.
 */

export { raysOf } from './drawings';

/** The gold rays behind a portrait of a gold frame, in a square of `size` points (the phone's, in SVG). */
export function Rays({ size }: { size: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      <rect width={size} height={size} fill={COLORS['gold-900']} />
      <path d={raysOf(size, size)} fill={COLORS['gold-700']} />
    </svg>
  );
}
