'use client';

import { useRoomPaper } from '@/game/roomStory';
import { scoreBreakdown } from '@ratrace/engine';
import { useGame, useT, useWords } from '@/game/context';
import { rivalScore } from '@ratrace/core/game/rivals';
import { useRivals } from '@/game/useRivals';
import { Panel } from '@/ui/kit';

/**
 * Where the life stands beside the lives of the player's rivals, by score, as the game counts it:
 * the points of wealth and of status. The rivals have no status of the game's own, so each counts
 * the standing of the life they live. While the life goes on it says where the player is; at the
 * end, where they came.
 */
export function RivalsBoard({ history }: { history: number[] }) {
  const t = useT('rivals');
  const { content, fmt } = useWords();
  const view = useGame((s) => s.view);
  const people = useRivals();
  // In a game with friends the rivals are the other players, and the room's order is theirs: no made-up ones.
  const room = useRoomPaper();
  if (room !== null || !people || !view || history.length === 0) return null;
  const last = history.length - 1;
  const rows = [
    { key: 'you', name: t('you'), score: scoreBreakdown(content, view).total, you: true },
    ...people.rivals.map((rival) => ({
      key: rival.id,
      name: people.who(rival),
      score: rivalScore(content, rival, last),
      you: false,
    })),
  ].sort((a, b) => b.score - a.score || (a.you ? -1 : b.you ? 1 : 0));
  const place = rows.findIndex((row) => row.you) + 1;
  return (
    <Panel title={t('title')} label={t('title')}>
      <p className="pixel text-[20px] text-gold-500">{t(view.finished ? 'placeEnd' : 'placeNow', { n: place, of: rows.length })}</p>
      <p className="mb-2 text-[12px] leading-snug text-ink-300">{t('about')}</p>
      <ol>
        {rows.map((row, i) => (
          <li key={row.key} className={`flex items-baseline justify-between gap-3 border-t-2 border-night-900 py-1.5 first:border-t-0 ${row.you ? 'text-gold-500' : ''}`}>
            <span className="min-w-0 truncate">
              <span className="pixel mr-2 text-ink-300">#{i + 1}</span>
              <span className={row.you ? 'pixel text-[16px]' : 'text-[14px]'}>{row.name}</span>
            </span>
            <span className="pixel shrink-0 text-[15px]">{t('points', { n: fmt.number(row.score) })}</span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
