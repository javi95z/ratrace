// react-native-worklets runs a worklet on the phone's UI runtime, which a test does not have (the library does not load in
// one): here a worklet scheduled on the UI runtime runs a moment later, on the test's own thread (vitest.config.ts).
export function scheduleOnUI<Args extends unknown[]>(worklet: (...args: Args) => unknown, ...args: Args): void {
  setTimeout(() => worklet(...args), 0);
}

/** A function of the app's own (React's side) called from a worklet: here a moment later, as the phone does it, on the test's own thread. */
export function scheduleOnRN<Args extends unknown[]>(fn: (...args: Args) => unknown, ...args: Args): void {
  setTimeout(() => fn(...args), 0);
}
