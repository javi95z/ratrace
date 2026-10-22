import { scoreBreakdown } from '@ratrace/engine';
import { rivalScore } from '@ratrace/core/game/rivals';
import { View } from 'react-native';
import { webLine } from '../../ui/fonts';
import { Panel } from '../../ui/kit';
import { PixelText, ReadText, SNUG } from '../../ui/text';
import { COLORS } from '../../ui/theme';
import { useGame, useSettings, useT, useWords } from '../context';
import { useRoomPaper } from '../roomStory';
import { useRivals } from '../useRivals';

/*
 * The web's Rivals.tsx, on the phone. In a game with friends the rivals are the other players (`useRoomPaper`), and the room's order is theirs: no
 * made-up ones.
 */

/** One rival's line (or the player's): the place and the name on the left, the points on the right, on one baseline (the web's `items-baseline`). */
function Line({ place, name, points, you, first, language }: { place: number; name: string; points: string; you: boolean; first: boolean; language: string }) {
  // The left side is a line of the item's 15 (Chakra, 1.45) with the place (pixel 15) and the name (pixel 16 for the player, a reading 14 for a rival) in it.
  const left = webLine([['read', 15, 15 * 1.45], ['pixel', 15, 15 * 1.1], you ? ['pixel', 16, 16 * 1.1] : ['read', 14, 14 * 1.45]], language);
  // The right side is a box of its own: a pixel 15.
  const right = webLine([['pixel', 15, 15 * 1.1]], language);
  const top = Math.max(left.above, right.above);
  const tone = you ? 'gold-500' : 'cream';
  return (
    <View
      role="listitem"
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        paddingVertical: 6,
        ...(first ? null : { borderTopWidth: 2, borderTopColor: COLORS['night-900'] }),
      }}
    >
      <View style={{ flexShrink: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', marginTop: top - left.above, height: left.height }}>
        <PixelText size={15} tone="ink-300" style={{ marginTop: left.tops[1], marginRight: 8, flexShrink: 0 }}>{`#${place}`}</PixelText>
        {you ? (
          <PixelText size={16} tone={tone} numberOfLines={1} style={{ marginTop: left.tops[2], flexShrink: 1 }}>{name}</PixelText>
        ) : (
          <ReadText size={14} tone={tone} numberOfLines={1} style={{ marginTop: left.tops[2], flexShrink: 1 }}>{name}</ReadText>
        )}
      </View>
      <View style={{ flexShrink: 0, marginTop: top - right.above }}>
        <PixelText size={15} tone={tone}>{points}</PixelText>
      </View>
    </View>
  );
}

/**
 * Where the life stands beside the lives of the player's rivals, by score, as the game counts it:
 * the points of wealth and of status. The rivals have no status of the game's own, so each counts
 * the standing of the life they live. While the life goes on it says where the player is; at the
 * end, where they came.
 */
export function RivalsBoard({ history }: { history: number[] }) {
  const t = useT('rivals');
  const { content, fmt } = useWords();
  const { locale } = useSettings();
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
      <PixelText size={20} tone="gold-500">{t(view.finished ? 'placeEnd' : 'placeNow', { n: place, of: rows.length })}</PixelText>
      <ReadText size={12} lineHeight={12 * SNUG} tone="ink-300" style={{ marginBottom: 8 }}>{t('about')}</ReadText>
      <View role="list">
        {rows.map((row, i) => (
          <Line key={row.key} place={i + 1} name={row.name} points={t('points', { n: fmt.number(row.score) })} you={row.you} first={i === 0} language={locale} />
        ))}
      </View>
    </Panel>
  );
}
