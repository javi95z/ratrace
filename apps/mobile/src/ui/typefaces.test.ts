// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';

// The font files the app sets its type in, by the name of their family (an asset of the app, a number): two here.
vi.mock('./fontSources', () => ({ FONT_SOURCES: { Jersey15_400Regular: 101, Oswald_500Medium: 102 } }));
// Skia, as far as a typeface is made: the file read by its address, and a typeface made of what was read (or none); and the phone's own fonts, by name.
const skia = vi.hoisted(() => ({
  read: [] as string[],
  makes: (uri: string): unknown => ({ face: uri }),
  phone: {} as Record<string, unknown>,
  asked: [] as string[],
}));
vi.mock('@shopify/react-native-skia', () => ({
  Skia: {
    Data: { fromURI: async (uri: string) => (skia.read.push(uri), uri) },
    Typeface: { MakeFreeTypeFaceFromData: (data: string) => skia.makes(data) },
    FontMgr: { System: () => ({ matchFamilyStyle: (name: string) => (skia.asked.push(name), skia.phone[name] ?? null) }) },
  },
}));
vi.mock('react-native', () => ({ Image: { resolveAssetSource: (id: number) => ({ uri: `asset://${id}` }) } }));

const { typefaceOf } = await import('./typefaces');

afterEach(() => {
  skia.read.length = 0;
  skia.asked.length = 0;
  skia.makes = (uri) => ({ face: uri });
  skia.phone = {};
});

test('a game font is made a typeface from its own file once, and the same typeface is given to every later request', async () => {
  const first = await typefaceOf('Jersey15_400Regular');
  expect(first).toEqual({ face: 'asset://101' });
  expect(await typefaceOf('Jersey15_400Regular')).toBe(first);
  expect(skia.read).toEqual(['asset://101']);
});

test('a read that fails, or a file that makes no typeface, is not kept: the next request reads it again', async () => {
  skia.makes = () => {
    throw new Error('the file did not arrive');
  };
  expect(await typefaceOf('Oswald_500Medium')).toBeNull();
  skia.makes = () => null;
  expect(await typefaceOf('Oswald_500Medium')).toBeNull();
  skia.makes = (uri) => ({ face: uri });
  expect(await typefaceOf('Oswald_500Medium')).toEqual({ face: 'asset://102' });
  expect(skia.read).toEqual(['asset://102', 'asset://102', 'asset://102']);
});

test('a font that is not the game\'s is the phone\'s own, by its name, else the phone\'s sans serif', async () => {
  skia.phone = { Arial: { face: 'arial' }, Helvetica: { face: 'helvetica' } };
  expect(await typefaceOf('Arial')).toEqual({ face: 'arial' });
  expect(await typefaceOf('Zapf Dingbats')).toEqual({ face: 'helvetica' });
  expect(skia.asked).toEqual(['Arial', 'Zapf Dingbats', 'Helvetica']);
  expect(skia.read).toEqual([]);
});
