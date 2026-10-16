'use client';

import { portraitArt } from '@ratrace/content';
import { useEffect, useState } from 'react';
import { useRoom, useT, useWords } from '@/game/context';
import type { RoomGameOver } from '@/game/room';
import { Tag, Well } from '@/ui/kit';
import { Sheet } from '@/ui/overlay';
import { Sprite } from '@/ui/Sprite';

/** Where the player came in a game over: their place among those who stayed to the end, or null if they left. */
export function placeIn(game: RoomGameOver): { place: number; total: number } | null {
  const stayed = game.players.filter((player) => !player.left);
  const at = stayed.findIndex((player) => player.me);
  return at < 0 ? null : { place: at + 1, total: stayed.length };
}

/**
 * The multiplayer games the player has played to the end, the latest first, each with where they
 * came; everyone in it, with their score, in a sheet. Only there for a player whose account the
 * server can be asked about, and only once they have played one.
 */
export function RoomHistory() {
  const t = useT('records');
  const room = useT('room');
  const common = useT('common');
  const { text, fmt } = useWords();
  const status = useRoom((s) => s.status);
  const history = useRoom((s) => s.history);
  const [games, setGames] = useState<RoomGameOver[] | null>(null);
  const [open, setOpen] = useState<RoomGameOver | null>(null);

  useEffect(() => {
    if (status !== 'in' && status !== 'none') return;
    let live = true;
    void history().then((found) => live && setGames(found));
    return () => {
      live = false;
    };
  }, [status, history]);

  if (games === null || games.length === 0) return null;
  const lifeName = (game: RoomGameOver) => text.lives[game.lifeId]?.name ?? game.lifeId;
  const nameOf = (player: RoomGameOver['players'][number]) => player.name ?? room('nameless', { tag: player.tag });

  return (
    <section aria-label={t('multiplayer')}>
      <h2 className="pixel mb-2 text-[15px] uppercase tracking-[0.1em] text-gold-500">{t('multiplayer')}</h2>
      <ul className="flex flex-col gap-2">
        {games.map((game) => {
          const where = placeIn(game);
          return (
            <li key={game.id}>
              <button type="button" onClick={() => setOpen(game)} className="bevel flex w-full items-center gap-3 bg-night-700 p-2 text-left">
                <Well className="size-[52px] shrink-0">
                  <Sprite id={portraitArt(game.lifeId, 22)} fallback={{ w: 64, h: 64 }} />
                </Well>
                <span className="min-w-0 flex-1">
                  <span className="pixel flex flex-wrap items-center gap-x-2 text-[16px]">
                    {lifeName(game)}
                    {game.rematchOf ? <Tag>{room('rematch')}</Tag> : null}
                  </span>
                  <span className="block text-[12px] text-ink-300">
                    {fmt.day(game.playedAt)} · {t('players', { count: game.players.length })}
                  </span>
                </span>
                <span className={`pixel shrink-0 text-[17px] ${where?.place === 1 ? 'text-gold-500' : 'text-ink-200'}`}>{where ? t('placeShort', { place: where.place, total: where.total }) : room('left')}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <Sheet open={open !== null} onClose={() => setOpen(null)} title={open ? lifeName(open) : ''} closeLabel={common('close')}>
        {open ? (
          <ol className="divide-y-2 divide-night-900">
            {open.players.map((player, at) => (
              <li key={`${player.tag}-${at}`} className={`flex min-h-11 items-center gap-3 py-1.5 ${player.left ? 'opacity-60' : ''}`}>
                <span className="pixel w-5 shrink-0 text-[16px] text-ink-300">{player.left ? '·' : at + 1}</span>
                <span className="flex min-w-0 flex-1 items-center gap-1.5">
                  <span className="truncate text-[15px]">{nameOf(player)}</span>
                  {player.me ? <Tag tone="good">{room('you')}</Tag> : null}
                  {player.left ? <span className="text-[12px] text-ink-300">{room('left')}</span> : null}
                </span>
                <span className="pixel shrink-0 text-[18px] text-gold-500">{player.score === null ? '—' : fmt.number(player.score)}</span>
              </li>
            ))}
          </ol>
        ) : null}
      </Sheet>
    </section>
  );
}
