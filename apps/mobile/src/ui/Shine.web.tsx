import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useGlint, useHolo, useReducedMotion, type KeyframeOptions } from './animations';
import { HOLO_COLORS, holoGradient } from './lights';
import { frameAt, holoShift, styleOf } from './motion';
import { EXTRA } from './theme';

/*
 * The web export's twin of `Shine.tsx` (Metro picks it for the web): the rainbow and the band of light are CSS gradients and boxes, moved by the
 * same animation hooks as the phone's (so the same timing, `once` and `rest`), with no Skia.
 */

/** `held`: stand still at this progress (0 to 1) of the effect and play nothing, for a page that compares one frame with the web's. */
type Held = { held?: number };

export { HOLO_COLORS, holoGradient };

/**
 * The rainbow that slides across a legendary card (the web's `absolute inset-0 animate-holo opacity-40 mix-blend-overlay` with its gradient at
 * `background-size: 200% 100%`), as the Next web writes it. It is laid over the card's picture, as a child of its `Sprite`, where `mix-blend-mode`
 * blends it with the picture under it. The web's background is a gradient two boxes wide that repeats and slides left by 200 % of a box
 * (`holoShift`), so the end is where it began: here a box holds the gradient twice over, side by side, and the pair slides. `width` and `height`
 * are the picture's, in points. It is blended as `overlay` at 40 %.
 */
export function Holo({ width, height, held, ...opts }: { width: number; height: number } & Held & KeyframeOptions) {
  const still = useReducedMotion(opts.reduced);
  const slid = useHolo({ ...opts, play: held === undefined && opts.play !== false });
  const sliding = useAnimatedStyle(() => ({ transform: [{ translateX: holoShift(slid.value, width) }] }));
  if (still) return null;
  return (
    <div
      aria-hidden
      style={{ position: 'absolute', top: 0, left: 0, width, height, overflow: 'hidden', opacity: 0.4, mixBlendMode: 'overlay', pointerEvents: 'none' }}
    >
      <Animated.View style={[{ width: 4 * width, height }, held === undefined ? sliding : { transform: [{ translateX: holoShift(frameAt('holo', held).bgX, width) }] }]}>
        <div
          data-holo
          style={{
            width: '100%',
            height: '100%',
            backgroundImage: `linear-gradient(110deg, ${HOLO_COLORS.join(', ')})`,
            backgroundSize: `${2 * width}px ${height}px`,
            backgroundRepeat: 'repeat-x',
          }}
        />
      </Animated.View>
    </div>
  );
}

/**
 * The band of light that crosses a rare card now and then (the web's `absolute inset-y-0 left-0 w-1/5 animate-glint bg-white/40`): a white band
 * `share` of the box wide, the full height of it, on a skew. It crosses the box and leaves it, then waits out of sight. Put it in a box that clips.
 * Pass `once` for a single crossing, and `rest` for the band's own look outside it (the Hud's `opacity-0`).
 */
export function Glint({ share = 0.2, held, ...opts }: { share?: number } & Held & KeyframeOptions) {
  const still = useReducedMotion(opts.reduced);
  const move = useGlint({ ...opts, play: held === undefined && opts.play !== false });
  if (still) return null;
  return (
    <Animated.View
      aria-hidden
      style={[
        { position: 'absolute', top: 0, bottom: 0, left: 0, width: `${share * 100}%`, backgroundColor: EXTRA.glint, pointerEvents: 'none' },
        held === undefined ? move : (styleOf('glint', frameAt('glint', held)) as object),
      ]}
    />
  );
}
