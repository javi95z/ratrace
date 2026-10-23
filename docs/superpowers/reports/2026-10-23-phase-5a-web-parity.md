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
| A workplace's screens, a banner, never still. | A `Loop` plays on both webs; Chrome now and then rasters a picture at a scale that is not whole on other pixels for one shot, nothing of the page changed. | The loops' boxes are allowed to turn (`changedWithin`); twice the tries to stand still. |

## Results

RESULTS

## Residuals of the app's web: pictures at a fraction of a point

A picture laid at a fraction of a point (a rat in a row, the city's picture in the Hud, a card's glow ending) stands where the Next web's does to the
1/64 px on both sides (measured with `getBoundingClientRect`), and is drawn nearest-neighbour from its art: a few of its edge pixels are sampled on
the next device row. `rankings-friends` (17), `room-lobby-friends` (5), `room-lobby-public` (14), `room-loans` (17), `room-resolved` (7), `room-end`
(17), `room-history` (12): the rats. `play-news-r1` (4), `play-news-r6` (1), `hud-news-r1` (4), `play-resolve-r6` (3), `finance-business` (4): the
city's picture and a picture's edge. `celebrate-earned` (230): the last row of the light under the last card, the width of the page.

## Residuals of the app's web: what lies under the bar of the next step

The tops of the letters of a line the bar of the next step covers (covered at its middle, so no text to the check) peek over the bar's edge a device
pixel apart: `play-guide-r1` (241, and the city's four pixels), `room-playing` (99). The phone's `finance-taxes` class.

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

PHONE

## A whole life in the browser

LIFE

## The Next web's shots, shot again

WEBSHOTS

## Weight

SIZE

## For phase 5b

FIVEB
