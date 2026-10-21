/**
 * The colour a drawn box paints, as the tests read it from the page react-native-web makes: its fill, or for a frame's strip anchored to the box's
 * far edge the border it is drawn as there (Frame.tsx's `placeOf`).
 */
export const paintOf = (el: HTMLElement): string => el.style.backgroundColor || el.style.borderBottomColor || el.style.borderRightColor;
