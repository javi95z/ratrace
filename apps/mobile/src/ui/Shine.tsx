import { Group, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import Animated, { useDerivedValue } from 'react-native-reanimated';
import { useGlint, useHolo, useReducedMotion, type KeyframeOptions } from './animations';
import { HOLO_COLORS, holoGradient } from './lights';
import { frameAt, holoShift, styleOf } from './motion';
import { EXTRA } from './theme';

/** `held`: stand still at this progress (0 to 1) of the effect and play nothing, for a page that compares one frame with the web's. */
type Held = { held?: number };

export { HOLO_COLORS, holoGradient };

/**
 * The rainbow that slides across a legendary card (the web's `absolute inset-0 animate-holo opacity-40 mix-blend-overlay`
 * with its gradient at `background-size: 200% 100%`). It is drawn into the card's picture, as a child of its `Sprite`:
 * `overlay` blends with what is under it, and a view laid over another cannot blend with a canvas (nothing shows). The web's
 * background is a gradient two boxes wide that repeats and slides left by 200 % of a box (`holoShift`), so the end is where it
 * began: here it is the gradient twice over, side by side, and the pair slides. `width` and `height` are the picture's, in
 * points. It is blended as `overlay` at 40 %: no two pieces of it overlap, so no layer is needed.
 */
export function Holo({ width, height, held, ...opts }: { width: number; height: number } & Held & KeyframeOptions) {
  const still = useReducedMotion(opts.reduced);
  const slid = useHolo({ ...opts, play: held === undefined && opts.play !== false });
  const sliding = useDerivedValue(() => [{ translateX: holoShift(slid.value, width) }]);
  if (still) return null;
  const { start, end } = holoGradient(2 * width, height);
  return (
    <Group blendMode="overlay" opacity={0.4}>
      <Group transform={held === undefined ? sliding : [{ translateX: holoShift(frameAt('holo', held).bgX, width) }]}>
        {[0, 1].map((i) => (
          <Rect key={i} x={i * 2 * width} y={0} width={2 * width} height={height}>
            <LinearGradient start={vec(start.x + i * 2 * width, start.y)} end={vec(end.x + i * 2 * width, end.y)} colors={HOLO_COLORS} />
          </Rect>
        ))}
      </Group>
    </Group>
  );
}

/**
 * The band of light that crosses a rare card now and then (the web's `absolute inset-y-0 left-0 w-1/5 animate-glint bg-white/40`):
 * a white band `share` of the box wide, the full height of it, on a skew. It crosses the box and leaves it, then waits out of
 * sight. Put it in a box that clips. Pass `once` for a single crossing, and `rest` for the band's own look outside it
 * (the Hud's `opacity-0`).
 */
export function Glint({ share = 0.2, held, ...opts }: { share?: number } & Held & KeyframeOptions) {
  const still = useReducedMotion(opts.reduced);
  const move = useGlint({ ...opts, play: held === undefined && opts.play !== false });
  if (still) return null;
  return (
    <Animated.View
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { position: 'absolute', top: 0, bottom: 0, left: 0, width: `${share * 100}%`, backgroundColor: EXTRA.glint, pointerEvents: 'none' },
        held === undefined ? move : (styleOf('glint', frameAt('glint', held)) as object),
      ]}
    />
  );
}
