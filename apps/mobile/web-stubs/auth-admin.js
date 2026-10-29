/*
 * The web's stand-in for @supabase/auth-js's admin API (GoTrueAdminApi.js, read in its place by metro.config.js): every auth client makes one, as
 * `auth.admin`, but it answers only to a project's secret key, which a page never holds. The game's pages use none of it.
 */
export default class GoTrueAdminApi {}
