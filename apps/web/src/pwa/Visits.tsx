'use client';

import { Analytics } from '@vercel/analytics/next';

/**
 * How many come, to which page and from where, counted by Vercel with no cookie and nothing that
 * follows a person. The address is sent without its query: an invitation's code is nobody's to count.
 */
export function Visits() {
  return <Analytics beforeSend={(event) => ({ ...event, url: event.url.split('?')[0] })} />;
}
