import { worthBars } from '@ratrace/core/game/present';
import { View } from 'react-native';

/*
 * STUB — TO BE REPLACED AT THE MERGE OF THE LANES.
 *
 * The records' sheet of a past life (RunDetail) draws its net worth round by round with the web's `WorthGraph`
 * (apps/web/src/game/screens/WorthGraph.tsx), which Task 17 ports in another lane, in parallel. Until the two are merged, this stands in for it
 * with the web's props and the graph's place only: a box as wide as the web's bars (ten points a bar, four between) and as tall as the
 * figures over and under them and the bars themselves, named for a screen reader as the graph is. No bars, no figures.
 *
 * At the merge: RunDetail.tsx imports `WorthGraph` from './WorthGraph' (Task 17's) in place of './WorthGraphStub', and this file is deleted.
 * Records.test's sheet already asks for the graph by its name, as the web's test does.
 */
export function WorthGraph({ history, label, height = 96 }: { history: number[]; label: string; height?: number }) {
  const { bars } = worthBars(history);
  const width = Math.max(10, bars.length * 14 - 4);
  // The bars, and a line of small figures over them and one under them (the web's `text-[11px]`, 1.45 its line, 4 apart).
  const tall = height + 2 * (4 + 11 * 1.45);
  return <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ width, height: tall, alignSelf: 'center' }} />;
}
