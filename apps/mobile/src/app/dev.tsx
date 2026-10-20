// Development page (until Task 13's kit page): sprites drawn pixel for pixel, the cues, and money in each language.
import type { RatLook } from '@ratrace/core/game/avatar';
import { formatFor } from '@ratrace/core/lib/format';
import { LOCALES } from '@ratrace/i18n';
import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Screen } from '../ui/Page';
import { RatAvatar } from '../ui/RatAvatar';
import { CUES, useSound } from '../ui/sound';
import { Sprite } from '../ui/Sprite';
import { COLORS } from '../ui/theme';

const look: RatLook = { colour: 'teal', body: 'grey', face: 'grin', outfit: 'suit', hat: 'crown', eyes: 'round', backdrop: 'stars' };

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color: COLORS.cream, marginBottom: 6 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>{children}</View>
    </View>
  );
}

function Cues() {
  const play = useSound();
  return (
    <Row label="sounds: tap one, or several quickly to hear them overlap">
      {CUES.map((cue) => (
        <Pressable key={cue} onPress={() => play(cue)} style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: 8, borderWidth: 2, borderColor: COLORS.cream }}>
          <Text style={{ color: COLORS.cream }}>{cue}</Text>
        </Pressable>
      ))}
    </Row>
  );
}

export default function DevRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <Screen>
      <Row label="money(1234567) in each language (es must read 12.346 $)">
        {LOCALES.map((locale) => (
          <Text key={locale} style={{ color: COLORS.cream }}>{`${locale}: ${formatFor(locale).money(1234567)}`}</Text>
        ))}
      </Row>
      <Cues />
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
    </Screen>
  );
}
