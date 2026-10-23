import type { LayoutChangeEvent } from 'react-native';

/** How far down its parent a box stands, as a layout event tells it: on the phone, the layout's own `y` (Yoga's, to a fraction). */
export function layoutTop(event: LayoutChangeEvent): number {
  return event.nativeEvent.layout.y;
}
