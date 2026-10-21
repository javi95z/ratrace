import { ageAt } from '@ratrace/core/game/present';
import { recordsOf } from '@ratrace/core/game/records';
import type { FinishedRun } from '@ratrace/core/session/types';
import { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useBlink } from '../../ui/animations';
import { Framed } from '../../ui/Frame';
import { Tag, usePress } from '../../ui/kit';
import { Sheet } from '../../ui/overlay';
import { ListScreen } from '../../ui/Page';
import { PixelText, ReadText } from '../../ui/text';
import { COLORS } from '../../ui/theme';
import { useRuns, useT, useWords } from '../context';
import { BackLink } from './BackLink';
import { LifeFace } from './LifeFace';
import { RunDetail } from './RunDetail';

/** A heading of a section of the page (the web's `pixel mb-2 text-[15px] uppercase tracking-[0.1em] text-gold-500`): the records' and the collection's. */
export function Heading({ children }: { children: string }) {
  return (
    <View accessibilityRole="header" style={{ marginBottom: 8 }}>
      <PixelText size={15} tone="gold-500" style={{ letterSpacing: 15 * 0.1, textTransform: 'uppercase' }}>{children}</PixelText>
    </View>
  );
}

/** A personal best: what it is, the life that holds it (or none yet), and its figure (the web's `bevel … bg-night-700 px-3 py-2`). */
function Best({ label, holder, figure }: { label: string; holder: string; figure: string }) {
  return (
    <View role="listitem">
      <Framed kind="bevel" style={{ backgroundColor: COLORS['night-700'], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 12, paddingVertical: 8 }}>
        <View style={{ minWidth: 0, flexShrink: 1 }}>
          <ReadText size={13} tone="ink-200">{label}</ReadText>
          <ReadText size={12} tone="ink-300" numberOfLines={1}>{holder}</ReadText>
        </View>
        <PixelText size={18} tone="gold-500" style={{ flexShrink: 0 }}>{figure}</PixelText>
      </Framed>
    </View>
  );
}

/**
 * A past life, a line of the list: the face the life is chosen by, its name (and whether the server played it), the day it ended and its score.
 * The rest of it is a tap away, in a sheet. Drawn again only when one of these changes: opening a sheet, or a life added, draws no other line again.
 */
const PastLife = memo(function PastLife({ runId, lifeId, name, tag, day, score, onOpen }: { runId: string; lifeId: string; name: string; tag: 'multiplayer' | 'ranked' | null; day: string; score: string; onOpen(runId: string): void }) {
  const t = useT('records');
  const press = usePress({ onPress: () => onOpen(runId) });
  return (
    <View role="listitem">
      <Pressable accessibilityRole="button" onPress={press}>
        <Framed kind="bevel" style={{ backgroundColor: COLORS['night-700'], minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, paddingVertical: 6 }}>
          {/* A line each, the face as the life is chosen: the rest of it a tap away. */}
          <LifeFace lifeId={lifeId} size="md" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <PixelText size={15} numberOfLines={1} style={{ flexShrink: 1 }}>{name}</PixelText>
              {tag === 'multiplayer' ? <Tag>{t('multiplayer')}</Tag> : tag === 'ranked' ? <Tag tone="good">{t('ranked')}</Tag> : null}
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

/** The page is still asking the device for its lives (the web's `pixel animate-blink text-center text-ink-300`). */
function Loading() {
  const common = useT('common');
  const blink = useBlink();
  return (
    <Animated.View style={blink}>
      <PixelText tone="ink-300" style={{ textAlign: 'center' }}>{common('loading')}</PixelText>
    </Animated.View>
  );
}

/**
 * Personal bests, and every life lived to the end with its graph. (The web's games with others, `RoomHistory`, are online: the phone plays none,
 * so it has none to tell.) The lives are one list that draws only the lines near the screen: a player who has lived many has a long one.
 * `opened` is a life whose sheet is open from the start, by its id, once the lives are read (a scene's initial state; the player opens one by a tap).
 */
export function Records({ opened }: { opened?: string } = {}) {
  const t = useT('records');
  const common = useT('common');
  const { content, text, fmt } = useWords();
  const runs = useRuns();
  const lifeName = useCallback((run: FinishedRun) => text.lives[run.lifeId]?.name ?? run.lifeId, [text]);
  const records = useMemo(() => recordsOf(runs ?? []), [runs]);
  // Lives lived in a game with friends are told with their game, among the multiplayer ones (online: none on the phone).
  const alone = useMemo(() => (runs ?? []).filter((run) => !run.room), [runs]);
  const [openId, setOpenId] = useState<string | null>(opened ?? null);
  const open = runs?.find((run) => run.runId === openId) ?? null;

  const best = (label: string, run: FinishedRun | null, figure: (run: FinishedRun) => string) => (
    <Best label={label} holder={run ? lifeName(run) : t('none')} figure={run ? figure(run) : '—'} />
  );

  const head = (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <BackLink />
        <View accessibilityRole="header" style={{ flexShrink: 1 }}>
          <PixelText size={24} tone="gold-500">{t('title')}</PixelText>
        </View>
      </View>

      {runs === null ? <Loading /> : null}
      {runs !== null && runs.length === 0 ? (
        <Framed kind="frame" style={{ backgroundColor: COLORS['night-700'], padding: 12 }}>
          <ReadText size={14} tone="ink-200">{t('empty')}</ReadText>
        </Framed>
      ) : null}

      {runs !== null && runs.length > 0 ? (
        <View role="region" aria-label={t('bests')}>
          <Heading>{t('bests')}</Heading>
          <View role="list" style={{ gap: 8 }}>
            {best(t('bestScore'), records.bestScore, (run) => fmt.number(run.score))}
            {best(t('richest'), records.richest, (run) => fmt.money(run.netWorth))}
            {best(t('youngestEscape'), records.youngestEscape, (run) => t('age', { age: ageAt(content, run.escapedAtRound ?? 0) }))}
            {best(t('mostStatus'), records.mostStatus, (run) => fmt.number(run.status))}
          </View>
          <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4 }}>
            <ReadText size={13} tone="ink-200">{t('lives', { count: records.lives })}</ReadText>
            <ReadText size={13} tone="ink-200">{t('escaped', { count: records.escaped })}</ReadText>
            <ReadText size={13} tone="ink-200">{t('bankruptcies', { count: records.bankruptcies })}</ReadText>
          </View>
        </View>
      ) : null}

      {/* The past lives' heading: their lines are the list's own rows, under it. */}
      {alone.length > 0 ? <Heading>{t('history')}</Heading> : null}
    </View>
  );

  return (
    <>
      <ListScreen
        head={head}
        data={alone}
        keyOf={(run) => run.runId}
        item={(run) => (
          <View style={run === alone[0] ? null : { paddingTop: BETWEEN }}>
            <PastLife
              runId={run.runId}
              lifeId={run.lifeId}
              name={lifeName(run)}
              tag={run.room ? 'multiplayer' : run.ranked ? 'ranked' : null}
              day={fmt.day(run.finishedAt)}
              score={fmt.number(run.score)}
              onOpen={setOpenId}
            />
          </View>
        )}
        contentStyle={{ paddingBottom: 40 }}
      />
      <Sheet open={open !== null} onClose={() => setOpenId(null)} title={open ? lifeName(open) : ''} closeLabel={common('close')}>
        {open ? <RunDetail run={open} /> : null}
      </Sheet>
    </>
  );
}
