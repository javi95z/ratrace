'use client';

import { netWorth } from '@ratrace/engine';
import type { GameEvent } from '@ratrace/engine';
import { useRef } from 'react';
import { useGame, useT, useWords } from '@/game/context';
import { useCountUp } from '@/game/motion';
import { ageAt, roundNotes } from '@/game/present';
import { bankQuip, familyQuip, ratOutfit } from '@/game/quips';
import type { RoundNote } from '@/game/present';
import { Bare, Panel, Row } from '@/ui/kit';
import { Celebrations } from './Celebrations';
import { Sprite } from '@/ui/Sprite';
import { FlyingCoins } from './FlyingCoins';
import { Loop } from './Loop';

const NOTE: Record<RoundNote['tone'], string> = {
  gold: 'frame-gold bg-gold-500 text-ink-900',
  good: 'bg-teal-800',
  bad: 'bg-wine-700',
  plain: 'bg-night-700',
};

/** How long each line of the ledger waits for the one before it. */
const ROLL_MS = 80;
/** How long a line takes to rise into place. */
const RISE_MS = 280;

/** Money that came in on its own: it flies to the cash as coins once the ledger has rolled. */
const PASSIVE: ReadonlySet<string> = new Set(['dividends', 'interest', 'rent', 'otherPassive', 'business']);

/** The cash after the round, counted up from what it was as the coins land. */
function CashCount({ from, to, delay }: { from: number; to: number; delay: number }) {
  const { fmt } = useWords();
  const shown = useCountUp(to, { from, delay, ms: 800 });
  return (
    <span data-coin-to aria-label={fmt.money(to)}>
      <span aria-hidden>{fmt.money(shown)}</span>
    </span>
  );
}

/**
 * Two years later: what happened, then the ledger rolling up line by line, then where it leaves
 * the player. Every line is an event the engine sent; nothing is added up here but two net worths.
 */
export function Resolve() {
  const t = useT('resolve');
  const crisis = useT('crisis');
  const words = useWords();
  const { content, text, fmt } = words;
  const resolved = useGame((s) => s.resolved);
  const view = useGame((s) => s.view);
  const area = useRef<HTMLDivElement>(null);
  if (!resolved || !view) return null;

  const { before, events } = resolved;
  const notes = roundNotes(words, t, events);
  const lines = events.filter((e): e is Extract<GameEvent, { kind: 'ledger' }> => e.kind === 'ledger');
  // A crisis that was on when the round was played and is not now has just ended.
  const ended = before.timeline[before.round]?.crisis && !view.timeline[view.round]?.crisis ? before.timeline[before.round].crisis : null;
  const worthBefore = netWorth(before.player);
  const worthNow = netWorth(view.player);
  const bank = bankQuip(before, view, events);
  const family = familyQuip(content, before, view);
  // The coins leave once every line of the ledger is in place, and the cash counts as they land.
  const rolled = lines.length * ROLL_MS + RISE_MS;

  return (
    <div ref={area} className="relative flex flex-col gap-3 px-3">
      <FlyingCoins area={area} startMs={rolled} />
      <div className="text-center">
        {/* Two years go by: the wheel turns. */}
        <h2 className="pixel flex items-center gap-2 text-[22px] text-gold-500">
          <Loop name="wheel" outfit={ratOutfit(view)} />
          {t('title')}
        </h2>
        <p className="text-[13px] text-ink-300">{t('ages', { from: ageAt(content, before.round), to: ageAt(content, view.round) })}</p>
      </div>

      <Celebrations />
      {ended ? (
        <div role="status" className="frame flex animate-rise items-center gap-3 bg-teal-800 p-2">
          <Bare className="size-10">
            <Sprite id="icon.economy" />
          </Bare>
          <div className="min-w-0">
            <p className="pixel text-[17px]">{crisis('over', { crisis: text.crises[ended.id].name })}</p>
            <p className="text-[13px] leading-snug">{crisis('overHint')}</p>
          </div>
        </div>
      ) : null}
      {notes.map((note, i) => (
        <div key={i} role="status" className={`frame flex animate-rise items-center gap-3 p-2 ${NOTE[note.tone]}`}>
          <Bare className="relative size-10">
            <Sprite id={note.icon} />
            {note.cheer ? <Loop name="confetti" className="absolute -inset-1" /> : null}
          </Bare>
          <div className="min-w-0">
            <p className="pixel text-[17px]">{note.title}</p>
            {note.hint ? <p className="text-[13px] leading-snug">{note.hint}</p> : null}
          </div>
        </div>
      ))}

      <Panel>
        <table aria-label={t('ledger')} className="w-full text-[14px]">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="animate-rise" style={{ animationDelay: `${i * ROLL_MS}ms` }}>
                <th scope="row" className="py-0.5 pr-3 text-left font-normal">
                  {text.ledger[line.line]}
                </th>
                <td data-coin-from={PASSIVE.has(line.line) && line.amount > 0 ? '' : undefined} className={`pixel whitespace-nowrap py-0.5 text-right ${line.amount >= 0 ? 'text-teal-300' : 'text-wine-300'}`}>
                  {fmt.signed(line.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel>
        <Row
          left={
            <span className="flex items-center gap-2">
              <Loop name="coin" />
              {t('cashNow')}
            </span>
          }
          right={<CashCount from={before.player.cash} to={view.player.cash} delay={rolled + 450} />}
        />
        <Row
          className="mt-1 border-t-2 border-night-900 pt-2"
          left={<span className="pixel text-[17px]">{t('netWorth')}</span>}
          sub={t('was', { amount: fmt.money(worthBefore), change: fmt.signed(worthNow - worthBefore) })}
          right={<span className="text-[19px] text-gold-500">{fmt.money(worthNow)}</span>}
        />
      </Panel>

      {/* What is said of the two years, by the bank and at the family's table: for a smile, it changes nothing. */}
      <Panel>
        <dl className="flex flex-col gap-2 text-[13px] leading-snug">
          {bank ? (
            <div>
              <dt className="pixel text-[12px] uppercase tracking-wider text-gold-200">{t('bank.title')}</dt>
              <dd className="italic text-ink-200">{t(`bank.${bank}`)}</dd>
            </div>
          ) : null}
          <div>
            <dt className="pixel text-[12px] uppercase tracking-wider text-gold-200">{t('family.title')}</dt>
            <dd className="italic text-ink-200">{t(`family.${family}`)}</dd>
          </div>
        </dl>
      </Panel>
    </div>
  );
}
