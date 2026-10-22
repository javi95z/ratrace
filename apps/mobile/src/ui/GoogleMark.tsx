import { GOOGLE_LOGO } from '@ratrace/content';
import { Sprite } from './Sprite';

/**
 * Google's "G" in the game's pixels, for the sign-in button (the web's ui/GoogleMark.tsx): the sprite drawn into a square of `size` points, pixel for
 * pixel, on the kit's canvas (`Sprite`, through ui/Canvas.tsx). Decoration: the button's words already say Google, and a screen reader is not told it.
 */
export function GoogleMark({ size = 24 }: { size?: number }) {
  return <Sprite id={GOOGLE_LOGO} fallback={{ w: 32, h: 32 }} size={{ w: size, h: size }} />;
}
