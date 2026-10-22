// Reanimated's own `mock` ships as TypeScript source that does not load here, and the real library needs the
// worklets runtime: this models what the hooks use. A shared value is reactive (writing it re-reads every
// animated style), an animation assigned to it is recorded and lands on its target when its duration has run
// (on fake timers), and `cancelAnimation` is recorded and stops it. The frames themselves are pinned in motion.test.ts.

/** What a spring is told: how stiff and how damped it is, and the speed it starts at. */
export type SpringConfig = { stiffness?: number; damping?: number; mass?: number; velocity?: number };
/** How long a spring takes to land here, where nothing is integrated. */
export const SPRING_MS = 300;

export const rea = ({
  assigned: [] as { kind: 'timing' | 'repeat' | 'spring'; to: number; duration: number; reps?: number; delay?: number; spring?: SpringConfig; curve?: readonly number[] }[],
  cancelled: 0,
  listeners: new Set<() => void>(),
  /**
   * True (the default): an animated style is drawn again by React each time a shared value changes, the fake's way of showing it. False: it is
   * worked out once, as it is drawn, and kept in `styles` for a test to work out again, as the UI thread does with no word to React: a test of
   * what React draws again (a scroll that must draw nothing) sets it false before it draws.
   */
  restyle: true,
  styles: [] as Array<() => Record<string, unknown>>,
});

export async function reanimatedFake() {
  const { useRef, useReducer, useEffect } = await import('react');
  const { View, ScrollView } = await import('react-native');
  type Anim = { __anim: true; kind: 'timing' | 'repeat' | 'spring'; to: number; duration: number; reps?: number; delay?: number; spring?: SpringConfig; curve?: readonly number[] };
  const emit = () => rea.listeners.forEach((l) => l());
  return {
    default: { View, ScrollView },
    useSharedValue: <T,>(init: T) => {
      const box = useRef<{ raw: unknown; timer?: ReturnType<typeof setTimeout>; sv: { value: unknown } } | null>(null);
      if (!box.current) {
        const b: { raw: unknown; timer?: ReturnType<typeof setTimeout>; sv: { value: unknown } } = { raw: init, sv: { value: init } };
        Object.defineProperty(b.sv, 'value', {
          get: () => b.raw,
          set: (v) => {
            clearTimeout(b.timer);
            if (v && typeof v === 'object' && (v as Anim).__anim) {
              const a = v as Anim;
              rea.assigned.push({ kind: a.kind, to: a.to, duration: a.duration, reps: a.reps, delay: a.delay, ...(a.spring ? { spring: a.spring } : null), ...(a.curve ? { curve: a.curve } : null) });
              b.timer = setTimeout(() => {
                b.raw = a.to;
                emit();
              }, (a.delay ?? 0) + a.duration);
            } else {
              b.raw = v;
            }
            emit();
          },
        });
        (b.sv as { timer?: () => void }).timer = () => clearTimeout(b.timer);
        box.current = b;
      }
      return box.current.sv as { value: T };
    },
    useAnimatedStyle: (fn: () => object) => {
      const [, bump] = useReducer((n: number) => n + 1, 0);
      const live = useRef(rea.restyle).current;
      const kept = useRef(false);
      if (!live && !kept.current) {
        kept.current = true;
        rea.styles.push(fn as () => Record<string, unknown>);
      }
      useEffect(() => {
        if (!live) return;
        rea.listeners.add(bump);
        return () => void rea.listeners.delete(bump);
      }, [live]);
      return fn();
    },
    // A scroll handler is the worklet given the scroll's native event (its `contentOffset`), as the phone runs it on the UI thread.
    useAnimatedScrollHandler: (handler: ((event: unknown) => void) | { onScroll?: (event: unknown) => void }) => (event: { nativeEvent: unknown }) => {
      const onScroll = typeof handler === 'function' ? handler : handler.onScroll;
      onScroll?.(event.nativeEvent);
    },
    // A reaction works out its value again whenever a shared value changes, and is told when it is not what it was (and once at first, from null).
    useAnimatedReaction: <T,>(prepare: () => T, react: (now: T, before: T | null) => void) => {
      const latest = useRef({ prepare, react });
      latest.current = { prepare, react };
      const last = useRef<{ value: T } | null>(null);
      useEffect(() => {
        const run = () => {
          const now = latest.current.prepare();
          const before = last.current;
          if (before !== null && Object.is(before.value, now)) return;
          last.current = { value: now };
          latest.current.react(now, before === null ? null : before.value);
        };
        run();
        rea.listeners.add(run);
        return () => void rea.listeners.delete(run);
      }, []);
    },
    // A view's animated ref is a ref (the library's is also a function that answers the view); measuring one, which the phone does on the UI thread,
    // answers nothing here, where nothing is laid out: what is worked out from it stays where it is with nothing measured.
    useAnimatedRef: () => useRef(null),
    measure: () => null,
    // read through a getter, so that it is the value of the moment it is read, as the library's is
    useDerivedValue: <T,>(fn: () => T) => ({
      get value() {
        return fn();
      },
    }),
    // an eased timing keeps the curve it was told (`Easing.bezier`), to be read
    withTiming: (to: number, cfg: { duration: number; easing?: { curve?: readonly number[] } }): Anim => ({ __anim: true, kind: 'timing', to, duration: cfg.duration, ...(cfg.easing?.curve ? { curve: cfg.easing.curve } : null) }),
    withRepeat: (inner: Anim, reps: number): Anim => ({ ...inner, kind: 'repeat', reps }),
    // a spring has no duration of its own: here it lands after a nominal one, with what it was told kept to be read
    withSpring: (to: number, spring: SpringConfig = {}): Anim => ({ __anim: true, kind: 'spring', to, duration: SPRING_MS, spring }),
    // a delay waits before the animation it holds; a sequence is recorded as its last piece (the pieces before it only put the value back)
    withDelay: (delay: number, inner: Anim): Anim => ({ ...inner, delay }),
    withSequence: (...pieces: Anim[]): Anim => pieces[pieces.length - 1],
    cancelAnimation: (sv: { timer?: () => void }) => {
      rea.cancelled += 1;
      sv.timer?.();
    },
    Easing: { linear: (t: number) => t, bezier: (x1: number, y1: number, x2: number, y2: number) => Object.assign((t: number) => t, { curve: [x1, y1, x2, y2] }) },
  };
}
