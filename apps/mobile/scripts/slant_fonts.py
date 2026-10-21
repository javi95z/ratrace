#!/usr/bin/env python3
"""
The slanted faces of the reading fonts, made from the fonts the app already has (apps/mobile/assets/fonts/*_Slant.ttf).

The web sets Chakra Petch and Exo 2 with no italic face, and for `font-style: italic` Chrome slants the upright face as it draws it: every glyph is
sheared by -0.25 about its baseline (Skia's skew), x' = x + 0.25 * y with y up from the baseline, and the advances and the kerning are the upright
face's own, so a line breaks where the web's does. iOS does not slant a font that has no italic face (React Native's `fontStyle: 'italic'` does nothing
there), and a real italic is another design with other widths. So the slant is made once, here, as a face of its own: the app asks for it by name
(src/ui/fonts.ts, `slantOf`) and never sets `fontStyle: 'italic'` for it, so Android, which would slant a face that has no italic, does not slant it twice.

    python3 apps/mobile/scripts/slant_fonts.py [--out DIR]

Needs fontTools (pip install fonttools; the committed files were written by the version in MADE_WITH, and a test that regenerates them
compares bytes only with that one). What is done to each file, and nothing else:
  - every glyph is flattened to a simple outline (a composite's components are resolved first, so an accent stays on its letter) and sheared;
  - the left side bearings are the new outlines' own; the advances, the kerning and the cmap are untouched;
  - the anchors of the mark positioning (GPOS) are sheared the same way, so a mark still sits on its slanted base;
  - the hinting is dropped (fpgm, prep, cvt, glyph programs): it was written for the upright outlines and the phone and the browser do not use it;
  - it says what it is: italic angle, caret slope, the italic bits, and the names (below).
The fonts are under the SIL Open Font License 1.1. Neither declares a Reserved Font Name; the modified faces are named "RatRace Slant ..." all the same, as the
license asks of a modified font that has one, so that they are never taken for the originals. Their copyright and license are kept in their name tables, and the
license of each is copied beside them (OFL-Chakra-Petch.txt, OFL-Exo-2.txt). They may not be sold by themselves.
"""
import argparse
import math
import re
import shutil
import sys
from pathlib import Path

import fontTools
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables import ttProgram
from fontTools.ttLib.tables._g_l_y_f import Glyph, GlyphCoordinates

# The fontTools the committed files were written with: a test that writes them again compares bytes only where this is the one installed.
MADE_WITH = '4.63.0'
SHEAR = 0.25
HERE = Path(__file__).resolve().parent
PACKAGES = HERE.parent / 'node_modules' / '@expo-google-fonts'
DEFAULT_OUT = HERE.parent / 'assets' / 'fonts'

# The family each face is registered under in the app (src/ui/fontSources.ts), the font it is made from, and the license it carries.
FACES = {
    'ChakraPetch_400Regular_Slant': ('chakra-petch/400Regular/ChakraPetch_400Regular.ttf', 'chakra-petch/LICENSE_FONT', 'OFL-Chakra-Petch.txt'),
    'ChakraPetch_600SemiBold_Slant': ('chakra-petch/600SemiBold/ChakraPetch_600SemiBold.ttf', 'chakra-petch/LICENSE_FONT', 'OFL-Chakra-Petch.txt'),
    'Exo2_400Regular_Slant': ('exo-2/400Regular/Exo2_400Regular.ttf', 'exo-2/LICENSE_FONT', 'OFL-Exo-2.txt'),
    'Exo2_600SemiBold_Slant': ('exo-2/600SemiBold/Exo2_600SemiBold.ttf', 'exo-2/LICENSE_FONT', 'OFL-Exo-2.txt'),
}


def sheared(x, y):
    """Where a point goes: right by a quarter of its height above the baseline, to a whole unit (half up, so that it never depends on the platform)."""
    return int(math.floor(x + SHEAR * y + 0.5))


def slant_glyphs(font):
    glyf = font['glyf']
    hmtx = font['hmtx']
    # Every glyph's final outline first: a composite is resolved against the upright components, which must not have been changed yet.
    outlines = {}
    for name in font.getGlyphOrder():
        glyph = glyf[name]
        if glyph.numberOfContours == 0:
            outlines[name] = None
            continue
        coords, ends, flags = glyph.getCoordinates(glyf)
        outlines[name] = ([(sheared(x, y), y) for x, y in coords], list(ends), [f & 1 for f in flags])
    for name, outline in outlines.items():
        if outline is None:
            continue
        points, ends, on_curve = outline
        glyph = Glyph()
        glyph.numberOfContours = len(ends)
        glyph.coordinates = GlyphCoordinates(points)
        glyph.endPtsOfContours = ends
        glyph.flags = bytearray(on_curve)
        glyph.program = ttProgram.Program()
        glyph.program.fromBytecode(b'')
        glyf[name] = glyph
        glyph.recalcBounds(glyf)
        advance, _ = hmtx[name]
        hmtx[name] = (advance, glyph.xMin)
    for tag in ('fpgm', 'prep', 'cvt '):
        if tag in font:
            del font[tag]


def slant_anchor(anchor):
    if anchor is not None:
        anchor.XCoordinate = sheared(anchor.XCoordinate, anchor.YCoordinate)


def slant_anchors(font):
    """The anchors of every kind of positioning that attaches one glyph to another (marks, ligature marks, cursive joins)."""
    if 'GPOS' not in font:
        return
    for lookup in font['GPOS'].table.LookupList.Lookup:
        for subtable in lookup.SubTable:
            if lookup.LookupType == 9:
                subtable = subtable.ExtSubTable
            kind = getattr(subtable, 'LookupType', lookup.LookupType)
            if kind == 4:
                for record in subtable.MarkArray.MarkRecord:
                    slant_anchor(record.MarkAnchor)
                for base in subtable.BaseArray.BaseRecord:
                    for anchor in base.BaseAnchor:
                        slant_anchor(anchor)
            elif kind == 5:
                for record in subtable.MarkArray.MarkRecord:
                    slant_anchor(record.MarkAnchor)
                for attach in subtable.LigatureArray.LigatureAttach:
                    for component in attach.ComponentRecord:
                        for anchor in component.LigatureAnchor:
                            slant_anchor(anchor)
            elif kind == 6:
                for record in subtable.Mark1Array.MarkRecord:
                    slant_anchor(record.MarkAnchor)
                for mark in subtable.Mark2Array.Mark2Record:
                    for anchor in mark.Mark2Anchor:
                        slant_anchor(anchor)
            elif kind == 3:
                for record in subtable.EntryExitRecord:
                    slant_anchor(record.EntryAnchor)
                    slant_anchor(record.ExitAnchor)


def name_of(font, name_id):
    record = font['name'].getName(name_id, 3, 1, 0x409)
    return record.toUnicode() if record else ''


def rename(font, family):
    names = font['name']
    original_family = name_of(font, 1)
    original_unique = name_of(font, 3)
    for name_id in (1, 2, 3, 4, 6, 10, 16, 17, 21, 22):
        names.removeNames(nameID=name_id)
    made = f'RatRace Slant {original_family}'
    entries = {
        1: made,
        2: 'Italic',
        3: f'RatRace Slant;{original_unique}',
        4: f'{made} Italic',
        6: re.sub(r'[^A-Za-z0-9]', '', made) + '-Italic',
        10: f'{original_family} with every glyph sheared by {SHEAR} about its baseline (x += {SHEAR}y), as a browser slants a face that has no italic: advances and kerning are the original\'s. Made for The Rat Race by apps/mobile/scripts/slant_fonts.py. Derived from {original_family} under the SIL Open Font License 1.1.',
    }
    for name_id, text in entries.items():
        names.setName(text, name_id, 3, 1, 0x409)
        names.setName(text, name_id, 1, 0, 0)


def mark_italic(font):
    font['post'].italicAngle = -math.degrees(math.atan(SHEAR))
    font['head'].macStyle |= 2
    font['OS/2'].fsSelection = (font['OS/2'].fsSelection | 1) & ~64
    font['hhea'].caretSlopeRise = 1000
    font['hhea'].caretSlopeRun = int(SHEAR * 1000)


def make(source, destination):
    font = TTFont(source, recalcTimestamp=False)
    slant_glyphs(font)
    slant_anchors(font)
    rename(font, destination.stem)
    mark_italic(font)
    font.recalcTimestamp = False
    font['head'].modified = font['head'].created
    font.save(destination)


def main(argv):
    parser = argparse.ArgumentParser(description='Makes the slanted faces of the reading fonts.')
    parser.add_argument('--out', type=Path, default=DEFAULT_OUT)
    args = parser.parse_args(argv)
    args.out.mkdir(parents=True, exist_ok=True)
    for family, (source, license_file, license_name) in FACES.items():
        make(PACKAGES / source, args.out / f'{family}.ttf')
        shutil.copyfile(PACKAGES / license_file, args.out / license_name)
        print(f'{family}.ttf')
    print(f'fontTools {fontTools.version}')


if __name__ == '__main__':
    main(sys.argv[1:])
