// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import type { RatLook } from '@ratrace/core/game/avatar';

// The setup of the phone's tests replaces the phone's Sprite with a fake; the web's own is used here.
vi.unmock('./Sprite');
vi.unmock('./Sprite.web');
vi.mock('../sprites/sources', () => ({
  SOURCES: new Proxy(
    {},
    {
      get: (_, id) => ({ uri: `/sprites/${String(id)}.png` }),
      getOwnPropertyDescriptor: (_, id) => ({ value: { uri: `/sprites/${String(id)}.png` }, configurable: true, enumerable: true }),
    },
  ),
}));

const { loadSpritesWith } = await import('./spriteImages.web');
const { RatAvatar, RatChoices, RatLayers, choiceSprites } = await import('./RatAvatar.web');

const look: RatLook = { colour: 'gold', body: 'brown', face: 'grin', outfit: 'tuxedo', hat: 'cap', eyes: 'monocle', backdrop: 'stars' };

beforeEach(() => {
  loadSpritesWith(async (source) => ({ uri: (source as { uri: string }).uri, w: 128, h: 128 }));
});
async function drawn(ui: React.ReactElement) {
  const result = render(ui);
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  return result;
}
const imgs = (root: Element) => Array.from(root.querySelectorAll('img'));
const names = (root: Element) => imgs(root).map((img) => (img.getAttribute('src') ?? '').replace('/sprites/', '').replace('.png', ''));

test('a rat draws its layers in the Next web\'s order, back to front, each filling the rat\'s box', async () => {
  const { container } = await drawn(<RatLayers look={look} size={80} />);
  expect(names(container)).toEqual(['rat.backdrop.stars', 'rat.body.brown', 'rat.face.grin', 'rat.outfit.tuxedo', 'rat.eyes.monocle', 'rat.hat.cap']);
  for (const img of imgs(container)) {
    expect(img.style.width).toBe('80px');
    expect(img.style.height).toBe('80px');
    expect(img.style.imageRendering).toBe('pixelated');
    expect(img.getAttribute('aria-hidden')).toBe('true');
  }
});

test('a layer the look leaves bare, or that has no art, is left off', async () => {
  const bare = await drawn(<RatLayers look={{ ...look, outfit: null, hat: null, eyes: null, backdrop: null }} size={64} />);
  expect(names(bare.container)).toEqual(['rat.body.brown', 'rat.face.grin']);
});

test('under clothes the body is cut to what they let show of it: the clip is its mask, and the body waits for it', async () => {
  const { container } = await drawn(<RatLayers look={look} size={64} />);
  const body = imgs(container)[1];
  const mask = body.parentElement as HTMLElement;
  expect(mask.style.maskImage).toBe('url("/sprites/rat.clip.tuxedo.png")');
  expect(mask.style.maskSize).toBe('100% 100%');
  // Only the body is cut.
  expect(imgs(container)[0].parentElement).toBe(imgs(container)[2].parentElement);
  expect((imgs(container)[2].parentElement as HTMLElement).style.maskImage).toBeFalsy();

  // The clip not in yet: the body is not drawn uncut, and the rest are.
  loadSpritesWith((source) => ((source as { uri: string }).uri.includes('rat.clip') ? new Promise(() => {}) : Promise.resolve({ uri: (source as { uri: string }).uri, w: 128, h: 128 })));
  const waiting = await drawn(<RatLayers look={{ ...look, hat: null }} size={64} />);
  expect(names(waiting.container)).toEqual(['rat.backdrop.stars', 'rat.face.grin', 'rat.outfit.tuxedo', 'rat.eyes.monocle']);
});

test('a bare body has no mask', async () => {
  const { container } = await drawn(<RatLayers look={{ ...look, outfit: null }} size={64} />);
  expect(container.querySelector('[style*="mask"]')).toBeNull();
  expect(names(container)).toContain('rat.body.brown');
});

test('an avatar is the rat in a box of its size with the web\'s 2 pt night-900 border and its colour as the ground', async () => {
  const { container } = await drawn(<RatAvatar look={look} size="md" />);
  const box = container.firstElementChild as HTMLElement;
  expect(box.style.width).toBe('44px');
  expect(box.style.height).toBe('44px');
  expect(box.style.backgroundColor).toBe('rgb(242, 193, 78)');
  expect(getComputedStyle(box).borderTopWidth).toBe('2px');
  expect(box.getAttribute('aria-hidden')).toBe('true');
  // The whole rat fills the box inside the border.
  expect(imgs(container)[0].style.width).toBe('40px');
  const lg = await drawn(<RatAvatar look={look} size="lg" />);
  expect(imgs(lg.container)[0].style.width).toBe('92px');
});

test('a grid of choices: each choice is a box on the ground it stands on, with its rat, its backdrop alone, or nothing', async () => {
  const choices = [
    { x: 0, y: 0, side: 100, ground: 'night-700' as const, rat: { look, place: { x: 10, y: 20, w: 80, h: 80 } }, backdrop: null, faint: false, locked: false },
    { x: 100, y: 0, side: 100, ground: 'gold-500' as const, rat: null, backdrop: 'beach', faint: false, locked: false },
    { x: 0, y: 100, side: 100, ground: 'teal-300' as const, rat: null, backdrop: null, faint: false, locked: false },
  ];
  expect(choiceSprites(choices)).toContain('rat.backdrop.beach');
  const { container } = await drawn(<RatChoices width={200} height={200} choices={choices} />);
  const boxes = Array.from((container.firstElementChild as HTMLElement).children) as HTMLElement[];
  expect(boxes).toHaveLength(3);
  expect(boxes[0].style.left).toBe('0px');
  expect(boxes[1].style.left).toBe('100px');
  expect(boxes[2].style.top).toBe('100px');
  expect(boxes[1].style.backgroundColor).toBe('rgb(242, 193, 78)');
  // The rat at its place in its box; the backdrop alone filling its box; the colour alone nothing.
  const rat = imgs(boxes[0]);
  expect(rat).toHaveLength(6);
  expect(rat[0].style.width).toBe('80px');
  expect(rat[0].parentElement?.style.left).toBe('10px');
  expect(rat[0].parentElement?.style.top).toBe('20px');
  expect(names(boxes[1])).toEqual(['rat.backdrop.beach']);
  expect(imgs(boxes[1])[0].style.width).toBe('100px');
  expect(imgs(boxes[2])).toHaveLength(0);
});

test('a prize not won yet is faint (opacity 40% and grayscale), and the lock over it is not', async () => {
  const choices = [{ x: 0, y: 0, side: 100, ground: 'night-700' as const, rat: { look, place: { x: 0, y: 0, w: 100, h: 100 } }, backdrop: null, faint: true, locked: true }];
  expect(choiceSprites(choices)).toContain('icon.locked');
  const { container } = await drawn(<RatChoices width={100} height={100} choices={choices} />);
  const box = (container.firstElementChild as HTMLElement).firstElementChild as HTMLElement;
  const faint = imgs(box)[0].closest('[data-faint]') as HTMLElement;
  expect(faint.style.opacity).toBe('0.4');
  expect(faint.style.filter).toBe('grayscale(1)');
  const lock = imgs(box).find((img) => img.getAttribute('src')?.includes('icon.locked')) as HTMLImageElement;
  expect(lock.closest('[data-faint]')).toBeNull();
  expect(lock.style.width).toBe('32px');
  expect(lock.style.left).toBe('34px');
  expect(lock.style.top).toBe('34px');
});

test('a grid draws nothing until every picture it asks for is in', async () => {
  loadSpritesWith(() => new Promise(() => {}));
  const { container } = await drawn(<RatChoices width={100} height={100} choices={[{ x: 0, y: 0, side: 100, ground: 'night-700', rat: { look, place: { x: 0, y: 0, w: 100, h: 100 } }, backdrop: null, faint: false, locked: false }]} />);
  expect(imgs(container)).toHaveLength(0);
});
