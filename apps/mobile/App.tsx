// Development screen (temporary, until Task 12's kit page): sprites drawn pixel for pixel, to look at in the simulator.
import type { RatLook } from '@ratrace/core/game/avatar';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Page } from './src/ui/Page';
import { RatAvatar } from './src/ui/RatAvatar';
import { Sprite } from './src/ui/Sprite';
import { COLORS } from './src/ui/theme';

const look: RatLook = { colour: 'teal', body: 'grey', face: 'grin', outfit: 'suit', hat: 'crown', eyes: 'round', backdrop: 'stars' };

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color: COLORS.cream, marginBottom: 6 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>{children}</View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Page>
        <ScrollView contentContainerStyle={{ paddingVertical: 16 }}>
          <Row label="icon.cash at 1, 2 and 3 (edges must be hard)">
            <Sprite id="icon.cash" scale={1} />
            <Sprite id="icon.cash" scale={2} />
            <Sprite id="icon.cash" scale={3} alt="cash" />
          </Row>
          <Row label="card.airport at 'art' (1)">
            <Sprite id="card.airport" scale="art" />
          </Row>
          <Row label="silhouette of item.watch_casio, at 2">
            <Sprite id="item.watch_casio" scale={2} silhouette />
          </Row>
          <Row label="a missing id (checkerboard, 32 at 1 and 2)">
            <Sprite id="dev.not_there" />
            <Sprite id="dev.not_there" scale={2} />
          </Row>
          <Row label="RatAvatar sm, md, lg (suit and crown)">
            <RatAvatar look={look} size="sm" />
            <RatAvatar look={look} size="md" />
            <RatAvatar look={look} size="lg" />
          </Row>
        </ScrollView>
      </Page>
    </SafeAreaProvider>
  );
}
