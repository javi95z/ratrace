import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { anchorsOf, type FrameKind, type FrameTone } from './frames';
import { COLORS } from './theme';

interface FramedProps {
  kind: FrameKind;
  tone?: FrameTone;
  style?: ViewStyle | ViewStyle[];
  accessibilityLabel?: string;
  testID?: string;
  children?: ReactNode;
}

/**
 * A box with the web's hard pixel frame. The frame's strips are absolute Views anchored to the
 * box's edges (so they are there on the first paint and follow every resize), and they take no
 * space: the children lie exactly where they would with no frame at all.
 */
export function Framed({ kind, tone = {}, style, accessibilityLabel, testID, children }: FramedProps): ReactNode {
  return (
    <View style={style} accessibilityLabel={accessibilityLabel} testID={testID}>
      {anchorsOf(kind, tone).map(({ color, ...place }, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={{ position: 'absolute', ...place, backgroundColor: COLORS[color] }}
        />
      ))}
      {children}
    </View>
  );
}
