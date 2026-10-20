// The `motion-2` section of the kit: the rest of the web's motion, each effect held still at the middle of a step, and the
// pieces that go with it (sparks, the slider, the two charts) with fixed data. apps/web/src/app/[locale]/kit/motion.tsx shows
// the same, with the same numbers; the two are shot and compared like every other section. Development only.
import { worthBars } from '@ratrace/core/game/present';
import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { Bars, LineChart } from './charts';
import { frameAt, KEYFRAMES, styleOf, type KeyframeName } from './motion';
import { Slider } from './Slider';
import { Glint, Holo } from './Shine';
import { Sparks } from './Sparks';
import { Sprite } from './Sprite';
import { COLORS, type ColorToken } from './theme';

/** How far into each effect it is held, in milliseconds: the middle of a step, away from the edge of one, so no engine reads it a step off. */
const HELD = { paper: 400, legend: 357, holo: 2050, glint: 665, medal: 427, fly: 343, fall: 350, reveal: 281, alarm: 450, tear: 445, page: 90, light: 150, spark: 350 } as const;

/** The effect held, as a style: the very frame the hooks play, at the held time. */
const held = (name: keyof typeof HELD, reach?: { dx: number; dy: number }) =>
  styleOf(name as KeyframeName, frameAt(name as KeyframeName, HELD[name] / KEYFRAMES[name].ms, reach)) as ViewStyle;
const progress = (name: keyof typeof HELD) => HELD[name] / KEYFRAMES[name].ms;

const Cell = ({ children }: { children: ReactNode }) => (
  <View style={{ width: 72, height: 72, backgroundColor: COLORS['night-900'], alignItems: 'center', justifyContent: 'center' }}>{children}</View>
);
const Row = ({ children }: { children: ReactNode }) => <View style={{ flexDirection: 'row', gap: 8 }}>{children}</View>;

/** A block with a corner of another colour, so that a turn or a flip can be told from a fade. */
const Flag = ({ w, h, body, corner, style }: { w: number; h: number; body: ColorToken; corner: ColorToken; style?: ViewStyle }) => (
  <View style={[{ width: w, height: h, backgroundColor: COLORS[body] }, style]}>
    <View style={{ width: 12, height: 12, backgroundColor: COLORS[corner] }} />
  </View>
);

/** The history the net-worth bars are drawn from, in cents: money made, a time in debt, and a good end. */
const HISTORY = [100_000, 400_000, 900_000, 700_000, -200_000, -50_000, 600_000, 1_500_000, 2_200_000, 3_000_000];
/** What a price did, round by round, from 1 where it began. */
const PRICE = [1, 1.15, 1.08, 1.32, 1.21, 1.55, 1.42, 1.7];

export function MotionTwo() {
  return (
    <>
      {/* A legendary card's picture: a rainbow slid half way, and a band of light half way across. */}
      <View style={{ alignSelf: 'flex-start', backgroundColor: COLORS.cream, padding: 2 }}>
        <View style={{ width: 288, height: 120, overflow: 'hidden' }}>
          <Sprite id="card.airport" fallback={{ w: 288, h: 120 }}>
            <Holo width={288} height={120} held={progress('holo')} />
          </Sprite>
          <Glint held={progress('glint')} />
        </View>
      </View>
      <Row>
        <Cell><Flag w={36} h={44} body="cream" corner="wine-500" style={held('paper')} /></Cell>
        <Cell><Flag w={36} h={44} body="cream" corner="gold-500" style={held('legend')} /></Cell>
        <Cell><Flag w={36} h={36} body="gold-500" corner="night-900" style={held('medal')} /></Cell>
        <Cell>
          <View style={[{ position: 'absolute', left: 20, top: 20, width: 12, height: 12, backgroundColor: COLORS['gold-500'] }, held('fly', { dx: 30, dy: 20 })]} />
        </Cell>
      </Row>
      <Row>
        <Cell>
          <View style={[{ position: 'absolute', left: 32, top: 0, width: 8, height: 8, backgroundColor: COLORS['gold-500'] }, held('fall')]} />
        </Cell>
        <Cell>
          {/* uncovered from the left: four stripes of 14, two of them shown (the width is a share of the box that holds it) */}
          <View style={{ width: 56, height: 32 }}>
            <View style={[{ height: 32, overflow: 'hidden' }, held('reveal')]}>
              <View style={{ flexDirection: 'row', width: 56, height: 32 }}>
                {(['teal-300', 'gold-500', 'wine-500', 'sky-500'] as const).map((c) => (
                  <View key={c} style={{ width: 14, height: 32, backgroundColor: COLORS[c] }} />
                ))}
              </View>
            </View>
          </View>
        </Cell>
        <Cell><View style={[{ width: 20, height: 20, backgroundColor: COLORS.cream }, held('alarm')]} /></Cell>
        <Cell>
          <Flag w={32} h={40} body="cream" corner="ink-900" style={{ ...held('tear'), transformOrigin: 'top left' }} />
        </Cell>
      </Row>
      <Row>
        <Cell><Flag w={36} h={36} body="sky-300" corner="ink-900" style={held('page')} /></Cell>
        <Cell><View style={[{ width: 20, height: 20, backgroundColor: COLORS['gold-500'] }, held('light')]} /></Cell>
        <Cell>
          <View style={[{ position: 'absolute', left: 33, top: 33, width: 6, height: 6, backgroundColor: COLORS.cream }, held('spark', { dx: 24, dy: -16 })]} />
        </Cell>
        <Cell>
          <Sparks count={8} reach={30} colours={['gold-500', 'gold-200', 'cream']} size={4} held={progress('spark')} />
        </Cell>
      </Row>
      <Slider label="Amount" value={400} min={0} max={1000} step={10} onChange={() => {}} />
      <View style={{ backgroundColor: COLORS['night-900'], padding: 8 }}>
        <LineChart points={PRICE} tone="teal" label="Price" />
      </View>
      <View style={{ alignSelf: 'center' }}>
        <Bars {...worthBars(HISTORY)} label="Net worth" />
      </View>
    </>
  );
}
