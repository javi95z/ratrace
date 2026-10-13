// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CARD, PIXEL_X_HEIGHT, shareCard } from '@/game/share';
import { memoryServices } from '@/testing/render';
import { GameProvider } from '@/game/context';
import en from '../../../messages/en.json';
import { drawCard, ShareCard } from './ShareCard';

const ops = shareCard({
  title: 'THE RAT RACE', life: 'Nurse', where: 'Age 62 · Madrid', outcome: 'You never left the rat race.', escaped: false, portrait: 'portrait.nurse.58',
  scoreLabel: 'Score', score: '364', parts: [{ label: 'Wealth', value: '311' }], netWorthLabel: 'Net worth', netWorth: '$1,999,329', history: [1, 2, 3], badgesLabel: 'Badges', badges: ['badge.escaped'],
});

/** A canvas that draws nothing and remembers everything it was asked to draw. */
function fakeCanvas() {
  const calls: Array<[string, ...unknown[]]> = [];
  const ctx = {
    imageSmoothingEnabled: true, font: '', fillStyle: '', textAlign: '', textBaseline: '',
    fillRect: (...a: unknown[]) => calls.push(['rect', ctx.fillStyle, ...a]),
    drawImage: (...a: unknown[]) => calls.push(['image', ...a]),
    fillText: (...a: unknown[]) => calls.push(['text', ctx.font, ...a]),
    measureText: (text: string) => ({ width: text.length * (Number(/(\d+)px/.exec(ctx.font)?.[1] ?? 10) * 0.6) }),
  };
  return { ctx, calls };
}

let fake = fakeCanvas();
beforeEach(() => {
  fake = fakeCanvas();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => fake.ctx as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, done: BlobCallback) {
    done(new Blob(['png'], { type: 'image/png' }));
  });
  URL.createObjectURL = vi.fn(() => 'blob:picture');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const sprite = { tagName: 'IMG' } as unknown as CanvasImageSource;

describe('drawing the share card', () => {
  it('draws on a canvas four times the grid, with smoothing off', async () => {
    const canvas = await drawCard(ops, async () => sprite);
    expect([canvas?.width, canvas?.height]).toEqual([CARD.w * 4, CARD.h * 4]);
    expect(fake.ctx.imageSmoothingEnabled).toBe(false);
  });

  it('draws every rectangle, sprite and line of text, four times as large', async () => {
    await drawCard(ops, async () => sprite);
    const of = (kind: string) => fake.calls.filter(([k]) => k === kind);
    expect(of('rect')[0]).toEqual(['rect', '#141b33', 0, 0, 1080, CARD.h * 4]);
    expect(of('image')).toEqual([
      ['image', sprite, 56, 136, 256, 256],
      ['image', sprite, 52, 1064, 256, 256],
    ]);
    const written = of('text').map((call) => call[2]);
    for (const line of ['THE RAT RACE', 'Nurse', '364', '$1,999,329']) expect(written).toContain(line);
  });

  it('leaves out a sprite that does not arrive, and still draws the rest', async () => {
    await drawCard(ops, async () => null);
    expect(fake.calls.filter(([k]) => k === 'image')).toEqual([]);
    expect(fake.calls.filter(([k]) => k === 'text').length).toBeGreaterThan(5);
  });

  it('writes a name too long for its place smaller, not over the edge', async () => {
    const long = shareCard({ ...({ title: 'T', where: 'w', outcome: 'o', escaped: false, portrait: 'p', scoreLabel: 's', score: '1', parts: [], netWorthLabel: 'n', netWorth: '1', history: [], badgesLabel: 'b', badges: [] }), life: 'A life with a name that is far too long to fit beside a portrait' });
    await drawCard(long, async () => null);
    const name = fake.calls.find(([k, , text]) => k === 'text' && String(text).startsWith('A life')) as [string, string];
    const px = Number(/(\d+)px/.exec(name[1])?.[1]);
    expect(px).toBeLessThan(15 * 4);
    expect(px).toBeGreaterThanOrEqual(8);
  });

  it('draws the pixel typeface as large as the page shows it, and leaves the other alone', async () => {
    // A typeface whose small letters are 0.4 of its size, as a canvas would measure it.
    fake.ctx.measureText = (text: string) => {
      const px = Number(/(\d+)px/.exec(fake.ctx.font)?.[1] ?? 10);
      return { width: text.length * px * 0.3, actualBoundingBoxAscent: px * 0.4 } as never;
    };
    // The names the page gave its two typefaces.
    document.documentElement.style.setProperty('--font-jersey', 'JerseyOfThePage');
    document.documentElement.style.setProperty('--font-chakra', 'ChakraOfThePage');
    await drawCard(ops, async () => sprite);
    document.documentElement.removeAttribute('style');
    const fontOf = (line: string) => (fake.calls.find(([k, , text]) => k === 'text' && text === line) as [string, string])[1];
    // The title is set at 15 on the grid: 60px on the canvas, grown by 0.56 / 0.4.
    expect(fontOf('THE RAT RACE')).toBe('400 84px JerseyOfThePage');
    expect(fontOf('Age 62 · Madrid')).toBe('400 36px ChakraOfThePage');
  });

  it('writes what the two typefaces cannot draw in the ones the page keeps for Cyrillic, and waits for them', async () => {
    fake.ctx.measureText = (text: string) => {
      const px = Number(/(\d+)px/.exec(fake.ctx.font)?.[1] ?? 10);
      return { width: text.length * px * 0.3, actualBoundingBoxAscent: px * 0.4 } as never;
    };
    const waited: Array<[string, string | undefined]> = [];
    Object.defineProperty(document, 'fonts', { configurable: true, value: { load: async (font: string, text?: string) => void waited.push([font, text]) } });
    document.documentElement.style.setProperty('--font-jersey', 'JerseyOfThePage');
    document.documentElement.style.setProperty('--font-chakra', 'ChakraOfThePage');
    document.documentElement.style.setProperty('--font-pixel-cyrillic', 'PixelCyrillicOfThePage');
    document.documentElement.style.setProperty('--font-reading-cyrillic', 'ReadingCyrillicOfThePage');
    try {
      await drawCard(
        [
          { kind: 'text', text: 'Медсестра', x: 10, y: 10, size: 15, font: 'pixel', color: '#fff', align: 'left', maxWidth: 200 },
          { kind: 'text', text: '62 года · Мадрид', x: 10, y: 30, size: 9, font: 'sans', color: '#fff', align: 'left', maxWidth: 200 },
        ],
        async () => sprite,
      );
    } finally {
      document.documentElement.removeAttribute('style');
      delete (document as { fonts?: unknown }).fonts;
    }
    const fontOf = (line: string) => (fake.calls.find(([k, , text]) => k === 'text' && text === line) as [string, string])[1];
    expect(fontOf('Медсестра')).toBe('400 84px JerseyOfThePage, PixelCyrillicOfThePage');
    expect(fontOf('62 года · Мадрид')).toBe('400 36px ChakraOfThePage, ReadingCyrillicOfThePage');
    // A canvas draws with what has arrived. Each typeface is asked for with the very letters it will draw (and the
    // one it is measured by), so that the face holding them is fetched before the first is drawn; and the Cyrillic
    // ones are asked for their Cyrillic only, so that they fetch nothing they will not draw.
    expect(waited).toEqual([
      ['16px JerseyOfThePage', 'xМедсестра'],
      ['16px PixelCyrillicOfThePage', 'хМедсестра'],
      ['16px ChakraOfThePage', '62 года · Мадрид'],
      ['16px ReadingCyrillicOfThePage', 'годаМадрид'],
    ]);
  });

  it('asks for no Cyrillic typeface where there is no Cyrillic to draw', async () => {
    const waited: string[] = [];
    Object.defineProperty(document, 'fonts', { configurable: true, value: { load: async (font: string) => void waited.push(font) } });
    document.documentElement.style.setProperty('--font-jersey', 'JerseyOfThePage');
    document.documentElement.style.setProperty('--font-chakra', 'ChakraOfThePage');
    document.documentElement.style.setProperty('--font-pixel-cyrillic', 'PixelCyrillicOfThePage');
    document.documentElement.style.setProperty('--font-reading-cyrillic', 'ReadingCyrillicOfThePage');
    try {
      await drawCard(ops, async () => sprite);
    } finally {
      document.documentElement.removeAttribute('style');
      delete (document as { fonts?: unknown }).fonts;
    }
    expect(waited).toEqual(['16px JerseyOfThePage', '16px ChakraOfThePage']);
  });

  it('draws Cyrillic as large as the page shows it, which is not as large as the Latin beside it is drawn', async () => {
    // The page brings each typeface to the same height of small letters. Here the Latin pixel face stands 0.4 of its
    // size tall, and the Cyrillic one 0.5: left at one size, the Russian would be a quarter taller than the figures.
    fake.ctx.measureText = (text: string) => {
      const px = Number(/(\d+)px/.exec(fake.ctx.font)?.[1] ?? 10);
      return { width: text.length * px * 0.5, actualBoundingBoxAscent: px * (/[\u0400-\u04ff]/.test(text) ? 0.5 : 0.4) } as never;
    };
    document.documentElement.style.setProperty('--font-jersey', 'J');
    document.documentElement.style.setProperty('--font-chakra', 'C');
    document.documentElement.style.setProperty('--font-pixel-cyrillic', 'JC');
    document.documentElement.style.setProperty('--font-reading-cyrillic', 'CC');
    try {
      await drawCard(
        [
          { kind: 'text', text: 'ОЧКИ', x: 10, y: 10, size: 15, font: 'pixel', color: '#fff', align: 'left', maxWidth: 400 },
          { kind: 'text', text: 'Значки · 5', x: 10, y: 30, size: 15, font: 'pixel', color: '#fff', align: 'left', maxWidth: 400 },
          { kind: 'text', text: 'Раунд 5', x: 100, y: 50, size: 15, font: 'pixel', color: '#fff', align: 'right', maxWidth: 400 },
          { kind: 'text', text: '62 года', x: 10, y: 70, size: 9, font: 'sans', color: '#fff', align: 'left', maxWidth: 400 },
        ],
        async () => sprite,
      );
    } finally {
      document.documentElement.removeAttribute('style');
    }
    const texts = fake.calls.filter(([k]) => k === 'text').map(([, font, text, x, y]) => [font, text, x, y]);
    expect(texts).toEqual([
      // 15 on the grid is 60px on the canvas: grown by 0.56 / 0.5 for Cyrillic, by 0.56 / 0.4 for Latin.
      ['400 67px J, JC', 'ОЧКИ', 40, 40],
      // One line, two sizes, each piece beginning where the last one ended.
      ['400 67px J, JC', 'Значки', 40, 120],
      ['400 84px J, JC', ' · 5', 40 + 6 * 67 * 0.5, 120],
      // From the right: the whole line is measured first.
      ['400 67px J, JC', 'Раунд', 400 - (5 * 67 * 0.5 + 2 * 84 * 0.5), 200],
      ['400 84px J, JC', ' 5', 400 - 2 * 84 * 0.5, 200],
      // The typeface for sentences is not scaled on the page, and is not here.
      ['400 36px C, CC', '62 года', 40, 280],
    ]);
  });

  it('agrees with the page on how large that is', () => {
    const css = readFileSync(join(__dirname, '../../app/globals.css'), 'utf8');
    expect(css).toContain(`font-size-adjust: ${PIXEL_X_HEIGHT};`);
  });

  it('gives up without a fuss where there is no canvas to draw on', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
    expect(await drawCard(ops, async () => sprite)).toBeNull();
  });
});

describe('the share sheet', () => {
  const show = () =>
    render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
        <GameProvider services={memoryServices()}>
          <ShareCard ops={ops} fileName="rat-race-nurse-364.png" alt="Nurse: score 364" load={async () => sprite} />
        </GameProvider>
      </NextIntlClientProvider>,
    );

  it('draws the picture when it is opened, and offers it as a file to save', async () => {
    const user = userEvent.setup();
    show();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(fake.calls).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Share this life' }));
    const sheet = screen.getByRole('dialog', { name: 'A picture of this life' });
    const picture = await within(sheet).findByRole('img', { name: 'Nurse: score 364' });
    expect(picture.getAttribute('src')).toBe('blob:picture');
    const save = within(sheet).getByRole('link', { name: 'Save the picture' });
    expect(save.getAttribute('download')).toBe('rat-race-nurse-364.png');
    expect(save.getAttribute('href')).toBe('blob:picture');
    // No share sheet on this device: saving is the one thing to do.
    expect(within(sheet).queryByRole('button', { name: 'Share' })).toBeNull();
  });

  it('offers the share sheet of the device where there is one, with the picture as a file', async () => {
    const share = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { canShare: () => true, share });
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole('button', { name: 'Share this life' }));
    await user.click(await screen.findByRole('button', { name: 'Share' }));
    expect(share).toHaveBeenCalledTimes(1);
    const sent = (share.mock.calls[0] as unknown as [{ files: File[]; title: string }])[0];
    expect(sent.files[0].name).toBe('rat-race-nurse-364.png');
    expect(sent.files[0].type).toBe('image/png');
    Object.assign(navigator, { canShare: undefined, share: undefined });
  });

  it('says so when the browser will not hand the picture over, instead of drawing for ever', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(() => {
      throw new DOMException('The canvas has been tainted', 'SecurityError');
    });
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole('button', { name: 'Share this life' }));
    expect((await screen.findByRole('alert')).textContent).toBe('This browser could not draw the picture.');
    expect(screen.queryByText('Drawing…')).toBeNull();
  });

  it('says so when the picture cannot be drawn, and lets go of it when closed', async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole('button', { name: 'Share this life' }));
    await screen.findByRole('img', { name: 'Nurse: score 364' });
    await user.keyboard('{Escape}');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:picture');

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
    await user.click(screen.getByRole('button', { name: 'Share this life' }));
    expect((await screen.findByRole('alert')).textContent).toBe('This browser could not draw the picture.');
  });
});
