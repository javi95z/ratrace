import { CARD } from '@ratrace/core/game/share';
import type { DrawOp } from '@ratrace/core/game/share';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Framed } from '../../ui/Frame';
import { runsOf, type Run } from '../../ui/fonts';
import { GOLD } from '../../ui/frames';
import { Button } from '../../ui/kit';
import { Sheet } from '../../ui/overlay';
import { readSprite } from '../../ui/spriteImages.web';
import { PixelText, ReadText } from '../../ui/text';
import { COLORS, TOUCH } from '../../ui/theme';
import { useSettings, useT, useTrack } from '../context';
import { hrefOf } from '../pages';
import { SITE_URL } from '../site';
import { canShareFile, shareFile } from '../sharing.web';

/*
 * The web export's twin of `ShareCard.tsx` (Metro picks it for the web), and the Next web's ShareCard.tsx in the app's own parts. The card is drawn as
 * the phone draws it (core's list of things to draw, four times the grid, its type cut into the pieces each typeface draws, `runsOf`), on a 2D canvas,
 * not Skia: the sprites are images the browser fetches, and the typefaces are the page's fonts (the kit's families), waited for before anything is drawn.
 * The picture is a PNG file in memory: handed to the browser's share sheet where it takes files, with the line inviting into the game, and always a link
 * to save it (an object address, let go of when the sheet closes). Nothing is drawn until the player asks for the picture.
 */

/** Something a canvas can draw. In the browser, an image; a test hands in its own. */
export type Drawable = CanvasImageSource;

/** Fetches a sprite as something a canvas can draw, or null if it does not exist or does not arrive. */
export type SpriteLoader = (id: string) => Promise<Drawable | null>;

/** Waits until the canvas may use a font of the page (a family of the kit's, and the letters it will draw with it). In the browser, its font loading; a test hands in its own. */
export type FaceLoader = (family: string, text: string) => Promise<unknown>;

/** The sprite as the kit reads it (its address, once the file is known), drawn from an image of its own. */
const browserLoader: SpriteLoader = async (id) => {
  const sprite = await readSprite(id);
  if (!sprite) return null;
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = sprite.uri;
  });
};

/** How a family is named to a canvas: the kit's families are quoted names of the page's fonts, the system's font is the browser's own. */
const cssFamily = (family: string): string => (family === 'System' ? 'system-ui, sans-serif' : `"${family}", sans-serif`);

/** The page's fonts, asked for with the very letters they will draw, so that the face holding them has arrived: a page of English never fetched the Cyrillic ones. */
const browserFaces: FaceLoader = (family, text) => document.fonts?.load(`16px "${family}"`, text) ?? Promise.resolve();

interface Drawing {
  load?: SpriteLoader;
  faces?: FaceLoader;
  /** The language of the words, which says which typeface draws each letter, as on a page in it (`runsOf`). */
  language?: string;
}

/** A piece of a line of text: what one typeface draws, at the size it is drawn. */
interface Piece {
  text: string;
  family: string;
  size: number;
}

const toBlob = (canvas: HTMLCanvasElement): Promise<Blob | null> => new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));

/**
 * Draws the list on a canvas four times the size of the grid, its sprites with no smoothing, so every art pixel is a square of sixteen. A line of text is
 * cut into the pieces each typeface draws, as the page's lines are (`runsOf`): the pixel typeface and the one that draws its Cyrillic each brought to the
 * page's height of small letters (`PIXEL_X_HEIGHT`), the reading ones as they are. Returns the PNG, or null where the browser gives no canvas to draw on or
 * makes no picture of it.
 */
export async function drawCard(ops: DrawOp[], { load = browserLoader, faces = browserFaces, language = 'en' }: Drawing = {}): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  const scale = CARD.scale;
  canvas.width = CARD.w * scale;
  canvas.height = CARD.h * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;

  // Each line as the runs of the typefaces that draw it, and each typeface waited for once, before anything is drawn: only those the card draws with.
  const lines = new Map<DrawOp, Run[]>();
  for (const op of ops) if (op.kind === 'text') lines.set(op, runsOf(op.text, op.font === 'pixel' ? 'pixel' : 'read', 400, language));
  const written = new Map<string, string>();
  for (const runs of lines.values()) for (const run of runs) written.set(run.family, (written.get(run.family) ?? '') + run.text);
  await Promise.all([...written].map(([family, text]) => Promise.resolve(faces(family, text)).catch(() => undefined)));
  const pictures = new Map<string, Drawable | null>();
  for (const op of ops) if (op.kind === 'sprite' && !pictures.has(op.id)) pictures.set(op.id, await load(op.id).catch(() => null));

  const font = (piece: Piece) => `${piece.size}px ${cssFamily(piece.family)}`;
  for (const op of ops) {
    if (op.kind === 'rect') {
      ctx.fillStyle = op.color;
      ctx.fillRect(op.x * scale, op.y * scale, op.w * scale, op.h * scale);
    } else if (op.kind === 'sprite') {
      const picture = pictures.get(op.id);
      if (picture) ctx.drawImage(picture, op.x * scale, op.y * scale, op.w * scale, op.h * scale);
    } else {
      const pieces: Piece[] = (lines.get(op) ?? []).map((run) => ({ text: run.text, family: run.family, size: Math.round(op.size * scale * run.scale) }));
      const measured = () =>
        pieces.map((piece) => {
          ctx.font = font(piece);
          return ctx.measureText(piece.text).width;
        });
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
      ctx.fillStyle = op.color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      let at = op.x * scale - (op.align === 'left' ? 0 : op.align === 'center' ? whole / 2 : whole);
      pieces.forEach((piece, i) => {
        ctx.font = font(piece);
        ctx.fillText(piece.text, at, op.y * scale);
        at += widths[i];
      });
    }
  }
  return toBlob(canvas);
}

/** The picture, as the sheet shows it: smaller than it is (the web's `max-w-[270px]`), smoothed by the browser, in a frame. */
function Preview({ url, alt }: { url: string; alt: string }) {
  return (
    <View style={{ width: '100%', maxWidth: CARD.w, alignSelf: 'center' }}>
      <Framed kind="frame">
        {/* The picture is 1080px wide and shown smaller: a preview, not pixel art on the page. */}
        <img src={url} alt={alt} width={CARD.w * CARD.scale} height={CARD.h * CARD.scale} style={{ display: 'block', width: '100%', height: 'auto' }} />
      </Framed>
    </View>
  );
}

/** The link that saves the picture as a file, in a button's look: gold when it is the only way out, in the secondary colours under Share. */
function SaveLink({ url, fileName, children, quiet }: { url: string; fileName: string; children: string; quiet: boolean }) {
  return (
    <a href={url} download={fileName} style={{ display: 'block', width: '100%', textDecoration: 'none' }}>
      <Framed
        kind="raised"
        tone={quiet ? {} : GOLD}
        style={{ backgroundColor: COLORS[quiet ? 'night-600' : 'gold-500'], minHeight: TOUCH, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
      >
        <PixelText size={17} tone={quiet ? 'cream' : 'ink-900'} style={{ textAlign: 'center' }}>{children}</PixelText>
      </Framed>
    </a>
  );
}

/**
 * The picture of a life, and the two ways to take it away: the share sheet of the browser where it takes the file, and a link to save it everywhere. The
 * picture is drawn when the sheet opens (`opened`: open from the start, for a scene), and its address let go of when it closes.
 */
export function ShareCard({ ops, fileName, alt, load, faces, opened = false }: { ops: DrawOp[]; fileName: string; alt: string; load?: SpriteLoader; faces?: FaceLoader; opened?: boolean }) {
  const t = useT('share');
  const common = useT('common');
  const track = useTrack();
  const { locale } = useSettings();
  // The picture travels with a way into the game, in the language it was played in.
  const invite = t('invite', { url: new URL(hrefOf('', { locale }), SITE_URL).href });
  const [open, setOpen] = useState(opened);
  const [picture, setPicture] = useState<{ url: string; file: File } | 'failed' | null>(null);

  useEffect(() => {
    if (!open) return;
    let url: string | null = null;
    let live = true;
    void (async () => {
      // Drawing, handing the picture over and wrapping it as a file can each be refused by a browser. Whichever it is, say so.
      try {
        const blob = await drawCard(ops, { load, faces, language: locale });
        if (!live) return;
        if (!blob) throw new Error('no picture');
        const file = new File([blob], fileName, { type: 'image/png' });
        url = URL.createObjectURL(blob);
        setPicture({ url, file });
      } catch {
        if (live) setPicture('failed');
      }
    })();
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
      setPicture(null);
    };
  }, [open, ops, fileName, load, faces, locale]);

  const ready = picture !== null && picture !== 'failed' ? picture : null;
  const canSend = ready !== null && canShareFile(ready.file);

  return (
    <>
      <Button variant="secondary" wide onPress={() => setOpen(true)}>
        {t('open')}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('title')} closeLabel={common('close')}>
        {picture === 'failed' ? (
          <View accessible role="alert" style={{ paddingVertical: 16 }}>
            <ReadText tone="ink-200" style={{ textAlign: 'center' }}>{t('failed')}</ReadText>
          </View>
        ) : null}
        {picture === null ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <PixelText tone="ink-300" style={{ textAlign: 'center' }}>{t('drawing')}</PixelText>
          </View>
        ) : null}
        {ready ? (
          <View style={{ gap: 12 }}>
            <Preview url={ready.url} alt={alt} />
            {canSend ? (
              <Button variant="primary" wide onPress={() => void shareFile(ready.file, alt, invite).then((shared) => shared && track({ name: 'share', what: 'card' }), () => undefined)}>
                {t('send')}
              </Button>
            ) : null}
            <SaveLink url={ready.url} fileName={fileName} quiet={canSend}>{t('save')}</SaveLink>
          </View>
        ) : null}
      </Sheet>
    </>
  );
}
