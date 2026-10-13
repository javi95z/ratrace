# Look and Legibility: Build Plan

Date: 2026-10-13
Spec: `docs/superpowers/specs/2026-10-12-ratrace-v1-solo-design.md` (sections 5, 6, 7 and Appendix A)
Builds on: branch `web` at 1903273, on its own branch `look`.

This is roadmap step 10b. The owner chose the look from three drawn directions (`docs/design/2026-10-13-visual-directions.png`): direction A, "pixel de lujo", with Jersey 15 as the pixel typeface. The same message asked for property on the same background as everything else, more kinds of property, and icons in the lifestyle tab. Like the earlier plans this records decisions and tasks, not code.

## Decisions

### One place decides the look

- The look lives in `globals.css` (frames, bevels, the tab, lamps, the page) and `ui/kit.tsx` (panel, button, stat, track, tile, switch, choices). Screens change only where they did something by hand.
- Only the 31 palette colours are used, as before. The lit and shaded edges of a surface are palette colours named per surface.
- The colours of a frame belong to the element that names them. They are registered as properties that do not inherit, so a gold panel does not gild the buttons inside it.

### Type

- Jersey 15 replaces Pixelify Sans for titles and numbers. Its figures are the reason: amounts in the HUD were being misread.
- Jersey is drawn small inside its size. It is scaled with `font-size-adjust: 0.56` so that every size already in the game keeps its meaning, instead of every size being rewritten. The share card draws on a canvas, which has no such property, so it measures the typeface and scales by the same number; a test keeps the two numbers the same.
- A HUD figure beside its icon has least room on a mid-sized phone. There it is set one or two pixels smaller; on the narrowest the icon steps aside, as before. A test measures the longest amounts in both languages at five widths.

### Surfaces

| Thing | Before | Now |
|---|---|---|
| Panel | flat navy, grey title inside | lit and shaded edges; title on a gold tab over the top edge |
| Button, tab, switch, choice | flat with a drop shadow | lit on top, shaded underneath, on a hard shadow |
| Sprite well, gauge, track | flat | sunk |
| Headline | cream strip | clipping: subject block with icon, subject word, sentence |
| Rat-race bar | sixteen cells | sixteen lamps and a door that opens at the end |
| City and portrait | single frame | double frame, gold between |
| Property and item tiles | cream | navy tile, picture in a dark well; a gold edge on what is owned |

### Property

- Every kind of property is a tile like any other thing to buy. The cream tiles are gone.
- Two kinds join now, with art that was already drawn: a parking space and a shop unit. Nobody can live in them. The engine learns two things about a kind of property: that it is only for letting, and what share of the city's rent it lets for. A kind that is only for letting is always let, gives no status, and cannot be bought as a home, by an order, a card or a starting life.
- A quote says whether a kind is only for letting and what it would bring in a year, so the screen shows both without working anything out.
- No version is bumped: a life in progress replays the same, because nothing an existing save could contain behaves differently.
- Nine more kinds are asked for on a new art sheet (04b) and join when it lands.

### Icons

- Every choice of the lifestyle tab gets a picture: the three uses of focus, the four ways of living, the two kinds of rented home, the four insurances, and the city.
- The right pictures are asked for on a new art sheet (06b). Until it lands, each is lent an existing icon through one list in the content. A test fails the day a lent picture exists for real, so the list cannot go stale.

## Tasks

- [x] 1. Engine: kinds of property that are only for letting, rent by kind, the quote
- [x] 2. Content: parking space and shop, their names, the icon list with stand-ins
- [x] 3. Look: globals and kit, Jersey 15, the share card
- [x] 4. Screens: HUD, news clippings, property and shop tiles, purchase sheet, lifestyle icons, collection, records, end
- [x] 5. Art: sheets 04b and 06b in the prompt pack and the art tool
- [x] 6. End-to-end at the three sizes, audit, both languages
- [ ] 7. Fresh review and one fix pass
