import type { RoomGameOver } from '@ratrace/core/game/room';
import type { FinishedRun } from '@ratrace/core/session/types';
import { memo, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Framed } from '../../ui/Frame';
import { Tag, usePress } from '../../ui/kit';
import { Sheet } from '../../ui/overlay';
import { PixelText, ReadText } from '../../ui/text';
import { COLORS } from '../../ui/theme';
import { useRoom, useT, useWords } from '../context';
import { Heading } from './Heading';
import { LifeFace } from './LifeFace';
import { RunDetail } from './RunDetail';

/** Where the player came in a game over: their place among those who stayed to the end, or null if they left. */
export function placeIn(game: RoomGameOver): { place: number; total: number } | null {
  const stayed = game.players.filter((player) => !player.left);
  const at = stayed.findIndex((player) => player.me);
  return at < 0 ? null : { place: at + 1, total: stayed.length };
}

/** A line of the list, as the web's (`bevel … bg-night-700 px-2 py-1.5`, at least 48 high): the life's face, its name and what is under it, and a figure. */
function Line({ lifeId, name, tag, sub, figure, gold }: { lifeId: string; name: string; tag?: string; sub: string; figure: string; gold: boolean }) {
  return (
    <Framed kind="bevel" style={{ backgroundColor: COLORS['night-700'], minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, paddingVertical: 6 }}>
      <LifeFace lifeId={lifeId} size="md" />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <PixelText size={15} numberOfLines={1} style={{ flexShrink: 1 }}>{name}</PixelText>
          {tag ? <Tag>{tag}</Tag> : null}
        </View>
        <ReadText size={12} tone="ink-300">{sub}</ReadText>
      </View>
      <PixelText size={16} tone={gold ? 'gold-500' : 'ink-200'} style={{ flexShrink: 0 }}>{figure}</PixelText>
    </Framed>
  );
}

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
 * The multiplayer games the player has played to the end, the latest first, a line each with where they came (the web's `RoomHistory`, its list).
 * `runs` are the player's lives of games with friends this phone keeps: shown on their own while the server cannot say which games there were, each
 * opening its life in a sheet. A game's own sheet (everyone in it, and the player's life there) comes with the rest of the games with others.
 */
export function RoomHistory({ runs }: { runs: FinishedRun[] }) {
  const t = useT('records');
  const room = useT('room');
  const common = useT('common');
  const { text, fmt } = useWords();
  const status = useRoom((s) => s.status);
  const history = useRoom((s) => s.history);
  const [games, setGames] = useState<RoomGameOver[] | null>(null);
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
  // With no games from the server, the lives this phone keeps of them are listed as they are.
  const listed = games !== null && games.length > 0;
  if (!listed && (!asked || runs.length === 0)) return null;
  const run = openRun === null ? null : (runs.find((one) => one.runId === openRun) ?? null);

  return (
    <View role="region" aria-label={t('multiplayer')}>
      <Heading>{t('multiplayer')}</Heading>
      <View role="list" style={{ gap: 6 }}>
        {listed
          ? games.map((game) => {
              const place = placeIn(game);
              return (
                <View key={game.id} role="listitem">
                  <Line
                    lifeId={game.lifeId}
                    name={lifeName(game.lifeId)}
                    tag={game.rematchOf ? room('rematch') : undefined}
                    sub={`${fmt.day(game.playedAt)} · ${t('players', { count: game.players.length })}`}
                    figure={place ? t('placeShort', { place: place.place, total: place.total }) : room('left')}
                    gold={place?.place === 1}
                  />
                </View>
              );
            })
          : runs.map((one) => (
              <KeptLife key={one.runId} runId={one.runId} lifeId={one.lifeId} name={lifeName(one.lifeId)} day={fmt.day(one.finishedAt)} score={fmt.number(one.score)} onOpen={setOpenRun} />
            ))}
      </View>
      <Sheet open={run !== null} onClose={() => setOpenRun(null)} title={run ? lifeName(run.lifeId) : ''} closeLabel={common('close')}>
        {run ? <RunDetail run={run} /> : null}
      </Sheet>
    </View>
  );
}
