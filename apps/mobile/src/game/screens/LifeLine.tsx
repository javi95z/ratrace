import { careerArt, cityIcon, GIFT_ART, HANDOVER_ART, portraitArt, RETIRED_ART } from '@ratrace/content';
import type { Milestone } from '@ratrace/content';
import type { GameView } from '@ratrace/engine';
import { chapters } from '@ratrace/core/game/epilogue';
import { ageAt, milestoneAge, milestoneRound, portraitAge } from '@ratrace/core/game/present';
import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useLight } from '../../ui/animations';
import { Bare, Panel, Well } from '../../ui/kit';
import { Sprite } from '../../ui/Sprite';
import { PixelText, ReadText } from '../../ui/text';
import { COLORS } from '../../ui/theme';
import { useGame, useStill, useT, useWords } from '../context';

/** How long the portrait takes to walk the whole of a life. */
const RUN_MS = 3_000;

/** The sign of each kind of milestone. */
function iconOf(m: Milestone): string {
  switch (m.kind) {
    case 'promoted':
    case 'career':
      return careerArt(m.careerId);
    case 'moved':
      return cityIcon(m.cityId);
    case 'retired':
      return RETIRED_ART.icon;
    case 'gift':
      return GIFT_ART;
    case 'soldBusiness':
      return HANDOVER_ART;
    case 'jobLost':
      return 'icon.job';
    case 'partner':
      return 'icon.partner';
    case 'split':
      return 'icon.single';
    case 'child':
      return 'icon.baby';
    case 'home':
      return 'icon.property';
    case 'business':
      return 'icon.business';
    case 'escaped':
      return 'icon.star';
    case 'bankrupt':
      return 'icon.loan';
    case 'escapeLost':
    case 'crisis':
      return 'icon.economy';
    case 'worth':
      return 'icon.gold';
  }
}

/** A milestone in a few words, with what it needs from the game's names. */
function useLabel(): (m: Milestone) => string {
  const t = useT('end.line');
  const { text, names, fmt } = useWords();
  return (m) => {
    switch (m.kind) {
      case 'promoted':
        return t(m.top ? 'top' : 'promoted', { title: text.careers[m.careerId].levels[m.level] });
      case 'career':
        return t('career', { career: text.careers[m.careerId].name });
      case 'moved':
        return t('moved', { city: names.cities[m.cityId] });
      case 'child':
        return t(m.first ? 'firstChild' : 'child');
      case 'home':
        return t('home', { home: text.propertyTypes[m.typeId] });
      case 'crisis':
        return t('crisis', { crisis: text.crises[m.crisisId].name });
      case 'worth':
        return t('worth', { amount: fmt.compact(m.mark) });
      default:
        return t(m.kind);
    }
  };
}

/** A milestone's sign on the line, lit as the portrait passes it (the web's `animate-light`, delayed until then), with its stem down to the line. */
function Mark({ icon, left, delayMs }: { icon: string; left: number; delayMs: number }) {
  const light = useLight({ delayMs });
  return (
    <Animated.View style={[{ position: 'absolute', top: -92, left: `${left}%`, marginLeft: -16 }, light]}>
      <Bare style={{ width: 32, height: 32 }}>
        <Sprite id={icon} />
      </Bare>
      <View style={{ position: 'absolute', left: 15, top: 32, width: 2, height: 56, backgroundColor: COLORS['gold-700'], opacity: 0.6 }} />
    </Animated.View>
  );
}

/**
 * The player's portrait, walking the line from the first age to the last once, in `steps` steps (the web's transition of `left` over `RUN_MS`,
 * `steps(n, end)`), on the UI thread. Where motion is left out it stands at the end.
 */
function Walker({ steps, portrait }: { steps: number; portrait: string }) {
  const still = useStill();
  const walked = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    cancelAnimation(walked);
    if (still) {
      walked.value = 1;
      return;
    }
    walked.value = 0;
    walked.value = withTiming(1, { duration: RUN_MS, easing: Easing.linear });
    return () => cancelAnimation(walked);
  }, [still, walked]);
  const at = useAnimatedStyle(() => ({ left: `${(Math.floor(walked.value * steps + 1e-6) / steps) * 100}%` }));
  return (
    <Animated.View style={[{ position: 'absolute', top: -22, marginLeft: -20 }, at]}>
      <Well style={{ width: 40, height: 40 }}>
        <Sprite id={portrait} fallback={{ w: 60, h: 60 }} size={{ w: 40, h: 40 }} />
      </Well>
    </Animated.View>
  );
}

/**
 * A life on one line: from the first age to the last, the player's portrait walks along it once, and
 * each milestone lights as it passes. Under the line, the same milestones in words, for reading and
 * for a screen reader. Where motion is left out, the portrait is at the end and every milestone is lit.
 */
export function LifeLine({ view, story }: { view: GameView; story: readonly Milestone[] }) {
  const t = useT('end');
  const { content } = useWords();
  const still = useStill();
  const label = useLabel();
  const lifeId = useGame((s) => s.lifeId) ?? '';
  const told = useMemo(() => chapters(story), [story]);
  const last = Math.max(1, view.round);
  const at = (round: number) => Math.min(100, (round / last) * 100);

  return (
    <Panel title={t('lifeLine')} label={t('lifeLine')}>
      <View aria-hidden importantForAccessibility="no-hide-descendants" style={{ marginHorizontal: 24, marginBottom: 28, marginTop: 96, height: 4, backgroundColor: COLORS['night-900'] }}>
        {told.map((m, i) => (
          <Mark key={i} icon={iconOf(m)} left={at(milestoneRound(m))} delayMs={still ? 0 : Math.round((milestoneRound(m) / last) * RUN_MS)} />
        ))}
        {/* The player walks the line, as they look at the end of it. */}
        <Walker steps={Math.max(8, last * 2)} portrait={portraitArt(lifeId, portraitAge(ageAt(content, view.round)))} />
      </View>
      <View style={{ marginHorizontal: 4, flexDirection: 'row', justifyContent: 'space-between' }}>
        <ReadText size={12} tone="ink-300">{t('lineAge', { age: ageAt(content, 0) })}</ReadText>
        <ReadText size={12} tone="ink-300">{t('lineAge', { age: ageAt(content, view.round) })}</ReadText>
      </View>
      {told.length === 0 ? (
        <ReadText size={13} tone="ink-300" style={{ marginTop: 8 }}>{t('lineQuiet')}</ReadText>
      ) : (
        <View role="list" style={{ marginTop: 12, gap: 6 }}>
          {told.map((m, i) => (
            <View role="listitem" key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <PixelText size={13} tone="gold-500" style={{ width: 36, flexShrink: 0, textAlign: 'right' }}>{String(milestoneAge(content, m))}</PixelText>
              <ReadText size={13} tone="ink-200" style={{ flexShrink: 1, minWidth: 0 }}>{label(m)}</ReadText>
            </View>
          ))}
        </View>
      )}
    </Panel>
  );
}
