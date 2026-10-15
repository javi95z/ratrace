import { GOOGLE_LOGO } from '@ratrace/content';
import { Sprite } from './Sprite';

/** Google's "G" in the game's pixels, for the sign-in button. Decoration: the button's words already say Google. */
export function GoogleMark({ size = 24 }: { size?: number }) {
  return (
    <span aria-hidden className="inline-flex shrink-0" style={{ width: size, height: size }}>
      <Sprite id={GOOGLE_LOGO} fallback={{ w: 32, h: 32 }} className="!h-full !w-full" />
    </span>
  );
}
