'use client';

import { careerArt, cityIcon, GIFT_ART, HANDOVER_ART, RETIRED_ART } from '@ratrace/content';
import type { Milestone } from '@ratrace/content';
import type { GameView } from '@ratrace/engine';
import { useEffect, useState } from 'react';
import { useT, useWords } from '@/game/context';
import { chapters } from '@/game/epilogue';
import { useStill } from '@/game/motion';
import { ageAt } from '@/game/present';
import { ratOutfit } from '@/game/quips';
import { Bare, Panel } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';
import { Loop } from './Loop';

/** How long the rat takes to run the whole of a life. */
const RUN_MS = 3_000;

/** The sign of each kind of milestone. */
function iconOf(m: Milestone): string {
  switch (m.kind) {
    case 'promoted':
    case 'career':
      return careerArt(m.careerId);
    case 'moved':
      return cityIcon(m.cityId);
    case 'retired':
      return RETIRED_ART.icon;
    case 'gift':
      return GIFT_ART;
    case 'soldBusiness':
      return HANDOVER_ART;
    case 'jobLost':
      return 'icon.job';
    case 'partner':
      return 'icon.partner';
    case 'split':
      return 'icon.single';
    case 'child':
      return 'icon.baby';
    case 'home':
      return 'icon.property';
    case 'business':
      return 'icon.business';
    case 'escaped':
      return 'icon.star';
    case 'bankrupt':
      return 'icon.loan';
    case 'escapeLost':
    case 'crisis':
      return 'icon.economy';
    case 'worth':
      return 'icon.gold';
  }
}

/** A milestone in a few words, with what it needs from the game's names. */
function useLabel(): (m: Milestone) => string {
  const t = useT('end.line');
  const { text, names, fmt } = useWords();
  return (m) => {
    switch (m.kind) {
      case 'promoted':
        return t(m.top ? 'top' : 'promoted', { title: text.careers[m.careerId].levels[m.level] });
      case 'career':
        return t('career', { career: text.careers[m.careerId].name });
      case 'moved':
        return t('moved', { city: names.cities[m.cityId] });
      case 'child':
        return t(m.first ? 'firstChild' : 'child');
      case 'home':
        return t('home', { home: text.propertyTypes[m.typeId] });
      case 'crisis':
        return t('crisis', { crisis: text.crises[m.crisisId].name });
      case 'worth':
        return t('worth', { amount: fmt.compact(m.mark) });
      default:
        return t(m.kind);
    }
  };
}

/**
 * A life on one line: from the first age to the last, the rat in its wheel rolls along it once, and
 * each milestone lights as it passes. Under the line, the same milestones in words, for reading and
 * for a screen reader. Where motion is left out, the rat is at the end and every milestone is lit.
 */
export function LifeLine({ view, story }: { view: GameView; story: readonly Milestone[] }) {
  const t = useT('end');
  const { content } = useWords();
  const still = useStill();
  const label = useLabel();
  const told = chapters(story);
  const last = Math.max(1, view.round);
  const at = (round: number) => `${Math.min(100, (round / last) * 100)}%`;
  // The rat starts at the first age and is sent on its way once it has been drawn there.
  const [running, setRunning] = useState(still);
  useEffect(() => {
    if (still) return;
    const frame = requestAnimationFrame(() => setRunning(true));
    return () => cancelAnimationFrame(frame);
  }, [still]);

  return (
    <Panel title={t('lifeLine')} label={t('lifeLine')}>
      <div aria-hidden className="relative mx-6 mb-2 mt-[96px] h-1 bg-night-900">
        {told.map((m, i) => (
          <span
            key={i}
            className="absolute -top-[92px] -ml-4 animate-light"
            style={{ left: at(m.round), animationDelay: still ? '0ms' : `${Math.round((m.round / last) * RUN_MS)}ms` }}
          >
            <Bare className="size-8">
              <Sprite id={iconOf(m)} />
            </Bare>
            <span className="absolute left-1/2 top-8 h-[56px] w-0.5 -translate-x-1/2 bg-gold-700/60" />
          </span>
        ))}
        <span
          className="absolute -top-12 -ml-6 transition-[left] ease-linear"
          style={{ left: running ? '100%' : '0%', transitionDuration: still ? '0ms' : `${RUN_MS}ms`, transitionTimingFunction: `steps(${Math.max(8, last * 2)}, end)` }}
        >
          <Loop name="wheel" outfit={ratOutfit(view)} ms={110} />
        </span>
      </div>
      <div className="mx-1 flex justify-between text-[12px] text-ink-300">
        <span>{t('lineAge', { age: ageAt(content, 0) })}</span>
        <span>{t('lineAge', { age: ageAt(content, view.round) })}</span>
      </div>
      {told.length === 0 ? (
        <p className="mt-2 text-[13px] text-ink-300">{t('lineQuiet')}</p>
      ) : (
        <ol className="mt-3 flex flex-col gap-1.5">
          {told.map((m, i) => (
            <li key={i} className="flex items-center gap-2 text-[13px]">
              <span className="pixel w-9 shrink-0 text-right text-gold-500">{ageAt(content, m.round)}</span>
              <span className="min-w-0 text-ink-200">{label(m)}</span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
