'use client';

import { Sprite } from './Sprite';

/**
 * The face of a 64-pixel portrait, cut out of it at its own size, never shrunk: in the space of a
 * 32-pixel icon, or of a 44-pixel one for a line of a list.
 */
export function Face({ id, size = 'sm' }: { id: string; size?: 'sm' | 'md' }) {
  return (
    <span aria-hidden className={`inline-flex shrink-0 overflow-hidden ${size === 'md' ? 'size-11' : 'size-8'}`}>
      <Sprite id={id} fallback={{ w: 64, h: 64 }} className={`max-w-none ${size === 'md' ? '-ml-2.5 -mt-1' : '-ml-4 -mt-1.5'}`} />
    </span>
  );
}
