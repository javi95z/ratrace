import { ageAt } from '@ratrace/core/game/present';
import type { FinishedRun } from '@ratrace/core/session/types';
import { ScrollView, View } from 'react-native';
import { webLine } from '../../ui/fonts';
import { Tag } from '../../ui/kit';
import { PixelText, ReadText } from '../../ui/text';
import { COLORS } from '../../ui/theme';
import { useSettings, useT, useWords } from '../context';
import { WorthGraph } from './WorthGraph';

/** The whole of a finished life: its kind, where it was lived, how it ended, its score, its net worth and its graph. */
export function RunDetail({ run, tags = true }: { run: FinishedRun; tags?: boolean }) {
  const t = useT('records');
  const { content, names, fmt } = useWords();
  const { locale } = useSettings();
  const line = webLine([['pixel', 18, 18 * 1.1], ['pixel', 16, 16 * 1.1]], locale);
  return (
    <View style={{ gap: 8 }}>
      {tags && (run.ranked || run.room || run.challenge) ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {run.ranked ? <Tag tone="good">{t('ranked')}</Tag> : null}
          {run.room ? <Tag>{t('multiplayer')}</Tag> : null}
          {run.challenge ? <Tag>{t(run.ranked ? 'challenge' : 'practice', { week: run.challenge })}</Tag> : null}
        </View>
      ) : null}
      <ReadText size={13} tone="ink-300">{`${fmt.day(run.finishedAt)} · ${run.cities.map((city) => names.cities[city] ?? city).join(' · ')}`}</ReadText>
      <ReadText size={14} tone={run.escapedAtRound === null ? 'ink-200' : 'teal-300'}>
        {`${run.escapedAtRound === null ? t('never') : t('escapedAt', { age: ageAt(content, run.escapedAtRound) })} · ${t('badges', { count: run.badges.length })}`}
      </ReadText>
      {/* The score and the worth on one baseline, under a line (the web's `items-baseline border-t-2 border-night-900 pt-2`), placed from the browser's
          baselines: a native row on its texts' baselines stood the worth's column apart from the web's (the kit moves glyphs inside their boxes). */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, borderTopWidth: 2, borderTopColor: COLORS['night-900'], paddingTop: 8 }}>
        <PixelText size={18} tone="gold-500" style={{ marginTop: line.tops[0] }}>{t('score', { score: fmt.number(run.score) })}</PixelText>
        <View style={{ alignItems: 'flex-end', marginTop: line.tops[1] }}>
          <PixelText size={16}>{fmt.compact(run.netWorth)}</PixelText>
          <ReadText size={11} tone="ink-300">{t('realWorth')}</ReadText>
        </View>
      </View>
      {/* The web's `overflow-x-auto`: a graph wider than the sheet scrolls sideways; a narrower one stands in the middle (its `mx-auto`). */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <WorthGraph history={run.history} label={t('graph')} height={64} />
      </ScrollView>
    </View>
  );
}
