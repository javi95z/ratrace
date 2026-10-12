'use client';

import { netWorth } from '@ratrace/engine';
import type { GameEvent } from '@ratrace/engine';
import { useGame, useT, useWords } from '@/game/context';
import { ageAt, roundNotes } from '@/game/present';
import type { RoundNote } from '@/game/present';
import { Panel, Row, Well } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';

const NOTE: Record<RoundNote['tone'], string> = {
  gold: 'frame-gold bg-gold-500 text-ink-900',
  good: 'bg-teal-800',
  bad: 'bg-wine-700',
  plain: 'bg-night-700',
};

/** How long each line of the ledger waits for the one before it. */
const ROLL_MS = 80;

/**
 * Two years later: what happened, then the ledger rolling up line by line, then where it leaves
 * the player. Every line is an event the engine sent; nothing is added up here but two net worths.
 */
export function Resolve() {
  const t = useT('resolve');
  const words = useWords();
  const { content, text, fmt } = words;
  const resolved = useGame((s) => s.resolved);
  const view = useGame((s) => s.view);
  if (!resolved || !view) return null;

  const { before, events } = resolved;
  const notes = roundNotes(words, t, events);
  const lines = events.filter((e): e is Extract<GameEvent, { kind: 'ledger' }> => e.kind === 'ledger');
  const worthBefore = netWorth(before.player);
  const worthNow = netWorth(view.player);

  return (
    <div className="flex flex-col gap-3 px-3">
      <div className="text-center">
        <h2 className="pixel text-[22px] text-gold-500">{t('title')}</h2>
        <p className="text-[13px] text-ink-300">{t('ages', { from: ageAt(content, before.round), to: ageAt(content, view.round) })}</p>
      </div>

      {notes.map((note, i) => (
        <div key={i} role="status" className={`frame flex animate-rise items-center gap-3 p-2 ${NOTE[note.tone]}`}>
          <Well className="size-10">
            <Sprite id={note.icon} />
          </Well>
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
                <td className={`pixel whitespace-nowrap py-0.5 text-right ${line.amount >= 0 ? 'text-teal-300' : 'text-wine-300'}`}>{fmt.signed(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel>
        <Row left={t('cashNow')} right={fmt.money(view.player.cash)} />
        <Row
          className="mt-1 border-t-2 border-night-900 pt-2"
          left={<span className="pixel text-[17px]">{t('netWorth')}</span>}
          sub={t('was', { amount: fmt.money(worthBefore), change: fmt.signed(worthNow - worthBefore) })}
          right={<span className="text-[19px] text-gold-500">{fmt.money(worthNow)}</span>}
        />
      </Panel>
    </div>
  );
}
