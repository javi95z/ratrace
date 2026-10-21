# Phase 2 parity: the solo game beside the web's

The report of phase 2's pixel comparisons. It is the sequel of `2026-10-20-phase-1-parity.md`: the same screen (an iPhone 16 Pro,
402 × 874 pt at 3×, safe areas 62 and 34), the same two shots (the web by Playwright's Chrome, the app by Expo Go on the booted
simulator), the same comparison (`apps/mobile/scripts/kitCompare.ts`: *raw*, *beyond* a device pixel and a shade, *a point
away*, *text*, *shape*), the same tool (`kit-shots.ts`). Pictures and numbers live beside it, in `phase-2-parity/`
(`<section>.png`: the web, the app and the difference side by side; `numbers.json`); phase 1's stay in `phase-1-parity/`, untouched. A
section goes to the report of the phase that added it (`reportFolder` in `kitCompare.ts`).

Each task of the phase that draws something adds its rows here. Rows so far: the kit's motion section (task 4), the scenes of the front
door, the week's challenge and the legal notice (task 6, below), the page where a life is chosen (task 7, below), the HUD with what hangs from it (task 8, below), the play screen at the news, its guide, its fault and its calendar (task 9, below) and an amount on a slider, a legendary badge and the cards of badges earned (task 10, below). Scene rows (one game state drawn by both clients) follow with the screens.

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
kept. The task that ports a screen takes its word out of `STAND_INS`, and its scenes are compared from then on. Task 6 ported `home`, task 7
`new`, so their scenes are compared; the five `play-*` scenes of task 5 (`play-news-r1`, `play-cards-r1`, `play-finance-r6`, `play-outcome-r1`,
`play-resolve-r6`) were unjudged: they proved that both clients open each scene, and nothing more. Task 9 ported `play`: `play-news-r1` is compared, and the four
whose stage a later task brings are unjudged by name (`STAND_IN_SCENES`), until that task takes them out.

**Phone words.** Where the web's words are false or impossible on a phone, the phone has words of its own (`phone.*`), and the two shots cannot agree on their
text whatever the app does. The scenes that carry them are listed beside the stand-ins (`PHONE_WORDS` in `sceneShots.ts`: `home-lost-newer`, `legal`), and are
compared for their layout and shape only: their text rows are in the line (`textLines`, `oneSided`, `worstPt`) and not judged, and the verdict says so.
`home-lost-newer` is `phone words, layout clean` or `phone words, layout differs`, by its shape alone (a layout that differs still fails the run). `legal`
(`PHONE_PAGES`) is a page of other words from top to bottom, whose every box stands where the length of its text puts it, so its shape says nothing of the
layout either: `phone words, not comparable`, which fails a run only if its shape drifts from its recorded baseline (`PAGE_BASELINE`, below; its layout is judged once, by drawing the phone's page with the web's own words: Task 6,
below). Before this, those two scenes made every full run of `scene-shots.ts` exit 1.

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
| 1 | the web's foot (the settings, the small print) stood 62 pt lower than the app's, below the fold | the web's body is padded by the safe area at the top and its `main` is `min-h-dvh`: a short page is taller than the screen by that area, on a phone with a notch; the phone's page scrolls inside the screen | **not changed in the app** (R3: the foot of a short page is better where the screen shows it): the web's shots are given one rule, `main { min-height: calc(100dvh - env(safe-area-inset-top)) !important }` (`VISIBLE_HEIGHT`), which takes that one difference away; nothing else of the web is touched. **Since the web's d67284b** (its pages `min-h-safe`, 100dvh less the top safe area) the web does this itself and the rule is gone (Task 12's fix round); the batch pass re-shoots the web side | `sceneShots.test`, `shotDrivers.test` |
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

## Task 7: choosing a new life

`pnpm --filter @ratrace/web exec tsx ../mobile/scripts/scene-shots.ts web app compare --only=new-first,new-unlocked,new-locked,new-replace`. Four scenes: `new-first` (a device
with nothing on it: the three lives to begin with, the dice, the folded list of the seventeen locked), `new-unlocked` (the same device with two lives earned, the delivery
rider and the heir), `new-replace` (a life in progress, and the question of ending it open over the page) and, beyond the brief's three, `new-locked` (the folded list opened:
without it nothing of the locked rows, with their silhouettes, hints and difficulty, would be compared). The web's page has nothing to take an initial state from and may
not be changed, so for `new-locked` and `new-replace` its scene page presses, once the screen is drawn, the button that opens each (`Pressed` in the scene page, the one
exception to Ruling A besides the settings' gear); the app's `NewLife` takes the same two as an initial state (`opened`). `CareerPreview` has no scene of this task
(the cards that show it are Task 11's); it was shot once through a temporary scene (a nurse's life, the law ladder started at its second rung: the sheet, over a
blank page), compared and taken out again.

| scene | verdict | raw % | beyond % | a point away (px) | shape (px) | text lines | worst text (pt) |
|---|---|---|---|---|---|---|---|
| new-first | accepted (residuals below) | 3.28 | 0.592 | 8120 | 1107 | 26 (5 unmeasured) | 2.00 (the dice) |
| new-unlocked | accepted (the same) | 3.22 | 0.657 | 8757 | 1107 | 33 (5 unmeasured) | 2.00 (the dice) |
| new-locked | accepted (the same) | 5.98 | 2.290 | 13085 | 1636 | 66 (13 unmeasured) | 2.00 (the dice, the arrow) |
| new-replace | accepted (the same) | 2.00 | 0.491 | 5509 | 1159 | 32 (27 under the sheet's backdrop) | 1.00 |
| CareerPreview (temporary scene) | clean | 3.69 | 1.388 | 12353 | 0 | 28 | 0.67 |

The three pages that were shot before Task 7's second round (`home-new`, `home-settings`, `challenge-practice`) were shot again after the kit change in #3 below:
`home-new` clean (0 shape, 0.67 pt), `challenge-practice` clean (0, 0.67 pt), `home-settings` **clean** now (it was 3 shape pixels, 1.00 pt: it is 0, 0.33 pt),
`home-continue` the same one pixel, `home-lost-newer` `phone words, layout clean` (0 shape pixels; its text row is the notice's other words, 5.67 pt), `legal`
`phone words, not comparable`.

### What differed in the first shots, and was fixed

| # | difference | cause | fix | test |
|---|---|---|---|---|
| 1 | a locked life's portrait 7 pt higher than the web's, its lock with it (4383 shape pixels) | the kit's `Well` is `align-self: flex-start` (it hugs in a column); the web's inline-flex well is centred by the row (`items-center`) against four lines of text | the well is given `alignSelf: 'center'` where the web's row centres it | `NewLife.test` (every portrait's well) |
| 2 | the web's list of the locked lives shut in the shot of `new-locked` | the dev server runs a scene page's effect twice before it draws again: the page pressed the button twice, and the second press shut what the first opened | the page presses once (a ref) | `scenePages.test` |
| 3 | boxes of stacked one-line texts 1 to 2 device pixels taller than the web's: the chosen life's tile 0.67 pt, `home-settings` 3 shape pixels, the sheet's content | a line is drawn on the device's grid (16.5 pt as 16.67), and the kit held a text to its exact line only from two lines up: a one-line text kept its grid line's extra, and a column of them added it up | a text starts as one line and is held as one in its first frame (what nearly every text is, and a text cut to one line always is: never drawn again for it); one that wraps is corrected once, after its layout | `text.test` (RED: two tests failed before) |
| 4 | the pay of a rung of the career 1.33 pt higher than its title (`CareerPreview`) | the web aligns the 16 pt title and the 15 pt pay by their baselines (`items-baseline`); a native row reads the baseline of a box, and the kit moves glyphs inside their boxes, so the two did not meet | the row is top-aligned and the pay is dropped by the difference of the two baselines in the browser (`webBaseline`: 14 and 13, a point) | `fonts.test`, `CareerPreview.test` |
| 5 | the character's name after a pixel title ("Nurse · Lucía") would have needed a reading face inside a pixel text, in a colour of its own, and the unlock line two colours in one paragraph | the kit's texts took one string | `after` on the kit's texts: words that run on in the same text, in a colour, or in the reading face at the size the pixel text's `font-size-adjust` gives it (`adjustedRuns`: Chakra Petch's 13 is 15.6; Exo 2's for Cyrillic by its own small letters); a nested text takes the title's letter and word spacing in Russian as the web's span does; the baseline counts the fonts that run on | `text.test`, `fonts.test` |

### The residual, with its cause

1. **The dice (`🎲 At random`): 2.00 pt, 641 of the 1107 shape pixels.** Measured on both (rows of device pixels): the emoji is the same size, 54 px high, and the text beside it the same row of pixels;
   the web's emoji has its top 17 px above the text's top and its bottom 6 px under the text's baseline, 83 px from the text; the app's 11 above, 12 under and 79 from it: 6 to 7 px (2 to 2.33 pt) lower.
   Chrome applies the `font-size-adjust` to the emoji font too (CDP: `Apple Color Emoji`; its advance is 22.0 pt in a 14 px text against 18.0 without the adjust). Tried: the emoji in its own family
   (`Apple Color Emoji`), at the size the adjust gives it: the same size within 2 px, and the place no nearer (11 above, 12 under): iOS lays that bitmap lower on the baseline than macOS does, and a React
   Native text has no baseline offset for a run on iOS. The same class as phase 1's ▸ (a platform's own drawing of a sign no font of the page has); on an iPhone, Safari would draw it as the app does.
   Only two labels have an emoji (`newLife.random`, `player.byChance`).
2. **▾ and ▴ of the folded list: 1.33 to 1.67 pt, about 30 shape pixels.** Phase 1's ▸ again: no font of the page draws it; Chrome on macOS takes it from `.SF NS`, where the adjust makes it
   1.375 times larger (measured: 8.875 against 6.453 pt wide); the app takes iOS's, which draws it 4 pt wide against the web's 5.
3. **The hints under the locked lives were upright, and are slanted now (new-locked: 1.67 to 2.00 pt before, within 0.67 pt after).** The web's Chakra Petch and Exo 2 have no italic face (next/font loads the upright ones) and
   Chrome slants the upright face as it draws it, every glyph sheared by a quarter of its height above the baseline, the advances unchanged; iOS does not slant a font that has no italic (React Native's
   `fontStyle: 'italic'` does nothing there) and a real italic has other widths, so a hint would wrap elsewhere. So the slant is made once, as a face of its own (`scripts/slant_fonts.py`: fontTools, the four faces
   Chakra Petch and Exo 2 in 400 and 600, `assets/fonts/*_Slant.ttf` with their OFL texts), and an italic text is set in it (`ReadText italic`); no `fontStyle` is set for it, so Android does not slant it twice.
   The five screens whose web uses `italic` (End, Evasion, Business, Finance, Resolve) are the same one prop. `slantFonts.test.ts` reads the files and checks every point of an outline, every advance, the
   names and the license, and makes them again where fontTools is the version that made them.
4. **Whole CSS pixels against device pixels, up to ⅔ pt (1 pt for the sheet's last button).** Chrome puts boxes, images and the baseline of a text on whole CSS pixels and the phone on device pixels (phase 1's
   same residual): the chosen tile ends one device pixel lower; the cash figure stands 2 device pixels higher (251 shape pixels); the coin and the city icon after a text of a fractional width are 1 device
   pixel apart (94); "EASY" is 1 device pixel narrower (91); the labels of the kit's buttons (`Start this life`, `Keep my life`, `End it and start this one`: 0.67 to 1.00 pt) stand 2 device pixels higher
   (527 in `new-locked`, the page with its button under the list). The rest of the 1107 of `new-first` is antialiased edges (517 are `shapeBlended`).

### What a run accepts

A scene that differs and whose residual is explained above is `accepted` while it stays within a record (`ACCEPTED` in `scripts/sceneShots.ts`: per scene, the most shape pixels, the most any line of text stands apart
and the most lines in one shot only, its reason, and the heading of this report that explains it): `home-continue` (1 pixel, 0.67 pt), `new-first` and `new-unlocked` (1107, 2.00 pt), `new-locked` (1636, 2.00 pt),
`new-replace` (1159, 1.00 pt). (Tightened in Task 8 to 738, 738 and 1267: the text check no longer measures the page's screen-reader heading, whose box had kept 369 pixels of real ink out of the mask; see Task 8, #6.) Any growth (a pixel, a hundredth of a point, a line of text in one shot only) is `differs` and fails the run; a scene that is clean stays clean. The page of other words (`legal`,
`PAGE_BASELINE`) is held to where it stood, 39721 shape pixels, within 10 % either way: past that it is `phone words, drifted` and fails the run. A full run (`scene-shots.ts` with nothing named) now exits 0: every
scene is clean, accepted, in the phone's words within its bound, or unjudged. A change of the screens or of the phone's words that moves a number is meant to be seen here and the record moved by whoever moved it.
(The sprites of a screen are given six seconds to load before it is shot, not four: once in a full run the front door's gear was not there yet.)

### The lists: why not a `FlatList`

The page has at most twenty lives in all (the three to begin with and seventeen to unlock): each is a tile (open) or a row (locked), and the two never pass twenty together, under the 30 rows
a list needs a `FlatList` for. The page also scrolls as one (`Screen`'s scroll), so a `FlatList` inside it would be nested (React Native: no windowing there) and a list-based page
would be a new kit piece, and a list of virtualised rows in jsdom shows only its first `initialNumToRender` rows, so no test could read the whole list. The choice was measured instead,
by `Profiler` and `onLayout` on a development build on the simulator (JS time to the first layout, from the page's first render; a development build is the slow one, and the release build's
measure is Task 12's checkpoint):

| what | time to layout |
|---|---|
| the page as a new player opens it (3 tiles, the folded list) | 80 to 120 ms |
| the page of someone who has unlocked every life (20 tiles at once) | mount 67 to 82 ms, layout at 98 to 146 ms |
| the locked list opened, 17 rows drawn at once | layout at 306 to 402 ms |
| the locked list opened, 5 rows in the first frame and 6 in each of the next | layout at 146 to 192 ms; the next commits 20 and 42 ms; all 17 by about 350 ms |

The twenty tiles are drawn with the page, as they are (100 to 145 ms is a development build's worst case: nothing is saved by windowing them, and they stay as one flat group so that a
tile that moves in the grid is not drawn again). The locked rows, whose first frame cost most and which are drawn on a tap, are drawn a few to a frame (`LockedList`:
`LOCKED_FIRST` 5, `LOCKED_STEP` 6). Chosen tiles and rows are `memo`: choosing another life draws the two tiles that change, and nothing else.

## Task 8: the HUD and what hangs from it

`pnpm --filter @ratrace/web exec tsx ../mobile/scripts/scene-shots.ts web app compare --only=hud-news-r1,hud-cash,hud-flow,hud-race,hud-status-ru,hud-jailed,hud-crisis,hud-crisis-details`.
The HUD is drawn on a screen of its own in the scenes, `hud`, until Play is ported (Task 9): the web's page draws the web's `Play` (the HUD's only page), and its shot
takes out everything of Play but the HUD (`HUD_ONLY` in `sceneShots.ts`, one more `WEB_ONLY` rule: `#round-stage, #round-actions { display: none }`: the stage of the
round and the bar of its next step); the app draws the HUD as Play will mount it (`testing/hudScene.tsx`: a `StickyScreen` with the HUD's `lead` and `header`, and the
crisis's strip under them in the compact stages), over the page's ground. So the HUD is compared alone, on the same ground, on both sides.

| scene | what | verdict | raw % | beyond % | a point away (px) | shape (px) | text lines | worst text (pt) |
|---|---|---|---|---|---|---|---|---|
| hud-news-r1 | the engineer's first round at the news (play-news-r1's store): skyline, portrait, figures, way out | clean | 2.87 | 0.189 | 2390 | 0 | 20 | 1.00 (the Stats' ▸, phase 1's sign) |
| hud-cash | the same, the cash sheet open | clean | 1.26 | 0.179 | 2734 | 0 | 30 (20 under the backdrop) | 0.33 |
| hud-flow | the sixth round's finances (play-finance-r6's store: the compact HUD), the flow sheet open, its dividends, interest and tax | clean | 1.28 | 0.243 | 4271 | 0 | 32 (19 under) | 0.67 |
| hud-race | the first round, the way out's sheet open: the wheel (motion left out), the bar with its door, the lines | clean | 2.23 | 0.416 | 7333 | 0 | 36 (20 under) | 0.33 |
| hud-status-ru | in Russian on a phone 360 wide, the status sheet open with the score today | clean | 2.22 | 0.434 | 5284 | 0 | 44 (20 under) | 0.67 |
| hud-jailed | a nurse in prison (the compact HUD with its tag), the prison's sheet open | clean | 3.38 | 0.617 | 9418 | 0 | 33 (21 under) | 0.67 |
| hud-crisis | the engineer of `screen-seed-10` at the sixth round's finances, the second year of the Great Crash: the crisis's strip | clean | 3.10 | 0.180 | 2714 | 0 | 21 | 1.00 (▸) |
| hud-crisis-details | the same, the whole of the crisis open from its strip (beyond the brief: its list of years is framed rows) | clean | 2.62 | 0.843 | 7915 | 0 | 33 (21 under) | 0.67 |

**How the scenes are made.**
- **Sheets.** The web's `Hud` takes no initial state and may not be changed, so its scene page presses the HUD's own button for the sheet the scene names
  (`HUD_SHEETS` in the page: the cash marked `data-hud-cash`, the second and third figures of its grid, the way out, the prison's tag, the crisis's strip), as it does for
  the page where a life is chosen (the same exception to Ruling A, R3's precedent); the phone's `Hud` takes the sheet as `open`, and `CrisisBar` as `open`.
- **A phone 360 wide** (the Review Focus's Russian player). The shots' width is the iPhone 16 Pro's and the simulator's cannot be changed, so a scene can name a
  `width` (`Scene.width`, core) and both clients draw its screen in a box that wide in the middle of the screen (`OfWidth` in both registries). The column inside is
  then 336 and the Stats drop their icons, as the web's container query does under 340. A sheet stands over the whole screen on both sides (402).
- **Motion left out.** The wheel of the way out and the lamp of a crisis's year play for ever, so a shot would catch them anywhere in their run; `hud-race`,
  `hud-crisis` and `hud-crisis-details` are drawn with the player's own "reduce motion" on (`STILL` in core's scenes: the setting is in the profile, which both clients
  read: the web's `html[data-motion='reduced']`, the phone's `ReducedMotionProvider`).
- **A crisis and a prison, from the game itself.** No world on the first fixed seed has a crisis, and the saver never breaks the law. A scene may now begin its life on
  another seed of the same family (`seed`, through `fixedSessionsOn` in `session/fixed.ts`; ids and clock unchanged) and take its own option on a card the saver would
  answer otherwise (`picks`). `screen-seed-10` is the first whose world has a crisis in reach (the Great Crash, rounds 5 to 7); on `screen-seed-15` the nurse is wrongly
  accused in her eighth round, goes to court (option 0) and loses: one round inside (found by playing the saver on the fixed seeds 1 to 15). Both are states the
  game made, not a save written over: writing `jailRounds` into a save leaves its salary out of step with the life, and the game rebuilds the save from its log.
- **play-news-r1** (the brief's "HUD at top") stays a scene of Play, unjudged until Task 9; `hud-news-r1` is its store with the HUD alone, and is compared.

### What differed in the first shots, and was fixed

| # | difference | cause | fix | test |
|---|---|---|---|---|
| 1 | the banner's stretched sky one device row off at its top (`hud-news-r1`'s 28 shape pixels, at the banner's top edge) | the sky is the skyline at `background-size: cover`, 77.42 pt tall from −5.71 pt; the browser draws a background where it falls, at a fraction of a device pixel, and a box of the phone is laid out on whole device pixels (−5.67), so the picture's rows changed one device row later (measured: the boundary of rows 4 and 5 at device row 234 on the web, 235 on the app) | the kit's `Sprite` takes a `place` inside its box: the sky is a canvas the banner's size with the picture drawn in it at −5.71 | `Sprite.test`, `CityBanner.test` (`skyCover`) |
| 2 | the way out's sheet 4 pt taller above its lines (79311 shape pixels: everything above the list moved) | the web's list of the way out is `mt-3` and its first line (the passive income, when nothing else comes in) `mt-1`: block margins collapse, to 12; the phone's add, to 16 | the first line has no room of its own on top when it is the first | shot, `Hud.test` (the sheet's lines) |
| 3 | the compact HUD of someone in prison 1.75 pt shorter (the figures, the bar and the portrait's row higher, 6478 shape pixels) | the web's tag is an `inline-flex` button in a line of the column's own 15 × 1.45 text: the line is the tag with its `mt-1` and, under it, the room the reading strut leaves below its baseline (6.75) where the tag leaves 5 | the tag's room above and below is worked out from the browser's baselines (`tagRoom`) | shot, `Jail.test` |
| 4 | the prison's list: a small bullet glyph by the line, against the web's disc 5 pt across, 4 in from the list's edge | `list-disc` is drawn by the browser as a filled circle, not a character of the font | the disc is a Skia circle of the measured size and place (no `borderRadius`: the kit keeps none) | shot |
| 5 | lines of text measured that are not drawn (37.67 pt "apart" under the cash sheet, 27.33 in Russian) | the shot first hid Play's stage with `visibility: hidden`, which keeps the boxes of its text: the check measured them, and kept the ink of the lines over them out of their own masks | `HUD_ONLY` takes them out with `display: none` | `sceneShots.test` |
| 6 | 28 shape pixels round the name of the compact HUD (`hud-crisis`) | the web's page has a heading for a screen reader only (`sr-only`, Play's `<h1>`), whose text the check took for a line: its box, where its words would stand, lay over the name's and kept the name's ink out of its mask | the text check leaves out text clipped to nothing (`clip-path: inset(50%)`, `clip: rect(0 0 0 0)`, `TEXT_BOXES` in `shotDrivers.ts`); the page where a life is chosen had the same heading over its pictures: `new-first` and `new-unlocked` 1107 → 738 shape pixels, `new-locked` 1636 → 1267, and their records were tightened | `shotDrivers.test` (RED before the fix) |

### The residual

None beyond phase 1's: the Stats' ▸ (no font of the page has it; macOS's against iOS's) stands 1.00 pt apart, inside the tolerance, as in the kit's own section.
The sky's 40 % picture and the skyline's three-step edges (the web's mask, `edgeBands`) are exact at 402; at 360 the edges are drawn in five clipped bands whose seams
fall at fractions of a point, under the sheet's backdrop in `hud-status-ru` (0 shape pixels there).

### What is not compared, and why

- **The "away" strip** shows only once the page has scrolled past the portrait's row, and a scene is shot at the top: `Hud.test` scrolls the page and finds whose
  life and which round it is. On the phone it is told by the `StickyScreen` (`useScrolledPastLead`: past the bottom of the lead, wherever it ends, followed as it grows), in place of the web's
  `IntersectionObserver`; the web shows it 62 pt of scroll later, when the row has also gone under the status bar, which the phone's page never scrolls under.
- **The paper's sheet** is a stand-in until Task 9 ports `News` (`Headlines`, its gauges and its paper): the crisis's bar and the round's headlines as lines. (Task 9: it is News' own `Headlines` now, compared on the news stage of Play.)
- **The tier-up moment** (the frame jumps, sparks fly and a band of light crosses it once) is the kit's `usePop`, `Sparks` and `Glint`, each held and compared in the kit's
  motion section; the HUD only plays them on a better frame, never on its first draw.
- **The backdrops of better frames** (teal, stage lights, gold rays) are drawn by `Hud.test` for each tier; `hud-crisis` shows the teal of a bronze frame (status 30)
  behind the small portrait, compared. The gold rays are a Skia path (Chrome's conic gradient at its hard stops against Skia's antialiased edges: not shot, no scene reaches 100).

### The wheel: one timing per loop, not a timer per frame

The web's `Loop` steps a frame index in React state every `ms` (90 to 230 ms for the wheel), which draws the component again for every frame. The phone draws the four
frames once, one over the other, and one Reanimated timing per mounted loop (`0` to `n` over `n × ms`, repeated) says which shows, on the UI thread: no React render while
it turns, and no sprite decoded or drawn again (`Loop.test`: one repeating timing of `n × ms`; the frame for each moment of the run is the web timer's).

## Task 9: play, round by round, from the news

`pnpm --filter @ratrace/web exec tsx ../mobile/scripts/scene-shots.ts web app compare --only=play-news-r1,play-news-r6,play-guide-r1,play-fault,play-pageturn`.
Play is the real screen on both sides now (`play` is out of `STAND_INS`): the web's page draws the web's `Play`, the app's registry the phone's. Its stages that later
tasks bring (the cards and a card's result, Task 11; the finances, Task 12; the ledger, Task 16) are a dashed stand-in line on the phone, so the four scenes of them stay
unjudged by name (`STAND_IN_SCENES` in `sceneShots.ts`: `play-cards-r1`, `play-finance-r6`, `play-outcome-r1`, `play-resolve-r6`; the task that ports a stage takes its
scenes out). The `hud-*` scenes still compare the HUD alone.

| scene | what | verdict | raw % | beyond % | a point away (px) | shape (px) | text lines | worst text (pt) |
|---|---|---|---|---|---|---|---|---|
| play-news-r1 | the engineer's first round at the news, every tip read: the paper (masthead, four clippings, dashed rules, drop shadow), the gauges, the bar's button | accepted | 3.79 | 1.029 | 14124 | 1446 | 42 (4 unmeasured) | 1.00 (▸) |
| play-news-r6 | the sixth round's news (London, a clipping of the markets on the paper's own cream) | accepted | 4.21 | 1.133 | 13517 | 1518 | 41 (4 unmeasured) | 1.00 (▸) |
| play-guide-r1 | the first round for someone new: the guide's note over the paper | accepted | 6.16 | 3.778 | 20603 | 3504 | 42 (5 unmeasured) | 1.33 |
| play-fault | a game that cannot go on: the way out | clean | 3.09 | 0.405 | 6203 | 0 | 6 | 1.00 |
| play-pageturn | the second round's news (the people the player grew up with in the paper, one of the famous whole in a clipping), the calendar turning from 22 to 24 held 445 ms into its run | accepted | 3.93 | 1.341 | 16650 | 4309 | 51 (8 unmeasured) | 1.00 (▸) |

**How the scenes are made.**
- **The guide.** A page under development shows the guide's tips to everyone, even with the guide off (the web's `developing`, kept on the phone), so the scenes of
  the paper are a player who has read every tip and every note of a first time (`GUIDE_READ` in core's scenes: `play-news-r1`, `play-news-r6`, `play-pageturn`);
  `play-guide-r1` is the same store for someone new, with the first tip due. (`play-news-r1`'s store is otherwise the HUD scenes' own.)
- **A fault.** The fault is a state of the round store, not of a save, and the web's `Fault` is not exported: a scene names a game that cannot go on (`play-fault`), and
  both clients give its game a basket of orders that cannot be read back (`sceneBasket`, through `sceneServices(store, name)` on the web and `servicesOf` on the
  phone): the round cannot be judged, and the game opens on its fault, as it does when a page's engine will not preview a round. The game says so in the log; the
  app's scene route keeps that one line from the log while that scene is drawn, and only then (`useQuietFault` in `testing/scene.tsx`), or development's banner would
  be in the shot.
- **The calendar.** It turns only while Play is on screen as a round goes by, and a scene's screen is first drawn after its steps; so both registries draw the calendar
  beside Play for the scene that names it (`turnOf`), held at the same moment of its run (`PAGE_TURN_HELD_MS`, 445 ms: the middle of a step of the torn page's, well
  inside one of the new page's): the phone's `PageTurn` takes `held` (it draws each page as the motion table's frame at that time, as the kit's motion page does),
  and the web's scene page puts a rule of its own in the page before the calendar is drawn (`HOLD_TURN`: both animations paused with a negative delay). A shot-time rule
  could not do it: the page is still for 800 ms before the shot, and an animation paused only then is paused where it had got to.

### What differed in the first shots, and was fixed

| # | difference | cause | fix | test |
|---|---|---|---|---|
| 1 | the calendar of `play-pageturn` drawn with no torn page on the web (75010 shape pixels) | the hold was first a shot-time rule (`WEB_ONLY`), added after the page had stood still: the torn page's run (900 ms) was over, and it was paused at its end, gone | the hold is the scene page's own rule, in the page before the calendar mounts | `scenePages.test` |

Measured before writing, so not differences: the guide's frame is the bevel's (`bevel frame-gold`: the class list's `shadow-[0_0_0_3px_gold-500]` loses to the bevel's own box-shadow in the stylesheet; no 3-pixel ring is drawn); the guide's
buttons and the finances' button of orders are 17 pt with 16 of padding (the `text-[15px]`, `text-[14px]` and `px-3` of their class lists lose to the button's own);
the markets' clipping has no block colour (`bg-teal-500` is no colour of the game's palette, which the stylesheet resets); the dashed rule between clippings is Chrome's
(dashes three times the border, gaps as near two as a whole count allows: 70 dashes over 346 pt, `dashesOf`).

### The residual, with its cause

1. **The masthead, a device pixel to the left (about 1440 shape pixels in each scene of the paper).** "The Rat Race Times" is centred; measured along a row through it,
   every stem of the app's letters starts one device pixel left of the web's (the web's have an antialiased column where the app's start), the width the same. Centring
   puts the line at a fraction of a point, which Chrome draws there and the phone at a device pixel. It is counted as shape because the line is not measured as text:
   the paper's rules (the double rule of its border above, the 3-point rule under it) are of the same ink and lie inside the text check's window, so the check takes
   them for a fill round the words (`filled` in `kitCompare.ts`) and keeps the line's glyphs out of its mask. Tried: a hugging box centred by its parent in place of
   a centred line: the same pixels.
2. **Whole CSS pixels against device pixels** (Task 7's #4). The label of the bar's button stands two device pixels higher (`play-news-r6`: 75 shape pixels;
   `play-news-r1`: 0.67 pt, inside its mask). In `play-guide-r1` the guide's note ends at 564.48 pt: the web paints its foot at 564 (and the button above it at 508,
   its layout 508.48), the phone at 564.67 (Yoga rounds each box's place relative to its parent: the stage at 303 for 302.84, then the note); everything under it is
   two device pixels lower, and the second line of a two-line headline under it 1.33 pt (the web puts each line's baseline on a whole CSS pixel, 18 apart there, the
   phone 18.67). About 2000 of its 3504 shape pixels are the clippings' pictures moved by those two device pixels.
3. **The turned page (`play-pageturn`).** The torn page is turned 3.6° about its top left corner: its edges, the rings and the red band are antialiased on one side and
   hard on the other (the exception this phase asks for, below). First shot at 3918 shape pixels and 4.33 pt: the lines of the paper the calendar covers in part
   ("Survey: everyone is middle class…") were measured through it, the calendar taking no touch (`pointer-events: none`, so the web's `elementFromPoint` passes
   through it), with the calendar's ink in their window. Fix round 1 of the review: in this scene's shot the calendar takes the pointer (`CALENDAR_COVERS`, a
   `WEB_ONLY` rule), and the text check measures a line the decoration covers in part only where it shows, either side, two points short of it (`TEXT_BOXES`,
   sampled at the line's top, middle and foot, as the page is turned; a line of the decoration itself is judged at its middle). The worst line is now the HUD's ▸,
   1 pt; the shape is 4309: the torn page's antialiased edge all along, where before about 400 pixels of it next to the paper's lines were hidden in those lines'
   text mask (the masthead's 1440 as in the other paper scenes).

Records: `ACCEPTED` in `scripts/sceneShots.ts` (`play-news-r1` 1446 / 1 pt, `play-news-r6` 1518 / 1 pt, `play-guide-r1` 3504 / 4 device pixels, `play-pageturn` 4309 /
1 pt). `play-fault` is clean.

**The sprites' wait.** Two full runs of every scene, on a machine shared with other work (load average 40 to 170), each failed one to three scenes of other
tasks (`home-lost-newer`, `new-unlocked`, `new-locked`, `challenge-practice`) for a sprite not drawn yet when the app was shot (a gear, a lock, a city's icon,
the practice's icon); each was as recorded when shot again alone. A screen is now given 9 s, not 6, before its shot (`SPRITES_MS` in `shotDrivers.ts`). A third run,
at a load average of 150 to 250, still left out a lock (`new-unlocked`, 5247 shape pixels) and the HUD's coin (`hud-crisis-details`, 5103): the app's shot now
waits for the screen to be still as well (`stillShot`: shot again every 1.5 s until shots in a row are the same, at most a few more; since fix round 1, three alike), so a sprite that
comes late is in it. Still was not enough (fix round 1 of the review, three full runs at a load average of 15 to 35: a portrait, a lock, a coin's icon and a
list's disc missing in one scene or another, two shots 1.5 s apart alike while the pictures were still being read): the app's scene route now says when its
scene is ready to be shot, its screen drawn and no picture of it still being read (`useSpritesLoading`), to a server of the driver's on this machine
(`readyServer`, `GET /ready?name=`, the route opened with `&ready=<port>`), and the shot waits for that word before it waits for stillness; a scene that
never says so in 60 s fails the run. Nothing is judged more loosely: the shot kept is the screen standing still, and a compared scene whose screen never stood still fails
the run (its line in `phase-2-parity.json` says `"moving":true`, the run names it at the end; the app's step keeps the list in `.kit-shots/scenes-moving.json`). The full run after it exits 0, with every scene as recorded
(`new-unlocked` 738, `hud-crisis-details` clean, the play scenes' numbers the same to the pixel as in the run before).

### What is not compared, and why

- **The stages later tasks bring** (above): a stand-in line, a dashed box with a sign of works, so a life can be played on in the simulator; the stage machine, the
  bar of the next thing to do (the finances' cash after the round, the button of orders and the warning before a costly round) and the guide round them are the real ones.
- **The moved toast, the warning before a costly round, Waiting** (the blinking "Loading…" while the game opens) are tested (`Play.test`), not shot: none is a state a
  scene's screen is first drawn in.
- **A Russian player on a 360 pt phone**: the HUD at 360 is `hud-status-ru`; the news stage at 360 is not shot (no scene names it; the paper and the gauges wrap their words).

## Task 10: amounts on a slider, celebrations, flying coins and medals

`pnpm --filter @ratrace/web exec tsx ../mobile/scripts/scene-shots.ts web app compare --only=amount-savings,celebrate-legendary,celebrate-earned`. Three scenes
(the brief's two, and `celebrate-earned`, beyond the brief, for the small cards of what a step earned, which the legendary sheet covers). The screens they
belong to come later (Finance, Task 12; a card's result, Task 11), so each is drawn over the Hud, on both sides:

| scene | what | verdict | raw % | beyond % | a point away (px) | shape (px) | text lines | worst text (pt) |
|---|---|---|---|---|---|---|---|---|
| amount-savings | the sheet that moves cash to savings (Finance's portfolio), opened on $0, all $127,830 of the sixth round's cash to move, over the compact Hud | clean | 1.57 | 0.153 | 2119 | 0 | 30 (19 unmeasured: the dimmed page) | 0.67 |
| celebrate-legendary | a legendary badge earned in a real life: its sheet (the gem's rim, "LEGENDARY BADGE", Continue) over the Hud of the card that earned it, motion left out | clean | 1.21 | 0.261 | 4274 | 0 | 24 (19 unmeasured) | 0.67 |
| celebrate-earned | the same step, the sheet taken in: the small cards of the two badges it earned (bronze and gem rims, 42 pt badges from 64 pt art) under the Hud | accepted | 3.44 | 0.762 | 7638 | 44 | 27 | 1.00 (▸) |

**How the scenes are made.**
- **A legendary badge, from a real life.** No doctored save: the engineer of `screen-seed-74` (found by playing the fixed seeds with the saver: the first
  whose early hands deal one of the famous, as the first card of a round) opens his second round with MrFeast's challenge, a legendary card. The scene is the
  save at that round's news and two steps on the client's game (`then`: the paper read, the challenge taken, option 1); he wins the three-in-a-hundred fortune,
  so the step earns `first_100k` (common) and `celeb_mrfeast` (legendary). Both celebrate scenes are drawn with motion left out (`STILL`): the medal's turn and
  the sparks run 1.2 s, longer than the web's shot waits, and the fortune would fly coins on the web; still, the medal stands square on where its turn ends.
- **The sheet of savings.** Finance keeps its sheets to itself on the web (no initial state), so both registries draw the same `AmountSheet` (the words of
  `finance.amount.save`, the cash shown as the most) beside Play's Hud (the web's `Play` at the sixth round's finances, `play-finance-r6`'s store, the phone's
  `HudScene`), and the web's shot shows the Hud alone under it (`HUD_ONLY`, now given to the screens `hud`, `amount`, `celebrate`: `SHEETS_OVER_THE_HUD`).
- **The legendary sheet.** The web's Play at the card's result draws it itself (Celebrations in the result, its sheet a portal over the page), with the stage hidden
  (`HUD_ONLY`); the phone has no result of a card yet, so its registry mounts `Celebrations` in a box of no size beside the `HudScene` (`HiddenStage`): the
  sheet is drawn over the page, the small cards nowhere, as the web's hidden stage.
- **The small cards.** The web's page presses the sheet's one button (`[data-legendary] button`, once, in the page, as for the Hud's sheets), and its shot takes
  everything of the stage out but the cards (`CELEBRATIONS_ONLY`: the bar of the next step, the guide, the result's title and the card answered). The phone's
  `Celebrations` takes the legendary badges as seen (`seen`, a phone-only initial state, as the Hud's `open`) and its registry puts the cards where the result has
  them: 12 under the Hud's figures, 12 apart.

### What differed in the first shots, and was fixed

| # | difference | cause | fix | test |
|---|---|---|---|---|
| 1 | `celebrate-earned`: the cards 8 pt higher than the web's (142851 shape pixels) | the web's Hud keeps the compact crisis strip's box (`<div className="mt-2 px-3">`) when there is no crisis: an empty box with its 8 of margin, so every stage of the compact Hud (cards, a card's result, the finances) starts 8 lower than with no box at all. The phone's Play (and `HudScene`) drew nothing there | with no crisis, the strip's place is an empty view, which the page's gap of 8 stands on either side of (the strip itself is not boxed: its touch reaches a point past it) | `Play.test` "keeps, where the HUD is compact, the place of a crisis's strip…" (RED before) |

Measured before writing, so not differences:
- **No glow round a badge's card.** The web's card is `frame frame-gold … shadow-[0_0_12px_…]` (the rarity's glow, `RARITY_GLOW`). Both are box-shadows of the utilities
  layer, and `.frame` is written after the `shadow-[…]` utilities in the compiled stylesheet (Tailwind 4.3.3, compiled from `globals.css`: `.shadow-[0_0_20px_…]` at line
  1784, `.frame` at 1812), so the frame's four strips are what is drawn and no glow at all; the web's shot of `celebrate-earned` shows none round the legendary card. The
  phone draws the gold frame and no glow (`RARITY_GLOW` kept as the web's word for it). The web's test only checks the class.
- **The silver rarity's colour.** `text-ink-100` is no colour of the game's palette (`--color-*: initial` leaves the 31): the word keeps its line's colour (`RARITY_TONE`
  is null for it).
- **The amount's keyboard help** (`keyboard-hint`) is `display: none` unless the page is driven by a keyboard: not drawn, and no gap for it.
- **The chips** (25 %, 50 %, 100 %) are plain `frame-raised` buttons with no `active:` class: they do not sink when pressed (the kit's `Raised` does), so the sheet draws
  them with a frame of its own.

### The residual, with its cause

1. **`celebrate-earned`, 44 shape pixels.** The four lines of each card (12, 18 and 11 pt pixel lines, a 13 pt reading line) stand where the phone lays each on its device
   pixels: within 2/3 pt of the web's (measured: "BADGE EARNED" two device pixels lower, the name one higher, the rarity and the line under it two lower). The bottom row
   of the 12 pt gold line's glyphs falls one row past the text check's window (21 pixels in each card, at 312.33 and 404.33 pt) and two pixels of the "y" of the legendary
   card's name: text, counted as shape. Task 7's class (whole CSS pixels against device pixels). The rims and the badges, drawn 64 into 64 and 64 into 42 (nearest
   neighbour), are the same to the pixel. Record: `ACCEPTED` (`celebrate-earned` 44 / 1 pt).

### On the simulator (not shots)

- **The slider in a sheet** (Task 4's carried question: could a native scroll cancelling the pan under 10 pt be read as a tap?). On the iPhone 16 Pro simulator, in
  `amount-savings`: a tap on the track set $64,000 where it landed; a sideways drag from the middle followed the finger to $100,000; a vertical swipe from the track,
  in the sheet as it is (it does not scroll), changed nothing. Then with the sheet made taller than the screen for the check (a 900 pt footer, not committed), so that
  it scrolls: three swipes from the track (up in 40 ms steps; down in a 0.15 s flick; up a point at a time over the first 9 points, then on) each scrolled the sheet
  and left the amount as it was. Whether the pan failed at its own 10 pt or the scroll cancelled it first, the slider did not read it as a tap: the amount was never
  moved by a scroll. The slider is not changed (Android, where the scroll's slop differs, is still to be checked when its emulator is installed).
- **Coins that fly** (Ruling C). A flight from two lines of a page to the Hud's cash, mounted for the check in Play's news stage (not committed): the coins left the
  middle of each line, three each, one after another, arced to the middle of the cash and were drawn over the Hud's figures (the layer is the screen's `fixed`, drawn
  after the page that scrolls and its sticky header): `phase-2-parity/flying-coins-device.png` (two frames 0.3 s apart). The places were measured with `measureInWindow`
  when the flight began, the layer's own place taken off.

### Full runs: a picture decoded and not painted

Seven full runs of every scene in this task's session (loads 4 to 28). The three scenes above were the same in every one. In every run one to three scenes of the
earlier tasks failed for one sprite missing from the app's shot (the Tokyo icon of `new-unlocked`, the banner of `challenge-practice`, the paper square's icon of
`hud-crisis-details`, the records' trophy of `home-lost-newer` twice, the banner's sky, then the cash icon, then the portrait of `hud-news-r1`, the portrait of
`hud-crisis`, a clipping's icon of `play-pageturn`, the banner of `hud-status-ru`); each was as recorded when shot again alone, so no record was changed. The scene
had said it was ready (no picture being read) and stood still for 3 s: the picture was decoded and not painted. Not the sprite cache's trimming (a temporary log: no
trim in the first nine scenes, where it happens too). Every missing one is a sprite the scene before had drawn too, so its picture is in the cache and its canvas is
drawn with it in the screen's first commit, while the route is still being put on screen.

**The cause, found after this task (commit `d83dbc5`):** react-native-skia 2.14 on iOS drops a redraw request that arrives while the canvas is drawing. A canvas is
handed its drawing from the JS thread (twice a commit of Skia's reconciler: in the commit, `resetAfterCommit`, and a microtask later, once `root.render`'s update has
resolved), each time asking the view there to draw; the view draws on the main thread, and `RNSkView::requestRedraw` keeps one flag for "asked", cleared once the
drawing under way is done. Asked while it is still drawing (on a busy phone, a screen's canvases are handed their pictures while they draw for the first time), the
request is let go, and the new drawing is never drawn: a blank icon, or a picture left as it was, until something redraws the canvas. (The view taken out of its
superview and put back, `removeFromSuperview`, first suspected here, does exist in Skia's code but was not what happened: the blank canvases held their drawing, and a bare
redraw painted it.) **The fix, in the kit (`ui/Canvas.tsx`):** every canvas of the app is the kit's `Canvas` (a test holds that Skia's own is taken nowhere else in the
app), which asks each canvas handed a drawing to draw it once more, from the UI thread (the main thread on iOS), after both of Skia's hand-overs: there the ask waits
for any drawing under way and is never lost. On the simulator: 24/24 drawings lost before, 0/24 after; two full scene runs exit 0 after it. The full account is the
commit's message and `ui/Canvas.tsx`'s own notes.

### What is not compared, and why

- **A flight of coins** is a moment, and its own components fly only on a card's result and the ledger (Tasks 11 and 16, which register their lines): pinned by
  `FlyingCoins.test` (the places, the arc's ends, the delays, once, gone after 12 × 90 + 700 + 200 ms, nothing where motion is left out, nothing redrawn but the layer)
  and the simulator check above.
- **Lives unlocked** (the gold card): no step of the fixed seeds within the scenes unlocks one; `Celebrations.test` holds its words, faces and grouping.
- **The amount sheet's other uses** (what it is for above the amount, what the amount comes to, a way out under the button): Finance's other sheets, Task 12;
  `AmountSheet.test` holds their order.

## Task 11: cards to swipe or press, and what came of them (shots pending)

Not shot in its task (the user's call: two batch passes shoot every scene registered since). The scenes are in `PENDING_SHOTS` (scripts/sceneShots.ts),
unjudged until a batch pass shoots, compares and takes them out of it:

| scene | what it is | held still by |
|---|---|---|
| play-cards-r1 | the engineer's first round, its second card: the office lottery, three choices (pressed, no swipe), the guide's tip under them | nothing moves after 0.28 s |
| play-cards-legendary | the engineer's third round, its second card: the appointment, legendary, two choices (the swipe's two sides said) | `SHINE_HELD_MS` |
| play-cards-three | screen-seed-3, first round, second card: asking for a raise, three choices shown, a fourth (negotiation 2) not shown | nothing moves after 0.28 s |
| play-cards-ru-360 | Russian, 360 wide: screen-seed-10's second round, the AI boom, three long choices, the third tagged for the trade | nothing moves after 0.28 s |
| play-outcome-r1 | the engineer's first card answered (a language course, −$600): the card again, the choice, what changed | nothing moves after 0.28 s |

- **The shine of a rare card** loops for as long as the card is on screen (the rainbow every 4 s, the band of light every 3.6 s), and a legendary card's sparks
  fly until 1.13 s: a shot would catch any moment of them. Both scene pages hold them where the kit's motion pages do (rainbow 2050 ms, light 665 ms, compared
  clean there) and the sparks at their end (gone): the web by a rule of its page (`HOLD_SHINE`, its card's `article` only), the phone by the card's own
  `HeldShine`.
- **A scene takes no touch now, and says it is ready only while its game is where its steps left it** (the stage, the round, the card on screen, a choice being
  taken): Task 9 once shot `play-cards-r1` gone on to a card's result. If anything moves a scene's game again, the run fails on that scene by name instead of
  comparing another picture.
- **Not compared** (no scene shows them; `Cards.test` holds them): the swipe itself (a finger), the choice taken while its answer comes (a moment), the links to
  a career, a city and prison, a rare card that is not legendary, a cover that paid, the credit card's line under a result, coins flying from a result that paid.
- **A phone's own room (fix round 1)**: a link to a career or a city under a choice is the web's 17-point line; its box reaches 4 up to its choice and 10 down
  to the next (12 after the last), never over them, and takes the 13 (11) points that leaves short of a thumb's 44 under it, in the layout: on such a card the
  choices after it stand that much lower than the web's. No scene shows one. Every small pressed thing now has its 44 in its own box (the kit's `reach`):
  React Native looks for no touch past a parent's edge, so a `hitSlop` past it was never found (Home's small print, the crisis strip, the prison tag kept their
  places; only the card's links needed room).

## Task 12: the finances, their tabs, the basket and the portfolio (shots pending)

Not shot in its task (the user's call). The scenes are in `PENDING_SHOTS`, unjudged until a batch pass shoots, compares and takes them out of it; `play-finance-r6`
left `STAND_IN_SCENES` (the app draws the finances now):

| scene | what it is | how its sheet is open |
|---|---|---|
| play-finance-r6 | the engineer's sixth round, the portfolio: at a glance (cash and savings), cash, savings and the pension, no investments yet, what savings pay; someone new, so the guide's first tip of the finances stands over the tabs | no sheet |
| finance-basket | the same, the saver's orders in the basket (a focus, all the cash to savings), for a player who has read the guide | the web's page and the phone's registry draw Finance's `Basket` beside Play |
| finance-pension | the same, the pension plan's sheet: nothing in it, room this round, no way out yet | the web's page presses the pension's line (`main [data-finance-item][aria-haspopup="dialog"]`); the phone's Finance is given it (`FinanceOpened`) |
| finance-tabs-ru-360 | the same in Russian on a phone 360 wide: the row of tabs, which scrolls sideways | no sheet |

- **The tabs not on the phone yet are not shown** (Task 13 the market, property and debt; 14 the way of life; 15 the shop, taxes and businesses): until Task 15 the row
  has the portfolio's tab alone, where the web's has all eight. `finance-tabs-ru-360` is for the batch pass after Task 15, when every tab is drawn.
- **Between the Hud and the tabs**, as on the web's page: the place of a crisis's strip (8, empty with no crisis) and the guide's tip (12 under it, 12 over the tabs).
  The phone's tabs are the second sticky row of the screen (`StickyScreen`'s `subHeader`, `subGap` 12), and what is between them is the screen's `between`: it scrolls
  up under the Hud's figures as the web's does, and the tabs follow it until they meet the figures. (Since the fix round, on the UI thread: the page's offset
  is a Reanimated scroll handler's shared value, the closing an animated style; React hears of a scroll only when a point asked about is passed. On a device,
  in the batch pass: the scroll view's sticky header and the Reanimated handler together, iOS and Android.)
- **A toast over a sheet**: the web's toast stands over its sheets (z 60 over 50). A sheet on the phone is a window of its own, so a toast said while one is open is now
  drawn in it, by the sheet on top (a refusal of what was asked for in the sheet is seen at once, as on the web).
- **Not compared** (no scene shows them; `Finance.test` holds them): a holding and its mark answering an order (jump and sparks, shrink), a broker's loan on a holding,
  a plan and its sheet, the dividends' switch, the basket's put-back line and a move a card decided, the toasts.

## Task 13: the market, property and debts (shots pending)

Not shot in its task (the user's call). The scenes are in `PENDING_SHOTS`, unjudged until a batch pass shoots, compares and takes them out of it. A scene names
the tab of the finances it is drawn on (`Scene.tab`, new): the phone's Finance is given it as its initial state (`FinanceOpened`), the web's page presses the
tab (`main [data-tab="…"]`) and then what opens the sheet, in turn, each once it is there (`PressedInTurn`).

| scene | what it is | how its tab and sheet are open |
|---|---|---|
| finance-market | play-finance-r6's store (the engineer's sixth round, Finance 2), the market: funds, bonds, stocks, crypto and gold, what each did this round and what it pays | the tab: given / pressed |
| finance-buy-stock | the same, Apple's sheet open: once or every round, the blurb, the price since the start of the life (the kit's `LineChart`), no broker's loan yet (Finance 3) | then Apple's row (`[data-finance-item]:has(img[src*="/logo.apple."])`): given (`buy-apple`) / pressed |
| finance-property | the same, the property tab: nothing owned, the homes of London and what is only for letting there, two tiles a row | the tab |
| finance-debt | the engineer's first round, the debt tab: the loan the life begins with, its rate and term, the way to repay it, a personal loan on offer | the tab |

- **Rows as tall as the row's tallest**: the web's grids (the shelves of property, the two buttons under a home) stretch a cell to its row. The tiles are half the
  row each in a wrapping row, their frames filling it (as NewLife's lives); the two buttons are the kit's `Button cell` (new: an equal share of the row, its
  frame as tall as the row). A batch pass checks both against a name that wraps.
- **The market's second line**: an asset that pays nothing and has no plan has the web's line of a lone space, which takes no height; the phone draws no line.
- **Not compared** (no scene shows them; `Finance.test` holds them): a broker's loan in the sheet and its gauge in the debt tab, a plan set from the market,
  a home's own sheet, a sale told in full, a home being sold, the lodger, a parking space bought to let, the mortgage switch and its sheet, the Russian
  sheet that buys and debt rows on a narrow phone (their words wrap, nothing cut but the debt's name, which the web cuts too).

## Task 14: the way of life, the move between cities, the work panel (shots pending)

Not shot in its task (the user's call). The scenes are in `PENDING_SHOTS`, unjudged until a batch pass shoots, compares and takes them out of it.

| scene | what it is | how its tab and sheet are open |
|---|---|---|
| finance-lifestyle | play-finance-r6's store, the way of life: how the engineer works (three ways, her trade works from home), the round's focus at work and in study, a rest, how and where she lives, her cover, her city | the tab: given / pressed (`main [data-tab="lifestyle"]`) |
| finance-move | the same, the sheet of every city open: the one she lives in at the top in gold, the others by what the year leaves there | then the way of life's one button with the sign of a move (`button:has(img[src*="/icon.move."])`): given (`move`) / pressed |
| play-cards-city | the engineer's fourth round, its second card the relocation to London: the city's sheet (`CityPreview`) open over the card, its year beside hers, nothing to order | drawn beside Play on both sides, for the city the card on screen offers (`CardCity`) |
| work-panel | play-finance-r6's store, the profile's work panel on a page of its own (the profile is Task 17): her job and its workplace, the next rung, the round's focus, her skills | the page: the phone's `Screen`, the web's `main mx-auto min-h-safe w-full max-w-md px-3 pb-4 pt-4` |

- **The tab's controls are memoised pieces**, each given what it shows and ordering through the store's one `setOrder`: a switch of focus (`FocusSwitch`), the
  ways of working, of living and of renting, a cover, the city. Pressing one draws again that one, and what its order changes (a way of living changes the
  rents: the row of homes is drawn again with it); `FinanceLifestyle.test` counts it.
- **The sheet of every city** works out every city's year once for the round as it stands, and its rows are memoised: an order that leaves a city's year as it
  is draws no row again.
- **A workplace as wide as the panel** (the web's image `!w-full !h-auto` in a `frame sunk`): drawn into the width it is laid out at, as tall as its art makes
  it (`bannerSize`, as the challenge's banner), so it is drawn once the width is known.
- **`frame-wine` alone draws no frame** (ItemCost's note of what is owed): it only names the colours a `frame`, `bevel` or `frame-raised` would use; the
  note is the wine surface alone on both sides.
- **The rungs and levels of the panel's sheets** say which is the player's as the career a card offers does (`selected`, the web's `aria-current`).
- **Not compared** (no scene shows them; the tests hold them): a city opened from the list and its figures unfolded, the move ordered and taken back, the
  limits of focus (a mastered skill on one line, overtime's toll), the note under health cover, the panel's sheets (career, Finance, a skill, focus, retiring),
  the pieces of a thing looked at closely (`ItemCost`, `ItemUses`, `StatusNote`, for the shop of Task 15 and the profile of Task 17), and the Russian way of
  life on a narrow phone (every choice wraps, a share of its row, nothing cut).

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
