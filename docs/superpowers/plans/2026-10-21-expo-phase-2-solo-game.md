# Expo app, phase 2: the solo game — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A whole life played by hand in the app, offline and with no account: home, new life, play (news, cards with swipe, outcome, finance with its eight tabs, resolve), end, records, collection, the in-game profile and settings. Every screen matches the web's at the same game state. The first release build installs on the iOS simulator.

**Architecture:** Each web screen in `apps/web/src/game/screens/X.tsx` gets a twin in `apps/mobile/src/game/screens/X.tsx`. The twin has the same name, the same exports and the same props, and it reads the game only through `apps/mobile/src/game/context.tsx`. The online hooks there are offline stand-ins that answer like the web's GameProvider with no account. Screens are built from the phase 1 kit (`apps/mobile/src/ui/*`).

Phase 2 adds what that kit lacks:
- the remaining stepped keyframes and `Sparks`;
- a slider;
- Skia charts;
- a sticky header;
- the card swipe, built with gesture-handler.

Parity is proven the way phase 1 proved it, on named game states called *scenes*. Each scene is built the same way for both clients by `packages/core/src/testing/scenes.ts`. The web shows it on a page that exists only on this branch (`/[locale]/kit/scene`); the app shows it on a dev-only route (`/scene`). The shots are taken at 402 × 874 @3× and compared by `kitCompare`.

**Tech Stack:** Expo SDK 58, React Native 0.88, React 19.3, Hermes, expo-router, @shopify/react-native-skia 2.14, react-native-reanimated 4 + worklets, react-native-gesture-handler 3, expo-sqlite kv-store, expo-audio, use-intl + formatjs, expo-file-system + expo-sharing (share card). Tests: the repo's vitest with `react-native` → `react-native-web` (phase 1 harness).

**Spec:** `docs/superpowers/specs/2026-10-20-expo-app-design.md` (phase 2: "Solo game"; the calls "Rules of other versions", "Solo game first, offline", "How parity is proven", "A moving web").

## Global Constraints

- **Where the work lives:**
  - Branch `expo`, worktree `/Users/javierms/Projects/ratrace/.worktrees/expo`. Never commit to `dev`, never touch the root checkout.
  - Rebase on `origin/dev` at the start of each task. When web screens or kit files changed since the last rebase, port those changes before new screens (spec: "A moving web").
- **The web is not changed.** The only web files added live under `apps/web/src/app/[locale]/kit/` on this branch: the scene page and its helpers. `tools/online/src/errors.test.ts` already skips that folder.
- **One screen per file:** each mobile screen file has the web twin's name, exports and props. A web piece that only matters online (account, ranked, challenge, rooms, friends, PWA install, push, analytics) is not drawn. It is reached through the stand-in hooks, which answer "no account": `useRanking()` → `'no'`, `useCommunity()` → `null`, `useInRoom()` → `false`, `useRoom(select)` → `select(NO_ROOM)`, `useAccountSaves()` → `{ status: 'off', offer: null, takeOffer, declineOffer }`, `useTrack()` → a no-op. The screen is then the one the web shows a guest with no connection.
- **The kit's rules from phase 1 still hold:**
  - No `borderRadius`, `shadow*` or `elevation`. Frames are anchored 2 pt strips.
  - Colours come only from `theme.ts`.
  - Touch targets are at least 44 pt.
  - The column is at most 448 wide with the 12 gutter inside the scroll.
  - Every animation steps as the web's `steps(n)` does. Only `useCountUp` eases.
- **Screens are behind the wall** (`apps/mobile/src/architecture.test.ts`): no engine moves (`applyCard`, `applyCards`, `applyRound`, `createGame`), no `KvStore`, no `expo-sqlite`, no session internals.
  - A rule, a price or a score is never computed in a screen. It comes from `@ratrace/engine` quotes and previews, or from `@ratrace/core`, as on the web.
- **Desk layout and keyboard:** the web's desk layout (`useIsDesk`) and keyboard play (`ui/keyboard.tsx`, `KeyboardHint`, `[`/`]`, digit keys, Ctrl+Enter) are not ported. Phone and portrait only.
- **Words:** every string comes from `@ratrace/i18n` through `useT`/`useWords`, with the web's keys. No new i18n key.
- **Tests:** each screen task ports the solo behaviours of the web's test for that screen (named in the task) as a mobile test. They render with `apps/mobile/src/testing/render.tsx` (Task 3).
- **Before every commit:** the whole repo stays green: `pnpm -s test && pnpm -s typecheck && pnpm -s lint`.
- **Commits:**
  - Stage by path, never `git add -A`.
  - Every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Performance** (the user's requirement: the game must feel as quick as the web on a phone):
  - Budgets, measured on a release build in the iOS simulator, each the median of five: cold start to Home ≤ 2 s; Home → Play ≤ 300 ms; a stage change (news → cards → outcome → finance → resolve) ≤ 200 ms; opening Finance and switching a tab ≤ 150 ms; a Sheet open ≤ 150 ms. The card swipe and every stepped animation run on the UI thread (Reanimated worklets), never driven by React state per frame.
  - A list that can pass 30 rows (records, collection, shop shelf, market, ledger) renders with `FlatList` or a measured equivalent, never a mapped `ScrollView` of every row.
  - A screen subscribes to the narrowest store slice it draws (`useGame(select)` with a stable selector, `useShallow` for objects), as the web does; no screen re-renders on every store change.
  - Each screen task adds one render-count test for its main screen: one store change the screen does not draw causes no re-render of it.
- **Off limits:** never run `online:deploy`, `online:live-check`, `online:test-db`, `supabase config push`, or anything that writes to the live Supabase project. Phase 2 is offline.

## Review Focus

- **A life begun under older rules** (a save whose `engine`/`content` is an older shipped bundle):
  - It opens and finishes under those rules on the phone.
  - A life under rules newer than the app waits, with the web's "made by a newer version" notice, and is never deleted.
  - Pinned in Task 2.
- **The app killed mid-round:** reopened, the life is at the same round and stage, and orders already put in the basket are still there. Pinned in Task 3 (phone basket) and Task 9 (resume).
- **A double tap or a swipe while the store is busy** makes one move, never two. A swipe on a card with more than two choices, or with reduced motion on, does nothing: the choices are pressed instead, as on the web. Pinned in Task 11.
- **Android Back:**
  - With a Sheet open, it closes the Sheet.
  - On Play with no Sheet, it goes home and the life stays saved.
  - On Home, it leaves the app.
  - Pinned in Task 9.
- **A Russian player on a 360 pt wide phone:** the HUD figures, the Finance tabs and the card choices do not overflow or clip. The shrink rules are the web's (Stat icon hidden under 340; tabs scroll sideways). Pinned in Tasks 9, 12 and 11.

---

### Task 1: What phase 1 left open

**Files:**
- Modify: `apps/mobile/src/ui/spriteImages.ts`, `apps/mobile/src/ui/spriteImages.test.tsx`, `apps/mobile/src/ui/Page.tsx`, `apps/mobile/src/ui/Page.test.tsx`, `apps/mobile/src/architecture.test.ts`

**Interfaces:**
- Produces:
  - `SPRITE_BUDGET_BYTES = 24 * 1024 * 1024`. The sprite cache keeps decoded images up to that many bytes (width × height × 4 each) and forgets the least recently drawn one with no listener first.
  - `Screen({ children, contentStyle, fixed, bar })`, where `bar` is a `BottomBar` drawn under the scroll.
  - `BottomBar` keeps adding the bottom inset. When the screen has a bar, `Screen` no longer adds it again.
  - The architecture test has the web's two further walls:
    - Screens never import `@/game/store` internals beyond `useGame`, or `@/game/present`'s store-writing helpers. Mirror the web test's list exactly.
    - No file outside `src/kvStore.ts` and `src/game/context.tsx` names `expo-sqlite`, `AsyncStorage`, `localStorage` or `indexedDB`.

- [ ] **Step 1: Write the failing tests.**
  - Loading sprites past the budget forgets the oldest unwatched one. A watched sprite is never forgotten. Asking again for a forgotten sprite reads it once more.
  - A `Screen` with `bar` pads its scroll by 16 only, not 16 + inset.
  - The architecture test catches a screen that imports `expo-sqlite`, and one that imports the store's internals, using the fixture strings the test already uses for its other rules.
- [ ] **Step 2:** Run `pnpm -s vitest run apps/mobile/src` — FAIL on the new tests.
- [ ] **Step 3:** Implement.
  - The cache counts bytes from `image.width() * image.height() * 4`.
  - An entry is forgotten only when it has no listener. The `SkImage` is `dispose()`d when it is forgotten.
- [ ] **Step 4:** Run the tests — PASS. Then run the whole repo: `pnpm -s test && pnpm -s typecheck && pnpm -s lint`.
- [ ] **Step 5: Commit** `fix(mobile): a sprite budget, one bottom inset, and the web's whole wall`.

### Task 2: The rules of older versions, carried by the app

**Files:**
- Create:
  - `apps/mobile/scripts/rules.ts` (copies `apps/web/public/rules/v*.js` into `apps/mobile/src/rules/` and writes `apps/mobile/src/rules/index.ts`)
  - `apps/mobile/scripts/rules.test.ts`
  - `apps/mobile/src/game/olderRules.ts`, `apps/mobile/src/game/olderRules.test.ts`
- Modify:
  - `apps/mobile/package.json` (a `rules` script, run by `postinstall`, `eas-build-post-install` and `start` beside `sprites`)
  - `apps/mobile/src/game/context.tsx` (`phoneDeps().loadRules`)
  - `.gitignore` (the copied `apps/mobile/src/rules/*.js`, as the sprites are)

**Interfaces:**
- Consumes: `LoadRules` and `OlderRules` from `@ratrace/core/session/legacy`.
- Produces:
  - `apps/mobile/src/rules/index.ts`, generated: `export const BUNDLED: Record<string, () => unknown>`, keyed `` `${engine}-${content}` ``. Each value is a lazy `() => require('./v<e>-<c>.js')`, so Metro packs every bundle but evaluates one only when a life needs it.
  - `loadBundledRules: LoadRules` in `olderRules.ts`. It returns the module for a bundled version, and `'unreachable'` for any other, so the life waits for an app update. It never returns `'gone'`.

- [ ] **Step 1: Write the failing tests.**
  - The script lists exactly the `v*.js` of `apps/web/public/rules` in the index.
  - `loadBundledRules({engine:'0.37.0',content:'1.38.0'})` resolves to a module that has `stepLife`, `viewOf` and `ENGINE_VERSION === '0.37.0'`.
  - An unknown version resolves to `'unreachable'`.
  - A life saved under 0.37.0/1.38.0 (a `SavedGame` fixture built from that bundle's `stepLife`) opens through `LocalSessions` with `phoneDeps().loadRules`, and plays one round.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** Run — PASS.
- [ ] **Step 5:** In the simulator (Expo Go), open a life saved under an older bundle through the dev route (`/dev`, a button that writes that fixture to the KV store and opens `/play`). It plays a round on Hermes.
- [ ] **Step 6: Commit** `feat(mobile): lives begun under older rules finish under them, from rules the app carries`.

### Task 3: The game context, complete for a phone with no account

**Files:**
- Create:
  - `apps/mobile/src/game/offline.ts` (the online stand-ins)
  - `apps/mobile/src/game/cues.ts` (store → sound)
  - `apps/mobile/src/game/phoneBasket.ts`
  - `apps/mobile/src/testing/render.tsx`
  - tests beside each
- Modify: `apps/mobile/src/game/context.tsx`, `apps/mobile/src/game/context.test.tsx`

**Interfaces:**
- Produces, all exported from `apps/mobile/src/game/context.tsx` so screens import one module, as on the web:
  - The online stand-ins: `useRanking`, `useCommunity`, `useInRoom`, `useRoom`, `useAccountSaves`, `useTrack`, plus `NO_ROOM` (the `RoomStoreState` of no room). They answer as named in Global Constraints.
  - `useSound()`.
  - `useStill()`, the same as `useReducedMotion()`.
- `cuesFor(state, before)` and `badgeCue` in `cues.ts`. Each is a copy of `apps/web/src/game/sound.ts`'s, held to it by a test that runs both on the same store transitions (the store test fixtures) and expects equal cues. `GameProvider` subscribes the store to them, as the web's does at `context.tsx:304-317`.
- `phoneBasket: Basket`, the core `Basket` type over the KV store under key `ratrace:basket`, the same shape as `browserBasket.ts`. The phone services use it.
- `renderGame(ui, services, locale='en')` and `memoryServices(store?, options?)`, as on the web (`apps/web/src/testing/render.tsx`), with the expo mocks (router, safe area, Sprite, reanimated) that `Placeholder.test.tsx` and `context.test.tsx` use today, moved here once.

- [ ] **Step 1: Write the failing tests.**
  - Each stand-in returns its no-account answer.
  - The cues equal the web's on the same transitions.
  - Orders put in the basket are there after the provider is remounted on the same KV store.
  - `renderGame` draws a screen in es and ru.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** Run — PASS.
- [ ] **Step 5: Commit** `feat(mobile): the game context of a phone with no account, its sounds and its basket`.

### Task 4: The kit's missing pieces

**Files:**
- Create:
  - `apps/mobile/src/ui/Sparks.tsx`
  - `apps/mobile/src/ui/Slider.tsx`
  - `apps/mobile/src/ui/charts.tsx` (Skia)
  - `apps/mobile/src/ui/Sticky.tsx`
  - tests beside each
- Modify:
  - `apps/mobile/src/ui/motion.ts`: every keyframe the solo screens use, built from `globals.css` with its steps and duration: `paper`, `legend`, `holo`, `glint`, `medal`, `fly`, `fall`, `reveal`, `alarm`, `tear`, `page`, `light`, `spark`.
  - `apps/mobile/src/ui/animations.tsx`: hooks `usePaper`, `useLegend`, `useHolo`, `useGlint`, `useMedal`, `useFly`, `useFall`, `useReveal`, `useAlarm`, `useTear`, `usePageTurn`, `useLight`, `useSpark`. They take the same `{ delayMs }` as `useRise`.
  - `apps/mobile/src/ui/kit.tsx`: `Segmented` gets `columns?: number`, the web's `gridClassName` cases.
  - `apps/mobile/src/ui/Picker.tsx`: `Face` gets `backdrop?: string`.
  - `apps/mobile/src/app/kit.tsx` and `apps/web/src/app/[locale]/kit/page.tsx`: a section `motion-2`, showing the new keyframes held at their middle step, Sparks, the slider and both charts.

**Interfaces:**
- Produces:
  - `Sparks({ count?, tone? })`, as `apps/web/src/ui/Sparks.tsx`.
  - `Slider({ value, min, max, step, onChange, label })`: a gesture-handler pan on a 44 pt track, drawn as the web's `.range` style (globals.css). Accessible as `accessibilityRole="adjustable"`, with increment and decrement actions of one `step`.
  - `LineChart({ points, tone: 'teal'|'wine', width=280, height=90 })`: the web's `PriceChart` path, area, dashed baseline and end dot, drawn in Skia with antialiasing off.
  - `Bars({ bars, barWidth=10, step=14, height=96 })`: the web's `WorthGraph` rects, crisp.
  - `StickyScreen({ header, children, fixed?, bar? })`: a `Screen` whose `header` sticks under the top inset while the column scrolls (`stickyHeaderIndices`). A second sticky row (`subHeader`) holds the Finance tabs under the HUD.
  - Every new keyframe: a test reads its `@keyframes` and `animation:` from `globals.css` and expects the same steps and duration (the phase 1 motion test's method).

- [ ] **Step 1: Write the failing tests**, one per component and one for each keyframe. **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** Run — PASS.
- [ ] **Step 5:** Shoot the `motion-2` section on both sides with `kit-shots.ts --only=motion-2`. It has no difference larger than the phase 1 report allows.
- [ ] **Step 6: Commit** `feat(mobile): the rest of the web's motion, sparks, a slider, charts and a sticky header`.

### Task 5: Scenes — one game state, drawn by both clients

**Files:**
- Create:
  - `packages/core/src/testing/scenes.ts`, `packages/core/src/testing/scenes.test.ts`
  - `apps/web/src/app/[locale]/kit/scene/page.tsx` (this branch only)
  - `apps/mobile/src/app/scene.tsx` (dev only, as `kit.tsx`)
  - `apps/mobile/scripts/scene-shots.ts` (reuses `kit-shots.ts`'s web and app drivers and `kitCompare`)
- Modify: `apps/mobile/scripts/kitCompare.ts`, only if a scene needs a scroll position; add `scrollTo` to its `Section` options.

**Interfaces:**
- Produces:
  - `SCENES`: a `readonly` list of `{ name, locale, sheet? }`.
  - `sceneStore(name): Promise<MemoryStore>`. It builds the game state by driving a core round store (`createGameStore` over `LocalSessions` and `MemoryStore`, with the fixed ids, seeds and clock of `memoryServices`). It starts a named life on a fixed seed, then plays with the content's `saver` bot to the named round and stage. The resulting store is identical on both clients.
  - Scene names are `<screen>-<state>`. Each later task adds its own to `SCENES` and lists them.
  - The web page renders the screen the scene names (Home, NewLife, Play, Records, Collection) in `GameProvider services={memoryServices(store)}`. The app's `/scene?name=` route does the same through `renderGame`'s services.
  - `scene-shots.ts [web] [app] [compare] [--only=name,name]` writes `docs/superpowers/reports/phase-2-parity/<name>-{web,app,diff}.png` and a line per scene in `phase-2-parity.json`.

- [ ] **Step 1: Write the failing test.** `sceneStore('play-news-r1')` and `sceneStore('play-finance-r6')` give saves whose `stateHash` is the same on two calls. The life, round and stage are the ones named.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement with scenes `home-new`, `home-continue`, `play-news-r1`, `play-cards-r1`, `play-finance-r6`. **Step 4:** Run — PASS.
- [ ] **Step 5:** Both clients open each of the five scenes. `scene-shots.ts web app` writes ten PNGs. The comparison is not judged yet: the screens are still placeholders.
- [ ] **Step 6: Commit** `test(mobile): scenes, one game state drawn by the web and by the app`.

**The screen tasks (6–19) share one method.**
- Port the web file or files named, piece by piece, with the same names.
- Port the web test's solo behaviours listed in the task as mobile tests (`renderGame`). Watch each fail before the screen exists.
- Add the task's scenes. Shoot them with `scene-shots.ts --only=…`.
- Fix every difference larger than the phase 1 tolerances (text within 1 pt, shapes 0 px; sprites and frames exact).
- Commit when the tests pass, the whole repo is green and the task's scenes compare clean.
- Each task's last step adds its scene rows to `docs/superpowers/reports/2026-10-21-phase-2-parity.md`.

### Task 6: Home, Legal and the settings sheets

**Files:**
- Create: `apps/mobile/src/game/screens/{Home,Settings}.tsx`, `apps/mobile/src/app/legal.tsx` (static, from the web's `legal/page.tsx`), tests.
- Modify: `apps/mobile/src/app/index.tsx`.
- Delete: `Placeholder.tsx` and its test once no route uses it (Task 19). Until then, routes not yet ported keep it.

**Interfaces:**
- Consumes: Task 3's stand-ins.
- Produces:
  - `Home`: continue, new, the last life's look, collection, records, the lost and moved notices, the not-saving alert, the settings gear, the legal link. Nothing online: no rankings link, challenge card, rooms, friends, profile link, install offer or account offer.
  - From `Settings.tsx`: `LanguagePick`, `LanguageMenu` (through `setLocale`), `Switches` (sound, reduced motion, guide), `Version`, `Standing`, `SettingsSheet`, `EndLife`, `HomePreferences`, `HomeSettingsPanel`, `HomeSettingsSheet`.
  - `sheetsGone()`: a promise that waits for open Sheets to close. On the phone it resolves after the Modal's `onDismiss`.
- Web tests to port:
  - `Home.test.tsx`: new life for newcomers; settings behind the gear; Russian; collection and records links; continue first with who and where; the last life's look; the not-saving alert; lost-life explanations (damaged, newer, outdated, waiting); no warning without a life.
  - `Settings.test.tsx`: the kind of life shown (own); standing; the not-saving alert; switches change and persist; back to home and close.
- Scenes: `home-new`, `home-continue`, `home-settings` (sheet open), `home-lost-newer`, `legal`.

- [ ] Steps as in the shared method. **Commit** `feat(mobile): home, its settings and the legal page`.

### Task 7: New life

**Files:**
- Create: `apps/mobile/src/game/screens/{NewLife,LifeSummary,CareerPreview}.tsx`, tests.
- Modify: `apps/mobile/src/app/new.tsx`.

**Interfaces:**
- Produces:
  - `NewLife`: a radiogroup of the lives, then the locked list with `unlockProgress`, start, and the replace-confirm Sheet. Start calls `router.replace('/play')`.
  - `LifeSummary`, `LifeBrief`, `Difficulty`.
  - `CareerPreview`. Cards uses it from Task 11.
  - Not drawn: the ranked Segmented, the offline note, the `elsewhere` Sheet.
- Web tests to port:
  - `NewLife.test.tsx`: a random pick starts nothing; three starting lives and the locked list; locked hints and progress counts; unlocked lives marked; start replaces to `/play`; confirm before ending a life in progress; no ask if it is over; start failure and retry.
  - `CareerPreview.test.tsx`.
- Scenes: `new-first`, `new-unlocked` (profile with two unlocks), `new-replace` (sheet open).

- [ ] Steps as in the shared method. **Commit** `feat(mobile): choosing a new life`.

### Task 8: The HUD and what hangs from it

**Files:**
- Create: `apps/mobile/src/game/screens/{Hud,Explain,Loop,CityBanner,Crisis,Jail}.tsx`, tests.

**Interfaces:**
- Produces:
  - `Hud`: figures, portrait, Bar to the way out, news and settings buttons, and the detail Sheets (cash, flow, status, rat race, score now). It mounts as the `StickyScreen` header.
  - The web's "away" strip shows once the figures have scrolled off. The phone's equivalent is the scroll offset passed by `StickyScreen`, in place of `IntersectionObserver`.
  - `useShown()`, as `Hud.tsx:27-32`.
  - `Loop`, `CityBanner`, `CrisisBar`, `CrisisDetails`, `JailSheet`, `Explain`.
- Web tests to port:
  - `Hud.test.tsx`: figures open sheets; status by source adds up, in es and ru; the score-now split; the portrait frame by status.
  - `Jail.test.tsx`.
- Scenes: `play-news-r1` (HUD at top), `hud-cash` (sheet open), `hud-status-ru`, `hud-jailed`, `hud-crisis`.

- [ ] Steps as in the shared method. **Commit** `feat(mobile): the HUD, its sheets and its banners`.

### Task 9: Play — the stage machine, news, guide and page turn

**Files:**
- Create: `apps/mobile/src/game/screens/{Play,News,Guide,PageTurn}.tsx`, `apps/mobile/src/game/useRivals.ts` (copy of the web's, held to it by a test as `cues.ts` is), tests.
- Modify: `apps/mobile/src/app/play.tsx`.

**Interfaces:**
- Produces:
  - `Play`. Its pieces:
    - `PlayRound` (the warnings Sheet);
    - `Actions` (the primary button per stage, in a `BottomBar`);
    - `StageView` and `StageBody`, with `Fault` and `Waiting`;
    - a redirect home when there is no life;
    - `PageTurn` on a new round unless `useStill()`;
    - the moved Toast.
  - Stages that later tasks have not ported yet show the placeholder line.
  - Android Back on Play goes home (`router.replace('/')`); a Sheet open takes it first.
  - `NewsPanel`, `Headlines`, `RoundOpener`; `Guide`; `PageTurn`.
- Web tests to port:
  - `Play.test.tsx`: redirect with no life; profile from the portrait (once Task 17 is done, test it there); mid-hand resume; the guide (one tip per stage, read once, off for good, not for veterans, waits for runs); a double tap is ignored; the moved-in-another-tab toast becomes "moved on another device"; the fault screen; Spanish.
  - `PageTurn.test.tsx`.
- Scenes: `play-news-r1`, `play-news-r6`, `play-guide-r1`, `play-fault`, `play-pageturn` (held at the middle step).

- [ ] Steps as in the shared method. The Android Back rule is tested with the `BackHandler` mock. **Commit** `feat(mobile): play, round by round, from the news`.

### Task 10: Amounts, celebrations, flying coins and medals

**Files:**
- Create: `apps/mobile/src/game/screens/{AmountSheet,Celebrations,FlyingCoins,Medal,rarityStyle}.tsx`, tests.

**Interfaces:**
- Produces:
  - `AmountSheet` on `Slider`. The amount is read aloud through `accessibilityValue`. There is no exact-amount field, as on the web.
  - `Celebrations`: the rarity glow grows; a legendary takes the screen until moved on.
  - `FlyingCoins({ from, to })`. It measures with `measureInWindow` on refs registered in a `CoinTargets` context, where the web uses `[data-coin-from]` and `[data-hud-cash]`. The HUD registers `cash`, and outcome and resolve register their sources.
  - `Medal`, `rarityStyle`.
- Web tests to port: `AmountSheet.test.tsx` (the slider is the one control; drop the keys); `Celebrations.test.tsx`.
- Scenes: `celebrate-legendary`, `amount-savings`.

- [ ] Steps as in the shared method. **Commit** `feat(mobile): amounts on a slider, coins that fly and medals`.

### Task 11: Cards, the swipe, and the outcome

**Files:**
- Create: `apps/mobile/src/game/screens/Cards.tsx` (`CardStage`, `Outcome`), tests.

**Interfaces:**
- Consumes: `CareerPreview` (Task 7), `CityPreview` (Task 14). Until Task 14 lands it is a stub that shows the city's name; the stub is noted in the ledger.
- Produces:
  - `CardStage` with the swipe, its behaviour copied from `Cards.tsx:172-173,236-247`:
    - a gesture-handler `Pan` on the card, with a tilt of ±6° over ±160 pt and snap back;
    - a release past 90 pt picks `shown[1]` (to the right) or `shown[0]` (to the left);
    - only when exactly two options are shown, `!busy` and `!useStill()`.
  - The options as buttons always.
  - The rarity looks `legend`, `holo` and `glint`, and Sparks on a legendary card.
  - `Outcome`: the card result, the choice, what followed, and the changes; `FlyingCoins` to the HUD's cash.
  - Not drawn: `Pending` (ranked).
- Web tests to port:
  - `Outcome.test.tsx` (solo cases).
  - `CardStatus.test.tsx`.
  - `Play.test.tsx` "no impossible choices".
  - New tests:
    - a swipe past 90 picks;
    - a swipe under 90 snaps back and picks nothing;
    - no swipe with three options, while busy, or with reduced motion;
    - two quick swipes make one move.
- Scenes: `play-cards-r1`, `play-cards-legendary`, `play-cards-three`, `play-outcome-r1`, `play-cards-ru-360` (a 360 pt frame).

- [ ] Steps as in the shared method. **Commit** `feat(mobile): cards to swipe or press, and what came of them`.

### Task 12: Finance — the shell, the basket, the portfolio

**Files:**
- Create: `apps/mobile/src/game/screens/{Finance,Glance}.tsx`, tests.
  - `Finance.tsx` starts with the shell, `useRound`, `Basket`, `BasketList`, `Portfolio`, `PensionSheet`, `AssetMark`, the margin pieces (`Gear`, `MarginGauge`, `MarginLine`) and `Plans`, as `Finance.tsx:33-377,1816-1966`.

**Interfaces:**
- Produces:
  - `Finance` with the eight tabs. The guided tab filtering uses `useGuided`, `useIntroducesTabs` and `TAB_FROM_ROUND`; the debt tab shows early for a player in debt. The tabs row is the `StickyScreen` `subHeader` and scrolls sideways when it does not fit.
  - The refusal Toast and the also-removed Toast.
  - Tabs not ported yet render nothing and are hidden. Each later task shows its tab.
  - Not drawn: the room-loan `p.lent` panel.
- Web tests to port:
  - `Finance.test.tsx`: pension; selling with plans; the portfolio glance; payouts reinvested; margin buying; plans; the basket lists (ordered, decided by card).
  - `GuidedTabs.test.tsx`.
  - Play's "basket count and undo".
- Scenes: `play-finance-r6` (portfolio), `finance-basket` (sheet), `finance-pension`, `finance-tabs-ru-360`.

- [ ] Steps as in the shared method.
- [ ] **Performance checkpoint (mid-phase):** a release build (`npx expo prebuild --platform ios --clean`, then `npx expo run:ios --configuration Release`; `apps/mobile/ios/` git-ignored) on the simulator. Measure Home → Play, a stage change, opening Finance and a tab switch against the budgets in Global Constraints; write them in the parity report. Fix any over budget before Task 13.
- [ ] **Commit** `feat(mobile): finance, its tabs, the basket and the portfolio`.

### Task 13: Finance — market, property, debt

**Files:**
- Modify: `apps/mobile/src/game/screens/Finance.tsx`.
  - Add `Market`, `BuySheet` with `PriceChart` on `LineChart`, `PropertyTab`, `BuyHome`, `OwnedPropertySheet`, `SellPropertySheet`, `DebtTab`, `SwitchLink` and `SwitchSheet`, as `Finance.tsx:378-1120`.

**Interfaces:**
- Produces: the market, property and debt tabs.
- Web tests to port, from `Finance.test.tsx`:
  - homes owned, for letting and parking;
  - the property sheet;
  - a holding opens the buy sheet;
  - a plan in the market;
  - the market without the Finance skill;
  - the mortgage switch.
- Scenes: `finance-market`, `finance-buy-stock` (sheet with chart), `finance-property`, `finance-debt`.

- [ ] Steps as in the shared method. **Commit** `feat(mobile): finance's market, homes and debts`.

### Task 14: Finance — lifestyle and cities; the work pieces it uses

**Files:**
- Create: `apps/mobile/src/game/screens/{Work,CareerMoves,HealthCover,ItemCost,ItemUses,StatusNote,focusNote}.tsx`, tests.
  - `Work.tsx` gets every section listed for it in `Work.tsx` (`WorkPanel` included, which Profile uses in Task 17).
- Modify: `Finance.tsx`. Add `Lifestyle`, `MoveSheet`, `CityDetail`, `Versus` and `CityPreview`, as `Finance.tsx:1121-1506`.
- Replace: the Task 11 stub of `CityPreview`.

**Interfaces:**
- Produces:
  - The lifestyle tab.
  - `CityPreview` for Cards.
  - `WorkPanel`, `LifeUses`, `TeaseUse` (its room part answers "no room"), `MasteredLine`.
- Web tests to port:
  - `Finance.test.tsx`: the city move; city-bound goods; lifestyle status; insurance renewal and the health note; focus from the work panel; mastered focus.
  - `Work.test.tsx`.
  - `CityPreview.test.tsx`.
- Scenes: `finance-lifestyle`, `finance-move` (sheet), `play-cards-city` (CityPreview), `work-panel`.

- [ ] Steps as in the shared method. **Commit** `feat(mobile): finance's way of life, the move and the work panel`.

### Task 15: Finance — shop, taxes; business

**Files:**
- Create: `apps/mobile/src/game/screens/{Evasion,Business}.tsx`, tests.
- Modify: `Finance.tsx`. Add `Shop` (its shelf is a grid of 3, or 5 at a width of 460 or more, the web's container query, read from `onLayout`), `ItemSheet`, `SecondHand`, `NoInvoice`, `Taxes` and `Residency`, as `Finance.tsx:1507-1815`. Mount `BusinessTab`.

**Interfaces:**
- Produces: the shop, taxes and business tabs. All eight tabs are now shown.
- Web tests to port:
  - `Finance.test.tsx`: the shop catalogue, owned, uses, instalments and second hand; evasion and tax; Bangkok residency.
  - `Business.test.tsx`, all of it.
- Scenes: `finance-shop`, `finance-item` (sheet), `finance-taxes`, `finance-business`.

- [ ] Steps as in the shared method. **Commit** `feat(mobile): finance's shop, taxes and businesses`.

### Task 16: Resolve and moments

**Files:**
- Create: `apps/mobile/src/game/screens/{Resolve,Moments}.tsx`, tests.

**Interfaces:**
- Produces:
  - `Resolve`: the ledger rows rise one by one (ROLL 80 ms, RISE 280 ms), `CashCount` and `WorthRise` on `useCountUp`, milestones, and coins from the ledger to the HUD. Its room notes answer "no room".
  - `Moments`: one at a time, the gravest first; confetti on `fall`, `reveal`; the crisis moment with its siren.
- Web tests to port:
  - `Moments.test.tsx`, all of it; the sounds through `useSound`'s test double.
  - `Play.test.tsx`: a full round from news to ledger to next; the unlock and badge celebrations.
- Scenes: `play-resolve-r6` (rows all risen), `moment-escape`, `moment-bankrupt`, `moment-crisis`.

- [ ] Steps as in the shared method. **Commit** `feat(mobile): the year's ledger and the moments of a life`.

### Task 17: The player's profile in a life

**Files:**
- Create: `apps/mobile/src/game/screens/{Profile,Balance,Rivals,WorthGraph}.tsx`, tests.

**Interfaces:**
- Produces:
  - `ProfileSheet`, `ProfileBody`, `More`, `Choice`, `AboutSheet`, `OwnedSheet`, `Leave` (`Leave` is always shown: there is no room).
  - `BalanceSheet` with `WorthGraph` on `Bars`.
  - `RivalsBoard`.
- Web tests to port:
  - `Profile.test.tsx` (no wide-screen case).
  - `Balance.test.tsx`.
  - `Play.test.tsx`: the profile from the portrait.
- Scenes: `profile-r6`, `profile-owned` (sheet), `balance-r6`, `rivals-r6`.

- [ ] Steps as in the shared method. **Commit** `feat(mobile): the player's profile, balance and rivals in a life`.

### Task 18: The end of a life, and the share card

**Files:**
- Create: `apps/mobile/src/game/screens/{End,LifeLine,LifeMap,RankCard,ShareCard}.tsx`, tests.
- Modify: `apps/mobile/package.json` (`npx expo install expo-file-system expo-sharing`).

**Interfaces:**
- Produces:
  - `End`: score, epilogue (rises at 300 + i×350 ms), graph, map, badges, `RankGain`, rivals, unlocked life, and new life. Not drawn: standing among others, the rankings link, the challenge result, versus others.
  - `LifeMap`: the map sprite, with the route as a Skia polyline over it.
  - `ShareCard`:
    - it draws `@ratrace/core/game/share`'s `DrawOp`s on a Skia offscreen surface at 4×, with no smoothing;
    - it writes the PNG to the cache with expo-file-system;
    - it shares the file with expo-sharing;
    - when sharing is not available, it says so as the web's no-canvas fallback does.
- Web tests to port:
  - `ShareCard.test.tsx`: all ops drawn; a missing sprite skipped; long names shrink; pixel and Cyrillic font sizing; the error states. Drawing is tested against a recording Skia canvas double.
  - `Play.test.tsx`: the end screen and the new-life link; the second life beats the first.
- Scenes: `end-escaped`, `end-bankrupt`, `end-share` (sheet with the card), `end-ru`.

- [ ] Steps as in the shared method. **Commit** `feat(mobile): the end of a life and its share card`.

### Task 19: Records and the collection

**Files:**
- Create: `apps/mobile/src/game/screens/{Records,RunDetail,LifeFace,Collection}.tsx`, tests.
- Modify: `apps/mobile/src/app/{records,collection}.tsx`.
- Delete: `apps/mobile/src/game/screens/Placeholder.tsx` and its test. The online routes (`challenge`, `rankings`, `room`, `player`) now redirect home: they are not reachable from any solo screen.

**Interfaces:**
- Produces:
  - `Records`, without the multiplayer section.
  - `RunDetail`, `LifeFace`.
  - `Collection`, with tabs, a rarity filter and silhouettes.
- Web tests to port:
  - `Records.test.tsx` (solo cases).
  - `Collection.test.tsx`.
- Scenes: `records-empty`, `records-three`, `records-detail` (sheet), `collection-items`, `collection-badges`.

- [ ] Steps as in the shared method. **Commit** `feat(mobile): records of past lives and the collection`.

### Task 20: A whole life by hand, and the first release build (phase exit)

**Files:**
- Create: `docs/superpowers/reports/2026-10-21-phase-2-parity.md` (final, with every scene row and the numbers).
- Modify: `apps/mobile/app.json` (any field a release build asks for), `.gitignore` (`apps/mobile/ios/`, `apps/mobile/android/`: generated by prebuild, never committed).

**Interfaces:**
- Produces:
  - A release build of the app (`npx expo run:ios --configuration Release`, from `apps/mobile`, after `npx expo prebuild --platform ios --clean`) installed on the booted iOS simulator. No account is needed.
  - The measures of that build in the report: the time from launch to the home screen, from home to play, and from opening Finance to switching tabs, each the median of five.

- [ ] **Step 1:** Play a whole first life by hand in the simulator, from home to the end screen, then a second one to round 3. Then:
  - kill the app at Finance with orders in the basket, and reopen it;
  - use Back from Play;
  - switch to Russian.
  Write down every fault. Fix each in its screen, with a test.
- [ ] **Step 2:** `scene-shots.ts web app compare` over every scene. The report lists none over tolerance.
- [ ] **Step 3:** Build the release app. Install it, launch it, and take every measure of the Global Constraints' performance budgets, plus the swipe's frame rate (the Perf Monitor). Any measure over its budget is fixed, with its cause in the report.
- [ ] **Step 4:** The Android emulator. Not installed yet: the user's approval for the ≈6–8 GB download is asked in the phase's final message. If approved before this task, the same release build and whole life run on it too.
- [ ] **Step 5:** Update the spec's "Phases" section (phase 2 done, and what phase 3 starts from) and the memory file `mobile-apps-plan.md`.
- [ ] **Step 6: Commit** `docs(mobile): phase 2, a whole life by hand and every screen beside the web's`.
