import type { Reply } from './replay.ts';

/** The most reports one call may carry: a page sends ten at most in all. */
export const MAX_REPORTS = 10;
const MAX_MESSAGE = 500;
const MAX_STACK = 4000;
const MAX_PLACE = 200;
const MAX_SMALL = 80;
/** No message of an error is longer than this before it is cut: anything longer is not one. */
const MAX_RAW = 20_000;

/** One kind of error as the database keeps it. */
export interface ErrorRow {
  fingerprint: string;
  source: 'page' | 'function';
  place: string;
  message: string;
  stack: string | null;
  build: string | null;
  browser: string | null;
}

/** What noting errors needs of the world. The function hands in the real thing; a test, its own. */
export interface ErrorsDeps {
  /** Counts this call for this player. False if it is one too many. */
  allow(userId: string): Promise<boolean>;
  /** Notes one error of a kind: how many times the kind has now been seen, and whether this one is worth an alert. */
  note(row: ErrorRow, now: Date): Promise<{ seen: number; alert: boolean }>;
  /** Sends an alert, if there is somewhere to send it. Never throws. */
  alert(title: string, text: string): Promise<void>;
  now(): Date;
}

/** What a function needs to note an error of its own. */
export type NoteDeps = Pick<ErrorsDeps, 'note' | 'alert' | 'now'>;

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const bad = (field: string): Reply => ({ status: 400, body: { error: 'bad-request', field } });
const tooMany: Reply = { status: 429, body: { error: 'too-many' } };

/**
 * Takes out of a text what could say who someone is, or let someone in: e-mail addresses, tokens,
 * ids, long numbers, and whatever follows `?` or `#` in an address. What an error says to be useful,
 * its words and where in the code it happened, stays. The page does the same before it sends.
 */
export function scrub(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '<email>')
    .replace(/eyJ[\w-]*\.[\w-]*\.[\w-]*/g, '<token>')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<id>')
    .replace(/(https?:\/\/[^\s?#'")]*)[?#][^\s'")]*/g, '$1')
    .replace(/[A-Za-z0-9_-]{24,}/g, '<token>')
    .replace(/\d{6,}/g, '<number>');
}

/** A page's path, as kept: no query, no hash, and no language in front of it. */
export function placeOf(path: string): string {
  const bare = path.split(/[?#]/)[0];
  if (!bare.startsWith('/')) return '/';
  const plain = bare.replace(/^\/(en|es|ru)(?=\/|$)/, '') || '/';
  return scrub(plain).slice(0, MAX_PLACE);
}

/** The first line of a stack that says where in the code it happened, with what changes from build to build taken out. */
function firstFrame(stack: string | null): string {
  const frame = (stack ?? '').split('\n').find((line) => /\bat\b|@|\(/.test(line) && /[/.]/.test(line)) ?? '';
  return frame
    .replace(/:\d+(:\d+)?/g, '')
    .replace(/[0-9a-f]{6,}/gi, '#')
    .trim();
}

/**
 * What makes two errors one kind: where they come from, where they happened, what they say with
 * the numbers in it taken out, and the first frame of their stack. Thirty-two hex characters of
 * SHA-256.
 */
export async function fingerprintOf(source: string, place: string, message: string, stack: string | null): Promise<string> {
  const said = scrub(message).replace(/\d+/g, '#').toLowerCase();
  const bytes = new TextEncoder().encode([source, place, said, firstFrame(stack)].join('\u0000'));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest.slice(0, 16), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** A report as a page sends it, or null if it is not one. */
function readReport(raw: unknown): { message: string; stack: string | null; place: string; build: string | null; browser: string | null } | null {
  if (!isRecord(raw)) return null;
  const { message, stack, place, build, browser } = raw;
  if (typeof message !== 'string' || message.trim() === '' || message.length > MAX_RAW) return null;
  if (stack !== undefined && stack !== null && (typeof stack !== 'string' || stack.length > MAX_RAW * 2)) return null;
  if (typeof place !== 'string' || place.length > MAX_RAW) return null;
  if (build !== undefined && build !== null && typeof build !== 'string') return null;
  if (browser !== undefined && browser !== null && typeof browser !== 'string') return null;
  return { message, stack: typeof stack === 'string' ? stack : null, place, build: typeof build === 'string' ? build : null, browser: typeof browser === 'string' ? browser : null };
}

/** Noise of other people's code, which says nothing of the game. */
function ignorable(message: string, stack: string | null): boolean {
  return /^script error\.?$/i.test(message.trim()) || /ResizeObserver loop/i.test(message) || /(chrome|moz|safari|safari-web)-extension:\/\//.test(stack ?? '');
}

/** One kind of error, cleaned and cut to what the database keeps. */
async function rowOf(source: ErrorRow['source'], place: string, message: string, stack: string | null, build: string | null, browser: string | null): Promise<ErrorRow> {
  const said = scrub(message).trim().slice(0, MAX_MESSAGE) || 'no message';
  const trace = stack === null ? null : scrub(stack).slice(0, MAX_STACK);
  return {
    fingerprint: await fingerprintOf(source, place, said, trace),
    source,
    place,
    message: said,
    stack: trace,
    build: build === null ? null : scrub(build).slice(0, MAX_SMALL),
    browser: browser === null ? null : scrub(browser).slice(0, MAX_SMALL),
  };
}

/** What an alert says: what kind of error, where, and what it said. Nothing of who met it. */
function alertOf(row: ErrorRow, seen: number): { title: string; text: string } {
  const where = row.source === 'page' ? `on the page ${row.place}` : `in the function ${row.place}`;
  const title = seen === 1 ? `The Rat Race: a new error ${where}` : `The Rat Race: an error back ${where}, after a quiet day`;
  const lines = [row.message, [row.build, row.browser].filter(Boolean).join(' · '), `Seen ${seen} time${seen === 1 ? '' : 's'}. pnpm online:errors lists them.`];
  if (row.source === 'function' && row.message.startsWith('answered ')) lines.push("The detail is in the function's logs, in the Supabase dashboard.");
  return { title, text: lines.filter(Boolean).join('\n') };
}

/** Notes one row, and sends the alert the database says it is worth. */
async function noted(deps: NoteDeps, row: ErrorRow): Promise<void> {
  const said = await deps.note(row, deps.now());
  if (said.alert) {
    const { title, text } = alertOf(row, said.seen);
    await deps.alert(title, text);
  }
}

/**
 * The errors a page met, sent to be kept. The caller is counted before anything is looked at; the
 * reports are cleaned again here, whatever the page did, and nothing of who sent them is kept.
 */
export async function reportErrors(deps: ErrorsDeps, userId: string, raw: unknown): Promise<Reply> {
  if (!isRecord(raw) || !Array.isArray(raw.reports) || raw.reports.length === 0 || raw.reports.length > MAX_REPORTS) return bad('reports');
  const reports = raw.reports.map(readReport);
  if (reports.some((one) => one === null)) return bad('reports');
  if (!(await deps.allow(userId))) return tooMany;
  let count = 0;
  for (const report of reports as NonNullable<(typeof reports)[number]>[]) {
    if (ignorable(report.message, report.stack)) continue;
    await noted(deps, await rowOf('page', placeOf(report.place), report.message, report.stack, report.build, report.browser));
    count += 1;
  }
  return { status: 200, body: { noted: count } };
}

/** Notes an error of a function, under its name: what it threw, or the word of an answer of 500 and above. */
export async function noteFunctionError(deps: NoteDeps, name: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : 'an error with no message';
  const stack = error instanceof Error && typeof error.stack === 'string' ? error.stack : null;
  await noted(deps, await rowOf('function', name.slice(0, MAX_PLACE), message, stack, null, null));
}

/**
 * How an alert is sent to an address: Slack and Discord take JSON, each its own; anything else, such
 * as an ntfy topic, takes the text with a title. Null for an address that is not https.
 */
export function alertRequest(address: string, title: string, text: string): { url: string; init: { method: 'POST'; headers: Record<string, string>; body: string } } | null {
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.hostname === 'hooks.slack.com') return { url: address, init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: `${title}\n${text}` }) } };
  if (/(^|\.)discord(app)?\.com$/.test(url.hostname)) {
    return { url: address, init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: `${title}\n${text}`.slice(0, 1900) }) } };
  }
  return { url: address, init: { method: 'POST', headers: { Title: title, 'Content-Type': 'text/plain; charset=utf-8' }, body: text } };
}
