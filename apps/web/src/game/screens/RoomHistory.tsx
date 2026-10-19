'use client';

import { LifeFace } from './LifeFace';

import { useEffect, useState } from 'react';
import { useRoom, useT, useWords } from '@/game/context';
import { memberName } from '@ratrace/core/game/room';
import type { RoomGameOver } from '@ratrace/core/game/room';
import type { FinishedRun } from '@ratrace/core/session/types';
import { Tag } from '@/ui/kit';
import { Sheet } from '@/ui/overlay';
import { RunDetail } from './RunDetail';
import { MemberRat } from './Room';

/** Where the player came in a game over: their place among those who stayed to the end, or null if they left. */
export function placeIn(game: RoomGameOver): { place: number; total: number } | null {
  const stayed = game.players.filter((player) => !player.left);
  const at = stayed.findIndex((player) => player.me);
  return at < 0 ? null : { place: at + 1, total: stayed.length };
}

/** How long a game's rounds were, as the room says it. */
function usePace() {
  const room = useT('room');
  return (seconds: number) => (seconds === 86_400 ? room('day') : seconds >= 3_600 ? room('hours', { n: seconds / 3_600 }) : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`);
}

/**
 * The multiplayer games the player has played to the end, the latest first, a line each with where
 * they came. A tap opens the game: the life, how long its rounds were, the player's own life in it,
 * and everyone with where they ended up, doing what, and with what. `runs` are the player's lives
 * of games with friends this device keeps: shown with their game, or on their own while the
 * server cannot say which games there were.
 */
export function RoomHistory({ runs }: { runs: FinishedRun[] }) {
  const t = useT('records');
  const room = useT('room');
  const common = useT('common');
  const { text, names, fmt } = useWords();
  const pace = usePace();
  const status = useRoom((s) => s.status);
  const history = useRoom((s) => s.history);
  const [games, setGames] = useState<RoomGameOver[] | null>(null);
  const [open, setOpen] = useState<RoomGameOver | null>(null);
  const [openRun, setOpenRun] = useState<FinishedRun | null>(null);
  // Whether the server has answered which games there were: until then nothing is listed, so the list does not change under the player's finger.
  const [asked, setAsked] = useState(false);

  useEffect(() => {
    if (status !== 'in' && status !== 'none') return;
    let live = true;
    void history().then((found) => {
      if (!live) return;
      setGames(found);
      setAsked(true);
    });
    return () => {
      live = false;
    };
  }, [status, history]);

  const lifeName = (lifeId: string) => text.lives[lifeId]?.name ?? lifeId;
  const nameOf = (player: RoomGameOver['players'][number]) => memberName(room, player);
  const runOf = (game: RoomGameOver) => (game.gameId === null ? null : (runs.find((run) => run.runId === game.gameId) ?? null));
  // With no games from the server, the lives this device keeps of them are listed as they are.
  const listed = games !== null && games.length > 0;
  if (!listed && (!asked || runs.length === 0)) return null;
  const where = open ? placeIn(open) : null;
  const mine = open ? runOf(open) : null;

  return (
    <section aria-label={t('multiplayer')}>
      <h2 className="pixel mb-2 text-[15px] uppercase tracking-[0.1em] text-gold-500">{t('multiplayer')}</h2>
      <ul className="flex flex-col gap-1.5">
        {listed
          ? games.map((game) => {
              const place = placeIn(game);
              return (
                <li key={game.id}>
                  <button type="button" aria-haspopup="dialog" onClick={() => setOpen(game)} className="bevel flex min-h-12 w-full items-center gap-3 bg-night-700 px-2 py-1.5 text-left">
                    <LifeFace lifeId={game.lifeId} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="pixel flex items-center gap-1.5 text-[15px]">
                        <span className="truncate">{lifeName(game.lifeId)}</span>
                        {game.rematchOf ? <Tag>{room('rematch')}</Tag> : null}
                      </span>
                      <span className="block text-[12px] text-ink-300">
                        {fmt.day(game.playedAt)} · {t('players', { count: game.players.length })}
                      </span>
                    </span>
                    <span className={`pixel shrink-0 text-[16px] ${place?.place === 1 ? 'text-gold-500' : 'text-ink-200'}`}>{place ? t('placeShort', { place: place.place, total: place.total }) : room('left')}</span>
                  </button>
                </li>
              );
            })
          : runs.map((run) => (
              <li key={run.runId}>
                <button type="button" aria-haspopup="dialog" onClick={() => setOpenRun(run)} className="bevel flex min-h-12 w-full items-center gap-3 bg-night-700 px-2 py-1.5 text-left">
                  <LifeFace lifeId={run.lifeId} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="pixel block truncate text-[15px]">{lifeName(run.lifeId)}</span>
                    <span className="block text-[12px] text-ink-300">{fmt.day(run.finishedAt)}</span>
                  </span>
                  <span className="pixel shrink-0 text-[16px] text-gold-500">{fmt.number(run.score)}</span>
                </button>
              </li>
            ))}
      </ul>

      <Sheet open={open !== null} onClose={() => setOpen(null)} title={open ? lifeName(open.lifeId) : ''} closeLabel={common('close')}>
        {open ? (
          <div className="flex flex-col gap-3">
            {/* The game: when, how long its rounds were, and where the player came. */}
            <div className="flex items-center gap-3">
              <LifeFace lifeId={open.lifeId} size="md" />
              <p className="min-w-0 flex-1 text-[13px] leading-snug text-ink-200">
                {fmt.day(open.playedAt)} · {room('round', { time: pace(open.seconds) })}
                {open.rematchOf ? ` · ${room('rematch')}` : ''}
              </p>
              <span className={`pixel shrink-0 text-[20px] ${where?.place === 1 ? 'text-gold-500' : 'text-ink-200'}`}>{where ? t('placeShort', { place: where.place, total: where.total }) : room('left')}</span>
            </div>
            <ol className="divide-y-2 divide-night-900">
              {open.players.map((player, at) => (
                <li key={`${player.tag}-${at}`} className={`flex min-h-11 items-center gap-3 py-1.5 ${player.left ? 'opacity-60' : ''}`}>
                  <span className="pixel w-5 shrink-0 text-[16px] text-ink-300">{player.left ? '·' : at + 1}</span>
                  {/* The same rat as in the game; a game over told by an older server says nobody's. */}
                  {player.userId !== null ? <MemberRat member={{ userId: player.userId, avatar: player.avatar }} /> : null}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[15px]">{nameOf(player)}</span>
                      {player.me ? <Tag tone="good">{room('you')}</Tag> : null}
                      {player.left ? <span className="text-[12px] text-ink-300">{room('left')}</span> : null}
                    </span>
                    {player.cityId || player.career ? (
                      <span className="block truncate text-[12px] text-ink-300">
                        {[player.cityId ? names.cities[player.cityId] : null, player.career ? text.careers[player.career.id]?.levels[player.career.level] : null].filter(Boolean).join(' · ')}
                      </span>
                    ) : null}
                  </span>
                  {/* Net worth beside the points, in the dollars the life began with, as every record counts it. */}
                  <span className="w-16 shrink-0 text-right text-[13px] tabular-nums text-ink-200">{player.netWorth === null ? '' : fmt.compact(player.netWorth)}</span>
                  <span className="pixel w-12 shrink-0 text-right text-[18px] text-gold-500">{player.score === null ? '—' : fmt.number(player.score)}</span>
                </li>
              ))}
            </ol>
            {/* The player's own life in the game, as this device keeps it. */}
            {mine ? (
              <section aria-label={t('yourLife')} className="border-t-2 border-night-900 pt-2">
                <p className="pixel mb-1 text-[13px] uppercase tracking-wider text-gold-200">{t('yourLife')}</p>
                <RunDetail run={mine} tags={false} />
              </section>
            ) : null}
          </div>
        ) : null}
      </Sheet>
      <Sheet open={openRun !== null} onClose={() => setOpenRun(null)} title={openRun ? lifeName(openRun.lifeId) : ''} closeLabel={common('close')}>
        {openRun ? <RunDetail run={openRun} /> : null}
      </Sheet>
    </section>
  );
}
