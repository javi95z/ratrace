/**
 * The errors of a page, sent to be kept with the errors of the server functions (roadmap step 17e,
 * `docs/errors.md`). Each kind is sent once, ten kinds at most in the life of a page, cleaned of
 * anything that could say who the player is before it leaves; the server cleans it again.
 */

/** One error as a page sends it. */
export interface ErrorReport {
  message: string;
  stack: string | null;
  /** The page's path, cleaned. The server takes the language off it. */
  place: string;
  build: string;
  browser: string;
}

/** What became of a batch: kept, worth sending again later, or never worth sending again. */
export type Sent = 'sent' | 'later' | 'never';

/** What the watch needs of the page and the cloud. The page hands in its own; a test, its stand-ins. */
export interface ErrorWatchParts {
  /** Sends a batch as whoever is signed in. 'later' while nobody is, or the network is away. */
  send(reports: ErrorReport[]): Promise<Sent>;
  /** The path of the page, now. */
  place(): string;
  build: string;
  browser: string;
  schedule(run: () => void, ms: number): void;
}

export interface ErrorWatch {
  /** Notes an error, to be sent with the others that come with it. */
  report(message: string, stack: string | null): void;
  /** Sends what is waiting now: for when someone has just signed in. */
  flush(): Promise<void>;
}

/** The most kinds a page reports in its life; the server takes ten in a call too. */
const MOST = 10;
/** How long the watch waits for the errors that come together with the first. */
const GATHER_MS = 2_000;
/** How long it waits after a batch could not be sent, doubled each time. */
const RETRY_MS = 30_000;
/** How many times in all it sends a batch the network or the cloud would not take, before it waits to be asked. */
const TRIES = 5;
const MAX_MESSAGE = 500;
const MAX_STACK = 4000;
const MAX_PLACE = 200;
/** How much of what was written is looked at, at most: far more than is kept, so what is kept is whole. */
const READ_MESSAGE = 2000;
const READ_STACK = 8000;

/** A run of text with no space or quote in it, which may be an address with a query or a hash. */
const WORD = /[^\s'")]+/g;

/**
 * Takes out of a text what could say who someone is, or let someone in: e-mail addresses, tokens,
 * ids, machines' addresses, long numbers, and whatever follows `?` or `#` in an address or a path.
 * Every rule takes a time that grows with the text, never with its square. The same rules as the
 * server's own (`supabase/functions/_shared/errors.ts`); a test holds the two together.
 */
export function scrub(text: string): string {
  return text
    .replace(/[\w.+-]{1,64}@[\w-]{1,63}(?:\.[\w-]{1,63}){1,8}/g, '<email>')
    .replace(/eyJ[\w-]{0,256}\.[\w-]{0,4096}\.[\w-]{0,512}/g, '<token>')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<id>')
    .replace(WORD, (word) => {
      const at = word.search(/[?#]/);
      return at > 0 && word.slice(0, at).includes('/') ? word.slice(0, at) : word;
    })
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '<ip>')
    .replace(/[A-Za-z0-9_-]{24,}/g, '<token>')
    .replace(/\d{6,}/g, '<number>');
}

/**
 * The start of a text, for cleaning: cut where a word ends, so that no half of an address is left
 * for the rules to miss. What is kept is far shorter, so a word longer than a cut can carry loses
 * only its end.
 */
function head(text: string, most: number): string {
  return text.length <= most ? text : text.slice(0, most).replace(/\S{1,254}$/, '');
}

/** Noise of other people's code, which says nothing of the game. The server leaves it out too. */
function ignorable(message: string, stack: string | null): boolean {
  return message.trim() === '' || /^script error\.?$/i.test(message.trim()) || /ResizeObserver loop/i.test(message) || /(chrome|moz|safari|safari-web)-extension:\/\//.test(stack ?? '');
}

/** One thing written as an error, said in words: an object by its message or its kind, never written out whole. */
function said(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.name && value.name !== 'Error' ? `${value.name}: ${value.message}` : value.message;
  if (typeof value === 'object' && value !== null) {
    const message = (value as { message?: unknown }).message;
    return typeof message === 'string' ? message : (value.constructor?.name ?? 'Object');
  }
  return String(value);
}

/** What was written as an error, as one message, and the stack of the first error in it. */
export function errorOf(args: readonly unknown[]): { message: string; stack: string | null } {
  const first = args.find((value): value is Error => value instanceof Error);
  return { message: args.map(said).join(' ').trim(), stack: typeof first?.stack === 'string' ? first.stack : null };
}

const BROWSERS: ReadonlyArray<readonly [string, RegExp]> = [
  ['Edge', /Edg(?:e|A|iOS)?\/(\d+)/],
  ['Opera', /OPR\/(\d+)/],
  ['Samsung', /SamsungBrowser\/(\d+)/],
  ['Firefox', /(?:Firefox|FxiOS)\/(\d+)/],
  ['Chrome', /(?:Chrome|CriOS)\/(\d+)/],
  ['Safari', /Version\/(\d+)[\d.]*.*Safari/],
];
const SYSTEMS: ReadonlyArray<readonly [string, RegExp]> = [
  ['Android', /Android/],
  ['iOS', /iPhone|iPad|iPod/],
  ['Windows', /Windows/],
  ['ChromeOS', /CrOS/],
  ['macOS', /Macintosh|Mac OS X/],
  ['Linux', /Linux/],
];

/** The browser by its name, its major version and its system: 'Chrome 140 Android'. Nothing finer. */
export function browserOf(agent: string): string {
  const browser = BROWSERS.map(([name, pattern]) => [name, pattern.exec(agent)?.[1]] as const).find(([, major]) => major !== undefined);
  if (!browser) return 'other';
  const system = SYSTEMS.find(([, pattern]) => pattern.test(agent))?.[0];
  return [browser[0], browser[1], system].filter(Boolean).join(' ');
}

/** The build, by the versions of the game and, where the build knows it, its commit. */
export function buildOf(engine: string, content: string, commit: string | undefined): string {
  return [`${engine}/${content}`, commit?.slice(0, 7)].filter(Boolean).join(' ');
}

/**
 * Watches what goes wrong on a page and sends it to be kept. What comes together goes in one call;
 * what could not be sent is tried again, later each time, and whenever `flush` is called.
 */
export function errorWatch(parts: ErrorWatchParts): ErrorWatch {
  const seen = new Set<string>();
  const waiting: ErrorReport[] = [];
  let sending = false;
  let timer = false;
  let failures = 0;

  const soon = (ms: number) => {
    if (timer) return;
    timer = true;
    parts.schedule(() => {
      timer = false;
      void flush();
    }, ms);
  };

  async function flush(): Promise<void> {
    if (sending || waiting.length === 0) return;
    sending = true;
    const batch = waiting.splice(0, MOST);
    const answer = await parts.send(batch).catch((): Sent => 'later');
    sending = false;
    if (answer === 'later') {
      waiting.unshift(...batch);
      failures += 1;
      if (failures < TRIES) soon(RETRY_MS * 2 ** (failures - 1));
      return;
    }
    failures = 0;
    if (waiting.length > 0) soon(GATHER_MS);
  }

  return {
    report(message, stack) {
      if (seen.size >= MOST || ignorable(message, stack)) return;
      const place = scrub(parts.place().split(/[?#]/)[0]).slice(0, MAX_PLACE);
      const cleaned = scrub(head(message, READ_MESSAGE)).trim().slice(0, MAX_MESSAGE);
      const kind = `${place}\u0000${cleaned.replace(/\d+/g, '#').toLowerCase()}`;
      if (seen.has(kind)) return;
      seen.add(kind);
      waiting.push({ message: cleaned, stack: stack === null ? null : scrub(head(stack, READ_STACK)).slice(0, MAX_STACK), place, build: parts.build, browser: parts.browser });
      soon(GATHER_MS);
    },
    flush,
  };
}

/** The page's own log, of which the watch hears what is written as an error. */
interface Log {
  error(...args: unknown[]): void;
}

/** What a page tells of an error nobody caught: a browser's `ErrorEvent`. */
type Uncaught = Event & { message?: unknown; error?: unknown; filename?: string; lineno?: number; colno?: number };
/** What a page tells of a promise nobody handled: a browser's `PromiseRejectionEvent`. */
type Unhandled = Event & { reason?: unknown };

/**
 * Has the watch hear what goes wrong on a page: errors nobody caught, promises nobody handled, and
 * everything written as an error, which is still written. A fault of the watch never reaches the
 * page. Returns how to stop.
 */
export function watchPage(watch: Pick<ErrorWatch, 'report'>, page: EventTarget, log: Log): () => void {
  const heard = (read: () => { message: string; stack: string | null }) => {
    try {
      const { message, stack } = read();
      watch.report(message, stack);
    } catch {
      // The watch is for the game's errors: one of its own is nobody's business.
    }
  };
  const uncaught = (event: Event) =>
    heard(() => {
      const { message, error, filename, lineno, colno } = event as Uncaught;
      const stack = error instanceof Error && typeof error.stack === 'string' ? error.stack : filename ? `at ${filename}:${lineno}:${colno}` : null;
      return { message: typeof message === 'string' && message !== '' ? message : errorOf([error]).message, stack };
    });
  const unhandled = (event: Event) =>
    heard(() => {
      const { message, stack } = errorOf([(event as Unhandled).reason]);
      return { message: `unhandled: ${message}`, stack };
    });
  const original = log.error;
  log.error = (...args: unknown[]) => {
    original.apply(log, args);
    heard(() => errorOf(args));
  };
  page.addEventListener('error', uncaught);
  page.addEventListener('unhandledrejection', unhandled);
  return () => {
    page.removeEventListener('error', uncaught);
    page.removeEventListener('unhandledrejection', unhandled);
    log.error = original;
  };
}
