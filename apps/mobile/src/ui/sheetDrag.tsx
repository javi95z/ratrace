import { useEffect, type ReactNode, type RefObject } from 'react';
import { View, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewProps } from 'react-native';
import { GestureDetector, GestureStateManager, ScrollView, usePanGesture } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { GRAB } from './sheetPull';
import type { SheetPull } from './useSheetPull';

/*
 * Where a sheet is dragged down from, on the phone: the gesture handler's pans, on the phone's UI thread. The sheet's grip (its grabber and its title
 * row) drags it always; its body only while what it holds is scrolled to its top and the finger goes down, so that a long sheet still scrolls, and
 * the body's scroll waits for that pan to fail before it moves (`requireToFail`): a finger that goes up, or a list scrolled down, is the scroll's. A
 * tap moves nothing, so it is never taken from a button; a drag that begins on one cancels its press (the handler takes the touch from React's
 * responder as it activates). The web's twin (`sheetDrag.web.tsx`) reads the page's pointer events instead, and loads none of the handler.
 */

/** How far sideways before it is not a drag of the sheet: a slider's or a strip of tabs'. */
const SIDEWAYS = 20;

/** The grip: the grabber and the title row, which drag the sheet whichever way the finger goes (up, it gives a little). */
export function SheetGrip({ drag, enabled, children }: { drag: SheetPull; enabled: boolean; children: ReactNode }) {
  const pan = usePanGesture({
    enabled,
    activeOffsetY: [-GRAB, GRAB],
    failOffsetX: [-SIDEWAYS, SIDEWAYS],
    onActivate: (event) => {
      'worklet';
      drag.begin(event.translationY);
    },
    onUpdate: (event) => {
      'worklet';
      drag.move(event.translationY);
    },
    onDeactivate: (event) => {
      'worklet';
      if (event.canceled) drag.cancel();
      else drag.end(event.translationY, event.velocityY);
    },
  });
  return (
    <GestureDetector gesture={pan}>
      <View collapsable={false}>{children}</View>
    </GestureDetector>
  );
}

/**
 * The sheet's body, which scrolls: dragged down only from its top. Whether it is at its top is kept for the pan as the scroll goes (`atTop`); a pan
 * never enabled leaves the scroll free.
 */
export function SheetScroll({ drag, enabled, children, onScroll, ...props }: ScrollViewProps & { drag: SheetPull; enabled: boolean; children: ReactNode }) {
  const atTop = useSharedValue(enabled);
  useEffect(() => {
    if (!enabled) atTop.value = false;
  }, [enabled, atTop]);
  const pan = usePanGesture({
    enabled: atTop,
    activeOffsetY: GRAB,
    failOffsetY: -GRAB,
    failOffsetX: [-SIDEWAYS, SIDEWAYS],
    // A control that drags itself (a slider) pressed: the pan gives way, to it and to the scroll.
    onTouchesMove: (event) => {
      'worklet';
      if (drag.held()) GestureStateManager.fail(event.handlerTag);
    },
    onActivate: (event) => {
      'worklet';
      drag.begin(event.translationY);
    },
    onUpdate: (event) => {
      'worklet';
      drag.move(event.translationY);
    },
    onDeactivate: (event) => {
      'worklet';
      if (event.canceled) drag.cancel();
      else drag.end(event.translationY, event.velocityY);
    },
  });
  const scrolled = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    atTop.value = enabled && event.nativeEvent.contentOffset.y <= 0;
    onScroll?.(event);
  };
  return (
    <GestureDetector gesture={pan}>
      <View collapsable={false} style={{ flexShrink: 1, minHeight: 0 }}>
        <ScrollView {...props} requireToFail={pan} onScroll={scrolled} scrollEventThrottle={16}>
          {children}
        </ScrollView>
      </View>
    </GestureDetector>
  );
}

/** The web's: the panel's own pointer events. Nothing on the phone, whose pans are the grip's and the body's: here only so the twins export the same. */
export function useDragSurface(panel: RefObject<unknown>, drag: SheetPull, enabled: boolean): void {
  void panel;
  void drag;
  void enabled;
}
