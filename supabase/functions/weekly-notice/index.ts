// The weekly notice: on Monday morning, when a new challenge begins, every browser that asked for
// it is told so. Called by the `weekly-notice` job of the database (see the migration of the same
// name) with the project's secret key, never by a player.
//
// It needs the VAPID keys of the game as secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and
// VAPID_SUBJECT, a mailto: or https: address push services can reach the game at.
import { withSupabase } from 'npm:@supabase/server@1.9.0';
import webpush from 'npm:web-push@3.6.7';
import { json } from '../_shared/http.ts';
import { gone, noticeOf } from '../_shared/notice.ts';

interface Row {
  endpoint: string;
  p256dh: string;
  auth: string;
  locale: string;
}

const PAGE = 500;

export default {
  fetch: withSupabase({ auth: 'secret' }, async (_req: Request, ctx) => {
    const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const subject = Deno.env.get('VAPID_SUBJECT');
    if (!publicKey || !privateKey || !subject) return json(500, { error: 'no-vapid-keys' });
    webpush.setVapidDetails(subject, publicKey, privateKey);

    const db = ctx.supabaseAdmin;
    let sent = 0;
    let removed = 0;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db.from('push_subscriptions').select('endpoint, p256dh, auth, locale').order('endpoint').range(from, from + PAGE - 1);
      if (error) return json(500, { error: 'read-failed', sent, removed });
      const rows = (data ?? []) as Row[];
      await Promise.all(
        rows.map(async (row) => {
          try {
            // A day to be delivered: a Monday notice is no use on Wednesday.
            await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, JSON.stringify(noticeOf(row.locale)), { TTL: 86_400 });
            sent += 1;
          } catch (failure) {
            const status = (failure as { statusCode?: number }).statusCode;
            if (gone(status)) {
              await db.from('push_subscriptions').delete().eq('endpoint', row.endpoint);
              removed += 1;
            }
          }
        }),
      );
      if (rows.length < PAGE) break;
    }
    return json(200, { sent, removed });
  }),
};
