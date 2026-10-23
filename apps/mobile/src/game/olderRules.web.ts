import type { LoadRules, OlderRules } from '@ratrace/core/session/legacy';

/** The browser's own import of a script by its address, as the Next web does it: the export's bundler leaves the file alone, and the bundle carries none of the rules. */
const importFromSite = (url: string): Promise<unknown> => (new Function('url', 'return import(url)') as (url: string) => Promise<unknown>)(url);

/**
 * The web export's twin of `olderRules.ts` (Metro picks it for the web). The rules of the older versions come from the site, next to the page
 * (`public/rules`, copied there by scripts/rules.ts), loaded only for a life begun under them, as the Next web does (session/rulesFromSite):
 * the app's web carries none of them. A life is never let go for rules the site does not have just now: a site put out a moment before its
 * rules, or a cache, is no reason to lose it. It waits, kept, and is asked for again later.
 *
 * `load` is the import itself, given so that a test can answer for the site.
 */
export const loadBundledRules = (async ({ engine, content }, load: (url: string) => Promise<unknown> = importFromSite) => {
  try {
    return (await load(`/rules/v${engine}-${content}.js`)) as OlderRules;
  } catch {
    return 'unreachable';
  }
}) satisfies LoadRules;
