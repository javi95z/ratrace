import { AndroidHaptics, ImpactFeedbackStyle, NotificationFeedbackType, impactAsync, notificationAsync, performAndroidHapticsAsync, selectionAsync } from 'expo-haptics';
import { Platform } from 'react-native';
import type { Haptic } from './haptic';

/*
 * The phone's touch, each moment in the platform's own words. On iOS the system's feedback generators (a selection's tick, an impact, a
 * notification's success or error), which follow the phone's own "System Haptics". On Android the view's haptic feedback, as the system's own
 * controls give it, which follows the phone's own "Touch feedback" and is tuned to its motor: the newest constant the phone has, an older one
 * where it has not (`ANDROID`).
 */

/** Android's constants for a moment, the newest first, each with the version of Android it came with (`Build.VERSION_CODES`). */
const ANDROID: Record<Haptic, ReadonlyArray<readonly [AndroidHaptics, number]>> = {
  select: [[AndroidHaptics.Segment_Tick, 34], [AndroidHaptics.Clock_Tick, 0]],
  tick: [[AndroidHaptics.Segment_Frequent_Tick, 34], [AndroidHaptics.Clock_Tick, 0]],
  toggleOn: [[AndroidHaptics.Toggle_On, 34], [AndroidHaptics.Clock_Tick, 0]],
  toggleOff: [[AndroidHaptics.Toggle_Off, 34], [AndroidHaptics.Clock_Tick, 0]],
  threshold: [[AndroidHaptics.Context_Click, 0]],
  confirm: [[AndroidHaptics.Confirm, 30], [AndroidHaptics.Virtual_Key, 0]],
  success: [[AndroidHaptics.Confirm, 30], [AndroidHaptics.Long_Press, 0]],
  warning: [[AndroidHaptics.Reject, 30], [AndroidHaptics.Long_Press, 0]],
  reject: [[AndroidHaptics.Reject, 30], [AndroidHaptics.Long_Press, 0]],
};

/** iOS's generator for a moment. */
const IOS: Record<Haptic, () => Promise<void>> = {
  select: () => selectionAsync(),
  tick: () => selectionAsync(),
  toggleOn: () => impactAsync(ImpactFeedbackStyle.Light),
  toggleOff: () => impactAsync(ImpactFeedbackStyle.Light),
  threshold: () => impactAsync(ImpactFeedbackStyle.Rigid),
  confirm: () => impactAsync(ImpactFeedbackStyle.Medium),
  success: () => notificationAsync(NotificationFeedbackType.Success),
  warning: () => notificationAsync(NotificationFeedbackType.Warning),
  reject: () => notificationAsync(NotificationFeedbackType.Error),
};

/** The Android constant a phone of this version has for a moment. */
export function androidHapticFor(kind: Haptic, version: number): AndroidHaptics {
  const found = ANDROID[kind].find(([, since]) => version >= since);
  return (found ?? ANDROID[kind][ANDROID[kind].length - 1])[0];
}

/** The shortest time between two of the same moment: a slider run fast is felt step by step, never as one long buzz. */
const APART_MS = 35;
const last = new Map<Haptic, number>();

/** Says a moment to the touch, in the platform's own words. A phone that cannot (none, or a call that fails) says nothing: never an error. */
export function feel(kind: Haptic): void {
  const now = Date.now();
  if (now - (last.get(kind) ?? -Infinity) < APART_MS) return;
  last.set(kind, now);
  const done =
    Platform.OS === 'ios'
      ? IOS[kind]()
      : Platform.OS === 'android'
        ? performAndroidHapticsAsync(androidHapticFor(kind, typeof Platform.Version === 'number' ? Platform.Version : Number(Platform.Version)))
        : Promise.resolve();
  void done.catch(() => undefined);
}
