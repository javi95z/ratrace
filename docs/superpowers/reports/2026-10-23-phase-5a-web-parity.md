# Phase 5a: the app's web beside the Next web

The report of phase 5a's last task: the app's own web (the Expo app built for the browser, `.web.ts(x)` twins of the phone's files) shot scene by
scene beside the Next web, in the same browser, every difference fixed in the web's twins or accepted with its measured cause; a whole life begun
on the Next web and finished on the app's web; and the phone's own scenes shot again where the phase moved their drawing. Pictures and numbers live
beside it, in `phase-5a-web-parity/`. It is the sequel of `2026-10-21-phase-2-parity.md`, whose method it keeps.

## Method

The same scenes (`packages/core/src/testing/scenes.ts`, 93 of them), the same screen (the iPhone 16 Pro's 402 × 874 pt at 3×, safe areas 62 and 34),
the same comparison (`apps/mobile/scripts/kitCompare.ts`: raw, beyond a device pixel and a shade, a point away, text, shape), the same verdicts.
What is new is the other side: both shots are Chrome's now.

- **The Next web** is shot as before (`scene-shots.ts web`): its own `next dev` on 3021, started and stopped by the script with no project in its
  environment, `/<locale>/kit/scene?name=<scene>`, the browser kept from every host but this machine, the clock held at `SCENE_NOW`.
- **The app's web** (`scene-shots.ts appweb`) is the Metro already serving the app's web on 8091 (`EXPO_NO_METRO_LAZY=1 npx expo start --web --port
  8091` in apps/mobile, with no `EXPO_PUBLIC_SUPABASE_*`; `/scene` is `__DEV__` only), refused if nothing answers there. Each scene is opened at
  `http://localhost:8091/scene?name=<scene>&ready=8093` in the same Chrome, shaped like the same phone (`phonePage` in `shotDrivers.ts`), its clock
  held at `SCENE_NOW`; the shot waits for the scene to say it is ready (`readyServer`, as the phone's: drawn, every picture read), then a frame more
  (`NEXT_FRAME`: an `<img>` may paint a frame after the count of pictures reaches 0), then for the screen to stand still (`stillShot`, with twice the
  phone's tries: `APP_WEB_STILL_SHOTS`, below). The keyboard's focus ring a sheet takes when it opens with no tap is left out of both shots by the
  one rule (`QUIET_FOCUS`). A screen whose only motion is its loops turning (`Loop`'s strip) is one moment of them, as the Next web's shot is
  (`changedWithin`); any other motion fails the run, and the run says where it moved (`changedBox`).
- **Compared** by `scene-shots.ts compare --against=appweb`: the web's shot (in `phase-2-parity/`, where the phone's comparison reads it) beside the
  app's web's (`phase-5a-web-parity/<scene>-appweb.png`), the picture of what is unlike (`<scene>-appweb-diff.png`) and the line of each scene in
  `phase-5a-web-parity.json`. The phone's results file is never written by it. The app's web is judged by its own records (`ACCEPTED_APP_WEB`,
  `APP_WEB` in `sceneShots.ts`): a residual of the phone's (iOS's emoji, Skia's antialiasing, device pixels) is no record here. And it has no
  lines in other words: the app's web says the Next web's words (below), so every scene is judged whole.

```
cd apps/mobile && EXPO_NO_METRO_LAZY=1 npx expo start --web --port 8091          # the app's web, offline
pnpm --filter @ratrace/web exec tsx ../mobile/scripts/scene-shots.ts web appweb compare --against=appweb [--only=a,b]
```

## What the shots found, and what was fixed

The first full run had no scene clean: everything below the first line of text stood lower, text and pictures alike. Each cause was measured in the
page (computed styles and boxes of the same words on both webs), fixed in the web's twins or in shared code with the phone unchanged, and the scenes
shot again. In the order they were found:

| Found | Cause, measured | Fix |
|---|---|---|
| Every page drew under the notch. | Expo's page template has no `viewport-fit=cover`, and expo-router's web provider gives every screen zero safe areas (its `SafeAreaProvider.js`). | `public/index.html` (the Next web's viewport and theme colour); `ui/SafeArea.web.tsx` measures `env(safe-area-inset-*)` with the library's own provider. |
| An error toast over Play. | react-native-web's `BackHandler` logs an error each time a screen listens to it. | `ui/hardwareBack(.web).ts`: Android's Back on the phone, nothing on the web. |
| Every paragraph a pixel taller a line. | react-native-web leaves a text's box in the browser's default font round its runs, and Chrome sets each line from both (the guide's five lines were 5 px taller). | `ui/strut.web.ts`: the box in the stack's first face at its drawn size. |
| A title's line 3 px taller where a span runs on in it (the life chosen: "Nurse · Lucía"). | The span inherited the title's line, in another face; the Next web's span has its own (`text-[13px]`: 1.25). | The span set in its face with its classes' line (`strut(…, line)`). |
| A Russian paragraph's lines up to a point apart each. | Each run of a fallback face (Cyrillic in Exo 2) is a span of its own, an inline box set from its own face; the Next web's fallback is inside one element. | `RUN_LINE`: a run takes no line of its own on the web. |
| The dice of "At random" 3 pt narrower. | Chrome scales an emoji under `font-size-adjust` by Jersey's small letters (1.37455 × its size, measured at 1000 px), iOS by 1.103. | `ui/emojiHeight(.web).ts`. |
| A list drifted a device pixel in six rows. | The Next web's lines are ratios of the size, laid out at the 1/64 px below (12 px × 1.45 → 17.390625); react-native-web writes lines in pixels, laid out at the nearest 1/64 (17.40625). | `cssLine`: the line cut to the 1/64 below on the web. |
| A blue frame round every sheet. | The modal is focused as it opens: Chrome's `:focus-visible`, which the Next web's shot already left out. | The shots' `QUIET_FOCUS` on both sides; and the page's own ring is the Next web's gold one (`public/index.html`). |
| Every glyph a little heavier. | The Next web's body is `-webkit-font-smoothing: antialiased`. | `public/index.html` takes the Next web's body: smoothing, no selection, no tap flash, no rubber band, `text-size-adjust`, `color-scheme: dark`. |
| A legendary card's picture under a veil. | react-native-web's View is `z-index: 0`: the box laid over a sprite isolated the rainbow's `mix-blend-mode: overlay` from the picture. | `Sprite.web.tsx`: what is laid over a picture is a plain box. |
| "See the challenge ranking" underlined 1.67 pt off. | The phone draws its underline by hand; Chrome's goes round the descenders at the font's place. | `ui/LinkText.web.tsx`: CSS underline (`offset` or `'auto'`). |
| The ✎ of a name another pencil; a bold ✕ thin. | Named Zapf Dingbats, Chrome drew Zapf's pencil; through the Next web's stack (Arial, system-ui) it picks Lucida Grande's (`CSS.getPlatformFontsForNode`). The Next web's ✕ is `font-bold`. | `ui/systemFace.web.ts`: the system's signs set through Arial, system-ui, bold in a bold text. |
| The rat's choices 0.3 pt high (phase 2's unexplained editor residual). | react-native-web tells a layout in whole pixels (`offsetTop`): the grid under its heading (14.296875 + 6) was placed at 20, not 20.296875. | `ui/layoutTop(.web).ts`, used by the editor's grids. |
| The rat's body cut on other pixels. | The clip, a mask, was scaled pixel for pixel; the Next web's mask is smooth. | `RatAvatar.web.tsx`: no `image-rendering` on the mask. |
| The web said "update the app", "this phone", and the phone's legal notice. | The phone's own words (`phone.*`). | `game/ownWords(.web).ts`: on the web the Next web's (`home.*`, `common.notSaved`, `play.moved`, `legal`). |
| The paper's rows one or two device pixels off, each by its own amount, under the guide's note or a room's slot (`play-guide-r1` 241 px, `room-playing` 99), never under nothing (`play-news-r1`). | Measured with `getBoundingClientRect`, every line of both pages stands at the same place to 0.001 px. The paper sits under a block of a fractional height (576.484 pt). The Next web's paper is thrown by a CSS animation that keeps its last frame (`animate-paper`, `both`), and Chrome keeps such a box a layer of its own, rastering its lines against the layer. The app's paper ends on a still transform, which Chrome rasters with the page. With the layer forced in the page, the paper's unlike pixels fell from 34 532 to 5 024. | `ui/keptLayer(.web).ts`: `will-change: transform` on the paper on the web (241 → 4 px, 99 → 9). |
| A workplace's screens, a banner, never still. | A `Loop` plays on both webs; Chrome now and then rasters a picture at a scale that is not whole on other pixels for one shot, nothing of the page changed. | The loops' boxes are allowed to turn (`changedWithin`); twice the tries to stand still. |

## Results

Two full runs of `appweb compare --against=appweb` over the 93 scenes, one after the other (`scene-shots.ts`, the app's web served by Metro on 8091,
the Next web's shots of the same day): both exit 0, with the same numbers. **73 clean, 20 accepted** (their records in `ACCEPTED_APP_WEB`, below), none
moving, none in other words. Every line of text of every scene stands within a point of the Next web's (the worst 1 pt), but the arrow of `end-ru`
(below). The raw share (any pixel unlike, by any amount) is near 12 % on a plain page: the ground's weave of dots, the Next web's radial gradient
against the app's `dots.png` tile, a shade apart; nothing of it is beyond a device pixel and a shade. The table is the comparison over the Next web's
shots kept in `phase-2-parity/` (below), after the paper's layer was mended (`play-guide-r1`, `room-playing`): the two runs' numbers but those two
and `room-lobby-friends` (10, where the runs' web shots gave 5).

| Scene | Verdict | Raw % | Shape px | Text lines (one shot only) | Worst pt |
|---|---|---|---|---|---|
| home-new | clean | 11.93 | 0 | 15 (0) | 0 |
| home-continue | clean | 12.53 | 0 | 15 (0) | 0 |
| home-settings | clean | 0 | 0 | 29 (0) | 0 |
| home-lost-newer | clean | 10.41 | 0 | 17 (0) | 0 |
| new-first | clean | 12.61 | 0 | 25 (0) | 0.67 |
| new-unlocked | clean | 10.52 | 0 | 32 (0) | 0.67 |
| new-locked | clean | 2.84 | 0 | 65 (0) | 0.33 |
| new-replace | clean | 0.01 | 0 | 31 (0) | 0 |
| play-news-r1 | accepted | 3.68 | 4 | 42 (0) | 0.33 |
| play-cards-r1 | clean | 5.95 | 0 | 42 (0) | 0.33 |
| play-cards-legendary | clean | 9.72 | 0 | 35 (0) | 0.33 |
| play-cards-three | clean | 6.33 | 0 | 40 (0) | 0.33 |
| play-cards-ru-360 | clean | 8.47 | 0 | 37 (0) | 0.33 |
| play-finance-r6 | clean | 3.92 | 0 | 52 (0) | 0.33 |
| play-outcome-r1 | clean | 10.1 | 0 | 31 (0) | 1 |
| play-resolve-r6 | accepted | 5.75 | 3 | 41 (0) | 0.33 |
| play-news-r6 | accepted | 3.67 | 1 | 41 (0) | 0.33 |
| play-guide-r1 | accepted | 3.69 | 4 | 42 (0) | 0.33 |
| play-fault | clean | 15.55 | 0 | 6 (0) | 0 |
| play-pageturn | accepted | 3.64 | 365 | 51 (0) | 0.33 |
| finance-basket | clean | 0.04 | 0 | 56 (0) | 0 |
| finance-pension | clean | 0.03 | 0 | 68 (0) | 0 |
| finance-tabs-ru-360 | clean | 5.97 | 0 | 51 (0) | 0.33 |
| finance-market | clean | 4.02 | 0 | 61 (0) | 0.33 |
| finance-buy-stock | clean | 0.04 | 0 | 83 (0) | 0.33 |
| finance-property | clean | 4.04 | 0 | 40 (0) | 0.33 |
| finance-debt | clean | 6.99 | 0 | 36 (0) | 0.33 |
| hud-news-r1 | accepted | 15.57 | 4 | 20 (0) | 0.33 |
| hud-cash | clean | 0.03 | 0 | 30 (0) | 0 |
| hud-flow | clean | 0.03 | 0 | 32 (0) | 0 |
| hud-race | clean | 0.06 | 0 | 36 (0) | 0 |
| hud-status-ru | clean | 0.26 | 0 | 44 (0) | 0.33 |
| hud-jailed | clean | 0.03 | 0 | 33 (0) | 0 |
| hud-crisis | clean | 16.3 | 0 | 21 (0) | 0.33 |
| hud-crisis-details | clean | 0.03 | 0 | 33 (0) | 0 |
| amount-savings | clean | 0.03 | 0 | 30 (0) | 0 |
| celebrate-legendary | clean | 0.04 | 0 | 24 (0) | 0 |
| celebrate-earned | accepted | 13.24 | 230 | 27 (0) | 0.33 |
| challenge-practice | clean | 9.64 | 0 | 15 (0) | 0 |
| legal | clean | 19.12 | 0 | 34 (0) | 0 |
| finance-lifestyle | clean | 3.97 | 0 | 47 (0) | 0.33 |
| finance-move | clean | 0.09 | 0 | 72 (0) | 0 |
| play-cards-city | clean | 0.03 | 0 | 50 (0) | 0 |
| work-panel | clean | 4.66 | 0 | 33 (0) | 0.33 |
| finance-shop | clean | 4.78 | 0 | 50 (0) | 0.33 |
| finance-item | clean | 0.04 | 0 | 71 (0) | 0 |
| finance-taxes | clean | 3.94 | 0 | 48 (0) | 0.33 |
| finance-business | accepted | 4.1 | 4 | 58 (0) | 0.33 |
| profile-r6 | accepted | 0.12 | 30 | 77 (0) | 0.33 |
| profile-owned | clean | 0.08 | 0 | 85 (0) | 0 |
| balance-r6 | clean | 0.07 | 0 | 90 (0) | 0 |
| rivals-r6 | clean | 14.88 | 0 | 20 (0) | 0.33 |
| end-escaped | clean | 4.54 | 0 | 24 (0) | 0 |
| end-bankrupt | clean | 4.54 | 0 | 25 (0) | 0 |
| end-share | clean | 0 | 0 | 29 (0) | 0 |
| end-ru | accepted | 5.33 | 0 | 25 (0) | 5.33 |
| moment-escape | clean | 0.03 | 0 | 52 (0) | 0 |
| moment-bankrupt | clean | 0.03 | 0 | 54 (0) | 0 |
| moment-crisis | clean | 0.03 | 0 | 56 (0) | 0 |
| records-empty | clean | 19.61 | 0 | 3 (0) | 0 |
| records-three | clean | 10.52 | 0 | 28 (0) | 0 |
| records-detail | clean | 0 | 0 | 42 (0) | 0 |
| collection-items | clean | 7.74 | 0 | 14 (0) | 0 |
| collection-badges | clean | 7.92 | 0 | 29 (0) | 0 |
| profile-financed | clean | 0 | 0 | 95 (0) | 0 |
| settings-account-guest | clean | 0.01 | 0 | 31 (0) | 0 |
| settings-account-member | clean | 0 | 0 | 35 (0) | 0 |
| home-offer | clean | 0 | 0 | 29 (0) | 0 |
| home-account-taken | clean | 9.9 | 0 | 18 (0) | 0 |
| rankings-all | clean | 5.95 | 0 | 63 (0) | 0.33 |
| rankings-week | clean | 9.58 | 0 | 45 (0) | 0.33 |
| rankings-friends | accepted | 6.24 | 17 | 47 (0) | 0.33 |
| rankings-challenge | clean | 7.49 | 0 | 43 (0) | 0 |
| rankings-nickname | clean | 5.72 | 0 | 54 (0) | 0.33 |
| player-member | accepted | 4.22 | 30 | 26 (0) | 0.33 |
| player-editor-body | clean | 8.47 | 0 | 7 (0) | 0 |
| player-editor-wear | clean | 1.9 | 0 | 10 (0) | 0 |
| player-editor-scene | clean | 8.47 | 0 | 8 (0) | 0 |
| player-friend-code | accepted | 4.23 | 30 | 27 (0) | 0.33 |
| home-member | clean | 7.69 | 0 | 20 (0) | 0 |
| challenge-attempt | clean | 7.35 | 0 | 18 (0) | 0 |
| challenge-played | clean | 8.14 | 0 | 18 (0) | 0 |
| end-standing | clean | 4.5 | 0 | 25 (0) | 0 |
| new-ranked | clean | 11.24 | 0 | 29 (0) | 0.67 |
| room-door | clean | 13.99 | 0 | 21 (0) | 0 |
| room-lobby-friends | accepted | 7.17 | 10 | 26 (0) | 0 |
| room-lobby-public | accepted | 7.55 | 9 | 25 (0) | 0 |
| room-join-code | clean | 13.23 | 0 | 7 (0) | 0 |
| room-playing | accepted | 3.78 | 9 | 43 (0) | 0.33 |
| room-loans | accepted | 3.84 | 17 | 50 (0) | 0.33 |
| room-resolved | accepted | 5.67 | 7 | 38 (0) | 0.33 |
| room-end | accepted | 4.19 | 17 | 45 (0) | 0 |
| room-history | accepted | 0.01 | 9 | 38 (0) | 0 |


## Residuals of the app's web: pictures at a fraction of a point

A picture laid at a fraction of a point (a rat in a row, the city's picture in the Hud, a card's glow ending) stands where the Next web's does to the
1/64 px on both sides (measured with `getBoundingClientRect`), and is drawn nearest-neighbour from its art: a few of its edge pixels are sampled on
the next device row. `rankings-friends` (17), `room-lobby-friends` (5 and 10 over the Next web's shots of one page, recorded 15), `room-lobby-public` (14), `room-loans` (17), `room-resolved` (7), `room-end`
(17), `room-history` (12): the rats. `play-news-r1` (4), `play-news-r6` (1), `hud-news-r1` (4), `play-resolve-r6` (3), `finance-business` (4): the
city's picture and a picture's edge. `celebrate-earned` (230): the last row of the light under the last card, the width of the page. `play-guide-r1` (4): the city's four pixels;
`room-playing` (9): a pixel of the city's picture and eight of the rats of the room's bar.

## Residuals of the app's web: the Next web's own

- The Next web's lit lamps of a career bar bleed a device-pixel sliver into the first dark lamp (phase 1's class); the app's web draws none:
  `profile-r6`, `player-member`, `player-friend-code` (30 each).
- The torn page of a turning round, held at one moment on both sides, has its edges antialiased a device pixel apart: `play-pageturn` (365).

## Residuals of the app's web: an arrow on a Russian page

`end-ru`: the way back, ←, 5.33 pt apart in ink, its shape clean. On a Russian page the Next web's stack names its fonts alone (`"Jersey 15", Oswald,
"Chakra Petch", "Exo 2", system-ui, sans-serif`: no Arial, its subsets have no ←), and Chrome draws the arrow from SF (`.SFNS`, said
`CSS.getPlatformFontsForNode`) at its own adjusted size, 22.36 wide; the app sets it, as on every page, from the system's fonts through Arial at
Jersey's scale (25.28), where on the other pages the two agree. Left: the per-language fallback of a sign and Chrome's per-font adjust are 5b's
to settle if the user wants the arrow exact on Russian pages.

## The phone, where the phase moved its drawing

Task 6 moved the phone's Skia drawings of the news page's rules, the Hud's gold rays and the life map's route into kit components (`ui/DashedRule`,
`ui/Rays`, `ui/RouteLayer`, with web twins). The phone's scenes were shot again on the iPhone 16 Pro simulator (iOS 18.0, Expo Go from the Metro
on 8090, `scene-shots.ts app compare`), with the scenes this task touched on the phone's side (Play's Back, the challenge's link, the rat's
choices, the screens that say the app's own words):

- **The news page's dashed rules**: `play-news-r1`, `play-news-r6`, `play-guide-r1`, `play-pageturn`, `room-playing`: each within its phase 2/3
  record, the same numbers (1443, 1443, 3453, 3897, 1551 shape px).
- **The Hud** (`hud-cash`, `hud-race`, `hud-status-ru`): clean. **The life's end** (`end-escaped` clean, `end-bankrupt`, `end-ru` within record).
- **The gold rays and the life map's route are on no scene's screen**: no scene's status reaches the rays' tier, and the map stands below the
  fold of every end (`[data-backdrop="rays"]` and the route's `svg` looked for in all 93 scenes on the app's web: none in view). Those two
  drawings are held by their own tests (`ui/Rays.test.tsx`, `ui/RouteLayer.test.tsx` and their web twins'), not by a shot.
- The rest: `challenge-*`, `player-*`, `home-*`, `legal`, `room-*`, `collection-badges`, `moment-escape`, `finance-move`,
  `settings-account-member`, `celebrate-legendary`: clean or within their records against phase 3's shots of the Next web (`room-history` measured 20 against
  the Next web's shots re-taken, 17 against phase 3's: the web's own jitter, below). `home-lost-newer` once never said
  it was ready in 60 s on the first route after Expo Go was opened fresh, and was ready and clean when shot again.

Then the phone comparison over the Next web's shots kept in `phase-2-parity/` exits 0 with the phone's records as phase 3 left them: the phone is
unchanged.

## A whole life in the browser

`apps/mobile/scripts/web-life.ts`, offline: the Next web is the shots' own `next dev` on 3021 (no project in its environment), the app's web the Metro
on 8091 (no `EXPO_PUBLIC_SUPABASE_*`), one Chrome kept from every host but this machine. Two ports are two origins, where the swap keeps one: the
Next web's records are copied into the app's web's origin before its first load. The last run (exit 0), step by step, its pictures in
`phase-5a-web-parity/`:

1. Next web (3021): a new life, the nurse, begun from the front door: round 1, its news (`life-1-next-round1.png`).
2. Next web: played to round 3, a press at a time (each card's first open choice, no orders), its news (`life-2-next-round3.png`).
   - Read from the 3021 origin with `page.evaluate`: IndexedDB `ratrace` v1, `currentGame` 1 record, `profile` 1, `runs` 0; of the inventory's
     localStorage keys (`ratrace.basket`, `ratrace:given-up`, `ratrace:refused`, `ratrace.lastAccount`) none was set (no orders, no account).
   - The life in progress: `0d1cae88-c8ef-4388-821b-767efca225fd`, round 3.
   - Written into the 8091 origin on a page of that origin that is not the app (`/seed`, answered by the script, never served), with the Next
     web's own schema (`apps/web/src/session/indexeddb.ts`): 2 records, 0 localStorage keys.
3. App's web (8091), offline: its page's environment, as Expo's development server fills `process.env`, names no `EXPO_PUBLIC_SUPABASE_*`
   (`projectNamed` in `scripts/webLife.ts`; a page with no such environment stops the run). The front door offers to continue the life
   (`life-3-app-home.png`).
4. Continue reaches round 3, its news (`life-4-app-round3.png`).
5. Played to the end (moments' buttons and any sheet closed as a player closes them), the end screen (`life-5-app-end.png`).
6. The records list the life, the nurse's (`life-6-app-records.png`); the 8091 origin keeps that finished life (`runs`: 1 record, its `runId` the
   saved game's id and its seed the same) and the same life, ended, as the one whose end the front door shows, as the Next web keeps it.

Every request either page made beyond this machine was noted: none from the app's web, and none from either page to a Supabase project (the run
stops on either); the Next web asked only va.vercel-scripts.com, its analytics, which the browser is kept from. The pages said nothing else (no page
error, no console error but that request's). Two earlier
runs found what the script then learned: a sheet over the game (closed now as a player closes it), and the records' items holding items of their
own (the life is checked by its words and in the store). One found a fault of the app's web, fixed: Play listened to Android's Back through
`BackHandler`, which react-native-web answers with a console error, shown in development as a toast over the bar of the next step.

## The same life on the export

The final fix wave (review I1) ran the same life on the export the site will serve instead of Metro's development server:
`pnpm --filter @ratrace/web exec tsx ../mobile/scripts/web-life.ts --export`. The run makes the export itself (`npx expo export --platform web`
into a temporary folder, with the size check's `exportEnv`: no `EXPO_PUBLIC_SUPABASE_*` nor Turnstile key), serves it on 8091 as a static
host serves it (`serveExport` in `scripts/webLife.ts`: any path that names no file is the app's page, `index.html`, so `/records` and `/play` load
the router; a file is served as itself with its type; a missing file is a 404, never the page), runs the same steps, then stops the server and
removes the folder. The release paths the development server never takes (`__DEV__` false, `NODE_ENV=production`, minified, the export's asset
paths for sprites and fonts) all ran. The last run (exit 0), its pictures `phase-5a-web-parity/life-export-<n>-*.png`:

1. Next web (3021): the nurse begun, round 1; played to round 3. Read from its origin: `currentGame` 1, `profile` 1, `runs` 0, no localStorage
   key. The life `8204bb97-f883-492f-b693-c01afd8d57d0`, round 3; 2 records written into the 8091 origin before its first load.
2. The app's web export (8091), built by the run with no project: the front door offers to continue the life (sprites, fonts and the
   rat drawn from the export's own asset paths); Continue reaches round 3; played to the end; the records list the nurse's life; the 8091
   origin keeps that finished life (`runs` 1 of 1, same id and seed) and the same life, ended, in `currentGame`.
3. The older rules: all 18 of `apps/web/public/rules` answered at `/rules/` with `200 text/javascript`, and `/rules/v0.30.0-1.30.0.js` loaded in
   the page as the game's loader loads it (a module of the page's origin, 14 exports).
4. Nothing left this machine from the export; the Next web asked only va.vercel-scripts.com (kept from it). Neither page threw nor wrote a
   console error.

Nothing broke in the export, so the wave fixed nothing in it. Offline, the release-only senders have nothing to send through: `track.ts` counts
through the cloud the account connected, and `watchErrors` is started only for a cloud with a project. The review recommends one export run on
the fake project (`scripts/fakeCloud.ts`) before the preview, so that they are seen sending to something. That run is 5b's.

## The Next web's shots, shot again

The comparison reads the Next web's shots in `phase-2-parity/`, where the phone's comparison reads them, and the `web` step writes them there. This
task took them again; of the fifteen that came out unlike phase 3's, only `legal` changed by what the Next web draws (its notice's words changed with
the merge of `dev`, `a0cf71f3`), and only `legal`'s new shot is kept. The fourteen others differed by a few pixels of their pictures (a banner drawn
pixel for pixel at a scale that is not whole, the rats of a row: the Next web's own shots of one page are not alike from one shot to the next), and
are phase 3's again, with their pictures of what is unlike and their lines in the phone's results. The phone's comparison over that folder
(`compare --only` those fifteen, the phone's shots unchanged) exits 0: every line as phase 3 left it but `legal` (shape 39283, within its
baseline's drift), and `room-history` at its record of 17. The app's web's comparison over the same folder exits 0 too (the table above).
The Next web's shots of one page jitter: `room-lobby-friends` against the app's web measured 5 and 10 px over its shots, and its record is the
most measured and as much again (`ACCEPTED_APP_WEB['room-lobby-friends']` 15, saying so). The phone's records are as phase 3 left them.

## Weight

`pnpm --filter @ratrace/mobile web:size`, offline: `web export: 1194 files, 20 app JS files 4.89 MB (1.17 MB gzip, budget 1.32), 0 wasm, 18/18 older
rules, 2836 sources` and `the web export is as light as it must be`. (The fixes of this task add no library: `react-native-safe-area-context`'s web
provider was already in the bundle.)

## For phase 5b

- **Words.** The app's web says the Next web's words where the phone has its own and the Next web has a counterpart (`game/ownWords.web.ts`).
  A room of another version has one (corrected by the final fix wave: this report said it had none): a started game on other rules says
  `room.otherRules` and a code turned away for another version `room.refused.other-version` ("reload the page"), and notices blocked say
  `settings.weeklyNoticeBlocked` (for this site, in the browser's settings), all through `useOwnT`. A word of the phone's with none stays the
  phone's on the web: a life's row's hint (`opensLife`, a neutral accessibility hint, which the Next web's rows do not have), and the share card's
  `shareFailed`, which the web never reaches (`ShareCard.web.tsx` says `share.failed`).
- **`onLayout` in whole pixels.** react-native-web reads a layout from `offsetTop`/`offsetWidth`; only the rat's choices read theirs to the
  fraction (`ui/layoutTop.web.ts`). No other scene showed it; a layout read to place something drawn (the coins' flight, a row's reveal) may be a
  pixel off on the web.
- **A sign on a Russian page** (the ← of `end-ru`, above).
- **The scenes on the development server only.** The scenes' shots ran on `expo start --web` (its `/scene` route is `__DEV__`). The whole life ran on
  both the development server and the export (`web-life.ts --export`, above), offline. The export has not yet run on the fake project (its
  release-only senders seen sending): that comes before 5b's preview.
- **Next.js's dev server** stopped now and then to recommend an upgrade of Next.js (a security notice of its own, in `.kit-shots/web-server.log`);
  the shots' driver starts it again, as it was built to. Nothing was upgraded: that is the user's call, on `dev`.

## Phase 5b Task P: content 1.48, the front door and the round's sticky figures

The app's web shot again beside the Next web after Task P (content 1.48 and the web's new front door and round header, ported; the scenes begun on
other seeds are listed in the phase 2 report's section of the same name). The fix of `play-outcome-r1` (the changes' line, `useInlineRow`) holds on
the app's web too: its views are flex boxes, not the browser's inline block.

- The Next web's lit lamps of the way-out bar bleed their sliver into the first dark lamp (profile-r6's class), 30 pixels, where the engineer's
  sixth round fills the bar to a lamp's edge: `play-finance-r6`, `play-news-r6`, `finance-market`, `-property`, `-lifestyle`, `-shop`, `-taxes`,
  `room-loans`, `room-playing`, and the career bar of `work-panel`.
- `end-bankrupt`: the legendary badge's line under its confetti, measured 1.33 pt from the letters left uncovered.
- Pictures at a fraction of a point (rankings-friends' class), where the new layout puts them: the member's rat on the profile's link at the
  unframed foot (`home-member`, 5), the rats of the room's bar and seats (`room-lobby-friends` 19, `room-lobby-public` 9 and 21 over two shoots,
  `room-end` 20, `room-playing` and `room-loans` 21 besides the lamps), the torn page (`play-pageturn` 376), a pixel at the foot of the member's
  profile (`player-member`, `player-friend-code` 31).
- Three scenes were "never still" in the first run (`play-cards-legendary`, `play-guide-r1`, `collection-badges`) with the machine busy shooting;
  shot again alone they were still: `play-guide-r1` within its record, the other two clean.
