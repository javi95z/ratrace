'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/game/context';
import { CARD, PIXEL_X_HEIGHT } from '@/game/share';
import type { DrawOp } from '@/game/share';
import { Button } from '@/ui/kit';
import { Sheet } from '@/ui/overlay';
import { spriteOf } from '@/ui/Sprite';

/** Something a canvas can draw. In the browser, an image; a test hands in its own. */
export type Drawable = CanvasImageSource;

/** Fetches a sprite as something a canvas can draw, or null if it does not exist or does not arrive. */
export type SpriteLoader = (id: string) => Promise<Drawable | null>;

const browserLoader: SpriteLoader = (id) => {
  const sprite = spriteOf(id);
  if (!sprite) return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = `/sprites/${sprite.src}`;
  });
};

/** A typeface of the game by the name the page gave it, and the one the page keeps for the Cyrillic it does not draw, if it keeps one. */
interface Family {
  own: string;
  cyrillic: string;
}

function families(): Record<'pixel' | 'sans', Family> {
  const style = getComputedStyle(document.documentElement);
  const named = (name: string) => style.getPropertyValue(name).trim();
  return {
    pixel: { own: named('--font-jersey') || 'monospace', cyrillic: named('--font-pixel-cyrillic') },
    sans: { own: named('--font-chakra') || 'sans-serif', cyrillic: named('--font-reading-cyrillic') },
  };
}

const CYRILLIC = /[\u0400-\u052f]+/g;
const cyrillicOf = (text: string) => (text.match(CYRILLIC) ?? []).join('');
/** A line as the pieces each typeface draws: the Cyrillic, and everything else. */
const piecesOf = (text: string) => text.split(/([\u0400-\u052f]+)/).filter((piece) => piece !== '').map((piece) => ({ text: piece, cyrillic: /[\u0400-\u052f]/.test(piece) }));

/**
 * Draws the list on a canvas four times the size of the grid, with no smoothing, so every art
 * pixel is a square of sixteen. Returns null where the browser gives no canvas to draw on.
 */
export async function drawCard(ops: DrawOp[], load: SpriteLoader = browserLoader): Promise<HTMLCanvasElement | null> {
  const canvas = document.createElement('canvas');
  const scale = CARD.scale;
  canvas.width = CARD.w * scale;
  canvas.height = CARD.h * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;

  const fonts = families();
  const weight = { pixel: '400', sans: '400' };
  const listed = (font: 'pixel' | 'sans') => [fonts[font].own, fonts[font].cyrillic].filter(Boolean).join(', ');
  // The typefaces are on the page already; this only waits until the canvas may use them. Each is asked for
  // with the very letters it will draw (and the one it is measured by), so that the face holding them has
  // arrived: a page of English never fetched the Cyrillic ones, and still does not.
  const written = (font: 'pixel' | 'sans') => ops.map((op) => (op.kind === 'text' && op.font === font ? op.text : '')).join('');
  const russian = { pixel: fonts.pixel.cyrillic ? cyrillicOf(written('pixel')) : '', sans: fonts.sans.cyrillic ? cyrillicOf(written('sans')) : '' };
  await Promise.all(
    [
      document.fonts?.load(`16px ${fonts.pixel.own}`, `x${written('pixel')}`),
      russian.pixel ? document.fonts?.load(`16px ${fonts.pixel.cyrillic}`, `х${russian.pixel}`) : undefined,
      document.fonts?.load(`16px ${fonts.sans.own}`, written('sans')),
      russian.sans ? document.fonts?.load(`16px ${fonts.sans.cyrillic}`, russian.sans) : undefined,
    ].map((loading) => loading?.catch(() => undefined)),
  );
  // A pixel typeface is drawn small inside its own size. The page scales each one until its small letters stand
  // as tall as `PIXEL_X_HEIGHT` of the size asked for, and so does the card: the Latin one by its "x", and the
  // Cyrillic one, whose letters stand taller in their size, by its own «х».
  const growBy = (family: string, letter: string, otherwise: number) => {
    ctx.font = `${weight.pixel} 100px ${family}`;
    const small = ctx.measureText(letter).actualBoundingBoxAscent;
    return small > 0 ? (PIXEL_X_HEIGHT * 100) / small : otherwise;
  };
  const latin = growBy(fonts.pixel.own, 'x', 1);
  const grow = { pixel: latin, cyrillic: russian.pixel ? growBy(fonts.pixel.cyrillic, 'х', latin) : latin, sans: 1 };
  const pictures = new Map<string, Drawable | null>();
  for (const op of ops) if (op.kind === 'sprite' && !pictures.has(op.id)) pictures.set(op.id, await load(op.id));

  for (const op of ops) {
    if (op.kind === 'rect') {
      ctx.fillStyle = op.color;
      ctx.fillRect(op.x * scale, op.y * scale, op.w * scale, op.h * scale);
    } else if (op.kind === 'sprite') {
      const picture = pictures.get(op.id);
      if (picture) ctx.drawImage(picture, op.x * scale, op.y * scale, op.w * scale, op.h * scale);
    } else {
      const font = (px: number) => `${weight[op.font]} ${px}px ${listed(op.font)}`;
      // Each typeface at its own size: in pixel text the Cyrillic and the rest are separate pieces of the line.
      const pieces = (op.font === 'pixel' && grow.cyrillic !== grow.pixel ? piecesOf(op.text) : [{ text: op.text, cyrillic: false }]).map((piece) => ({
        ...piece,
        size: Math.round(op.size * scale * (op.font === 'sans' ? grow.sans : piece.cyrillic ? grow.cyrillic : grow.pixel)),
      }));
      const measured = () =>
        pieces.map((piece) => {
          ctx.font = font(piece.size);
          return ctx.measureText(piece.text).width;
        });
      let widths = measured();
      let width = widths.reduce((sum, one) => sum + one, 0);
      // A name too long for its place is written smaller, never cut and never over the edge.
      const room = op.maxWidth * scale;
      if (width > room && width > 0) {
        for (const piece of pieces) piece.size = Math.max(8, Math.floor((piece.size * room) / width));
        widths = measured();
        width = widths.reduce((sum, one) => sum + one, 0);
      }
      ctx.fillStyle = op.color;
      ctx.textBaseline = 'alphabetic';
      if (pieces.length === 1) {
        ctx.font = font(pieces[0].size);
        ctx.textAlign = op.align;
        ctx.fillText(op.text, op.x * scale, op.y * scale);
      } else {
        // Piece by piece from the left, each beginning where the last one ended.
        ctx.textAlign = 'left';
        let at = op.x * scale - (op.align === 'left' ? 0 : op.align === 'center' ? width / 2 : width);
        pieces.forEach((piece, i) => {
          ctx.font = font(piece.size);
          ctx.fillText(piece.text, at, op.y * scale);
          at += widths[i];
        });
      }
    }
  }
  return canvas;
}

const toBlob = (canvas: HTMLCanvasElement): Promise<Blob | null> => new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));

/**
 * The picture of a life, and the two ways to take it away: the share sheet of the device where
 * there is one, and a file to save everywhere. The picture is drawn when the sheet opens.
 */
export function ShareCard({ ops, fileName, alt, load }: { ops: DrawOp[]; fileName: string; alt: string; load?: SpriteLoader }) {
  const t = useT('share');
  const common = useT('common');
  const [open, setOpen] = useState(false);
  const [picture, setPicture] = useState<{ url: string; file: File } | 'failed' | null>(null);

  useEffect(() => {
    if (!open) return;
    let url: string | null = null;
    let live = true;
    void (async () => {
      // Drawing, handing the picture over and wrapping it as a file can each be refused by a browser. Whichever it is, say so.
      try {
        const canvas = await drawCard(ops, load);
        const blob = canvas ? await toBlob(canvas) : null;
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
  }, [open, ops, fileName, load]);

  const ready = picture !== null && picture !== 'failed' ? picture : null;
  const canSend = ready !== null && typeof navigator.canShare === 'function' && navigator.canShare({ files: [ready.file] });

  return (
    <>
      <Button wide onClick={() => setOpen(true)}>
        {t('open')}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('title')} closeLabel={common('close')}>
        {picture === 'failed' ? <p role="alert" className="py-4 text-center text-ink-200">{t('failed')}</p> : null}
        {picture === null ? <p className="pixel animate-blink py-10 text-center text-ink-300">{t('drawing')}</p> : null}
        {ready ? (
          <div className="flex flex-col gap-3">
            {/* The picture is 1080px wide and shown smaller: a preview, not pixel art on the page. */}
            <img src={ready.url} alt={alt} width={CARD.w * CARD.scale} height={CARD.h * CARD.scale} className="frame mx-auto h-auto w-full max-w-[270px]" />
            {canSend ? (
              <Button variant="primary" wide onClick={() => void navigator.share({ files: [ready.file], title: alt }).catch(() => undefined)}>
                {t('send')}
              </Button>
            ) : null}
            <a
              href={ready.url}
              download={fileName}
              className={`pixel frame-raised flex min-h-11 items-center justify-center px-4 py-2 text-center text-[17px] ${canSend ? 'bg-night-600 text-cream' : 'frame-gold bg-gold-500 text-ink-900'}`}
            >
              {t('save')}
            </a>
          </div>
        ) : null}
      </Sheet>
    </>
  );
}
