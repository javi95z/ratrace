# Phase 5 spike: the app exported for the web (2026-10-23)

Throwaway branch `expo-web-spike` (local, commit 2566d15f). `npx expo export --platform web` of the app as it stands at the end of phase 3, served
as static files on 127.0.0.1, offline (no `EXPO_PUBLIC_SUPABASE_*`), in the desktop app's browser pane.

## What it took

- `metro.config.js`: `wasm` as an asset, for `expo-sqlite`'s web worker (the phone's store; on the web it would be the browser's IndexedDB instead).
- `index.web.ts`: `LoadSkiaWeb()` before `expo-router/entry`, and `canvaskit.wasm` (the full build, for the text and paths the kit draws) in `public/`.
  Without it the first Skia draw throws (`Cannot read properties of undefined (reading 'PathBuilder')`).

## What it showed

- It works: the front page and "Choose a life" draw as on the phone, and the router moves between them.
- It is heavy, and blank until all of it has loaded (no HTML first):

| | The web today (Next, production) | The app on the web |
|---|---|---|
| JavaScript, transferred (gzip) | ≈ 0.7 MB (18 files, the page's HTML server-rendered) | ≈ 2.9 MB (one 8 MB common chunk raw) |
| CanvasKit (WebAssembly) | none | ≈ 3.1 MB gzip (7.9 MB raw) |
| First thing drawn | the HTML, at once | after the JavaScript and CanvasKit: 7.2 s here, on this machine, with no network (the pane was hidden, so the number is rough) |

- Skia is named by 14 files: the kit's `Canvas`, `Sprite`, `spriteImages`, `typefaces`, `Glow`, `Shine`, `DiscItem`, `charts`, `RatAvatar`, `ratPicture`, and the screens
  `News`, `Hud`, `LifeMap`, `ShareCard`.

## What it means for phase 5

The spec's phase 5 ("the web on Expo") is reachable, but not as the app is: a first visit about eight times heavier than today's, and blank until
it loads, is a worse web for the players it has. Two levers would close most of the gap:

1. Web variants (`.web.tsx`) of those 14 pieces drawn with the browser's own canvas, images and CSS (the web's kit already does it), so CanvasKit
   is never loaded on the web.
2. Expo Router's static output (HTML per page) and code split by route, so a page draws before its JavaScript has loaded and the common chunk shrinks.

The other way is to keep the Next web as the web, sharing the packages as today, and drop the swap from phase 5.

## Second pass: what the web can leave out (the user chose to make the app the web, 2026-10-23)

Measured by stubbing on the web only (Metro `resolveRequest`, spike only) what the web does not need from the phone's bundle:

| Left out on the web | Source in the bundle | Instead, on the web |
|---|---|---|
| The older rules (`src/rules/v*.js`) | ≈ 3.6 MB | fetched from the site when a life needs them (the web's `session/rulesFromSite`) |
| formatjs polyfills (`src/intl.ts`) | ≈ 3.1 MB | the browser's own `Intl` |
| Skia's JavaScript (and CanvasKit, 3.1 MB gzip) | ≈ 0.9 MB | the 14 drawing pieces as `.web.tsx` on the browser's canvas, images and CSS |
| expo-sqlite | ≈ 0.4 MB | IndexedDB, the web's own store (so today's saves are read where they are) |

JavaScript transferred falls from ≈ 2.9 MB to ≈ 1.28 MB gzip (one 840 KB common chunk), with no CanvasKit: from ≈ 6 MB to ≈ 1.3 MB in all,
against ≈ 0.7 MB for the web today. What is left that the first page could wait for: the Supabase client (≈ 0.65 MB source), expo-notifications,
the two languages not shown (`packages/i18n`), and every screen's code (one common chunk today).

Static output (`web.output: "static"`, HTML for each page) does not build yet: the provider reaches the browser at render
(`window is not defined` from expo-network's listener in `phoneTrack`) and stores read through `useSyncExternalStore` without a server
snapshot. Both are the kind of thing the web's Next build already handles: code that waits for the browser, and a first draw from the server's
answer.
