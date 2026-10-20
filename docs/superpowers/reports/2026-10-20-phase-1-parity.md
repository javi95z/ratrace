# Phase 1 parity: the kit beside the web's

The exit of phase 1. Every piece of the kit is shown on two pages with the same sections, in the same order, with the
same words: the app's `apps/mobile/src/app/kit.tsx` (development only) and the web's
`apps/web/src/app/[locale]/kit/page.tsx` (this branch only, in no sitemap, linked from nowhere). Both are shot on the
same screen and compared pixel by pixel.

**Result: no difference beyond what the platforms cannot do.** No shape, colour or place differs by more than a point
(the web's own pixel) or a shade; every line of text stands within a point of the web's, the worst a point (the ▸ that neither
platform's game fonts draw, below, and a KeyFigure). Thirteen differences were found and fixed in the app's components; the web was not
changed.

## How it is shot and compared

```
pnpm --filter @ratrace/web exec tsx ../mobile/scripts/kit-shots.ts [web] [app] [compare] [--only=a,b]
```

- **Screen.** An iPhone 16 Pro: 402 × 874 pt at 3×, safe areas 62 pt on top and 34 below. The web is shot by Playwright
  (the Chrome on this Mac) at exactly that, with Chrome's `Emulation.setSafeAreaInsetsOverride` giving the page the
  phone's insets, so `env(safe-area-inset-*)` (the night-900 strip on top, the sheets' bottom padding) is what it is on
  the phone. The web is served by its own `next dev -p 3021`, started and stopped by the script, with no cloud. The
  fonts are the real ones (Google, through next/font; the shot waits for `document.fonts.ready`).
- **App.** Expo Go on the booted simulator (iPhone 16 Pro, iOS 18), Metro on 8090; each section opened by deep link,
  `exp://127.0.0.1:8090/--/kit?section=<id>` (the web: `/<locale>/kit?section=<id>`), shot with `simctl io screenshot`.
  Expo Go's floating tools button is turned off (`defaults write host.exp.Exponent EXDevMenuShowFloatingActionButton -bool NO`),
  the status bar fixed at 9:41.
- **Held still.** A Sheet is rendered open; the Toast is given a timeout of 10⁹ ms; a pressed Button is a copy of the
  pressed look (the web's `active:translate-y-[2px]`, the app's `sink(true)`) around a plain Button, on both pages. The
  web's keyboard focus ring (`:focus-visible`), which a sheet opened with no tap before it shows and a player's tap
  never does, is hidden in the shot; so is the Next.js dev badge.
- **Compared** (`apps/mobile/scripts/kitCompare.ts`, tested): the screen between the safe areas (rows 62–840 pt).
  - *raw*: pixels more than 8 levels apart.
  - *beyond*: more than a **shade** (24 levels of 255 on the channel that differs most; the two closest tokens,
    night-800 and night-700, are 26 apart) from every pixel of the other shot within **one device pixel**.
  - *a point away*: the same, within **3 device pixels (1 pt)**. Chrome puts the edges of boxes on whole CSS pixels and
    the phone on device pixels, so the same box stands up to a point apart; a frame or a fill unmatched a point away
    is a real difference. The ground's dots count as one surface with the ground between them, at the dots' own places
    only (a box an edge's width off uncovers or hides a dot; the dots themselves are compared in the `dots` section);
    the counts without that allowance are in the table too.
  - *text*: each line of text on the web page (the browser's client rects of every text node) is found in both shots
    by its ink: the pixels within 10 levels of the colour its glyphs are drawn in (the computed colour, seen through
    the opacity of the boxes round it), in no other line's box. The two ink boxes are compared edge by edge; ink that
    fills its whole window, or a line under something drawn over it (a sheet's backdrop), is reported unmeasured.
    The glyphs' own pixels and a point round them are left to this check: two rasterisers (Skia in Chrome, CoreText
    on iOS) antialias the same glyph at the same place differently, which the brief counts as equal.
  - *shape*: what is unmatched a point away and is not text. This must be zero.

Pictures: `docs/superpowers/reports/phase-1-parity/<section>.png` — the web, the app and the difference side by side,
cropped to what the section shows. In the difference: grey where alike, ochre where not exactly alike, red beyond a
device pixel and a shade, blue where that is the edge of a glyph, magenta where nothing matches a point away (shape).
`numbers.json` has every number, every line of text with both ink boxes, and every place of a shape difference.

## Final numbers

| section | raw % | beyond % | a point away (px) | same, no dots rule (px) | shape (px) | text lines measured | worst text (pt) |
|---|---|---|---|---|---|---|---|
| buttons | 2.67 | 0.221 | 3184 | 3193 | 0 | 14/14 | 0.67 |
| surfaces | 3.02 | 0.206 | 3857 | 3983 | 0 | 10/10 | 0.33 |
| stats | 3.40 | 0.250 | 2171 | 2271 | 0 | 15/15 | 1.00 (▸, below) |
| bars | 2.31 | 0.041 | 704 | 704 | 30 (below) | 5/5 | 0.67 |
| choices | 3.15 | 0.566 | 1860 | 2238 | 0 | 10/10 | 0.67 |
| lists | 2.90 | 0.178 | 3096 | 3127 | 0 | 10/10 | 1.00 |
| sheet-gold | 0.48 | 0.129 | 2615 | 2615 | 0 | 4/5 (the heading under the backdrop) | 0.33 |
| sheet-wine | 0.42 | 0.110 | 2272 | 2272 | 0 | 4/5 (the same) | 0.33 |
| tabs | 2.58 | 0.151 | 2136 | 2179 | 0 | 8/8 | 0.67 |
| art | 2.31 | 0.009 | 177 | 177 | 47 (below) | 1/1 | 0.00 |
| text-es | 3.09 | 0.324 | 6324 | 6335 | 0 | 5/5 | 0.33 |
| text-ru | 3.01 | 0.242 | 4311 | 4328 | 0 | 5/5 | 0.33 |
| type | 2.64 | 0.112 | 2025 | 2026 | 0 | 17/17 | 0.33 |
| dots | 2.48 | 0.007 | 155 | 155 | 0 | 1/1 | 0.33 |

"a point away" pixels are all glyph edges (blue in the pictures) but for the shape column. The raw 2–3 % is mostly
the ground's dots: the browser draws each as an antialiased disc of radius 1 px, the app as `dots.png`, and their
edges differ by a level or two (within a shade everywhere).

Sections: `buttons` (four variants, normal, pressed, disabled, wide), `surfaces` (Tiles, Panel with and without
title, Tag tones, Well), `stats` (Stat plain and pressable at 300 and 360 wide), `bars` (Bar gold and teal, door shut
and open, empty; TickerBadge kinds and a logo), `choices` (Segmented with a disabled choice, Toggle on and off, with
hint and icon), `lists` (Row, KeyFigure tones), `sheet-gold`, `sheet-wine`, `tabs` (Tabs, Picker, Toast), `art`
(sprite at 1/2/3, silhouette, RatAvatar sm/md/lg), `text-es` and `text-ru` (pixel 28 and 17, reading 15 and 12, on a
page in that language), `type` (pixel and reading text at 11–28, each in its own box), `dots` (the ground alone).

## What differed, and how it was fixed

All in the app; the web is the reference.

| # | section | difference (first shot) | cause | fix (owning component) | test |
|---|---|---|---|---|---|
| 1 | every one | the ground's dots stopped 34 pt above the foot of the screen | the dots image was sized `100%` inside a box padded by the top inset: a percentage of the padded box | `Page`: the image sits in a box with no padding; the insets are padded inside it | `Page.test`: the ground's box has no padding, the column inside it has the inset |
| 2 | every one | the outer 2 pt edge of any frame against the side gutter was missing (buttons, tiles, panels, wide buttons) | the 12 pt gutter was padding around the navigator, and a screen clips what it holds | the gutter is the screens' own (`SCREENS.contentStyle.paddingHorizontal`, `GUTTER`), inside what clips; `Page` keeps the 448 column | `navigation.test`, `Page.test` |
| 3 | every one | pixel titles stood 1–2.7 pt above the web's, reading text up to 1.3 pt below | iOS puts a baseline at lineHeight − descent (React Native centres it only when the line is taller than the font, and pixel text, 1.1, is shorter than Jersey at its adjusted size); Blink rounds ascent and descent to whole pixels and the upper half-leading down | `baselineShift` (fonts.ts) computes Blink's baseline (verified on 16 lines of `type`) and iOS's, and the text's glyphs are moved by the difference | `fonts.test`: worked values for a pixel 17 and a reading 15 |
| 4 | lists, text-es, sheets | the top of a KeyFigure's `$`, the accent of `Año`, the sheet's `✕` were cut off | iOS clips a text to its box, and those glyphs stand out of a short line; a transform moved the clip with the glyphs | `headroom` (text.tsx): padding moves the glyphs inside a box made taller, negative margins keep its place | `text.test`: the place and the caller's margins kept, room ≥ half the size above and below |
| 5 | surfaces, choices, stats, sheets | each text pushed what follows down by up to ⅓ pt more than the web (1 pt after a few) | iOS makes a text as tall as its lines rounded *up* to a device pixel | line heights put on the pixel grid to the nearest pixel, a hair under (`onGrid`), so the error is at most ⅙ pt either way and does not add up | `text.test` |
| 6 | text-ru | Russian titles 9–16 pt wider than the web's | the web's `:lang(ru) .pixel { word-spacing: -0.16em }` was not applied to Jersey's spaces; and a space between Russian words was Oswald's, where the browser takes Jersey's (the first font that draws a space) | `Language` context (given by `WordsProvider`, as the web's `<html lang>`); on a Russian page each space of a pixel text is its own run with the word spacing added; a space is always the first font's | `text.test`, `fonts.test` |
| 7 | text-es, sheets, Row | reading lines ~1 pt wider than the web's | `letterSpacing: 0` on iOS is not nothing: it turns the font's kerning off | no letter spacing is set where there is none; a pixel text without tracking (`tracking={false}`, the web's `tracking-normal`, the Stat's value) likewise | `text.test` |
| 8 | stats, choices | Stat label and choice hint lines 0.25 pt taller | 14 where the web's `leading-tight` is 11 × 1.25 = 13.75 | `TIGHT = 1.25` used for every small line (Stat label, Segmented hint, Tag, Toggle hint) | `kit.test` |
| 9 | surfaces | a Tile's picture stood at its left, not centred | `Bare` had `alignSelf: 'flex-start'`; the web's inline-flex `Bare` is placed as its flex parent places it | `Bare` follows its parent (and takes a `style` for size, as the web's takes a class) | `kit.test` |
| 10 | choices, bars | a dark 2 pt outline round the Toggle's switch and round every Bar | the web writes `frame sunk`: both set the box-shadow and `sunk` comes later, so only the sunk edge is drawn (checked with `getComputedStyle`) | switch and Bar are `Framed kind="sunk"` | `kit.test`: nothing drawn outside either box |
| 11 | bars | the lamps of a Bar with a door drifted up to 2 pt left | the door was 14 wide; on the web it stands 2 into its 14 column, 12 wide | door 12 × 14, 2 in | `kit.test` |
| 12 | tabs (Picker ▼) | the ▼ of a Picker smaller and lower | Chakra's file has ▼ (and →), but none of its Google subsets does, so the web never draws them in Chakra: next/font's stand-in, Arial at Chakra's 102.51 %, does (Chrome: `CSS.getPlatformFontsForNode`) | `runsOf` models the web's fallback: each font only for what its subsets ask for; next, on pages other than Russian, Arial (pixel text scaled by the adjust like any font; reading text at 102.51 %); past them a dingbat from Zapf Dingbats and any other sign from the system font, as Chrome does on Apple systems | `fonts.test`; Arial's coverage is written from macOS's Arial by `scripts/fontCoverage.ts` and tested where it exists |
| 13 | sheets | the ✕ 4 pt smaller and lower | as 12: no game font draws ✕; the web's is Zapf Dingbats, scaled by the pixel text's adjust as Jersey is (it has no small letters to measure) | as 12 | `fonts.test` |

Found and fixed on the way, not a picture: a test file under `src/app` is a route to expo-router, and one that imports
`node:fs` breaks the app's bundle (the kit pages' test lives in `scripts/` and a test now says no test lives among the
routes).

## What is left, and why it is the platform

- **Glyph edges.** The same font at the same size and place, antialiased by Skia (Chrome) and CoreText (iOS): the blue
  pixels of every picture. Every measured line's ink stands within a point of the web's (most within ⅓–⅔ pt).
- **Edges of boxes up to ⅔ pt apart.** Chrome puts box edges on whole CSS pixels (a toggle that ends at 222.39 is drawn
  to 222), the phone on device pixels (222.67); and a text's width is measured to a device pixel on iOS, so a row of
  buttons or tabs sized by their words drifts by fractions of a point. Never a point.
- **▸ in a pressable Stat (stats, 1 pt).** No font of the stack nor Arial draws ▸; Chrome on macOS takes it from
  macOS's system font (`.SF NS`), the app from iOS's, which draws it a device pixel smaller. A 10 px decoration; Safari
  on an iPhone very likely takes iOS's, as the app does (not checked).
- **bars, 30 px.** The web paints a Bar's lamps as gradients on one strip whose cells are fractions of a pixel wide; the
  last lit lamp bleeds one device pixel of light into the next, dark one. The app draws each lamp as a box on the pixel
  grid, without the sliver.
- **art, 51 px.** The 128 px rat drawn at 28, 40 and 92 pt: both platforms scale it nearest-neighbour, but to a size
  that is not a whole multiple (2.16 device pixels per art pixel at `lg`), and the two choose a different source pixel
  in a few columns and rows.
- **Pixel baselines.** Blink's last rounding (the baseline on a whole CSS pixel, rounded down) depends on where a line
  falls on the page; the app reproduces every step before it. What remains is under a point.

## Concerns for later phases

- **Android is not measured.** The baseline shift and the line-height grid are applied on iOS only (Android lays lines
  centred, as CSS does, but that is unverified until the emulator is installed). The Arial and Zapf Dingbats fallbacks
  are iOS names.
- **Chrome is the reference here.** The players' iPhones run Safari (WebKit), whose rounding of baselines and box edges
  may differ by the same fractions of a point; where Chrome and iOS disagree on a system fallback glyph, Safari on iOS
  most likely sides with the app.
- **Cyrillic outside a Russian page.** On the web, a Russian word in a pixel title of an English or Spanish page is drawn
  by Arial (the stand-in), not Oswald; `runsOf` now does the same. The web's one exception, the language's own name
  (`--font-pixel-cyrillic-alone`), will need the same exception when the language picker is ported.
- **Text measured on the device.** Text widths are measured on device pixels; a long row of short labels can drift by a
  few thirds of a point from the web. Not seen beyond ⅔ pt in the kit.

## Fix round 1 (review findings)

- **The text check was blind on small fills.** It took a line's background as the commonest colour in its box, so on
  a Tag or a panel's tab every ground pixel in the window counted as ink: `+120 $`, `-80 $`, `Rent` and `Savings`
  "matched" with ink boxes the size of the window, and the mask then hid that window from the shape count. Ink is now
  the glyphs' own colour (from the computed style, composited through any opacity: the disabled buttons and choice);
  a window full of ink, or a line under the sheet's backdrop, is reported unmeasured; the mask is the ink pixels and a
  point round them, never the window. Unit tests: a tag-like line is measured by its glyphs; a window full of ink is
  unmeasured.
- **What the corrected check found.** 109 of the 111 lines are measured (the two left out are the
  sheet sections' headings, under the backdrop): the Tags (`+120 $` 0.33, `-80 $` 0.33, `Rent` 0), `Savings`
  (0.33), the disabled `Off`s (≤ 0.67) and `High`/`9 %` (≤ 0.67), the TickerBadges (≤ 0.67) all stand within a point of
  the web's; no shape difference appeared outside the two already listed (bars 30 px, art 47 px). No component needed a
  change for it.
- **The dots rule** merged any night-700 fill with the ground. It now holds only at the dots' own places (a disc in
  each 6 pt tile); the counts with no allowance at all are in the table ("no dots rule").
- **Words took taps.** The headroom that keeps glyphs from being clipped made a text's box reach past its line, over a
  button above or below it. Every PixelText and ReadText is now `pointerEvents: 'none'` (they have no press of their
  own; the pressable round them takes it), and a caller's own padding is added to, not replaced. Tests: a press on a
  Button with a text just below it reaches the Button and the text is not a target; a caller's padding survives.
- `tools/online/src/errors.test.ts`: a TODO that its `kit` exclusion leaves with the kit page (phase 5).
