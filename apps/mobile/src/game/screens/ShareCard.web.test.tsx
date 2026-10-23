// @vitest-environment jsdom
import { CARD, shareCard } from '@ratrace/core/game/share';
import type { DrawOp } from '@ratrace/core/game/share';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryServices, renderGame } from '../../testing/render';
import { loadSpritesWith } from '../../ui/spriteImages.web';
import { drawCard, ShareCard } from './ShareCard.web';

// Every sprite's file is served at an address of its own.
vi.mock('../../sprites/sources', () => ({
  SOURCES: new Proxy(
    {},
    {
      get: (_, id) => ({ uri: `/sprites/${String(id)}.png` }),
      getOwnPropertyDescriptor: (_, id) => ({ value: { uri: `/sprites/${String(id)}.png` }, configurable: true, enumerable: true }),
    },
  ),
}));

/*
 * The web export's share card: the same list of things to draw as the phone's, on a 2D canvas. jsdom has no canvas, so a stand-in context writes down
 * what it is asked to do, in order (and in which font), and measures a letter as half its size wide.
 */

const ops = shareCard({
  title: 'THE RAT RACE', life: 'Nurse', where: 'Age 62 · Madrid', outcome: 'You never left the rat race.', escaped: false, portrait: 'portrait.nurse.58',
  scoreLabel: 'Score', score: '364', parts: [{ label: 'Wealth', value: '311' }], netWorthLabel: 'Net worth', netWorth: '$1,999,329', history: [1, 2, 3], badgesLabel: 'Badges', badges: ['badge.escaped'],
});

/** What the context was asked, in order: the log the canvas keeps, and the canvases that were made. */
const log: unknown[][] = [];
const canvases: Array<{ width: number; height: number }> = [];
let hasContext = true;

function context(canvas: HTMLCanvasElement) {
  const state = { font: '10px sans-serif', fillStyle: '', textAlign: 'start', textBaseline: 'alphabetic', imageSmoothingEnabled: true };
  const sizeOf = () => Number(/(\d+)px/.exec(state.font)?.[1]);
  return Object.assign(state, {
    fillRect: (...args: number[]) => log.push(['rect', state.fillStyle, ...args]),
    drawImage: (image: unknown, ...args: number[]) => log.push(['image', image, state.imageSmoothingEnabled, ...args]),
    fillText: (text: string, x: number, y: number) => log.push(['text', state.font, text, x, y, state.fillStyle, state.textAlign]),
    measureText: (text: string) => ({ width: text.length * sizeOf() * 0.5 }),
    canvas,
  });
}

const urls: string[] = [];
const revoked: string[] = [];
beforeEach(() => {
  hasContext = true;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    canvases.push(this);
    return (hasContext ? context(this) : null) as never;
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (callback: BlobCallback) {
    callback(new Blob(['png'], { type: 'image/png' }));
  });
  URL.createObjectURL = vi.fn(() => {
    urls.push(`blob:card-${urls.length + 1}`);
    return urls[urls.length - 1];
  });
  URL.revokeObjectURL = vi.fn((url: string) => void revoked.push(url));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  log.length = 0;
  canvases.length = 0;
  urls.length = 0;
  revoked.length = 0;
  delete (navigator as { share?: unknown }).share;
  delete (navigator as { canShare?: unknown }).canShare;
  delete (document as { fonts?: unknown }).fonts;
});

const of = (kind: string) => log.filter(([k]) => k === kind);
/** A sprite's picture as a canvas can draw it. */
const picture = () => ({ kind: 'sprite' }) as unknown as CanvasImageSource;
/** The typefaces asked for, as the page's fonts are (family, and the letters it will draw), noted in the log among the drawing. */
const asked: string[] = [];
const faces = async (family: string) => {
  asked.push(family);
  log.push(['face', family]);
};
afterEach(() => {
  asked.length = 0;
});

describe('drawing the share card on a canvas', () => {
  it('draws on a canvas four times the grid, its pictures with no smoothing, and gives it back as a PNG', async () => {
    const sprite = picture();
    const blob = await drawCard(ops, { load: async () => sprite, faces });
    expect(canvases).toEqual([expect.objectContaining({ width: CARD.w * 4, height: CARD.h * 4 })]);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob?.type).toBe('image/png');
    // Every art pixel a square of sixteen: no smoothing when the pictures are drawn.
    for (const call of of('image')) expect(call[2]).toBe(false);
  });

  it('draws every rectangle, sprite and line of text, four times as large, in the order of the list', async () => {
    const sprite = picture();
    await drawCard(ops, { load: async () => sprite, faces });
    expect(of('rect')[0]).toEqual(['rect', '#141b33', 0, 0, 1080, CARD.h * 4]);
    expect(of('rect')).toHaveLength(ops.filter((op) => op.kind === 'rect').length);
    expect(of('image').map((call) => [call[1], ...call.slice(3)])).toEqual([
      [sprite, 56, 136, 256, 256],
      [sprite, 52, 1064, 256, 256],
    ]);
    const written = of('text').map((call) => call[2]);
    for (const line of ['THE RAT RACE', 'Nurse', '364', '$1,999,329', 'Age 62 · Madrid']) expect(written).toContain(line);
    // Each in its colour, on its baseline.
    expect(of('text').find((call) => call[2] === 'THE RAT RACE')?.slice(4)).toEqual([24 * 4, '#f2c14e', 'left']);
    // The list's own order is the drawing's: the pictures over the rectangles under them.
    const order = log.filter(([k]) => k !== 'face').map(([k]) => k);
    expect(order).toEqual(ops.map((op) => (op.kind === 'rect' ? 'rect' : op.kind === 'sprite' ? 'image' : 'text')));
  });

  it('leaves out a sprite that does not arrive, or whose read is refused, and still draws the rest', async () => {
    await drawCard(ops, { load: async () => null, faces });
    expect(of('image')).toEqual([]);
    expect(of('text').length).toBeGreaterThan(5);
    log.length = 0;
    await drawCard(ops, { load: () => Promise.reject(new Error('gone')), faces });
    expect(of('image')).toEqual([]);
    expect(of('text').length).toBeGreaterThan(5);
  });

  it('reads a sprite once however often it is drawn', async () => {
    const load = vi.fn<(id: string) => Promise<CanvasImageSource>>(async () => picture());
    await drawCard([...ops, ...ops], { load, faces });
    expect(load.mock.calls.map(([id]) => id).sort()).toEqual(['badge.escaped', 'portrait.nurse.58']);
  });

  it('waits for the page\'s fonts before it draws anything, each family it will draw with asked once', async () => {
    await drawCard(ops, { load: async () => null, faces });
    expect(asked).toEqual(['Jersey15_400Regular', 'ChakraPetch_400Regular']);
    expect(log[0]).toEqual(['face', 'Jersey15_400Regular']);
    expect(log[1]).toEqual(['face', 'ChakraPetch_400Regular']);
    expect(log[2][0]).not.toBe('face');
  });

  it('asks the browser for the font with the very letters it will draw, and goes on where it cannot be had', async () => {
    const load = vi.fn<(font: string, text?: string) => Promise<FontFace[]>>(() => Promise.reject(new Error('no such font')));
    Object.defineProperty(document, 'fonts', { value: { load }, configurable: true });
    await drawCard([{ kind: 'text', text: 'Hi', x: 1, y: 2, size: 5, font: 'sans', color: '#fff', align: 'left', maxWidth: 99 }], { load: async () => null });
    expect(load).toHaveBeenCalledWith('16px "ChakraPetch_400Regular"', 'Hi');
    expect(of('text')).toHaveLength(1);
  });

  it('draws the pixel typeface brought to the page\'s small letters (the kit\'s scale), and leaves the reading one alone', async () => {
    await drawCard(ops, { load: async () => null, faces });
    const font = (line: string) => of('text').find((call) => call[2] === line)?.[1];
    // Jersey 15's small letters stand shorter in their size: the title (15 on the grid, 60 on the canvas) is drawn larger than that.
    const px = Number(/(\d+)px/.exec(font('THE RAT RACE') as string)?.[1]);
    expect(px).toBeGreaterThan(60);
    expect(font('THE RAT RACE')).toMatch(/"Jersey15_400Regular"/);
    expect(font('Age 62 · Madrid')).toBe('36px "ChakraPetch_400Regular", sans-serif');
  });

  it('writes a name too long for its place smaller, not over the edge', async () => {
    const long = shareCard({ title: 'T', where: 'w', outcome: 'o', escaped: false, portrait: 'p', scoreLabel: 's', score: '1', parts: [], netWorthLabel: 'n', netWorth: '1', history: [], badgesLabel: 'b', badges: [], life: 'A life with a name that is far too long to fit beside a portrait' });
    await drawCard(long, { load: async () => null, faces });
    const name = of('text').find((call) => String(call[2]).startsWith('A life')) as unknown[];
    const px = Number(/(\d+)px/.exec(name[1] as string)?.[1]);
    const op = long.find((one) => one.kind === 'text' && one.text.startsWith('A life')) as Extract<DrawOp, { kind: 'text' }>;
    expect(px).toBeGreaterThanOrEqual(8);
    expect((name[2] as string).length * px * 0.5).toBeLessThanOrEqual(op.maxWidth * 4);
  });

  it('writes the Cyrillic in the typefaces the kit keeps for it, each piece of a line where the last ended', async () => {
    await drawCard(
      [
        { kind: 'text', text: 'Медсестра', x: 10, y: 10, size: 15, font: 'pixel', color: '#fff', align: 'left', maxWidth: 400 },
        { kind: 'text', text: '62 года · Мадрид', x: 10, y: 30, size: 9, font: 'sans', color: '#fff', align: 'left', maxWidth: 400 },
      ],
      { load: async () => null, faces, language: 'ru' },
    );
    const texts = of('text');
    expect(texts[0][1]).toMatch(/"Oswald_500Medium"/);
    expect(texts.slice(1).map(([, font, text, x]) => [font, text, x])).toEqual([
      ['36px "ChakraPetch_400Regular", sans-serif', '62 ', 40],
      ['36px "Exo2_400Regular", sans-serif', 'года', 40 + 3 * 36 * 0.5],
      ['36px "ChakraPetch_400Regular", sans-serif', ' · ', 40 + 7 * 36 * 0.5],
      ['36px "Exo2_400Regular", sans-serif', 'Мадрид', 40 + 10 * 36 * 0.5],
    ]);
    expect(asked).toEqual(['Oswald_500Medium', 'ChakraPetch_400Regular', 'Exo2_400Regular']);
  });

  it('places a line from its right, or its middle, by the whole of it', async () => {
    await drawCard(
      [
        { kind: 'text', text: 'abcd', x: 100, y: 10, size: 10, font: 'sans', color: '#fff', align: 'right', maxWidth: 400 },
        { kind: 'text', text: 'abcd', x: 100, y: 20, size: 10, font: 'sans', color: '#fff', align: 'center', maxWidth: 400 },
      ],
      { load: async () => null, faces },
    );
    // 4 letters of 40 px, half as wide as high: 80 wide, at 400 on the canvas.
    expect(of('text').map(([, , , x]) => x)).toEqual([400 - 80, 400 - 40]);
  });

  it('gives up without a fuss where the browser gives no canvas to draw on', async () => {
    hasContext = false;
    expect(await drawCard(ops, { load: async () => picture(), faces })).toBeNull();
    expect(log).toEqual([]);
  });

  it('gives null where the canvas will not become a PNG', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (callback: BlobCallback) {
      callback(null);
    });
    expect(await drawCard(ops, { load: async () => null, faces })).toBeNull();
  });

  it('loads a sprite by the address the kit reads it from, as an image the canvas can draw', async () => {
    loadSpritesWith(async (source) => ({ uri: (source as { uri: string }).uri, w: 8, h: 8 }));
    const made: Array<{ src: string; onload(): void }> = [];
    class FakeImage {
      src = '';
      onload: () => void = () => {};
      onerror: () => void = () => {};
      constructor() {
        made.push(this);
      }
    }
    vi.stubGlobal('Image', FakeImage);
    try {
      const drawing = drawCard([{ kind: 'sprite', id: 'badge.escaped', x: 1, y: 2, w: 3, h: 4 }], { faces });
      await vi.waitFor(() => expect(made).toHaveLength(1));
      expect(made[0].src).toBe('/sprites/badge.escaped.png');
      made[0].onload();
      await drawing;
      expect(of('image')[0][1]).toBe(made[0]);
      expect(of('image')[0].slice(3)).toEqual([4, 8, 12, 16]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('the share sheet', () => {
  const show = (counted: unknown[] = []) =>
    renderGame(<ShareCard ops={ops} fileName="rat-race-nurse-364.png" alt="Nurse: score 364" load={async () => picture()} faces={faces} />, { ...memoryServices(), track: (event) => void counted.push(event) });
  const open = () => fireEvent.click(screen.getByRole('button', { name: 'Share this life' }));
  /** The sheet, once its picture is drawn. */
  const drawn = async () => {
    open();
    const sheet = screen.getByRole('heading', { name: 'A picture of this life' }).closest('[aria-modal="true"]') as HTMLElement;
    expect(await within(sheet).findByRole('img', { name: 'Nurse: score 364' })).toBeTruthy();
    return sheet;
  };
  /** The words that go with the picture: a way into the game, in the language it was played in (the web's `share.invite`). */
  const INVITE = /^Can you do better\? Play The Rat Race: https?:\/\/[^ ]+\/en$/;

  it('draws the picture only once it is opened, and shows it as an image of the object\'s address', async () => {
    show();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(canvases).toEqual([]);
    const sheet = await drawn();
    expect(canvases).toHaveLength(1);
    const img = within(sheet).getByRole('img', { name: 'Nurse: score 364' });
    expect(img.getAttribute('src')).toBe('blob:card-1');
  });

  it('offers only a link to the file where the browser cannot share files, to save the picture under its name', async () => {
    show();
    const sheet = await drawn();
    expect(within(sheet).queryByRole('button', { name: 'Share' })).toBeNull();
    const link = within(sheet).getByRole('link', { name: 'Save the picture' });
    expect(link.getAttribute('href')).toBe('blob:card-1');
    expect(link.getAttribute('download')).toBe('rat-race-nurse-364.png');
  });

  it('offers the browser\'s share sheet too where it can share the file, handed the file, the picture\'s words and the invitation, and counts it', async () => {
    const share = vi.fn<(data: ShareData) => Promise<void>>(async () => undefined);
    Object.assign(navigator, { share, canShare: (data: ShareData) => (data.files?.length ?? 0) === 1 });
    const counted: unknown[] = [];
    show(counted);
    const sheet = await drawn();
    const buttons = within(sheet).getAllByRole('button').map((one) => one.textContent);
    expect(buttons).toContain('Share');
    expect(within(sheet).getByRole('link', { name: 'Save the picture' })).toBeTruthy();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Share' }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const data = share.mock.calls[0][0];
    expect(data.title).toBe('Nurse: score 364');
    expect(data.text).toMatch(INVITE);
    expect(data.files).toHaveLength(1);
    expect(data.files?.[0].name).toBe('rat-race-nurse-364.png');
    expect(data.files?.[0].type).toBe('image/png');
    await waitFor(() => expect(counted).toContainEqual({ name: 'share', what: 'card' }));
  });

  it('counts nothing and says nothing where the player turns the share sheet down', async () => {
    const share = vi.fn(async () => {
      throw new DOMException('turned down', 'AbortError');
    });
    Object.assign(navigator, { share, canShare: () => true });
    const counted: unknown[] = [];
    show(counted);
    const sheet = await drawn();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Share' }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    await new Promise((done) => setTimeout(done, 10));
    expect(counted).toEqual([]);
    expect(within(sheet).queryByRole('alert')).toBeNull();
  });

  it('says so in the web\'s words when the picture cannot be drawn, instead of drawing for ever', async () => {
    hasContext = false;
    show();
    open();
    expect((await screen.findByRole('alert')).textContent).toBe('This browser could not draw the picture.');
    expect(screen.queryByText('Drawing…')).toBeNull();
  });

  it('lets go of the object\'s address when the sheet is closed, and draws again when it is opened again', async () => {
    show();
    await drawn();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(revoked).toEqual(['blob:card-1']));
    await drawn();
    expect(urls).toEqual(['blob:card-1', 'blob:card-2']);
  });

  it('lets go of it when the screen goes, too', async () => {
    const { unmount } = show();
    await drawn();
    unmount();
    expect(revoked).toEqual(['blob:card-1']);
  });
});
