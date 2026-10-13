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

/** The two typefaces of the game, by the names the page gave them. */
function families(): Record<'pixel' | 'sans', string> {
  const style = getComputedStyle(document.documentElement);
  const named = (name: string, otherwise: string) => style.getPropertyValue(name).trim() || otherwise;
  return { pixel: named('--font-jersey', 'monospace'), sans: named('--font-inter', 'sans-serif') };
}

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
  // The typefaces are on the page already; this only waits until the canvas may use them.
  await Promise.all(Object.values(fonts).map((family) => document.fonts?.load(`16px ${family}`).catch(() => undefined)));
  // The pixel typeface is drawn small inside its own size. The page scales it until its small letters
  // stand as tall as `PIXEL_X_HEIGHT` of the size asked for, and so does the card.
  ctx.font = `${weight.pixel} 100px ${fonts.pixel}`;
  const small = ctx.measureText('x').actualBoundingBoxAscent;
  const grow = { pixel: small > 0 ? (PIXEL_X_HEIGHT * 100) / small : 1, sans: 1 };
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
      let size = Math.round(op.size * scale * grow[op.font]);
      const font = (px: number) => `${weight[op.font]} ${px}px ${fonts[op.font]}`;
      ctx.font = font(size);
      // A name too long for its place is written smaller, never cut and never over the edge.
      const width = ctx.measureText(op.text).width;
      const room = op.maxWidth * scale;
      if (width > room && width > 0) size = Math.max(8, Math.floor((size * room) / width));
      ctx.font = font(size);
      ctx.fillStyle = op.color;
      ctx.textAlign = op.align;
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(op.text, op.x * scale, op.y * scale);
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
