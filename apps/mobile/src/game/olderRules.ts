import type { LoadRules, OlderRules } from '@ratrace/core/session/legacy';
import { BUNDLED } from '../rules';

/**
 * The rules of the older versions as the phone has them: carried in the app (scripts/rules.ts copies every bundle the
 * web serves), so a life begun under one is finished under it with no connection. The web fetches the same files from
 * its site (session/rulesFromSite); there a missing file is a site that is late, here it is an app that is.
 *
 * A version the app does not carry is `unreachable`, never `gone`: the life waits, kept, for an update that carries
 * its rules (a life begun under rules newer than the app's is told apart before this is asked). Only a version
 * that no version of the game holds any more could be let go, and the app cannot know that.
 */
export const loadBundledRules: LoadRules = async ({ engine, content }) => {
  const key = `${engine}-${content}`;
  if (!Object.hasOwn(BUNDLED, key)) return 'unreachable';
  try {
    // Metro runs the bundle's module the first time it is asked for; a bundle that cannot run here is no reason to lose the life.
    return BUNDLED[key]() as OlderRules;
  } catch {
    return 'unreachable';
  }
};
