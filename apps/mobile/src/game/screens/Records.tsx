import { escapeAge } from '@ratrace/core/game/present';
import { recordsOf } from '@ratrace/core/game/records';
import type { FinishedRun } from '@ratrace/core/session/types';
import { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Framed } from '../../ui/Frame';
import { Loading } from '../../ui/Loading';
import { Tag, usePress } from '../../ui/kit';
import { Sheet } from '../../ui/overlay';
import { PerfDrawn } from '../../ui/perf';
import { ListScreen } from '../../ui/Page';
import { useIsWide, WIDE_COLUMN } from '../../ui/desk';
import { PixelText, ReadText } from '../../ui/text';
import { COLORS } from '../../ui/theme';
import { useRuns, useT, useWords } from '../context';
import { BackLink } from './BackLink';
import { Heading } from './Heading';
import { LifeFace } from './LifeFace';
import { RoomHistory } from './RoomHistory';
import { RunDetail } from './RunDetail';

/** A personal best: what it is, the life that holds it (or none yet), and its figure (the web's `bevel … bg-night-700 px-3 py-2`). */
function Best({ label, holder, figure, half = false }: { label: string; holder: string; figure: string; half?: boolean }) {
  return (
    // Two to a row (`half`), each as tall as the taller of the two, as the web's grid lays them.
    <View role="listitem" style={half ? { flex: 1, minWidth: 0 } : undefined}>
      <Framed kind="bevel" style={{ flexGrow: half ? 1 : 0, backgroundColor: COLORS['night-700'], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 12, paddingVertical: 8 }}>
        <View style={{ minWidth: 0, flexShrink: 1 }}>
          <ReadText size={13} tone="ink-200">{label}</ReadText>
          <ReadText size={12} tone="ink-300" numberOfLines={1}>{holder}</ReadText>
        </View>
        <PixelText size={18} tone="gold-500" style={{ flexShrink: 0 }}>{figure}</PixelText>
      </Framed>
    </View>
  );
}

/** A past life as its line shows it: what it is, its name, whether the server played it, the day it ended and its score, and whether it is the first. */
interface Line {
  runId: string;
  lifeId: string;
  name: string;
  tag: 'multiplayer' | 'ranked' | null;
  day: string;
  score: string;
  first: boolean;
}

/**
 * A past life, a line of the list: the face the life is chosen by, its name (and whether the server played it), the day it ended and its score.
 * The rest of it is a tap away, in a sheet, which its hint says (the web's `aria-haspopup="dialog"`). Drawn again only when one of these changes:
 * opening a sheet, or a life added, draws no other line again.
 */
const PastLife = memo(function PastLife({ runId, lifeId, name, tag, day, score, onOpen }: Omit<Line, 'first'> & { onOpen(runId: string): void }) {
  const t = useT('records');
  const phone = useT('phone');
  const press = usePress({ onPress: () => onOpen(runId) });
  return (
    <View role="listitem">
      <Pressable accessibilityRole="button" accessibilityHint={phone('opensLife')} onPress={press}>
        <Framed kind="bevel" style={{ backgroundColor: COLORS['night-700'], minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, paddingVertical: 6 }}>
          {/* A line each, the face as the life is chosen: the rest of it a tap away. */}
          <LifeFace lifeId={lifeId} size="md" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <PixelText size={15} numberOfLines={1} style={{ flexShrink: 1 }}>{name}</PixelText>
              {tag === 'multiplayer' ? <Tag item>{t('multiplayer')}</Tag> : tag === 'ranked' ? <Tag tone="good" item>{t('ranked')}</Tag> : null}
            </View>
            <ReadText size={12} tone="ink-300">{day}</ReadText>
          </View>
          <PixelText size={16} tone="gold-500" style={{ flexShrink: 0 }}>{score}</PixelText>
        </Framed>
      </Pressable>
    </View>
  );
});

/** The room between two past lives (the web's `gap-1.5`). */
const BETWEEN = 6;

/** A line's name in the list. */
const keyOf = (line: Line): string => line.runId;

/**
 * Personal bests, the games played with others (`RoomHistory`), and every life lived to the end with its graph. The lives are one list that draws only the lines near the screen: a player who has lived many has a long one. The list is
 * the web's section of past lives, named as it is; the page above its lines (the title, the bests, their heading) is its header.
 * `opened` is a life whose sheet is open from the start, by its id, once the lives are read (a scene's initial state; the player opens one by a tap);
 * `game`, a game played with others, by its id, once the games are known.
 */
export function Records({ opened, game }: { opened?: string; game?: string } = {}) {
  const t = useT('records');
  const common = useT('common');
  const { content, text, fmt } = useWords();
  const runs = useRuns();
  const lifeName = useCallback((run: FinishedRun) => text.lives[run.lifeId]?.name ?? run.lifeId, [text]);
  const records = useMemo(() => recordsOf(runs ?? []), [runs]);
  // Lives lived in a game with friends are told with their game, among the multiplayer ones.
  const alone = useMemo(() => (runs ?? []).filter((run) => !run.room), [runs]);
  const together = useMemo(() => (runs ?? []).filter((run) => run.room), [runs]);
  const [openId, setOpenId] = useState<string | null>(opened ?? null);
  const open = runs?.find((run) => run.runId === openId) ?? null;
  // Each line as it is drawn, made again only when the lives or the language change: a line's datum is all it shows.
  const lines = useMemo<Line[]>(
    () =>
      alone.map((run, i) => ({
        runId: run.runId,
        lifeId: run.lifeId,
        name: lifeName(run),
        tag: run.room ? 'multiplayer' : run.ranked ? 'ranked' : null,
        day: fmt.day(run.finishedAt),
        score: fmt.number(run.score),
        first: i === 0,
      })),
    [alone, lifeName, fmt],
  );

  // From the web's `sm` up the bests stand two to a row (`grid-cols-1 sm:grid-cols-2`).
  const wide = useIsWide();
  const best = (label: string, run: FinishedRun | null, figure: (run: FinishedRun) => string) => (
    <Best key={label} label={label} holder={run ? lifeName(run) : t('none')} figure={run ? figure(run) : '—'} half={wide} />
  );
  const bests = [
    best(t('bestScore'), records.bestScore, (run) => fmt.number(run.score)),
    best(t('richest'), records.richest, (run) => fmt.money(run.netWorth)),
    best(t('youngestEscape'), records.youngestEscape, (run) => t('age', { age: escapeAge(content, run.escapedAtRound ?? 0) })),
    best(t('mostStatus'), records.mostStatus, (run) => fmt.number(run.status)),
  ];

  const head = (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <BackLink />
        <View accessibilityRole="header" style={{ flexShrink: 1 }}>
          <PixelText size={24} tone="gold-500">{t('title')}</PixelText>
        </View>
      </View>

      {runs === null ? <Loading>{common('loading')}</Loading> : null}
      {runs !== null && runs.length === 0 ? (
        <Framed kind="frame" style={{ backgroundColor: COLORS['night-700'], padding: 12 }}>
          <ReadText size={14} tone="ink-200">{t('empty')}</ReadText>
        </Framed>
      ) : null}
      {/* On a phone with no life of its own yet, the account's multiplayer games are still there. */}
      {runs !== null && runs.length === 0 ? <RoomHistory runs={together} opened={game} /> : null}

      {runs !== null && runs.length > 0 ? (
        <View role="region" aria-label={t('bests')}>
          <Heading>{t('bests')}</Heading>
          <View role="list" style={{ gap: 8 }}>
            {wide
              ? [0, 2].map((at) => (
                  <View key={at} style={{ flexDirection: 'row', gap: 8 }}>
                    {bests.slice(at, at + 2)}
                  </View>
                ))
              : bests}
          </View>
          <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4 }}>
            <ReadText size={13} tone="ink-200">{t('lives', { count: records.lives })}</ReadText>
            <ReadText size={13} tone="ink-200">{t('escaped', { count: records.escaped })}</ReadText>
            <ReadText size={13} tone="ink-200">{t('bankruptcies', { count: records.bankruptcies })}</ReadText>
          </View>
        </View>
      ) : null}

      {runs !== null && runs.length > 0 ? <RoomHistory runs={together} opened={game} /> : null}

      {/* The past lives' heading: their lines are the list's own rows, under it. */}
      {alone.length > 0 ? <Heading>{t('history')}</Heading> : null}
    </View>
  );

  return (
    <>
      <PerfDrawn name="records" />
      <ListScreen
        width={WIDE_COLUMN}
        head={head}
        data={lines}
        keyOf={keyOf}
        item={({ first, ...line }) => (
          <View style={first ? null : { paddingTop: BETWEEN }}>
            <PastLife {...line} onOpen={setOpenId} />
          </View>
        )}
        role={lines.length > 0 ? 'list' : undefined}
        label={lines.length > 0 ? t('history') : undefined}
        contentStyle={{ paddingBottom: 40 }}
      />
      <Sheet open={open !== null} onClose={() => setOpenId(null)} title={open ? lifeName(open) : ''} closeLabel={common('close')}>
        {open ? <RunDetail run={open} /> : null}
      </Sheet>
    </>
  );
}
