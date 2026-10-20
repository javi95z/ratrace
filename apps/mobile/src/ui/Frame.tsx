import { useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import { stripsOf, type FrameKind, type FrameTone } from './frames';
import { COLORS } from './theme';

interface FramedProps {
  kind: FrameKind;
  tone?: FrameTone;
  style?: ViewStyle | ViewStyle[];
  children?: ReactNode;
}

/**
 * A box with the web's hard pixel frame. The frame's strips are absolute Views, which take no
 * space: the children lie exactly where they would with no frame at all.
 */
export function Framed({ kind, tone = {}, style, children }: FramedProps): ReactNode {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((s) => (s && s.w === width && s.h === height ? s : { w: width, h: height }));
  };
  return (
    <View style={style} onLayout={onLayout}>
      {size &&
        stripsOf(kind, size.w, size.h, tone).map((s, i) => (
          <View
            key={i}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: s.x,
              top: s.y,
              width: s.w,
              height: s.h,
              backgroundColor: COLORS[s.color],
            }}
          />
        ))}
      {children}
    </View>
  );
}
