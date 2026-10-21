import { loopArt, wheelArt } from '@ratrace/content';
import type { Loop as LoopName, RatOutfit } from '@ratrace/content';
import { useEffect, type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import { Sprite } from '../../ui/Sprite';
import { spriteBox } from '../../ui/sprites';
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
 * one over the other, and one timing on the phone's animation thread (Reanimated, a run of `ms` per frame, repeated) says which of them
 * shows: nothing of React runs while it turns, and a sprite is never decoded or drawn again for a frame.
 */
export function Loop({ name, outfit, ms = 150, scale = 1, style }: { name: LoopName; outfit?: RatOutfit; ms?: number; scale?: 1 | 2 | 3; style?: ViewStyle }) {
  const still = useStill();
  // The rat in the wheel dresses as the life is lived.
  const frames = name === 'wheel' && outfit ? wheelArt(outfit) : loopArt(name);
  if (still) return <Sprite id={frames[0]} scale={scale} fallback={FALLBACK} style={style} />;
  return <Turning frames={frames} ms={ms} scale={scale} style={style} />;
}

function Turning({ frames, ms, scale, style }: { frames: string[]; ms: number; scale: 1 | 2 | 3; style?: ViewStyle }) {
  const at = useSharedValue(0);
  const n = frames.length;
  useEffect(() => {
    at.value = 0;
    at.value = withRepeat(withTiming(n, { duration: ms * n, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(at);
  }, [at, n, ms]);
  const box = spriteBox(frames[0], scale, 1, FALLBACK);
  return (
    <View style={[{ width: box.w, height: box.h }, style]}>
      {frames.map((id, index) => (
        <Frame key={id} at={at} index={index} n={n}>
          <Sprite id={id} scale={scale} fallback={FALLBACK} />
        </Frame>
      ))}
    </View>
  );
}

/** One frame of a loop, shown while the run is at it. */
function Frame({ at, index, n, children }: { at: SharedValue<number>; index: number; n: number; children: ReactNode }) {
  const shown = useAnimatedStyle(() => ({ opacity: loopFrame(at.value, n) === index ? 1 : 0 }));
  return (
    <Animated.View {...{ dataSet: { frameOf: String(index) } }} style={[{ position: 'absolute', top: 0, left: 0 }, shown]}>
      {children}
    </Animated.View>
  );
}
