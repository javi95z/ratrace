import type { ViewStyle } from 'react-native';

/**
 * The web's twin of `keptLayer.ts`. The Next web's paper is thrown onto the table by a CSS animation that keeps its last frame (`animate-paper`,
 * `both`), and Chrome keeps such a box a layer of its own: its lines are rastered against the layer, snapped to the device pixels as the layer is.
 * The app's paper ends on a still transform of its own, which Chrome rasters with the page: under a block of a fractional height (the guide's note,
 * the room's slot above the paper) its rows stood one or two device pixels from the Next web's, each by its own amount. Kept a layer, they meet
 * (measured on `play-guide-r1`: 34 532 pixels unlike in the paper's rows, 5 024 with the layer, the ground's weave among them).
 */
// (`will-change` is no style of React Native's: react-native-web writes it as it is given.)
export const KEPT_LAYER = { willChange: 'transform' } as ViewStyle;
