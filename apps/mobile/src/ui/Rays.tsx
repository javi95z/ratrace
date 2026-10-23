import { Fill, Path } from '@shopify/react-native-skia';
import { Canvas } from './Canvas';
import { raysOf } from './drawings';
import { COLORS } from './theme';

export { raysOf } from './drawings';

/**
 * The gold rays behind a portrait of a gold frame (the web's `repeating-conic-gradient` of gold-700 and gold-900), in a square of `size` points:
 * gold-900 all over and the gold-700 rays from the middle of its foot.
 */
export function Rays({ size }: { size: number }) {
  return (
    <Canvas style={{ width: size, height: size }}>
      <Fill color={COLORS['gold-900']} />
      <Path path={raysOf(size, size)} color={COLORS['gold-700']} />
    </Canvas>
  );
}
