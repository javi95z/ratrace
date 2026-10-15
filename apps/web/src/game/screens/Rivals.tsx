'use client';

import { useT, useWords } from '@/game/context';
import { useRivals } from '@/game/useRivals';
import { Panel } from '@/ui/kit';

/**
 * Where the life stands beside the lives of the player's rivals: everyone by net worth, in the dollars
 * of age 22, the player among them, and the place they hold. At the end of a life, where it ended.
 */
export function RivalsBoard({ history }: { history: number[] }) {
  const t = useT('rivals');
  const { fmt } = useWords();
  const people = useRivals();
  if (!people || history.length === 0) return null;
  const last = history.length - 1;
  const rows = [
    { key: 'you', name: t('you'), worth: history[last], you: true },
    ...people.rivals.map((rival) => ({ key: rival.id, name: people.who(rival), worth: rival.worth[last] ?? 0, you: false })),
  ].sort((a, b) => b.worth - a.worth);
  const place = rows.findIndex((row) => row.you) + 1;
  return (
    <Panel title={t('title')} label={t('title')}>
      <p className="pixel text-[20px] text-gold-500">{t('place', { n: place, of: rows.length })}</p>
      <p className="mb-2 text-[12px] leading-snug text-ink-300">{t('about')}</p>
      <ol>
        {rows.map((row, i) => (
          <li key={row.key} className={`flex items-baseline justify-between gap-3 border-t-2 border-night-900 py-1.5 first:border-t-0 ${row.you ? 'text-gold-500' : ''}`}>
            <span className="min-w-0 truncate">
              <span className="pixel mr-2 text-ink-300">{i + 1}</span>
              <span className={row.you ? 'pixel text-[16px]' : 'text-[14px]'}>{row.name}</span>
            </span>
            <span className="pixel shrink-0 text-[15px]">{fmt.compact(row.worth)}</span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
