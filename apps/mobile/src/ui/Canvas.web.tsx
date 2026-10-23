import type { CanvasProps } from '@shopify/react-native-skia';
import type { ReactNode } from 'react';
import { View } from 'react-native';

/*
 * The web export's twin of `Canvas.tsx` (Metro picks it for the web). The web draws everything with the DOM, CSS and SVG, and loads no Skia, so no
 * web screen or twin reaches a canvas (a test holds them to it). This stands in for the import only, should a file that has no twin name it: the box
 * the canvas would have been, empty. (`CanvasProps` is a type: nothing of Skia is loaded for it.)
 */
export function Canvas({ style }: Omit<CanvasProps, 'ref'>): ReactNode {
  return <View style={style as object} />;
}
