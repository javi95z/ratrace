'use client';

import { loopArt } from '@ratrace/content';
import type { Loop as LoopName } from '@ratrace/content';
import { useEffect, useState } from 'react';
import { useSettings } from '@/game/context';
import { Sprite } from '@/ui/Sprite';

/**
 * A few frames played over and over: a coin turning, the wheel, confetti. It is decoration and says
 * nothing a screen reader needs. With motion reduced it stands still on its first frame.
 */
export function Loop({ name, ms = 150, scale = 1, className }: { name: LoopName; ms?: number; scale?: 1 | 2 | 3; className?: string }) {
  const { reducedMotion } = useSettings();
  const frames = loopArt(name);
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (reducedMotion) return;
    const timer = setInterval(() => setFrame((at) => (at + 1) % frames.length), ms);
    return () => clearInterval(timer);
  }, [reducedMotion, frames.length, ms]);
  return <Sprite id={frames[reducedMotion ? 0 : frame]} scale={scale} fallback={{ w: 48, h: 48 }} className={className} />;
}
