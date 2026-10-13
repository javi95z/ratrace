'use client';

import { cityArt, cityIcon } from '@ratrace/content';
import type { CityLight } from '@ratrace/content';
import { useWords } from '@/game/context';
import { Sprite, spriteOf } from '@/ui/Sprite';

/** The edges of the skyline step out in three bands, so that it has no hard side against the sky behind it. */
const EDGES =
  'linear-gradient(to right, transparent 0 2%, rgb(0 0 0 / 0.35) 2% 4%, rgb(0 0 0 / 0.7) 4% 6%, black 6% 94%, rgb(0 0 0 / 0.7) 94% 96%, rgb(0 0 0 / 0.35) 96% 98%, transparent 98%)';

/**
 * The city the player lives in, as a banner the width of whatever it sits in. The skyline is drawn
 * pixel for pixel in the middle; behind it the same picture, stretched and dimmed, carries its sky
 * and its lights out to both edges, so the banner is never a small strip with empty sides.
 */
export function CityBanner({ cityId, light = 'night' }: { cityId: string; light?: CityLight }) {
  const { names } = useWords();
  const id = cityArt(cityId, light);
  const sprite = spriteOf(id);

  return (
    <div data-city-light={light} className="frame-double relative mx-1.5 mb-1.5 mt-1 overflow-hidden bg-night-900 leading-[0]" style={{ height: 'calc(66px * var(--art))' }}>
      {sprite ? (
        <div
          aria-hidden
          data-city-sky
          className="absolute inset-0 opacity-40"
          style={{ backgroundImage: `url("/sprites/${sprite.src}")`, backgroundSize: 'cover', backgroundPosition: 'center', imageRendering: 'pixelated' }}
        />
      ) : null}
      <div className="relative flex h-full justify-center" style={{ maskImage: EDGES, WebkitMaskImage: EDGES }}>
        <Sprite id={id} scale="art" alt={names.cities[cityId]} fallback={{ w: 312, h: 66 }} className="max-w-none" />
      </div>
      {/* Where you are, on the picture itself. */}
      <p aria-hidden className="pixel absolute bottom-1.5 left-1.5 flex items-center gap-1.5 bg-night-900/85 py-0.5 pl-0.5 pr-2 text-[15px] uppercase leading-none tracking-[0.08em] text-cream">
        <Sprite id={cityIcon(cityId)} />
        {names.cities[cityId]}
      </p>
    </div>
  );
}
