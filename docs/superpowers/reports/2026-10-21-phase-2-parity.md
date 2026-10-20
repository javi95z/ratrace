# Phase 2 parity: the solo game beside the web's

The report of phase 2's pixel comparisons. It is the sequel of `2026-10-20-phase-1-parity.md`: the same screen (an iPhone 16 Pro,
402 × 874 pt at 3×, safe areas 62 and 34), the same two shots (the web by Playwright's Chrome, the app by Expo Go on the booted
simulator), the same comparison (`apps/mobile/scripts/kitCompare.ts`: *raw*, *beyond* a device pixel and a shade, *a point
away*, *text*, *shape*), the same tool (`kit-shots.ts`). Pictures and numbers live beside it, in `phase-2-parity/`
(`<section>.png`: the web, the app and the difference side by side; `numbers.json`); phase 1's stay in `phase-1-parity/`, untouched. A
section goes to the report of the phase that added it (`reportFolder` in `kitCompare.ts`).

Each task of the phase that draws something adds its rows here. Rows so far: the kit's motion section (task 4). Scene rows (one game
state drawn by both clients) follow with the screens.

## Scenes: one game state, drawn by both clients

A scene is a named game state (`packages/core/src/testing/scenes.ts`: `SCENES`, `sceneStore(name)`): a life begun on the fixed seed and
played with the content's `saver` bot, through the round store, to a round and a stage; the same save on both clients (the ids, seeds and
clock of every screen's tests). The web draws it at `/<locale>/kit/scene?name=<name>`, the app at `/scene?name=<name>` (development only);
a scene's first word names the screen it is drawn on (`play-finance-r6` on Play). `scene-shots.ts [web] [app] [compare] [--only=a,b]`
writes `<name>-web.png`, `<name>-app.png` and `<name>-diff.png` here, and a line per scene in `phase-2-parity.json` (the share of the
two shots unlike, the shape pixels, how many lines of text are found in one shot only, the worst text offset of the rest).

A round in a scene's name is the player's: `r6` is the sixth round, `view.round` 5. A life saved at the cards can only be saved after a card
is answered (a game opens a hand left half answered on its next card), so `play-cards-r1` has one card answered and shows the second.

Task 5 only proves the plumbing: the five scenes (`home-new`, `home-continue`, `play-news-r1`, `play-cards-r1`, `play-finance-r6`) open on both
clients, but the app still draws phase 1's stand-ins for the screens, so their numbers say nothing yet. Each screen task replaces the
stand-in, adds its scenes, and puts its rows below.

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
