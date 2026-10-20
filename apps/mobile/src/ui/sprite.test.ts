import { afterEach, expect, test, vi } from 'vitest';
import type { RatLook } from '@ratrace/core/game/avatar';
import { AVATAR_BOX, GROUND, piecesOf } from './rat';
import { CHECKER, checkerCells, reportMissing, spriteBox, spriteOf } from './sprites';

afterEach(() => vi.restoreAllMocks());

test('spriteOf gives the size the manifest knows, and null for an id it does not', () => {
  expect(spriteOf('icon.cash')).toMatchObject({ w: 32, h: 32 });
  expect(spriteOf('card.airport')).toMatchObject({ w: 288, h: 120 });
  expect(spriteOf('nope.nothing')).toBeNull();
  expect(spriteOf('constructor')).toBeNull();
});

test('spriteBox: whole pixels per art pixel, or the stage\'s art scale', () => {
  expect(spriteBox('icon.cash', 1, 1)).toEqual({ w: 32, h: 32 });
  expect(spriteBox('icon.cash', 2, 1)).toEqual({ w: 64, h: 64 });
  expect(spriteBox('icon.cash', 3, 2)).toEqual({ w: 96, h: 96 });
  expect(spriteBox('card.airport', 'art', 2)).toEqual({ w: 576, h: 240 });
  expect(spriteBox('card.airport', 'art', 1)).toEqual({ w: 288, h: 120 });
});

test('an unknown id is sized by its fallback (32 x 32 when none is given)', () => {
  expect(spriteBox('nope.nothing', 1, 1)).toEqual({ w: 32, h: 32 });
  expect(spriteBox('nope.nothing', 2, 1, { w: 128, h: 128 })).toEqual({ w: 256, h: 256 });
  expect(spriteBox('nope.nothing', 'art', 2, { w: 10, h: 20 })).toEqual({ w: 20, h: 40 });
});

test('a missing sprite is logged once per id', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  reportMissing('test.once', 'missing');
  reportMissing('test.once', 'missing');
  reportMissing('test.once', 'did not load');
  reportMissing('test.other', 'did not load');
  expect(warn.mock.calls).toEqual([['sprite missing: test.once'], ['sprite did not load: test.other']]);
});

test("the placeholder is the web's 8 px checkerboard: 4 px cells, night-700 top left, night-600 beside it", () => {
  expect(CHECKER).toEqual({ cell: 4, ground: 'night-700', cells: 'night-600' });
  expect(checkerCells(8, 8)).toEqual([
    { x: 4, y: 0, w: 4, h: 4 },
    { x: 0, y: 4, w: 4, h: 4 },
  ]);
  // A box that is not a whole number of cells: the last cells are cut to the box.
  expect(checkerCells(10, 4)).toEqual([{ x: 4, y: 0, w: 4, h: 4 }]);
  expect(checkerCells(13, 5)).toEqual([
    { x: 4, y: 0, w: 4, h: 4 },
    { x: 12, y: 0, w: 1, h: 4 },
    { x: 0, y: 4, w: 4, h: 1 },
    { x: 8, y: 4, w: 4, h: 1 },
  ]);
  expect(checkerCells(32, 32)).toHaveLength(32);
});

const look: RatLook = { colour: 'teal', body: 'grey', face: 'grin', outfit: 'suit', hat: 'crown', eyes: 'round', backdrop: 'stars' };

test('the rat is drawn back to front: backdrop, body, face, outfit, eyes, hat', () => {
  expect(piecesOf(look).map((p) => p.id)).toEqual([
    'rat.backdrop.stars',
    'rat.body.grey',
    'rat.face.grin',
    'rat.outfit.suit',
    'rat.eyes.round',
    'rat.hat.crown',
  ]);
});

test('only the body is clipped, and only under an outfit', () => {
  expect(piecesOf(look).map((p) => p.clip)).toEqual([null, 'rat.clip.suit', null, null, null, null]);
  const bare = piecesOf({ ...look, outfit: null, hat: null, eyes: null, backdrop: null });
  expect(bare).toEqual([
    { layer: 'body', id: 'rat.body.grey', clip: null },
    { layer: 'face', id: 'rat.face.grin', clip: null },
  ]);
});

test('a piece without art is left off, never drawn as a hole', () => {
  const pieces = piecesOf(look, (id) => id !== 'rat.hat.crown' && id !== 'rat.clip.suit' && spriteOf(id) !== null);
  expect(pieces.map((p) => p.id)).not.toContain('rat.hat.crown');
  expect(pieces.find((p) => p.layer === 'body')?.clip).toBeNull();
});

test("GROUND gives each colour the web's ground", () => {
  expect(GROUND).toEqual({
    gold: 'gold-500',
    teal: 'teal-300',
    wine: 'wine-300',
    sky: 'sky-300',
    coral: 'skin-500',
    emerald: 'teal-600',
    cream: 'cream',
    slate: 'ink-300',
  });
});

test('the avatar box: 32, 44 and 96 pt, a 2 pt border inside it', () => {
  expect(AVATAR_BOX).toEqual({ sm: 32, md: 44, lg: 96, border: 2 });
});
