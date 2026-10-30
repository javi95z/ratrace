# v27 prompt pack: the legendary cards

Content 1.54 added six legendary cards, met in about one life in fifty. The game draws them in a gold frame with a sheen across the picture,
so each scene should feel like a jackpot moment: warm gold light, one clear subject, a little more wonder than an everyday card. They stand in
with cells cut from older sheets until drawn. One standard sheet, wired in `tools/art/src/sheets.ts`: saving it replaces the stand-ins.

| Save as | The six panels, in order |
|---|---|
| `art/raw/cards/cards-65.png` | `card.legend_coat_ticket`, `card.legend_stranger_will`, `card.legend_airdrop`, `card.legend_viral`, `card.legend_star_neighbour`, `card.legend_attic_painting` |

Exactly 1586×992, 6 panels 2×3, each cut to a 288×120 card. Attach `art/raw/cards/cards-47.png` and `art/raw/cards/cards-48.png` (the style, palette
and line to match). Keep the edges of each panel free of gold: the game frames the card in gold itself.

```text
Landscape image, exactly 1586×992 pixels (8:5), made of 6 wide panels: 2 columns by 3 rows, each panel 12:5, all six the same size, edge to edge with no gutter, border or frame. Scene sheet in exactly the painted pixel-art style, palette and line of the attached sheets: night-blue shadows, warm gold light, small rounded figures, the player the same small figure as on the attached cards. Each panel is one full illustrated scene that reads at a small size: one clear subject, a simple background, and a touch more golden glow than an everyday card. No text anywhere: any sign, screen, ticket, letter, banner, logo or paper shows blank shapes. Left to right, top to bottom:
1. The ticket in the old coat: a small bedroom with an open wardrobe, the player sitting on the edge of the bed holding up a small blank lottery ticket in both hands, mouth open, an old winter coat with its pocket turned out on the floor, a phone glowing on the duvet, warm lamp light.
2. A stranger's will: a quiet notary's office with tall bookshelves, an elderly notary in round glasses handing the player a heavy envelope with a wax seal, on the desk a framed photo of a kind old man beside a small whitewashed guesthouse by the sea, rain on the window.
3. The airdrop: the player at night on a sofa, lit by a laptop whose screen shows a blank chart line shooting straight up, golden coins with a cartoon dog-like blank face shape raining down from the ceiling around them, a cat watching from the armrest.
4. Eighty million views: a wedding dance floor under strings of warm bulbs, the player mid-dance in a wild pose, a ring of guests holding up phones with glowing blank screens, tiny heart and thumbs shapes floating up from the phones.
5. A star next door: two suburban gardens split by a low hedge at dusk, on the far side a glamorous film star in sunglasses and a long gown at a glittering pool party with spotlights, on the near side the player in slippers holding a watering can, waving over the hedge, a paparazzo half hidden in a bush.
6. The painting in the attic: a dusty attic lit by one shaft of light from a round window, the player pulling back an old mirror to reveal a gilt-framed oil portrait of a noblewoman, an auction-house expert in a bow tie peering at it through a loupe, old trunks and cobwebs around.
```

The cells to replace are named above in their order; no panel is kept for later.
