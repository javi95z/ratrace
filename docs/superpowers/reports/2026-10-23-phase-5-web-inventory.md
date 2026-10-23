# Phase 5: what the Next web does as a website (inventory, 2026-10-23)

What the Expo app must do, or keep, to replace `apps/web` as the web. Web paths are under `apps/web/src`, app paths under `apps/mobile/src`.

## Contracts existing players depend on (keep exactly)

| What | Contract | Where |
|---|---|---|
| URLs | `/{en,es,ru}` + `'' /new /challenge /room /rankings /collection /records /play /player /legal`; `/{l}/room?code=XXXXXX` (≤ 6 alphanumerics, upper-cased); `/{l}/rankings#friends`, `/{l}/rankings?tab=challenge`; `/` → `/{l}` by cookie `NEXT_LOCALE`, then Accept-Language, then `en` | `app/[locale]/*`, `i18n/routing.ts:12-16`, `proxy.ts:21-35`, `Room.tsx:202,529`, `Rankings.tsx:380,394` |
| Language cookie | `NEXT_LOCALE`, path `/`, max-age 31536000, SameSite lax, set again on each page opened | `proxy.ts:21-29` |
| Saves | IndexedDB `ratrace` v1 (`idb`): stores `currentGame` (key `'only'`), `runs` (keyPath `runId`), `profile` (key `'only'`); `ResilientStore` over `MemoryStore` when there is no IndexedDB | `session/indexeddb.ts:7-28`, `game/context.tsx:107-134` |
| localStorage | `ratrace.basket` `{gameId, round, orders}` (removed when empty); `ratrace:given-up`, `ratrace:refused` (JSON string[]); `ratrace.lastAccount` (user id); `ratrace.installOffer` `{visits, dismissed}` | `game/browserBasket.ts:4`, `online/index.ts:118-158`, `online/language.ts:5`, `pwa/InstallApp.tsx:9` |
| The account's session | supabase-js default storage: localStorage `sb-<project ref>-auth-token` (+ `-code-verifier`); `persistSession`, `autoRefreshToken`, `detectSessionInUrl`, PKCE; no custom storage | `packages/online/src/connect.ts:541-552` |
| sessionStorage | `ratrace:keeping-account`; `ratrace.installOffer` `'1'` per visit | `game/context.tsx:172` |
| Older rules | `/rules/v{engine}-{content}.js`, loaded by `new Function('url','return import(url)')`; any failure is `'unreachable'` (the life waits) | `session/rulesFromSite.ts:9-17`, `apps/web/public/rules/*` (written by `tools/online/src/bundle.ts:101`) |
| Service worker | `/sw.js`, scope `/`; caches `ratrace-<engine>-<content>-<hash>` (others deleted on activate) and `rat-race-language` (key `/__language`); `/offline.html`; headers `Cache-Control: no-cache, no-store, must-revalidate`, `Service-Worker-Allowed: /`; handles `push` and `notificationclick` | `apps/web/scripts/pwa.ts:24-257`, `apps/web/next.config.ts:9-19` |
| Web push | payload `{title, body, url, tag}`; table `push_subscriptions(endpoint pk, p256dh, auth, locale, user_id, market_moved)`; client key `NEXT_PUBLIC_VAPID_PUBLIC_KEY`; the web subscribes through `community.notifyMe({endpoint, p256dh, auth}, locale)` | `pwa/notifications.ts`, `Settings.tsx:252-315`, `supabase/functions/_shared/notice.ts:147-163` |
| Installed web app | manifest `id`/`start_url`/`scope` `/`, standalone, `#141b33`, icons `/icons/icon-192.png`, `/icons/icon-512.png`, `/icons/icon-maskable-512.png`, `apple-touch-icon.png`, `/favicon.ico` | `app/manifest.ts`, `scripts/pwa.ts:186-203` |
| Google's return | to `location.href` minus the hash; allowed `https://ratrace-plum.vercel.app/**` | `game/context.tsx:480`, `supabase/config.toml:165-169` |

## The rest of the platform

- **Service worker behaviour.** Precache of every page in every language, `public/*` and the static chunks (batches of 16, failures ignored); same-origin GET only, `/api/` skipped; a navigation with a query string goes to the network untouched (OAuth codes never cached); navigations network-first with preload, the language of a page that loaded remembered; offline `/` → the cached `/{last language}`, else `/offline.html`; static chunks, `/sprites/`, `/icons/` cache-first; manifest and `offline.html` stale-while-revalidate; registered in production after `load` with `updateViaCache: 'none'`, `update()` on `online`; no skipWaiting. A push is not shown while a window is visible; same tag replaces; click focuses or opens the notice's url.
- **Install.** `beforeinstallprompt`, `appinstalled` (event `app_installed`), standalone and iOS detection (`pwa/runtime.tsx`); offered on Home from the second visit until dismissed, iOS steps in a Sheet (`pwa/InstallApp.tsx`, `Home.tsx:49,164`); iOS standalone viewport fix (`pwa/ViewportSync.tsx`).
- **SEO.** `i18n/metadata.ts:47-71`: title `%s · {name}`, description, canonical `/{l}{page}`, hreflang per language + `x-default` → `/en{page}`, Open Graph (`og:locale` `en_US`/`es_ES`/`ru_RU`, image `/og.png` 1200×630), Twitter `summary_large_image`, `/play` noindex; `app/sitemap.ts` (every page but `/play`, every language, alternates); `app/robots.ts` (allow `/`, disallow `/api/`, sitemap); `<html lang>`, theme colour `#141b33`, `viewportFit: cover`. `public/og.png` is static (`scripts/pwa.ts:213-239`).
- **Analytics.** `@vercel/analytics` with the query stripped (`pwa/Visits.tsx`); the eight events through `track` in production (`pwa/events.ts`, `useTrack`). The game's own `track` function accepts platform `web` (`supabase/functions/_shared/events.ts:22`); the web does not call it today.
- **Desk layout.** `--breakpoint-desk: 64rem`, `useIsDesk`; Play at desk width: three columns (`max-w-[1480px]`, `minmax(280px,372px)` / `minmax(360px,1fr)` / `minmax(260px,340px)`), sticky profile and news asides, stage `max-w-[680px]` with art at 2× from 640 px, skip links (`Play.tsx:230,322-360`); sheets centred at desk width (`ui/overlay.tsx:141`); End two columns at `lg`; page widths `max-w-md` (Home, NewLife, Challenge, PlayerProfile) or `max-w-2xl` (Rankings, Records, Collection, Legal); keyboard shortcuts and a `?` sheet (`ui/keyboard.tsx`, `docs/keyboard.md`).
- **Errors.** Production only: `errorWatch` + `watchPage(window)`, place = pathname, build = `buildOf(engine, content, commit)` (`NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`), browser = `browserOf(UA)` (`online/index.ts:76-91,161-169`).
- **Sharing.** Picture: canvas → PNG → `File`, `navigator.share({files, title, text})` when it can, and a download link (`ShareCard.tsx:140-197`); room invite: `navigator.share({url})`, else the clipboard (`Room.tsx:529-555`); friend code: `navigator.clipboard` (`PlayerProfile.tsx:101`).
- **Turnstile.** Script `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`, invisible, 120 s; only with `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (unset today) (`online/captcha.ts`).
- **Fonts.** Jersey 15, Chakra Petch 400/600, Oswald 500 and Exo 2 400/600 (Cyrillic, not preloaded) (`[locale]/layout.tsx:15-39`).
- **Sound.** WebAudio, created on the first tap (`ui/sound.ts`).
- **Back closes sheets.** `history.pushState` + `popstate` (`ui/back.ts`).
- **Hosting.** `apps/web/vercel.json` only `ignoreCommand` (builds `main` only); no CSP or security headers; env `NEXT_PUBLIC_*` as listed in `CLAUDE.md`.

## What the app has, and the gap on the web

| Area | The app today | On the web it needs |
|---|---|---|
| Saves | `kvStore.ts` on expo-sqlite (`ratrace:game`, `ratrace:run:<id>`, `ratrace:basket`…) | the IndexedDB `ratrace` v1 store and the localStorage keys above, so a player's saves and account are where they are |
| Session | `ratrace:session:` prefix, refresh only in front | supabase-js's default storage and refresh, `detectSessionInUrl`, Google by redirect |
| Older rules | bundled (`rules/index.ts`) | fetched from `/rules/*.js` |
| Drawing | Skia (14 files) | the browser's images, CSS, SVG and canvas |
| Language | `ratrace:locale` | the URL prefix and `NEXT_LOCALE` |
| Push | Expo tokens | VAPID through the service worker |
| PWA, SEO, desk layout, keyboard, analytics | none | all of it |
