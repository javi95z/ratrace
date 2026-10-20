# Art prompt pack: v19

The rat's faces, drawn again. The faces of v15 (sheet 106) were drawn on a flat silhouette with
nothing to say where the eye and the mouth sit, and came out as front-facing emoji: a second eye
floating on the snout, mouths in the middle of the cheek, thin black lines on a painted rat. The
rat is seen from the side, facing right: it has **one eye** and a mouth **under the tip of its snout**.

Use the same ChatGPT project and the same **style block** (in `v1-prompt-pack.md`). Start the
message with `Match the attached sheet's style and level of detail exactly.` The checks before
saving are the same as in v1, plus the ones below.

## 112. Faces, in profile

Save as `art/raw/brand/rat-face-02.png` — `rat.face.calm`, `rat.face.grin`, `rat.face.smug`, `rat.face.wink`, `rat.face.shock`, `rat.face.sleepy`, `rat.face.fierce`, `rat.face.tears`

Attach `art/raw/brand/rat-body-01.png` (the rat with its own face: the eye and the smile to copy) and
`art/raw/brand/rat-face-01.png` (the grid and the silhouette to keep).

```text
Landscape image, 2:1. Object sheet on the exact grid of the second attached sheet: 4 columns by 2 rows of square cells, and in every cell the same flat pale lavender silhouette (#D9C2F0, no shading, no outline) in the same pose, size and place. The rat is seen from the side, facing right, exactly like the rat in the first cell of the first attached sheet. On each silhouette draw only the face of that rat, in its painted pixel-art style, at the same size and in the same place as in the first attached sheet:
- ONE eye only, the near eye, exactly where the first attached sheet's rat has its eye. Never a second eye: the far eye is hidden behind the snout.
- The mouth is a short curve just under and behind the tip of the snout, where the first attached sheet's rat has its smile; never in the middle of the cheek.
- Eyelids and brows are soft dark fur-brown strokes with a little shading, not thin black lines.
- Nothing else: no nose, no whiskers, no ears, no fur, no outline of the head.
Left to right, top to bottom:
1. Calm: the eye open and bright, the small closed smile of the first attached sheet.
2. Grin: the eye happy, the mouth open in a smile under the snout showing its two front teeth.
3. Smug: the eyelid half closed, a lifted brow, one corner of the mouth up.
4. Wink: the eye shut in a happy downward curve, a sly smile.
5. Shocked: the eye wide and round with a small pupil, the brow raised high, the mouth a small round "o" under the snout.
6. Sleepy: the eye shut in a soft downward curve, a tiny yawn under the snout.
7. Fierce: a thick brow slanting down towards the snout, the eye narrowed, the mouth a firm straight line.
8. Laughing to tears: the eye shut in a happy curve, two small light-blue tears running down from the corner of that eye along the cheek (not on the nose), the mouth open laughing under the snout.
```

Extra checks before saving:
- One eye per cell, in the same place in all 8, where the eye of `rat-body-01` is.
- Every mouth sits under the snout tip, not on the cheek.
- The silhouette and the grid match `rat-face-01.png`; nothing crosses into another cell.
- Lay a cell over the body (`rat-body-02`): the face must read as part of the painted rat, not a sticker.

Then say so: the line for `rat-face-01` in `tools/art/src/sheets.ts` changes to `rat-face-02`, and
`pnpm -s art` cuts it into the same eight `rat.face.*` sprites, so every player keeps the face they chose.
