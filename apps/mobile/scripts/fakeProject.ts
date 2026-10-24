/*
 * Where the fake project of this machine answers (`scripts/fakeCloud.ts`) and the key the app is built with for it: named apart, so that what only
 * names it (the checks' environments, `webLife.ts`'s `fakeEnv`) does not load the fake project itself. Never the live project's.
 */

/** The port of this machine the fake project listens on. */
export const FAKE_CLOUD_PORT = 54399;
/** The publishable key the app is built with: anything, it is only read. */
export const FAKE_KEY = 'sb_publishable_fake_local_only';
