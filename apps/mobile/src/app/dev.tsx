// Development page, beside the kit's (/kit) and the scenes' (/scene): sprites drawn pixel for pixel, the cues, money in each language, and a life begun
// under older rules.
import type { RatLook } from '@ratrace/core/game/avatar';
import { formatFor } from '@ratrace/core/lib/format';
import { LOCALES } from '@ratrace/i18n/locales';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useGame } from '../game/context';
import { Button } from '../ui/kit';
import { Screen } from '../ui/Page';
import { RatAvatar } from '../ui/RatAvatar';
import { CUES, useSound } from '../ui/sound';
import { Sprite } from '../ui/Sprite';
import { COLORS } from '../ui/theme';

type OlderLives = typeof import('../testing/olderLife');
// Cut out of a release build (`__DEV__` is `false` there, folded before the bundle's files are gathered: ui/devRoutes.test.ts), as the route itself goes home.
const older: OlderLives | null = __DEV__ ? (require('../testing/olderLife') as OlderLives) : null;

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

/**
 * A life begun under older rules (testing/olderLife.ts), put where the phone keeps its life and taken up by the game as
 * if the app had just opened, then played a step at a time under the bundle the app carries: the way to see them run on
 * the phone's own engine (Hermes) before the Play screen exists.
 */
function OlderLife() {
  const boot = useGame((s) => s.boot);
  const status = useGame((s) => s.status);
  const lost = useGame((s) => s.lost);
  const rules = useGame((s) => s.rules);
  const round = useGame((s) => s.view?.round);
  const stage = useGame((s) => s.stage);
  const leaveNews = useGame((s) => s.leaveNews);
  const pick = useGame((s) => s.pick);
  const afterCard = useGame((s) => s.afterCard);
  const play = useGame((s) => s.play);
  const [failed, setFailed] = useState<string | null>(null);
  const begin = () => {
    setFailed(null);
    if (older === null) return;
    void older.putOlderLife().then(boot).catch((error: unknown) => setFailed(String(error)));
  };
  // The news, the cards and their results, the finances: one tap for each, as the round asks for them.
  const step = () => {
    if (stage === 'news') leaveNews();
    else if (stage === 'cards') void pick(0);
    else if (stage === 'outcome') afterCard();
    else if (stage === 'finance') void play();
  };
  return (
    <Row label="a life begun under rules 0.37.0 / 1.38.0, finished under them from the rules the app carries">
      <Button variant="secondary" onPress={begin}>
        begin it
      </Button>
      <Button variant="secondary" disabled={status !== 'playing'} onPress={step}>
        play on
      </Button>
      <Text style={{ color: COLORS.cream }}>{`${status}${lost ? ` (${lost})` : ''} · rules ${rules} · round ${round ?? '-'} · ${stage}${failed ? ` · ${failed}` : ''}`}</Text>
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
      <OlderLife />
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
