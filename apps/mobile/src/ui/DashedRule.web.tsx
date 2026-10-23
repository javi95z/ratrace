import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { ruleOf } from './drawings';
import { COLORS, type ColorToken } from './theme';

/*
 * The web export's twin of `DashedRule.tsx` (Metro picks it for the web): the same dashes from the same path, as an SVG, with no Skia and no canvas.
 */

export { dashesOf, ruleOf } from './drawings';

/** The dashes of a rule `length` points long and 1 high, as an SVG of that size. */
export function Dashes({ length, tone = 'ink-300' }: { length: number; tone?: ColorToken }) {
  const path = useMemo(() => ruleOf(length), [length]);
  return (
    <svg aria-hidden width={length} height={1} viewBox={`0 0 ${length} 1`} style={{ display: 'block' }}>
      <path d={path} fill={COLORS[tone]} />
    </svg>
  );
}

/** A dashed rule as wide as the room it is in, 1 high, drawn once the room is measured (the phone's, in SVG). */
export function DashedRule({ tone = 'ink-300' }: { tone?: ColorToken }) {
  const [length, setLength] = useState<number | null>(null);
  return (
    <View onLayout={(event) => setLength(event.nativeEvent.layout.width)} style={{ height: 1 }}>
      {length === null ? null : <Dashes length={length} tone={tone} />}
    </View>
  );
}
