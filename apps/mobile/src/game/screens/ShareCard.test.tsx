// @vitest-environment jsdom
import { CARD, PIXEL_X_HEIGHT, shareCard } from '@ratrace/core/game/share';
import type { DrawOp } from '@ratrace/core/game/share';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Platform, Share } from 'react-native';
import { files, folders, photos, memoryServices, renderGame, shareSheet } from '../../testing/render';
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
  /** The phone's own words for a picture that cannot be had: none of the web's, which speak of a browser. */
  const FAILED = 'This phone could not make the picture to share.';
  /** The sheet, once its picture is drawn. */
  const drawn = async () => {
    open();
    const sheet = screen.getByRole('heading', { name: 'A picture of this life' }).closest('[aria-modal="true"]') as HTMLElement;
    expect(await within(sheet).findByRole('img', { name: 'Nurse: score 364' })).toBeTruthy();
    return sheet;
  };
  /** Runs `test` on a phone of this platform. */
  async function on(os: 'ios' | 'android', test: () => Promise<void>) {
    const was = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
    try {
      await test();
    } finally {
      Object.defineProperty(Platform, 'OS', { value: was, configurable: true });
    }
  }
  /** The words that go with the picture where they can: a way into the game, in the language it was played in (the web's `share.invite`). */
  const INVITE = /^Can you do better\? Play The Rat Race: https?:\/\/[^ ]+\/en$/;

  it('draws the picture only once it is opened, and on Android hands it to the share sheet as a file, alone', async () => {
    await on('android', async () => {
      const told = vi.spyOn(Share, 'share');
      show();
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.queryByRole('heading', { name: 'A picture of this life' })).toBeNull();
      // Nothing is drawn until the player asks for the picture.
      expect(painted.asked).toEqual([]);
      const sheet = await drawn();
      expect(painted.asked).toEqual([[CARD.w * 4, CARD.h * 4]]);
      // No link to a file, as the web's: the picture is saved to the phone's photos by a button (below).
      expect(within(sheet).queryByRole('link', { name: 'Save the picture' })).toBeNull();
      fireEvent.click(within(sheet).getByRole('button', { name: 'Share' }));
      await waitFor(() => expect(shareSheet.handed).toHaveLength(1));
      // Android's share sheet takes a file or words, not both (React Native's `Share` sends words only there): the file it is.
      expect(shareSheet.handed[0]).toEqual({ url: 'file:///cache/share/rat-race-nurse-364.png', options: { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Nurse: score 364' } });
      expect(files.get('file:///cache/share/rat-race-nurse-364.png')).toEqual(Uint8Array.of(137, 80, 78, 71));
      expect(told).not.toHaveBeenCalled();
      // Shared again, the file of that name is written again, not refused.
      fireEvent.click(within(sheet).getByRole('button', { name: 'Share' }));
      await waitFor(() => expect(shareSheet.handed).toHaveLength(2));
      told.mockRestore();
    });
  });

  it('on iOS hands the share sheet the picture and the words that bring someone into the game, as the web does', async () => {
    await on('ios', async () => {
      const told = vi.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
      show();
      const sheet = await drawn();
      fireEvent.click(within(sheet).getByRole('button', { name: 'Share' }));
      await waitFor(() => expect(told).toHaveBeenCalledTimes(1));
      const [content] = told.mock.calls[0] as unknown as [{ url: string; message: string }];
      expect(content.url).toBe('file:///cache/share/rat-race-nurse-364.png');
      expect(content.message).toMatch(INVITE);
      expect(files.get('file:///cache/share/rat-race-nurse-364.png')).toEqual(Uint8Array.of(137, 80, 78, 71));
      expect(shareSheet.handed).toEqual([]);
      told.mockRestore();
    });
  });

  it('keeps one picture in the cache at a time: those shared before are cleared as a new one is written', async () => {
    folders.add('file:///cache/share/');
    files.set('file:///cache/share/rat-race-heir-120.png', Uint8Array.of(1));
    show();
    const sheet = await drawn();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Share' }));
    await waitFor(() => expect(shareSheet.handed).toHaveLength(1));
    expect([...files.keys()]).toEqual(['file:///cache/share/rat-race-nurse-364.png']);
  });

  it('takes no second press of Share while the picture is being handed over', async () => {
    show();
    const sheet = await drawn();
    const send = within(sheet).getByRole('button', { name: 'Share' });
    fireEvent.click(send);
    fireEvent.click(send);
    await waitFor(() => expect(shareSheet.handed).toHaveLength(1));
    await new Promise((done) => setTimeout(done, 20));
    expect(shareSheet.handed).toHaveLength(1);
    // Once it has been handed over, it can be shared again.
    fireEvent.click(send);
    await waitFor(() => expect(shareSheet.handed).toHaveLength(2));
  });

  it('says so in the phone\'s own words when the share sheet fails, and Share can be tried again', async () => {
    shareSheet.fails = true;
    show();
    const sheet = await drawn();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Share' }));
    expect((await within(sheet).findByRole('alert')).textContent).toBe(FAILED);
    expect(shareSheet.handed).toEqual([]);
    // The picture is still there to share: tried again, it goes, and the line is gone.
    shareSheet.fails = false;
    fireEvent.click(within(sheet).getByRole('button', { name: 'Share' }));
    await waitFor(() => expect(shareSheet.handed).toHaveLength(1));
    expect(within(sheet).queryByRole('alert')).toBeNull();
  });

  it('says so where the phone has no share sheet, in the phone\'s own words, and draws nothing', async () => {
    shareSheet.available = false;
    show();
    open();
    expect((await screen.findByRole('alert')).textContent).toBe(FAILED);
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
    expect((await screen.findByRole('alert')).textContent).toBe(FAILED);
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
    expect((await screen.findByRole('alert')).textContent).toBe(FAILED);
  });
});

describe('saving the picture to the phone\'s photos', () => {
  const show = () => renderGame(<ShareCard ops={ops} fileName="rat-race-nurse-364.png" alt="Nurse: score 364" load={async () => picture() as never} faces={faces} />, memoryServices());
  /** The sheet, once its picture is drawn. */
  const drawn = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Share this life' }));
    const sheet = screen.getByRole('heading', { name: 'A picture of this life' }).closest('[aria-modal="true"]') as HTMLElement;
    expect(await within(sheet).findByRole('img', { name: 'Nurse: score 364' })).toBeTruthy();
    return sheet;
  };
  const FILE = 'file:///cache/share/rat-race-nurse-364.png';

  it('is a button under Share, as the web\'s link under its own: it asks leave to add to the photos, and no more, then saves the picture there, and says so', async () => {
    show();
    const sheet = await drawn();
    const buttons = within(sheet).getAllByRole('button').map((one) => one.textContent);
    expect(buttons.slice(buttons.indexOf('Share'))).toEqual(['Share', 'Save the picture']);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save the picture' }));
    expect((await within(sheet).findByRole('status')).textContent).toBe('Saved to your photos.');
    // Leave to add to them, not to read them.
    expect(photos.asked).toEqual([{ writeOnly: true, granular: undefined }]);
    expect(photos.saved).toEqual([FILE]);
    expect(files.get(FILE)).toEqual(Uint8Array.of(137, 80, 78, 71));
    // Nothing went to the share sheet.
    expect(shareSheet.handed).toEqual([]);
  });

  it('saves nothing where the player does not allow it, and says where it can be allowed', async () => {
    photos.allows = false;
    show();
    const sheet = await drawn();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save the picture' }));
    expect((await within(sheet).findByRole('alert')).textContent).toBe('The Rat Race may not add to your photos. You can allow it in Settings.');
    expect(photos.saved).toEqual([]);
    // Allowed since, it saves.
    photos.allows = true;
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save the picture' }));
    expect((await within(sheet).findByRole('status')).textContent).toBe('Saved to your photos.');
    expect(within(sheet).queryByRole('alert')).toBeNull();
    expect(photos.saved).toEqual([FILE]);
  });

  it('says so when the phone could not save it, and it can be tried again', async () => {
    photos.fails = true;
    show();
    const sheet = await drawn();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save the picture' }));
    expect((await within(sheet).findByRole('alert')).textContent).toBe('The picture could not be saved.');
    expect(photos.saved).toEqual([]);
    photos.fails = false;
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save the picture' }));
    expect((await within(sheet).findByRole('status')).textContent).toBe('Saved to your photos.');
  });

  it('saves once for a double tap: a second press while the first is saving does nothing', async () => {
    show();
    const sheet = await drawn();
    const save = within(sheet).getByRole('button', { name: 'Save the picture' });
    fireEvent.click(save);
    fireEvent.click(save);
    await within(sheet).findByRole('status');
    await new Promise((done) => setTimeout(done, 20));
    expect(photos.asked).toHaveLength(1);
    expect(photos.saved).toEqual([FILE]);
  });

  it('takes no Share while the picture is being saved, nor a Save while it is being shared: both write the one file of the cache', async () => {
    let letGo = () => {};
    photos.held = new Promise((done) => (letGo = done));
    show();
    const sheet = await drawn();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save the picture' }));
    await waitFor(() => expect(photos.asked).toHaveLength(1));
    // Shared while it is saving: nothing goes to the share sheet, and the file being saved is not written again under it.
    fireEvent.click(within(sheet).getByRole('button', { name: 'Share' }));
    await new Promise((done) => setTimeout(done, 20));
    expect(shareSheet.handed).toEqual([]);
    letGo();
    expect((await within(sheet).findByRole('status')).textContent).toBe('Saved to your photos.');
    expect(photos.saved).toEqual([FILE]);
    // Done saving, it shares; and while it is shared (on Android, until the sheet hands it on), a Save is nothing.
    fireEvent.click(within(sheet).getByRole('button', { name: 'Share' }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save the picture' }));
    await waitFor(() => expect(shareSheet.handed).toHaveLength(1));
    await new Promise((done) => setTimeout(done, 20));
    expect(photos.asked).toHaveLength(1);
  });

  it('says nothing of a save that ended after the sheet was closed, when it is opened again', async () => {
    let letGo = () => {};
    photos.held = new Promise((done) => (letGo = done));
    show();
    const sheet = await drawn();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save the picture' }));
    await waitFor(() => expect(photos.asked).toHaveLength(1));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'A picture of this life' })).toBeNull());
    letGo();
    await waitFor(() => expect(photos.saved).toEqual([FILE]));
    await new Promise((done) => setTimeout(done, 20));
    const again = await drawn();
    expect(within(again).queryByRole('status')).toBeNull();
    expect(within(again).queryByRole('alert')).toBeNull();
    // A save made in this opening is told, as ever.
    photos.held = null;
    fireEvent.click(within(again).getByRole('button', { name: 'Save the picture' }));
    expect((await within(again).findByRole('status')).textContent).toBe('Saved to your photos.');
  });

  it('speaks Spanish and Russian', async () => {
    photos.allows = false;
    renderGame(<ShareCard ops={ops} fileName="rat-race-nurse-364.png" alt="Nurse: score 364" load={async () => picture() as never} faces={faces} />, memoryServices(), 'ru');
    // A Russian title is set in runs of its fonts: the name jsdom works out of them may drop the space between two runs.
    fireEvent.click(screen.getByRole('button', { name: /^Поделиться\s?жизнью$/ }));
    fireEvent.click(await screen.findByRole('button', { name: /^Сохранить\s?картинку$/ }));
    expect((await screen.findByRole('alert')).textContent).toBe('The Rat Race не может добавлять картинки в фото. Это можно разрешить в настройках.');
    cleanup();
    photos.allows = true;
    renderGame(<ShareCard ops={ops} fileName="rat-race-nurse-364.png" alt="Nurse: score 364" load={async () => picture() as never} faces={faces} />, memoryServices(), 'es');
    fireEvent.click(screen.getByRole('button', { name: 'Compartir esta vida' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Guardar la imagen' }));
    expect((await screen.findByRole('status')).textContent).toBe('Imagen guardada en tus fotos.');
  });
});
