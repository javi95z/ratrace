import type { LoadRules, OlderRules } from '@ratrace/core/session/legacy';

/**
 * The rules of older versions as the web serves them, next to the page: loaded only for a life
 * begun under them. The import is the browser's own, so the page's bundler leaves the file alone.
 * A life is never let go for rules the site does not have just now: a site put out a moment before
 * its rules, or a cache, is no reason to lose it. It waits, kept, and is asked for again later.
 */
export const loadRulesFromSite: LoadRules = async ({ engine, content }) => {
  const url = `/rules/v${engine}-${content}.js`;
  try {
    const load = new Function('url', 'return import(url)') as (url: string) => Promise<OlderRules>;
    return await load(url);
  } catch {
    return 'unreachable';
  }
};
