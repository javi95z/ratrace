// Skia draws on the phone only (a canvas of the GPU's). Under react-native-web in jsdom each of its pieces is a <div> that
// says what it was asked to draw: its kind, and every plain prop it was given as JSON (a vector, a list of colours, a
// transform, a path as the SVG string it is). Sprite.test keeps its own, older stand-in, which names a few props only.
// What is drawn by hand, on a surface of its own (the share card), is drawn on a double of Skia's surfaces that writes down
// every call (`painted`).
import type { ReactNode } from 'react';

type Props = Record<string, unknown> & { children?: ReactNode };

/** A piece given another as a prop (a group's `layer`, a paint) says what it was given by its kind and props: the element itself holds React's own. */
function elementsNamed(_key: string, value: unknown): unknown {
  if (value === null || typeof value !== 'object' || !('$$typeof' in value)) return value;
  const element = value as unknown as { type: unknown; props: Record<string, unknown> };
  const type = typeof element.type === 'string' ? element.type : ((element.type as { name?: string }).name ?? 'element');
  return { element: type, props: element.props };
}

const node =
  (kind: string) =>
  ({ children, ...props }: Props) => (
    <div data-skia={kind} data-props={JSON.stringify(props, elementsNamed)}>
      {children}
    </div>
  );

/** One call made of a surface's canvas: a rectangle (its colour and place), a picture (what, and where), a line of text (its font, words and place). */
export type Painted =
  | ['rect', string, number, number, number, number]
  | ['image', unknown, number, number, number, number, number, number]
  | ['text', string, string, number, number, string];

/** A typeface as the double knows one: by the family it is. */
export interface FaceDouble {
  family: string;
}

/** A font of the double: its family and size, as a canvas's `font` would say them (`82px Jersey15_400Regular`). */
export interface FontDouble {
  family: string;
  size: number;
  getSize(): number;
  getTextWidth(text: string): number;
}

/**
 * The surfaces drawn on by hand and what was drawn on them, for a test to read and to set: whether a surface can be had at all, how wide a text is in
 * a font, what a picture encodes to (or that it is refused). Put back as it was by `reset`, which every phone test does (`resetFakes`).
 */
export const painted = {
  calls: [] as Painted[],
  surfaces: true,
  measure: (text: string, font: { family: string; size: number }): number => text.length * font.size * 0.6,
  encode: (): Uint8Array => Uint8Array.of(137, 80, 78, 71),
  /** The pictures let go of (`dispose`), in order. */
  disposed: [] as unknown[],
  /** The size of every surface asked for, in pixels. */
  asked: [] as Array<[number, number]>,
  reset(): void {
    this.calls.length = 0;
    this.surfaces = true;
    this.measure = (text, font) => text.length * font.size * 0.6;
    this.encode = () => Uint8Array.of(137, 80, 78, 71);
    this.disposed.length = 0;
    this.asked.length = 0;
  },
};

type Rect = { x: number; y: number; width: number; height: number };

/** The picture a surface's drawing becomes: its size, its PNG, and a way to let go of it. */
function snapshot(w: number, h: number) {
  const image = {
    kind: 'card',
    width: () => w,
    height: () => h,
    encodeToBytes: () => painted.encode(),
    makeNonTextureImage: () => image,
    dispose: () => void painted.disposed.push(image),
  };
  return image;
}

function surface(w: number, h: number) {
  painted.asked.push([w, h]);
  const canvas = {
    drawRect: (rect: Rect, paint: { color: string }) => void painted.calls.push(['rect', paint.color, rect.x, rect.y, rect.width, rect.height]),
    drawImageRectOptions: (image: unknown, _src: Rect, dest: Rect, filter: number, mipmap: number) =>
      void painted.calls.push(['image', image, dest.x, dest.y, dest.width, dest.height, filter, mipmap]),
    drawText: (text: string, x: number, y: number, paint: { color: string }, font: FontDouble) => void painted.calls.push(['text', `${font.size}px ${font.family}`, text, x, y, paint.color]),
  };
  return { width: () => w, height: () => h, getCanvas: () => canvas, flush: () => undefined, makeImageSnapshot: () => snapshot(w, h), dispose: () => undefined };
}

/** The double of `Skia`, for what is drawn by hand: surfaces, paints, fonts, rectangles. */
const skiaDouble = {
  Surface: {
    MakeOffscreen: (w: number, h: number) => (painted.surfaces ? surface(w, h) : null),
    Make: (w: number, h: number) => (painted.surfaces ? surface(w, h) : null),
  },
  Paint: () => ({
    color: '',
    setColor(color: string) {
      this.color = color;
    },
    setAntiAlias: () => undefined,
  }),
  Color: (color: string) => color,
  XYWHRect: (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height }),
  Font: (face?: FaceDouble | null, size = 12): FontDouble => {
    const family = face?.family ?? 'default';
    return { family, size, getSize: () => size, getTextWidth: (text: string) => painted.measure(text, { family, size }) };
  },
};

export function skiaFake() {
  return {
    Canvas: ({ children, style }: Props & { style?: { width?: number; height?: number } }) => (
      <div data-skia="Canvas" data-size={style ? `${style.width}x${style.height}` : undefined}>
        {children}
      </div>
    ),
    Group: node('Group'),
    Rect: node('Rect'),
    Path: node('Path'),
    Line: node('Line'),
    Circle: node('Circle'),
    Fill: node('Fill'),
    Image: node('Image'),
    LinearGradient: node('LinearGradient'),
    DashPathEffect: node('DashPathEffect'),
    BlurMask: node('BlurMask'),
    Paint: node('Paint'),
    ColorMatrix: node('ColorMatrix'),
    vec: (x: number, y: number) => ({ x, y }),
    rect: (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height }),
    Skia: skiaDouble,
    FilterMode: { Nearest: 0, Linear: 1 },
    MipmapMode: { None: 0, Nearest: 1, Linear: 2 },
    ImageFormat: { JPEG: 3, PNG: 4, WEBP: 6 },
  };
}

/** The drawn pieces of a kind under `root`, each as the props it was given. */
export function drawn(root: Element, kind: string): Array<Record<string, unknown>> {
  return Array.from(root.querySelectorAll(`[data-skia="${kind}"]`)).map((el) => JSON.parse(el.getAttribute('data-props') ?? '{}') as Record<string, unknown>);
}
