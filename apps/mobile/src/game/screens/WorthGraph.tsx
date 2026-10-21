import { START_AGE } from '@ratrace/content';
import { worthBars } from '@ratrace/core/game/present';
import { View } from 'react-native';
import { Bars } from '../../ui/charts';
import { ReadText } from '../../ui/text';
import { useWords } from '../context';

/** One bar of the graph, in points: ten of bar and four of gap. */
const BAR = 10;
const STEP = 14;

/**
 * Net worth after every round of a life, one pixel bar each, in the dollars of age 22 so that
 * the rounds can be compared. `height` is in points; a smaller one makes the graph of a list.
 * The bars are the kit's (`Bars`: the web's rects, crisp, on the kit's canvas); the figures over and under them are the web's.
 */
export function WorthGraph({ history, label, height = 96 }: { history: number[]; label: string; height?: number }) {
  const { content, fmt } = useWords();
  const { zero, bars } = worthBars(history);
  const width = Math.max(BAR, bars.length * STEP - (STEP - BAR));
  const last = history.length - 1;

  return (
    // The web's `mx-auto` box as wide as the bars: the figures stand at its two ends.
    <View style={{ width, alignSelf: 'center' }}>
      <View style={{ marginBottom: 4, flexDirection: 'row', justifyContent: 'space-between' }}>
        <ReadText size={11} tone="ink-300">{fmt.compact(Math.max(0, ...history))}</ReadText>
      </View>
      <Bars zero={zero} bars={bars} barWidth={BAR} step={STEP} height={height} label={label} />
      <View style={{ marginTop: 4, flexDirection: 'row', justifyContent: 'space-between' }}>
        <ReadText size={11} tone="ink-300">{String(START_AGE)}</ReadText>
        <ReadText size={11} tone="ink-300">{String(START_AGE + Math.max(0, last) * content.yearsPerRound)}</ReadText>
      </View>
    </View>
  );
}
