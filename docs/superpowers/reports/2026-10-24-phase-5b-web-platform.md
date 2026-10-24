# Phase 5b: the app's web as a website

The report of phase 5b's last task. Plan 5a made the app's web a light, complete web in development. Plan 5b adds what the Next web does as a website:
its addresses, its pages' HTML and heads, its service worker, notices and install offer, its counting, its desk layout and keyboard, and its
hosting. The result is a site built and served on this machine as Vercel will build and serve it. Nothing is deployed. The preview, and the swap
after it, wait for the user's go-ahead (plan 5c). The plan is `docs/superpowers/plans/2026-10-24-expo-phase-5b-web-platform.md`. Its ledger and
reviews are in `.superpowers/sdd/2026-10-24-expo-phase-5b-web-platform/`.

## What the phase made

| Task | What |
|---|---|
| 1 | The language in the address: the pages under `app/[locale]/` as the Next web's (`/es/room?code=`, `/en/rankings#friends`), `/` leading to one, the phone's `theratrace://<page>` links made pages of the phone's language. |
| 2 | Static HTML for each page in each language, drawn on the build's machine as a first visit shows it, then taken over by the browser. |
| 3 | Each page's head (title, description, canonical, hreflang, Open Graph, card) in its address's language. The sitemap, robots, manifest, share image, icons and favicon, all as the Next web's. |
| 4 | The Next web's service worker, word for word: its caches, rules and offline page. Every page and file is precached. |
| 5 | The game's notices as browser push (VAPID, `push_subscriptions`), and the worker's `push` and `notificationclick`. |
| 6 | The install offer (Chrome's prompt, the iOS steps, Home's offer from the second visit). |
| 7 | Vercel Web Analytics and the eight events. The language cookie is written on every page opened. |
| 8 | The desk layout (three columns for a life) and the keyboard (`docs/keyboard.md`). Sheets are dialogs. The browser's Back closes a sheet. |
| P | `dev`'s front-door and sticky-figures changes ported to the app. |
| 10 | The first visit made as light as the Next web's: code split by page, each language's words a chunk of their own, only the first typefaces fetched ahead. |
| 9 | Hosting: `vercel.json`, the Routing Middleware, the build Vercel runs, and the site checked locally as Vercel serves it (below). |

## Hosting (Task 9)

- **`apps/mobile/vercel.json`** describes the site as its own Vercel project, with Root Directory `apps/mobile` and no framework.
  - `buildCommand` is `pnpm web:build`, and the output folder is `dist`.
  - Two rewrites serve the pages at their addresses: `/{en,es,ru}` goes to `<l>/index.html`, and `/{l}/<page>` goes to `<l>/<page>.html`.
  - It does not use `cleanUrls`. Vercel turns that option into 308 redirects of every `*.html` address, which would send `/offline.html` (the
    address where the worker keeps its offline page, the Next web's) to `/offline`. A cached redirect cannot answer a navigation.
  - `/sw.js` gets the Next web's headers (`Cache-Control: no-cache, no-store, must-revalidate`, `Service-Worker-Allowed: /`). `/_expo/static/*`
    (files named by what they hold) is immutable, as the Next web's `_next/static`.
  - An address with no page gets the site's `404.html` (the router's page of nothing), with a 404.
  - An address ending in a slash is led (308) to the same address without it (`trailingSlash: false`), Vercel's first route, as the Next web.
- **`apps/mobile/middleware.ts`** is Vercel's Routing Middleware (the file convention for a project that is not Next's).
  - An address with no language (`/`, `/play`, `/room?code=…`) is redirected (307) to the same page under `/{l}`, by `NEXT_LOCALE`, then
    `Accept-Language`, then `en`. The query is kept. `/EN/play` goes to `/en/play`. The redirect writes the cookie again where it named another
    language, or where there was none and the browser would lead elsewhere (next-intl's `syncCookie`).
  - A page opened in a language writes `NEXT_LOCALE=<l>; Path=/; Expires=…; Max-Age=31536000; SameSite=lax`. Nothing a page fetches writes it.
  - Its matcher is the Next web's, with `_expo` for `_next`.
  - Its test runs the Next web's own proxy (`apps/web/src/proxy.ts`, next-intl under it) beside it on the same requests: 162 requests to the bare
    address, 480 to addresses with no language or one in other letters, and 12 to pages give the same status, location and cookie.
  - It uses `next()` from `@vercel/functions/middleware` (3.9.11). It names nothing of the workspace: its languages are held to `@ratrace/i18n` by
    the test.
- **`scripts/webBuild.ts`** (`pnpm web:build`) is the build Vercel runs. The checks on this machine run the same build. Its steps, in order:
  1. Copy the sprites and the older rules (`pnpm sprites`, `pnpm rules`).
  2. Export the web with source maps. `EXPO_PUBLIC_VERCEL_GIT_COMMIT_SHA` comes from Vercel's `VERCEL_GIT_COMMIT_SHA`.
  3. Take the maps out once read, and take the two lines that name them off each script. The scripts are then byte for byte those of an export
     made without maps (1,321 of 1,321 files compared).
  4. Settle the pages: the router's templates (`[locale].html`, `[locale]/*.html`, `_sitemap.html`) and the development and phone routes' HTML
     (`scene`, `kit`, `dev`, `perf`, `auth`) are dropped, 16 files. They carried the English head and were in no sitemap. The router's page of
     nothing becomes `404.html`.
  5. Write the site's pieces, then the worker.
  6. Run web:size's checks on the site as it is, and the site's own (`judgeSiteFiles`): every piece present, no template page, no source map.
     A problem fails the build.
- **Two fixes the local runs found.** Both are in shared code, and the phone is unchanged.
  - **The weekly challenge's page hydrated badly on a site with a project.** React logged its #418, which the page's error watch would report.
    `useCanSignIn` answered "a project" at once, where the HTML, always drawn offline, had none. It now has a server snapshot.
  - **Offline, `/` is answered by the worker with the cached `/{last language}`.** The router took that HTML over as the bare address's page, and
    React logged #418. The document now moves the address to the page's canonical path before the app starts (`app/+html.tsx`).

## Sizes

The site was built here with `pnpm web:build`, offline. A build on the fake project and Vercel's local build gave the same numbers within 0.01 MiB.

| What | Size | Gate |
|---|---|---|
| The app's JavaScript, 53 files | 4.87 MiB, 1.19 MiB gzip | 1,350 KiB gzip (1.32 MiB) |
| The first page (`/en`: its HTML, the 23 scripts it names and its words' 2 chunks) | 0.74 MiB gzip | 800 KiB (0.78 MiB) |
| A first visit to `/en` in Chrome (25 scripts) | 0.74 MiB gzip | 800 KiB |
| Then, once idle, `/new` and `/play` warmed | 8 scripts, 0.15 MiB gzip | none |
| The site | 1,315 files, 28 MB, 1,309 precached by the worker | none |
| Pages | 30 of 30 (10 pages × 3 languages), each with the Next web's head | all |

## Timings

- **First visit.** These are Task 10's numbers, not measured again here: Chrome, throttled, gzip. The first text comes at 304 ms (the Next web:
  504 ms) and the page is loaded at 1,327 ms (the Next web: 1,253 ms).
- **The build here, Metro's cache warm.** Sprites and rules took 1.2 to 1.3 s, the export 7.0 to 8.2 s, the pages, pieces and worker 0.1 s, and
  the checks 0.3 s: about 10 s in all. On Vercel, with a cold cache, the export will take longer. Vercel's local build (`vercel build`) took 20 s.
- **The local checks.** `web-life --export` took 2 min 5 s, `web-offline` 3 s on a built site, and `web-signin` 46 s (its own build included).

## Checks run

| Check | Result |
|---|---|
| `pnpm -s test` | 415 files, 4,753 tests passed. |
| `pnpm -s typecheck`, `pnpm -s lint` | clean |
| `pnpm --filter @ratrace/mobile web:build` | the site built, no problem |
| `web-life.ts --export --site=../mobile/dist` | exit 0. A life begun on the Next web (nurse, round 3) was continued and finished on the built site. `/` was led to `/en` by the middleware. The 19 older rules are served as scripts. The browser asked nothing beyond this machine. |
| `web-offline.ts --site=../mobile/dist` | exit 0. One visit online, then offline: `/` gives the cached `/es`, now at its own address. `/es/rankings`, never opened, comes from the cache. `/en/nowhere` gives `/offline.html`. `?code=` is left to the network. |
| `web-signin.ts` (the fake project) | exit 0. 13 pages at 393 and 1280 wide were taken over with no hydration error and nothing logged. The flow went: the front door's "Sign in with Google", the fake Google page, then back at `/en?code=…` (200, through the middleware, the rewrite and the router). It ended "Linked to Google", with one member on the fake project and the address cleaned to `/en`. |
| `scene-shots appweb`, phone width | exit 0. Seven of eight scenes clean (`home-new`, `play-cards-r1`, `challenge-practice`, `challenge-attempt`, `settings-account-guest`, `rankings-all`, `room-door`). `home-member` was accepted on its record. |
| `scene-shots appweb --viewport=desk` | exit 0. `play-news-r1`, `end-escaped` and `rankings-all` were accepted on their records. |
| `vercel build` (CLI 54.10.3, no account) | Built with a hand-written `.vercel/project.json` naming no project, removed after. The routes it made are below. |

The routes Vercel made of the configuration (`.vercel/output/config.json`), in order:

1. The headers of `/sw.js` and `/_expo/static/*`.
2. The middleware on its matcher. It is compiled as an Edge function, `middleware.func`, with `@vercel/functions` in its file map.
3. The filesystem.
4. The two rewrites.
5. For an error, `/404.html` with a 404.

The static output holds the 53 files under `assets/__node_modules/.pnpm/`. The builder lists its output with `dot: true`, as `@vercel/static-build`'s
source shows.

## Only a real deployment can show

- That the CDN serves files under a folder whose name begins with a dot (`/assets/__node_modules/.pnpm/…`, 53 files, the typefaces among them).
  They are in the build's output. Vercel serves `.well-known/` folders the same way, but a 200 from the preview is the proof.
- That the Edge function bundles `@vercel/functions/middleware` from the pnpm workspace as the local build's file map says.
- The headers Vercel adds itself, and gzip or Brotli by its own rules. Locally, `serveExport` gzips text, scripts and TrueType faces.
- Web Analytics' `/_vercel/insights/*`. The local server answers it with a stand-in that counts nothing.
- The cold build's time and memory on Vercel's machines. Which pnpm Vercel picks: it said 9.x by the lockfile's date, and this machine has 9.1.3.

## Left for 5c, and minors

- **The user's part:** the Vercel project, its environment, its branch, the preview and the swap. The spec's "Phases" lists them under 5b done.
- **`web-life.ts --export` cannot run in Vercel's build.** It needs Chrome and the Next web's `next dev`, and it is the only check that sees the
  first draw's lazy chunks. It is run on this machine before a deployment (CLAUDE.md).
- **The minors the reviews parked** are in the ledger: one visit under the old worker, 4 MB of TrueType weights precached, a dismissed notice
  prompt reading as "on" with no keys, and others.
