/** A decoded picture: RGBA, one byte per channel, rows top to bottom. */
export interface Image {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export type Rgba = readonly [number, number, number, number];
export type Rgb = readonly [number, number, number];

/** A rectangle in pixels. x1 and y1 are exclusive. */
export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function blank(width: number, height: number, colour: Rgba = [0, 0, 0, 0]): Image {
  const image: Image = { width, height, data: new Uint8ClampedArray(width * height * 4) };
  if (colour[0] !== 0 || colour[1] !== 0 || colour[2] !== 0 || colour[3] !== 0) {
    paint(image, { x0: 0, y0: 0, x1: width, y1: height }, colour);
  }
  return image;
}

export function paint(image: Image, box: Box, colour: Rgba): void {
  for (let y = Math.max(0, box.y0); y < Math.min(image.height, box.y1); y++) {
    for (let x = Math.max(0, box.x0); x < Math.min(image.width, box.x1); x++) {
      image.data.set(colour, (y * image.width + x) * 4);
    }
  }
}

export function pixel(image: Image, x: number, y: number): Rgba {
  const i = (y * image.width + x) * 4;
  return [image.data[i], image.data[i + 1], image.data[i + 2], image.data[i + 3]];
}
