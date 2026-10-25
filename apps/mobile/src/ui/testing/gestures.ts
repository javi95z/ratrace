// The gesture handler's native side does not load in a test: this stands in for what the kit uses of it. A pan is the config it was given, kept in
// `pans` (the last made first in `pans.at(-1)`) for a test to drive by calling its callbacks as the handler would; the detector and the root draw what
// they hold, and the handler's scroll is React Native's, without what it is told of the other gestures. The phone's tests have it from setup.ts; a test
// that drives a pan of its own (the card's) spreads it and keeps its own `usePanGesture`.

/** A pan's callbacks, as the handler calls them, with what a test reads of their events. */
export type PanEvent = { translationY: number; velocityY: number; canceled?: boolean };
export type PanConfig = Record<string, unknown> & {
  onActivate?: (event: PanEvent) => void;
  onUpdate?: (event: PanEvent) => void;
  onDeactivate?: (event: PanEvent) => void;
};

/** The pans made, and the handlers a callback told to fail (`GestureStateManager.fail`). */
export const gestures = { pans: [] as PanConfig[], failed: [] as number[] };

export async function gestureFake() {
  const { createElement } = await import('react');
  const { ScrollView } = await import('react-native');
  type Holder = { children: import('react').ReactNode };
  return {
    usePanGesture: (config: PanConfig) => {
      gestures.pans.push(config);
      return config;
    },
    GestureStateManager: {
      fail: (tag: number) => void gestures.failed.push(tag),
      activate: () => undefined,
      deactivate: () => undefined,
    },
    GestureDetector: ({ children }: Holder) => children,
    GestureHandlerRootView: ({ children }: Holder) => children,
    ScrollView: ({ requireToFail, ...props }: Record<string, unknown>) => {
      void requireToFail;
      return createElement(ScrollView, props);
    },
  };
}
