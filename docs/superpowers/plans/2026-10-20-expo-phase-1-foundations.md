# Expo app, phase 1: Foundations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Everything the game's screens will be built from, in `apps/mobile`, looking exactly like the web: theme, fonts, frames, background, crisp sprites, the whole UI kit, overlays, stepped motion, sound, words, navigation and the phone's store; proven by a kit page shown side by side with the web's.

**Architecture:** `apps/mobile/src/ui/*` mirrors `apps/web/src/ui/*` component for component, with the same props and pixel values, built on React Native Views (frames as 2 px strips, never `borderRadius`/`shadow*`/`elevation`) and Skia for anything drawn pixel by pixel (sprites with nearest-neighbour sampling, masks, silhouettes). Values the web defines in `apps/web/src/app/globals.css` are copied into `src/ui/theme.ts` and `src/ui/motion.ts`, and tests read `globals.css` so the two cannot drift. Logic stays in `@ratrace/*`.

**Tech Stack:** Expo SDK 58, React Native 0.88, React 19.3, Hermes, Expo Router, @shopify/react-native-skia, react-native-reanimated, react-native-gesture-handler, react-native-safe-area-context, expo-font with @expo-google-fonts (jersey-15, chakra-petch, oswald, exo-2), expo-audio, expo-localization, use-intl, @formatjs Intl polyfills, expo-sqlite (KvStore, from phase 0). Tests: the repo's vitest, with `react-native` aliased to `react-native-web` for component tests.

**Spec:** `docs/superpowers/specs/2026-10-20-expo-app-design.md`

## Global Constraints

- Branch `expo`, worktree `/Users/javierms/Projects/ratrace/.worktrees/expo`; never commit to `dev`. Rebase on `origin/dev` before starting and at the end.
- Expo SDK 58, React Native 0.88, React 19.3; install native packages with `npx expo install` (SDK-matched versions), from `apps/mobile`.
- Identity: store name **The Rat Race**, Android package and iOS bundle id `com.hackio.theratrace`.
- No `borderRadius`, `shadowColor`/`shadowOffset`/`shadowOpacity`/`shadowRadius` or `elevation` anywhere in `apps/mobile/src`. Corners are square, shadows are hard 2 px strips.
- Colours only from the 31 tokens of `globals.css:10-58` (plus the few the web uses outside them, named in Task 2).
- Frame edge 2 px; touch targets at least 44 pt; phone shell at most 448 pt wide, centred; body text 15 pt, line height 1.45, colour cream.
- Every animation steps like the web's `steps(n)` with the web's duration and step count; only `useCountUp` eases (900 ms, ease-out cubic).
- Every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Stage by path; never `git add -A`.
- The web the players use is not changed. The only web file added (Task 13, the kit page) lives on this branch until phase 5.

## Review Focus

- A Russian player: pixel and reading text in Russian must use Oswald / Exo 2 (Jersey and Chakra have no Cyrillic), not boxes or the system font. Pinned in Task 3.
- A sprite id that does not exist: a placeholder (8 px checkerboard of night-600/night-700) at the fallback size, logged once, never a crash. Pinned in Task 6.
- The Android Back button with a Sheet open closes the Sheet, not the app or the screen. Pinned in Task 9.
- Reduced motion (OS setting or the game's setting): animations end at their last frame at once, confetti and motion-only pieces are not drawn. Pinned in Task 10.
- A narrow phone (under 340 pt for a Stat): the Stat's icon is hidden, as on the web. Pinned in Task 8.

---

### Task 1: App identity, structure and test harness

**Files:**
- Modify: `apps/mobile/app.json`, `apps/mobile/package.json`, `vitest.config.ts`, `package.json` (root `typecheck` script)
- Create: `apps/mobile/src/harness.test.tsx`

**Interfaces:**
- Produces: component tests under `apps/mobile/src/**/*.test.tsx` run by the root `pnpm -s test`, with `react-native` resolving to `react-native-web`; root `pnpm -s typecheck` covers `apps/mobile`.

- [ ] **Step 1:** `app.json`: `name` "The Rat Race", `slug` "theratrace", `scheme` "theratrace", `orientation` portrait, `userInterfaceStyle` dark, `backgroundColor` "#141b33", `android.package` and `ios.bundleIdentifier` "com.hackio.theratrace", splash background "#141b33". From `apps/mobile`: `npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants @shopify/react-native-skia react-native-reanimated react-native-gesture-handler expo-font expo-audio expo-localization`; add devDependency `react-native-web` already present.
- [ ] **Step 2: Write the failing test** `apps/mobile/src/harness.test.tsx`: renders `<View testID="box"><Text>hola</Text></View>` from `react-native` with `@testing-library/react` and expects `getByText('hola')`.
- [ ] **Step 3:** Run `pnpm -s vitest run apps/mobile/src/harness.test.tsx` — expected: FAIL (cannot parse `react-native`).
- [ ] **Step 4:** In the root `vitest.config.ts` add `resolve.alias` `{ find: /^react-native$/, replacement: 'react-native-web' }` and the `// @vitest-environment jsdom` pragma in mobile component tests; add `pnpm --filter @ratrace/mobile typecheck` to the root `typecheck` script.
- [ ] **Step 5:** Run the test — PASS; run `pnpm -s typecheck && pnpm -s lint` — exit 0.
- [ ] **Step 6: Commit** `chore(mobile): the app's identity and a test harness for its components`.

### Task 2: Theme tokens, held to the web's

**Files:**
- Create: `apps/mobile/src/ui/theme.ts`, `apps/mobile/src/ui/theme.test.ts`

**Interfaces:**
- Produces: `COLORS: Record<ColorToken, string>` (keys exactly the web's names: `night-900` … `white`), `type ColorToken`, `EDGE = 2`, `SHELL_WIDTH = 448`, `TOUCH = 44`, `BODY = { size: 15, lineHeight: 1.45, color: 'cream' }`, `EXTRA = { backdrop: 'rgba(11,16,34,0.8)', bronze: '#c98a4b', glow: { uncommon, rare, legendary } }` (values from `rarityStyle.ts:7-12`, `globals.css` `night-900/80`).

- [ ] **Step 1: Write the failing test** `theme.test.ts`: reads `apps/web/src/app/globals.css`, collects every `--color-<name>: #hex;` in the `@theme` block, and expects `COLORS` to equal that map exactly (same keys, same lowercase hex); expects `EDGE` to be 2.
- [ ] **Step 2:** Run it — FAIL (module missing).
- [ ] **Step 3:** Write `theme.ts` with the 31 tokens of `globals.css:10-58`.
- [ ] **Step 4:** Run it — PASS.
- [ ] **Step 5: Commit** `feat(mobile): the web's colours and measures, held to its stylesheet`.

### Task 3: Fonts and text

**Files:**
- Create: `apps/mobile/src/ui/fonts.ts`, `apps/mobile/src/ui/text.tsx`, `apps/mobile/src/ui/fonts.test.ts`

**Interfaces:**
- Produces: `useGameFonts(): boolean` (loaded), `familyFor(role: 'pixel' | 'read', weight: 400 | 600, locale: string): string`, `JERSEY_X_HEIGHT: number`, `pixelSize(px: number): number` (= `px * PIXEL_X_HEIGHT / JERSEY_X_HEIGHT`, `PIXEL_X_HEIGHT` from `@ratrace/core/game/share`), `<PixelText size tone>` (letterSpacing 0.03 em, lineHeight 1.1, family by locale, Russian word spacing as the web's `-0.16em` approximated), `<ReadText size weight tone>` (lineHeight 1.45). Fonts: Jersey 15 400; Chakra Petch 400/600; Oswald 500 (Russian pixel); Exo 2 400/600 (Russian reading).

- [ ] **Step 1: Write the failing tests:** `familyFor('pixel', 400, 'ru')` is the Oswald 500 family, `familyFor('pixel', 400, 'es')` the Jersey family, `familyFor('read', 600, 'ru')` Exo 2 600; `JERSEY_X_HEIGHT` equals `sxHeight / unitsPerEm` read from the Jersey 15 TTF in `node_modules/@expo-google-fonts/jersey-15` (parse the OS/2 and head tables), to 3 decimals; `pixelSize(17)` is `17 * 0.56 / JERSEY_X_HEIGHT`.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement `fonts.ts` and `text.tsx`; text is not selectable.
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5: Commit** `feat(mobile): the game's four fonts, Cyrillic by language, Jersey sized as the web sizes it`.

### Task 4: Frames

**Files:**
- Create: `apps/mobile/src/ui/frames.ts` (geometry), `apps/mobile/src/ui/Frame.tsx` (components), `apps/mobile/src/ui/frames.test.ts`

**Interfaces:**
- Produces: `type FrameKind = 'frame' | 'bevel' | 'sunk' | 'raised' | 'lamp' | 'double' | 'tab'`; `type FrameTone = { frame?: ColorToken; hi?: ColorToken; lo?: ColorToken; ring?: ColorToken }` with presets `GOLD = { frame: 'gold-900', hi: 'gold-200', lo: 'gold-700' }`, `CREAM = { frame: 'ink-900', hi: 'white', lo: 'ink-200' }`, `WINE = { hi: 'wine-500', lo: 'wine-900' }`; `stripsOf(kind, w, h, tone): Array<{ x, y, w, h, color }>` in pt relative to the box (negative = outside); `<Framed kind tone style>{children}</Framed>` that draws those strips as absolute Views around/inside its children.
- Geometry, from `globals.css:411-520` (defaults: frame night-900, hi night-500, lo night-900 for bevel / night-800 for raised, ring gold-700):
  - `frame`: four 2 pt strips outside the box, each only as long as its side, so the four corners stay empty.
  - `bevel`: `frame` + inset hi on top and left (2 pt), lo on bottom and right (2 pt).
  - `sunk`: inset night-900 on top and left, 2 pt.
  - `raised`: `frame` + inset hi top 2 pt + inset lo bottom 3 pt + a drop strip below: x 2…w−2, y h…h+4, colour frame.
  - `lamp`: inset hi top 2 pt, lo bottom 2 pt.
  - `double`: rings at 0–2 night-900, 2–4 ring colour, 4–6 night-900 outside the box, corners filled (box-shadow spread rings).
  - `tab`: `frame` in night-900 + inset gold-200 top 2 pt + gold-700 bottom 2 pt.

- [ ] **Step 1: Write the failing tests** for `stripsOf` on a 100×40 box: `frame` gives exactly `{x:0,y:-2,w:100,h:2}`, `{x:0,y:40,w:100,h:2}`, `{x:-2,y:0,w:2,h:40}`, `{x:100,y:0,w:2,h:40}` (no strip covers (−2,−2)); `raised` includes `{x:2,y:40,w:96,h:4,color:frame}` and a 3 pt lo strip at y 37; `bevel` with `GOLD` colours hi gold-200 and lo gold-700; `double` covers (−6,−6) with night-900.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement `frames.ts`; `Frame.tsx` draws the strips (pointerEvents none) and keeps the children's layout untouched.
- [ ] **Step 4:** Run — PASS. Add `apps/mobile/src/ui/noRounding.test.ts`: fails if any file under `apps/mobile/src` contains `borderRadius`, `shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius` or `elevation`.
- [ ] **Step 5: Commit** `feat(mobile): the web's hard pixel frames, corner pixels left empty`.

### Task 5: The page: background, safe areas, shell

**Files:**
- Create: `apps/mobile/assets/ui/dots.png` (6×6: night-800 with a 1 px night-700 dot at 0,0, as `radial-gradient(night-700 1px, transparent 1px) 0 0 / 6px 6px`), `apps/mobile/scripts/dots.ts` (writes it), `apps/mobile/src/ui/Page.tsx`, `apps/mobile/src/ui/Page.test.tsx`

**Interfaces:**
- Produces: `<Page>{children}</Page>`: repeated dot background, top safe inset painted night-900, content column at most 448 pt wide and centred, horizontal gutter 12 pt (`px-3`); `<BottomBar>` padded by `max(12, inset bottom)` on night-900.

- [ ] **Step 1: Write the failing test:** `Page` renders its children inside a column whose style has `maxWidth: 448` and `alignSelf: 'center'`; the image tile is `dots.png` with repeat; the script's output pixel (0,0) is night-700 and (3,3) night-800.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement with `react-native-safe-area-context`. **Step 4:** Run — PASS.
- [ ] **Step 5: Commit** `feat(mobile): the page, its dotted ground and its safe areas`.

### Task 6: Sprites, crisp at any scale

**Files:**
- Create: `apps/mobile/scripts/sprites.ts`, `apps/mobile/scripts/sprites.test.ts`, `apps/mobile/src/sprites/` (generated: `manifest.json`, `sources.ts`), `apps/mobile/src/ui/Sprite.tsx`, `apps/mobile/src/ui/sprite.test.ts`, `apps/mobile/src/ui/RatAvatar.tsx`
- Modify: `apps/mobile/package.json` (script `sprites`, run before `start`/`build`; generated files git-ignored like the web's)

**Interfaces:**
- Consumes: `art/clean/**` (same source as `apps/web/scripts/sprites.ts`), `ratSprite`, `GROUND` from core avatar.
- Produces: `spriteOf(id): { w: number; h: number } | null`; `spriteBox(id, scale: 1 | 2 | 3 | 'art', art: number, fallback): { w; h }`; `<Sprite id scale alt fallback silhouette />` drawn with Skia `Image` and `sampling={{ filter: FilterMode.Nearest, mipmap: MipmapMode.None }}`; silhouette = the sprite as a mask over a night-900 fill (Skia blend `srcIn`); `<RatLayers look size />` and `<RatAvatar look size: 'sm' | 'md' | 'lg' />` (32 / 44 / 96 pt, `border` 2 pt night-900 drawn as a frame strip, ground colour from `GROUND`), body masked by `rat.clip.<outfit>` when an outfit is worn (Skia `dstIn`).

- [ ] **Step 1: Write the failing tests:** the script's manifest has exactly the web's ids and sizes (compare with `apps/web/src/sprites/manifest.json` after running the web's script, or with `art/clean` directly); `spriteBox('icon.coin', 2, 1)` is 64×64 and `spriteBox('card.x', 'art', 2)` is the card's size × 2; an unknown id gives the fallback and `spriteOf` null; `sources.ts` has one `require` per id.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement the script and components; the placeholder for a missing sprite is an 8 pt checkerboard of night-600/night-700, logged once per id. **Step 4:** Run — PASS.
- [ ] **Step 5:** In the simulator (Task 12's kit page, or a temporary screen) look at a 32 px icon at scale 3: edges must be hard, no blur. Screenshot kept for the review.
- [ ] **Step 6: Commit** `feat(mobile): sprites drawn pixel for pixel, with silhouettes and the layered rat`.

### Task 7: Kit, part one: buttons and boxes

**Files:**
- Create: `apps/mobile/src/ui/kit.tsx`, `apps/mobile/src/ui/kit.test.tsx`

**Interfaces:**
- Consumes: `Framed`, `PixelText`, `ReadText`, `COLORS`, `Sprite`.
- Produces (props as `apps/web/src/ui/kit.tsx`, `onPress` for `onClick`): `Button { variant: 'primary' | 'secondary' | 'danger' | 'quiet'; wide?; disabled?; onPress; children }` (pixel 17 pt label, min height 44, padding 16×8, raised frame; primary gold-500 / ink-900 / GOLD tone, secondary night-600 / cream, danger wine-700 / cream / WINE, quiet night-700 / ink-200; pressed moves down 2 pt; disabled opacity 0.45 and no press), `Tile`, `TabTitle` (gold-500, pixel 14 pt uppercase, letter spacing 0.1 em, `tab` frame, 12 pt above the panel's top edge, 8 pt from the left), `Panel { title?; label? }` (`bevel` night-700, padding 12; with a title: margin top 12, padding top 20), `Tag { tone: 'good' | 'bad' | 'plain' }` (pixel 12 pt; teal-800 / wine-700 / night-600 with ink-200), `Bare`, `Well` (`sunk` ink-900), `Row { left; right; sub? }`, `KeyFigure { tone: 'gold' | 'teal' | 'wine' | 'cream' }` (pixel 28 pt, tabular numbers); every pressable calls `onTap?.()` from the sound context (Task 11) on press.

- [ ] **Step 1: Write the failing tests:** each Button variant renders with its background colour and text colour from `COLORS`; a disabled Button has opacity 0.45 and does not call `onPress`; `Panel` with a title renders the `TabTitle` and pads 20 on top; `Tag` tones map to their colours.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** Run — PASS.
- [ ] **Step 5: Commit** `feat(mobile): the kit's buttons, panels, tags and figures, as the web draws them`.

### Task 8: Kit, part two: stats, bars and choices

**Files:**
- Modify: `apps/mobile/src/ui/kit.tsx`, `apps/mobile/src/ui/kit.test.tsx`

**Interfaces:**
- Produces (props as the web's): `Stat { icon; value; label; tone; hint?; onOpen? }` (bevel box, or raised and pressable with `onOpen`; 32 pt icon hidden when the box is narrower than 340 pt, measured with `onLayout`; value pixel 16 pt, label 11 pt ink-200, `▸` in the corner when pressable), `Bar { value; max; label; tone: 'gold' | 'teal'; door? }` (16 lamps in a `frame` + `sunk` night-900 well with 3 pt padding, 10 pt tall, lamp colours gold: base gold-500 hi gold-200 lo gold-700; teal: base teal-300 hi sky-100 lo teal-600; 14 pt door at the end), `TickerBadge { ticker; kind: 'bond' | 'equity' | 'crypto' | 'gold'; logo? }` (pixel 14 pt, 36×56 pt, `lamp`; sky-500 / teal-800 / gold-700 / gold-500), `Segmented { options; value; onChange; orientation }` (selected CREAM tone, cream / ink-900; others night-600 / ink-200; pixel 14 pt), `Toggle { on; label; hint?; icon? }` (raised row night-600; 20×40 sunk switch teal-600 on / night-900 off; cream lamp knob that steps to its side).

- [ ] **Step 1: Write the failing tests:** `Bar` with value 5 of max 16 lights exactly 5 lamps; `Stat` laid out at width 300 hides its icon and at 360 shows it (fire `onLayout`); `Segmented` marks the chosen option and calls `onChange` with the other's value; `Toggle` reports `on` through `accessibilityState.checked`.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** Run — PASS.
- [ ] **Step 5: Commit** `feat(mobile): stats, lamp bars, tickers, segments and toggles`.

### Task 9: Overlays: Sheet, Tabs, Toast, Picker

**Files:**
- Create: `apps/mobile/src/ui/overlay.tsx`, `apps/mobile/src/ui/Picker.tsx`, `apps/mobile/src/ui/overlay.test.tsx`

**Interfaces:**
- Produces (props as `apps/web/src/ui/overlay.tsx`): `Sheet { open; onClose; title; closeLabel; back?; tone?: 'gold' | 'wine'; children }` — a transparent `Modal`, backdrop `EXTRA.backdrop` that closes on press, panel `bevel` night-800 (GOLD or WINE tone), padding 16, at most 88 % of the screen high, scrolling, at most 448 wide, at the bottom, title pixel 19 pt, a 44 pt `✕` close (20 pt, ink-300), rise animation (Task 10), Android Back closes it (`onRequestClose`); `Tabs { tabs; value; onChange }` (horizontal scroll without indicator, gap 8, padding 12×8; tab pixel 15 pt raised, min height 44, active CREAM / ink-900, others night-700 / ink-200); `Toast { message; onDone }` (frame, wine-700, 14 pt, rise, 112 pt from the bottom, gone after 2600 ms); `Picker` as `apps/web/src/ui/Picker.tsx`.

- [ ] **Step 1: Write the failing tests:** pressing the backdrop calls `onClose`; the Modal's `onRequestClose` (Android Back) calls `onClose` and nothing else; a Toast calls `onDone` after 2600 ms (fake timers) and not before; `Tabs` calls `onChange` with the pressed tab.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** Run — PASS.
- [ ] **Step 5: Commit** `feat(mobile): sheets, tabs, toasts and pickers, Back closing the sheet`.

### Task 10: Stepped motion

**Files:**
- Create: `apps/mobile/src/ui/motion.ts`, `apps/mobile/src/ui/motion.test.ts`, `apps/mobile/src/ui/animations.tsx`

**Interfaces:**
- Produces: `stepped(t: number, steps: number): number` (CSS `steps(n, end)`: `Math.floor(t * steps) / steps`, 1 at t = 1); `KEYFRAMES: Record<'rise' | 'blink' | 'reveal' | 'fall' | 'alarm' | 'fly' | 'pop' | 'sink' | 'spark' | 'medal' | 'tear' | 'page' | 'light' | 'paper' | 'glint' | 'holo' | 'legend', { ms: number; steps: number | null; loop: boolean }>`; `useReducedMotion(): boolean` (OS `AccessibilityInfo` or the game's setting); hooks `useRise()`, `useBlink()` and the rest as Reanimated styles stepping with `stepped`; `useCountUp(target, ms = 900)` with ease-out cubic.

- [ ] **Step 1: Write the failing tests:** `stepped(0.24, 4)` is 0, `stepped(0.26, 4)` 0.25, `stepped(1, 4)` 1; `KEYFRAMES` matches every `animation:`/`--animate-*` declaration of `globals.css` in duration and step count (parse the CSS); with reduced motion, `useRise` starts at its end state.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** Run — PASS.
- [ ] **Step 5: Commit** `feat(mobile): animations that step as the web's do, and stand still when asked`.

### Task 11: Sound

**Files:**
- Create: `apps/mobile/scripts/sounds.ts`, `apps/mobile/scripts/sounds.test.ts`, `apps/mobile/assets/sounds/*.wav` (generated, committed), `apps/mobile/src/ui/sound.tsx`

**Interfaces:**
- Consumes: the web's score in `apps/web/src/ui/sound.ts` (`SCORE`, lines 62-140): read it without changing the web (import the module in Node; if it is not exported, parse it as data in the script).
- Produces: one WAV per cue (19: `tap`, `card`, `pick`, `coin`, `refuse`, `round`, `good`, `bad`, `promote`, four badge tiers, `million`, `escape`, `bankrupt`, `crisis`, `calm`, `end`), 22 050 Hz mono 16-bit, rendered with the web's oscillators (square, triangle, sawtooth, noise), master volume 0.5, 8 ms fades at note edges; `<SoundProvider muted>` and `useSound(): (cue: Cue) => void` with expo-audio; `onTap` for the kit.

- [ ] **Step 1: Write the failing tests:** the script writes 19 files named by cue; each WAV's length equals its score's length in samples; peak amplitude ≤ 0.5 of full scale; the first and last 8 ms ramp from and to 0.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** Run — PASS.
- [ ] **Step 5:** In the simulator, tap a Button: the `tap` cue plays. **Step 6: Commit** `feat(mobile): the web's chiptune cues, rendered once and played natively`.

### Task 12: Words, navigation, the store and the app shell

**Files:**
- Modify: `apps/mobile/src/polyfills.ts` (formatjs polyfills replace the spike's `formatToParts`), `apps/mobile/package.json` (`main: expo-router/entry`)
- Delete: `apps/mobile/App.tsx`, `apps/mobile/index.ts` (spike screen); keep `src/kvStore.ts`
- Create: `apps/mobile/src/app/_layout.tsx` (fonts, providers, `Page`), route files `index.tsx`, `new.tsx`, `play.tsx`, `challenge.tsx`, `collection.tsx`, `records.tsx`, `rankings.tsx`, `room.tsx`, `player.tsx`, `legal.tsx` (each a placeholder titled with its web words), `apps/mobile/src/game/context.tsx`, `apps/mobile/src/game/words.test.ts`

**Interfaces:**
- Consumes: `@ratrace/i18n` (`messagesFor`, `LOCALES`), `formatFor`, `ResilientStore`, `LocalSessions`, `KvStore`.
- Produces: `<GameProvider>` wiring `ResilientStore(new KvStore())`, `LocalSessions` and the round store of `@ratrace/core/game/store` as the web's `game/context.tsx` does for a device with no cloud; `useT(namespace)` (use-intl with the web's messages), `useWords()`, `useGame(select)`; the locale from the phone (`expo-localization`), else `en`, and the profile's choice when set.

- [ ] **Step 1: Write the failing tests:** `formatFor('es').money(1234567)` is the same string in this test (Node) as the web gives, and on the polyfilled path (`formatToParts` removed before loading the polyfills) too; a plural message renders "1 jugador" and "3 jugadores" through `useT`.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement; polyfills load first (`@formatjs/intl-getcanonicallocales`, `intl-locale`, `intl-pluralrules`, `intl-numberformat`, `intl-datetimeformat` with en, es, ru data). **Step 4:** Run — PASS.
- [ ] **Step 5:** In the simulator, every route opens from a list on the home placeholder, and money reads "12.346 $" in Spanish, not "US$". **Step 6: Commit** `feat(mobile): routes, words, the phone's store and the game's context`.

### Task 13: The kit, side by side with the web (phase exit)

**Files:**
- Create: `apps/mobile/src/app/kit.tsx` (development only), `apps/web/src/app/[locale]/kit/page.tsx` (this branch only), `apps/mobile/scripts/kit-shots.ts` (Playwright at 390 × 844 on the web kit page), `docs/superpowers/reports/2026-10-xx-phase-1-parity.md`

**Interfaces:**
- Consumes: every component of Tasks 3–11 and the web's `ui/kit.tsx`, `overlay.tsx`, `Picker.tsx`, `Sprite.tsx`, `RatAvatar.tsx`.
- Produces: both pages show, in the same order and with the same contents: each Button variant (normal, pressed, disabled), Tile, Panel with and without title, Tag tones, Well, Stat (pressable and not, at 300 and 360 wide), Bar gold and teal with door, TickerBadge kinds, Segmented, Toggle on and off, Row, KeyFigure tones, a Sheet open (gold and wine), Tabs, a Toast, a Picker, sprites at scale 1/2/3 and a silhouette, a RatAvatar in each size, pixel and reading text in es and ru, the dotted page.

- [ ] **Step 1:** Build both pages. **Step 2:** Take the web screenshots with the script and the app's with the simulator (same scroll positions). **Step 3:** Put them side by side in the report; list every difference larger than a pixel or a shade; fix each in the owning component (a test where a rule can be stated) and take the shots again. **Step 4:** Done when the report lists no difference; the user sees the report. **Step 5: Commit** `test(mobile): the kit beside the web's, matched pixel for pixel`.
