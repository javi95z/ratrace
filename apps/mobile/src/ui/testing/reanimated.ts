// Reanimated's own `mock` ships as TypeScript source that does not load here, and the real library needs the
// worklets runtime: this models what the hooks use. A shared value is reactive (writing it re-reads every
// animated style), an animation assigned to it is recorded and lands on its target when its duration has run
// (on fake timers), and `cancelAnimation` is recorded and stops it. The frames themselves are pinned in motion.test.ts.
export const rea = ({
  assigned: [] as { kind: 'timing' | 'repeat'; to: number; duration: number; reps?: number; delay?: number }[],
  cancelled: 0,
  listeners: new Set<() => void>(),
});

export async function reanimatedFake() {
  const { useRef, useReducer, useEffect } = await import('react');
  const { View } = await import('react-native');
  type Anim = { __anim: true; kind: 'timing' | 'repeat'; to: number; duration: number; reps?: number; delay?: number };
  const emit = () => rea.listeners.forEach((l) => l());
  return {
    default: { View },
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
              rea.assigned.push({ kind: a.kind, to: a.to, duration: a.duration, reps: a.reps, delay: a.delay });
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
      useEffect(() => {
        rea.listeners.add(bump);
        return () => void rea.listeners.delete(bump);
      }, []);
      return fn();
    },
    // read through a getter, so that it is the value of the moment it is read, as the library's is
    useDerivedValue: <T,>(fn: () => T) => ({
      get value() {
        return fn();
      },
    }),
    withTiming: (to: number, cfg: { duration: number }): Anim => ({ __anim: true, kind: 'timing', to, duration: cfg.duration }),
    withRepeat: (inner: Anim, reps: number): Anim => ({ ...inner, kind: 'repeat', reps }),
    // a delay waits before the animation it holds; a sequence is recorded as its last piece (the pieces before it only put the value back)
    withDelay: (delay: number, inner: Anim): Anim => ({ ...inner, delay }),
    withSequence: (...pieces: Anim[]): Anim => pieces[pieces.length - 1],
    cancelAnimation: (sv: { timer?: () => void }) => {
      rea.cancelled += 1;
      sv.timer?.();
    },
    Easing: { linear: (t: number) => t },
  };
}
