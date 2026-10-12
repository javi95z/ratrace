import type { CSSProperties } from 'react';
import manifest from '@/sprites/manifest.json';

type Manifest = Record<string, { src: string; w: number; h: number }>;
const sprites = manifest as Manifest;

/** Sprite ids already reported as missing, so each is logged once. */
const reported = new Set<string>();

export function spriteOf(id: string): { src: string; w: number; h: number } | null {
  return Object.hasOwn(sprites, id) ? sprites[id] : null;
}

interface Props {
  id: string;
  /**
   * Whole screen pixels per art pixel. `art` follows the stage: one on a phone, two where there is room.
   * Sprites are never drawn at a fraction of a pixel.
   */
  scale?: 1 | 2 | 3 | 'art';
  /** What the picture shows, for someone who cannot see it. Leave empty when the text beside it already says so. */
  alt?: string;
  /** The size to reserve when the sprite is missing. */
  fallback?: { w: number; h: number };
  className?: string;
}

/**
 * One pixel-art sprite, drawn pixel for pixel. A sprite that does not exist shows a drawn placeholder
 * and is logged once: the game is fully playable without art (spec section 7).
 */
export function Sprite({ id, scale = 1, alt = '', fallback = { w: 32, h: 32 }, className = '' }: Props) {
  const sprite = spriteOf(id);
  const size = sprite ?? fallback;
  const style: CSSProperties =
    scale === 'art'
      ? { width: `calc(${size.w}px * var(--art))`, height: `calc(${size.h}px * var(--art))` }
      : { width: `${size.w * scale}px`, height: `${size.h * scale}px` };

  if (!sprite) {
    if (!reported.has(id)) {
      reported.add(id);
      console.warn(`sprite missing: ${id}`);
    }
    return (
      <span
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        data-sprite-missing={id}
        style={{
          ...style,
          backgroundImage:
            'linear-gradient(45deg, var(--color-night-600) 25%, transparent 25%, transparent 75%, var(--color-night-600) 75%), linear-gradient(45deg, var(--color-night-600) 25%, var(--color-night-700) 25%, var(--color-night-700) 75%, var(--color-night-600) 75%)',
          backgroundSize: '8px 8px',
          backgroundPosition: '0 0, 4px 4px',
        }}
        className={`inline-block shrink-0 ${className}`}
      />
    );
  }
  return (
    // A plain <img>: sprites are tiny, already final, and must not be resampled by an image optimiser.
    <img
      src={`/sprites/${sprite.src}`}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      width={sprite.w}
      height={sprite.h}
      style={style}
      draggable={false}
      decoding="async"
      className={`sprite inline-block shrink-0 ${className}`}
    />
  );
}
