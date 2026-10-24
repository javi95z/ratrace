import { CARD } from '@ratrace/core/game/share';
import type { DrawOp } from '@ratrace/core/game/share';
import { FilterMode, ImageFormat, MipmapMode, Skia, Image as Picture, type SkFont, type SkImage, type SkTypeface } from '@shopify/react-native-skia';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useBlink } from '../../ui/animations';
import { Canvas } from '../../ui/Canvas';
import { Framed } from '../../ui/Frame';
import { runsOf, type Run } from '../../ui/fonts';
import { Button } from '../../ui/kit';
import { Sheet } from '../../ui/overlay';
import { readSprite } from '../../ui/spriteImages';
import { PixelText, ReadText } from '../../ui/text';
import { typefaceOf } from '../../ui/typefaces';
import { usePictureShare, useSettings, useT, useTrack } from '../context';
import { hrefOf } from '../pages';
import { SITE_URL } from '../site';

/*
 * The web's ShareCard.tsx, on the phone. The card is drawn as the web's canvas draws it: core's list of things to draw (`shareCard`), four times the
 * grid, its pictures with no smoothing, its type in the game's typefaces at the sizes the page shows them. On a surface of Skia's of its own, then a PNG,
 * which the phone's share sheet is handed as a file (written to the cache: `usePictureShare`), with the web's line inviting into the game (its words and
 * its address, `SITE_URL`) where the sheet takes words beside a file: on iOS, not on Android. The web's link that saves the picture as a file is a button
 * that saves it to the phone's photos, in the link's words and look. Where the picture cannot be had, or saved, it says so in the phone's own words (the
 * web's speak of a browser, and a browser saves without asking). Nothing of it is drawn until the player asks for the picture.
 */

/** Fetches a sprite's picture, or null if it does not exist or does not arrive. Whoever asked lets go of it. In the app, the app's files; a test hands in its own. */
export type SpriteLoader = (id: string) => Promise<SkImage | null>;

/** The typeface of a family the kit's runs name, or null where it cannot be had. In the app, the app's font files; a test hands in its own. */
export type FaceLoader = (family: string) => Promise<SkTypeface | null>;

interface Drawing {
  load?: SpriteLoader;
  faces?: FaceLoader;
  /** The language of the words, which says which typeface draws each letter, as on a page in it (`runsOf`). */
  language?: string;
}

/** A piece of a line of text: what one typeface draws, at the size it is drawn. */
interface Piece {
  text: string;
  face: SkTypeface | null;
  size: number;
}

/**
 * Draws the list on a surface four times the size of the grid, its sprites with no smoothing, so every art pixel is a square of sixteen. A line of
 * text is cut into the pieces each typeface draws, as the page's lines are (`runsOf`): the pixel typeface and the one that draws its Cyrillic each
 * brought to the page's height of small letters (`PIXEL_X_HEIGHT`), the reading ones as they are. Returns the picture, or null where the phone gives
 * no surface to draw on.
 */
export async function drawCard(ops: DrawOp[], { load = readSprite, faces = typefaceOf, language = 'en' }: Drawing = {}): Promise<SkImage | null> {
  const scale = CARD.scale;
  const width = CARD.w * scale;
  const height = CARD.h * scale;
  const surface = Skia.Surface.MakeOffscreen(width, height) ?? Skia.Surface.Make(width, height);
  if (!surface) return null;

  // Each line as the runs of the typefaces that draw it, and each typeface asked for once, before anything is drawn: only those the card draws with.
  const lines = new Map<DrawOp, Run[]>();
  for (const op of ops) if (op.kind === 'text') lines.set(op, runsOf(op.text, op.font === 'pixel' ? 'pixel' : 'read', 400, language));
  const typefaces = new Map<string, SkTypeface | null>();
  for (const runs of lines.values()) {
    for (const run of runs) if (!typefaces.has(run.family)) typefaces.set(run.family, await faces(run.family).catch(() => null));
  }
  const pictures = new Map<string, SkImage | null>();
  for (const op of ops) if (op.kind === 'sprite' && !pictures.has(op.id)) pictures.set(op.id, await load(op.id).catch(() => null));

  const canvas = surface.getCanvas();
  const paint = (color: string, smooth: boolean) => {
    const ink = Skia.Paint();
    ink.setColor(Skia.Color(color));
    ink.setAntiAlias(smooth);
    return ink;
  };
  const fonts = new Map<string, SkFont>();
  const fontOf = (piece: Piece): SkFont => {
    const key = `${typefaceKey(piece.face)} ${piece.size}`;
    let font = fonts.get(key);
    if (font === undefined) {
      font = Skia.Font(piece.face ?? undefined, piece.size);
      fonts.set(key, font);
    }
    return font;
  };
  try {
    for (const op of ops) {
      if (op.kind === 'rect') {
        canvas.drawRect(Skia.XYWHRect(op.x * scale, op.y * scale, op.w * scale, op.h * scale), paint(op.color, false));
      } else if (op.kind === 'sprite') {
        const picture = pictures.get(op.id);
        if (picture) {
          const from = Skia.XYWHRect(0, 0, picture.width(), picture.height());
          canvas.drawImageRectOptions(picture, from, Skia.XYWHRect(op.x * scale, op.y * scale, op.w * scale, op.h * scale), FilterMode.Nearest, MipmapMode.None, null);
        }
      } else {
        const pieces: Piece[] = (lines.get(op) ?? []).map((run) => ({ text: run.text, face: typefaces.get(run.family) ?? null, size: Math.round(op.size * scale * run.scale) }));
        const measured = () => pieces.map((piece) => fontOf(piece).getTextWidth(piece.text));
        let widths = measured();
        let whole = widths.reduce((sum, one) => sum + one, 0);
        // A name too long for its place is written smaller, never cut and never over the edge.
        const room = op.maxWidth * scale;
        if (whole > room && whole > 0) {
          for (const piece of pieces) piece.size = Math.max(8, Math.floor((piece.size * room) / whole));
          widths = measured();
          whole = widths.reduce((sum, one) => sum + one, 0);
        }
        // Piece by piece from the left, each beginning where the last one ended; the whole line placed by its alignment.
        const ink = paint(op.color, true);
        let at = op.x * scale - (op.align === 'left' ? 0 : op.align === 'center' ? whole / 2 : whole);
        pieces.forEach((piece, i) => {
          canvas.drawText(piece.text, at, op.y * scale, ink, fontOf(piece));
          at += widths[i];
        });
      }
    }
    surface.flush();
    // A picture of the surface's drawing in memory, not on the GPU, so that it can be shown on screen and written as a file.
    const shot = surface.makeImageSnapshot();
    const kept = shot.makeNonTextureImage();
    if (kept !== null && kept !== shot) shot.dispose();
    return kept ?? shot;
  } finally {
    for (const picture of pictures.values()) picture?.dispose();
    surface.dispose();
  }
}

/** A typeface as a key for the fonts made of it: Skia's own default where there is none. */
const faceKeys = new WeakMap<object, number>();
let nextFace = 1;
function typefaceKey(face: SkTypeface | null): number {
  if (face === null) return 0;
  let key = faceKeys.get(face);
  if (key === undefined) {
    key = nextFace++;
    faceKeys.set(face, key);
  }
  return key;
}

/** The picture, as the sheet shows it: smaller than it is (the web's `max-w-[270px]`), smoothed, in a frame. */
function Preview({ image, alt }: { image: SkImage; alt: string }) {
  const [width, setWidth] = useState<number | null>(null);
  return (
    <View accessible role="img" aria-label={alt} style={{ width: '100%', maxWidth: CARD.w, alignSelf: 'center' }}>
      <Framed kind="frame">
        <View style={{ width: '100%', aspectRatio: CARD.w / CARD.h }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
          {width !== null ? (
            <Canvas style={{ width, height: (width * CARD.h) / CARD.w }}>
              <Picture image={image} x={0} y={0} width={width} height={(width * CARD.h) / CARD.w} fit="fill" sampling={{ filter: FilterMode.Linear, mipmap: MipmapMode.Linear }} />
            </Canvas>
          ) : null}
        </View>
      </Framed>
    </View>
  );
}

/** Said while the picture is drawn: blinking, in the middle of the sheet. */
function Drawing({ children }: { children: string }) {
  const blink = useBlink();
  return (
    <Animated.View style={[{ paddingVertical: 40, alignItems: 'center' }, blink]}>
      <PixelText tone="ink-300" style={{ textAlign: 'center' }}>{children}</PixelText>
    </Animated.View>
  );
}

/**
 * The picture of a life, and the two ways to take it away: the phone's share sheet, handed it as a file, and its photos. The picture is drawn when the
 * sheet opens (`opened`: open from the start, for a scene), and let go of when it closes. Where the phone has no share sheet (or it fails), or the picture cannot be
 * drawn or made a file, the sheet says so in the phone's own words (`phone.shareFailed`): the web's for a picture that cannot be had speak of a browser.
 * Saved to the photos, or not allowed there, or not saved, it says that too, under the buttons.
 */
export function ShareCard({ ops, fileName, alt, load, faces: typefaces, opened = false }: { ops: DrawOp[]; fileName: string; alt: string; load?: SpriteLoader; faces?: FaceLoader; opened?: boolean }) {
  const t = useT('share');
  const common = useT('common');
  const phone = useT('phone');
  const track = useTrack();
  const share = usePictureShare();
  const { locale } = useSettings();
  // The picture travels with a way into the game, in the language it was played in.
  const invite = t('invite', { url: new URL(hrefOf('', { locale }), SITE_URL).href });
  const [open, setOpen] = useState(opened);
  // The picture being handed over or saved: one at a time, Share or Save, as both write the one file of the cache's `share/` folder (game/sharing.ts),
  // which the other would take away under it. A second press of either meanwhile does nothing.
  const busy = useRef(false);
  // What came of the last save, or of a share the phone's sheet failed (`unshared`). The sheet's opening it belongs to: one that ends after the sheet
  // has closed says nothing the next time it opens.
  const [saved, setSaved] = useState<'saved' | 'refused' | 'failed' | 'unshared' | null>(null);
  const opening = useRef(0);
  const [picture, setPicture] = useState<{ image: SkImage; png: Uint8Array } | 'failed' | null>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    let drawn: SkImage | null = null;
    void (async () => {
      // The share sheet, the drawing and the PNG can each be refused by a phone. Whichever it is, say so.
      try {
        if (!(await share.available())) throw new Error('no share sheet');
        const image = await drawCard(ops, { load, faces: typefaces, language: locale });
        if (!image) throw new Error('no surface');
        if (!live) {
          image.dispose();
          return;
        }
        drawn = image;
        const png = image.encodeToBytes(ImageFormat.PNG, 100);
        if (png.length === 0) throw new Error('no picture');
        setPicture({ image, png });
      } catch {
        if (live) setPicture('failed');
      }
    })();
    return () => {
      live = false;
      opening.current += 1;
      drawn?.dispose();
      setPicture(null);
      setSaved(null);
    };
  }, [open, ops, load, typefaces, locale, share]);

  const ready = picture !== null && picture !== 'failed' ? picture : null;

  return (
    <>
      <Button variant="secondary" wide onPress={() => setOpen(true)}>
        {t('open')}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('title')} closeLabel={common('close')}>
        {picture === 'failed' ? (
          <View accessible role="alert" style={{ paddingVertical: 16 }}>
            <ReadText tone="ink-200" style={{ textAlign: 'center' }}>{phone('shareFailed')}</ReadText>
          </View>
        ) : null}
        {picture === null ? <Drawing>{t('drawing')}</Drawing> : null}
        {ready ? (
          <View style={{ gap: 12 }}>
            <Preview image={ready.image} alt={alt} />
            <Button
              variant="primary"
              wide
              onPress={() => {
                if (busy.current) return;
                busy.current = true;
                const mine = opening.current;
                setSaved(null);
                void share
                  .send(ready.png, fileName, alt, invite)
                  .then(
                    (shared) => shared && track({ name: 'share', what: 'card' }),
                    // The phone's sheet would not take it: said in the phone's own words, as a picture that could not be had is.
                    () => opening.current === mine && setSaved('unshared'),
                  )
                  .finally(() => {
                    busy.current = false;
                  });
              }}
            >
              {t('send')}
            </Button>
            {/* The web's link to save the picture, under Share where the browser has a share sheet: a button's look, in the secondary colours. */}
            <Button
              variant="secondary"
              wide
              onPress={() => {
                if (busy.current) return;
                busy.current = true;
                const mine = opening.current;
                const say = (what: 'saved' | 'refused' | 'failed') => {
                  if (opening.current === mine) setSaved(what);
                };
                void share
                  .save(ready.png, fileName)
                  .then(say, () => say('failed'))
                  .finally(() => {
                    busy.current = false;
                  });
              }}
            >
              {t('save')}
            </Button>
            {saved !== null ? (
              <View accessible role={saved === 'saved' ? 'status' : 'alert'}>
                <ReadText size={14} tone="ink-200" style={{ textAlign: 'center' }}>{phone(saved === 'saved' ? 'pictureSaved' : saved === 'refused' ? 'saveRefused' : saved === 'unshared' ? 'shareFailed' : 'saveFailed')}</ReadText>
              </View>
            ) : null}
          </View>
        ) : null}
      </Sheet>
    </>
  );
}
