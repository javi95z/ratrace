// Skia draws on the phone only (a canvas of the GPU's). Under react-native-web in jsdom each of its pieces is a <div> that
// says what it was asked to draw: its kind, and every plain prop it was given as JSON (a vector, a list of colours, a
// transform, a path as the SVG string it is). Sprite.test keeps its own, older stand-in, which names a few props only.
import type { ReactNode } from 'react';

type Props = Record<string, unknown> & { children?: ReactNode };

const node =
  (kind: string) =>
  ({ children, ...props }: Props) => (
    <div data-skia={kind} data-props={JSON.stringify(props)}>
      {children}
    </div>
  );

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
    LinearGradient: node('LinearGradient'),
    DashPathEffect: node('DashPathEffect'),
    vec: (x: number, y: number) => ({ x, y }),
  };
}

/** The drawn pieces of a kind under `root`, each as the props it was given. */
export function drawn(root: Element, kind: string): Array<Record<string, unknown>> {
  return Array.from(root.querySelectorAll(`[data-skia="${kind}"]`)).map((el) => JSON.parse(el.getAttribute('data-props') ?? '{}') as Record<string, unknown>);
}
