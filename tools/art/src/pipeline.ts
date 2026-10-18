import { assignCells, gridBox, labelBlobs } from './blobs';
import { blank } from './image';
import type { Box, Image } from './image';
import { erode, keyMask } from './key';
import { layerCells, layerSprite, placeOver, referenceShape } from './layers';
import { fitInto, resample } from './scale';
import { cropToAspect, dividerFlags, panelBoxes } from './scenes';
import type { SheetSpec } from './sheets';
import { opaqueCount } from './strays';

export type Flag = 'empty' | 'tiny' | 'touches-edge';

export interface Sprite {
  id: string;
  group: string;
  image: Image;
  flags: Flag[];
}

/** A sprite that covers less than this share of its canvas is probably a fragment, not the object. */
const TINY_SHARE = 0.06;

function cutObjects(sheet: Image, spec: SheetSpec): Sprite[] {
  const { width, height } = sheet;
  const mask = erode(keyMask(sheet), width, height);

  const columns = dividerFlags(sheet, 'x', 'white');
  const lines = dividerFlags(sheet, 'y', 'white');
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) if (columns[x] || lines[y]) mask[y * width + x] = 0;
  }

  const cellArea = (width / spec.cols) * (height / spec.rows);
  const { blobs, labels } = labelBlobs(mask, width, height);
  const cells = assignCells(blobs, width, height, spec.cols, spec.rows, {
    minArea: Math.round(cellArea * 0.004),
    reach: Math.round(Math.min(width / spec.cols, height / spec.rows) * 0.12),
  });

  const sprites: Sprite[] = [];
  spec.ids.forEach((id, index) => {
    if (id === '') return;
    const cell = cells[index];
    if (!cell) {
      sprites.push({ id, group: spec.group, image: blank(spec.width, spec.height), flags: ['empty'] });
      return;
    }
    const own = new Uint8Array(mask.length);
    for (let y = cell.box.y0; y < cell.box.y1; y++) {
      for (let x = cell.box.x0; x < cell.box.x1; x++) {
        const i = y * width + x;
        if (cell.members.has(labels[i])) own[i] = 1;
      }
    }
    const image = fitInto(sheet, own, cell.box, spec.width, spec.height, { padding: 1, anchor: 'center' });
    const flags: Flag[] = [];
    if (cell.box.x0 <= 1 || cell.box.y0 <= 1 || cell.box.x1 >= width - 1 || cell.box.y1 >= height - 1) flags.push('touches-edge');
    if (opaqueCount(image) < spec.width * spec.height * TINY_SHARE) flags.push('tiny');
    sprites.push({ id, group: spec.group, image, flags });
  });
  return sprites;
}

/** Pixels trimmed from the left and right of each portrait cell, where a neighbour's shoulder may intrude. */
const PORTRAIT_SIDE_TRIM = 6;

/**
 * Portraits fill their cells and their shoulders can touch across a row, so they are cut on the
 * fixed grid rather than by outline. A shape only counts for the row its centre lies in, which keeps
 * the hair of the portrait below from showing at the bottom of the one above. White rules drawn
 * between the cells are taken out first: left in, they join every portrait they touch into one shape.
 */
function cutPortraits(sheet: Image, spec: SheetSpec): Sprite[] {
  const { width, height } = sheet;
  const mask = erode(keyMask(sheet), width, height);
  const columns = dividerFlags(sheet, 'x', 'white');
  const lines = dividerFlags(sheet, 'y', 'white');
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) if (columns[x] || lines[y]) mask[y * width + x] = 0;
  }
  const { blobs, labels } = labelBlobs(mask, width, height);
  const rowOf = blobs.map((blob) => Math.min(spec.rows - 1, Math.floor(blob.cy / (height / spec.rows))));

  const sprites: Sprite[] = [];
  spec.ids.forEach((id, index) => {
    if (id === '') return;
    const row = Math.floor(index / spec.cols);
    const cell = gridBox(width, height, spec.cols, spec.rows, index, 0);
    const trim = cell.x1 - cell.x0 > PORTRAIT_SIDE_TRIM * 4 ? PORTRAIT_SIDE_TRIM : 0;
    const box: Box = { x0: cell.x1, y0: cell.y1, x1: cell.x0, y1: cell.y0 };
    const own = new Uint8Array(mask.length);
    for (let y = cell.y0; y < cell.y1; y++) {
      for (let x = cell.x0 + trim; x < cell.x1 - trim; x++) {
        const i = y * width + x;
        if (labels[i] === 0 || rowOf[labels[i] - 1] !== row) continue;
        own[i] = 1;
        if (x < box.x0) box.x0 = x;
        if (y < box.y0) box.y0 = y;
        if (x + 1 > box.x1) box.x1 = x + 1;
        if (y + 1 > box.y1) box.y1 = y + 1;
      }
    }
    if (box.x1 <= box.x0) {
      sprites.push({ id, group: spec.group, image: blank(spec.width, spec.height), flags: ['empty'] });
      return;
    }
    const image = fitInto(sheet, own, box, spec.width, spec.height, { padding: 0, anchor: 'bottom' });
    const flags: Flag[] = opaqueCount(image) < spec.width * spec.height * TINY_SHARE ? ['tiny'] : [];
    sprites.push({ id, group: spec.group, image, flags });
  });
  return sprites;
}

function cutScenes(sheet: Image, spec: SheetSpec): Sprite[] {
  const panels = panelBoxes(sheet, spec.cols, spec.rows);
  const sprites: Sprite[] = [];
  spec.ids.forEach((id, index) => {
    if (id === '') return;
    const box = cropToAspect(panels[index], spec.width, spec.height);
    sprites.push({ id, group: spec.group, image: resample(sheet, box, spec.width, spec.height), flags: [] });
  });
  return sprites;
}

/** Each piece of a layer sheet, placed where the reference rat stands. */
function cutLayers(sheet: Image, spec: SheetSpec, over: Image): Sprite[] {
  const reference = layerCells(over, 4, 2)[0];
  const shape = referenceShape(reference);
  const size = { width: reference.width, height: reference.height };
  const cells = layerCells(sheet, spec.cols, spec.rows);
  const sprites: Sprite[] = [];
  spec.ids.forEach((id, index) => {
    if (id === '') return;
    const guided = spec.guided === true;
    const image = layerSprite(cells[index], guided, placeOver(cells[index], guided, shape, size), size, spec.width, spec.height);
    const flags: Flag[] = opaqueCount(image) === 0 ? ['empty'] : [];
    sprites.push({ id, group: spec.group, image, flags });
  });
  return sprites;
}

/**
 * Cuts every named cell of a sheet into a sprite of the sheet's size. Colours are not yet snapped to the palette.
 * Layers need the sheet they are placed over.
 */
export function cutSheet(sheet: Image, spec: SheetSpec, over?: Image): Sprite[] {
  if (spec.ids.length !== spec.cols * spec.rows) {
    throw new Error(`${spec.file}: ${spec.ids.length} names for ${spec.cols * spec.rows} cells`);
  }
  if (spec.kind === 'objects') return cutObjects(sheet, spec);
  if (spec.kind === 'portraits') return cutPortraits(sheet, spec);
  if (spec.kind === 'layers') {
    if (!over) throw new Error(`${spec.file}: a layer sheet needs the sheet it is placed over`);
    return cutLayers(sheet, spec, over);
  }
  return cutScenes(sheet, spec);
}
