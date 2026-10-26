import { afterEach, beforeEach, expect, test, vi } from 'vitest';

// The platform a test says, and what the phone's touch was asked, in the platform's own words.
const phone = vi.hoisted(() => ({ OS: 'ios' as string, Version: 36 as number | string, felt: [] as string[], fails: false }));
vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return phone.OS;
    },
    get Version() {
      return phone.Version;
    },
  },
}));
vi.mock('expo-haptics', () => {
  const say = (what: string) => (phone.fails ? Promise.reject(new Error('no motor')) : (phone.felt.push(what), Promise.resolve()));
  return {
    ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy', Rigid: 'rigid', Soft: 'soft' },
    NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
    AndroidHaptics: new Proxy({}, { get: (_target, name) => String(name).toLowerCase().replace(/_/g, '-') }),
    selectionAsync: () => say('selection'),
    impactAsync: (style: string) => say(`impact:${style}`),
    notificationAsync: (type: string) => say(`notification:${type}`),
    performAndroidHapticsAsync: (type: string) => say(`android:${type}`),
  };
});
const { androidHapticFor, feel } = await import('./haptics');

let clock = 1_000_000;
beforeEach(() => {
  // Each moment far from the last: the spacing is its own test's.
  vi.spyOn(Date, 'now').mockImplementation(() => (clock += 1_000));
});
afterEach(() => {
  vi.restoreAllMocks();
  phone.felt.length = 0;
  phone.OS = 'ios';
  phone.Version = 36;
  phone.fails = false;
});

test('on iOS each moment is the system\'s own generator: a selection\'s tick, an impact, a notification', async () => {
  for (const kind of ['select', 'tick', 'toggleOn', 'threshold', 'confirm', 'success', 'warning', 'reject'] as const) feel(kind);
  await Promise.resolve();
  expect(phone.felt).toEqual(['selection', 'selection', 'impact:light', 'impact:rigid', 'impact:medium', 'notification:success', 'notification:warning', 'notification:error']);
});

test('on Android each moment is the view\'s own haptic feedback, the newest constant the phone has and an older one where it has not', async () => {
  phone.OS = 'android';
  phone.Version = 34;
  for (const kind of ['select', 'tick', 'toggleOn', 'toggleOff', 'threshold', 'confirm', 'reject'] as const) feel(kind);
  await Promise.resolve();
  expect(phone.felt).toEqual(['android:segment-tick', 'android:segment-frequent-tick', 'android:toggle-on', 'android:toggle-off', 'android:context-click', 'android:confirm', 'android:reject']);
  // Android 11 to 13 have the confirmation and the rejection, not the ticks and switches of 14; Android 10 and before, only the oldest.
  expect(androidHapticFor('toggleOn', 31)).toBe('clock-tick');
  expect(androidHapticFor('confirm', 30)).toBe('confirm');
  expect(androidHapticFor('confirm', 29)).toBe('virtual-key');
  expect(androidHapticFor('reject', 26)).toBe('long-press');
});

test('the same moment twice in a breath is felt once: a slider run fast is felt step by step, never as one long buzz', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(5_000_000);
  feel('tick');
  feel('tick');
  feel('select');
  await Promise.resolve();
  expect(phone.felt).toEqual(['selection', 'selection']);
});

test('a phone that cannot feel says nothing and throws nothing; the web feels nothing', async () => {
  phone.fails = true;
  expect(() => feel('success')).not.toThrow();
  await new Promise((done) => setTimeout(done, 0));
  phone.fails = false;
  phone.OS = 'web';
  feel('confirm');
  await Promise.resolve();
  expect(phone.felt).toEqual([]);
});
