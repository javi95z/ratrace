'use client';

import { Sprite } from './Sprite';

/** The face of a 64-pixel portrait in the space of a 32-pixel icon: the middle of it, not shrunk. */
export function Face({ id }: { id: string }) {
  return (
    <span aria-hidden className="inline-flex size-8 shrink-0 overflow-hidden">
      <Sprite id={id} fallback={{ w: 64, h: 64 }} className="-ml-4 -mt-1.5 max-w-none" />
    </span>
  );
}
