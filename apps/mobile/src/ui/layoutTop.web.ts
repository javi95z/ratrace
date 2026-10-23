import type { LayoutChangeEvent } from 'react-native';

/**
 * The web's twin of `layoutTop.ts`. react-native-web tells a layout in whole pixels (it reads `offsetTop`), where Chrome lays the box out at a
 * fraction: a part's grid of the rat's choices under its heading (a line of 14.296875 and 6 of margin) was placed 0.3 higher than the Next web's
 * (20, not 20.296875). The box's distance from its parent is read from both their boxes on the page; an event with no element is read as told.
 */
export function layoutTop(event: LayoutChangeEvent): number {
  const target = (event.nativeEvent as { target?: { getBoundingClientRect(): { top: number }; parentElement: { getBoundingClientRect(): { top: number } } | null } }).target;
  const parent = target?.parentElement;
  if (!target || !parent || typeof target.getBoundingClientRect !== 'function') return event.nativeEvent.layout.y;
  return target.getBoundingClientRect().top - parent.getBoundingClientRect().top;
}
