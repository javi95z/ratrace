// Noting errors from any function: into the table of errors, through the database's own function,
// and an alert to the address in the secret ALERT_URL where there is one. Deno only: what is noted
// and what an alert says are worked out in `_shared/errors.ts`, where the tests reach them.
import { alertRequest } from '../_shared/errors.ts';
import type { ErrorRow, NoteDeps } from '../_shared/errors.ts';

/** The database client of the function: its own types are too deep to restate here. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/** How long an alert may take to be taken. */
const ALERT_PATIENCE_MS = 5_000;

/** The runtime's way to finish work after the answer has gone, where there is one (the Edge Runtime has). */
const runtime = (globalThis as { EdgeRuntime?: { waitUntil(work: Promise<unknown>): void } }).EdgeRuntime;

/** Sends one alert. Never throws: an alert that cannot be sent is only written to the logs. */
async function send(request: NonNullable<ReturnType<typeof alertRequest>>): Promise<void> {
  try {
    const answer = await fetch(request.url, { ...request.init, signal: AbortSignal.timeout(ALERT_PATIENCE_MS) });
    if (!answer.ok) console.error(`the alert was refused: ${answer.status}`);
  } catch (error) {
    console.error('the alert could not be sent:', error instanceof Error ? error.message : error);
  }
}

/** Noting errors with a function's own database client, as the server. */
export function notingIn(db: Db): NoteDeps {
  return {
    now: () => new Date(),
    async note(row: ErrorRow, now: Date) {
      const { data, error } = await db.rpc('note_error', {
        p_fingerprint: row.fingerprint,
        p_source: row.source,
        p_place: row.place,
        p_message: row.message,
        p_stack: row.stack,
        p_build: row.build,
        p_browser: row.browser,
        p_now: now.toISOString(),
      });
      if (error) throw new Error(`the error could not be kept: ${error.message}`);
      const said = (data ?? {}) as { seen?: unknown; alert?: unknown };
      return { seen: typeof said.seen === 'number' ? said.seen : 1, alert: said.alert === true };
    },
    async alert(title: string, text: string) {
      const address = Deno.env.get('ALERT_URL');
      if (!address) return;
      const request = alertRequest(address, title, text);
      if (request === null) {
        console.error('ALERT_URL is not an https address: no alert was sent');
        return;
      }
      // The player's answer never waits for an alert: the runtime finishes sending it after the answer has gone.
      const sending = send(request);
      if (runtime) runtime.waitUntil(sending);
      else await sending;
    },
  };
}

/** The same, from the context `withSupabase` hands a handler. */
export const noting = (ctx: { supabaseAdmin: Db }): NoteDeps => notingIn(ctx.supabaseAdmin);
