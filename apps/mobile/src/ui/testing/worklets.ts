// react-native-worklets runs a worklet on the phone's UI runtime, which a test does not have (the library does not load in
// one): here a worklet scheduled on the UI runtime runs a moment later, on the test's own thread (vitest.config.ts).
export function scheduleOnUI<Args extends unknown[]>(worklet: (...args: Args) => unknown, ...args: Args): void {
  setTimeout(() => worklet(...args), 0);
}
