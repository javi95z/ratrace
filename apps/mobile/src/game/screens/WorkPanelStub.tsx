import { quoteWork } from '@ratrace/engine';
import type { GameView } from '@ratrace/engine';
import { View } from 'react-native';
import { Panel } from '../../ui/kit';
import { PixelText, ReadText } from '../../ui/text';
import { useT, useWords } from '../context';

/*
 * STUB — TO BE REPLACED AT THE MERGE OF THE LANES.
 *
 * Task 17 (the profile) draws the player's work at its head with the web's `WorkPanel` (apps/web/src/game/screens/Work.tsx), which Task 14 ports in
 * another lane, in parallel. Until the two are merged, this stands in for it with the head of the web's panel only: the job's title, its trade, and
 * what it pays a year. No picture of the workplace, no ladder, no focus, no skills, and none of their sheets.
 *
 * At the merge: Profile.tsx imports `WorkPanel` from './Work' (Task 14's) in place of './WorkPanelStub', this file is deleted, and Play.test's
 * "the profile opens from the portrait" reads the panel's 'Finance' and 'Focus this round' too, as the web's test does.
 */
export function WorkPanel({ shown }: { shown: GameView }) {
  const t = useT('work');
  const common = useT('common');
  const { content, text, fmt } = useWords();
  const work = quoteWork(content, shown);
  const job = shown.player.life.career;
  const titles = job ? text.careers[job.id].levels : [];
  const rung = work.level === null ? null : work.ladder[work.level];
  return (
    <Panel title={t('title')} label={t('title')}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingTop: 4 }}>
        <View style={{ flexShrink: 1, minWidth: 0 }}>
          <PixelText size={17} numberOfLines={1}>{job && rung ? titles[rung.level] : work.retirement.retired ? t('retiredTitle') : t('noJob')}</PixelText>
          <ReadText size={12} tone="ink-300" numberOfLines={1}>
            {job ? text.careers[job.id].name : work.retirement.retired ? t('retiredSub', { focus: work.retirement.focus, status: work.retirement.status }) : t('noJobSub')}
          </ReadText>
        </View>
        <PixelText size={16} tone="gold-500" style={{ flexShrink: 0 }}>{common('perYear', { amount: fmt.money(work.payAnnual) })}</PixelText>
      </View>
    </Panel>
  );
}
