# Phase 2 parity: the solo game beside the web's

The report of phase 2's pixel comparisons. It is the sequel of `2026-10-20-phase-1-parity.md`: the same screen (an iPhone 16 Pro,
402 × 874 pt at 3×, safe areas 62 and 34), the same two shots (the web by Playwright's Chrome, the app by Expo Go on the booted
simulator), the same comparison (`apps/mobile/scripts/kitCompare.ts`: *raw*, *beyond* a device pixel and a shade, *a point
away*, *text*, *shape*), the same tool (`kit-shots.ts`). Pictures and numbers live beside it, in `phase-2-parity/`
(`<section>.png`: the web, the app and the difference side by side; `numbers.json`); phase 1's stay in `phase-1-parity/`, untouched. A
section goes to the report of the phase that added it (`reportFolder` in `kitCompare.ts`).

Each task of the phase that draws something adds its rows here. Rows so far: the kit's motion section (task 4) and the scenes of the front
door, the week's challenge and the legal notice (task 6, below). Scene rows (one game state drawn by both clients) follow with the screens.

## Scenes: one game state, drawn by both clients

A scene is a named game state (`packages/core/src/testing/scenes.ts`: `SCENES`, `sceneStore(name)`): a life begun on the fixed seed and
played with the content's `saver` bot, through the round store, to a round and a stage; the same save on both clients (the ids, seeds and
clock of every screen's tests, `session/fixed.ts`). The web draws it at `/<locale>/kit/scene?name=<name>`, the app at `/scene?name=<name>`
(development only); a scene's first word (`screenOf`) names the screen it is drawn on (`play-finance-r6` on Play), and each client's registry
hands that screen the scene, so a sheet the scene names (`scene.sheet`) is the screen's to open, never a tap.

- **A round in a name is the player's:** `r6` is the sixth round, `view.round` 5. A life saved at the cards can only be saved after a card is
  answered (a game opens a hand left half answered on its next card), so `play-cards-r1` has one card answered and shows the second.
- **Scenes a save cannot hold.** The result of a card and the ledger of a round are only on screen until the player goes on, so a scene may
  have `then`, the steps the player takes once the game is open on the save (`runScene`: one core function, run on the booted round store by
  both clients, with the saver's choices), and `ends`, the stage they come to. `play-outcome-r1` is the first card of the first round answered;
  `play-resolve-r6` is the sixth round played. The screen is drawn after the steps, so it is first drawn at that stage on both clients, and the
  web page marks itself (`data-scene`) only then.
- **The day is fixed.** Every scene is drawn on `SCENE_NOW`, Thursday 22 October 2026, noon UTC, three and a half days from either edge of its
  week. The web's shot holds the browser's clock at it (`page.clock.setFixedTime` before the page loads, and reads `Date.now()` back); the
  app's scene services answer it as `Services.now`, which a screen reads through `useClock()` (the phone's own clock everywhere else). The
  Home's weekly challenge and its "3 days left" are then the same in every shot, on any day.
- **The browser is kept from the project.** The web's layout wraps every page in the real `GameProvider`, which opens the browser's database
  and, with the project's address in its environment, asks the cloud who is playing. The shots never let it: the dev server is started by the
  script with that address blank, one already answering on port 3021 is refused (not reused), and the browser is a context in which every
  request and socket to any host but this machine is aborted and service workers are blocked (`guardedContext` in `shotDrivers.ts`, the kit's
  shots too). The run says which hosts it kept the browser from (only `va.vercel-scripts.com`, the analytics script, so far).

`scene-shots.ts [web] [app] [compare] [--only=a,b]` writes `<name>-web.png`, `<name>-app.png` and, for a scene that is compared, `<name>-diff.png`
here, and a line per scene in `phase-2-parity.json`: its verdict (`clean`: no shape differs, no text in one shot only, every line within a
point; `differs`: read the numbers) and its numbers. As the kit's shots do, a comparison with more than half the screen unlike stops the run
(`wrongPage` in `kitCompare.ts`, shared): that is the app showing something else, and its numbers are not results.

**Unjudged.** While the app draws phase 1's stand-ins for a screen (`STAND_INS` in `sceneShots.ts`, which a test holds equal to the stand-ins
of the app's registry), its scenes are shot but not compared: their line is `"verdict":"unjudged"` with no numbers, and no diff picture is
kept. The task that ports a screen takes its word out of `STAND_INS`, and its scenes are compared from then on. Task 6 ported `home`, so its
scenes are compared; the five `play-*` scenes of task 5 (`play-news-r1`, `play-cards-r1`, `play-finance-r6`, `play-outcome-r1`,
`play-resolve-r6`) are still unjudged: they prove that both clients open each scene, and nothing more.

## Task 6: the front door, its settings, the week's challenge and the legal notice

Six scenes, each shot on both clients on `SCENE_NOW` and compared (`pnpm --filter @ratrace/web exec tsx ../mobile/scripts/scene-shots.ts web app
compare --only=home-new,home-continue,home-settings,home-lost-newer,challenge-practice,legal`): `home-new` (a device with no life),
`home-continue` (a nurse, round 3), `home-settings` (the same, the settings sheet open), `home-lost-newer` (a life saved by a newer version of the
game), `challenge-practice` (the week's challenge page) and `legal`.

| scene | verdict | raw % | beyond % | a point away (px) | shape (px) | text lines | worst text (pt) |
|---|---|---|---|---|---|---|---|
| home-new | clean | 3.65 | 0.372 | 6905 | 0 | 15 | 0.67 |
| challenge-practice | clean (web's sign-in line hidden) | 4.56 | 0.904 | 11248 | 0 | 15 | 0.67 |
| home-continue | differs | 2.98 | 0.399 | 7129 | 1 | 15 | 0.67 |
| home-settings | differs | 4.04 | 1.993 | 6141 | 3 | 29 (15 under the sheet's backdrop, unmeasured) | 1.00 |
| home-lost-newer | **phone words**: layout compared | 4.22 | 0.758 | 12549 | 0 | 17 | 5.67 (the notice's words) |
| legal | **phone words**: not comparable as shot; measured once with the web's words (below) | 14.16 | 10.584 | 246566 | 38813 | 34 (17 in one shot only) | n/a |
| legal, phone drawn with the web's words once | clean | 9.44 | 4.097 | 42421 | 0 | 34 | 1.00 |

**Phone words (rulings R1, R2).** Where the web's words tell a phone player something false or impossible (reload the page, this browser, another tab,
a notice that names an account, Google, Supabase, cookies in a browser) the phone has words of its own under `phone` in the three languages, and the
shots of those two scenes cannot be compared word for word:
- `home-lost-newer`: only the notice's words differ ("Update the app to carry on with it" for "Reload the page…"). Its layout is compared: **0 shape pixels**; the 5.67 pt of its text row is the
  notice, whose lines are other words. The scene's text row is not a verdict on the text.
- `legal`: the phone's notice is a different text with different sections (five, not six), so the two pages have nothing line for line to compare after the title and the first
  section's heading. The `legal` row above is the committed pair (the web's notice and the phone's) and says nothing of the layout. To judge the layout, the phone's page was drawn
  **once with the web's own six sections** (the old `legal.*` keys, put back for one shot and taken out again): clean, 0 shape pixels, every line within 1.00 pt of the web's. The
  committed pictures are the phone's own words. The text of `phone.legal.*` is for the user to review at the end of the phase.

### What differed in the first shots, and was fixed in the app

| # | difference | cause | fix | test |
|---|---|---|---|---|
| 1 | the web's foot (the settings, the small print) stood 62 pt lower than the app's, below the fold | the web's body is padded by the safe area at the top and its `main` is `min-h-dvh`: a short page is taller than the screen by that area, on a phone with a notch; the phone's page scrolls inside the screen | **not changed in the app** (R3: the foot of a short page is better where the screen shows it): the web's shots are given one rule, `main { min-height: calc(100dvh - env(safe-area-inset-top)) !important }` (`VISIBLE_HEIGHT`), which takes that one difference away; nothing else of the web is touched | `sceneShots.test`, `shotDrivers.test` |
| 2 | "Continue your life" 1.9 pt wider than the web's | `letter-spacing: 0.03em` is set by `.pixel` on the *button*, where an em is the page's 15, and the 19-point title inside it inherits that length (0.45 pt), not 0.03 of its own size (0.57) | the title's letter spacing is 15 × 0.03 | `Home.test` |
| 3 | the line under it ("Nurse · age 26 · Madrid") 17 % smaller, 13 pt narrower | it is Chakra Petch (`font-sans`) inside that pixel button, so it inherits `font-size-adjust: 0.56` and is drawn at the size that brings its small letters to Jersey's height: 13 × 0.56 / Chakra's x-height (15.6), with the button's 1.1 line | `adjustedRead(13)`, and the button's letter spacing | `fonts.test`, `Home.test` |
| 4 | the gold panel of the challenge page lighter than the web's | the web writes `frame-gold bg-night-600`, but the Panel's own `bg-night-700` comes later in the stylesheet and wins (read from the shot: `#1f2a4d`) | night-700 | `kit.test` |
| 5 | "Русский" 1.3 pt out, lower than the web's, in the language picker (now within the sheet's 1 pt) | the name asks for the Cyrillic pixel typeface by itself, so its line is set from Oswald's metrics, not Jersey's | `CYRILLIC_ALONE`: Oswald first, its ascent and descent for the baseline | `fonts.test`, `Settings.test` |
| 6 | the banner's rows of art off by up to 1.5 device px | Chrome snaps the 157.5 pt image to CSS pixels and paints it 158 pt (474 device px) tall; the app drew 472.5 | the picture is drawn into the height rounded to a whole point (fitted to both shots: the rect Chrome drew is 1134 × 474 at (36, 402), the app's now the same) | `Challenge.test` |
| 7 | **`legal`: the foot 2.7 pt lower after 28 lines; `challenge-practice`: boxes under three paragraphs 1 to 4 device px off (9476 shape pixels)** | each line of a paragraph is snapped to the device grid (19.25 pt, 57.75 px, drawn at 58), so n lines are n × 0.083 pt taller than the web's and the error added up across the paragraphs of a page. I first took this for the platform's (an exact line height gives the same 58 px per line) and it is not: the box can be given back what the grid added | a text that wraps and whose line is off the grid counts its lines (`onTextLayout`) and is held to n × the exact line height (a negative bottom margin of n × (exact − grid)): the lines of one paragraph are as far off as they are, the next paragraph is not | `text.test` |
| 8 | the challenge page's "To play the attempt that counts, sign in" line (web only) | the phone has no way to sign in until phase 3 (`useCanSignIn`), so the line is not drawn; the web's shot hides it with `WEB_ONLY` so the rest is compared | not drawn | `Challenge.test`, `offline.test`, `sceneShots.test` |

After 7 and 8, `challenge-practice` is clean (shape 9476 → 0, text within 0.67 pt) and `legal` drawn with the web's words is clean (foot 2.7 pt → within 1.00 pt).

### The residual, with its cause

1. **`home-continue`, 1 pixel; `home-settings`, 3 pixels.** Single pixels at the edge of a glyph that the text check's windows did not cover (the descender of the "y" of
   "your" in the continue button's title at (209, 300) pt, and, under the sheet's dimming, a letter of the "Collection" label at (137, 486) pt). Nothing is out of place.
2. **`home-settings`, text 1.00 pt apart.** The sheet's content stands about 0.7 pt higher on the phone (the title, 1.0; the foot, 0.3): the sum of its
   lines' roundings up (13 × 1.45, 11 × 1.45 and the toggles' two-line hints), with the sheet anchored at the bottom.

### What is not compared, and why

- **The language menu** (the corner's dropdown) and **the sheets that open from a tap** (the "end this life?" question) are not scenes; their tests
  cover them, and the menu was opened on the simulator and shown to hang under its square, right edge to right edge, as the web's does.
- **The week's challenge card and the continue button's challenge label** are drawn from the same game state as the web's; a life of the week in
  progress is not a scene (the label's 16 pt picture is the one thing drawn at a size that is not the art's: `Sprite size`).
- **Android is not measured:** the menu's place (measured in the window, under a translucent status bar), the language names' `accessibilityLanguage`
  (iOS only) and the line-hold (`onTextLayout`, iOS only by design) are unchecked there.
- **The one exception to Ruling A:** `home-settings` is drawn on the web by the scene page pressing the web's own gear (`Settled`), because the web's `HomeSettingsSheet` is not exported and the web
  may not change (R3). The phone draws the sheet beside the front door.

## The tolerance, and the exception this phase needs

Phase 1 accepted no shape difference beyond a point (3 device pixels) or a shade, apart from a few listed platform ones (a Bar's lamp
bleeding a sliver, a sprite scaled to a fraction: 30 and 47 pixels). Every phase 1 section is a still thing laid out on whole device
pixels. Phase 2 has things that are not: boxes that are turned, scaled and moved by a fraction of a point (the stepped keyframes, held at
a step), and a smooth price line. At their edges Chrome and iOS draw differently, and *that* is what is left in the motion section.

> **Exception asked for (to be accepted at the end of the phase):** an antialiased one-device-pixel (⅓ pt) edge on a box that is
> transformed (turned, scaled, or moved by a fraction of a point) or on a smooth line, which the comparison counts as a shape difference
> because the other shot has a hard edge there. No shape, colour or place is more than one device pixel off (two, ⅔ pt, at the worst one:
> the torn page's top edge). Nothing else differs.

## motion-2: the rest of the web's motion

The section shows, on both pages, with fixed data: a legendary card's picture with its rainbow (`holo`) and band of light (`glint`) held
half way, then the other keyframes each in a cell (`paper`, `legend`, `medal`, `fly`, `fall`, `reveal`, `alarm`, `tear`, `page`,
`light`, `spark`), the burst of `Sparks`, the slider, the price line (`LineChart`) and the net-worth bars (`Bars`). Every effect is held
at the middle of a step, away from the edge of one (`HELD`, the same numbers on both pages, a test holds them equal): the web by pausing
the stylesheet's own animation with a negative delay, so it is the web's CSS that is drawn; the app by drawing `styleOf` of the frame of
the same time.

| section | raw % | beyond % | a point away (px) | same, no dots rule (px) | shape (px) | of which blended edges (px) | text lines measured | worst text (pt) |
|---|---|---|---|---|---|---|---|---|
| motion-2 | 1.74 | 0.073 | 1714 | 1714 | 1369 | 1339 | 1/1 | 0.33 |

Where the 1369 shape pixels are: the legendary card's turn (`legend`) 416; the price line 264; the sparks 192; the flying coin 144; the
medal 129; the revealed picture 84; the torn page 68; the paper 67; the card's picture with its rainbow and band 5. Slider, bars,
alarm lamp, lit lamp, page and confetti: none.

### What differed in the first shot, and was fixed in the app

| # | difference | cause | fix | test |
|---|---|---|---|---|
| 1 | the medal drawn half as wide, the legendary card as a thin slice | iOS sorts the half of a layer turned about its vertical axis *behind* the box it sits in and hides it (measured on a scratch page: any `rotateY`, even a raw matrix, drew half of `cos θ` of the width, cut at the middle) | the turn is drawn flat: `scaleX(cos θ)` for the medal, one flat matrix for the card's `perspective(600px) rotateY() scale()` (no depth to sort by) | `motion.test`: `cardMatrix` against the full CSS maths, point by point |
| 2 | the rainbow did not show | `mix-blend-mode: overlay` of a view over a Skia canvas blends with nothing on iOS | the rainbow is Skia nodes drawn in the sprite's own canvas (`<Sprite><Holo/></Sprite>`), `overlay` at 40 % | `Shine.test`, `Sprite.test` |
| 3 | the price line's edges (1755 of 2860 shape pixels) | drawn unsmoothed against the web's smooth svg | smooth, as the web's | `charts.test` |
| 4 | the medal edge-on and the confetti out of its cell at the first held times | the held times | `HELD.medal` 427, `HELD.fall` 350 | `kitPages.test` |

### The residual: cause of each, verified

1. **The cause.** At the fractional place of a transformed box's edge Chrome draws a pixel of partial coverage (a blend of the box and what
   is behind it); iOS composites a layer with its edge on a whole device pixel (a `CALayer`'s edge antialiasing is off unless the app asks
   for it, `UIViewEdgeAntialiasing`). So the same box has a one-pixel ring in the web's shot and a hard edge in the app's. Seen
   directly (zoomed shots): the flying coin has a ring of half-gold pixels on the web and none in the app; the revealed picture's lower
   edge is a darker row on the web; the legend card's top edge is a smooth 2-pixel slope on the web and one step on the app.
2. **Every one of them is such an edge.** `blendedEdges` (`kitCompare.ts`, tested on synthetic shots) takes each shape pixel and asks
   whether its colour is a blend, in some share, of two colours that stand within a point of it in the other shot. 1339 of the 1369 are.
   The other 30, listed by position, are pixels where three colours meet: the corner square of the turned paper (9) and of the torn page (20)
   against the card's own edge, and one pixel of the glint band's edge over the picture.
3. **Nothing is more than a device pixel off.** The extent of every cell's drawing, measured in both shots: identical for the picture
   uncovered, the alarm lamp, the lit lamp, the spark and the confetti; within one device pixel for the paper, the card, the medal, the coin
   and the page; the torn page 2 device pixels (⅔ pt) at its top. The card picture with its rainbow and band: 5 pixels of difference.

### What is left

- **The one-pixel edges above** are the platforms'. They can be made to go away on a release build by asking iOS to antialias layer edges
  (`ios.infoPlist.UIViewEdgeAntialiasing` in `app.json`); Expo Go cannot be given that, so it has not been tried. If the exception is not
  accepted, that is the next step, and it comes with the release-build check halfway through the phase.
- **The turn is flat.** The legendary card and the medal are drawn without real 3D (see 1 above); the card's perspective is exact for the
  plane it turns in. Nothing in the game needs more.
- **Playing is judged by eye, holding by pixels.** The comparison is of frames held still; the same frames play through Reanimated (every
  hook was run live on the simulator and looked right, and the slider and the sticky rows were driven by touch), but no running animation is
  compared with the web's.
- **Android is not measured.** The flat turn avoids the depth problem there too, but nothing was run.
