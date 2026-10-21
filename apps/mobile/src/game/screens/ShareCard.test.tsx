// @vitest-environment jsdom
import { CARD, PIXEL_X_HEIGHT, shareCard } from '@ratrace/core/game/share';
import type { DrawOp } from '@ratrace/core/game/share';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { files, memoryServices, renderGame, shareSheet } from '../../testing/render';
import { JERSEY_X_HEIGHT, OSWALD_X_HEIGHT, pixelSize } from '../../ui/fonts';
import { painted, type FaceDouble, type Painted } from '../../ui/testing/skia';
import { drawCard, ShareCard } from './ShareCard';

afterEach(cleanup);

const ops = shareCard({
  title: 'THE RAT RACE', life: 'Nurse', where: 'Age 62 · Madrid', outcome: 'You never left the rat race.', escaped: false, portrait: 'portrait.nurse.58',
  scoreLabel: 'Score', score: '364', parts: [{ label: 'Wealth', value: '311' }], netWorthLabel: 'Net worth', netWorth: '$1,999,329', history: [1, 2, 3], badgesLabel: 'Badges', badges: ['badge.escaped'],
});

/** A sprite's picture as the double of Skia has one: its size, and a way to let go of it. */
const picture = () => ({ kind: 'sprite', width: () => 64, height: () => 64, dispose: vi.fn() });
/** The typefaces, as the double knows them: each by its family, every one of them there. */
const asked: string[] = [];
const faces = async (family: string) => {
  asked.push(family);
  return { family } satisfies FaceDouble as never;
};
afterEach(() => {
  asked.length = 0;
});

const of = (kind: string) => painted.calls.filter(([k]) => k === kind);
/** The font a line of text was drawn in, as the double writes it (`82px Jersey15_400Regular`). */
const fontOf = (line: string) => (painted.calls.find(([k, , text]) => k === 'text' && text === line) as Extract<Painted, ['text', ...unknown[]]>)[1];
/** The canvas's size of a text set at `grid` points on the card's grid in the pixel typeface: the page's size (`pixelSize`), four times. */
const pixel = (grid: number, xHeight = JERSEY_X_HEIGHT) => Math.round((grid * CARD.scale * PIXEL_X_HEIGHT) / xHeight);

describe('drawing the share card', () => {
  it('draws on a surface four times the grid, its pictures with no smoothing', async () => {
    const sprite = picture();
    const image = await drawCard(ops, { load: async () => sprite as never, faces });
    expect(painted.asked).toEqual([[CARD.w * 4, CARD.h * 4]]);
    expect([image?.width(), image?.height()]).toEqual([CARD.w * 4, CARD.h * 4]);
    // Nearest neighbour, no mipmaps: every art pixel a square of sixteen.
    for (const call of of('image')) expect(call.slice(6)).toEqual([0, 0]);
    // The pictures read for it are let go once it is drawn.
    expect(sprite.dispose).toHaveBeenCalled();
  });

  it('draws every rectangle, sprite and line of text, four times as large', async () => {
    const sprite = picture();
    await drawCard(ops, { load: async () => sprite as never, faces });
    expect(of('rect')[0]).toEqual(['rect', '#141b33', 0, 0, 1080, CARD.h * 4]);
    expect(of('rect')).toHaveLength(ops.filter((op) => op.kind === 'rect').length);
    expect(of('image').map((call) => call.slice(0, 6))).toEqual([
      ['image', sprite, 56, 136, 256, 256],
      ['image', sprite, 52, 1064, 256, 256],
    ]);
    const written = of('text').map((call) => call[2]);
    for (const line of ['THE RAT RACE', 'Nurse', '364', '$1,999,329', 'Age 62 · Madrid']) expect(written).toContain(line);
    // Each in its colour, on its baseline.
    expect(painted.calls.find(([k, , text]) => k === 'text' && text === 'THE RAT RACE')?.slice(4)).toEqual([24 * 4, '#f2c14e']);
  });

  it('leaves out a sprite that does not arrive, and still draws the rest', async () => {
    await drawCard(ops, { load: async () => null, faces });
    expect(of('image')).toEqual([]);
    expect(of('text').length).toBeGreaterThan(5);
  });

  it('leaves out a sprite whose read is refused, and a typeface that cannot be had is drawn in Skia\'s own', async () => {
    await drawCard(ops, { load: () => Promise.reject(new Error('gone')), faces: () => Promise.reject(new Error('gone')) });
    expect(of('image')).toEqual([]);
    expect(fontOf('THE RAT RACE')).toBe(`${pixel(15)}px default`);
  });

  it('writes a name too long for its place smaller, not over the edge', async () => {
    const long = shareCard({ title: 'T', where: 'w', outcome: 'o', escaped: false, portrait: 'p', scoreLabel: 's', score: '1', parts: [], netWorthLabel: 'n', netWorth: '1', history: [], badgesLabel: 'b', badges: [], life: 'A life with a name that is far too long to fit beside a portrait' });
    await drawCard(long, { load: async () => null, faces });
    const name = painted.calls.find(([k, , text]) => k === 'text' && String(text).startsWith('A life')) as Extract<Painted, ['text', ...unknown[]]>;
    const px = Number(/(\d+)px/.exec(name[1])?.[1]);
    expect(px).toBeLessThan(pixel(15));
    expect(px).toBeGreaterThanOrEqual(8);
    const room = (long.find((op) => op.kind === 'text' && op.text.startsWith('A life')) as Extract<DrawOp, { kind: 'text' }>).maxWidth * 4;
    expect(painted.measure(name[2], { family: 'Jersey15_400Regular', size: px })).toBeLessThanOrEqual(room);
  });

  it('draws the pixel typeface as large as the page shows it (the kit\'s size for a pixel text), and leaves the reading one alone', async () => {
    await drawCard(ops, { load: async () => null, faces });
    // The title is set at 15 on the grid: 60 on the canvas, brought to the pixel stack's small letters as the kit brings a PixelText of 60.
    expect(fontOf('THE RAT RACE')).toBe(`${Math.round(pixelSize(60))}px Jersey15_400Regular`);
    expect(fontOf('THE RAT RACE')).toBe(`${pixel(15)}px Jersey15_400Regular`);
    expect(fontOf('Age 62 · Madrid')).toBe('36px ChakraPetch_400Regular');
  });

  it('asks only for the typefaces it will draw with: no Cyrillic one where there is no Cyrillic', async () => {
    await drawCard(ops, { load: async () => null, faces });
    expect(asked).toEqual(['Jersey15_400Regular', 'ChakraPetch_400Regular']);
  });

  it('writes the Cyrillic in the typefaces the kit keeps for it, each piece of a line where the last ended', async () => {
    await drawCard(
      [
        { kind: 'text', text: 'Медсестра', x: 10, y: 10, size: 15, font: 'pixel', color: '#fff', align: 'left', maxWidth: 200 },
        { kind: 'text', text: '62 года · Мадрид', x: 10, y: 30, size: 9, font: 'sans', color: '#fff', align: 'left', maxWidth: 200 },
      ],
      { load: async () => null, faces, language: 'ru' },
    );
    expect(fontOf('Медсестра')).toBe(`${pixel(15, OSWALD_X_HEIGHT)}px Oswald_500Medium`);
    // The reading typeface is not scaled, in either face: the figures and signs in Chakra Petch, the Russian in Exo 2.
    expect(of('text').slice(1).map(([, font, text, x]) => [font, text, x])).toEqual([
      ['36px ChakraPetch_400Regular', '62 ', 40],
      ['36px Exo2_400Regular', 'года', 40 + 3 * 36 * 0.6],
      ['36px ChakraPetch_400Regular', ' · ', 40 + 7 * 36 * 0.6],
      ['36px Exo2_400Regular', 'Мадрид', 40 + 10 * 36 * 0.6],
    ]);
    expect(asked).toEqual(['Oswald_500Medium', 'ChakraPetch_400Regular', 'Exo2_400Regular']);
  });

  it('draws Cyrillic as large as the page shows it, which is not as large as the Latin beside it is drawn', async () => {
    // The page brings each typeface to the same height of small letters: Oswald's stand taller in their size than Jersey's, so it is drawn smaller.
    painted.measure = (text, font) => text.length * font.size * 0.5;
    const ru = pixel(15, OSWALD_X_HEIGHT);
    const latin = pixel(15);
    expect(ru).toBeLessThan(latin);
    await drawCard(
      [
        { kind: 'text', text: 'ОЧКИ', x: 10, y: 10, size: 15, font: 'pixel', color: '#fff', align: 'left', maxWidth: 400 },
        { kind: 'text', text: 'Значки · 5', x: 10, y: 30, size: 15, font: 'pixel', color: '#fff', align: 'left', maxWidth: 400 },
        { kind: 'text', text: 'Раунд 5', x: 100, y: 50, size: 15, font: 'pixel', color: '#fff', align: 'right', maxWidth: 400 },
        { kind: 'text', text: 'ОЧКИ', x: 100, y: 70, size: 15, font: 'pixel', color: '#fff', align: 'center', maxWidth: 400 },
      ],
      { load: async () => null, faces, language: 'ru' },
    );
    expect(of('text').map(([, font, text, x, y]) => [font, text, x, y])).toEqual([
      [`${ru}px Oswald_500Medium`, 'ОЧКИ', 40, 40],
      // One line, two sizes, each piece beginning where the last one ended.
      [`${ru}px Oswald_500Medium`, 'Значки', 40, 120],
      [`${latin}px Jersey15_400Regular`, ' · 5', 40 + 6 * ru * 0.5, 120],
      // From the right: the whole line is measured first.
      [`${ru}px Oswald_500Medium`, 'Раунд', 400 - (5 * ru * 0.5 + 2 * latin * 0.5), 200],
      [`${latin}px Jersey15_400Regular`, ' 5', 400 - 2 * latin * 0.5, 200],
      // From the middle: half of it either side.
      [`${ru}px Oswald_500Medium`, 'ОЧКИ', 400 - (4 * ru * 0.5) / 2, 280],
    ]);
  });

  it('gives up without a fuss where there is no surface to draw on', async () => {
    painted.surfaces = false;
    expect(await drawCard(ops, { load: async () => picture() as never, faces })).toBeNull();
    expect(painted.calls).toEqual([]);
  });
});

describe('the share sheet', () => {
  const show = () => renderGame(<ShareCard ops={ops} fileName="rat-race-nurse-364.png" alt="Nurse: score 364" load={async () => picture() as never} faces={faces} />, memoryServices());
  const open = () => fireEvent.click(screen.getByRole('button', { name: 'Share this life' }));

  it('draws the picture only once it is opened, and hands it to the phone\'s share sheet as a file', async () => {
    show();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'A picture of this life' })).toBeNull();
    // Nothing is drawn until the player asks for the picture.
    expect(painted.asked).toEqual([]);
    open();
    const sheet = screen.getByRole('heading', { name: 'A picture of this life' }).closest('[aria-modal="true"]') as HTMLElement;
    expect(await within(sheet).findByRole('img', { name: 'Nurse: score 364' })).toBeTruthy();
    expect(painted.asked).toEqual([[CARD.w * 4, CARD.h * 4]]);
    // The phone has no file to save to: its share sheet keeps the picture where the player says.
    expect(within(sheet).queryByRole('link', { name: 'Save the picture' })).toBeNull();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Share' }));
    await waitFor(() => expect(shareSheet.handed).toHaveLength(1));
    expect(shareSheet.handed[0]).toEqual({ url: 'file:///cache/rat-race-nurse-364.png', options: { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Nurse: score 364' } });
    expect(files.get('file:///cache/rat-race-nurse-364.png')).toEqual(Uint8Array.of(137, 80, 78, 71));
    // Shared again, the file of that name is written again, not refused.
    fireEvent.click(within(sheet).getByRole('button', { name: 'Share' }));
    await waitFor(() => expect(shareSheet.handed).toHaveLength(2));
  });

  it('says so where the phone has no share sheet, in the web\'s words for a picture there is no way to take, and draws nothing', async () => {
    shareSheet.available = false;
    show();
    open();
    expect((await screen.findByRole('alert')).textContent).toBe('This browser could not draw the picture.');
    expect(screen.queryByText('Drawing…')).toBeNull();
    expect(painted.asked).toEqual([]);
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
  });

  it('says so when the picture will not become a file, instead of drawing for ever', async () => {
    painted.encode = () => {
      throw new Error('the encoder refused');
    };
    show();
    open();
    expect((await screen.findByRole('alert')).textContent).toBe('This browser could not draw the picture.');
    expect(screen.queryByText('Drawing…')).toBeNull();
  });

  it('says so when the picture cannot be drawn, and lets go of it when closed', async () => {
    show();
    open();
    expect(screen.getByText('Drawing…')).toBeTruthy();
    await screen.findByRole('img', { name: 'Nurse: score 364' });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(painted.disposed.some((one) => (one as { kind?: string }).kind === 'card')).toBe(true));

    painted.surfaces = false;
    open();
    expect((await screen.findByRole('alert')).textContent).toBe('This browser could not draw the picture.');
  });
});
