'use client';

import { momentArt } from '@ratrace/content';
import { escapeProgress, realNetWorth } from '@ratrace/engine';
import type { GameView } from '@ratrace/engine';
import { useState } from 'react';
import { useGame, useT, useWords } from '@/game/context';
import { momentsOf } from '@ratrace/core/game/moments';
import type { Moment } from '@ratrace/core/game/moments';
import { ageAt, escapeAge } from '@ratrace/core/game/present';
import { Button, Row } from '@/ui/kit';
import { Sheet } from '@/ui/overlay';
import { Sprite } from '@/ui/Sprite';
import { CrisisDetails } from './Crisis';

/** Where each piece of confetti starts across the sheet, in percent, and how long it waits. Fixed, so it falls the same every time. */
const CONFETTI: ReadonlyArray<readonly [left: number, delayMs: number, colour: string]> = [
  [4, 0, 'bg-gold-500'], [12, 260, 'bg-cream'], [20, 90, 'bg-gold-200'], [28, 420, 'bg-teal-300'], [36, 30, 'bg-gold-500'], [44, 310, 'bg-gold-200'],
  [52, 150, 'bg-cream'], [60, 480, 'bg-gold-500'], [68, 60, 'bg-teal-300'], [76, 350, 'bg-gold-200'], [84, 200, 'bg-gold-500'], [92, 110, 'bg-cream'],
];

/** Gold falling over good news. Decoration only: it says nothing a screen reader needs. */
function Confetti() {
  return (
    <div aria-hidden data-confetti className="pointer-events-none absolute inset-x-0 top-0 h-0">
      {CONFETTI.map(([left, delay, colour]) => (
        <span key={left} className={`absolute size-2 animate-fall ${colour}`} style={{ left: `${left}%`, animationDelay: `${delay}ms` }} />
      ))}
    </div>
  );
}

/** What each moment says, in the figures the game gave. */
function Body({ moment, view }: { moment: Moment; view: GameView }) {
  const t = useT('moments');
  const { content, fmt } = useWords();
  const age = ageAt(content, view.round);
  const years = content.yearsPerRound;

  switch (moment.kind) {
    case 'escape': {
      const escape = escapeProgress(content, view);
      return (
        <>
          <p className="text-[15px] leading-snug">{t('escape.body', { age: escapeAge(content, moment.round) })}</p>
          <div className="frame bg-night-900 px-3 py-1">
            <Row left={t('escape.passive')} right={<span className="text-teal-300">{t('perYear', { amount: fmt.money(Math.floor(escape.passiveAfterTax / years)) })}</span>} />
            <Row left={t('escape.costs')} right={t('perYear', { amount: fmt.money(Math.floor(escape.outgoings / years)) })} />
          </div>
          <p className="text-[13px] text-ink-300">{t('escape.hint')}</p>
        </>
      );
    }
    case 'million':
      return (
        <>
          <p className="text-[15px] leading-snug">{t('million.body', { age })}</p>
          <div className="frame bg-night-900 px-3 py-1">
            <Row left={t('million.worth')} right={<span className="text-gold-500">{fmt.money(realNetWorth(view))}</span>} />
          </div>
          <p className="text-[13px] text-ink-300">{t('million.hint')}</p>
        </>
      );
    case 'bankrupt':
      return (
        <>
          <p className="text-[15px] leading-snug">{t('bankrupt.body', { age })}</p>
          <div className="frame bg-night-900 px-3 py-1">
            <Row left={t('bankrupt.sold')} right={fmt.money(moment.proceeds)} />
            <Row left={t('bankrupt.cleared')} right={<span className="text-teal-300">{fmt.money(moment.debtsCleared)}</span>} />
            <Row left={t('bankrupt.status')} right={<span className="text-wine-300">−{fmt.number(content.debt.bankruptcyStatusPenalty)}</span>} />
          </div>
          <p className="text-[13px] text-ink-300">{t('bankrupt.hint', { age: ageAt(content, view.player.bankruptUntilRound) })}</p>
        </>
      );
    case 'crisis': {
      const crisis = view.timeline[view.round]?.crisis;
      return crisis ? <CrisisDetails crisis={crisis} /> : null;
    }
  }
}

/**
 * The moment the screen stops for: out of the rat race, the first million, bankruptcy, a crisis
 * opening. Each has the screen to itself, with its picture, until the player moves on; then the
 * round goes on underneath as it was. Which moments are due is not decided here.
 */
export function Moments() {
  const t = useT('moments');
  const common = useT('common');
  const { text } = useWords();
  const stage = useGame((s) => s.stage);
  const view = useGame((s) => s.view);
  const resolved = useGame((s) => s.resolved);
  const story = useGame((s) => s.story);
  const gameId = useGame((s) => s.gameId);
  // The moments already taken in, by life and by key: one is never shown twice.
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());
  if (!view) return null;

  const moment = momentsOf({ stage, view, resolved, story }).find((candidate) => !done.has(`${gameId}:${candidate.key}`));
  if (!moment) return null;
  const close = () => setDone((seen) => new Set(seen).add(`${gameId}:${moment.key}`));
  const good = moment.kind === 'escape' || moment.kind === 'million';
  const title = moment.kind === 'crisis' ? text.crises[moment.crisisId].name : t(`${moment.kind}.title`);
  const art = momentArt[moment.kind === 'crisis' ? moment.crisisId : moment.kind];

  return (
    <Sheet open onClose={close} title={title} closeLabel={common('close')} tone={good ? 'gold' : 'wine'}>
      <div data-moment={moment.kind} className="relative flex flex-col gap-3">
        {good ? <Confetti /> : null}
        <p className={`pixel -mt-2 text-[13px] uppercase tracking-[0.14em] ${good ? 'text-gold-500' : 'text-wine-300'}`}>
          {moment.kind === 'crisis' ? t('crisis.kicker', { rounds: moment.rounds }) : t(`${moment.kind}.kicker`)}
        </p>
        <div className="frame mx-auto max-w-full overflow-hidden bg-night-900 leading-[0]">
          <Sprite id={art} fallback={{ w: 288, h: 120 }} className="max-w-full animate-reveal" />
        </div>
        <Body moment={moment} view={view} />
        <Button variant={good ? 'primary' : 'secondary'} wide onClick={close}>
          {t(`${moment.kind}.go`)}
        </Button>
      </div>
    </Sheet>
  );
}
