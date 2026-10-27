import { afterEach, expect, test, vi } from 'vitest';

// Skia runs on the phone only: here, its two enums the cut names (`cutPiece` is given its makers).
vi.mock('@shopify/react-native-skia', () => ({ AlphaType: { Unpremul: 3 }, ColorType: { RGBA_8888: 4 }, Skia: {} }));
const { cutPiece, isPiece, LINGER_MS, sheetReader } = await import('./spriteSheets');
type SpritePiece = import('./spriteSheets').SpritePiece;

afterEach(() => vi.useRealTimers());

/** A decoded sheet as Skia's is, that says when it is let go. */
const sheet = (name: string) => ({ name, dispose: vi.fn() });
const piece = (x: number, sheetOf: unknown = 7): SpritePiece => ({ sheet: sheetOf as number, x, y: 0, w: 8, h: 8 });

test('a piece names its sheet; a file of its own is not a piece', () => {
  expect(isPiece(piece(0))).toBe(true);
  expect(isPiece(12)).toBe(false);
  expect(isPiece({ uri: '/x.png' })).toBe(false);
});

test('the pieces of one sheet asked for together: the sheet read and decoded once, each piece cut from it, the sheet let go a moment after', async () => {
  vi.useFakeTimers();
  const decoded = sheet('icons');
  const read = vi.fn(async () => decoded as never);
  const cut = vi.fn((from: unknown, at: SpritePiece) => ({ from, x: at.x }) as never);
  const pieceOf = sheetReader(read, cut);
  const cuts = await Promise.all([pieceOf(piece(0)), pieceOf(piece(8)), pieceOf(piece(16))]);
  expect(read).toHaveBeenCalledTimes(1);
  expect(cuts).toEqual([{ from: decoded, x: 0 }, { from: decoded, x: 8 }, { from: decoded, x: 16 }]);
  // Kept a moment, for the next row a list draws: asked again, not read again.
  await pieceOf(piece(24));
  expect(read).toHaveBeenCalledTimes(1);
  expect(decoded.dispose).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(LINGER_MS);
  expect(decoded.dispose).toHaveBeenCalledTimes(1);
  // Once let go, the next piece reads it anew.
  await pieceOf(piece(32));
  expect(read).toHaveBeenCalledTimes(2);
});

test('two sheets are two reads; a sheet that does not decode gives no piece, and one whose read is refused fails each piece asked of it', async () => {
  vi.useFakeTimers();
  const read = vi.fn(async (source: unknown) => {
    if (source === 'broken') return null;
    if (source === 'refused') throw new Error('no');
    return sheet(String(source)) as never;
  });
  const pieceOf = sheetReader(read, (from) => from as never);
  expect(await pieceOf(piece(0, 'a'))).toMatchObject({ name: 'a' });
  expect(await pieceOf(piece(0, 'b'))).toMatchObject({ name: 'b' });
  expect(await pieceOf(piece(0, 'broken'))).toBeNull();
  await expect(pieceOf(piece(0, 'refused'))).rejects.toThrow('no');
  expect(read).toHaveBeenCalledTimes(4);
  // A refused read is not kept: asked again, it is tried again.
  await vi.advanceTimersByTimeAsync(LINGER_MS);
  await expect(pieceOf(piece(8, 'refused'))).rejects.toThrow('no');
  expect(read).toHaveBeenCalledTimes(5);
});

test('a piece is cut from the sheet as it is, pixel for pixel: its rows of the sheet, not premultiplied', async () => {
  const readPixels = vi.fn(() => new Uint8Array(8 * 8 * 4));
  const made = { width: () => 8 };
  const skia = { fromBytes: vi.fn((bytes: Uint8Array) => ({ bytes })), make: vi.fn(() => made) };
  expect(cutPiece({ readPixels } as never, { sheet: 1, x: 16, y: 32, w: 8, h: 8 }, skia as never)).toBe(made);
  expect(readPixels).toHaveBeenCalledWith(16, 32, expect.objectContaining({ width: 8, height: 8, alphaType: 3, colorType: 4 }));
  expect(skia.make).toHaveBeenCalledWith(expect.objectContaining({ width: 8, height: 8, alphaType: 3, colorType: 4 }), expect.anything(), 32);
  // Pixels that cannot be read: no piece.
  expect(cutPiece({ readPixels: () => null } as never, { sheet: 1, x: 0, y: 0, w: 8, h: 8 }, skia as never)).toBeNull();
});
