# Phase 5a: rulings and deferred minors (2026-10-24)

Every decision the controller took during plan 5a (`docs/superpowers/plans/2026-10-23-expo-phase-5a-light-web.md`), with what it costs if wrong, and every minor the reviews deferred. Items routed to plan 5b are named there.

## Rulings

- | T4 → T7 | spriteImages.web SpriteImage {uri,w,h} → ShareCard.web | phone ShareCard uses readSprite → SkImage. Ruling: ShareCard.web loads sprite PNGs itself as HTMLImageElement from sourceOf(id); readSprite on the web is not used by it — cost if wrong: a second image loader on the web |
- | T6 self | "no file under src/game names Skia" | conflicts with phone ShareCard.tsx (Skia by design). Ruling: the rule exempts game/screens/ShareCard.tsx (its web twin is T7) — cost if wrong: one exemption to remove later |
- | T7 vs T8 | T7 step 4 "web:size passes whole for the first time" | react-native-webview (captcha.tsx) leaves only in T8. Ruling: T7 expects every problem gone but react-native-webview; T8 is the first whole pass — cost if wrong: none |
- Task 1: Ruling: the forbidden list's `@formatjs/` means formatjs's polyfills only (`@formatjs/intl-getcanonicallocales`, `intl-locale`, `intl-pluralrules`, `intl-numberformat`, `intl-datetimeformat`, `intl-relativetimeformat`, `intl-listformat`, `intl-displaynames`), not the message-formatting libraries use-intl needs (spec: "no formatjs polyfills") — cost if wrong: a few KB of formatjs left in the web bundle. Carried into Task 1's fix round (or a follow-up commit) whatever the review says.
- Merged origin/dev (c6515d24) into expo as a0cf71f3; suite 336/4307 green; pushed. Ruling: merge, not rebase — expo is pushed and a rebase needs a force-push; CLAUDE.md says rebase regularly — cost if wrong: one merge commit in expo's history.
- Task 3: done (ba04d617), DONE_WITH_CONCERNS: web:size counts the 18 served rules/*.js (~1.0 MB gzip) in the JS budget; eslint ignores public/rules. Ruling: the budget counts the app's own JavaScript only (files under _expo/static/js), not files the site serves for older lives — spec budget is the app's weight — cost if wrong: a heavy served file escapes the check. Goes into Task 3's fix round.
- Ruling: subagent commits carry the trailer their own harness gives (Sonnet 5.5 for Sonnet implementers) — accurate attribution — cost if wrong: trailer edits before merge.
- Task 7: review — spec ❌ (I1 invite without navigator.share copies silently, Next web shows only Copy with a toast). Ruling: web:size passing but for react-native-webview is Task 7's bar (preflight ruling). Fix round 1 sent (canShareLink + Room; defer revokeObjectURL).
- Task 8: Ruling: address() keeps the hash as the Next web's does (plan said drop it; Supabase's sign-in errors come back after the hash) — the plan was imprecise, the Next web is the contract — cost if wrong: none found.
- Task 8: Ruling: no install count on the web from track (the Next web counts installs by the PWA's appinstalled, plan 5b) — cost if wrong: install counts on the web start in 5b.
- Ruling: the one fix wave takes I1–I3 and the three 5a-owned must-fix minors; cookie refresh, web:size in the build and Back-closes-sheets go into plan 5b (they belong to the platform) — cost if wrong: they wait a plan.
- Ruling: the share card's link stays on SITE_URL, as the Next web's (only the room invite follows the page) — parity — cost if wrong: a preview's share card names production.
- Ruling: Google's return through expo-router in a real browser (landing on /?code=) is checked in plan 5b's browser runs on the fake project — the cloud-level test covers the exchange — cost if wrong: a router-level fault found in 5b.
- Final: Ruling: I3's residual (index twins keyed by their directory, re-exports checked) goes into plan 5b Task 1 — load-bearing for 5b/4 online changes, no second fix wave by the process — cost if wrong: one more task-sized fix.

## Deferred minors

- Task 2: minor (deferred): retry after a rejected IndexedDB open (differs from the Next web, untested).
- Task 2: minor (deferred): no type guard that each .web twin keeps the phone file's exports (e.g. `satisfies typeof import('./kvStore')`) — consider one guard for all twins in Task 9 or the final review.
- Task 2: minor (deferred): kvStore.web.test restores mocks at the end of tests, not in afterEach.
- Task 2: minor (deferred): kvSession.clear on the web removes only `sb-` keys (unused by the web wiring).
- Task 2: minor (deferred): plan text says --project phone for architecture.test (it is repo).
- Task 3: minor (deferred): default-loader test proves only failure → unreachable; rules.ts copy loop written twice.
- Task 4: minor (deferred): silhouette drops children; rat clip mask pixelated (Next web's is not); checkerboard values not asserted; failed rat piece left off (Next web draws a checkerboard); scene ready may lead the img paint by a frame → Task 9 shots settle a frame after ready.
- Task 5: minor (deferred): Glint, INDENT/DISC, TONE copied into web twins (shared module would stop drift); Canvas.web guard scans twins only.
- Task 6: minor (deferred): DashedRule tone prop unused but by a test; DASH exported unused.
- Task 7: minor (deferred): usePictureShare().send/save unused on the web (kept for the export).
- Task 8: minor (deferred): no test landing on ?code=; web twins' types differ (Opener|undefined, AppErrorParts, no pageOf) — the twin-type guard (Task 2 minor) would catch drift; push.web ignores platform.
- Task 9: minor (deferred): end-ru arrow 13% larger on the app's web (font fallback) → 5b; readyServer ACAO *; weaker RED evidence for emojiHeight/systemFace/layoutTop; hasPhoneWords unused; ground dot weave a shade apart (gradient vs tile), no record; phone words still shown on the web where the Next web has none → 5b.
