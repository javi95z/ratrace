# Expo app, phase 5b: the web's platform — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Everything the Next web does as a website, done by the app's web export with the same URLs, caches and notices, so plan 5c can swap it in with nothing lost: the language in the URL, HTML for each page with its search and share data, the service worker and web notices, the install offer, analytics, the desk layout, and a hosting configuration checked locally.

**Architecture:** Routes move under `app/[locale]/` (static params `en`, `es`, `ru`) on both platforms; every navigation goes through one helper that adds the language, and the phone's own links (`theratrace://…`) are mapped by `app/+native-intent.tsx`. The web export becomes static (`web.output: "static"`): one HTML per page and language. Platform pieces (service worker, manifest, icons, share image, sitemap, robots) are generated after the export by a script ported from `apps/web/scripts/pwa.ts`. Hosting is a Vercel configuration in `apps/mobile` with Routing Middleware for `/` and the language cookie; deploying it waits for the user.

**Tech Stack:** Expo SDK 58 web, expo-router 58 (static rendering, `generateStaticParams`, `expo-router/head`, `+html.tsx`, `+native-intent.tsx`), `@vercel/analytics`, Vercel Routing Middleware, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-20-expo-app-design.md`, "Phase 5 design". Contracts: `docs/superpowers/reports/2026-10-23-phase-5-web-inventory.md`. Plan 5a and its ledger (`.superpowers/sdd/2026-10-23-expo-phase-5a-light-web/progress.md`, items routed to 5b).

## Global Constraints

Plan 5a's Global Constraints hold (`docs/superpowers/plans/2026-10-23-expo-phase-5a-light-web.md`): twins not `Platform.OS` in screens; the phone does not change in what a player sees; the Next web does not change; contracts verbatim; `web:size`; no live project; dev servers only in the worktree; commit trailer. Added:

- **URLs, verbatim:** `/{en,es,ru}` + `'' /new /challenge /room /rankings /collection /records /play /player /legal`; `?code=` on room, `#friends` and `?tab=challenge` on rankings; `/` → `/{l}` by cookie `NEXT_LOCALE`, then `Accept-Language`, then `en`.
- **The phone keeps its links:** `theratrace://<page>` and `theratrace://room?code=` (push notices, invitations, Google's return `theratrace://auth`) open the same screens as today, in the phone's own language.
- **Service worker, verbatim:** `/sw.js` (scope `/`, headers `Cache-Control: no-cache, no-store, must-revalidate`, `Service-Worker-Allowed: /`), caches `ratrace-<engine>-<content>-<hash>` and `rat-race-language` (key `/__language`), `/offline.html`, the inventory's fetch rules, `push`/`notificationclick` with payload `{title, body, url, tag}`.
- **Web notices:** `push_subscriptions` through `community.notifyMe({endpoint, p256dh, auth}, locale)`; key `EXPO_PUBLIC_VAPID_PUBLIC_KEY` (the Next web's `NEXT_PUBLIC_VAPID_PUBLIC_KEY` value).
- **Weight:** the first page's JavaScript ≤ 0.8 MB gzip after code splitting (`web:size` gains this check); `web:size` runs in the web build and fails it.
- **Deploying** anything to Vercel, creating a Vercel project, or changing DNS waits for the user's go-ahead. This plan ends with a configuration checked locally (`vercel build` or a local static server with the middleware's logic under test).

## Review Focus

1. A shared invite link `/{l}/room?code=ABC123` opened on a phone browser with no saved language: the room opens in that page's language with the code filled (Task 1 test).
2. A returning player whose cookie says `es` opens `/`: `/es` (Task 9 middleware test).
3. A notice tapped while the page is closed opens `/{l}/challenge` in a new window; while a window is open, it focuses and navigates it (Task 5 test of the worker's click handler).
4. The page offline after one visit: `/{last language}` from the cache, any other uncached page `/offline.html` (Task 4 test).
5. A phone push notice `theratrace://rankings#friends` still opens the friends tab (Task 1 native-intent test).

---

### Task 1: The language in the URL

**Files:**
- Move: every route in `apps/mobile/src/app/` except `_layout.tsx`, `auth.tsx`, `scene.tsx`, `kit.tsx`, `dev.tsx`, `perf.tsx` into `apps/mobile/src/app/[locale]/` with `generateStaticParams` → `[{ locale: 'en' }, { locale: 'es' }, { locale: 'ru' }]` (in `app/[locale]/_layout.tsx`); `app/index.tsx` stays and redirects to `/{l}` (on the phone: its own language; on the web, Task 9's middleware answers `/` first)
- Create: `apps/mobile/src/game/pages.ts` — `hrefOf(page: Page, options?: { query?: Record<string, string>; hash?: string; locale?: string }): string` and `useGo(): { push(page, options?): void; replace(page, options?): void; home(): void }`; `type Page = '' | 'new' | 'challenge' | 'room' | 'rankings' | 'collection' | 'records' | 'play' | 'player' | 'legal'`
- Create: `apps/mobile/src/app/+native-intent.tsx` (`redirectSystemPath`: `theratrace://<page>[?query][#hash]` → `/{phone language}/<page>…`; `theratrace://auth` unchanged)
- Modify: the 17 files with 48 navigation calls (`router.push/replace/navigate/dismissTo`, `href=`) to use `useGo`/`hrefOf`; `online/push.ts` `pageOf`; the language switch in Settings (web: the same page in the other language; phone: as today); `game/locale.ts` (on the web the language is the URL's)
- Modify: `apps/mobile/src/architecture.test.ts` — (from 5a's final review) the twin guard also keys a twin named `index` by its directory (`@/online` for `online/index.web.ts`), checks names re-exported by shared files (`export { x } from '…'`), and its self-check covers both; and — no literal route path (`'/play'`, `` `/${…}` ``) in `src/game` or `src/ui` outside `game/pages.ts`

**Interfaces:**
- Produces: `hrefOf`, `useGo`, `Page` (every later task navigates through them); `useLocaleParam(): string` for the web's language.

- [ ] **Step 1: Write the failing tests:** `hrefOf('room', { query: { code: 'ABC123' }, locale: 'es' })` is `/es/room?code=ABC123`; `hrefOf('', { locale: 'ru' })` is `/ru`; `hrefOf('rankings', { hash: 'friends', locale: 'en' })` is `/en/rankings#friends`; `redirectSystemPath({ path: 'theratrace://room?code=ABC123' })` is `/<phone language>/room?code=ABC123` and `theratrace://auth` stays; a web page at `/es/play` draws in Spanish; the architecture rule fails on a screen with `router.push('/play')`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement** (move the routes, the helper, the native intent, the call sites).
- [ ] **Step 4: Run** the whole suite (phone and phone-web), the phone's routes tests, and the `appweb` compare for Home, Room and Rankings at their new URLs (`sceneShots` URLs gain the locale on the app's web). Expected: PASS; phone unchanged.
- [ ] **Step 5: Commit** (`feat(mobile): the language in the URL, the phone's links mapped to it`).

### Task 2: HTML for each page, split by page

**Files:**
- Modify: `apps/mobile/app.json` (`web.output: "static"`), `apps/mobile/src/app/+html.tsx` (create: `<html lang>` from the route, theme colour `#141b33`, `viewport-fit=cover`, the fonts' preload as the Next web's layout), any module that reaches `window`/`document`/`localStorage` at render or import (guard it: read in effects or behind `typeof window`), every `useSyncExternalStore` without a server snapshot
- Modify: `apps/mobile/scripts/webSize.ts` (+ test): the first page's JavaScript (the HTML of `/en` and the chunks it loads) ≤ 0.8 MB gzip; `expo-notifications` and `expo-web-browser` forbidden on the web (5a final review M3)

**Interfaces:**
- Consumes: Task 1's routes. Produces: a static export with `/{l}/<page>/index.html` (or `.html`) for every page and language.

- [ ] **Step 1: Write the failing tests:** `judgeWebExport` reports a first page over 0.8 MB and a missing `en/play.html` (per the export's naming); a server render of Home (expo-router's static renderer, or `renderToString` of the root with the router's static context) contains the front page's title text and no thrown error.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement** (static output; SSR-safe; async routes on the web so each page loads its own code).
- [ ] **Step 4: Run** `web:size`, the suite, and `web-life.ts` against the export. Expected: PASS; the first page's size printed.
- [ ] **Step 5: Commit** (`feat(mobile): the web is HTML first, each page with its own code`).

### Task 3: Search and share data

**Files:**
- Create: `apps/mobile/src/game/pageHead.tsx` (+ `.web.tsx` doing the work; phone returns null) — per page and language, as `apps/web/src/i18n/metadata.ts:47-71`: title `%s · {name}`, description, canonical `/{l}{page}`, hreflang per language + `x-default` → `/en{page}`, Open Graph (`website`, site name, `og:locale` `en_US`/`es_ES`/`ru_RU` + alternates, image `/og.png` 1200×630), Twitter `summary_large_image`, `/play` noindex
- Create: `apps/mobile/scripts/sitePieces.ts` (+ test) — after the export writes `sitemap.xml` and `robots.txt` (as `apps/web/src/app/sitemap.ts` and `robots.ts`), `og.png`, `manifest.webmanifest`, the icons and `favicon.ico` (as `apps/web/scripts/pwa.ts:186-239`, from the same sources)

- [ ] **Step 1: Write the failing tests:** the exported `/es/rankings` HTML holds the Spanish title, canonical `https://…/es/rankings`, three hreflang links and `x-default`; `/en/play` is `noindex, follow`; the sitemap lists every page but `/play` in every language with alternates; the manifest equals the Next web's (`id`, `start_url`, `scope` `/`, standalone, `#141b33`, the three icons).
- [ ] **Step 2–5:** run (FAIL), implement, run (PASS), commit (`feat(mobile): each page says what it is to search and to a shared link`).

### Task 4: The service worker

**Files:**
- Create: `apps/mobile/scripts/serviceWorker.ts` (+ test) — writes `/sw.js` after the export, ported from `apps/web/scripts/pwa.ts:24-183,241-257` with the same cache names, precache list (every page in every language, `public/*`, the export's static chunks), fetch rules, offline fallback, activate clean-up; `/offline.html` copied from the Next web's
- Create: `apps/mobile/src/pwa/register.ts` (+ `.web.ts`): production only, after `load`, `register('/sw.js', { scope: '/', updateViaCache: 'none' })`, `update()` on `online`

- [ ] **Step 1: Write the failing tests** (the worker's logic as pure functions, as the Next web's are tested): cache name from versions and file hashes; a navigation with a query goes to the network; offline `/` answers the cached `/{last language}`, else `/offline.html`; `/sprites/` cache-first; activate deletes other `ratrace-*` caches and keeps `rat-race-language`.
- [ ] **Step 2–5:** run (FAIL), implement, run (PASS; also open the export offline in Playwright after one visit), commit (`feat(mobile): the web works offline with the Next web's worker and caches`).

### Task 5: Web notices

**Files:**
- Modify: `apps/mobile/src/online/push.web.ts` (+ test) — as `apps/web/src/pwa/notifications.ts`: `canNotify` (key, service worker, PushManager, Notification), subscribe through the worker's `pushManager` with `EXPO_PUBLIC_VAPID_PUBLIC_KEY`, `community.notifyMe(keys, locale)`, `stopNotifying(endpoint)`, the market notice (`marketNotice`/`setMarketNotice(endpoint)`); `pushOn` answers `'on' | 'refused' | 'unavailable'` as the phone's
- Modify: Task 4's worker: `push` (not shown while a window is visible; same tag replaces; icon and badge `/icons/icon-192.png`), `notificationclick` (focus and navigate an open window, else open the notice's url)
- Modify: Settings' notices section only through the existing `Push` interface (no screen change if the interface suffices)

- [ ] **Step 1: Write the failing tests:** turning notices on calls `notifyMe` with `{endpoint, p256dh, auth}` and the page's language; off calls `stopNotifying(endpoint)`; a refused permission is `'refused'`; the worker's click handler focuses an open window and navigates it to the notice's url, else opens a window.
- [ ] **Step 2–5:** run (FAIL), implement, run (PASS), commit (`feat(mobile): web notices through the worker, as the Next web's`).

### Task 6: Installing the web app

**Files:**
- Create: `apps/mobile/src/pwa/install.tsx` (phone: nothing) and `install.web.tsx` — as `apps/web/src/pwa/runtime.tsx` and `InstallApp.tsx`: capture `beforeinstallprompt`, `appinstalled` → event `app_installed`, standalone and iOS detection, the offer on Home from the second visit until dismissed (localStorage `ratrace.installOffer` `{visits, dismissed}`, sessionStorage `'1'` per visit), the iOS steps in a Sheet; the iOS standalone viewport fix (`ViewportSync.tsx`)
- Modify: `apps/mobile/src/game/screens/Home.tsx` — renders `<InstallApp />` where the Next web's Home does (`Home.tsx:49,164`)

- [ ] **Step 1–5:** tests for the second-visit rule, dismissal kept, `app_installed` counted once, iOS steps shown on iOS Safari; run (FAIL), implement, run (PASS), commit (`feat(mobile): the web offers to install itself, as the Next web does`).

### Task 7: Analytics and the language cookie

**Files:**
- Create: `apps/mobile/src/pwa/visits.tsx` (phone: nothing) and `visits.web.tsx` — `@vercel/analytics/react` with `beforeSend` stripping the query (as `apps/web/src/pwa/Visits.tsx`), mounted in the root layout; the eight events also through Vercel's `track` in production, as `apps/web/src/pwa/events.ts` `toVercel`
- Modify: `apps/mobile/src/kvStore.web.ts` — `NEXT_LOCALE` written again on every page opened (5a final review M2), so a returning player within the browser's cap keeps the language

- [ ] **Step 1–5:** tests: the query never reaches Vercel; an event reaches `track` in production only; the cookie is written on each page with the inventory's attributes; run, implement, run, commit (`feat(mobile): visits and events counted as the Next web counts them`).

### Task 8: The desk layout, keyboard and Back

**Files:**
- Create: `apps/mobile/src/ui/desk.ts` (+ `.web.ts`): `useIsDesk()` (phone: false; web: `(min-width: 64rem)`)
- Modify: `game/screens/Play.tsx` (three columns at desk width as `apps/web/src/game/screens/Play.tsx:230,322-360`: `max-w 1480`, columns `minmax(280px,372px)` / `minmax(360px,1fr)` / `minmax(260px,340px)`, sticky profile and news asides, the stage `max-w 680` with art at 2× from 640 px, skip links), `ui/Sheet` (centred at desk width), `End.tsx` (two columns at `lg`), page widths (`max-w-md`: Home, NewLife, Challenge, PlayerProfile; `max-w-2xl`: Rankings, Records, Collection, Legal)
- Create: `apps/mobile/src/ui/keyboard.web.tsx` — the Next web's shortcuts and `?` sheet (`apps/web/src/ui/keyboard.tsx`, `docs/keyboard.md`)
- Create: `apps/mobile/src/ui/sheetHistory.web.ts` (used by `ui/back.ts`; the phone's `sheetHistory.ts` does nothing) — the browser's Back closes an open sheet (`history.pushState` mark + `popstate`, as `apps/web/src/ui/back.ts`), 5a final review

- [ ] **Step 1–5:** tests: Play at 1280 px wide has three columns in that order with the skip links; a sheet at desk width is centred; Back with a sheet open closes the sheet and stays on the page; each shortcut of `docs/keyboard.md` does its action; run, implement, run (also the `appweb` shots at 1280 px for Play, End, Rankings beside the Next web's), commit (`feat(mobile): the web at desk width, with the keyboard and Back`).

### Task 9: Hosting, checked locally

**Files:**
- Create: `apps/mobile/vercel.json` (or `vercel.ts`): build command `pnpm sprites && pnpm rules && npx expo export -p web && tsx scripts/sitePieces.ts && tsx scripts/serviceWorker.ts && tsx scripts/webSize.ts --export dist`, output `dist`, headers for `/sw.js`, `cleanUrls`; env names (`EXPO_PUBLIC_*`, `EXPO_PUBLIC_VERCEL_GIT_COMMIT_SHA=$VERCEL_GIT_COMMIT_SHA`)
- Create: `apps/mobile/middleware.ts` (Vercel Routing Middleware) + test — `/` → `/{l}` by `NEXT_LOCALE`, then `Accept-Language`, then `en`; sets `NEXT_LOCALE` on page navigations (as `apps/web/src/proxy.ts:21-35`); passes every other path
- Modify: `CLAUDE.md`, the spec's "Phases" (5b done; what 5c needs), a report `docs/superpowers/reports/2026-10-24-phase-5b-web-platform.md`

- [ ] **Step 1: Write the failing tests:** the middleware answers `/` with a redirect to `/es` for cookie `es`, to `/ru` for `Accept-Language: ru-RU`, to `/en` otherwise; it sets the cookie with the inventory's attributes on a page navigation and not on an asset.
- [ ] **Step 2–3:** run (FAIL), implement.
- [ ] **Step 4: Run** the build command locally into `dist`, serve it with the middleware's logic (a small local server under test, or `vercel build` + `vercel dev` if available without an account), and run `web-life.ts` and the `appweb` shots (phone and desk widths) against it, plus one browser run on the fake project (`scripts/fakeCloud.ts`) that signs in with its Google page and lands back on `/{l}?code=…` through the router (5a ruling): the account is kept and the address cleaned. Expected: all green; sizes in the report.
- [ ] **Step 5: Commit** (`feat(mobile): the web's hosting, ready for a preview`). Then stop: deploying a preview is the user's call (plan 5c).

### Task 10: The first visit as light as the Next web's

(Added 2026-10-24 by the controller's ruling after Task 2: the first page `/en` measured 994 KB gzip against the 0.8 MB target, and the page's `load` 5.2 s against the Next web's 1.2 s on a throttled connection, mostly the ten typefaces preloaded.)

**Files:**
- Modify: the export's font preloads (only the faces the first page draws — Jersey 15 and Chakra Petch — preloaded; the others loaded when a page needs them, as the Next web's `next/font` with Cyrillic faces not preloaded), the words (`packages/i18n` messages of the page's language only in the first page's code; the others loaded when the language changes), expo-audio and the sprite registry loaded on demand on the web, and whatever else the export's source maps show the front page carries without drawing it
- Modify: `apps/mobile/scripts/webSize.ts` — the first-page gate back to 0.8 MB gzip

- [ ] **Step 1: Write the failing test:** `web:size` with the 0.8 MB gate fails on today's export (record the number).
- [ ] **Step 2: Implement** the splits, web-only in effect (the phone loads what it loads today).
- [ ] **Step 3: Run** `web:size` (passes at ≤ 0.8 MB), `web-life.ts --export`, and the throttled measure of Task 2 (150 ms RTT, 9 Mbps, CPU ×4): first text no later than the Next web's, `load` no more than twice the Next web's. Record the numbers.
- [ ] **Step 4: Commit** (`perf(mobile): the web's first visit carries only what its first page draws`).
