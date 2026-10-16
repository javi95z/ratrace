/** One kind of error as `pnpm online:errors` reads it from the database. */
export interface KindRow {
  source: string;
  place: string;
  message: string;
  build: string | null;
  browser: string | null;
  seen: number;
  first_seen: string;
  last_seen: string;
}

/** How long ago a moment was, in the largest unit that fits: 5m, 3h, 2d. */
export function ago(at: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(at)) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86_400)}d`;
}

/** The kinds, the latest first, one line each and a line of what they said under it. None, and it says so. */
export function listOf(rows: readonly KindRow[], now: number): string[] {
  if (rows.length === 0) return ['No errors kept.'];
  return [...rows]
    .sort((a, b) => Date.parse(b.last_seen) - Date.parse(a.last_seen))
    .flatMap((row) => [
      `${ago(row.last_seen, now).padStart(4)} ago  ×${String(row.seen).padEnd(5)} ${row.source === 'page' ? 'page    ' : 'function'} ${row.place}  (first ${ago(row.first_seen, now)} ago${row.build ? `, ${row.build}` : ''}${row.browser ? `, ${row.browser}` : ''})`,
      `           ${row.message.replace(/\s+/g, ' ').slice(0, 160)}`,
    ]);
}

/** The rows of what `supabase db query` printed, or null if it printed none. */
export function rowsOf(output: string): KindRow[] | null {
  const start = output.indexOf('{');
  const end = output.lastIndexOf('}');
  if (start < 0 || end < start) return null;
  try {
    const parsed = JSON.parse(output.slice(start, end + 1)) as { rows?: unknown };
    return Array.isArray(parsed.rows) ? (parsed.rows as KindRow[]) : null;
  } catch {
    return null;
  }
}
