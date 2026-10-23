import type { ReactNode } from 'react';
import { glowOf } from './lights';

/*
 * The web export's twin of `Glow.tsx` (Metro picks it for the web): the glow is the browser's own box-shadow, with no Skia and no canvas.
 */

export { glowOf };

/**
 * The light a box stands in (the web's glow round a badge's card: its `frame`'s `--glow`, globals.css). The first child of the box it lights,
 * filling it, so that the box's own fill and frame are drawn over it. The shadow is the very string the Next web gives its frame, laid on a
 * box of nothing: a browser paints an outer shadow only outside the box it belongs to, so it is seen outside the box only, as the phone's is.
 * (A `drop-shadow` filter would draw nothing here: it shades what its element paints, and this paints nothing.) Nothing at all for a
 * shadow that is not a glow (none for a bronze badge). It takes no touch and says nothing to a screen reader.
 */
export function Glow({ shadow }: { shadow: string }): ReactNode {
  if (glowOf(shadow) === null) return null;
  return <div aria-hidden data-glow={shadow} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, boxShadow: shadow, pointerEvents: 'none' }} />;
}
