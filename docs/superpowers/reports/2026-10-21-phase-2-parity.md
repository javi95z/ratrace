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

**Unjudged.** (Retired in Task 19: `STAND_INS` and `STAND_IN_SCENES` are gone with the last stand-ins, and a scene is now unjudged only while it waits in
`PENDING_SHOTS` for a batch pass. As it was until then:) While the app draws phase 1's stand-ins for a screen (`STAND_INS` in `sceneShots.ts`, which a test holds equal to the stand-ins
of the app's registry), its scenes are shot but not compared: their line is `"verdict":"unjudged"` with no numbers, and no diff picture is
kept. The task that ports a screen takes its word out of `STAND_INS`, and its scenes are compared from then on. Task 6 ported `home`, task 7
`new`, so their scenes are compared; the five `play-*` scenes of task 5 (`play-news-r1`, `play-cards-r1`, `play-finance-r6`, `play-outcome-r1`,
`play-resolve-r6`) were unjudged: they proved that both clients open each scene, and nothing more. Task 9 ported `play`: `play-news-r1` is compared, and the four
whose stage a later task brings are unjudged by name (`STAND_IN_SCENES`), until that task takes them out. (Both lists, emptied by Tasks 16 and 19, are retired.)

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
Play is the real screen on both sides now (`play` is out of `STAND_INS`, a list retired in Task 19): the web's page draws the web's `Play`, the app's registry the phone's. Its stages that later
tasks bring (the cards and a card's result, Task 11; the finances, Task 12; the ledger, Task 16) are a dashed stand-in line on the phone, so the four scenes of them stay
unjudged by name (`STAND_IN_SCENES` in `sceneShots.ts`, retired in Task 19 once Task 16 had emptied it: `play-cards-r1`, `play-finance-r6`, `play-outcome-r1`,
`play-resolve-r6`; the task that ports a stage took its scenes out). The `hud-*` scenes still compare the HUD alone.

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
   hard on the other (the exception this phase asked for, below, accepted by the user on 2026-10-22). First shot at 3918 shape pixels and 4.33 pt: the lines of the paper the calendar covers in part
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
  phone draws the gold frame and no glow (`RARITY_GLOW` kept as the web's word for it). The web's test only checks the class. (Restored on both sides
  after batch pass 1, by the user's decision: "Decisions after batch pass 1" below.)
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
left `STAND_IN_SCENES` (the app draws the finances now; the list itself is retired since Task 19):

| scene | what it is | how its sheet is open |
|---|---|---|
| play-finance-r6 | the engineer's sixth round, the portfolio: at a glance (cash and savings), cash, savings and the pension, no investments yet, what savings pay; someone new, so the guide's first tip of the finances stands over the tabs | no sheet |
| finance-basket | the same, the saver's orders in the basket (a focus, all the cash to savings), for a player who has read the guide | the web's page and the phone's registry draw Finance's `Basket` beside Play |
| finance-pension | the same, the pension plan's sheet: nothing in it, room this round, no way out yet | the web's page presses the pension's line (`main [data-finance-item][aria-haspopup="dialog"]`); the phone's Finance is given it (`FinanceOpened`) |
| finance-tabs-ru-360 | the same in Russian on a phone 360 wide: the row of tabs, which scrolls sideways | no sheet |

- **The tabs not on the phone yet are not shown** (Task 13 the market, property and debt; 14 the way of life; 15 the shop, taxes and businesses): until Task 15 the row
  has the portfolio's tab alone, where the web's has all eight. `finance-tabs-ru-360` is for the batch pass after Task 15, when every tab is drawn. (Since Task 15,
  all eight are drawn.)
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

## Task 15: the shop, the taxes and the businesses (shots pending)

Not shot in its task (the user's call). The scenes are in `PENDING_SHOTS`, unjudged until a batch pass shoots, compares and takes them out of it. With them all
eight tabs of the web's finances are on the phone.

| scene | what it is | how its tab and sheet are open |
|---|---|---|
| finance-shop | play-finance-r6's store, the shop: what is in reach of the engineer's cash in London (53 things of 57), shelf by shelf, two to a row | the tab: given / pressed (`main [data-tab="shop"]`) |
| finance-item | the same, the sheet of the Omega Speedmaster: its status and what it is good for, what it would resell for, and every way to buy it (new, on instalments with the loan's terms, second hand, without an invoice) | then its tile, the one that draws its picture (`[data-finance-item]:has(img[src*="/item.watch_omega."])`): given (`item-watch_omega`) / pressed |
| finance-taxes | the same, the taxes: the round's tax and what prices took from the cash, what is not declared (pay under the table, crypto) and what it risks, the cash after the round, the escape test | the tab: given / pressed |
| finance-business | the founder's first round (unlocked for the scene's player): her online shop on its line with its two switches, all of it summed, and the kinds she could open | the tab: given / pressed |

- **The shelf is the web's grid**: two to a row (`grid-cols-2 gap-2`: 4 each side of a tile in a row 8 wider than the panel), each tile as tall as the other in
  its row. **The web's container query** (`@min-[400px]`, of the shelf's own width) lays the picture beside the words from 400: the shelf measures itself
  (`onLayout`) and tells its tiles once, when the answer changes; before that it is as wide as the screen makes it (the column, at most 448, less 48), so
  a tablet's first frame is already a row. A phone's panel is under 400 (402 − 24 − 24 = 354), so the shots show the picture above the words, as the web's
  do. (Task 15's brief said 3 columns, or 5 from 460: that was the shop of an older web; today's web, the reference, is two to a row.)
- **The shelves are put on screen two a frame** (`SHELVES_FIRST`, `SHELVES_STEP`, counted in shelves with something on them, so kinds with nothing in reach
  take no frame): the whole shop is some sixty tiles, each a canvas. A `FlatList` would not help there: the shop is a tab inside Play's one scrolling page,
  and a list inside a scroll of its own direction cannot tell what is on screen, so it draws every row anyway (and React Native warns). Every shelf and every
  tile is memoised (primitive props, one stable `onOpen`): each frame draws only the new shelves, asking for everything draws only the tiles that come on the
  shelf, and an order draws only the tiles whose figures it changes (`FinanceShop.test`).
- **An order is given once** (the kit's `useOnce`): every amount sheet (`AmountSheet`: saving, selling, a pension, a loan, opening a business, putting money
  in) gives its amount once each time it is opened, and a thing's sheet (buying it in any way, selling or cancelling it) and a business's sale give their
  order once. A second tap before the sheet has gone gives nothing; a refused one can be tried again (the sheet stays open).
- **The adviser's word** is one paragraph, as the web's: who speaks in the pixel face (gold capitals, `tracking-wider`), what they say in italics after it,
  wrapping under it. The kit's run-on words gained a pixel span and a spacing of their own (`Aside.pixel`, `Aside.tracking`) for it, and for a business's
  stars (`tracking-widest`), dimmed after the gold ones, before what its customers say (the web's `mr-1.5` is a space opened to 6).
- **A business's small switches** are the web's `min-h-9` (36), their touch the 44 a thumb needs (`reach`, 4 above and 4 below, taking no room); on, they
  are lit gold on teal, and said as `selected` (the web's `aria-pressed`, as the cards' choices).
- **Not compared** (no scene shows them; the tests hold them): a thing owned (gold edge, "Yours", "Yours · used"), what it cost and what is owed on it, the
  second-hand sheet's refusals, the residency of Bangkok, the taxes of a place that taxes nothing (one line, one button), a business's sheet (this round,
  what is taken out, who runs it, more money in, the sale, living from it), a business opened this round, and Russian on a narrow phone (a tile's name
  clamped to two lines as the web's `line-clamp-2`, nothing else cut; a business's name cut to its line as the web's `truncate`, the rest wrapping).

## Task 17: the player's profile in a life, its balance, rivals and graph of net worth (shots pending)

Not shot in its task (the user's call). The scenes are in `PENDING_SHOTS`, unjudged until a batch pass shoots, compares and takes them out of it:

| scene | what it is | how its sheet is open |
|---|---|---|
| profile-r6 | the engineer's sixth round, at its news: the profile's sheet over Play (work, family, income, the balance sheet, the rivals, nothing owned), someone new | the web's page presses the portrait (`button[aria-label="Open your profile"]`); the phone's registry draws `ProfileSheet` open beside Play |
| profile-owned | the same round, with a watch, the gym and a phone bought in the fifth (the scene's script: a `buy` step, the round played, the next one opened): the watch's own sheet over the profile | the web's page presses the portrait, then the watch's square (`[role="dialog"] button[title="Casio F-91W"]`); the phone's profile is given it (`ProfileOpened`) |
| balance-r6 | the same round as profile-r6: the net worth's line opened over the profile, with the graph of the start and five rounds (`Bars`, crisp) | the web's page presses the portrait, then the balance line whose words start with "Net worth"; the phone's profile is given the line (`ProfileOpened`) |
| rivals-r6 | the same round: the rivals' board alone in a page's column (the web's `main mx-auto max-w-md px-3 pt-4`, the phone's `Screen`), as it is far down a sheet that scrolls in the profile | no sheet |
| profile-financed | (added at the merge of the lanes) profile-owned's round, with a SEAT Ibiza bought on instalments in the fifth (the `buy` step, `financed`): the car's own sheet over the profile, with what is still owed on it (`ItemCost`'s wine note, its words and figure on one baseline) | the web's page presses the portrait, then the car's square (`[role="dialog"] button[title="SEAT Ibiza"]`); the phone's profile is given it (`ProfileOpened`) |

- **The work panel is Task 14's `WorkPanel`** since the lanes were merged (until then a stub, `WorkPanelStub.tsx`, drew the head of the web's panel only,
  and is gone): `profile-r6` and the profile under the other two sheets are shot with the real panel in the batch pass.
- **A thing's pieces are Task 14's** (`ItemCost`, `ItemUses`, `StatusNote`, `HealthCoverNote`): Task 17 ported them too, in its own lane; the merge kept
  Task 14's, which the shop and the profile both draw, with this task's placement of what is owed and its figure brought into Task 14's `ItemCost`: a row
  aligned at the top, each text let down to the browser's baseline (`owedLine`, from `webBaseline`). A native row's `baseline` reads the texts' boxes, and
  on iOS the kit moves the pixel figure's glyphs about two points further than the words', so it would stand that much below them. `profile-financed`
  shows the line.
- **The net worth after inflation is in the phone's own words** (fix round of Task 17): the web's Balance.tsx asks for a key that left the messages in 3c18114
  (`end.realNetWorth`), so the web shows the key itself. The phone never shows a key: it says "Net worth, after inflation" (`phone.realNetWorth`, in en, es and
  ru). `balance-r6` is in `PHONE_WORDS`: the two shots cannot agree on that line's words, so the batch pass judges the scene by its layout only.
- **Lines that share a baseline** (a figure and its ▸, a pixel 17 in a reading line, a rival's place, name and points, a choice's name and cost, what is owed and its
  figure) are placed from the browser's baselines (`webBaseline`; `webLine` for a line of several texts, in Rivals.tsx then and `ui/fonts.ts` since batch pass 2), as the Hud's are: the batch pass checks them.
- **Not compared** (no scene shows them; `Profile.test` and `Balance.test` hold them): the sheets of the lifestyle, the home (rented and owned) and the
  insurances, and their choices pressed in the finances; a thing sold or cancelled from its sheet; the other lines of the balance sheet (cash, savings, the
  pension, investments by kind, property, businesses, things, debts); a family at home (its picture as wide as the panel); the way out of the life and its
  word when the phone is not saving; a thing's uses (`ItemUses`, the gym's). What is owed on a thing (`ItemCost`'s note) is shot in `profile-financed`.

## Task 18: the end of a life and its share card (shots pending)

Not shot in its task (the user's call). The scenes are in `PENDING_SHOTS`, unjudged until a batch pass shoots, compares and takes them out of it. All four are
drawn with motion left out (`STILL`): the score stands counted, the story risen, the portrait at the end of its line with every mark lit, a rare badge's
confetti still.

| scene | what it is | how its sheet is open |
|---|---|---|
| end-escaped | the engineer of the first fixed seed, played by the saver to the end: out of the rat race at 50 (the fifteenth round), never bankrupt, a rank higher (the promotion card), the lives it opened, its badges | no sheet |
| end-bankrupt | the nurse of screen-seed-4, played by the chaser (`Reach.player`, as Task 16 has it in its lane) to the end: bankrupt with her fourth round, never out | no sheet |
| end-share | end-escaped's life, the picture of it to share open over its end (drawn on the device, a PNG of 1080 × 1348 shown 270 wide) | the web's page presses the end's own `Share this life` button in its `main`; the phone's End is given it (`EndOpened`) |
| end-ru | end-escaped's life in Russian | no sheet |

- **Not drawn on the phone** (online only): where the score stands among the lives of others (the community's), the link to the rankings and the week's
  result (a ranked life), the quick game against others after a life alone (the rooms'). The web draws none of them for a guest with no connection either.
- **The share card** is the web's drawing on a Skia surface of its own (offscreen, CPU where the GPU gives none): four times the grid, sprites nearest
  neighbour, every line cut into the runs of the typefaces that draw it as the kit's texts are (`runsOf`), the pixel ones at the page's height of small
  letters (`PIXEL_X_HEIGHT`, from the fonts' own tables; the web's canvas measures the `x` and the `х`). Skia draws text with the glyphs' advances, without
  the kerning a browser's canvas applies: a line of the card may be a pixel or two narrower than the web's. The batch pass compares a card drawn on each.
- **The share sheet has no file to save** (the web's second way): the phone's share sheet offers saving itself. The picture is written to the cache's
  `share/` folder, emptied first, so one picture is kept at a time. The web's line inviting into the game (`share.invite`, with the web game's address,
  `SITE_URL`, which the phone holds in `game/site.ts`, held to the web's by a test) goes with the picture on iOS (React Native's `Share`, a file and words);
  on Android the picture goes alone (expo-sharing): React Native's `Share` sends words only there, and the file is what is shared. Where the picture cannot
  be had (no share sheet, no surface, no PNG), the sheet says so in the phone's own words (`phone.shareFailed`): the web's speak of a browser.
- **The obituary's title** is a pixel span in a reading line on the web: the kit's reading text now takes a pixel span among the words that run on
  (`Aside.pixel`, its tracking in em).
- **Not compared** (no scene shows them; `End.test`, `Play.test`, `ShareCard.test`, `LifeMap.test` hold them): a badge's sheet, a personal best, the
  legacy line, a life with no badges or no milestones, a quiet line, the motion itself (the rises 350 ms apart from 300, the walker's steps over 3 s, the
  marks lit as it passes, the count-up), the share card's failures, a route of several cities (both lives of the scenes stay in one city).

## The tolerance, and the exception this phase needs

Phase 1 accepted no shape difference beyond a point (3 device pixels) or a shade, apart from a few listed platform ones (a Bar's lamp
bleeding a sliver, a sprite scaled to a fraction: 30 and 47 pixels). Every phase 1 section is a still thing laid out on whole device
pixels. Phase 2 has things that are not: boxes that are turned, scaled and moved by a fraction of a point (the stepped keyframes, held at
a step), and a smooth price line. At their edges Chrome and iOS draw differently, and *that* is what is left in the motion section.

> **Exception accepted by the user on 2026-10-22:** an antialiased one-device-pixel (⅓ pt) edge on a box that is
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
  (`ios.infoPlist.UIViewEdgeAntialiasing` in `app.json`); Expo Go cannot be given that, so it has not been tried. The exception was accepted
  (by the user, 2026-10-22), so this is not needed; it stays a way to take the edges away should that ever be wanted.
- **The turn is flat.** The legendary card and the medal are drawn without real 3D (see 1 above); the card's perspective is exact for the
  plane it turns in. Nothing in the game needs more.
- **Playing is judged by eye, holding by pixels.** The comparison is of frames held still; the same frames play through Reanimated (every
  hook was run live on the simulator and looked right, and the slider and the sticky rows were driven by touch), but no running animation is
  compared with the web's.
- **Android is not measured.** The flat turn avoids the depth problem there too, but nothing was run.

## Task 16: the ledger of a round and the moments of a life (shots pending)

Not shot in its task (the user's call). The scenes are in `PENDING_SHOTS`, unjudged until a batch pass shoots, compares and takes them out of it; `play-resolve-r6`
left `STAND_IN_SCENES` (the app draws the ledger now; the record is empty, and the list itself is retired since Task 19). Each is a real life played to its round by a bot, never a save written by hand:

| scene | what it is | held still by |
|---|---|---|
| play-resolve-r6 | the ledger of the engineer's sixth round, played with the saver's orders: every line risen, the cash and the net worth where they end; someone new, so the guide's tip of the ledger stands over it | motion left out (`STILL`): the wheel of its title turns for ever, its lines rise one by one, its figures count and its coins fly |
| moment-escape | the engineer of the first fixed seed, played by the saver, leaves the rat race with the fifteenth round: the moment's sheet (gold) over that ledger | motion left out: no confetti falls, the picture stands uncovered |
| moment-bankrupt | the nurse of screen-seed-4, played by the chaser (who lives as grandly as the money lasts, `Reach.player`), goes bankrupt with her fourth round: the sheet (wine) over that ledger | motion left out |
| moment-crisis | the engineer of screen-seed-10 (hud-crisis's world) at the news of the fifth round, which the crash opens with: its sheet (wine) over the news and the crisis's bar | motion left out: the bar's lamp pulses for ever |

- **The moments are Play's own** on both sides (a sheet Play mounts, with nothing taken in yet): the registries draw them as `PlayScene` (`moment`), so the web's
  page presses nothing and the phone is given nothing.
- **Where the ledger's coins land is the ledger's own cash** ("Cash now", the web's `data-coin-to` inside Resolve), not the HUD's: the web's Resolve flies them
  inside its own area. The phone's flight is drawn in the screen's layer of coins, measured at take-off: a page scrolled while they fly leaves them where they took
  off from (the web's are in the page and scroll with it). No scene shows them.
- **Not compared** (no scene shows them; `Resolve.test`, `Moments.test` and `Play.test` hold them): the lines rising one by one (80 ms apart, 280 each), the
  figures counting, the change of net worth landing with a jump or a sink and sparks, the confetti falling and the picture uncovered, a milestone's picture, the
  notes of a round (gold, teal, wine, navy; confetti round a promotion), a crisis that ended, the bank's and the family's lines, the badges a round earned.

## Task 19: the records of past lives and the collection (shots pending)

Not shot in its task (the user's call). The scenes are in `PENDING_SHOTS`, unjudged until a batch pass shoots, compares and takes them out of it. The
records and the collection were the last two of `STAND_INS`: with them ported no stand-in is left, and `STAND_INS` and `STAND_IN_SCENES` are retired
(a scene is unjudged only while it waits for its shot). Phase 1's `Placeholder` is gone: the online routes, `rankings`, `room` and `player`, go home
(no solo screen leads to them, and the phone plays offline). `challenge` is not one of them: the week's challenge is a solo screen, ported in Task 6
(`WeeklyChallenge`: its practice is a life of one's own), and its route draws it. The lives are real, never written by hand: three, each of the lives to begin with, played to their
ends one after another by a bot through the round store (`LIVED` in packages/core/src/testing/scenes.ts), a day apart, the latest the day before
`SCENE_NOW`, and let go as the game lets a life go once its last screen is left:

| scene | what it is | how its sheet or tab is open |
|---|---|---|
| records-empty | a device on which no life has been finished: the title and the line that says so | none |
| records-three | the nurse of screen-seed-4 played by the chaser (bankrupt once, 221, the most status: 80), the civil servant of screen-seed-3 played by the landlord ($2,840,073, the greatest net worth), the engineer of the first fixed seed played by the saver (out at 50, 496, the best score); the bests, "3 lives lived · 1 escape · 1 bankruptcy", and the three lines, the latest first (21, 20 and 19 Oct 2026) | none |
| records-detail | the same, with the engineer's sheet: Tokyo · London, out at 50 · 7 badges, score 496, $2.73M | the web's page presses the first past life once the lives are read (`PressedWhenDrawn`, `main button[aria-haspopup="dialog"]`); the phone's Records is given its id (`opened`, the scene's `sheet`: `id-3`) |
| collection-badges | the badges of the three lives (15 of 63), all rarities | none: the page opens on the badges |
| collection-items | the things the three owned (36 of 67, nearly all the nurse's) | the web's page presses the things' tab (`main [data-tab="items"]`); the phone's Collection is given it (`tab`) |

- **The graph of a life (RunDetail) is Task 17's `WorthGraph`** since the lanes were merged: until then a stub (`WorthGraphStub.tsx`) kept the graph's
  place and drew nothing, and is gone. `records-detail` is shot with the real graph in the batch pass.
- **A badge not yet earned is the web's `grayscale` card**: its pictures, its frame, its ground and its words are greyed by the filter. The phone has no
  filter of a whole view on iOS (React Native's `filter` is Android's but for brightness and opacity), so it draws each in grey itself: the colours through
  `grey` (theme.ts: the CSS matrix at its full amount, `GREYSCALE`, on the colours as written, sRGB), the frame's strips by `Framed`'s `grey`, and the rim
  and the lock through the same matrix as a Skia colour filter (`Sprite`'s `grey`, `Medal`'s). Whether the browser applies its filter functions to sRGB
  values (as Chrome is understood to) or to linear light, the shot says: a difference there is a grey a few steps off on every locked card.
- **The page of the collection is one list**, its head (the title, its words, the tabs, the tab's count and rarities) the list's header, scrolling away with
  the badges as the web's page does. The web's panel of the tab (`role="tabpanel"`) is not named: no prop of a `FlatList` puts a role on the box of its
  rows alone, and iOS and Android say nothing of a tab panel. The tabs are a tab list of their own. The records' list is the web's section of past lives,
  named as it is, its header the page above its lines.
- **A past life's line says it opens the whole of the life** (the web's `aria-haspopup="dialog"`, which the browser says in its own words): a hint in the
  phone's own words, `phone.opensLife`.
- **The columns** are the web's container queries on its `main` (`@min-[460px]`, `@min-[560px]`), read from the width of the phone's column inside its gutter
  as it is laid out (`ListScreen`'s `onWidth`, `columnsAt`): a phone's column is at most 448, 424 inside, so three rarities to a row, two things, one badge.
- **Not compared** (no scene shows them; `Records.test` and `Collection.test` hold them): a life the server played (the ranked tag), a practice of a challenge,
  the loading line, a short last row of things, a secret badge's hint in Spanish or Russian, the rarities chosen one at a time.

### The lists: a `FlatList`, the page and all

The records' past lives grow with every life finished, and the collection has 67 things and 63 badges, each tile with its pictures (a thing's sprite, a badge's
rim and badge: 126 canvases on the badges' tab alone): both pass thirty rows, so both are lists that draw only what is near the screen. A `FlatList` inside a
`Screen` would be one scroll inside another, which windows nothing, so the page itself is the list: `ListScreen` (ui/Page.tsx), `Screen`'s column with the
page's head (the title, the tabs, the bests) as the list's header, which scrolls away with the rows as the web's page does. Not `numColumns`: the web groups the
things by the shop's shelves and the badges by their groups, each under a heading as wide as the page, which a grid of cells cannot hold, so a line of the list
is a heading or a row of `columns` tiles (`linesOf`), each tile in its share of the row and a short last row leaving its places empty, as the web's grid does.
The list draws about a screen of rows at first, six more a batch, and only two screens either side of what is seen (`LIST_WINDOW`: 8, 6, and a
window of 5 where React Native's is 21, which would mount every badge within a few idle batches). No `getItemLayout`: the lines are a heading or a row
of tiles, and a tile's height follows its words. A row is drawn from its datum alone (a thing owned, a badge earned, a life's name, day and score are in
it), the list's renderer stays the same function and is memoised (`strictMode`), so a page drawn again for its head draws no row again; the tiles and
the lines of past lives are `memo` with plain props: another rarity chosen leaves the badges that stay as they are (`Collection.test`), and a sheet
opened draws no line again (`Records.test`). The page keeps only the breakpoint its width reaches, not the width. In jsdom a virtual list lays nothing out and would draw its first ten rows only, so the screens' tests are
given a `FlatList` that draws every row (`everyRow`, testing/fakes.ts); the kit's own test of `ListScreen` holds that the real one windows.

## Batch pass 1: every scene shot, compared and judged

The first batch pass (after the merge of the lanes, a33cbb5) shot every scene on both clients, the thirty-nine of Tasks 11 to 19 and the merge for the first
time and the twenty-six judged before again (their records were measured with the old `VISIBLE_HEIGHT` rule, gone since the web's d67284b, and under the
`Untouched` wrapper the scene route has drawn since Task 11). `PENDING_SHOTS` is empty. Simulator: iPhone 16 Pro, iOS 18.0, Expo Go 58.0.5, Metro on 8090;
the web by its own `next dev` on 3021 in Playwright's Chrome. Load average during the runs 4 to 25 (11 cores).

**First full run (before any fix):** the twenty-six judged scenes came back with their records' numbers (re-confirmed: nothing moved under the wrapper or
without `VISIBLE_HEIGHT`); of the thirty-nine new ones six were clean and thirty-three differed (the largest: `end-share` 734 692 shape pixels, `finance-pension`
199 975, `finance-buy-stock` 167 762, `work-panel` 131 743, `finance-shop` 126 673, `profile-r6` 104 171; worst text 129.67 pt).

**The last two full runs** (after every fix of this pass, e94c6a0 and on; each `web app compare` of all 65 scenes, from scratch): 44 clean, 18
accepted (each with its record, `ACCEPTED` in `sceneShots.ts`), `home-lost-newer` phone words with a clean layout, `balance-r6` phone words with an
accepted layout, `legal` not comparable (within its baseline). Both exit 0. The table is the last run's. (Five runs between were stopped by the
machine, not by a scene: the simulator shut down once, refused a screenshot or a URL four times, locked once, and Chrome timed out a page once under
a load of 40; `simctl` is now tried again where it fails, f4df504. One run found the engineer's sky missing in `records-three`: fixed, e94c6a0.)

| scene | verdict | raw % | beyond % | a point away (px) | shape (px) | of which blended edges | text lines | worst text (pt) |
|---|---|---|---|---|---|---|---|---|
| home-new | clean | 3.62 | 0.419 | 6897 | 0 | 0 | 15 (0 unmeasured) | 0.67 |
| home-continue | accepted | 2.93 | 0.496 | 7145 | 1 | 1 | 15 (0 unmeasured) | 0.67 |
| home-settings | clean | 2.31 | 0.405 | 5973 | 0 | 0 | 29 (15 unmeasured) | 0.33 |
| home-lost-newer | phone words, layout clean | 4.11 | 0.804 | 12541 | 0 | 0 | 17 (0 unmeasured) | 5.67 |
| new-first | accepted | 3.28 | 0.588 | 8072 | 738 | 148 | 25 (1 unmeasured) | 2 |
| new-unlocked | accepted | 3.22 | 0.653 | 8709 | 738 | 148 | 32 (1 unmeasured) | 2 |
| new-locked | accepted | 5.9 | 2.287 | 13056 | 738 | 148 | 65 (9 unmeasured) | 2 |
| new-replace | accepted | 2 | 0.491 | 5509 | 310 | 1 | 31 (26 unmeasured) | 1 |
| play-news-r1 | accepted | 3.78 | 1.027 | 14127 | 1443 | 1443 | 42 (4 unmeasured) | 0.67 |
| play-cards-r1 | clean | 4.87 | 1.171 | 9740 | 0 | 0 | 42 (0 unmeasured) | 0.67 |
| play-cards-legendary | accepted | 5.42 | 0.981 | 9198 | 1 | 0 | 35 (0 unmeasured) | 0.67 |
| play-cards-three | clean | 5.24 | 0.52 | 8752 | 0 | 0 | 40 (0 unmeasured) | 0.33 |
| play-cards-ru-360 | clean | 5.2 | 1.134 | 9375 | 0 | 0 | 37 (0 unmeasured) | 0.67 |
| play-finance-r6 | clean | 4.48 | 1.203 | 16450 | 0 | 0 | 53 (9 unmeasured) | 1 |
| play-outcome-r1 | clean | 3.66 | 1.089 | 9926 | 0 | 0 | 31 (0 unmeasured) | 0.67 |
| play-resolve-r6 | clean | 4.52 | 1.072 | 13298 | 0 | 0 | 41 (8 unmeasured) | 0.67 |
| play-news-r6 | accepted | 4.21 | 1.131 | 13520 | 1443 | 1443 | 41 (4 unmeasured) | 0.67 |
| play-guide-r1 | accepted | 6.16 | 3.776 | 20606 | 3453 | 1979 | 42 (5 unmeasured) | 1.33 |
| play-fault | clean | 3.02 | 0.405 | 6203 | 0 | 0 | 6 (0 unmeasured) | 1 |
| play-pageturn | accepted | 3.93 | 1.338 | 16653 | 3897 | 3878 | 51 (8 unmeasured) | 0.67 |
| finance-basket | clean | 1.59 | 0.142 | 2535 | 0 | 0 | 56 (49 unmeasured) | 0.33 |
| finance-pension | clean | 2.51 | 0.431 | 5661 | 0 | 0 | 69 (53 unmeasured) | 0.67 |
| finance-tabs-ru-360 | accepted | 4.37 | 1.489 | 13962 | 0 | 0 | 53 (4 unmeasured) | 3 |
| finance-market | clean | 3.85 | 1.304 | 13915 | 0 | 0 | 61 (8 unmeasured) | 1 |
| finance-buy-stock | accepted | 2.91 | 0.959 | 4716 | 149 | 149 | 83 (61 unmeasured) | 1 |
| finance-property | clean | 6.21 | 0.91 | 11014 | 0 | 0 | 40 (2 unmeasured) | 1 |
| finance-debt | clean | 3.63 | 0.903 | 10032 | 0 | 0 | 36 (0 unmeasured) | 1 |
| hud-news-r1 | clean | 2.87 | 0.187 | 2393 | 0 | 0 | 20 (0 unmeasured) | 0.67 |
| hud-cash | clean | 1.26 | 0.179 | 2734 | 0 | 0 | 30 (20 unmeasured) | 0.33 |
| hud-flow | clean | 1.28 | 0.243 | 4271 | 0 | 0 | 32 (19 unmeasured) | 0.67 |
| hud-race | clean | 2.23 | 0.416 | 7333 | 0 | 0 | 36 (20 unmeasured) | 0.33 |
| hud-status-ru | clean | 2.22 | 0.434 | 5284 | 0 | 0 | 44 (20 unmeasured) | 0.67 |
| hud-jailed | clean | 3.38 | 0.617 | 9418 | 0 | 0 | 33 (21 unmeasured) | 0.67 |
| hud-crisis | clean | 3.1 | 0.178 | 2717 | 0 | 0 | 21 (0 unmeasured) | 0.33 |
| hud-crisis-details | clean | 2.66 | 0.843 | 7915 | 0 | 0 | 33 (21 unmeasured) | 0.67 |
| amount-savings | clean | 1.57 | 0.153 | 2119 | 0 | 0 | 30 (19 unmeasured) | 0.67 |
| celebrate-legendary | clean | 1.21 | 0.261 | 4274 | 0 | 0 | 24 (19 unmeasured) | 0.67 |
| celebrate-earned | clean | 3.44 | 0.759 | 7641 | 0 | 0 | 27 (0 unmeasured) | 0.67 |
| challenge-practice | clean | 4.21 | 0.757 | 11058 | 0 | 0 | 15 (0 unmeasured) | 0.67 |
| legal | phone words, not comparable | 14.42 | 10.864 | 248192 | 39721 | 215 | 34 (0 unmeasured) | 281 |
| finance-lifestyle | clean | 4.38 | 0.844 | 10660 | 0 | 0 | 47 (4 unmeasured) | 1 |
| finance-move | clean | 1.88 | 0.447 | 8509 | 0 | 0 | 72 (47 unmeasured) | 0.67 |
| play-cards-city | clean | 2.76 | 0.301 | 3137 | 0 | 0 | 50 (37 unmeasured) | 1 |
| work-panel | clean | 2.46 | 0.549 | 6575 | 0 | 0 | 33 (0 unmeasured) | 0.67 |
| finance-shop | clean | 3.88 | 1.021 | 12145 | 0 | 0 | 50 (6 unmeasured) | 1 |
| finance-item | clean | 3.05 | 0.836 | 12431 | 0 | 0 | 71 (50 unmeasured) | 0.67 |
| finance-taxes | accepted | 4.09 | 1.045 | 12390 | 31 | 31 | 48 (4 unmeasured) | 1 |
| finance-business | accepted | 4.84 | 1.906 | 16719 | 35 | 1 | 58 (7 unmeasured) | 1 |
| profile-r6 | accepted | 2.14 | 1.142 | 7267 | 30 | 0 | 77 (42 unmeasured) | 0.67 |
| profile-owned | clean | 1.53 | 0.38 | 3903 | 0 | 0 | 85 (77 unmeasured) | 0.67 |
| balance-r6 | phone words, layout accepted | 2.02 | 0.695 | 8586 | 1469 | 0 | 90 (77 unmeasured) | 2.33 |
| rivals-r6 | clean | 2.77 | 0.281 | 4571 | 0 | 0 | 20 (0 unmeasured) | 0.33 |
| end-escaped | clean | 3.09 | 0.598 | 11156 | 0 | 0 | 24 (0 unmeasured) | 0.33 |
| end-bankrupt | accepted | 3.15 | 0.624 | 11821 | 5 | 5 | 25 (1 unmeasured) | 0.33 |
| end-share | accepted | 1.22 | 0.544 | 6842 | 5085 | 4267 | 28 (25 unmeasured) | 0.67 |
| end-ru | accepted | 4.27 | 2.184 | 12258 | 168 | 54 | 25 (0 unmeasured) | 0.67 |
| moment-escape | clean | 4.75 | 0.898 | 10354 | 0 | 0 | 52 (40 unmeasured) | 0.67 |
| moment-bankrupt | clean | 2.44 | 0.591 | 9284 | 0 | 0 | 54 (39 unmeasured) | 0.67 |
| moment-crisis | clean | 2.94 | 0.996 | 10154 | 0 | 0 | 56 (42 unmeasured) | 1 |
| records-empty | clean | 2.61 | 0.118 | 2312 | 0 | 0 | 3 (0 unmeasured) | 0.33 |
| records-three | clean | 3.48 | 0.743 | 7633 | 0 | 0 | 28 (0 unmeasured) | 0.67 |
| records-detail | clean | 2.29 | 0.313 | 2894 | 0 | 0 | 42 (28 unmeasured) | 0.67 |
| collection-items | clean | 4.05 | 0.352 | 5552 | 0 | 0 | 14 (0 unmeasured) | 0.67 |
| collection-badges | clean | 5.23 | 0.618 | 9827 | 0 | 0 | 29 (0 unmeasured) | 0.67 |
| profile-financed | clean | 2.47 | 1.242 | 11286 | 0 | 0 | 95 (77 unmeasured) | 1 |

### What differed, and was fixed in the app

| # | difference (scenes) | measured cause | fix | test |
|---|---|---|---|---|
| 1 | the basket's button narrower and its words smaller than the web's, the savings' Save and Withdraw too (every scene of the finances; 12 836 shape pixels each, the bar's label 19.67 pt off) | the web writes `px-3 text-[14px]` (`px-2 text-[13px]` beside the savings, `text-[14px]` on a city's "All cities" and "See the figures") on its `Button`, whose own `px-4 text-[17px]` come later in the stylesheet and win: `getComputedStyle` gives 17 px and 16 px of side on all of them | every Button is 17 and 16 in; the kit's `size` and `padX` are gone, and the city's "See the figures" is 17 | `kit.test` |
| 2 | the page under a sheet the web's page opens by a press stood 228 pt lower (`finance-pension`, `finance-buy-stock`, `finance-move`: 199 975, 167 762, 84 020) | the sheet gives the focus to its slider or panel, and Chrome scrolls the page to what took it, though the sheet is fixed (`window.scrollY` 228) | the web's scene page puts the page back at its top a few frames after its presses (`PressedInTurn`, kit page only): the phone's scene opens the sheet at the top of its page | `sceneShots.test` (the run) |
| 3 | a cheer's confetti larger than the web's (`play-resolve-r6`) | the web's `absolute -inset-1` picture is held to its 40-point box by the page's `img { max-width: 100% }`: measured 40 × 48 | the loop is drawn into 40 × 48 (`CHEER`) | `Resolve.test` (the run) |
| 4 | the rung's status 5 pt under the web's under the pay (`work-panel`), every line under it with it; the tile of a thing 2.75 pt short (`finance-shop`), the city lived in 2 pt short (`finance-move`) | a tag the web sets inline in a line of reading text (15, a line of 1.45) stands in that line, 21.75 tall, its words on the line's baseline, 1 down (measured on the web's pages); the phone drew the bare 19-point tag; and the pay and its ▸ were a native row on their texts' baselines, taller than the browser's line | the kit's `LineTag` (the line from `webBaseline`s; a pixel cell's line where the web's is one, the owned home's status in the profile); the pay and the focus figure with their ▸ placed on the browser's line (`Figured`) | `Work.test` and the run (batch pass 1 cited `kit.test`, which had no LineTag test then; batch pass 2 added them: `kit.test`'s two LineTag tests, the default reading line and the pixel 15 line) |
| 5 | a city's sheet 10 pt taller (`play-cards-city`), the price chart's caption 5.5 pt high (`finance-buy-stock`), a past life's sheet 2.33 pt short (`records-detail`) | rows the web lays `items-baseline` were native rows on their texts' baselines: the kit moves a text's glyphs inside its box (`baselineShift`), so the baselines a native row reads are not where the glyphs stand, and the row grows | Versus, the price caption, the score and worth of a past life, a level's head and the down payment's row placed from the browser's baselines (`webLine`, in `ui/fonts.ts` since batch pass 2) | the run, and `fonts.test` (webLine's tops, baseline and height; batch pass 2) |
| 6 | the ▸ of a figure that opens 1 pt narrower and the figure before it 1.33 pt right (`work-panel`, `profile-r6`, under the backdrop of `profile-owned`: 350 px); the business's ✓ wider (6.33 pt) | Chrome draws both in the system font (`.SFNS`, `CSS.getPlatformFontsForNode`), and scales a system font past the stack as it scales Jersey (the pixel ▸ is 7.223 wide at 11 px, the reading one 5.266: 1.372, Jersey's 1.3745, not SF's 1.103); the phone used SF's own small letters, and drew the ✓ from Zapf Dingbats | a system-font run in pixel text is scaled as Jersey (an emoji keeps its own scale: the dice, measured); the ✓ is the system font's | `fonts.test` |
| 7 | a frame's bottom strip a device pixel under its box's fill (`end-ru`: 990 of 1140 px), the light edge of an owned thing's tile a device pixel short of its corner (`collection-items`) | Yoga rounds a child's place relative to its parent but the parent's size from its edges on the screen: at a fractional place a strip set `bottom: -2, height: 2` stood 550.33 where the fill ended at 550.00 | a strip anchored to the far edge (bottom, right) is laid from the near edge with its colour as the border there (`placeOf`, Frame.tsx): its far edge is rounded where the parent's is | `Frame.test` |
| 8 | (development) Reanimated's warning on every screen that scrolls: "Dependencies should only be used on the web" | the page's scroll handler was given a list of dependencies, and the sticky page's animated reaction another (f1979fa) | none given | the Metro log |
| 9 | the engineer's sky missing behind his face on the records (`records-three`, 3434 px, in a full run after the canvases were laid together) | each picture of a canvas of layers read itself inside the Skia tree: one that came in later redrew only itself, and the canvas was never asked again to draw it (Skia 2.14's lost request, blank-sprites-report) | the pictures are read outside the canvas, which is put in once all are in (e94c6a0) | `Sprite.test`, the run |

### What the comparison was taught (tooling)

- **A line's ink in another line's box** is the other line's only where its colour could be that line's (the colour, or a blend of it with the dark grounds,
  or its background): the gold descenders of a name over the box of the cream line under it are the name's (`play-cards-ru-360`'s 15 pixels; `end-escaped`'s 59).
- **A line something is drawn over** (the page under the fixed bar of the next step) claims no ink: the bar's own "$265,571" over a "Withdraw" under it.
- **Two rects of one line** (its words and the ellipsis that cuts them short) are one line's; the next line of a paragraph is still a line of its own.
- **A line clipped by its box** (`truncate`, a row of tabs that scrolls) is measured where it is drawn, not where its words would run on to (`TEXT_BOXES`).
- **A line under a `grayscale` filter** is looked for in the grey its colour is drawn in (`collection-badges`: 1197 → 0).
- **The web's link that saves the picture's file** is hidden in `end-share`'s web shot (`WEB_ONLY`): the phone's share sheet saves the file itself (Task 18).
- **A scene of the phone's own words** may have a record of its shape alone (`phone words, layout accepted`): `balance-r6`.

### The residuals accepted, with their causes

| scene | shape (px) | worst text (pt) | measured cause |
|---|---|---|---|
| play-cards-legendary | 1 | 0.67 | one pixel of the edge of the band of light over the card's picture, held at the same moment on both sides: motion-2's own residual |
| finance-tabs-ru-360 | 0 | 3 | the savings' label and rate cut short: Chrome's ellipsis keeps the space before its dots ("4,2% …"), iOS's tail truncation draws its own glyph after the last letter ("4,2%…") |
| finance-buy-stock | 149 | 1 | the price line's antialiased edge (phase 2's exception), the same points on both sides |
| finance-taxes, finance-business | 31, 35 | 1 | the tops of the letters of a line under the bar of the next step peek over its edge a device pixel apart (the line is covered at its middle, so not measured as text) |
| profile-r6 | 30 | 0.67 | the career bar's lit lamps bleed a device-pixel sliver into the first dark one on the web (phase 1's class) |
| balance-r6 | 1469 | (phone words) | the phone's "Net worth, after inflation" is longer than the key the web shows; its glyphs past the web's line box are in no window of the text check |
| end-bankrupt | 5 | 0.33 | five pixels of a gold edge on the last row compared (839.67 pt), antialiased at a fractional place on the web |
| end-share | 5084, 5085 (record 5090) | 0.67 | the picture to share is a picture: Skia's glyphs (no kerning) against the canvas's, each smoothing the 1080-wide card into 270 points its own way; the web's own picture changed in 677 pixels between two shots of the same page |
| end-ru | 168 | 0.67 | the prized badge's confetti centred in a panel a fraction taller in Russian: on another device pixel, their pieces at the foot cut a pixel apart |

The records of Tasks 6 to 10 were tightened to what this pass measured (`new-locked` 1267 → 738, `new-replace` 1159 → 310, `play-news-r1` 1446 → 1443,
`play-news-r6` 1518 → 1443, `play-guide-r1` 3504 → 3453, `play-pageturn` 4309 → 3897, worst text 1 → 0.67 on four of them); `celebrate-earned` is clean (its 44
pixels were glyph edges the text check did not cover) and has no record any more.

## Batch pass 1: the device checks

Every "to check in the batch pass" item of the task reports (11 to 19), the merge report, the blank-sprites report and `progress.md`, on the
iPhone 16 Pro simulator (iOS 18.0), in the release build unless said otherwise. This machine has no iPad simulator and no Android emulator or `adb`:
what only those can show is said so, not guessed.

| # | item (from) | how it was checked | result |
|---|---|---|---|
| 1 | The card swipe's feel and threshold (T11) | Drags on a two-choice card, through the probe (UI frames) | ok: a 171-pt drag let go picks (`from swipe`, the outcome on screen 50 to 81 ms after the release, settled 64 to 97 ms); the UI thread drew 60 frames a second, none missed, through all five drags |
| 2 | A swipe on a card of more than two choices does nothing (T11) | The same drag on the office lottery (three choices) | ok: nothing chosen, the card stays |
| 3 | A double tap makes one move (Review focus, T15) | Two taps 600 ms apart on a choice of a card; two taps 20 ms each, back to back, on a thing's "Buy for $22,491" | ok: one choice, one save (one `saveGame` in the store's timeline), the outcome once; one order in the basket ("1 order"), no refusal |
| 4 | Modal swaps: the pension's In/Out re-keys its AmountSheet; the BuySheet's Once/Every round re-keys it (T12, T13) | Pressed both ways on each | ok: the sheet stays shown, its title and words change, no flash seen in the shots before and after |
| 5 | The slider in a scrolling sheet (T13) | Dragged the pension's handle 26 → 230 pt | ok: the amount follows ($28,500), the sheet does not scroll; Confirm puts the order in |
| 6 | Reanimated's scroll handler with the sticky header, the closing rows, the away strip (T12) | Scrolled and flung the Market tab down and back | ok: the Hud closes to its strip (name, age, round), the tabs stick under it, both follow a fling and open again at the top |
| 7 | The `Untouched` scene wrapper (T11) | Pressed "Play the round" in the scene `play-finance-r6` in Expo Go | finding: the page takes no touch, but the bar at the foot of Play (the screen's fixed layer, outside the wrapper) and a sheet (a Modal, a window of its own) still do: the press played the round. Guarded already: a scene whose game moves says it is not ready, and the run fails naming it (`Ready`); no run of this pass was moved. Left as it is (tooling only) |
| 8 | The iOS share sheet carries the picture and the invite (T18) | Shared the end's picture, chose Copy, read the simulator's pasteboard | ok: a PNG (`rat-race-engineer-496`, 76 KB) and the invite ("Can you do better? Play The Rat Race: …/en") together. The sheet offers **Save to Files, not Save Image**: Photos is not offered (the app declares no photo-library use); a decision for you, below |
| 9 | Android: the file alone (T18) | — | not checked here (no Android device); the code hands Android the file only, as reported in Task 18 |
| 10 | Greyed badges against Chrome's `grayscale` (T19) | `collection-badges` shot | ok: clean (0 shape pixels, the greyed words measured in their grey) |
| 11 | `paddingBottom: 40` at a list's foot (T19) | Records flung to its end with 60 lives | ok, with a note: the last row stands 40 pt above the screen's edge, 6 pt above the 34-pt home indicator, as the web's `pb-10` stands above the bottom of the page it scrolls; nothing is under the indicator |
| 12 | `profile-owned`, `end-ru` and the Russian obituary title (merge) | Shots | ok: `profile-owned` clean; `end-ru` accepted (168 px: the prized badge's confetti a device pixel apart, measured) |
| 13 | Records and the Collection's badges flung, rows windowed (T19) | 60 lives on the records (`perf?runs=records-three&copies=20`), flung down and back; the badges' tab likewise | ok, with the frames below (performance): every row comes in, only rows near the screen are mounted |
| 14 | Things list → a thing, on iOS (T18) | A car bought, then the profile's Things, then the car | ok: the list goes, the thing's sheet comes, nothing half gone |
| 15 | The business sheet's Modal replaced by the InvestSheet's (T15) | `finance-business`'s life: the shop's sheet, then "Put more money in" | ok: the business sheet goes and the amount sheet comes in its place, no flash seen |
| 16 | Two Modals at once, legendary and escape (T16) | — | not reached (no life earned a legendary badge on the round it left the rat race); left for Task 20 |
| 17 | A toast over a sheet; the coins while the page is scrolled (T12, T16) | — | not reached in this pass; left for Task 20 |
| 18 | The shelf's column → row jump on a tablet (T15) | — | not checked: no iPad simulator on this machine (one iPhone 16 Pro, iOS 18.0) |
| 19 | VoiceOver on a result with a badge; TalkBack's live regions (T11, T16) | — | not checked: no screen reader is driven from here |
| 20 | Every record re-confirmed without `VISIBLE_HEIGHT` (T12) | Full runs | ok (the shots' section above) |

## Batch pass 1: the release build and its performance

**The build.** `npx expo prebuild --platform ios --clean` in apps/mobile (`ios/` and `android/` are ignored by git), then
`LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 CI=1 npx expo run:ios --configuration Release --device <the booted iPhone 16 Pro> --no-bundler`
(CocoaPods 1.17 under Ruby 4 stops on "Unicode Normalization not appropriate for ASCII-8BIT" without a UTF-8 locale). No account or signing is asked
for on the simulator. A build with the timing probe is the same command with `EXPO_PUBLIC_PERF=1`. Simulator: iPhone 16 Pro, iOS 18.0, on this Mac
(11 cores; load average 4 to 7 during the measures, with Finder and a system save panel at 80 to 99 % of a core each in the last ones).

**The probe** (`ui/perf.ts`, `ui/perfProbe.tsx`, `scripts/perf.ts`): marks drawn with what they mark (a stage, a tab, a sheet, the front door), timed
from the last touch let go (or a swipe let go, told from the UI thread) to:
- *drawn*: the mark's commit, then a hop to the UI thread after that commit's mounting and one of its frames;
- *settled*: the first two UI frames in a row at the display's pace after it (≤ 25 ms apart): the screen's pictures drawn into their canvases, whatever
  the mounting set going. **The budgets are judged on settled**, the later and stricter of the two.

Each frame of both threads is counted a second at a time, each UI frame over 25 ms told as it comes, the store's calls timed, and each step of a
`useCountUp` timed from its value set to its commit. Everything is told by HTTP to `scripts/perf.ts` on 127.0.0.1:8095 (the simulator's own host).
A build without the flag has none of it: `perf.test.ts` puts `perf.ts` and `app/perf.tsx` through Expo's Babel preset and Metro's constant folding
(as a release build does) and finds no `require` of the probe or of the perf lives; and the release bundle built without the flag (`main.jsbundle`,
14.3 MB) holds none of the collector's address, `perfProbe`, `timedStore`, `putSceneLife`, `putSceneRuns`, `slowFrame` or `settledMs` (0 matches each;
the marks' names stay as the props of a component that draws nothing). The route `theratrace:///perf?…` puts a scene's life (or its finished lives,
many times over) on the phone, in a build with the flag only (anywhere else it goes home).

**What a change cost, measured** (the release build with the probe; *before* is the build of bae93fe, *after* the build of f1979fa; settled, median of
five or more, in ms; drawn beside it where it says more):

| budget | what | before (settled) | after (settled) | after, drawn | verdict |
|---|---|---|---|---|---|
| cold start to Home ≤ 2000 | `simctl launch` to the front door drawn | 937 (1399, 937, 874, 954, 907) | 928 (1507, 928, 925, 962, 925) | — | pass |
| Home → Play ≤ 300 | Continue → the round's news | 146 (209, 146, 47, 111, 164) | 74 (74, 111, 63, 146, 47) | 46 | pass |
| stage ≤ 200 | news → cards | 54 (n 14) | 47 (n 10) | 30 | pass |
| stage ≤ 200 | cards → outcome, pressed | 70 (n 14) | 61 (n 8) | 45 | pass |
| stage ≤ 200 | cards → outcome, swiped | 133, 63 (n 2) | 65 (82, 65, 64, 97, 65) | 50 | pass |
| stage ≤ 200 | outcome → finances | 77 (161, 77, 69, 77) | 90 (76, 44, 143, 108, 72, 106) | 52 | pass |
| stage ≤ 200 | finances → resolve, round 6 | 231 (239, 281, 145, 222) | 166 (180, 166, 208, 150, 83); a second five 215 (197, 215, 221, 226, 196): 202 over the ten | 98; 130 | **at the budget** (below) |
| stage ≤ 200 | finances → resolve, round 20 (the round that ends a long life; 63 lives on the phone) | — | 222 (238, 189, 209, 242, 239, 197, 193, 235, 261, 145) | 149 | **over** (below) |
| stage ≤ 200 | resolve → news | 101 (45, 157; n 2) | 99 (115, 98, 96, 131, 99) | 30 | pass |
| stage ≤ 200 | resolve → end of a long life | 275 (n 1) | 130 (130, 129, 113, 130, 130); again 115 (112, 111, 162, 120, 115) | 47 | pass |
| finance ≤ 150 | the finances opened (their first tab) | 77 | see above | 52 | pass |
| tab ≤ 150 | portfolio | 58 | 49 | 34 | pass |
| tab ≤ 150 | market | 113 | 113 | 54 | pass |
| tab ≤ 150 | property | 114 | 100 | 50 | pass |
| tab ≤ 150 | business | 45 (n 1) | 109 (59, 109, 163, 62, 112) | 43 | pass |
| tab ≤ 150 | debt | 44 | 46 | 29 | pass |
| tab ≤ 150 | lifestyle: on screen / every panel in | 196 (n 9; all of it at once) | 80 / 147 | 30 | pass |
| tab ≤ 150 | shop: on screen / every shelf in | 146 / 178 | 114 (60, 114, 126, 98, 133) / 481 | 43 | pass (on screen); the last shelf comes in over half a second, while the first are read |
| tab ≤ 150 | taxes | 97 (n 1) | 46 (80, 32, 46, 136, 46) | 29 | pass |
| sheet ≤ 150 | a Sheet opened (cash, pension, buy a fund, sales, the escape bar) | 47 (Sales) | 46 (Cash), 59 (Pension), 47 (Buy, five: 98, 46, 47, 46, 98) | 30 | pass |
| swipe 60 fps | five drags of a two-choice card, UI frames | — | 60 a second, 0 missed in every second of a drag | — | pass |
| fling, no drop | Records flung down and back | 28 frames missed with 63 lives (17, 1, 5, 5) | 9 with 63 lives (3, 2, 0, 0, 2, 2), the longest 36 ms; 17 with 121 lives after e94c6a0 (4, 4; 1, 2, 6), the longest 42 ms | — | **over** (below) |
| fling, no drop | the Collection's badges, down and back | — | 10 (2, 1, 2, 1, 1; 1, 1, 0, 1), the longest 37 ms | — | **over** (below) |
| count | `useCountUp` during Resolve: JS from a step's value set to its commit | 114 steps, 458 ms in all, median 4.19, worst 9.35 | 114 steps, 343 to 400 ms in all, median 2.8 to 3.4, worst 6.1 to 17.4 (five rounds) | — | reported |

**What was over, its cause, and the fix** (each a commit of this pass):

1. **The Lifestyle tab** (settled 196): one commit of ~900 views and 28 canvases; the UI thread then spent 100 to 300 ms making them (`sample` of the main
   thread: `-[CAMetalLayer nextDrawable]` and `CAImageQueue` for each canvas's first drawing, Fabric's mounting). *Fix* (50dbacf): the tab draws its
   first screen (how the job is done, the focus, the skills) and the rest once that is on screen and the UI thread draws at its pace again
   (`ui/drawnFirst.ts`): 80 on screen, 147 for every panel.
2. **The shop's last shelf** (178): the shelves were put in one batch a frame, so each batch's mounting followed the last's with no frame between.
   *Fix* (50dbacf): the next shelves once the last are on screen and the UI thread is calm (`whenShown`): the tab on screen in 114; the rest comes in
   behind while the first shelves are read.
3. **Finances → resolve** (231): the JS thread's commit 66 to 192 ms, then 50 to 110 ms frames on the UI thread. The CPU profile of the step
   (Hermes, through Metro's inspector, in a development build) is mostly React drawing the resolve page; beside it, `@ungap/structured-clone` (the
   `structuredClone` Expo's runtime installs, written in JavaScript, which the engine and the session call on every move: 17 ms of the step) and the
   formatjs number polyfill. *Fixes*: the phone clones the game's plain data through Hermes's native JSON (93db088; `clone.test.ts` plays four whole
   lives both ways and finds every view alike); the loops of the page are one canvas each (e298982); the ledger is drawn first, the cash, net worth
   and sayings once it is on screen (bc40658). 166 after (the three together; not measured one by one).
4. **The end of a long life** (275): the end page's map, life line, rivals, graph and badges (some thirty canvases) in the stage's own commit.
   *Fix* (50dbacf): the end draws its first screen, the rest once it is on screen: 130.
5. **Canvases** everywhere: a loop (the wheel, a coin, confetti) was four canvases, a list's face two (sky and portrait), a medal two (rim and badge).
   *Fix* (e298982): `SpriteLayers` lays pictures together on one canvas, pixel for pixel where each lay alone: a loop is one strip moved under a box
   of one frame. The Records fling: 28 frames missed → 9.

**What is still over, and why it is left:**

- **Finances → resolve at round 6: 202 over ten** (166 in one set of five, 215 in the next, the same build and life; the Mac was loaded by two
  processes of its own at a core each, Finder and a save panel, through the second). The touch to the commit is 104 to 110 ms of it: the round
  (engine and saves, under 10 ms) and React drawing the resolve page, the Hud's new figures and the finances' tab taken down; then 50 to 97 ms of UI
  frames mounting it. What is left is the page itself, which the web draws in one go as well.

- **The round that ends a long life, finances → resolve: 222** (a 20-round life, 63 finished lives on the phone from the fling test). The JS thread's
  commit is 100 to 170 ms: the engine's last round and its score, the finished life written (`addRun` reads and writes every past life as one JSON
  value: 15 to 28 ms), the lives read again for the records and the rank (`listRuns` 22 to 71 ms), and the resolve page. The same change at round 6
  is 166. Storing each life under its own key would take the write off this step (not the read the records need); left as a concern, as it changes
  how the phone keeps its lives.
- **Flings of Records and of the badges: 9 and 10 frames missed** over a fling down and back (each 33 to 37 ms: one frame dropped at a time). Each
  row a FlatList brings in is mounted, and its canvases made, on the UI thread while the list moves; on this simulator a canvas's first drawing goes
  through Metal's XPC to the Mac's GPU (`MTLSimDriver`, the `nextDrawable` above), which a phone's GPU does not. Not fixed further here; to be
  measured on a device (phase 4's TestFlight build) before anything else is traded for it.

**The share card's sheet** (not a budget): on screen in 28 ms, its picture drawn on the JS thread for 712 ms after (`MakeOffscreen`, the PNG; the UI
thread kept 60 frames a second, the JS thread missed 42). A press in that time waits for it.

**The simulator is not the phone.** Every time above is from the iPhone 16 Pro simulator on this Mac. The JS thread runs at the Mac's speed (faster
than a phone's); the UI thread's canvases go through Metal's simulator driver (slower than a phone's GPU). A device, Android above all, was not
available here: the budgets are to be measured there again before a release.

## Decisions after batch pass 1

The user's decisions of 2026-10-22 on what batch pass 1 left for them, and the controller's ruling on the last round's time. Items 1 and 2 change the
web on the `expo` branch (they reach `dev` when `expo` is merged, in phase 5). Every scene they change on either side is in `PENDING_SHOTS` for the
next batch pass, with no record: it is shot, compared and judged there.

### 1. The rarity's glow round a badge's card, drawn on both sides

- **The web.** The card is `frame frame-gold … shadow-[0_0_12px_…]`; `frame` is a box-shadow of the same layer written after the `shadow-[…]`
  utilities, so no glow was drawn. The frame's box-shadow now ends with the glow the element names, `var(--glow, 0 0 #0000)`, under its four strips;
  `--glow` is registered as the frame's colours are (`@property`, not inherited; reset in the base layer for a browser without `@property`), and the
  rarity's class sets it (`[--glow:0_0_12px_rgba(233,177,60,0.6)]`). No other `frame` changes: it gains a transparent shadow of no size, which draws
  nothing. Held by `Celebrations.test` (web), which compiles `globals.css` with Tailwind for the card's classes and applies them in the stylesheet's
  order: the frame's four strips, then the glow of each rarity; the bronze card the frame alone (RED before: the strips alone).
- **The phone.** `Glow` (ui/Glow.tsx), laid under the card as its first child: the card's box in the glow's colour on a canvas of the kit's, blurred
  by a Gaussian of half the blur (`BlurMask`, the deviation Chrome blurs a box-shadow by), clipped to outside the box (an outer shadow is not drawn
  under its box), on a canvas three deviations wider each side (6/12/20 px blur: 9, 18, 30 pt). Held by `Glow.test` and `Celebrations.test` (phone).
- **Scenes.** `celebrate-earned` and `celebrate-legendary` wait for the next batch pass. Neither had a record (both were clean without the glow).


### 2. The web's own bugs, fixed on the `expo` branch

**A screen's size on a `Button`.** The web's Button wrote `px-4 py-2 text-[17px]` with the screen's classes after them; the stylesheet writes
`px-4` after `px-3` and `p-1`, and `text-[17px]` after `text-[14px]` and `text-sm`, so a screen's sides and size were never drawn (Tailwind 4.3.3,
compiled from `globals.css`). The Button now leaves out each of its own that a screen's class takes the place of (`ownSize` in ui/kit.tsx: `px-4`
for `p-*`/`px-*`, `py-2` for `p-*`/`py-*`, `text-[17px]` for a font size); a screen's one side (`pl-2`, written after the Button's two) or a class
at a width (`sm:px-2`) is drawn as it always was. Held by the web's `kit.test` (RED before: `px-4` beside `px-3`). Every caller that gives a size or
sides keeps it, each a button set smaller beside other things in its row or under a note:

| caller | classes | on the phone |
|---|---|---|
| Play: the basket beside the round's button | `shrink-0 px-3 text-[14px]` | `size={14} padX={12}` |
| Finance: save and withdraw beside the savings | `shrink-0 px-2 text-[13px]` | `size={13} padX={8}` |
| Finance, a city: the way back to every city | `self-start text-[14px]` | `size={14}` |
| Finance, a city: the fold of its figures | `text-[14px]` | its `Raised`'s words at 14 |
| Guide: "Got it", "Skip the guide" | `flex-1 text-[15px]`, `text-[14px]` | `size={15}`, `size={14}` |
| Settings: dismiss a notice; Rankings, Room, the app's install | `shrink-0 text-[14px]`, `shrink-0 text-[13px]`, `shrink-0 px-2 text-[13px]`, `shrink-0 px-3 text-[14px]` | online only, not on the phone |

The phone's Button has its `size` and `padX` again (taken out in batch pass 1 to draw what the web drew). Held by the phone's `kit.test`,
`Finance.test`, `FinanceLifestyle.test` and `Play.test` (RED before: 17, 16 in). The scenes that draw one of these buttons, found by drawing every
scene on the phone with its Button counted: `play-cards-r1`, `play-finance-r6`, `play-resolve-r6`, `play-guide-r1`, `balance-r6`, `profile-r6`,
`profile-owned`, `profile-financed`, `moment-escape`, `moment-bankrupt`, `moment-crisis` (the guide's note on the stage) and the thirteen
`finance-*` scenes (the basket's button; the savings' two in `play-finance-r6`, `finance-basket`, `finance-pension`, `finance-tabs-ru-360`). All wait
for the next batch pass. Their records stay where the change does not touch their cause (`play-guide-r1`'s note is as tall: its buttons are 44 high
at 15 or 17; `finance-taxes`, `finance-business`, `finance-buy-stock`, `profile-r6`).

**`finance-tabs-ru-360`: the savings' words are whole again.** With buttons of 17, 16 in, the savings' label and rate were cut ("Сбе…",
"4,2% …") on both sides, and the scene had a record for the ellipses. `Finance.test` measures the line in Russian at 360 from the fonts' own
advances (`testing/widths.ts`, read by `scripts/fontCoverage.ts`'s table reader; no kerning taken off, so a line is never found narrower than the
phone sets it): the line has 312 (360, less the gutter and the panel's padding each side); the buttons are 67.7 and 47.4 wide at 13, 8 in; the
amount (`245 786 $`, a pixel 15) 71.8; that leaves the words 97.1, where the label needs 87.7 and the rate 57.6 (RED with buttons of 17, 16 in: 39.5).
The record is gone and the scene waits for the next batch pass, which shoots it.

**The raw key `end.realNetWorth`.** `git log -S realNetWorth`: the key was not renamed. It was `end.realNetWorth` ("After inflation",
"Descontando la inflación", "С учётом инфляции") when the balance sheet's net worth asked for it (b8174b1, 2026-10-13), and 3c18114 (2026-10-14) took
it out of the messages when the end of a life stopped using it, while the balance still did. It is back in en, es and ru with those words. Held by
the web's `Balance.test` (RED before: next-intl's MISSING_MESSAGE, and the key on the page). The phone asks for the same key, and
`phone.realNetWorth` ("Net worth, after inflation") is gone. `balance-r6` is no longer a scene of the phone's words (`PHONE_WORDS`), its record
(1469 shape pixels, the phone's longer words) is gone, and it waits for the next batch pass.

### 3. Save the picture, to the phone's photos

The web's picture sheet has a second way, a link that saves the PNG as a file (`share.save`, "Save the picture"), under Share where the browser has
a share sheet, in the secondary colours. The phone draws it there as a secondary button, in the same words, which adds the picture to the phone's
photos (`expo-media-library` 58.0.11, `Asset.create` of the PNG written to the cache's `share/` folder, as for Share). It asks for leave to add only,
never to read: `requestPermissionsAsync(true)`; `app.json` gives the config plugin iOS's add-only words ("The Rat Race saves the picture of your life
to your photos.", `NSPhotoLibraryAddUsageDescription`) and no words for reading (`photosPermission: false`: no `NSPhotoLibraryUsageDescription`), and
on Android no kind of media to read (`granularPermissions: []`: no `READ_MEDIA_IMAGES`). Under the buttons it then says, in the phone's own words
(`phone.pictureSaved`, `phone.saveRefused`, `phone.saveFailed`; Russian without the player's gender, Spanish as the game speaks): saved, not allowed
(and where to allow it), or not saved. A second press while it saves does nothing. Held by `ShareCard.test`: a save allowed, refused, failed (and
tried again), a double tap, Spanish and Russian (RED before: no button). `end-share` is compared whole now (the web's link was hidden in its shot,
`WEB_ONLY`) and waits for the next batch pass; its record (the picture's own residual) stays.

**To check in the next batch pass, on iOS:** the system's question as the player first saves (its words, add-only), the picture in Photos after it
(its size, 1080 × 1348, and that it is the one on screen), and the sheet's words for a refusal (Settings → The Rat Race → Photos → None). Android:
the plugin still declares `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` and `READ_MEDIA_VISUAL_USER_SELECTED` (it always does); whether a
write-only request is granted on Android 10 to 12, where it asks for `WRITE_EXTERNAL_STORAGE`, is for an Android device.

### 4. The motion-2 exception, accepted

The one-device-pixel antialiased ring on a transformed edge and the smooth chart lines (section "The tolerance, and the exception this phase needs",
and motion-2's residual) are accepted by the user on 2026-10-22 as a residual class: the records that rest on it (`play-pageturn`,
`finance-buy-stock`, `play-cards-legendary`) stand as they are.


### 5. One finished life per key on the phone (the controller's ruling)

**The change.** `KvStore` (apps/mobile/src/kvStore.ts) keeps each finished life under `ratrace:run:<runId>`, with the ids in `ratrace:runs:index`,
oldest first, where it kept them all in one value (`ratrace:runs`) read and written whole each time a life ended. `addRun` writes the life, then the
index (not again for a life it already names: the step that ends a life saves it twice); `removeRun` takes the life's key away, then its id from the
index; `listRuns` reads the index and the lives. The lives read once are held: the step that ends a life calls `listRuns` after `addRun` (the profile
counts the lives, `tellProfile`; the rank, `settleRank`; the provider, as a life ends), and each of those reads only the index, to see that no other
store on the phone wrote meanwhile (the timing probe's route puts lives with a store of its own); the lives are read again only when it changed. Calls
about lives are made one at a time; one that fails lets go of what is held. A life that cannot be read is left out of the list and kept.

**The move from the one value**, on the first read: every life to its own key, then the index (the old value's ids, with any the index named), then
the old value taken away, last. Killed at any write, the old value is still there and the next read does it again: nothing lost, nothing twice. A
write cut short is mended on the next start: an id with no life (a removal cut between its two writes) is left out of the index; a life no id names
(an addition cut between its two) is taken in, after the others.

**Tests** (`kvStore.test.ts`, RED before: 10 of 14): add, add again, remove, a bad record, the list's order; the move, and the move killed before each
of its five writes; an addition and a removal cut short; the lives held (a second `listRuns` reads the index only), another store's writes seen,
copies handed out; and the guard: 63 lives on the phone, a nurse played by the saver to the last round of her life, and the step that ends it writes
that life (again with each save of the step) and the index once, nothing that holds any of the 63, and reads none of them. Real finished lives are 3 to
5 KB each (`records-three`'s: 3177, 4960, 5003 bytes): 63 of them were some 250 KB read and written on that step.

**Measured** (release build with the probe, iPhone 16 Pro simulator, iOS 18.0; 63 or 64 finished lives on the phone; the finances of the round that
ends `moment-escape`'s life, `perf?life=moment-escape&last=1`, then "Play the round" pressed; the store's calls as the probe times them, wall clock on
the JS thread; *before* is HEAD's store, built the same way minutes apart):

| | before (one value) | after (a key each) |
|---|---|---|
| `addRun` on the step (its first, with the game's save) | 16 to 95 ms, median 23.7 (n 10) | 1.2 to 18 ms, median 3.4 (n 13) |
| `listRuns` on the step (the profile's count) | 2 to 6 ms | 0.8 to 15 ms (the index only) |
| `listRuns` as the life ends (the provider's, after the commit) | 28 to 81 ms | 39 to 99 ms: queued behind the step's own JS work on the clock, not the store's (it reads the index) |
| finances → resolve, settled | 224, 190, 162, 231, 198, 184, 180, 230, 171, 197: **median 194** | 261, 210, 214, 262, 173, 147, 148, 115, 255, 260 (load 7 to 12): **median 212**; then 298, 176, 164 (load 3 to 5) |
| the move of 64 lives from the one value (once, at the start after the update) | — | 165 ms, with the front door drawn after it |

The write is off the step (some 20 ms less on it), as the ruling meant. The step itself did not come out faster on this Mac: its time is the commit
(the engine's last round and score, the resolve page: 61 to 189 ms) and the UI thread's frames after it (the longest 35 to 165 ms), which the store
does not touch, and it moved with the Mac's load more than with the change (the after set was taken at a load of 7 to 12, the before set at 3 to 6).
The measures were cut short when the simulator's window could no longer be pressed (the desktop moved it to another Space). The step's budget is
for Task 20 to settle, on a quiet machine and on a device.

## Batch pass 2: every scene shot again, and judged line by line

**The rule changed first** (8fb816a). An `ACCEPTED` record's text bound was a scene-wide maximum (`worstPt`): every line of a scene could stand as
far off as its worst one. A record now names its lines (`lines`, by the first forty letters the web's text check gives them) with a bound each, and
every other line of the scene is held to the point. Of the seventeen records, four named a line beyond the point: the dice of a new life
(`🎲 At random`, 2 pt: the emoji, Apple Color Emoji 2 pt lower on iOS than on macOS Chrome) in `new-first`, `new-unlocked` and `new-locked`; and the
headline under the guide's note in `play-guide-r1` (4/3 pt: the note's foot on a whole CSS pixel on the web, a device pixel on the phone). The other
thirteen bounds were within the point and are gone. Recomputed from batch pass 1's shots, the new rule found one line the old one hid:
`finance-tabs-ru-360`'s tab title "Твои инвестиции", 1.33 pt narrower on the phone (under that scene's old bound of 3).

**Lines in the phone's own words** (`PHONE_WORDS`) are named too, by the web's words for them, and only they are left out: `home-lost-newer` judges
every line but the notice (the web says to reload the page, the phone to update the app), `legal` its way back, title and first section (the same
words on both) and holds its other words to their baseline. Each line judged beyond the point is written in the report's JSON (`far`).

**What differed, and was fixed**:

| scene | what | cause | fix |
|---|---|---|---|
| finance-tabs-ru-360 | the tab title "Твои инвестиции" 1.33 pt narrower | the web adds `:lang(ru) .pixel`'s word spacing (−0.16 em) to whatever letter spacing the element has (the tab's 0.1 em); the phone took it off the pixel face's 0.03 em, whatever the style said | the space takes the style's spacing (6d9e122; `text.test`) |
| the eleven scenes with the guide's note (`play-guide-r1`, the moments, the profiles…) | no gold ring round the note, on either side | the web's note named a 3 px gold ring as `shadow-[…]`, which its bevel's box-shadow, later in the stylesheet, took the place of; the phone copied the loss | under the user's decision 4 (the web's own bugs fixed on `expo`): the web's `bevel` and `frame-raised` draw `--glow` under their strips (as `frame` since 9de0a33); the note and a room's shout name theirs; the phone's note stands in its ring (e9e478c). Seen in the shots: the ring on both |

**The twenty-seven waiting** (the badges' glow, the balance's words, the buttons a screen sizes, the guide's ring, the picture's sheet) were shot first:
26 clean or within their records, `finance-tabs-ru-360` differed (above). The records kept while they waited are confirmed at the numbers they had:
`play-guide-r1` 3453, `finance-buy-stock` 149, `finance-taxes` 31, `finance-business` 35, `profile-r6` 30, `end-share` 5084/5085 (record 5100, tightened in the fix round to 5090: the most measured, 5085, and 5 for the web's own picture, which moved the count by one pixel in four runs).
`celebrate-earned` and `celebrate-legendary` are clean with their glow; `balance-r6` is clean in the web's words ("After inflation" on both);
`finance-tabs-ru-360` is clean (its savings line whole beside buttons of 13). `PENDING_SHOTS` is empty.

Seen with my own eyes in the shots (side by side): the legendary badge's teal glow and the common one's none, the guide's gold ring round its bevel,
the basket's "No orders" at 14 and the savings' Save/Withdraw at 13, "After inflation" on the balance, the picture's sheet with Share and "Save the
picture" on both.

**Two full runs**, every scene on both clients, from scratch on the final code (Metro restarted with its cache cleared after the last change), the
web's `next dev` its own: **run A** exit 0 (load 5.9 → 4.9), **run B** exit 0 (load 4.1 → 2.9): 46 clean, 17 accepted, `home-lost-newer` phone words
layout clean, `legal` phone words not comparable, in both; the only number that moved is `end-share`'s shape, 5084 then 5085 (the web's own picture,
known). Two earlier runs were stopped by this pass's own edits, not by a difference: a core file saved while `next dev` served the web's pages
reloaded them, and two web shots came out blank or half-drawn (`finance-lifestyle`, `hud-status-ru`); no edit was made during the two final runs.

Run B, scene by scene (shape = pixels a point away that are not text; worst text = the farthest a judged line stands; far = the judged lines beyond a
point, by their words):

| scene | verdict | raw % | shape (px) | of which blended | text lines | worst text (pt) | far | run A, where it differs |
|---|---|---|---|---|---|---|---|---|
| home-new | clean | 3.62 | 0 | 0 | 15 (0 unmeasured) | 0.67 | — |  |
| home-continue | accepted | 2.93 | 1 | 1 | 15 (0 unmeasured) | 0.67 | — |  |
| home-settings | clean | 2.31 | 0 | 0 | 29 (15 unmeasured) | 0.33 | — |  |
| home-lost-newer | phone words, layout clean | 4.11 | 0 | 0 | 17 (0 unmeasured, 2 phone words) | 0.67 | — |  |
| new-first | accepted | 3.28 | 738 | 148 | 25 (1 unmeasured) | 2 | 🎲 At random 2 |  |
| new-unlocked | accepted | 3.22 | 738 | 148 | 32 (1 unmeasured) | 2 | 🎲 At random 2 |  |
| new-locked | accepted | 5.9 | 738 | 148 | 65 (9 unmeasured) | 2 | 🎲 At random 2 |  |
| new-replace | accepted | 2 | 310 | 1 | 31 (26 unmeasured) | 1 | — |  |
| play-news-r1 | accepted | 3.78 | 1443 | 1443 | 42 (4 unmeasured) | 0.67 | — |  |
| play-cards-r1 | clean | 4.87 | 0 | 0 | 42 (0 unmeasured) | 0.67 | — |  |
| play-cards-legendary | accepted | 5.42 | 1 | 0 | 35 (0 unmeasured) | 0.67 | — |  |
| play-cards-three | clean | 5.24 | 0 | 0 | 40 (0 unmeasured) | 0.33 | — |  |
| play-cards-ru-360 | clean | 5.23 | 0 | 0 | 37 (0 unmeasured) | 0.67 | — |  |
| play-finance-r6 | clean | 4.33 | 0 | 0 | 52 (8 unmeasured) | 0.67 | — |  |
| play-outcome-r1 | clean | 3.66 | 0 | 0 | 31 (0 unmeasured) | 0.67 | — |  |
| play-resolve-r6 | clean | 4.45 | 0 | 0 | 41 (8 unmeasured) | 0.67 | — |  |
| play-news-r6 | accepted | 4.21 | 1443 | 1443 | 41 (4 unmeasured) | 0.67 | — |  |
| play-guide-r1 | accepted | 6.19 | 3453 | 1979 | 42 (5 unmeasured) | 1.33 | New regulator created to regulate the re 1.33 |  |
| play-fault | clean | 3.02 | 0 | 0 | 6 (0 unmeasured) | 1 | — |  |
| play-pageturn | accepted | 3.93 | 3897 | 3878 | 51 (8 unmeasured) | 0.67 | — |  |
| finance-basket | clean | 1.52 | 0 | 0 | 56 (49 unmeasured) | 0.33 | — |  |
| finance-pension | clean | 2.51 | 0 | 0 | 68 (52 unmeasured) | 0.67 | — |  |
| finance-tabs-ru-360 | clean | 4.05 | 0 | 0 | 51 (4 unmeasured) | 0.67 | — |  |
| finance-market | clean | 3.78 | 0 | 0 | 61 (8 unmeasured) | 0.67 | — |  |
| finance-buy-stock | accepted | 2.91 | 149 | 149 | 83 (61 unmeasured) | 1 | — |  |
| finance-property | clean | 6.13 | 0 | 0 | 40 (2 unmeasured) | 0.67 | — |  |
| finance-debt | clean | 3.56 | 0 | 0 | 36 (0 unmeasured) | 1 | — |  |
| hud-news-r1 | clean | 2.87 | 0 | 0 | 20 (0 unmeasured) | 0.67 | — |  |
| hud-cash | clean | 1.26 | 0 | 0 | 30 (20 unmeasured) | 0.33 | — |  |
| hud-flow | clean | 1.28 | 0 | 0 | 32 (19 unmeasured) | 0.67 | — |  |
| hud-race | clean | 2.23 | 0 | 0 | 36 (20 unmeasured) | 0.33 | — |  |
| hud-status-ru | clean | 2.17 | 0 | 0 | 44 (20 unmeasured) | 0.67 | — |  |
| hud-jailed | clean | 3.38 | 0 | 0 | 33 (21 unmeasured) | 0.67 | — |  |
| hud-crisis | clean | 3.1 | 0 | 0 | 21 (0 unmeasured) | 0.33 | — |  |
| hud-crisis-details | clean | 2.66 | 0 | 0 | 33 (21 unmeasured) | 0.67 | — |  |
| amount-savings | clean | 1.57 | 0 | 0 | 30 (19 unmeasured) | 0.67 | — |  |
| celebrate-legendary | clean | 1.21 | 0 | 0 | 24 (19 unmeasured) | 0.67 | — |  |
| celebrate-earned | clean | 3.42 | 0 | 0 | 27 (0 unmeasured) | 0.67 | — |  |
| challenge-practice | clean | 4.21 | 0 | 0 | 15 (0 unmeasured) | 0.67 | — |  |
| legal | phone words, not comparable | 14.42 | 39721 | 215 | 34 (0 unmeasured, 27 phone words) | 0.67 | — |  |
| finance-lifestyle | clean | 4.31 | 0 | 0 | 47 (4 unmeasured) | 0.67 | — |  |
| finance-move | clean | 1.88 | 0 | 0 | 72 (47 unmeasured) | 0.67 | — |  |
| play-cards-city | clean | 2.68 | 0 | 0 | 50 (37 unmeasured) | 0.67 | — |  |
| work-panel | clean | 2.46 | 0 | 0 | 33 (0 unmeasured) | 0.67 | — |  |
| finance-shop | clean | 3.81 | 0 | 0 | 50 (6 unmeasured) | 0.67 | — |  |
| finance-item | clean | 3.05 | 0 | 0 | 71 (50 unmeasured) | 0.67 | — |  |
| finance-taxes | accepted | 4.01 | 31 | 31 | 48 (4 unmeasured) | 0.67 | — |  |
| finance-business | accepted | 4.77 | 35 | 1 | 58 (7 unmeasured) | 0.67 | — |  |
| profile-r6 | accepted | 2.14 | 30 | 0 | 77 (42 unmeasured) | 0.67 | — |  |
| profile-owned | clean | 1.53 | 0 | 0 | 85 (77 unmeasured) | 0.67 | — |  |
| balance-r6 | clean | 1.85 | 0 | 0 | 90 (77 unmeasured) | 0.67 | — |  |
| rivals-r6 | clean | 2.77 | 0 | 0 | 20 (0 unmeasured) | 0.33 | — |  |
| end-escaped | clean | 3.09 | 0 | 0 | 24 (0 unmeasured) | 0.33 | — |  |
| end-bankrupt | accepted | 3.15 | 5 | 5 | 25 (1 unmeasured) | 0.33 | — |  |
| end-share | accepted | 1.33 | 5085 | 4267 | 29 (25 unmeasured) | 1 | — | A: accepted 5084 1 |
| end-ru | accepted | 4.27 | 168 | 54 | 25 (0 unmeasured) | 0.67 | — |  |
| moment-escape | clean | 4.75 | 0 | 0 | 52 (40 unmeasured) | 0.67 | — |  |
| moment-bankrupt | clean | 2.44 | 0 | 0 | 54 (39 unmeasured) | 0.67 | — |  |
| moment-crisis | clean | 2.94 | 0 | 0 | 56 (42 unmeasured) | 1 | — |  |
| records-empty | clean | 2.61 | 0 | 0 | 3 (0 unmeasured) | 0.33 | — |  |
| records-three | clean | 3.48 | 0 | 0 | 28 (0 unmeasured) | 0.67 | — |  |
| records-detail | clean | 2.29 | 0 | 0 | 42 (28 unmeasured) | 0.67 | — |  |
| collection-items | clean | 4.05 | 0 | 0 | 14 (0 unmeasured) | 0.67 | — |  |
| collection-badges | clean | 5.23 | 0 | 0 | 29 (0 unmeasured) | 0.67 | — |  |
| profile-financed | clean | 2.47 | 0 | 0 | 95 (77 unmeasured) | 1 | — |  |

## Batch pass 2: the device checks

On the iPhone 16 Pro simulator (iOS 18.0). Save Image in the release build (it reads the app's own Info.plist); the two sheets and the toast in Expo
Go on Metro with `EXPO_PUBLIC_PERF=1` (for the probe's route), after the fixture was added to it.

| # | check | how | result |
|---|---|---|---|
| 1 | Two Modals at once: a round that leaves the rat race and earns a legendary badge (the moment's sheet and the badge's) | `perf?escape=early` (new: the influencer of a fixed seed at the finances of round 7, whose round, played with no orders, leaves the rat race at 38 and earns `escaped_before_40` and the first million); "Play the round" | **finding, fixed**: only the badge's sheet was shown; the moment's never was, before or after it. The simulator's log: `[UIKit:Presentation] Attempt to present <RCTFabricModalHostViewController> … which is already presenting <RCTFabricModalHostViewController>`. iOS presents one Modal at a time from a view controller. *Fix* (92feb98): the kit's `Sheet` takes turns (`overlay.tsx`): a sheet holds its turn from when it opens until its Modal has gone; a sheet drawn inside another is presented by it at once; of sheets opened together the last opened shows first, as the web's last portal is on top. Checked again: "Out of the rat race!", then "Your first million" (the Moments' one sheet, one moment after the other), then the legendary "Out before 40", each whole; no UIKit error in the log. Tests: `overlay.test` (four), `Moments.test` (the round itself) |
| 2 | A toast over an open sheet: an order refused while a sheet is open | `perf?life=play-finance-r6`, the shop: a watch bought ($118K left), then the Porsche 911's sheet and "Buy for $200,098" | ok: the sheet stays open and the toast "Not possible: You do not have enough cash." rises inside it, 112 over its foot, over its words (the web's toast stands over its sheets, z 60 over 50) |
| 3 | Save Image: the permission prompt, the picture in Photos, a refusal | Release build, `xcrun simctl privacy … reset photos-add`; the end of `moment-escape`'s life, Share this life, Save the picture | ok. The prompt: "“The Rat Race” Would Like to Add to Your Photos" / "The Rat Race saves the picture of your life to your photos." / Don't Allow, Allow. Don't Allow: "The Rat Race may not add to your photos. You can allow it in Settings." under the buttons, nothing saved. Allowed (iOS ends the app when a privacy setting changes; opened again from "See how your last life ended"): "Saved to your photos."; the picture is `DCIM/100APPLE/IMG_0007.PNG`, 1080 × 1348, the card shown. The built Info.plist has `NSPhotoLibraryAddUsageDescription` and no other usage description (no microphone, no background mode since 0dc7e6f) |

## Batch pass 2: performance (release build)

**Builds.** Two release builds with the probe (`EXPO_PUBLIC_PERF=1`), each from `npx expo prebuild --platform ios --clean`: *before* is the sources of
07c8544 (where this pass began: `apps/mobile/src` and `packages/core/src` checked out from it for the build, then put back), *after* is 33e1546
(every change of this pass to the stores, the resolve page and the end; the sheet turns, 92feb98, came later and do not touch these steps). Each installed fresh (no data), 63 finished lives put with `perf?runs=records-three&copies=21`, the app opened
again so it starts with them. Ten presses each of "Play the round", after one press not counted; the load average (`uptime`, 1 min) with every set.

| step | before (07c8544) | after | load |
|---|---|---|---|
| finances → resolve, round 6 (`perf?life=play-finance-r6`), settled | 104, 160, 54, 65, 181, 147, 116, 214, 130, 163: **median 138** | 113, 148, 112, 111, 113, 129, 162, 212, 129, 67: **median 121** | 3.6 to 4.8; 3.6 to 5.4 |
| … drawn / commit | 72 / 53 | 71 / 53 | |
| finances → resolve, round 20, the round that ends the life (`perf?life=moment-escape&last=1`), 63 lives kept, settled | 161, 113, 130, 146, 96, 146, 117, 99, 97, 130: **median 124** (the press before them: 546, a 423 ms UI frame, the first after the app opened) | 113, 112, 131, 162, 130, 130, 82, 96, 111, 130: **median 122** (the press before: 130) | 3.8 to 4.6; 4.4 to 5.3 |
| … drawn / commit | 73 / 54 | 68 / 54 | |
| cold start to the front door, 64 lives kept (ten launches) | 1173 (1748, 1170, 1142, 1170, 1236, 1175, 1180, 1132, 1156, 1183) | 1244 (1285 … 1318) and again 1186 (1612, 1149, 1231, 1162, 1134, 1168, 1165, 1204, 1283, 1239) | 4.3 to 6.7 |

Both steps are within the 200 ms budget in both builds on this quieter Mac (load 4 to 5; the decisions' 212 was at load 7 to 12). The budget did not
need the store's work to pass, but the store's work is gone from the step all the same:

- **What the round that ends a life does to the store**, before → after (the probe's `device` layer is the phone's KvStore, `saved` the resilient
  store the game asks): `addRun` + `saveGame`, then the second `addRun` **and a second `saveGame` of the unchanged game** (local.ts: the run written
  again with the gallery's badges) → the second `saveGame` gone (33e1546). The step's `listRuns` (the profile's count) is still read on the step that
  ends a life (the rank needs the lives): 2.5 to 6.6 ms, each life parsed anew from its text, and no copy over it in the resilient store
  (`freshReads`). On a step that does not end a life: `listRuns` before (0.6 to 1.4 ms, plus the resilient store's JSON copy of every life, not timed
  then) → `runIds` after (0.2 to 0.8 ms, the index only); `kvStore.test` holds that with 63 lives such a step lists none and reads no life's key.
- **The provider's `listRuns` after the commit** (31 to 52 ms in both builds) is the read queued behind the JS thread's work of drawing the page, not
  the store's own: it reads the index, and the lives only after another store wrote.
- **What the step is made of**: the commit (the engine's round and the resolve page, ~53 ms in both) and the UI thread's frames after it (the longest
  33 to 106 ms). Neither is the store's.
- **Cold start with 64 lives** reads every life once (one `getItem` a life and `getAllKeys`): 35 to 65 ms, while the front door is drawn; the front
  door at 1.19 to 1.24 s, within the 2 s budget, the same as before.

The first press after the app opened (546 ms in the before build, a 423 ms UI frame) is the first resolve page of the process (its fonts and canvases
made); not counted in either median, and not seen in the after build's first press (130), which came after ten round-6 presses.

## Phase 2's exit (Task 20): a whole life by hand, every scene final, the release build measured

Branch `expo`, from 5fd3b02. iPhone 16 Pro simulator, iOS 18.0, on this Mac. Android was not run (below).

### A whole life by hand

Played in the **plain release build** (`npx expo prebuild --platform ios --clean`, then `npx expo run:ios --configuration Release`; the app
uninstalled first, so a first life on a fresh phone), driven as a player drives it: taps, card swipes and the iOS edge swipe, through the
simulator, never the store.

- **The first life**, the nurse in Madrid, all twenty rounds to the end: cards pressed and swiped (two-choice cards both ways, three-choice cards
  pressed), every outcome, the finances each round, the ledger, the moments, a move of city (Mexico City by round 15), the end. Along the way:
  - **Killed at the finances with orders in the basket** (round 8: a fund bought and a monthly plan, "2 orders"): `simctl terminate`, then
    launched again. The front door said "Continue your life"; the life opened at the finances of round 8 with both orders in the basket and
    the cash after the round as before.
  - **The iOS back gesture** (the edge swipe, Android's Back on an iPhone) from Play, at the finances and at the news: the front door, the
    life kept; Continue took it up at the same stage. From the records and the collection: back to the front door.
  - **Russian mid-life** (round 8, Settings, Русский): the HUD, the finance tabs, the glance, the basket and a buy sheet all in Russian
    and nothing clipped; then English again.
  - **Every finance tab** opened: portfolio, market, property, business, debt, lifestyle, shop, taxes. **The profile** from the portrait,
    **a balance line** (investments, its sheet), **a thing** (the Tesla Model 3's sheet), a fund's buy sheet with its slider.
  - **The end**: its figures, the life line, the badges, the legendary badge's cheer. **Share this life**: the iOS share sheet with the
    picture (`rat-race-nurse-247.png`) and the invite. **Save the picture**: the photos prompt, Allow, "Saved to your photos."
  - **After the life**: the records (the life at the top, its sheet opened) and the collection (badges 12 of 63, things 7 of 67).
- **A second life**, the delivery rider in Bangkok (unlocked by the first), to round 3, then on to round 7 in the probe build while
  measuring (below).

**Faults found, and fixed** (each in its screen, with a test written first and seen to fail):

| # | where | what | cause | fix |
|---|---|---|---|---|
| 1 | NewLife | on a fresh phone, "Start this life" pressed: for the moment before Play replaced the page, the bar said "This ends the life you have in progress." of the life just begun, and the button was live again | the notice and the question follow `inProgress`, which the life just started makes true while the page is still on screen | the page knows its life is begun: no notice, no second press (d37db7b; `NewLife.test`: "does not warn of a life in progress for the life it is beginning…") |
| 2 | End | "A legendary badge: Lunch with Bufé!" ran on one line past the frame, cut under the right confetti | the web's words are a flex item that gives way and wraps; the phone's line did not shrink | the line shrinks and wraps between the confetti (e2892f8; `End.test`: the cheer's line has `flexShrink: 1`) |

Seen and not a fault: after the end, Home offers no "See how your last life ended" (the end lets its life go once left, `closeFinished`, as
the web's does); the round's cash on the HUD at the finances is the cash after the basket (the web's `useShown`).

### Every scene, final

The four scenes the escape's age changed (ddd6cc4: the age a life left the rat race is the age of the round it got out in, on both clients)
were shot first: `moment-escape` and `end-escaped` clean, `end-share` 5084 (record 5090) and `end-ru` 168 (record kept), within their
records. `PENDING_SHOTS` is empty. Then **two full runs** of all sixty-five scenes on the final code (Metro started with its cache cleared,
Expo Go opened twice on it; the web's own `next dev`), no edit during either: **run A** exit 0 (load 4.5 → 5.2), **run B** exit 0 (load
11.3 → 2.6, started straight after run A). Both: **46 clean, 17 accepted, 2 in the phone's words**
(`home-lost-newer` layout clean, `legal` not comparable), 0 differ. They differ by one pixel in `end-share` (5084/5085, the web's own picture)
and `play-pageturn` (3896/3897, the turning page's ring). The shots and numbers committed are run B's (431a866).

Run B, scene by scene (shape = pixels a point away that are not text; worst text = the farthest a judged line stands; far = the judged lines
beyond a point):

| scene | verdict | raw % | shape (px) | of which blended | text lines | worst text (pt) | far | run A, where it differs |
|---|---|---|---|---|---|---|---|---|
| home-new | clean | 3.62 | 0 | 0 | 15 (0 unmeasured) | 0.67 | — |  |
| home-continue | accepted | 2.93 | 1 | 1 | 15 (0 unmeasured) | 0.67 | — |  |
| home-settings | clean | 2.31 | 0 | 0 | 29 (15 unmeasured) | 0.33 | — |  |
| home-lost-newer | phone words, layout clean | 4.11 | 0 | 0 | 17 (0 unmeasured, 2 phone words) | 0.67 | — |  |
| new-first | accepted | 3.28 | 738 | 148 | 25 (1 unmeasured) | 2 | 🎲 At random 2 |  |
| new-unlocked | accepted | 3.22 | 738 | 148 | 32 (1 unmeasured) | 2 | 🎲 At random 2 |  |
| new-locked | accepted | 5.9 | 738 | 148 | 65 (9 unmeasured) | 2 | 🎲 At random 2 |  |
| new-replace | accepted | 2 | 310 | 1 | 31 (26 unmeasured) | 1 | — |  |
| play-news-r1 | accepted | 3.78 | 1443 | 1443 | 42 (4 unmeasured) | 0.67 | — |  |
| play-cards-r1 | clean | 4.87 | 0 | 0 | 42 (0 unmeasured) | 0.67 | — |  |
| play-cards-legendary | accepted | 5.42 | 1 | 0 | 35 (0 unmeasured) | 0.67 | — |  |
| play-cards-three | clean | 5.24 | 0 | 0 | 40 (0 unmeasured) | 0.33 | — |  |
| play-cards-ru-360 | clean | 5.23 | 0 | 0 | 37 (0 unmeasured) | 0.67 | — |  |
| play-finance-r6 | clean | 4.33 | 0 | 0 | 52 (8 unmeasured) | 0.67 | — |  |
| play-outcome-r1 | clean | 3.66 | 0 | 0 | 31 (0 unmeasured) | 0.67 | — |  |
| play-resolve-r6 | clean | 4.45 | 0 | 0 | 41 (8 unmeasured) | 0.67 | — |  |
| play-news-r6 | accepted | 4.21 | 1443 | 1443 | 41 (4 unmeasured) | 0.67 | — |  |
| play-guide-r1 | accepted | 6.18 | 3453 | 1979 | 42 (5 unmeasured) | 1.33 | New regulator created to regulate the re 1.33 |  |
| play-fault | clean | 3.02 | 0 | 0 | 6 (0 unmeasured) | 1 | — |  |
| play-pageturn | accepted | 3.93 | 3897 | 3878 | 51 (8 unmeasured) | 0.67 | — | A: accepted 3896 0.67 |
| finance-basket | clean | 1.52 | 0 | 0 | 56 (49 unmeasured) | 0.33 | — |  |
| finance-pension | clean | 2.51 | 0 | 0 | 68 (52 unmeasured) | 0.67 | — |  |
| finance-tabs-ru-360 | clean | 4.05 | 0 | 0 | 51 (4 unmeasured) | 0.67 | — |  |
| finance-market | clean | 3.78 | 0 | 0 | 61 (8 unmeasured) | 0.67 | — |  |
| finance-buy-stock | accepted | 2.91 | 149 | 149 | 83 (61 unmeasured) | 1 | — |  |
| finance-property | clean | 6.13 | 0 | 0 | 40 (2 unmeasured) | 0.67 | — |  |
| finance-debt | clean | 3.56 | 0 | 0 | 36 (0 unmeasured) | 1 | — |  |
| hud-news-r1 | clean | 2.87 | 0 | 0 | 20 (0 unmeasured) | 0.67 | — |  |
| hud-cash | clean | 1.26 | 0 | 0 | 30 (20 unmeasured) | 0.33 | — |  |
| hud-flow | clean | 1.28 | 0 | 0 | 32 (19 unmeasured) | 0.67 | — |  |
| hud-race | clean | 2.23 | 0 | 0 | 36 (20 unmeasured) | 0.33 | — |  |
| hud-status-ru | clean | 2.17 | 0 | 0 | 44 (20 unmeasured) | 0.67 | — |  |
| hud-jailed | clean | 3.38 | 0 | 0 | 33 (21 unmeasured) | 0.67 | — |  |
| hud-crisis | clean | 3.1 | 0 | 0 | 21 (0 unmeasured) | 0.33 | — |  |
| hud-crisis-details | clean | 2.66 | 0 | 0 | 33 (21 unmeasured) | 0.67 | — |  |
| amount-savings | clean | 1.57 | 0 | 0 | 30 (19 unmeasured) | 0.67 | — |  |
| celebrate-legendary | clean | 1.21 | 0 | 0 | 24 (19 unmeasured) | 0.67 | — |  |
| celebrate-earned | clean | 3.42 | 0 | 0 | 27 (0 unmeasured) | 0.67 | — |  |
| challenge-practice | clean | 4.21 | 0 | 0 | 15 (0 unmeasured) | 0.67 | — |  |
| legal | phone words, not comparable | 14.42 | 39721 | 215 | 34 (0 unmeasured, 27 phone words) | 0.67 | — |  |
| finance-lifestyle | clean | 4.31 | 0 | 0 | 47 (4 unmeasured) | 0.67 | — |  |
| finance-move | clean | 1.88 | 0 | 0 | 72 (47 unmeasured) | 0.67 | — |  |
| play-cards-city | clean | 2.68 | 0 | 0 | 50 (37 unmeasured) | 0.67 | — |  |
| work-panel | clean | 2.46 | 0 | 0 | 33 (0 unmeasured) | 0.67 | — |  |
| finance-shop | clean | 3.81 | 0 | 0 | 50 (6 unmeasured) | 0.67 | — |  |
| finance-item | clean | 3.05 | 0 | 0 | 71 (50 unmeasured) | 0.67 | — |  |
| finance-taxes | accepted | 4.01 | 31 | 31 | 48 (4 unmeasured) | 0.67 | — |  |
| finance-business | accepted | 4.77 | 35 | 1 | 58 (7 unmeasured) | 0.67 | — |  |
| profile-r6 | accepted | 2.14 | 30 | 0 | 77 (42 unmeasured) | 0.67 | — |  |
| profile-owned | clean | 1.53 | 0 | 0 | 85 (77 unmeasured) | 0.67 | — |  |
| balance-r6 | clean | 1.85 | 0 | 0 | 90 (77 unmeasured) | 0.67 | — |  |
| rivals-r6 | clean | 2.77 | 0 | 0 | 20 (0 unmeasured) | 0.33 | — |  |
| end-escaped | clean | 3.09 | 0 | 0 | 24 (0 unmeasured) | 0.33 | — |  |
| end-bankrupt | accepted | 3.15 | 5 | 5 | 25 (1 unmeasured) | 0.33 | — |  |
| end-share | accepted | 1.33 | 5085 | 4267 | 29 (25 unmeasured) | 1 | — | A: accepted 5084 1 |
| end-ru | accepted | 4.27 | 168 | 54 | 25 (0 unmeasured) | 0.67 | — |  |
| moment-escape | clean | 4.73 | 0 | 0 | 52 (40 unmeasured) | 0.67 | — |  |
| moment-bankrupt | clean | 2.44 | 0 | 0 | 54 (39 unmeasured) | 0.67 | — |  |
| moment-crisis | clean | 2.94 | 0 | 0 | 56 (42 unmeasured) | 1 | — |  |
| records-empty | clean | 2.61 | 0 | 0 | 3 (0 unmeasured) | 0.33 | — |  |
| records-three | clean | 3.48 | 0 | 0 | 28 (0 unmeasured) | 0.67 | — |  |
| records-detail | clean | 2.29 | 0 | 0 | 42 (28 unmeasured) | 0.67 | — |  |
| collection-items | clean | 4.05 | 0 | 0 | 14 (0 unmeasured) | 0.67 | — |  |
| collection-badges | clean | 5.23 | 0 | 0 | 29 (0 unmeasured) | 0.67 | — |  |
| profile-financed | clean | 2.47 | 0 | 0 | 95 (77 unmeasured) | 1 | — |  |

### The device checks, all passes together

| check | where | result |
|---|---|---|
| the card swipe and its threshold; a short drag springs back | batch pass 1; again by hand here (six swipes measured) | ok: 60 UI frames a second through every swipe, one second with one frame missed |
| a three-choice card refuses the swipe; a double tap makes one move | batch pass 1 | ok |
| the app killed at the finances, the basket kept | here, release build, round 8 with two orders | ok |
| the iOS back gesture from Play, a list page | here | ok: home, the life kept; back from records and collection |
| Android's Back (sheet, Play, Home) | tests only (`Play.test`, `overlay.test`) | not run on a device: no Android here |
| Russian mid-life; a Russian 360-pt phone | here; `play-cards-ru-360`, `finance-tabs-ru-360` scenes | ok |
| two sheets opened together (iOS presents one Modal at a time) | batch pass 2 (fixed: the kit's sheets take turns) | ok |
| a toast over an open sheet | batch pass 2 | ok |
| share the card; save the picture (photos prompt, refusal, saved) | batch pass 2; again by hand here | ok |
| the AmountSheets re-keyed, the slider in a sheet, the sticky header's scroll, list windowing | batch pass 1 | ok |
| greyed badges, the 40 at a list's foot, `profile-owned`/`end-ru`, things → a thing, business → invest | batch pass 1 | ok |
| a fresh install's first life (locked lives, the first unlock) | here | ok, with fault 1 above |
| the plain release bundle holds no timing probe and no test or development code | here: the two plain builds of the play and the measures had no probe; the final review then found the development routes' test code in them (`/scene`, `/dev`, `/kit` imported it statically), now loaded behind `__DEV__` (7c79950 and 2273594, `ui/devRoutes.test.ts`), and the plain build made after the fix wave checked again | ok: `main.jsbundle` 14.3 MB (Hermes bytecode, 14 333 837 bytes), 0 matches each of `sceneStore`, `runScene`, `putOlderLife`, `MotionTwo`, `readyPort`, `fixedSessions`, `memoryServices`, `127.0.0.1`, `perfProbe`, `timedStore`, `putSceneLife`, `putSceneRuns`, `slowFrame`, `settledMs`, `perfLife`, and of the paths `testing/scene`, `kitMotion`, `olderLife`; of the 65 scene names only `legal` (the legal page's own route and words). `SceneView` is there once: React Navigation's own component, inside expo-router (`build/react-navigation/core/SceneView.js`), not ours; `SceneRoute` once, the /scene route's function name (the route itself, which goes home) |
| screen readers, the tablet's shelf | not run | left (no VoiceOver pass, no iPad simulator) |

### Performance: the final table

A release build with the timing probe (`EXPO_PUBLIC_PERF=1`, the same sources as the plain one), installed over the plain one (its data
kept: the two lives of the play above, then the probe's own lives). Measured once, on a quiet Mac: the 1-minute load 3.9 to 5.2 throughout
(the 15-minute 8 to 11, falling, from the shot runs before). Each the median of five unless more are given; *settled* (the budgets are judged
on it): from the touch let go to two UI frames in a row at the display's pace.

| budget | what | settled, ms | median | drawn (median) | verdict |
|---|---|---|---|---|---|
| cold start ≤ 2000 | `simctl launch` to the front door drawn | 1477, 1246, 1453, 1210, 1200 | **1246** | — | pass |
| Home → Play ≤ 300 | Continue → the round's news (the first is the process's first Play) | 295, 192, 189, 163, 114 | **189** | 74 | pass |
| stage ≤ 200 | news → cards | 103, 81, 47, 95, 80 | **81** | 37 | pass |
| stage ≤ 200 | cards → outcome, pressed (n 13) | 46 to 79 | **62** | 46 | pass |
| stage ≤ 200 | cards → outcome, swiped (n 6) | 62, 64, 80, 63, 64, 48 | **64** | 47 | pass |
| stage ≤ 200 | outcome → next card (n 14) | 45 to 97 | **47** | 30 | pass |
| stage ≤ 200 | outcome → finances | 92, 62, 78, 178, 60 | **78** | 50 | pass |
| stage ≤ 200 | finances → resolve, the rider's rounds 3 to 7 | 161, 160, 178, 147, 97 | **160** | 103 | pass |
| stage ≤ 200 | finances → resolve, round 6 (`perf?life=play-finance-r6`) | 98, 126, 218, 162, 113 | **126** | 66 | pass |
| stage ≤ 200 | finances → resolve, the round that ends a life (`perf?life=moment-escape&last=1`, 7 lives kept) | 163, 132, 96, 114, 128 | **128** | 64 | pass |
| stage ≤ 200 | resolve → news | 97, 129, 110, 96, 80 | **97** | 31 | pass |
| stage ≤ 200 | resolve → the end | 140, 163, 129, 128, 114 | **129** | 51 | pass |
| tab ≤ 150 | portfolio (n 10) | 32 to 178 | **62** | 30 | pass |
| tab ≤ 150 | market | 146, 201, 131, 112, 97 | **131** | 68 | pass |
| tab ≤ 150 | property | 112, 96, 48, 178, 113 | **112** | 52 | pass |
| tab ≤ 150 | business | 46, 45, 29, 45, 47 | **45** | 28 | pass |
| tab ≤ 150 | debt | 44, 46, 42, 67, 45 | **45** | 29 | pass |
| tab ≤ 150 | lifestyle: on screen / every panel in | 181, 113, 112, 178, 111 / 328, 212, 212, 345, 212 | **113** / 212 | 48 / 180 | pass on screen (as judged since batch pass 1) |
| tab ≤ 150 | shop: on screen / every shelf in | 146, 114, 145, 105, 99 / 462, 430, 445, 389, 415 | **114** / 430 | 48 / 393 | pass on screen; the last shelves come in behind, as before |
| tab ≤ 150 | taxes | 113, 79, 113, 97, 80 | **97** | 58 | pass |
| sheet ≤ 150 | a Sheet opened (the cash's) | 109, 46, 46, 46, 46 | **46** | 30 | pass |
| swipe 60 fps | the six swipes above, UI frames a second round each | 60 every second but one (59, one frame of 33 ms) | — | — | pass |
| fling, no drop | Records with 65 lives, three flings down and three back | 12 frames missed in all (6, 2, 1, 3), the longest 41 ms | — | — | over, as before (below) |

Every budget passes. Against batch pass 2 (finances → resolve 121 at round 6 and 122 at the last round, cold start 1186 to 1244): the same
within the run-to-run spread. The single settled values above the budget (201 for one market tab, 218 for one round 6, 178 for one
outcome → finances) are one long UI frame each (112, 150, 118 ms), not a slow commit (drawn 99, 81, 122 ms).

**The flings still drop frames**: twelve over six flings of a list of 65 lives, one or two at a time; the rows' canvases are made as they come
in, on this simulator through Metal's XPC driver. Left as in batch pass 1, to be measured on a device.

### For the user: two things phase 2 changed beyond the phone

- **The web writes a little less on the step that ends a life.** On that step the session wrote the game a second time, unchanged, with the run
  written again for the gallery's badges. `persistRun` in core now writes the run alone the second time, for the local and legacy sessions
  (33e1546) and the ranked one (0b2439a), so the web (ranked lives included) no longer writes its save twice there. Nothing a player sees
  changes; it is harmless, and tested by counting the writes (`local.test`, web `ranked.test`).
- **The phone's own words travel in the web's messages until phase 5.** The `phone.*` keys (where the web's words would tell a phone player
  something false: reload the page, this browser) live in `packages/i18n/messages/{en,es,ru}.json` beside the web's, so the web's message
  bundle carries them, unused (`apps/web/src/i18n/messages.test.ts` holds that only the app asks for them). A few kilobytes; they can be split
  out when the web moves to Expo.

### What is left for later phases

- **Android was never run.** No Android SDK, emulator or device on this Mac; the emulator (≈6–8 GB) waits for the user's approval of the
  download. Android's Back, the predictive back gesture (turned off in `app.json`), the blocked read permissions and every budget are tested
  or configured, not seen.
- **A device measure of the flings** (Records, the collection's badges), and of every budget, on a phone: the simulator's JS thread is the
  Mac's, its canvases go through Metal's simulator driver.
- **The legal notice's wording** on the phone (it says what phase 2's app does: kept on this phone, no account, nothing sent): the user's
  call, before an app that sends anything ships.
- Screen readers (VoiceOver, TalkBack) were not walked through; the tablet's shelf not seen (no iPad simulator).

## Phase 3, Task 7: the rankings (shots pending)

Not shot in its task: the five scenes are in `PENDING_SHOTS`, unjudged until phase 3's batch pass (Task 14) shoots and compares them. They are the
first scenes with other players: neither side has a cloud in a scene, so both registries give the screen the same community, written once in the core
(`packages/core/src/testing/sceneCommunity.ts`, its shape held to the online client's `Community` by each client's type checker). Every scene is a
device with no life; the player is `Rata_Uno` (friend code `RAT7K2QX`), sixth of all time, second this week and among friends, fifth of the challenge.

| scene | what it is | how its tab or form is open |
|---|---|---|
| rankings-all | eight players of all time, the first three in their metals (the second in cream: the web's `text-ink-100` names no colour), two without a name (`Rat C1D0`, `Rat FA70`), the player's own line lit gold | none: the page opens on all time |
| rankings-week | four lives that ended in the scene's week | the web's page presses its tab (`main [data-tab="week"]`); the phone's Rankings is given it (`tab`, as the route's `?tab=`) |
| rankings-friends | three lines among friends, and the friends' panel under them: two friends, a request waiting (nameless), one sent | the same, `friends` |
| rankings-challenge | the week's life and rule, forty entrants (the best four marked), six lines | the same, `challenge` |
| rankings-nickname | all time, the player's name being changed: the web's form inside the player's panel (not a sheet: the web edits it in place; the scene names no sheet), on `Rata_Uno` | the web's page presses "Change it" once the name is read; the phone's is given it (`naming`) |

- **The rows are the page's list** (`ListScreen`): a ranking is fifty lines and the player's own, the challenge's the same. The head (title, the player's
  panel, the tabs, the hint, the picker, what the ranking came to) is the list's header. Among friends, the friends' panel's lines (up to 200 friends
  and 50 requests each way) are rows of the same list after the ranking's, the panel cut across them (`PanelPart`, the frame's `cut`: top, sides,
  bottom), and its foot (the code to ask with) is the list's footer (`ListScreen`'s `foot`). The panel is then no one box: its groups are headings.
- **The keyboard** (fix round 1): every page's scroll (`Screen`, `ListScreen`) gives a tap to the button tapped while a field has the keyboard up
  (`keyboardShouldPersistTaps: 'handled'`, the sheet's and the tabs' scrolls too), and keeps the field typed in above the keyboard: on iOS by the scroll's
  `automaticallyAdjustKeyboardInsets`, on Android by a `KeyboardAvoidingView` round the scroll (the app draws edge to edge). To be seen on both.
- **The friend code copies itself when pressed** (the web's `select-all`; a phone selects nothing in a line of text): the web's player page's words,
  `player.copied` in a toast. Its touch box reaches past the panel's foot to the tabs (`CODE_REACH`).
- **A ranking asked before is shown at once when it is asked again**, and replaced when the answer comes: the web keeps the last answer only (and shows it
  at once when it is the one asked again). A tab switched back to has no "Loading…" on the phone where the web shows one.

## Phase 3, Task 6: the game online beside the game alone (shots pending)

Not shot in its task: the five scenes are in `PENDING_SHOTS`, unjudged until phase 3's batch pass (Task 14). Each is drawn for a member signed in
with Google (the account's `CLOUDS` in `scenes.ts`, nothing waiting in it) and told of the scene's other players (`sceneCommunity.ts`, extended with
what each of these scenes is told beyond the rankings': the player's attempt at the week's challenge, and where a score stands). Neither side draws
them with an initial state or a press: the registries draw the screens as they open.

| scene | what it is |
|---|---|
| home-member | home-continue's life, for a member: the way to the rankings across the row under the collection and the records, a friend request waiting (gold), the week's card with its days left, and the profile with the member's rat at the foot, after the account |
| challenge-attempt | the week's page with today's attempt to play (gold) above the practice, the week's best so far (8,105) in a note, and the way to the challenge's ranking under the hint |
| challenge-played | the same with today's attempt played: the teal note, the practice alone, the way to the ranking |
| end-standing | end-escaped's life, for a member: where its score stands among forty others' (77%), in the score's frame |
| new-ranked | the page where a life is chosen, for a member: ranked or their own, side by side above the start |

- **The way to the challenge's ranking** is underlined words (the web's `underline`, its offset the browser's own): the phone's `LinkText` draws it
  2 under the baseline. To be measured in the shot.
- **A choice's count in the sheet of all of them** follows the choice after a space (the web's `ml-1`, 4 px).
- **The week's result at the end of an attempt** (`ChallengeResult`) has no scene: a ranked life ends on the server, which a scene has none of.
- **The quick game after a life alone** (`VersusOthers`) comes with Task 9's quick game, and its scenes with it.

## Phase 3, Task 9: the games with others, from the door to the lobby (shots pending)

Not shot in its task: the four scenes are in `PENDING_SHOTS`, unjudged until phase 3's batch pass (Task 14) shoots and compares them. Both registries
give the game the same table (`packages/core/src/testing/sceneRooms.ts`: the core's `RoomsLink`, answering the same every time and taking nothing),
and the same player signed in, `Rata_Uno` (`sceneCloud.ts`), so the lobby shows the way to name oneself ("Change"). Every scene is a device with no life.

| scene | what it is | how it is opened |
|---|---|---|
| room-door | the way in: the three lines, the pace, the quick game with "2 games are looking for players right now", a game of one's own, the code to type | none |
| room-lobby-friends | a game among friends the player opened: code `K7Q2XM`, the engineer, 3:00 a round, the rules, three seats (the player as host, `Bea_7`, `Rat C3D4`), Start | none |
| room-lobby-public | a public game played together, the nurse: its clock "Starts in 1:35" (by the server's clock, `startsAt` 95 s after the room's `now`), two seats, Start now | none |
| room-join-code | the door come by an invitation's link: the code and the one button that joins it | the web's page puts `code=K7Q2XM` in its address before it draws the door (which reads it there); the phone's Room is given it (`code`, as its route's `?code=`) |

- **The clock counts down from the moment each side drew it**: both start at 1:35 and count once a second; a shot a second later on one side reads 1:34.
  The batch pass compares the line's shape, not its last digit.
- **The clock is drawn once a second** on the phone (the web four times a second), and only the clock: it is a leaf of its own (`StartsIn`).
- **Both ways out of a lobby among friends are there** on the phone, Share and Copy link: the web shows Share only where its browser has a share sheet
  (`navigator.share`), so its shot may show Copy link alone. The phone's sheet is React Native's `Share` with the web's words (`room.inviteText`) and the web's link
  (`SITE_URL/<locale>/room?code=`): beside the words on iOS, at their end on Android.
- **Two refusals in the phone's words**: a game on rules the app lacks says to update the app (`phone.roomOtherVersion`, `phone.roomOtherRules`) where
  the web says to reload the page. No scene shows them.
- **A sheet rises over the keyboard** on both platforms (`KeyboardAvoidingView` in the sheet's window): the lobby's name sheet has the first field in a
  sheet. To be seen on both.

## Phase 3, Task 10: the game with others in play, its loans, shouts, end and history (shots pending)

Not shot in its task: the five scenes are in `PENDING_SHOTS`, unjudged until phase 3's batch pass (Task 14). Both registries give the game the same
table (`sceneRooms`), now with the player's life in the room: the life of another scene (`play-news-r6`, `play-finance-r6`, `end-escaped`), which the
engine played the scenes' way, shown as the server shows a room's life (the `in_room` flag set). Each side's script waits for that life to open, and
takes the scene's own steps on it (`runRoomScene`), before the screen is first drawn. The device has no life of its own in any of them.

| scene | what it is | how it is opened |
|---|---|---|
| room-playing | the engineer's sixth round, at its news: the room's bar (2:30 left by the server's clock, Bea and Moe ticked), the paper telling of Bea's coup at the top with her rat | none |
| room-loans | the same round at its finances: Moe's offer of a loan to answer, and the player's own to Bea, waiting, with Withdraw | none |
| room-resolved | the same round played by the player as the last to play: the ledger, and "After round 6" under it, the player now first | the script puts the saver's orders in the basket and plays the round; the scene's table answers it with the engine's result |
| room-end | the end of the engineer's life, the room's order over it: Place 1 of 3, the badges the game earned, Rematch, Leave | none |
| room-history | the records with two games played with others; the latest open in its sheet: everyone with their place, city and job, worth and score | the web's page presses the first game of the Multiplayer section; the phone's Records is given it (`game`) |

- **The bar's clock is drawn once a second** on the phone (the web four times a second), and only the bar's button is drawn for it: its rats are made
  by the bar and handed in, the same each second. The line of the round's time jumps once a second; the web eases its width over 300 ms.
- **The bar hides "n/m played"** as the web does below 640 px (`max-sm:hidden`): the ticks on the rats say it.
- **Shouts stand over the page, not over a sheet** that is open: a sheet is a window of its own on the phone. The web's stand over its sheets.
  Those heard while a sheet is open wait for it to go (the room keeps the latest three), and each is then shown its whole four seconds.
  Their shadow is drawn (two strips of `EXTRA.shoutShadow`, as the paper's), not a CSS shadow.
- **The bar is drawn where the stage puts it** (over the finances' tabs, or at the top of any other stage), as the web's is in one place: its
  sheets, the shout's wait and an answer to a loan on its way are kept above it (`BarHost`), so a round turning under an open sheet leaves it open.
- **Sheets take turns**: the room's order gives way to the question of leaving, and to the sheet of a player (closed, then the other opened); the
  web opens the question over the order.
- **The loan's amount** is the kit's `TextField kind="amount"` (digits only, on the number pad); the four amounts a tap gives are buttons, gold when
  chosen, as the web's.

## Phase 3 batch pass: the online scenes shot, compared and judged

Phase 3's Task 14, part A (`.superpowers/sdd/2026-10-23-expo-phase-3-online/task-14-brief.md`). The twenty-eight scenes Tasks 4 to 10 registered and
did not shoot (`PENDING_SHOTS`: the account, the rankings, the player's profile, the game online beside the game alone, the games with others) and
the kit's `forms` section (`PENDING_SECTIONS`) were shot on both clients, compared and judged by phase 2's tolerances (a shape is accepted only with a
measured cause, every line of text within the point unless its record names it). Both lists are empty now. Everything ran on the scenes' fake cloud
services (`sceneCloud`, `sceneCommunity`, `sceneRooms`), never the live project: no `EXPO_PUBLIC_SUPABASE_*` set, the web's `next dev` started by the
script with the project's address blank, its browser kept from every host but this machine (only `va.vercel-scripts.com` was asked for, and kept
from). Simulator: iPhone 16 Pro, iOS 18.0, Expo Go, Metro on 8090; the web by its own `next dev` on 3021 in Playwright's Chrome.

**The first shots** (before any fix): 4 clean (`settings-account-guest`, `settings-account-member`, `home-offer`, `room-join-code`), 24 differed, four
of them never still in the app (`room-lobby-public`, `room-playing`, `room-loans`, `room-resolved`). The largest: `room-end` (631 810 shape pixels,
96 pt), `player-friend-code` (151 855, the profile's big rat blank), `rankings-challenge` (33 074, "Top 10%" 6.67 pt), `rankings-friends` (24 267),
`room-lobby-friends` (13 290, the tags 12.67 pt).

### What differed, and was fixed in the app

| # | difference (scenes) | measured cause | fix | test |
|---|---|---|---|---|
| 1 | the friend code 2.67 pt low beside "Your friend code:" (the five `rankings-*`, and the panel and everything under it with it) | a native `alignItems: 'baseline'` row: the kit moves a text's glyphs inside its box (`baselineShift`), so the baselines a native row reads are not where the glyphs stand (batch pass 1's lesson 5) | the line laid from the browser's baselines: the paragraph's strut, its words (reading 12) and the code (pixel 15), `webLine` (`codeLineOf`) | the run |
| 2 | the rank card's name 2.33 pt low and its step 4 pt high (`player-member`, `player-friend-code`) | the same: the web's `items-baseline` row was a native baseline row | `webLine` for the name (pixel 17) and the step (reading 12) | the run |
| 3 | the rat beside the editor's tabs without its frame (`player-*`) | `overflow: 'hidden'` on the `Framed` box clipped its own strips, which stand outside the box (the web's box-shadow, which an `overflow-hidden` does not clip) | the rat clipped in a box of its own inside the frame | the run |
| 4 | the profile's big rat blank, its ground only (`player-friend-code`; reproduced on the simulator after `player-editor-scene`, three times out of three) | the canvas was mounted with a stand-in look under `opacity: 0` and handed a second picture once the member was read, while the toast rose: iOS left that second picture undrawn (with every sprite already decoded; never from a cold start) | the rat is drawn once the member is read, in their look, never first another one, hidden | `PlayerProfile.test`: no 128-point canvas before the member is read, one after |
| 5 | the friends' panel: each line's lower frame strip missing (`rankings-friends`, 14 860 px) | the panel is cut across the rows of the page's list (`PanelPart`); the room between two lines was the lower line's `paddingTop`, and that part, drawn after the line above as the next row of the list, painted its ground over the line's frame shadow (2 under its box) | the room is the upper line's (`under`), so its shadow is in its own part; the foot's 8 is the last line's | `Rankings.test`: each line's room under it, the web's 6 and 8 |
| 6 | "Top 10%", "Host", "You" and the tags of the records and the room's history standing at the top of their rows (`rankings-challenge` 6.67 pt, `room-lobby-friends` 12.67 pt, `room-end`) | the kit's `Tag` is `alignSelf: 'flex-start'` (the web's inline block at the start of a column); in a row it went to the row's top, where the web's flex item is centred by `items-center` | `Tag item`: a flex item of a row, placed as the row places its items (the challenge's board, a lobby's seats, the room's order, its history, a life's tag in the records) | the run |
| 7 | the week's portrait over the challenge's board wider than the web's (`rankings-challenge`) | the web's 64-point portrait in a 52-point well is held to the well's width by the page's `img { max-width: 100% }`, its height left 64 (as the cheer's confetti in batch pass 1) | drawn 52 × 64 (`BOARD_FACE`) | the run |
| 8 | the rules of a room with a small "•" where the web has its list's disc (`room-lobby-*`) | the web's `list-disc` is Blink's symbol marker, a filled circle 5 across, not a glyph | the jail's disc (already measured in phase 2) shared as `DiscItem`, used by both | the run |
| 9 | the badges a game earned at 40 where the web draws 64 (`room-end`, everything under them 24 pt higher) | the web's `size-10` on a `Sprite` loses to the size its Sprite sets inline: the badge is its own 64 | the badge at its own size; its words in the web's `leading-tight` line (the name's pixel 16 in a reading 14 line, `webLine`) | the run |
| 10 | the room's order: the place and the score 1.33 to 1.67 pt off (`room-end`) | the phone gave them the column's `leading-none` / `leading-tight`; the web's `pixel` sets its own line (1.1) on the span, over the column's | the pixel face's own line | the run |
| 11 | the clock of a public lobby and of a round never still in the app (`room-lobby-public`, `room-playing`, `room-loans`) | the countdown read `Date.now()`, and the room store took its skew by it: the web's shot holds the browser's clock (`setFixedTime`), the phone's ticked | the countdowns (and the shout's wait) read the game's clock (`useClock`), and the room store takes its skew by the same clock: the phone's, or a scene's held at its day, where the count stands still (1:35 on both) | `Room.test`: a held clock holds the count still over a second |
| 12 | `room-resolved` never still | its ledger's wheel and a promotion's confetti turn for ever (the ledger alone, `play-resolve-r6`, is drawn with motion left out) | `room-resolved` drawn with motion left out (core `STILL`, both clients) | `sceneRooms.test` |
| 13 | the way to the challenge's ranking underlined 2/3 pt lower (`challenge-attempt`, `challenge-played`) | the web's `underline` with no offset is Chakra's own (post table: −75 of 1000), drawn by Chrome 1.5 under the baseline; the phone had a guessed 2 (parked) | `offset={1.5}`: 815.33 against 815.00 | the run |

### What the shots taught the tooling

- **Next 16.4 stops a dev server an agent started**, once, a moment after it answers, to recommend an upgrade (its "upgrade nudge"), and lets the same
  command run when it is started again within five minutes: every other run of the shots failed on a refused page, and the `process.kill` of the
  server already gone (`ESRCH`) hid why. The server's words now go to `.kit-shots/web-server.log`, a stop with Next's words starts it once more, and a
  server already gone no longer hides the error the run met (`shotDrivers.ts`, `stoppedWithin`, tested). The recommendation (a security advisory for
  Next.js 16.4.0) is the user's to act on; nothing was upgraded.
- **A cold Metro** (`--clear`) built the bundle while the first scene's route was opened: the app showed its home, and the run stopped as a wrong page
  (`home-new`, 55 % unlike). Expo Go was then opened twice on the bundle before the two final runs, as phase 2 did.

### The residuals accepted, with their causes

| scene | shape (px) | lines named | measured cause |
|---|---|---|---|
| home-account-taken, home-member | 1, 5 | — | home-continue's pixel of a glyph's edge outside the text check's windows; and four of the member's rat at the foot, a picture at a fraction of a point a device pixel apart |
| rankings-friends, room-lobby-friends, room-lobby-public, room-end, room-history | 28, 25, 7, 22, 17 | — | players' rats, pictures at fractions of a point, a device pixel apart |
| room-loans, room-resolved | 20, 2 | — | the rats of the room's bar: a 128-pixel picture drawn small nearest-neighbour by the browser and by Skia, which keep a few other rows and columns |
| rankings-nickname | 317 | — | the name in the field a device pixel lower: an input's value is no text to the web's text check, so its glyphs' edges count as shape (within a point; the kit's forms, below) |
| room-door | 26 | — | the six dots of the empty code's placeholder, at a fraction of a point (a placeholder is not text to the check either); measured at the same columns within a third of a point |
| player-member | 34 | ✎ 5/3 | the career bar's lamp sliver (profile-r6's); the pencil U+270E: the web's shot has Lucida Grande's (rendered beside Zapf Dingbats', Apple Symbols' and Menlo's, it is the one that matches), iOS, which has no Lucida Grande, draws Zapf Dingbats': another pencil, lying flatter |
| player-friend-code | 569 | ✎ 5/3 | player-member's, and the toast's words over the tabs (covered there, so not measured as text) three quarters of a point apart, the toast a point narrower |
| player-editor-body, -wear, -scene | 1015, 1384, 670 | 🎲 At random 5/3 (body, scene) | the grid of choices a device pixel lower (the web paints it at a whole CSS pixel, 14.3 + 6 under the part's name; the phone at a device pixel), every rat in it with it; the dice emoji (new-first's) |
| new-ranked | 738 | 🎲 At random 2 | new-first's: the dice emoji, the folded list's arrow, whole CSS pixels against device pixels |
| challenge-attempt, challenge-played | 0 | See the challenge ranking 4/3 | the web's underline skips the descenders (Chrome's `text-decoration-skip-ink`), the phone's runs whole under them; the glyphs themselves stand within a third of a point |
| end-standing | 168 | — | end-ru's: the rare badge's confetti at the foot of the screen, its line at a fraction of a point where the standing puts it, cut a device pixel apart |
| room-playing | 1551 | — | play-guide-r1's: everything under the guide's note a device pixel lower (the note's foot at a whole CSS pixel on the web), and the paper's masthead (play-news-r1's) |

The parked items, as found: the friend code's toast is in the web's shot (Playwright takes it well within its 2.6 s); the public lobby's clock reads
1:35 on both (fix 11); the second place is cream on both (the web's `ink-100` is no colour, the button's own is drawn); the challenge link's
underline is measured (fix 13); the friends' panel cut across rows is one panel (fix 5).

### The kit's forms

`kit-shots.ts --only=forms` (phase 3's folder, `phase-3-parity/forms.png`): **differs, accepted**: 2182 shape pixels, every label within 0.33 pt.
The shape is the fields' values and placeholders, which the web's text check does not see (an input's value is not a text node): measured by their
ink, each stands within two thirds of a point of the web's (the names and the friend code within a third, the room code and its dots two thirds
lower), where a line of text would be clean. The focus ring, the sunk edges and the room code's spacing are alike. `PENDING_SECTIONS` is empty.

### Two full runs

Every scene on both clients, phase 2's sixty-five and phase 3's twenty-eight, from scratch on the final code (Metro started with its cache cleared,
Expo Go opened twice on it; the web's own `next dev`, restarted once by each run when Next stopped it), no edit during either: **run A** exit 0 (load
3.2 → 3.8), **run B** exit 0 (load 3.7 → 3.7, started straight after A). Both: **53 clean, 38 accepted, 2 in the phone's words** (`home-lost-newer` layout
clean, `legal` not comparable), 0 differ. They differ by one pixel in `end-share` (5084/5085, the web's own picture) and `play-pageturn`
(3896/3897), as in phase 2's runs; every phase 3 scene is the same in both. The shots and numbers committed are run B's. (A run before them, on the
cold Metro, stopped at its first scene: above.)

Run B, phase 3's scenes (phase 2's are as in its final table, above):

| scene | verdict | raw % | shape (px) | of which blended | text lines | worst text (pt) | far | run A, where it differs |
|---|---|---|---|---|---|---|---|---|
| settings-account-guest | clean | 2.33 | 0 | 0 | 31 (17 unmeasured) | 0.33 | — |  |
| settings-account-member | clean | 2.23 | 0 | 0 | 35 (19 unmeasured) | 0.33 | — |  |
| home-offer | clean | 2.02 | 0 | 0 | 29 (21 unmeasured) | 1 | — |  |
| home-account-taken | accepted | 2.94 | 1 | 1 | 18 (0 unmeasured) | 0.67 | — |  |
| rankings-all | clean | 4.72 | 0 | 0 | 63 (1 unmeasured) | 1 | — |  |
| rankings-week | clean | 4.01 | 0 | 0 | 45 (0 unmeasured) | 1 | — |  |
| rankings-friends | accepted | 4.53 | 28 | 25 | 47 (0 unmeasured) | 1 | — |  |
| rankings-challenge | clean | 4.78 | 0 | 0 | 43 (0 unmeasured) | 1 | — |  |
| rankings-nickname | accepted | 4.23 | 317 | 317 | 54 (1 unmeasured) | 1 | — |  |
| player-member | accepted | 2.69 | 34 | 3 | 26 (0 unmeasured) | 1.67 | ✎ 1.67 |  |
| player-editor-body | accepted | 4.26 | 1015 | 144 | 7 (0 unmeasured) | 1.67 | 🎲 At random 1.67 |  |
| player-editor-wear | accepted | 7.82 | 1384 | 865 | 10 (1 unmeasured) | 0.67 | — |  |
| player-editor-scene | accepted | 4.21 | 670 | 57 | 8 (0 unmeasured) | 1.67 | 🎲 At random 1.67 |  |
| player-friend-code | accepted | 2.76 | 569 | 538 | 27 (1 unmeasured) | 1.67 | ✎ 1.67 |  |
| home-member | accepted | 3.12 | 5 | 4 | 20 (0 unmeasured) | 0.67 | — |  |
| challenge-attempt | accepted | 4.8 | 0 | 0 | 18 (0 unmeasured) | 1.33 | See the challenge ranking 1.33 |  |
| challenge-played | accepted | 4.71 | 0 | 0 | 18 (0 unmeasured) | 1.33 | See the challenge ranking 1.33 |  |
| end-standing | accepted | 3.64 | 168 | 54 | 25 (0 unmeasured) | 0.67 | — |  |
| new-ranked | accepted | 3.31 | 738 | 148 | 29 (1 unmeasured) | 2 | 🎲 At random 2 |  |
| room-door | accepted | 4.76 | 26 | 26 | 21 (0 unmeasured) | 0.67 | — |  |
| room-lobby-friends | accepted | 5.25 | 25 | 22 | 26 (1 unmeasured) | 0.67 | — |  |
| room-lobby-public | accepted | 4.4 | 7 | 5 | 25 (0 unmeasured) | 0.67 | — |  |
| room-join-code | clean | 2.59 | 0 | 0 | 7 (0 unmeasured) | 0.67 | — |  |
| room-playing | accepted | 5.58 | 1551 | 1533 | 43 (4 unmeasured) | 1 | — |  |
| room-loans | accepted | 4.77 | 20 | 18 | 50 (5 unmeasured) | 0.67 | — |  |
| room-resolved | accepted | 4.02 | 2 | 2 | 38 (3 unmeasured) | 0.67 | — |  |
| room-end | accepted | 4.31 | 22 | 20 | 45 (0 unmeasured) | 0.67 | — |  |
| room-history | accepted | 2.2 | 17 | 8 | 38 (15 unmeasured) | 0.33 | — |  |
