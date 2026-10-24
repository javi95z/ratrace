# Final review: phase 5a, the app runs as a light web (2a89a4e1..4c3299e6)

Reviewer: whole-branch, read-only. Read in passes: commit list and stat; the plan's Global Constraints and Review Focus; the spec's Phase 5
design; the inventory of contracts; the ledger (every `Ruling:` and `minor (deferred)`); then the diff by area (store and rules; cloud
wiring; drawing twins; shared phone files; size check; shots and the whole-life script; docs). The merge `a0cf71f3` (engine 0.43.0 /
content 1.47.0, legal wording) was skimmed only: it is the only commit in the range that touches `apps/web`, `packages/*`, `supabase/` or
`tools/` (`git log --first-parent 2a89a4e1..4c3299e6 -- apps/web packages supabase tools` lists only it; `git diff a0cf71f3 4c3299e6` over
those paths is empty), so "the Next web does not change" holds for 5a's own work.

Checks run by the reviewer: `npx vitest run --project phone-web` (34 files, 163 tests, green); `pnpm -s test` and `pnpm -s typecheck` (378 files, 4500 tests, exit 0; typecheck exit 0; lint not re-run);
a TypeScript-API comparison of every `.web.ts(x)` twin's exports and types against its phone file (35 twins; script in the session
scratchpad, `twins.cjs`), results under I3.

## Strengths

- **The store is the Next web's, proved against the Next web's own code.** `kvStore.web.ts` writes the IndexedDB schema again (`ratrace` v1,
  `currentGame`/`runs` keyPath `runId`/`profile`, key `'only'`) and `kvStore.web.test.ts` cross-reads with `apps/web/src/session/indexeddb.ts`'s
  `LocalStore` both ways on fake-indexeddb. No IndexedDB gives `MemoryStore`, and the context wraps it in `ResilientStore` exactly as the Next web's
  `browserServices` does (Review Focus 1). The basket's JSON shape (`phoneBasket.basketOver`) is byte-identical to `browserBasket`; every
  localStorage/sessionStorage key of the inventory is kept verbatim (`ratrace.basket`, `ratrace:given-up`, `ratrace:refused`,
  `ratrace.lastAccount`, `ratrace:keeping-account`).
- **The account session test is the strongest piece of the branch.** `online/index.web.test.ts` "finds the session the Next web keeps" runs the
  Next web's real `browserOnline` and then the app's `phoneOnline` over real supabase-js against in-memory servers (stubbed `fetch`, a made-up
  project ref), and asserts one guest, one signup, and the single `sb-<ref>-auth-token` key, both ways round (Review Focus 3). The
  architecture test pins `connectSupabase(url, key, { region, captcha })` in `index.web.ts` (no `storage`, no `autoRefresh`).
- **Older rules are the Next web's loader** (`olderRules.web.ts`, `new Function('url','return import(url)')`, any failure `'unreachable'`), and
  `web:size` fails an export that does not serve every `apps/web/public/rules/v*.js` (Review Focus 2 and 5).
- **The phone's side of every shared edit is an identity.** `strut`/`RUN_LINE`/`cssLine`, `platformFace`/`faceWeight`, `layoutTop`,
  `KEPT_LAYER`, `onHardwareBack`, `SafeArea`, `EMOJI_X_HEIGHT`, `backFromGoogle()`, `canShareLink()`, `LinkText offset="auto"` (= the former
  1.5) all return on the phone exactly what the code did before; the drawings moved into the kit (`drawings.ts`, `Rays`, `DashedRule`,
  `RouteLayer`, `lights.ts`, `chartGeometry.ts`) are moves with the same geometry, and `over.ts` is a pure move held word-for-word to the Next web
  by `index.test.ts`. `track.ts` keeps the phone's install count (`platform !== 'web'` only gates the web).
- **Turnstile is the Next web's to the character** (`captcha.web.tsx`, with a test reading both sources).
- **Nothing reaches the live project.** `web:size` blanks `EXPO_PUBLIC_SUPABASE_URL`/`_PUBLISHABLE_KEY`/`TURNSTILE_SITE_KEY`; the shots' Next dev
  is started with blank `NEXT_PUBLIC_SUPABASE_*` (and the worktree has no `apps/web/.env.local`); every browser context aborts any request or
  socket off this machine and blocks service workers (`guardedContext`); `web-life.ts` refuses a dev server whose `process.env` names a project
  and fails the run on any off-machine request from the app's web or any request to a Supabase host. The tests' clients use a fake ref and a
  stubbed `fetch`.
- **The parity work is measured, not waved through**: every fix in the report's table has a measured cause, and the accepted residuals carry
  numbers. The ledger's rulings (the formatjs polyfills only; the budget counting `_expo/static/js` only; `address()` keeping the hash) are each
  right on the merits.

## Issues

### Critical (Must Fix)

None.

### Important (Should Fix)

**I1. The whole life, and every shot, ran on the development server: the export the plan's Goal names never ran in a browser.**
- Where: `apps/mobile/scripts/web-life.ts:1-20` (Metro dev server on 8091); parity report "For phase 5b": "the export itself was checked for weight
  only"; plan Goal: "The app's web export plays the whole game in a browser".
- What: the production bundle has paths the dev server never takes: `__DEV__` false (`track.ts` `isRelease()` sends events and subscribes
  `phoneConnection`), `NODE_ENV=production` (`index.web.ts` starts `watchErrors` on the window), minification, and the export's own asset layout
  (sprite URIs built by `uriOf` from react-native-web's `AssetRegistry` `httpServerLocation`, `public/rules` copied into the export root).
- Why it matters: a sprite path, a rules path or a release-only listener that breaks only in the export would first be seen on 5b's preview, or
  later. The cost of checking now is small.
- Fix: run `web-life.ts` once against the exported folder served statically on 8091 (`expo export --platform web` with no project, then any
  static server); the life needs no `/scene` route. Record it in the parity report. At the latest, make it 5b's first step, before the preview.

**I2. A sprite that fails to load once stays a checkerboard for the whole visit (Task 4's deferred minor, regraded).**
- Where: `apps/mobile/src/ui/spriteImages.web.ts:111-130` (`entryOf` caches `FAILED` in the module-wide `cache` for good); `Sprite.web.tsx`
  renders the checkerboard whenever `failed`.
- What the player gets: on the Next web the failure is a `useState` of the mounted `<img>` (`apps/web/src/ui/Sprite.tsx`), so the next screen,
  or the same screen drawn again, asks the browser again. On the app's web one dropped request on a weak mobile connection (a card's art, a rat
  layer, a frame drawn on every screen) shows the checkerboard on every screen until the page is reloaded. Until 5b's service worker that is
  any player on a flaky network.
- Fix: forget a failed entry after it is reported (or retry on the next `entryOf` after a short delay, or on the window's `online` event), still
  logging once per id. Must be fixed before 5c.

**I3. No guard that a web twin keeps the exports the shared code imports from its phone file (Task 2/8 deferred minor, graded here).**
- Where: no test or type check; `tsc` reads only the phone file for every shared import, and Metro turns a missing named export into
  `undefined` at run time with no build error.
- Measured today (TypeScript API, all 35 twins): no runtime drift. The twins lack `BACK_FROM_GOOGLE` (`browser`), `PAGE_POLICY` (`captcha`),
  `Uncaught`/`Rejections`/`appBuild`/`appBrowser` (`errors`), `pageOf` (`push`), `AUTO_OFFSET` (`LinkText`), and each of these is used only
  inside its own phone file or by tests (`testing/accountCloud.ts` imports `BACK_FROM_GOOGLE` from the phone file). Type differences are
  intended (`openForGoogle: Opener | undefined`, `drawCard → Blob`, `readSprite → SpritePicture`, `PIXELATED`, `COMPOSED_KEPT 0`,
  `LEGAL_SECTION 'legal'`, the phone `KvStore`'s extra `runIds`).
- Why it matters: the phone keeps changing (phase 4 follows 5), and a new export used by a shared screen breaks only the web, only when that
  path runs. Nothing would catch it before players.
- Fix: one architecture rule: for every non-twin file importing a module that has a `.web` twin, every name it imports must be exported by the
  twin (the existing `importsOf` already gives names). A per-twin `satisfies` would be too strict, because the phone files have legitimate extras.
  Fix before 5c.

### Minor (Nice to Have)

**M1. Two room messages tell a web player to "update the app" where the Next web says "reload the page".**
`game/screens/Room.tsx:146-149` (`phone('roomOtherVersion')` for the refusal `other-version`) and `:229` (`phone('roomOtherRules')`) call
`useT('phone')` directly, so `ownWords.web.ts` never maps them. The Next web has counterparts for both: `room.refused.other-version` and
`room.otherRules`. The parity report's "For phase 5b" says these have none, and that is wrong. Add both to `useOwnT` (or route them through it).
Of the phone words left on the web, `shareFailed` is never reached there (`ShareCard.web` uses `share.failed`), `noticesBlocked` is never reached
(push is `unavailable`), and `opensLife` is a neutral hint. Fix before 5c.

**M2. The language cookie is written by script and never refreshed.** `kvStore.web.ts:93-110` writes `NEXT_LOCALE` from the page. The Next web's
`proxy.ts:15-20` explains why it rewrites the cookie from the server on every page: Safari keeps a cookie written by script for seven days at most,
and a player who came back after a week found the game in English. The contract (name, path, max-age, SameSite) is kept, but the lifetime
is not. 5b's language-in-the-URL work must decide this (Vercel routing middleware or the URL itself) before 5c.

**M3. `web:size` guards only when someone runs it.** It is not in `pnpm -s test` or any build. `FORBIDDEN` also omits `expo-notifications` and
`expo-web-browser`, which Task 8 took out of the web bundle and nothing now keeps out. Add them, and make the 5c Vercel build command
run `web:size` (fail the deploy).

**M4. `spriteImages.web.ts:3` deep-imports `react-native-web/dist/modules/AssetRegistry`** (typed by `reactNativeWeb.d.ts`). This is a private path
that a react-native-web upgrade may move. Note it beside the dependency, or lean on `Image.resolveAssetSource` where it exists.

**M5. Deferred minors carried as they are** (no change of grade): Task 1 M2 and M3; Task 2's open retried after a rejection (it differs
from the Next web, but no worse for a player), mocks restored late, `kvSession.clear`, the plan's text; Task 3's default-loader test and duplicate
copy loop; Task 4's silhouette children, the rat-clip, checkerboard values and the missing rat piece (cosmetic, and only on failure, with I2
fixed); Task 5's duplications and the Canvas guard; Task 6's `DashedRule` tone and `DASH`; Task 7's unused `send`/`save`; Task 8's
`push.web` platform; Task 9's end-ru arrow, `readyServer` ACAO `*`, the weak RED evidence, `hasPhoneWords`, and the ground weave.

## Deferred minors to fix before 5c (triage)

| Ledger item | Why before 5c |
|---|---|
| Task 4: a failed sprite stays a checkerboard until reload | I2: every web player on a weak network |
| Task 2/8: twin type guard | I3: silent web-only breakage as the phone changes |
| Task 7: invite links from `SITE_URL`, not the page's origin | 5c's side-by-side check on the preview would invite friends to production; set `EXPO_PUBLIC_SITE_URL` per deployment or use `location.origin` on the web |
| Task 8: no test landing on `?code=` | The Google return is the riskiest account path at the swap, and the one new variable (expo-router's first navigation in front of supabase-js's `detectSessionInUrl`) is untested. One browser run on the fake project (`scripts/fakeCloud.ts`) landing on `/?code=…` is enough |
| Task 9: phone words left on the web | M1: two of them have Next web counterparts and say something false in a browser |

Everything else in the ledger can stay deferred.

## Recommendations

- **Plan gap for 5b: Back closes sheets.** The inventory lists it as a web behaviour (`ui/back.ts`, `history.pushState` + `popstate`), but the
  spec's 5b list does not name it. On the app's web `hardwareBack.web.ts` listens to nothing and the sheet's `Modal onRequestClose` hears no
  browser Back, so Android Chrome's Back gesture with a sheet open leaves the screen instead of closing the sheet. Put it in 5b explicitly.
- Before the preview, run I1's export run once with `EXPO_PUBLIC_SUPABASE_*` pointed at the fake project, so the release-only paths
  (`watchErrors`, `track`) are seen sending to something.
- Counting: from the swap, web events go to the game's `track` function (platform `web`, as Task 8 planned); 5b adds Vercel Analytics. Decide
  which counts the web's eight events, so that dashboards do not count them twice or split them across two systems.

## Declined to judge

- Language in the URL, `/` → `/{l}`, room and rankings deep links, SEO, service worker, web push (VAPID), install offer, `ratrace.installOffer`,
  analytics, desk layout, keyboard: 5b by the spec (only their 5c-relevance is noted above).
- Pixel residuals the parity report accepts with measurements: I checked the method and its records, not each picture.
- Phone-side scene shots and `expo export --platform ios`: taken from the Task 9 report and ledger, not re-run (no simulator in a read-only review).
- The merge `a0cf71f3`'s own changes (engine 0.43.0 / content 1.47.0, ranked refusal words, legal notice): not 5a's work.
- `freshReads: true` over the web's IndexedDB: set aside after checking. Both `idb`'s reads and `MemoryStore`'s are fresh structured clones, so it
  is safe, though `resilient.ts`'s comment ("the web's IndexedDB may hand back what it holds") now reads oddly beside it.

## Assessment

**Ready to merge?** With fixes. Ready for 5b; not ready to become the live web until I1–I3 and the triaged minors are done.

**Reasoning:** The contracts an existing player depends on (saves, session key and PKCE wiring, older rules, browser keys, Turnstile) are kept
and tested against the Next web's own code. The phone side of every shared edit is an identity, and nothing in tests, shots or scripts can reach the
live project. What is left is shared by the export never having run in a browser, a sprite-failure cache that is worse than the Next web's, and
no guard on twin exports. None of it touches a player today, and all of it is cheap to close before 5c.
