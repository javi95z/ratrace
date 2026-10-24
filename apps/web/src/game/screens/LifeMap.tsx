'use client';

import { lives, MAP_ART, MAP_PLACES } from '@ratrace/content';
import type { Milestone } from '@ratrace/content';
import { spriteOf } from '@/ui/Sprite';

/** The cities a life lived in, in the order it came to them: where it began, then every move. */
export function routeOf(lifeId: string, story: readonly Milestone[]): string[] {
  const start = lives.find((life) => life.id === lifeId)?.start.cityId;
  const route = start ? [start] : [];
  for (const m of story) if (m.kind === 'moved' && route[route.length - 1] !== m.cityId) route.push(m.cityId);
  return route;
}

/**
 * The world at night with the way a life went across it: a gold line from city to city, a light
 * on each one lived in, the last brightest. Drawn as wide as there is room, up to the map's own size.
 */
export function LifeMap({ route, label }: { route: readonly string[]; label: string }) {
  const map = spriteOf(MAP_ART);
  const places = route.map((city) => MAP_PLACES[city]).filter((place): place is { x: number; y: number } => place !== undefined);
  if (!map || places.length === 0) return null;
  const ratio = map.h / map.w;
  return (
    <figure role="img" aria-label={label} className="relative mx-auto w-full overflow-hidden border-2 border-night-900" style={{ maxWidth: map.w }}>
      {/* The pixels of the map stay square at any width. */}
      <img src={`/sprites/${map.src}`} alt="" aria-hidden className="block h-auto w-full [image-rendering:pixelated]" draggable={false} />
      <svg aria-hidden viewBox={`0 0 100 ${100 * ratio}`} className="absolute inset-0 size-full">
        {places.length > 1 ? (
          <polyline
            points={places.map((place) => `${place.x * 100},${place.y * 100 * ratio}`).join(' ')}
            fill="none"
            stroke="var(--color-gold-500)"
            strokeWidth={0.6}
            strokeDasharray="1.2 0.8"
            strokeLinejoin="round"
          />
        ) : null}
        {places.map((place, i) => (
          <rect
            key={i}
            x={place.x * 100 - (i === places.length - 1 ? 1.4 : 0.9)}
            y={place.y * 100 * ratio - (i === places.length - 1 ? 1.4 : 0.9)}
            width={i === places.length - 1 ? 2.8 : 1.8}
            height={i === places.length - 1 ? 2.8 : 1.8}
            fill={i === places.length - 1 ? 'var(--color-cream)' : 'var(--color-gold-500)'}
            stroke="var(--color-night-900)"
            strokeWidth={0.3}
          />
        ))}
      </svg>
    </figure>
  );
}
