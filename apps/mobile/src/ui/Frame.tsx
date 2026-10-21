import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { anchorsOf, type Anchor, type FrameKind, type FrameTone } from './frames';
import { COLORS, grey as greyOf } from './theme';

/**
 * How a strip is laid. One anchored to the box's top or left (or stretched between two edges) is placed by them. One anchored to the box's far edge
 * with a size of its own (the bottom or the right: `bottom: -2, height: 2`) is laid as a box from the near edge to that far edge, the strip its border
 * there. Yoga rounds a child's place to the device's pixels relative to its parent, but the parent's size from its edges on the screen: at a fractional
 * place the two disagree, and a strip placed from the far edge stood a device pixel off the box's own fill (a gap under a cell of End's score in
 * Russian, measured: the fill to 550.00, the strip from 550.33; the light edge of a thing's tile a device pixel short of its corner). A box from the
 * near edge has its far edge rounded where the parent's own is.
 */
export function placeOf(at: Anchor, paint: string): ViewStyle {
  const style: ViewStyle = { position: 'absolute' };
  let bordered = false;
  if (at.top === undefined && at.bottom !== undefined && at.height !== undefined) {
    Object.assign(style, { top: 0, bottom: at.bottom, borderBottomWidth: at.height, borderBottomColor: paint });
    bordered = true;
  } else Object.assign(style, { top: at.top, bottom: at.bottom, height: at.height });
  if (at.left === undefined && at.right !== undefined && at.width !== undefined) {
    Object.assign(style, { left: 0, right: at.right, borderRightWidth: at.width, borderRightColor: paint });
    bordered = true;
  } else Object.assign(style, { left: at.left, right: at.right, width: at.width });
  return bordered ? style : { ...style, backgroundColor: paint };
}

interface FramedProps {
  kind: FrameKind;
  tone?: FrameTone;
  /** Its strips in the grey of their colours: the frame of a box the web draws through its `grayscale` filter (the box's own colours are its caller's to grey). */
  grey?: boolean;
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
export function Framed({ kind, tone = {}, grey = false, style, accessibilityLabel, testID, children }: FramedProps): ReactNode {
  return (
    <View style={style} accessibilityLabel={accessibilityLabel} testID={testID}>
      {anchorsOf(kind, tone).map((anchor, i) => (
        <View key={i} pointerEvents="none" style={placeOf(anchor, grey ? greyOf(COLORS[anchor.color]) : COLORS[anchor.color])} />
      ))}
      {children}
    </View>
  );
}
