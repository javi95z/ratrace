import { Path } from '@shopify/react-native-skia';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Canvas } from './Canvas';
import { ruleOf } from './drawings';
import { COLORS, type ColorToken } from './theme';

export { dashesOf, ruleOf } from './drawings';

/** The dashes of a rule `length` points long and 1 high, drawn where Chrome draws them. */
export function Dashes({ length, tone = 'ink-300' }: { length: number; tone?: ColorToken }) {
  const path = useMemo(() => ruleOf(length), [length]);
  return (
    <Canvas style={{ width: length, height: 1 }}>
      <Path path={path} color={COLORS[tone]} />
    </Canvas>
  );
}

/**
 * A dashed rule as wide as the room it is in, 1 high (the web's `border-t border-dashed border-ink-300`): drawn once the room is measured, its
 * dashes where Chrome puts them, so that a page of the phone shot beside the web's shows the same rule.
 */
export function DashedRule({ tone = 'ink-300' }: { tone?: ColorToken }) {
  const [length, setLength] = useState<number | null>(null);
  return (
    <View onLayout={(event) => setLength(event.nativeEvent.layout.width)} style={{ height: 1 }}>
      {length === null ? null : <Dashes length={length} tone={tone} />}
    </View>
  );
}
