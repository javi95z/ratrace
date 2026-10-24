# Phase 5b final review (203f22a2..59e80b03)

Reviewer: final whole-branch review, read-only, done in passes by area (no subagents). The merge of `origin/dev` (80a4245c: content 1.48, the
front door, the round header) was skimmed for its dev-side files only. Task P's port of those changes was judged as a port.

## What I ran (all in a scratch folder; the worktree is untouched: `git status` shows only the two untracked files that were there before)

| Check | Result |
|---|---|
| `tsx scripts/webBuild.ts <scratch>/dist` (the build Vercel runs, offline env) | Exit 0, in 10 s. 1,315 files. 53 app scripts: 1.19 MiB gzip. First page 0.74 MiB with 25 scripts (gate 0.78). 30 of 30 pages. 1,309 files precached. 16 templates dropped. These match the phase report exactly. |
| `pnpm -s test` | 4,759 passed (415 files). |
| `pnpm -s typecheck`, `pnpm -s lint` | Clean. |
| Built site served by `serveExport` (the local copy of Vercel's routing), driven in Chrome by my own probes | Results below. `/` → `/en`. 30 pages each have the right `lang` and their own language's words. The manifest is identical to the Next web's. `favicon.ico`, `og.png` and the icons are byte-identical to the Next web's. The head of `/es/room` is the Next web's metadata. |
| Probe: `/en/challenge` with the clock a week later, and in `America/Los_Angeles` today | React **#418** both times (see I1). |
| Probe: a language changed from a sheet on `/en` and on `/en/play` (desk) | The page stays `<html lang="en">`. The old page stays mounted, so the ids and marks are doubled. Focus is lost after Ctrl+Enter. The sheet stays open over the new page (see I2). |

## Strengths

- **The swap contracts are held by tests against the Next web's own code.**
  - `src/middleware.test.ts` runs `apps/web/src/proxy.ts` (next-intl) beside `middleware.ts` on 654 requests: same status, location and cookie.
  - `judgeHeads` holds all 30 pages to the Next web's `metadata.ts`.
  - The worker's notice handlers are the Next web's, word for word, and are tested as such.
  - `ratrace.installOffer`, `NEXT_LOCALE` and `push_subscriptions` are used under the Next web's names.
- **The build gates are real.**
  - `webBuild.ts` fails on: the size budgets, a missing page, the wrong head, a front door in the wrong language, early-loaded typefaces, forbidden modules, missing site files, stray templates and source maps.
  - `app.config.ts` refuses a Vercel `preview`/`production` build with no project, a local project, or a fake key. I reproduced the build and got the same numbers.
- **Careful choices on hosting.**
  - Rewrites are used instead of `cleanUrls`, which keeps `/offline.html` working for the worker.
  - The `+html.tsx` `OWN_ADDRESS` fix handles the worker's offline answer at `/`.
  - `useCanSignIn` has a server snapshot.
  - `localeCookie` matches Next's `Set-Cookie`.
- **The phone is guarded.** Every web behaviour lives in a `.web` twin. The phone twins are no-ops (`keyboard.tsx`, `sheetDialog.tsx`, `sheetHistory.ts`, `install.tsx`, `visits.tsx`, `register.ts`). Error places drop the language segment, so the server's grouping is unchanged (ruling).
- **Sheets work as dialogs**, at least as well as the Next web's: named by their title, the first focus on the panel, Tab kept inside, the page behind inert, a focus lost to a removed row given back, Back closing the sheet on top.

## Issues

### Critical (Must Fix)

None.

### Important (Should Fix)

**I1. The weekly challenge page fails to hydrate in western time zones now, and for everyone once the build's week is over.**

- **Where:** `apps/mobile/src/game/screens/Challenge.tsx:33` (`useState(() => challengeOf(weekOf(now()), lives))`), `:80` (days left from `now()`) and
  `:216` (`fmt.day(lastDay(...))` in the browser's time zone, `context.tsx:509`).
- **What happens:**
  - The static `/{l}/challenge` HTML holds the week, the end date and the days left as they were on the build's machine, in its time zone.
  - When the browser takes the page over with another week or another date, React throws #418. The production error watch reports it on every
    visit, and the page is drawn again on the client, with the stale week visible first.
- **Reproduced on the built site:**
  - In `America/Los_Angeles` today: #418 for `/en` and for `/ru`.
  - With the clock set to 2026-11-05: #418. The HTML said "Delivery rider, Ends on 25 Oct"; the client said "Newcomer abroad".
  - Madrid and Kiritimati today: clean.
  - `web-signin.ts` passes only because it runs in the build's week and time zone.
- **Why it matters:**
  - Vercel builds only on a push, so a deployment older than its week serves a stale challenge page to every player.
  - The weekly web notice (`notice.ts` `PAGE.weekly = 'challenge'`) lands on exactly this page at the start of each week.
  - Players in the Americas hit the error on every visit.
- **Fix:**
  - Draw the week client-side only, as Home's challenge card already is: a server snapshot of null via `useSyncExternalStore`, or set it in an effect, with the page's loading line in the HTML.
  - Add a hydration check under a later clock and a western time zone. `web-signin.ts` can take `timezoneId` and `clock.install`.
  - Sweep the other server-drawn pages for `now()` and `fmt.day/time` at render.

**I2. Changing the language on the web opens the new page over the old one, and the page keeps its old `lang`.**

- **Where:** `useLanguage.web.ts:44` (`router.push`), `app/+html.tsx:83` (`lang` is set only in the static document; nothing updates it later).
- **Seen in Chrome:**
  - *From Home's settings sheet:* the address goes `/en` → `/es`, the page's words turn Spanish, but `document.documentElement.lang` stays `en`.
    The settings sheet stays open over the new page; it belongs to the `/en` screen still mounted underneath.
  - *Mid-life at desk width (`/en/play` → `/es/play`):* both Play screens stay mounted. `round-stage`, `round-actions`, `round-news` and
    `player-profile` exist twice, and so do the `data-primary-action` buttons. The hidden English copy comes first in the page.
    - `focusPart`, `focusMarked`, `pressMarked`, `stepMarked` and the skip links all search the whole page, so they find the hidden copy first.
    - After Ctrl+Enter the round advanced, because both copies share one store, but the focus ended on `BODY`.
    - Each further switch mounts one more copy. The deferred T10 minor (picking the same language twice quickly pushes twice) adds to this.
- **Why it matters:**
  - A screen reader reads the Spanish or Russian page in English.
  - Keyboard and screen-reader players lose their place after a language change.
  - The Next web's language link re-renders its `[locale]` root layout, so its `lang` follows and there is one page.
  - This falls under focus area 5 (accessibility at least the Next web's).
- **Fix:**
  - Set `document.documentElement.lang` from the page's locale, in an effect in the web twin. The same applies to `follow`, which is otherwise fine since it replaces.
  - Make the switch not leave the old screen mounted. Either replace instead of push, which loses Back to the old language (the Next web keeps it), or limit the keyboard lookups to the screen in front.
  - Close the sheets before the move: `closeAllSheets` and `sheetsGone`, as a notice tap does.

**I3. The web has no error boundary. The Next web's `[locale]/error.tsx` shows a fault page with "Try again / New life / Home"; the app's web shows a blank page.**

- **Where:** no `ErrorBoundary` anywhere under `apps/mobile/src/app`.
- **What happens:**
  - Any uncaught render error ends hydration or the page with React taking the tree out of `#root`, leaving a blank page.
  - On a first visit this includes a language chunk that fails to load. `useMessages` calls `use()` on a rejected load under the root `Suspense` (`_layout.tsx:43`); nothing catches it, and the HTML the build drew is lost.
- **Note:** this predates 5b (5a) and is not in the inventory. It is a change a player can see at the swap.
- **Fix:** an expo-router `ErrorBoundary` exported from `app/_layout.tsx` (or the `[locale]` routes) that draws the existing `Fault`/`WaysOut`
  (`play.faultTitle`/`faultBody`, retry), which is the Next web's error page.

**I4. The Vercel build is held to the live project, but not to the rest of the live web's settings.**

- **Where:** `apps/mobile/app.config.ts:23-46`.
- **Problem 1, settings not checked:** a `production` build with no `EXPO_PUBLIC_VAPID_PUBLIC_KEY` builds clean, and:
  - `canNotify()` is false, so the notices switch disappears for every player who turned notices on in the Next web.
  - Their subscriptions still receive notices, but they can no longer turn them off in the game.
  - With no `EXPO_PUBLIC_LEGAL_NAME`/`_EMAIL`, the legal page loses its operator.
- **Problem 2, how the hold is triggered:** it keys only on `VERCEL_ENV`. A project with system variables not exposed builds unchecked.
- **Why it matters:** the 5c checklist names all of these, but one forgotten variable at the swap is a silent loss for players.
- **Fix:**
  - For `VERCEL_ENV=production`, also require the VAPID key and the legal name and email.
  - Hold when `VERCEL=1` is set, even if `VERCEL_ENV` is missing, or fail when `VERCEL=1` comes without `VERCEL_ENV`.

### Minor (Nice to Have)

**M1. Timing is not a gate.**

- The weight has two gates:
  - the static one in the build, which fails it;
  - the browser one (`judgeFirstVisit` in `web-life --export`), which runs only on this machine.
- The throttled first-text and `load` numbers (304 ms against the Next web's 504 ms; 1,327 ms against 1,253 ms) come from Task 10's probe. That probe is not committed, and it ran before Tasks 3–9 added the head, analytics, the worker, install and the keyboard.
- **Fix:** commit the probe, for example as a `web-life` option, so 5c can measure the preview beside the live web the same way.

**M2. `vercel.json` has no immutable header for `/assets/(.*)`.**

- The typefaces and sounds there have their hash in their names.
- Without the worker, every visit revalidates the ~1.27 MB of preloaded fonts. The Next web's `_next/static/media` is immutable.

**M3. Precache weight (deferred T4).**

- The export holds 39 TrueType weights (4.6 MB), of which the game uses about 10.
- The site precaches 28 MB, and refetches all of it on every deployment (`cache: 'reload'`). The Next web's public folder is about 14 MB.
- **Fix:** import only the weights used, e.g. `@expo-google-fonts/<face>/400Regular` paths.

**M4. Phone (rare).** After the player changes language while the app runs, an app link (`+native-intent` uses `linkLocale()`) lands `/es/<page>`
over an `/en` stack.

- `useGo().home()` there is `dismissTo('/es')`. That route is not in the stack, and expo-router then replaces the screen with it.
- The result is a second front door over the first, so Android's Back from it shows the other front door.
- **Fix:** have `home()` dismiss to the stack's root, or open app links in the stack's own language.

**M5. The site's `404.html` is the router's page of nothing, with an empty body in its HTML.**

- It is drawn in the browser in English, with Expo's own words.
- The Next web's 404 is also its default English page, so this is cosmetic. Worth a look on the preview.

**M6. A Vercel-only hydration risk.** The HTML is drawn with Node's ICU on Vercel's machine, which may format dates and numbers unlike Chrome. Re-run the
page sweep on the preview (in the 5c list).

## Deferred minors from the ledger: triage for 5c

| Minor | Must fix before 5c? |
|---|---|
| T4: one visit under the old Next worker (new HTML cached without its `/_expo` chunks; an offline reload before the new worker activates draws a blank page) | **Decide before 5c.** It is the only swap-time item a player can hit. The new code cannot fix it, because the old worker owns the cache. **Recommended:** a small `dev` release of the Next web some days before the swap, whose `pwa.ts` also serves `/_expo/static/` and `/assets/` cache-first, so the old worker keeps the new chunks it fetches. Otherwise accept it in writing and check it right after the swap. |
| T9: CLAUDE.md still says `vercel build` works locally with a hand-written `project.json` (CLAUDE.md:64); it now needs the live keys or a skeleton | **Yes.** Cheap, and 5c's runbook relies on it. |
| T4: about 4 MB of unused TrueType weights precached | Recommended (M3). Not blocking. |
| T10: picking the same language twice before its words arrive pushes twice | Fix with I2. |
| T5: dismissed prompt reads `'on'` with no keys; temporary push error hides the switch for the visit; `serviceWorker.ready` never resolving; unsubscribe failing after the server forgot | No. What a player sees matches the Next web or is benign: the switch stays off, and a retry recovers. |
| T6: `install.web` imports `kvStore.web` directly; an early `appinstalled` not counted; module listener never removed | No. |
| T7: lockfile carries a `next` peer variant; a `track` before `<Analytics>` is injected is dropped | No. |
| T1: the architecture test's comment stripping; render-count tests on router stand-ins | No. The browser runs cover them. |
| T2: CLAUDE.md's 1.35 MB line against 1350 × 1024; the first-visit measure holds every `requestIdleCallback` | No (docs and tooling). |
| T8: stale comment at `sheetDialog.web.tsx:47` | No. Trivial. |
| Task P: record comments, Sticky test names, End test matched by text | No. |

## Only a real Vercel preview can show (5c list; additions to the report's are marked *new*)

1. The 53 files under `/assets/__node_modules/.pnpm/…` are served with a 200. **The preloaded typefaces are among them.**
2. The Edge middleware is bundled with `@vercel/functions`.
   - *New:* the `Set-Cookie` given through `next({ headers })` reaches the browser on a page.
   - `/` answers 307 with the cookie.
3. *New:* the `Cache-Control` of a page response that carries the cookie. It must not be `private`/`no-store`, or the worker will not keep visited pages.
4. "Include source files outside of the Root Directory" is on. The build reads `apps/web/public/rules` and the workspace packages.
5. *New:* system environment variables are exposed. `VERCEL_ENV` drives the live-project hold, and the commit name comes from them.
6. Headers and encoding:
   - `/sw.js` headers, and `/_expo/static/*` immutable.
   - Content types of `.webmanifest`, `.ttf` and `.wav`.
   - Brotli or gzip on TrueType. The 0.74 MiB first visit assumed compressed fonts.
7. The trailing-slash 308, and a 404 status for `/en/nowhere` and `/de/play`.
8. Web Analytics on: `/_vercel/insights/script.js` loads, and visits are grouped by `/[locale]/…` routes.
9. *New:* the hydration sweep on the preview, run as `web-signin` runs it:
   - all 30 pages;
   - at least `Europe/Madrid` and `America/Los_Angeles`;
   - one run with a later clock (after I1's fix);
   - plus `/en/rankings#friends` and `/es/rankings?tab=challenge` with the live project.
10. *New:* the throttled first-visit timing on the preview, beside the live Next web (after M1).
11. Google sign-in round trip with the preview's origin in Supabase's redirect list. Turnstile only if its key is set.
12. *New:* a web-push subscribe, notice and unsubscribe on the preview. Its row goes to the live `push_subscriptions`, so remove it after.
13. The cold build's time and memory, and which pnpm Vercel picks. The repo has no `packageManager` field; pin one.
14. **At the swap itself (the live origin only):**
    - An installed Next web app takes the new `/sw.js` as an update: the old `ratrace-*` cache is deleted, `rat-race-language` is kept, and offline works after activation.
    - The T4 transition window behaves as decided.

## Recommendations

- I1 and I2 share a cause: the static HTML and the client move differ from the Next web where time and the language are involved. One browser
  check would have caught both: a page sweep that changes the clock, the time zone, and the language from a sheet.
- Make the keyboard helpers (`keyboard.web.tsx`) search only the screen in front, not the whole document, before more screens can be stacked.
- Before apps/web is retired from `dev` ("after a quiet week"), note in the spec that the web build depends on:
  - `apps/web/public/rules`, through `scripts/rules.ts` and `webSize.ts:404`;
  - `apps/web/src/proxy.ts`, through `middleware.test.ts`;
  - `apps/web/src/i18n/metadata.ts`, through `pageMeta.test.ts`.

## Declined to judge

- **Task P's front door and sticky figures on the phone.** A change in what phone players see, made on purpose (the user's request, ported from `dev`).
- **The web's events also sent to the game's own `track` function (`platform: 'web'`).** A 5a decision. Additive, and no player sees it.
- **Back from Home skipping a life the player left** (ruling, Task 8). This differs from the Next web on purpose.
- **`/rules/` served cache-first** (ruling, Task 4).
- **The 28 MB precache being refetched on each deployment.** The Next web does the same by design. Only the extra weight is raised (M3).
- **Content 1.48 and the `dev` merge itself.** Not 5b's work.
- **Turnstile.** Unset in production today.
- **The phone's real `theratrace://` links in a dev-client or store build.** That is phase 4's device run, not 5b's.
- **Pixel parity of the scenes.** The shots and their recorded residuals were reviewed task by task. I did not re-shoot them.

## Assessment

**Ready to merge?** With fixes (verdict: Needs fixes before 5c).

**Reasoning:** The platform is complete. The local build reproduces the report's numbers, and the swap contracts are tested against the Next web's own code.
Four player-visible gaps should be closed before a preview is judged:
- the challenge page's hydration across time zones and weeks (I1);
- the in-app language switch's stacked page and stale `lang` (I2);
- the missing error page (I3);
- the build not refusing a production site without its notices key and legal name (I4).

None loses a player's saves, account or links.
