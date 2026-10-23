import { BlurMask, Group, Rect, rect } from '@shopify/react-native-skia';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Canvas } from './Canvas';
import { glowOf } from './lights';

export { glowOf };

/**
 * The light a box stands in (the web's glow round a badge's card: its `frame`'s `--glow`, globals.css). The first child of the box it lights, filling
 * it, so that the box's own fill and frame are drawn over it. Drawn as Chrome draws a box-shadow: the box's shape in the glow's colour, blurred by a
 * Gaussian of half the blur as its deviation (CSS Backgrounds 3, "shadow blur"), and seen only outside the box (an outer shadow is clipped to what
 * lies past the border). The blur reaches three deviations out, and the canvas stands that far round the box. Nothing is drawn until the box is laid
 * out, nor ever for a shadow that is not a glow (none for a bronze badge). It takes no touch and says nothing to a screen reader.
 */
export function Glow({ shadow }: { shadow: string }): ReactNode {
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const glow = glowOf(shadow);
  if (glow === null) return null;
  const sigma = glow.blur / 2;
  const reach = Math.ceil(3 * sigma);
  return (
    <View
      {...{ dataSet: { glow: shadow } }}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, pointerEvents: 'none' }}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setBox((held) => (held !== null && held.width === width && held.height === height ? held : { width, height }));
      }}
    >
      {box !== null ? (
        <View style={{ position: 'absolute', left: -reach, top: -reach }}>
          <Canvas style={{ width: box.width + 2 * reach, height: box.height + 2 * reach }}>
            <Group clip={rect(reach, reach, box.width, box.height)} invertClip>
              <Rect x={reach} y={reach} width={box.width} height={box.height} color={glow.colour}>
                <BlurMask blur={sigma} style="normal" />
              </Rect>
            </Group>
          </Canvas>
        </View>
      ) : null}
    </View>
  );
}
