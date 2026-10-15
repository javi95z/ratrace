import type { CSSProperties } from 'react';

/**
 * Square sparks thrown out from the middle of what they sit on, once: a burst for something won or
 * bought. Decoration only, and only movement, so it is not drawn where motion is left out.
 */
export function Sparks({ count = 8, reach = 28, colours, delayMs = 0, size = 3 }: { count?: number; reach?: number; colours: readonly string[]; delayMs?: number; size?: number }) {
  return (
    <span aria-hidden data-motion-only className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0">
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * 2 * Math.PI + Math.PI / count;
        // Every other spark flies a little shorter, so the burst does not read as a ring.
        const far = reach * (i % 2 === 0 ? 1 : 0.7);
        return (
          <span
            key={i}
            className={`absolute animate-spark ${colours[i % colours.length]}`}
            style={
              {
                width: size,
                height: size,
                left: -size / 2,
                top: -size / 2,
                animationDelay: `${delayMs + (i % 3) * 40}ms`,
                '--sx': `${Math.round(Math.cos(angle) * far)}px`,
                '--sy': `${Math.round(Math.sin(angle) * far)}px`,
              } as CSSProperties
            }
          />
        );
      })}
    </span>
  );
}
