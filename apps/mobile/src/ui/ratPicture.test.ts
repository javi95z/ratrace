import { describe, expect, it, vi } from 'vitest';

vi.mock('@shopify/react-native-skia', async () => (await import('./testing/skia')).skiaFake());
const { composedPicture, forgetComposed } = await import('./ratPicture');

const picture = (src: string) => ({ src, width: () => 128, height: () => 128 }) as never;
const FAINT = [0.2, 0.7, 0.1, 0, 0, 0.2, 0.7, 0.1, 0, 0, 0.2, 0.7, 0.1, 0, 0, 0, 0, 0, 0.4, 0];

describe('a choice\'s picture, put together once', () => {
  it('draws the pieces back to front at the art\'s own size, the body cut by its clip, and the whole faint for a prize not won', () => {
    forgetComposed();
    const pieces = [
      { layer: 'body' as const, id: 'rat.body.brown', clip: 'rat.clip.suit' },
      { layer: 'outfit' as const, id: 'rat.outfit.suit', clip: null },
    ];
    const plain = composedPicture({ pieces, faint: false }, (id) => picture(`src:${id}`), FAINT) as unknown as { src: string; width(): number };
    expect(plain.src).toBe('drawn:layer,src:rat.body.brown,src:rat.clip.suit dstIn,restore,src:rat.outfit.suit');
    expect(plain.width()).toBe(128);
    const faint = composedPicture({ pieces, faint: true }, (id) => picture(`src:${id}`), FAINT) as unknown as { src: string };
    expect(faint.src).toBe('drawn:layer faint,layer,src:rat.body.brown,src:rat.clip.suit dstIn,restore,src:rat.outfit.suit,restore');
  });

  it('is made once for every grid that shows it, and not at all while one of its pictures is missing', () => {
    forgetComposed();
    const pieces = [{ layer: 'body' as const, id: 'rat.body.brown', clip: 'rat.clip.suit' }];
    const imageOf = vi.fn((id: string) => (id === 'rat.clip.suit' ? null : picture(`src:${id}`)));
    expect(composedPicture({ pieces, faint: false }, imageOf, FAINT)).toBeNull();
    const all = vi.fn((id: string) => picture(`src:${id}`));
    const first = composedPicture({ pieces, faint: false }, all, FAINT);
    expect(first).not.toBeNull();
    expect(composedPicture({ pieces, faint: false }, all, FAINT)).toBe(first);
    expect(all).toHaveBeenCalledTimes(2);
  });
});
