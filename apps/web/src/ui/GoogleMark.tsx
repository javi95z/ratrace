/**
 * Google's "G" drawn in the game's pixels, in Google's four colours, so the sign-in button belongs
 * to the rest of the screen. Decoration: the button's words already say Google.
 */
const ROWS = [
  '....RRRR....',
  '..RRRRRRRR..',
  '.RRR....RRR.',
  '.RR.........',
  'RR..........',
  'YY....BBBBBB',
  'YY....BBBBBB',
  'YY........BB',
  '.YG.......BB',
  '.GGG....BBB.',
  '..GGGGGGBB..',
  '....GGGG....',
];
const COLOUR: Record<string, string> = { R: '#ea4335', Y: '#fbbc05', G: '#34a853', B: '#4285f4' };

export function GoogleMark({ size = 24 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" className="shrink-0">
      {ROWS.flatMap((row, y) =>
        [...row].map((cell, x) => (cell === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={COLOUR[cell]} />)),
      )}
    </svg>
  );
}
