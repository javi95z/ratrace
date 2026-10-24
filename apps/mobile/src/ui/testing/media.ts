/*
 * A browser window of a given size, for the web twins' tests: jsdom lays nothing out and answers no media query. `browserAt` makes the window's
 * `matchMedia` answer the width queries as Chrome would at that width (`(min-width: 64rem)`, a rem being 16 px), tells react-native-web's Dimensions
 * the size (it reads the root's client box), and says the window was resized, as a browser does. Any other query (reduced motion) is not matched.
 */

type Listener = (event: MediaQueryListEvent) => void;

/** The lists handed out, each with who listens to it: told again when the width changes. */
const lists = new Set<{ query: string; listeners: Set<Listener>; matches: () => boolean }>();
let width = 0;

const px = (value: string, unit: string): number => Number(value) * (unit === 'rem' || unit === 'em' ? 16 : 1);

/** Whether `query` holds at `at` pixels wide: `(min-width: …)` and `(max-width: …)`, alone or joined by `and`. */
export function holdsAt(query: string, at: number): boolean {
  const parts = [...query.matchAll(/\((min|max)-width:\s*([\d.]+)(px|rem|em)\)/g)];
  if (parts.length === 0) return false;
  return parts.every(([, side, value, unit]) => (side === 'min' ? at >= px(value, unit) : at <= px(value, unit)));
}

/** Makes the window `w` × `h` pixels, as a browser of that size shows the page. Returns what puts jsdom's own back. */
export function browserAt(w: number, h = 800): () => void {
  const before = { matchMedia: window.matchMedia, width: Object.getOwnPropertyDescriptor(document.documentElement, 'clientWidth'), height: Object.getOwnPropertyDescriptor(document.documentElement, 'clientHeight') };
  width = w;
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string): MediaQueryList => {
      const list = { query, listeners: new Set<Listener>(), matches: () => holdsAt(query, width) };
      lists.add(list);
      return {
        get matches() {
          return list.matches();
        },
        media: query,
        onchange: null,
        addEventListener: (_: string, listener: Listener) => void list.listeners.add(listener),
        removeEventListener: (_: string, listener: Listener) => void list.listeners.delete(listener),
        addListener: (listener: Listener) => void list.listeners.add(listener),
        removeListener: (listener: Listener) => void list.listeners.delete(listener),
        dispatchEvent: () => true,
      } as unknown as MediaQueryList;
    },
  });
  const size = (to: number, h2: number) => {
    Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, get: () => to });
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, get: () => h2 });
  };
  size(w, h);
  window.dispatchEvent(new Event('resize'));
  return () => {
    lists.clear();
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: before.matchMedia });
    for (const [key, descriptor] of [['clientWidth', before.width], ['clientHeight', before.height]] as const) {
      if (descriptor) Object.defineProperty(document.documentElement, key, descriptor);
      else delete (document.documentElement as unknown as Record<string, unknown>)[key];
    }
    window.dispatchEvent(new Event('resize'));
  };
}

/** The window made `w` wide while the page is open: every query handed out is told whether it now holds, as a browser tells them. */
export function resizeTo(w: number, h = 800): void {
  const was = new Map([...lists].map((list) => [list, list.matches()]));
  width = w;
  Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, get: () => w });
  Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, get: () => h });
  window.dispatchEvent(new Event('resize'));
  for (const list of lists) {
    const matches = list.matches();
    if (matches === was.get(list)) continue;
    for (const listener of [...list.listeners]) listener({ matches, media: list.query } as MediaQueryListEvent);
  }
}
