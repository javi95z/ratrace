# The Rat Race as a native app (Expo)

Status: design, for review. Branch `expo` only, app in `apps/mobile`. Phase 0 (spike) passed on
2026-10-20.

## Intent

The player can install The Rat Race from Google Play now and from the App Store later, and play it
as a native app. It is **the same game with the same look**: the same pixel art, frames, colours,
fonts, screens, words and sounds as the web game at https://ratrace (`apps/web`). Someone who plays
both should not be able to tell which one they are holding, but for the store it came from.

Later, the same Expo code also builds the web and the installable PWA, and replaces the Next web
(phase 5). Until then the web and PWA keep working exactly as they do, untouched.

## Goals

- A native app (Expo, React Native) for Android, then iPhone, from one code base in `apps/mobile`.
- Visual and behavioural parity with the web, screen by screen, at phone size (390 pt wide).
- The game's logic is not rewritten: `@ratrace/engine`, `content`, `core`, `online` and `i18n` are
  imported as they are. The app is a new interface on the same packages, as `apps/web` is.
- The same account, server and saves: a player can begin a life on the web and go on in the app.
- Later (phase 5): the Expo web build reaches parity with the Next web, desk layout included, and
  replaces it on the same domain without losing anyone's saved game.

## Non-goals

- A new design, a "more native" look, platform widgets (Material, iOS controls) or rounded corners.
- Tablet or landscape layouts for the native app in phases 1–4 (portrait phone only; desk layout
  belongs to phase 5, for the web).
- Changing the game's rules, content or server behaviour for the app's sake, beyond what native
  sign-in and push strictly need (phase 3).

## Anti-goals (a failure even if it works)

- The app looks "inspired by" the web instead of identical: smoothed (blurry) pixel art, soft
  shadows, rounded corners, wrong font metrics, eased animations where the web steps.
- Any change on `dev` or to the web before phase 5 (the user's rule: the work stays on `expo`).
- A second copy of game logic in the app: anything that decides a rule, a price or a score lives
  in the packages, never in a screen (the web's `architecture.test.ts` rules apply to the app too).
- A save that cannot be read by the other client (web ↔ app), or a life interrupted by an update.

## Constraints

- Expo SDK 58, React Native 0.88, React 19.3 (same React as the web), Hermes. pnpm isolated
  workspace; no Metro config needed (proven in phase 0).
- Expo Go only while every native module used is in Expo Go; a development build (EAS) once one is
  not (masked view, Skia, audio if needed).
- Test devices: the iOS simulator on this Mac (Xcode 26.6) now; an Android emulator to be installed
  (≈6–8 GB, the user's approval asked first) when Android-only work starts (sign-in, push, store).
  The user has no Android phone.
- Hermes gaps found in phase 0: no `crypto` (expo-crypto fills it); no
  `Intl.NumberFormat.formatToParts`; `currencyDisplay: 'narrowSymbol'` ignored ("US$" for "$").
  The app loads the formatjs Intl polyfills (NumberFormat, PluralRules, DateTimeFormat, with en, es,
  ru data) before anything else, so `formatFor` and ICU plurals give the web's exact strings.
- Work on branch `expo`, worktree `.worktrees/expo`. Rebase on `origin/dev` regularly so the
  packages stay current; never merge into `dev` without the user asking.

## Decisions taken with the user

- Expo (React Native), not a TWA or Capacitor.
- One Expo code base for Android, iPhone and, later, the web.
- The web stays on Next until the Expo web equals it; then it is swapped.
- The look and design are the same as the web's: this document's parity rules are a hard
  requirement.
- Work on a branch of its own, `expo`, without touching `dev`.
- The app is **The Rat Race** in the stores, with the identifier `com.hackio.theratrace` (Android
  package and iOS bundle id). It is permanent once uploaded.
- Analytics in the app: the same eight events as the web (`apps/web/src/pwa/events.ts`), with the
  same rule (never an id, a name or a score), sent to the game's own Supabase project, with no third
  party: a table only the server writes and a function the app calls, as the error reports do.

## How the look is kept the same

The web's visual system is small and exact. Everything below is taken from `apps/web/src/app/globals.css`
and `apps/web/src/ui/*`; the web stays the reference, and the app copies its numbers.

**Tokens.** The 31 colours of `globals.css:10-58` (night, sky, wine, gold, teal, skin, wood, ink,
cream, white), the four fonts, the font sizes in pixels, the 4 px spacing scale and 2 px frame edges,
in one theme module of the app (`apps/mobile/src/theme.ts`). A test reads `globals.css` and fails if
any colour or the frame width differs, so the two cannot drift.

**Fonts.** Jersey 15 (titles, figures), Chakra Petch 400/600 (reading), Oswald 500 and Exo 2
400/600 for Cyrillic, loaded with expo-font from the Google Fonts packages. The web's `pixel` class
uses `font-size-adjust: 0.56`; React Native has none, so every Jersey size is scaled by the factor
the share card already computes (`PIXEL_X_HEIGHT` in `@ratrace/core/game/share`). Body 15 px,
line height 1.45, cream; letter spacing 0.03 em on pixel text; no text selection.

**Frames.** The web draws every box with hard (unblurred) 2 px box-shadows that leave the four
corner pixels empty: `frame`, `bevel`, `sunk`, `frame-raised` (with its 4 px drop), `lamp`,
`frame-double`, `tab`, and the colour sets `frame-gold`, `frame-cream`, `frame-wine`. The app has
one component per utility, built from Views and 2 px strips, taking the same colour variables
(`frame`, `hi`, `lo`, `ring`). No React Native `borderRadius`, `shadow*` or `elevation` anywhere.

**Background.** The 6×6 dot pattern (night-700 dot on night-800) as a repeated tile. Safe areas as
the web: the top inset painted night-900, the bottom action bar padded by the inset.

**Pixel art.** Sprites come from `art/clean` (the same files the web serves), copied into the app's
assets by a script like `apps/web/scripts/sprites.ts`. React Native smooths scaled images, which
blurs pixel art; the script therefore also writes nearest-neighbour copies at 2× and 3×, so the
device only ever scales down or not at all. `<Sprite id scale>` keeps the web's API (scale 1, 2, 3,
`'art'`) and the manifest's sizes. Silhouettes and the rat's body clip need masks: masked-view, or
masks baked into the copies by the script (the builder chooses, keeping the result identical).

**Kit.** Every component of `apps/web/src/ui/kit.tsx`, `overlay.tsx` and `Picker.tsx` is ported with
the same props, variants and pixel values: Button (primary, secondary, danger, quiet; 17 px pixel
label, 44 pt minimum, 2 px press-down, 45 % when disabled), Tile, TabTitle, Panel, Tag, Well, Stat,
Bar (16 lamps, door), TickerBadge, Segmented, Toggle, Row, KeyFigure, Sheet (dimmed backdrop
night-900 at 80 %, rise animation, Android back closes it), Tabs, Toast, Picker, Face, Sparks,
RatAvatar (layers back to front: backdrop, body clipped by the outfit, face, outfit, eyes, hat).

**Motion.** The web animates in steps (`steps(n)`), never eased. Each keyframe of `globals.css`
(rise, blink, reveal, fall, alarm, fly, pop, sink, spark, medal, tear, page, light, paper, glint,
holo, legend) is ported with Reanimated using the same duration and number of steps. The card swipe
(motion in `Cards.tsx`) becomes Gesture Handler + Reanimated with the same thresholds (90 px, ±6°
over ±160 px, elastic 0.6). Reduced motion follows the OS setting and the game's own setting, as on
the web. Number count-ups keep `useCountUp`'s 900 ms ease-out (the one eased motion the web has).

**Sound.** The web synthesises its 19 chiptune cues with WebAudio from a score
(`apps/web/src/ui/sound.ts`). A script renders the same score to small WAV files once; the app plays
them with expo-audio, at the same volume, on the same cues (`cuesFor`, the tap on anything
pressable).

**Drawings.** The share card (canvas from `DrawOp`s) and the three charts (route map, net-worth
bars, price line) are drawn natively with crisp edges (Skia or react-native-svg; the builder
chooses), from the same data the web uses.

**Proof of parity.** Each ported screen is checked against the web at 390 × 844: the same state
(same seed, same life, same round) shown in both, screenshots side by side, differences listed and
fixed before the screen counts as done. The phone layout of `Play` (HUD with its sticky stats and
bar, the stage, the bottom action bar, Finance sub-tabs sticking below the HUD) is matched exactly.

## How the app is built

- `apps/mobile` mirrors `apps/web/src`: `game/` (a context that wires session, store and cloud, as
  `game/context.tsx` does), `game/screens/` (one file per web screen, same name), `ui/` (the kit).
  Screens reach the game only through `GameSession` and the stores of `core`, never the engine's
  moves: the web's architecture rules, enforced by an equivalent test.
- Navigation with Expo Router, with the web's routes: `/`, `/new`, `/play`, `/challenge`,
  `/collection`, `/records`, `/rankings`, `/room`, `/player`, `/legal`. In phase 5 the locale prefix
  (`/en`, `/es`, `/ru`) is added for the web.
- Words: the messages of `@ratrace/i18n` through use-intl (the ICU engine next-intl itself uses), so
  every key and plural is the web's. The language follows the account and the phone, as on the web.
- Saves: `KvStore` (a `PlayerStore` over expo-sqlite's key-value store, phase 0), in the same shape
  the web keeps in IndexedDB, behind `ResilientStore`, as on the web.
- The cloud: `@ratrace/online` as the web wires it in `online/index.ts`, with a native sign-in for
  Google (deep link back into the app) and native push (FCM on Android, APNs on iPhone) in phase 3.

## Phases and what ends each

0. **Spike.** Done: the packages run on Hermes; a whole life is played, saved and reopened.
1. **Foundations.** Theme, fonts, frames, background, Sprite with crisp scaling, the whole kit,
   navigation, words, store, sound, motion primitives. Ends when a kit screen (every component in
   every variant) matches the web's components side by side.
2. **Solo game.** Home, new life, play (news, cards with swipe, outcome, finance with its tabs,
   resolve), end, records, collection, profile and rat, settings. Ends when a whole life can be
   played by hand in the app, every screen passing the parity check, and the first internal build
   installs on the simulator (and on the Android emulator once installed).
3. **Online.** Guest account, Google sign-in, cloud saves, ranked lives, the weekly challenge,
   rankings, friends, games with others (Realtime), push, analytics (the eight events to the game's own Supabase), error reports. Ends when a
   life begun on the web is finished in the app and the reverse.
4. **Google Play.** Account deletion in the app and by URL, data safety form, content rating, store
   listing from the game's art, the closed test (12 testers, 14 days), release.
5. **The web on Expo.** Desk layout, locale URLs, PWA with its offline cache and service worker
   rules, legal pages, sitemap and share image, saves moved from IndexedDB, analytics; then the swap
   on Vercel, with the user's go-ahead.
6. **iPhone.** Sign in with Apple if required, App Store review, release.

## Calls made by the designer (not asked of the user; the user may overrule)

- **Rules of other versions.** The web loads the rules of older versions from `/rules/*.js`. The
  app carries every shipped bundle (`apps/web/public/rules`, from `pnpm online:bundle`) in its own
  assets and evaluates them on Hermes the way `rulesFromSite.ts` does in the browser, so any life
  begun under older rules is finished under them. A life begun under rules newer than the
  installed app is not opened: it waits, with the "made by a newer version" notice the web already
  has (`Lost: 'newer'`), and the player is asked to update. To keep that gap short, the app's
  JavaScript follows `main` through EAS Update (over the air, no store review); a store release is
  needed only when native code changes.
- **Guest sign-in guard.** Where the project asks for a CAPTCHA (Turnstile) on guest sign-in, the
  app shows the same Turnstile in a WebView and hands its token to `@ratrace/online`, as the web
  does. No auth configuration changes.
- **Solo game first, offline.** Phase 2 plays fully on the phone with no account; the account and
  everything online come in phase 3.
- **Testing against the live project.** As with the web in development, the simulator is a guest on
  the live Supabase project; tests make and remove only their own rows, as the repository's rules
  already say.
- **How parity is proven.** On the `expo` branch only, never merged before phase 5, the web gets a
  page that shows every kit component in every variant, and a way to open a screen on a fixed seed,
  life and round (the e2e build's memory services already allow it). Playwright takes the web
  screenshot at 390 × 844; the iOS simulator takes the app's; both go side by side in the phase's
  review. The web the players use is unchanged.
- **A moving web.** Parity is measured against `dev` as it is when a screen is ported. On every
  rebase, the web screens and kit files that changed since the last one are listed and brought over
  in the same pass, before new screens.
- **Push.** Through Expo's push service (it speaks FCM and APNs), sent from the existing notice
  functions beside web push; the app registers its Expo push token where the web stores its
  subscriptions.
- **Accounts the user creates, when their phase comes:** Expo/EAS (phase 1, builds and updates),
  Firebase project for FCM and the Google OAuth client for the app (phase 3), Google Play developer
  (phase 4, 25 $ once), Apple developer (phase 6, 99 $ a year). Nothing is created on the user's
  behalf.

## Left to the builder

- Masks: masked-view or baked masks; Skia or react-native-svg for drawings; how WAVs are rendered.
- The exact component structure of frames, as long as the pixels match.
- Test tooling for the app (jest-expo or vitest with react-native-web), as long as the repo's
  `pnpm -s test` keeps running everything.
- The order of screens within a phase.
