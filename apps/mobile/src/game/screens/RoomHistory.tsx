import { memberName } from '@ratrace/core/game/room';
import type { RoomGameOver } from '@ratrace/core/game/room';
import type { FinishedRun } from '@ratrace/core/session/types';
import { memo, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Framed } from '../../ui/Frame';
import { Tag, usePress } from '../../ui/kit';
import { Sheet } from '../../ui/overlay';
import { PixelText, ReadText, SNUG } from '../../ui/text';
import { COLORS } from '../../ui/theme';
import { useRoom, useT, useWords } from '../context';
import { Heading } from './Heading';
import { LifeFace } from './LifeFace';
import { MemberRat } from './Room';
import { RunDetail } from './RunDetail';

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

/** A line of the list, as the web's (`bevel … bg-night-700 px-2 py-1.5`, at least 48 high): the life's face, its name and what is under it, and a figure. */
function Line({ lifeId, name, tag, sub, figure, gold }: { lifeId: string; name: string; tag?: string; sub: string; figure: string; gold: boolean }) {
  return (
    <Framed kind="bevel" style={{ backgroundColor: COLORS['night-700'], minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, paddingVertical: 6 }}>
      <LifeFace lifeId={lifeId} size="md" />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <PixelText size={15} numberOfLines={1} style={{ flexShrink: 1 }}>{name}</PixelText>
          {tag ? <Tag item>{tag}</Tag> : null}
        </View>
        <ReadText size={12} tone="ink-300">{sub}</ReadText>
      </View>
      <PixelText size={16} tone={gold ? 'gold-500' : 'ink-200'} style={{ flexShrink: 0 }}>{figure}</PixelText>
    </Framed>
  );
}

/** A game over: the whole of it a tap away, in a sheet. */
const GameLine = memo(function GameLine({ id, lifeId, name, tag, sub, figure, gold, onOpen }: { id: string; lifeId: string; name: string; tag?: string; sub: string; figure: string; gold: boolean; onOpen(id: string): void }) {
  const press = usePress({ onPress: () => onOpen(id) });
  return (
    <View role="listitem">
      <Pressable accessibilityRole="button" onPress={press}>
        <Line lifeId={lifeId} name={name} tag={tag} sub={sub} figure={figure} gold={gold} />
      </Pressable>
    </View>
  );
});

/** A life of a game with friends that this phone keeps, while the server cannot say which games there were: the rest of it a tap away, in a sheet. */
const KeptLife = memo(function KeptLife({ runId, lifeId, name, day, score, onOpen }: { runId: string; lifeId: string; name: string; day: string; score: string; onOpen(runId: string): void }) {
  const phone = useT('phone');
  const press = usePress({ onPress: () => onOpen(runId) });
  return (
    <View role="listitem">
      <Pressable accessibilityRole="button" accessibilityHint={phone('opensLife')} onPress={press}>
        <Line lifeId={lifeId} name={name} sub={day} figure={score} gold />
      </Pressable>
    </View>
  );
});

/**
 * The multiplayer games the player has played to the end, the latest first, a line each with where they came. A tap opens the game: the life, how
 * long its rounds were, the player's own life in it, and everyone with where they ended up, doing what, and with what. `runs` are the player's lives
 * of games with friends this phone keeps: shown with their game, or on their own (each opening its life) while the server cannot say which games
 * there were. `opened` is a game whose sheet is open from the start, by its id, once the games are known (a scene's initial state).
 */
export function RoomHistory({ runs, opened }: { runs: FinishedRun[]; opened?: string }) {
  const t = useT('records');
  const room = useT('room');
  const common = useT('common');
  const { text, names, fmt } = useWords();
  const pace = usePace();
  const status = useRoom((s) => s.status);
  const history = useRoom((s) => s.history);
  const [games, setGames] = useState<RoomGameOver[] | null>(null);
  const [openGame, setOpenGame] = useState<string | null>(opened ?? null);
  const [openRun, setOpenRun] = useState<string | null>(null);
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
  const runOf = (game: RoomGameOver) => (game.gameId === null ? null : (runs.find((one) => one.runId === game.gameId) ?? null));
  // With no games from the server, the lives this phone keeps of them are listed as they are.
  const listed = games !== null && games.length > 0;
  if (!listed && (!asked || runs.length === 0)) return null;
  const run = openRun === null ? null : (runs.find((one) => one.runId === openRun) ?? null);
  const open = openGame === null ? null : (games?.find((game) => game.id === openGame) ?? null);
  const where = open ? placeIn(open) : null;
  const mine = open ? runOf(open) : null;

  return (
    <View role="region" aria-label={t('multiplayer')}>
      <Heading>{t('multiplayer')}</Heading>
      <View role="list" style={{ gap: 6 }}>
        {listed
          ? games.map((game) => {
              const place = placeIn(game);
              return (
                <GameLine
                  key={game.id}
                  id={game.id}
                  lifeId={game.lifeId}
                  name={lifeName(game.lifeId)}
                  tag={game.rematchOf ? room('rematch') : undefined}
                  sub={`${fmt.day(game.playedAt)} · ${t('players', { count: game.players.length })}`}
                  figure={place ? t('placeShort', { place: place.place, total: place.total }) : room('left')}
                  gold={place?.place === 1}
                  onOpen={setOpenGame}
                />
              );
            })
          : runs.map((one) => (
              <KeptLife key={one.runId} runId={one.runId} lifeId={one.lifeId} name={lifeName(one.lifeId)} day={fmt.day(one.finishedAt)} score={fmt.number(one.score)} onOpen={setOpenRun} />
            ))}
      </View>
      <Sheet open={open !== null} onClose={() => setOpenGame(null)} half title={open ? lifeName(open.lifeId) : ''} closeLabel={common('close')}>
        {open ? (
          <View style={{ gap: 12 }}>
            {/* The game: when, how long its rounds were, and where the player came. */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <LifeFace lifeId={open.lifeId} size="md" />
              <ReadText size={13} tone="ink-200" lineHeight={13 * SNUG} style={{ flex: 1, minWidth: 0 }}>
                {`${fmt.day(open.playedAt)} · ${room('round', { time: pace(open.seconds) })}${open.rematchOf ? ` · ${room('rematch')}` : ''}`}
              </ReadText>
              <PixelText size={20} tone={where?.place === 1 ? 'gold-500' : 'ink-200'} style={{ flexShrink: 0 }}>{where ? t('placeShort', { place: where.place, total: where.total }) : room('left')}</PixelText>
            </View>
            <View role="list">
              {open.players.map((player, at) => {
                const lived = [player.cityId ? names.cities[player.cityId] : null, player.career ? text.careers[player.career.id]?.levels[player.career.level] : null].filter(Boolean).join(' · ');
                return (
                  <View
                    key={`${player.tag}-${at}`}
                    role="listitem"
                    style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6, opacity: player.left ? 0.6 : 1, ...(at === 0 ? null : { borderTopWidth: 2, borderTopColor: COLORS['night-900'] }) }}
                  >
                    <PixelText size={16} tone="ink-300" style={{ width: 20, flexShrink: 0 }}>{player.left ? '·' : String(at + 1)}</PixelText>
                    {/* The same rat as in the game; a game over told by an older server says nobody's. */}
                    {player.userId !== null ? <MemberRat member={{ userId: player.userId, avatar: player.avatar }} /> : null}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <ReadText size={15} numberOfLines={1} style={{ flexShrink: 1 }}>{nameOf(player)}</ReadText>
                        {player.me ? <Tag tone="good" item>{room('you')}</Tag> : null}
                        {player.left ? <ReadText size={12} tone="ink-300">{room('left')}</ReadText> : null}
                      </View>
                      {lived ? <ReadText size={12} tone="ink-300" numberOfLines={1}>{lived}</ReadText> : null}
                    </View>
                    {/* Net worth beside the points, in the dollars the life began with, as every record counts it. */}
                    <ReadText size={13} tone="ink-200" style={{ width: 64, flexShrink: 0, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{player.netWorth === null ? '' : fmt.compact(player.netWorth)}</ReadText>
                    <PixelText size={18} tone="gold-500" style={{ width: 48, flexShrink: 0, textAlign: 'right' }}>{player.score === null ? '—' : fmt.number(player.score)}</PixelText>
                  </View>
                );
              })}
            </View>
            {/* The player's own life in the game, as this phone keeps it. */}
            {mine ? (
              <View role="region" aria-label={t('yourLife')} style={{ borderTopWidth: 2, borderTopColor: COLORS['night-900'], paddingTop: 8 }}>
                <PixelText size={13} tone="gold-200" style={{ marginBottom: 4, textTransform: 'uppercase', letterSpacing: 13 * 0.05 }}>{t('yourLife')}</PixelText>
                <RunDetail run={mine} tags={false} />
              </View>
            ) : null}
          </View>
        ) : null}
      </Sheet>
      <Sheet open={run !== null} half onClose={() => setOpenRun(null)} title={run ? lifeName(run.lifeId) : ''} closeLabel={common('close')}>
        {run ? <RunDetail run={run} /> : null}
      </Sheet>
    </View>
  );
}
