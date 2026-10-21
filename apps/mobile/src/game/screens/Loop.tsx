import { loopArt, wheelArt } from '@ratrace/content';
import type { Loop as LoopName, RatOutfit } from '@ratrace/content';
import { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Sprite, SpriteStrip } from '../../ui/Sprite';
import { spriteBox } from '../../ui/sprites';
import type { Size } from '../../ui/sprites';
import { useStill } from '../context';

/** The size a loop's frame is drawn at when its art is missing (the web's). */
const FALLBACK = { w: 48, h: 48 };

/**
 * The frame a loop of `n` frames shows `at` frames into its run: each one for a frame's time, then the next, and the first again after
 * the last (the web's `setInterval` stepping `(at + 1) % frames.length` every `ms`).
 */
export function loopFrame(at: number, n: number): number {
  'worklet';
  return Math.floor(at) % n;
}

/**
 * A few frames played over and over: a coin turning, the wheel, confetti. It is decoration and says
 * nothing a screen reader needs. With motion reduced it stands still on its first frame.
 *
 * The web steps a frame index in React state with a timer, which draws the page again for each frame. Here every frame is drawn once,
 * side by side on one canvas (`SpriteStrip`), and one timing on the phone's animation thread (Reanimated, a run of `ms` per frame, repeated)
 * moves the strip under a box of one frame: nothing of React runs while it turns, and a sprite is never decoded or drawn again for a frame. `size` is the box every frame
 * is drawn into where the web forces one (`!h-full !w-full` in a `size-6`: a flying coin), whatever the art's own size.
 */
export function Loop({ name, outfit, ms = 150, scale = 1, size, style }: { name: LoopName; outfit?: RatOutfit; ms?: number; scale?: 1 | 2 | 3; size?: Size; style?: ViewStyle }) {
  const still = useStill();
  // The rat in the wheel dresses as the life is lived.
  const frames = name === 'wheel' && outfit ? wheelArt(outfit) : loopArt(name);
  if (still) return <Sprite id={frames[0]} scale={scale} size={size} fallback={FALLBACK} style={style} />;
  return <Turning frames={frames} ms={ms} scale={scale} size={size} style={style} />;
}

function Turning({ frames, ms, scale, size, style }: { frames: string[]; ms: number; scale: 1 | 2 | 3; size?: Size; style?: ViewStyle }) {
  const at = useSharedValue(0);
  const n = frames.length;
  useEffect(() => {
    at.value = 0;
    at.value = withRepeat(withTiming(n, { duration: ms * n, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(at);
  }, [at, n, ms]);
  const box = size ?? spriteBox(frames[0], scale, 1, FALLBACK);
  // The frames side by side on one canvas, moved under a box of one frame by whole frames (whole points: no picture is resampled).
  const strip = useAnimatedStyle(() => ({ transform: [{ translateX: -loopFrame(at.value, n) * box.w }] }));
  return (
    <View style={[{ width: box.w, height: box.h, overflow: 'hidden' }, style]}>
      <Animated.View {...{ dataSet: { loopStrip: String(n) } }} style={[{ position: 'absolute', top: 0, left: 0 }, strip]}>
        <SpriteStrip ids={frames} frame={box} />
      </Animated.View>
    </View>
  );
}
