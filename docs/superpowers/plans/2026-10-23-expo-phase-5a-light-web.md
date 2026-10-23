# Expo app, phase 5a: the app runs as a light web — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The app's web export plays the whole game in a browser, on the saves, account and older rules the Next web left there, carrying none of the phone's weight (no Skia, no formatjs, no bundled rules, no SQLite), its scenes compared with the Next web's in the same browser.

**Architecture:** What differs on the web lives in `.web.ts(x)` twins of the phone's files, with the same exports; Metro picks them for `--platform web`, and a vitest project `phone-web` resolves them the same way. The twins keep the Next web's browser contracts byte for byte (`docs/superpowers/reports/2026-10-23-phase-5-web-inventory.md`). A size check on the web export holds the weight.

**Tech Stack:** Expo SDK 58 web (react-native-web 0.21, Metro), `idb` (as the Next web), Playwright (the shots), vitest + jsdom + fake-indexeddb.

**Spec:** `docs/superpowers/specs/2026-10-20-expo-app-design.md`, section "Phase 5 design". Also read `docs/superpowers/reports/2026-10-23-phase-5-spike.md` and `docs/superpowers/reports/2026-10-23-phase-5-web-inventory.md`.

## Global Constraints

Everything in phase 2's and phase 3's Global Constraints still holds (`docs/superpowers/plans/2026-10-21-expo-phase-2-solo-game.md`, `docs/superpowers/plans/2026-10-23-expo-phase-3-online.md`): kit rules, parity, method. Added:

- **The phone does not change.** Every web difference is a `.web.ts(x)` twin (or a shared pure module both import). The phone's tests stay green and `npx expo export --platform ios` still builds. No `Platform.OS === 'web'` in screens.
- **The Next web does not change.** Nothing under `apps/web` is edited; tests may import `apps/web/src` files to prove a contract (read only).
- **Contracts, verbatim:** IndexedDB `ratrace` version 1, stores `currentGame` (key `'only'`), `runs` (keyPath `runId`), `profile` (key `'only'`); localStorage `ratrace.basket`, `ratrace:given-up`, `ratrace:refused`, `ratrace.lastAccount`; sessionStorage `ratrace:keeping-account`; the account's session in supabase-js's default storage (no `storage` option, so `sb-<ref>-auth-token`); language cookie `NEXT_LOCALE` (path `/`, max-age 31536000, SameSite lax); older rules at `/rules/v{engine}-{content}.js`.
- **Weight.** `pnpm --filter @ratrace/mobile web:size` passes after every task that touches the web build: no `.wasm` in the export; JavaScript ≤ 1.35 MB gzip in all; no module from `@shopify/react-native-skia`, `canvaskit-wasm`, `expo-sqlite`, `@formatjs/*`, `react-native-webview`, `expo-media-library` or `src/rules/v*.js` in the web bundle (read from the export's source maps).
- **No live project.** The web build is checked offline (no `EXPO_PUBLIC_SUPABASE_*`) or on the fake project (`scripts/fakeCloud.ts`). Never a browser on the live Supabase.
- **Dev servers.** Only in the `.worktrees/expo` worktree, never in the repo's root (another session works there). Ports: app web 8091, the shots' own Next 3021.
- **Commits** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A browser with no IndexedDB (or one that refuses it): the game still plays, in memory, as the Next web's `ResilientStore` over `MemoryStore` does (Task 2 test).
2. A life in progress saved by the Next web under older rules: Continue finds it, and its rules come from `/rules` (Tasks 2 and 3 tests).
3. A guest or Google account signed in on the Next web: the app's web build finds the same session (no `storage` passed, `detectSessionInUrl` on) (Task 8 test).
4. A sprite that fails to load: a placeholder of the sprite's size, logged once, as the Next web's `Sprite` (Task 4 test).
5. An older rules file missing or the network down: `'unreachable'`, the life kept and waiting (Task 3 test).

---

### Task 1: The web build: a test project, the size check, the browser's own Intl

**Files:**
- Modify: `vitest.config.ts` (a project `phone-web`)
- Create: `apps/mobile/scripts/webSize.ts`, `apps/mobile/scripts/webSize.test.ts`
- Modify: `apps/mobile/package.json` (script `web:size`)
- Create: `apps/mobile/src/intl.web.ts`, `apps/mobile/src/polyfills.web.ts`, `apps/mobile/src/intl.web.test.ts`

**Interfaces:**
- Produces: vitest project `phone-web` running `apps/mobile/src/**/*.web.test.{ts,tsx}` in jsdom with the phone's setup (`apps/mobile/src/testing/setup.ts`), resolving `.web.tsx`, `.web.ts` before `.tsx`, `.ts`; the `phone` and `repo` projects exclude `apps/mobile/src/**/*.web.test.*`.
- Produces: `judgeWebExport(files: { path: string; bytes: Buffer }[], sources: string[]): string[]` (problems, empty when fine) in `scripts/webSize.ts`; `pnpm --filter @ratrace/mobile web:size` exports to a temp folder with source maps, judges, prints totals, exits 1 on a problem.

- [ ] **Step 1: Write the failing tests.** `webSize.test.ts`: `judgeWebExport` reports a `.wasm` file; a JS total over 1.35 MB gzip (`1_350 * 1024`); a source naming each forbidden module (`@shopify/react-native-skia`, `canvaskit-wasm`, `expo-sqlite`, `@formatjs/`, `react-native-webview`, `expo-media-library`, `apps/mobile/src/rules/v0.40.0-1.41.0.js`); and returns `[]` for a small clean export. `intl.web.test.ts` (phone-web): importing `./polyfills` resolves to the web twin and installs nothing over the browser's `Intl.NumberFormat`, `Intl.PluralRules`, `crypto.subtle` and `structuredClone` (same function objects before and after).
- [ ] **Step 2: Run** `npx vitest run --project repo apps/mobile/scripts/webSize.test.ts` and `npx vitest run --project phone-web` from the repo root. Expected: FAIL (no module / no project).
- [ ] **Step 3: Implement.** The `phone-web` project; `judgeWebExport`; the `web:size` script (`expo export --platform web --source-maps --output-dir <tmp>`; sources read from every `.map`, indexed maps' `sections` included); `polyfills.web.ts` imports nothing from expo-crypto or formatjs and installs only what a browser may lack (nothing today: an empty module with the phone file's exports, if any); `intl.web.ts` the same.
- [ ] **Step 4: Run the tests, then `pnpm --filter @ratrace/mobile web:size`.** Expected: tests PASS; `web:size` still FAILS on Skia, SQLite and the rules (later tasks remove them) but no longer lists `@formatjs/`. Record its printed totals in the report.
- [ ] **Step 5: Commit** (`feat(mobile): the web build's own test project, its size check, and the browser's Intl`).

### Task 2: The web's store: the Next web's IndexedDB and browser keys

**Files:**
- Create: `apps/mobile/src/kvStore.web.ts`, `apps/mobile/src/kvStore.web.test.ts`
- Modify: `apps/mobile/package.json` (`idb`, same range as `apps/web`; `fake-indexeddb` as a dev dependency)
- Modify: `apps/mobile/src/architecture.test.ts` (the device's storage may be named in `kvStore.web.ts` too)

**Interfaces:**
- Consumes: the phone file's exports (`apps/mobile/src/kvStore.ts`): `KvStore` (a `PlayerStore`), `kvLanguage: LanguageKeep`, `kvBasket: BasketText`, `kvSession`, `KeptText`, `kvText`, `kvKeeping`, `kvPush`, `kvLastAccount`.
- Produces: the same names and types on the web. `KvStore` = the Next web's IndexedDB store wrapped as the Next web wraps it (`ResilientStore` over `MemoryStore` when `indexedDB` is missing or refuses); `kvBasket` on localStorage `ratrace.basket` (removed for `null`); `kvText` = `localStorage`; `kvSession` = localStorage with no prefix (the web wiring passes no storage; this only keeps the export); `kvKeeping` on sessionStorage `ratrace:keeping-account`; `kvLastAccount` localStorage `ratrace.lastAccount`; `kvPush` localStorage `ratrace:push` (same shape as the phone's); `kvLanguage` reads and writes the cookie `NEXT_LOCALE` (path `/`, max-age 31536000, SameSite lax). Every write that throws is swallowed as the phone's are.

- [ ] **Step 1: Write the failing tests** (`kvStore.web.test.ts`, phone-web, `fake-indexeddb/auto`):
  - a game, two finished runs and a profile written through the Next web's own store (`apps/web/src/session/indexeddb.ts`) are read back unchanged by `new KvStore()`, and what `KvStore` writes the Next web's store reads;
  - with `indexedDB` undefined, `new KvStore()` saves and loads a game in memory;
  - `kvBasket.write('x')` sets localStorage `ratrace.basket` to `'x'`; `write(null)` removes it;
  - `kvLanguage.write('es')` sets `document.cookie` to contain `NEXT_LOCALE=es`; `kvLanguage.read()` returns `'es'`;
  - `kvKeeping.set()` then `take()` is `true` once, then `false`, through sessionStorage `ratrace:keeping-account`; `kvLastAccount` round-trips through localStorage `ratrace.lastAccount`.
- [ ] **Step 2: Run** `npx vitest run --project phone-web apps/mobile/src/kvStore.web.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `kvStore.web.ts` (the IndexedDB schema as `apps/web/src/session/indexeddb.ts:7-28`, written again here, not imported: the app must not depend on `apps/web`).
- [ ] **Step 4: Run** the test file, `npx vitest run --project phone apps/mobile/src/architecture.test.ts`, and `web:size`. Expected: PASS; `web:size` no longer lists `expo-sqlite`.
- [ ] **Step 5: Commit** (`feat(mobile): the web keeps its saves where the Next web keeps them`).

### Task 3: Older rules from the site

**Files:**
- Create: `apps/mobile/src/game/olderRules.web.ts`, `apps/mobile/src/game/olderRules.web.test.ts`
- Modify: `apps/mobile/scripts/rules.ts`, `apps/mobile/scripts/rules.test.ts` (also copy the bundles to `apps/mobile/public/rules/`), `apps/mobile/.gitignore` (`public/rules/`)

**Interfaces:**
- Produces: `loadBundledRules: LoadRules` on the web (same name and type as `game/olderRules.ts`): imports `/rules/v${engine}-${content}.js` with `new Function('url', 'return import(url)')` (the Next web's `session/rulesFromSite.ts:9-17`); any failure → `'unreachable'`. An optional second parameter `load = (url: string) => Promise<unknown>` for tests.

- [ ] **Step 1: Write the failing tests:** the URL asked for `{ engine: '0.40.0', content: '1.41.0' }` is `/rules/v0.40.0-1.41.0.js` and the module it answers is returned; a rejecting load gives `'unreachable'`; `rules.test.ts`: `pnpm rules` leaves every `apps/web/public/rules/v*.js` also in `apps/mobile/public/rules/`, byte for byte.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the tests and `web:size`. Expected: PASS; `web:size` no longer lists `src/rules/v*.js`; the export holds `rules/v0.40.0-1.41.0.js`.
- [ ] **Step 5: Commit** (`feat(mobile): the web fetches older rules from the site, as the Next web does`).

### Task 4: Sprites and the rat without Skia

**Files:**
- Create: `apps/mobile/src/ui/Sprite.web.tsx`, `ui/spriteImages.web.ts`, `ui/RatAvatar.web.tsx`, `ui/ratPicture.web.ts`, and a `*.web.test.tsx` for each
- Read: `apps/web/src/ui/Sprite.tsx`, `apps/web/src/ui/RatAvatar.tsx` (how the Next web draws them: `<img>`, `image-rendering: pixelated`, whole-pixel sizes, placeholder)

**Interfaces:**
- Produces: the phone files' exports with the same props: `Sprite`, `SpriteLayers`, `SpriteLayer`, `SpriteStrip`, `ArtScale`, `sourceOf`, `PIXELATED` (kept as a plain marker on the web); `useSpriteImage`, `useSpriteImages`, `readAhead`, `spritesLoading`, `useSpritesLoading`, `readSprite`, `loadSpritesWith`, `SPRITE_BUDGET_BYTES`, `SpriteImage` (on the web an image is its URL and size: `{ uri: string; w: number; h: number } | null`); `RatLayers`, `RatChoices`, `RatChoice`, `RatPlace`, `RatAvatar`, `choiceSprites`; `composedPicture`, `forgetComposed`, `COMPOSED_KEPT` (on the web the layers stand in one box instead of being composed).
- Every sprite is an `<img>` with `image-rendering: pixelated`, `draggable={false}`, width and height in whole pixels (art size × scale), `alt` as the phone's accessibility label; a sprite that fails or is unknown shows the Next web's placeholder of its size and is logged once.

- [ ] **Step 1: Write the failing tests** (phone-web): a known sprite at scale 2 is an `img` of twice its art size with `image-rendering: pixelated`; an unknown id gives a placeholder of the fallback size and one `console.warn`; `RatAvatar` with a look draws its layers in the Next web's order (`apps/web/src/ui/RatAvatar.tsx`); `SpriteStrip` shows the frame asked for.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit** (`feat(mobile): sprites and the rat drawn as images on the web`).

### Task 5: Glows, shines, discs and charts without Skia

**Files:**
- Create: `apps/mobile/src/ui/Glow.web.tsx`, `ui/Shine.web.tsx`, `ui/DiscItem.web.tsx`, `ui/charts.web.tsx`, `ui/typefaces.web.ts`, `ui/Canvas.web.tsx`, tests for each
- Create: `apps/mobile/src/ui/chartGeometry.ts` (moved from `ui/charts.tsx`: `lineGeometry`, `fitScale`, `barRects`, `WorthBar`, `BarRect`), re-exported by both `charts.tsx` and `charts.web.tsx`

**Interfaces:**
- Produces: same exports as the phone files: `glowOf`, `Glow` (CSS `filter: drop-shadow` / `box-shadow` from the same shadow string); `HOLO_COLORS`, `holoGradient`, `Holo`, `Glint` (CSS linear-gradient, animated with the same keyframe options); `DiscItem`; `LineChart`, `Bars` (SVG `path`/`rect` from `chartGeometry`, `role="img"` with the label); `typefaceOf` (resolves to `null`: the web draws text with CSS fonts); `Canvas` on the web renders its children's box only and must not be reached by any web screen (a test asserts no web twin imports it).

- [ ] **Step 1: Write the failing tests:** `Glow` with the kit's gold shadow sets a matching `drop-shadow`; `Holo` renders a gradient with `HOLO_COLORS` in order; `LineChart` renders an SVG path whose `d` equals `lineGeometry(points, w, h).line`; `Bars` renders one `rect` per `barRects` rect with its colour token's value; the moved geometry functions keep their existing tests (move them to `chartGeometry.test.ts`).
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the tests and the phone's chart tests. Expected: PASS.
- [ ] **Step 5: Commit** (`feat(mobile): glows, shines and charts in CSS and SVG on the web`).

### Task 6: The screens' own Skia drawings

**Files:**
- Modify: `apps/mobile/src/game/screens/News.tsx`, `Hud.tsx`, `LifeMap.tsx` (their Skia `Path`/`Fill`/`Rect`/`DashPathEffect` drawings move into kit components)
- Create: those kit components under `apps/mobile/src/ui/` with `.web.tsx` twins (SVG), and tests
- Modify: `apps/mobile/src/architecture.test.ts`: no file under `src/game/` names `@shopify/react-native-skia`

**Interfaces:**
- Produces: one kit component per drawing, named for what it draws (for example the news page's rule, the HUD's bar, the life map's dashed route), same picture on both platforms from the same geometry function.

- [ ] **Step 1: Write the failing tests:** the architecture rule above; each web twin renders an SVG whose geometry equals the phone component's (shared function); the screens' existing tests stay as they are.
- [ ] **Step 2: Run** them. Expected: FAIL (the screens name Skia).
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the screens' tests, the new ones, and `web:size`. Expected: PASS; `web:size` lists no Skia or CanvasKit except what Task 7 removes (the share card).
- [ ] **Step 5: Commit** (`refactor(mobile): the screens' drawings move into the kit, with web twins`).

### Task 7: The share card, sharing and the clipboard on the web

**Files:**
- Create: `apps/mobile/src/game/screens/ShareCard.web.tsx`, `apps/mobile/src/game/sharing.web.ts`, `apps/mobile/src/ui/copy.web.ts`, tests
- Read: `apps/web/src/game/screens/ShareCard.tsx:140-197`, `apps/web/src/game/screens/Room.tsx:529-555`, `apps/web/src/game/screens/PlayerProfile.tsx:101`

**Interfaces:**
- Produces: `ShareCard` (same props) drawing `DrawOp[]` on a 2D `<canvas>` as the Next web draws them, `drawCard` with the same name returning a `Blob | null` on the web; sharing: `navigator.share({ files, title, text })` when `navigator.canShare({ files })`, and a download link always (object URL, revoked on unmount); room invite `navigator.share({ url })`, else the clipboard; copy via `navigator.clipboard.writeText`. Same exports as `game/sharing.ts` and `ui/copy.ts`.

- [ ] **Step 1: Write the failing tests:** a card with ops draws onto a canvas (2D context stand-in records `drawImage`/`fillText` in order); share uses `navigator.share` when it can share files, otherwise offers only the download; the invite falls back to the clipboard when `navigator.share` is missing; copy writes the friend code.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** them and `web:size`. Expected: PASS; `web:size` PASSES whole for the first time (no Skia, no CanvasKit, no `expo-media-library`); record the totals.
- [ ] **Step 5: Commit** (`feat(mobile): the share card, sharing and copying on the web`).

### Task 8: The web's cloud wiring

**Files:**
- Create: `apps/mobile/src/online/index.web.ts`, `online/page.web.ts`, `online/errors.web.ts`, `online/captcha.web.tsx`, `online/push.web.ts`, tests
- Modify: `apps/mobile/src/online/track.ts` and its test (platform `web` allowed, from `Platform.OS`)
- Read: `apps/web/src/online/index.ts`, `apps/web/src/online/captcha.ts`

**Interfaces:**
- Produces: the phone files' exports on the web. `phoneOnline(device, livesAfter?)`: `connectSupabase(url, key, { region, captcha })` with no `storage` and no `autoRefresh` (supabase-js's own session and refresh), `address()` = `location.href` without the hash, `clean(address)` = `history.replaceState`, Google by redirect (the web's call in `packages/online`); `onThePhone`, `phonesCloud`, `forgetThePhone` keep their names. `phonePage` from `window` (`online`, `visibilitychange`). Errors from `window` `error` and `unhandledrejection`, place = `location.pathname`, browser = `browserOf(navigator.userAgent)`, production only. `phoneTurnstile` loads Turnstile's script as the Next web does, only with `EXPO_PUBLIC_TURNSTILE_SITE_KEY`. `push.web.ts`: the same exports; `pushOn` answers `'unavailable'` (web notices come in plan 5b). `held.ts`, `language.ts` stay shared.

- [ ] **Step 1: Write the failing tests** (phone-web, a fake `connectSupabase`): the options passed have no `storage` and no `autoRefresh`; `address()` drops the hash; `clean` calls `history.replaceState` with the address; a window `error` event in production reaches `reportErrors` with the pathname as place; `pushOn()` is `'unavailable'`; `track` sends platform `web`.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the online tests (phone and phone-web) and `web:size`. Expected: PASS.
- [ ] **Step 5: Commit** (`feat(mobile): the web's cloud wiring, as the Next web wires it`).

### Task 9: Checked in the browser beside the Next web

**Files:**
- Modify: `apps/mobile/scripts/scene-shots.ts`, `scripts/sceneShots.ts` (+ tests): a step `appweb` shoots `http://localhost:8091/scene?name=<scene>` (the app's web, `npx expo start --web --port 8091` in the worktree) with Playwright at the web step's viewport; `compare` compares `web` with `appweb` when asked `--against=appweb`
- Create: `docs/superpowers/reports/2026-10-23-phase-5a-web-parity.md`
- Modify: `CLAUDE.md` (the app's web: twins, `web:size`, the `appweb` shots), the spec's "Phases" (5a done; what 5b starts from)

**Interfaces:**
- Consumes: every earlier task.

- [ ] **Step 1: Write the failing test:** `sceneShots.test.ts`: the app-web URL of a scene is `http://localhost:8091/scene?name=<name>`, and `filesOf(name)` gains `appweb: <name>-appweb.png`.
- [ ] **Step 2: Run** it. Expected: FAIL.
- [ ] **Step 3: Implement** the step, then run `web`, `appweb` and `compare --against=appweb` over every scene. Judge each difference as phase 2 did (fix in the app's web twins, or accept with its reason in the report); two full runs exit 0.
- [ ] **Step 4: A whole life in the browser.** Playwright, offline (no `EXPO_PUBLIC_SUPABASE_*`): on the Next web (the shots' own `next dev` on 3021) begin a life and play to round 3; read the origin's `ratrace` IndexedDB records and the localStorage keys of the inventory with `page.evaluate`, and write them into the app's web origin (8091) before its first load (two ports are two origins: this stands in for the swap, where the origin stays the same); on the app's web, Continue reaches the same round; play to the end; the end screen and the records show the life. Record each step in the report. Then `pnpm -s typecheck && pnpm -s lint && pnpm -s test` and `web:size`. Expected: all green; the size printed in the report.
- [ ] **Step 5: Commit** (`docs(mobile): phase 5a checked in the browser beside the Next web`).
