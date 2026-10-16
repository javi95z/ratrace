'use client';

import { netWorth } from '@ratrace/engine';
import type { GameEvent } from '@ratrace/engine';
import { useEffect, useRef, useState } from 'react';
import { useGame, useT, useWords } from '@/game/context';
import { useCountUp, useStill } from '@/game/motion';
import { ageAt, roundNotes } from '@/game/present';
import { bankQuip, familyQuip, ratOutfit } from '@/game/quips';
import type { RoundNote } from '@/game/present';
import { Bare, Panel, Row } from '@/ui/kit';
import { Celebrations } from './Celebrations';
import { Sparks } from '@/ui/Sparks';
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
  // A span cannot carry a label: the amount it ends on is read from hidden words, not the figure counting up.
  return (
    <span data-coin-to>
      <span className="sr-only">{fmt.money(to)}</span>
      <span aria-hidden>{fmt.money(shown)}</span>
    </span>
  );
}

/** How long net worth takes to count to where the round left it. */
const WORTH_MS = 1100;

/**
 * Where the round leaves the player, made to be felt: net worth counts from what it was to what it
 * is, lands with a jump (or sinks, in red), and says by how much. Where motion is left out, it stands where it ends at once.
 */
function WorthRise({ from, to, delay }: { from: number; to: number; delay: number }) {
  const t = useT('resolve');
  const { fmt } = useWords();
  const still = useStill();
  const shown = useCountUp(to, { from, delay, ms: WORTH_MS });
  const [landed, setLanded] = useState(still);
  useEffect(() => {
    if (still) return setLanded(true);
    const timer = setTimeout(() => setLanded(true), delay + WORTH_MS);
    return () => clearTimeout(timer);
  }, [still, delay]);
  const change = to - from;
  const up = change >= 0;

  return (
    <div className="mt-1 border-t-2 border-night-900 pt-3">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="pixel text-[17px]">{t('netWorth')}</p>
          <p className="text-[12px] text-ink-300">{t('before', { amount: fmt.money(from) })}</p>
        </div>
        <div className="relative flex flex-col items-end">
          <span className={`pixel block text-[28px] leading-none ${landed && !up ? 'text-wine-300' : 'text-gold-500'} ${landed && change !== 0 ? (up ? 'animate-pop' : 'animate-sink') : ''}`}>
            <span className="sr-only">{fmt.money(to)}</span>
            <span aria-hidden>{fmt.money(shown)}</span>
          </span>
          <span className={`pixel mt-1 px-1.5 text-[14px] ${landed ? 'animate-rise' : 'invisible'} ${up ? 'bg-teal-800 text-teal-300' : 'bg-wine-900 text-wine-300'}`}>{fmt.signed(change)}</span>
          {landed && !still && change > 0 ? <Sparks colours={['bg-gold-500', 'bg-gold-200', 'bg-cream']} count={12} reach={48} /> : null}
        </div>
      </div>
    </div>
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
        <WorthRise from={worthBefore} to={worthNow} delay={rolled + 450 + 800} />
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
