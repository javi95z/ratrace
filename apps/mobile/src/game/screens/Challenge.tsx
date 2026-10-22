import { CHALLENGE_ART, CHALLENGE_DEBT, HEIR_CASH, challengeOf, lives, portraitArt, ruleArt, weekOf, weekStart } from '@ratrace/content';
import type { Challenge, ChallengeRule } from '@ratrace/content';
import { ageAt } from '@ratrace/core/game/present';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { sheetsGone } from '../../ui/back';
import { Framed } from '../../ui/Frame';
import { GOLD } from '../../ui/frames';
import { Button, Notice, Panel, Raised, Well } from '../../ui/kit';
import { Screen } from '../../ui/Page';
import { Sheet } from '../../ui/overlay';
import { Sprite } from '../../ui/Sprite';
import { bannerSize, spriteBox } from '../../ui/sprites';
import { PixelText, ReadText, SNUG } from '../../ui/text';
import { COLORS } from '../../ui/theme';
import { useCanSignIn, useClock, useGame, useRanking, useWords } from '../context';
import { useT } from '../words';
import { BackLink } from './BackLink';

/**
 * This week's challenge, by the clock the game reads the date by (the phone's own, unless a scene holds it at one day). The server keeps its own,
 * and the two agree but for a moment at midnight on Sunday.
 */
export function useThisWeek(): Challenge | null {
  const now = useClock();
  // Read once: the same challenge for as long as the screen is open, and the same object, so that what depends on it is not asked again.
  const [week] = useState(() => challengeOf(weekOf(now()), lives));
  return week;
}

/** A rule of a challenge in a line, and in a sentence that says what it forbids. */
export function useRuleText() {
  const t = useT('challenge');
  const { fmt } = useWords();
  return (rule: ChallengeRule) => ({ name: t(`rules.${rule}.name`), about: t(`rules.${rule}.about`, { amount: fmt.money(rule === 'richHeir' ? HEIR_CASH : CHALLENGE_DEBT) }) });
}

/** The day a week's challenge closes: its Sunday. */
const lastDay = (week: string): number => (weekStart(week) ?? 0) + 6 * 86_400_000;

/** The challenge on the front door, built from the same raised card, portrait well and type hierarchy as the rest of the game. */
export function WeeklyChallengeCard() {
  const t = useT('challenge');
  const { text } = useWords();
  const week = useThisWeek();
  const now = useClock();
  const ruleText = useRuleText();
  const router = useRouter();
  if (week === null) return null;
  const rule = ruleText(week.rule);
  // The days left of the week, today not counted: none on its Sunday.
  const days = Math.max(0, Math.floor((lastDay(week.week) + 86_400_000 - now()) / 86_400_000));

  return (
    <Raised
      role="link"
      bg="night-600"
      style={{ minHeight: 48, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 10 }}
      onPress={() => router.push('/challenge')}
    >
      <Sprite id={CHALLENGE_ART.icon} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <PixelText size={15} tone="gold-500" numberOfLines={1}>{t('title')}</PixelText>
        <ReadText size={12} tone="ink-200" numberOfLines={1}>{`${text.lives[week.lifeId]?.name ?? week.lifeId} · ${rule.name}`}</ReadText>
      </View>
      <ReadText size={12} tone="gold-200" style={{ textAlign: 'right', flexShrink: 0 }}>{t('cardPending', { days })}</ReadText>
      <PixelText size={16} tone="gold-500" style={{ flexShrink: 0 }}>{'›'}</PixelText>
    </Raised>
  );
}


/** The banner of the page, filling the width it is given, on a phone as on a desk, in the web's double frame. */
function Banner() {
  const art = spriteBox(CHALLENGE_ART.scene, 1, 1, { w: 288, h: 120 });
  const [width, setWidth] = useState<number | null>(null);
  return (
    <Framed kind="double" style={{ backgroundColor: COLORS['night-900'] }}>
      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ width: '100%', aspectRatio: art.w / art.h, overflow: 'hidden' }}>
        {width === null ? null : <Sprite id={CHALLENGE_ART.scene} fallback={{ w: 288, h: 120 }} size={bannerSize(width, art)} />}
      </View>
    </Framed>
  );
}

/**
 * The week's challenge has a page of its own: the common life and rule, and practice as often as wanted. (The attempt of the day
 * that counts, and the ranking, are for a player with an account.)
 */
export function WeeklyChallenge() {
  const t = useT('challenge');
  const lifeT = useT('newLife');
  const common = useT('common');
  const { content, text, fmt } = useWords();
  const week = useThisWeek();
  const ruleText = useRuleText();
  const ranking = useRanking();
  const canSignIn = useCanSignIn();
  const router = useRouter();
  const start = useGame((s) => s.start);
  const inProgress = useGame((s) => s.status === 'playing' && s.stage !== 'end');
  const living = useGame((s) => s.lifeId);
  const round = useGame((s) => s.view?.round ?? 0);
  const [starting, setStarting] = useState(false);
  const [asking, setAsking] = useState(false);
  const [failed, setFailed] = useState(false);
  if (week === null) return null;
  const rule = ruleText(week.rule);
  const lifeName = text.lives[week.lifeId]?.name ?? week.lifeId;

  /**
   * Start after any warning has been answered. An answer that came from the question's sheet waits for the sheet to be gone before the page
   * changes under it (`sheetsGone`: a Modal still leaving on iOS holds the screen that is changing); one that came from the button has no sheet to wait for.
   */
  const begin = async (fromSheet = false) => {
    setAsking(false);
    setFailed(false);
    setStarting(true);
    try {
      if (await start(week.lifeId, { challenge: week.week })) {
        if (fromSheet) await sheetsGone();
        router.replace('/play');
      }
    } catch (error) {
      console.error('the challenge could not be started:', error);
      setFailed(true);
    } finally {
      setStarting(false);
    }
  };
  const askToStart = () => {
    if (inProgress) setAsking(true);
    else void begin();
  };

  return (
    <Screen contentStyle={{ gap: 12, paddingBottom: 32 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <BackLink />
        <View accessibilityRole="header" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
          <Sprite id={CHALLENGE_ART.icon} />
          <PixelText size={24} tone="gold-500">{t('title')}</PixelText>
        </View>
      </View>

      <Banner />

      {/* The web writes `frame-gold bg-night-600`, but its Panel's own `bg-night-700` comes later in the stylesheet and wins (measured in its shot): night-700. */}
      <Panel tone={GOLD} label={t('title')}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Well style={{ width: 76, height: 76 }}>
            <Sprite id={portraitArt(week.lifeId, 22)} fallback={{ w: 64, h: 64 }} />
          </Well>
          <View style={{ flex: 1, minWidth: 0 }}>
            <ReadText size={12} tone="ink-300" style={{ letterSpacing: 12 * 0.05, textTransform: 'uppercase' }}>{t('life')}</ReadText>
            <PixelText size={23} tone="cream" numberOfLines={1}>{lifeName}</PixelText>
            <ReadText size={12} tone="ink-200" style={{ marginTop: 4 }}>{t('ends', { day: fmt.day(lastDay(week.week)) })}</ReadText>
          </View>
        </View>
      </Panel>

      <Panel title={t('rule')} label={t('rule')}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <Well style={{ width: 40, height: 40 }}>
            <Sprite id={ruleArt[week.rule]} />
          </Well>
          <View style={{ flex: 1, minWidth: 0 }}>
            <PixelText size={18} tone="gold-200">{rule.name}</PixelText>
            <ReadText size={13} tone="ink-200" lineHeight={13 * SNUG} style={{ marginTop: 4 }}>{rule.about}</ReadText>
          </View>
        </View>
      </Panel>

      <ReadText size={13} tone="ink-200" lineHeight={13 * SNUG}>{t('about')}</ReadText>

      {/* An attempt is the server's to play: it needs someone signed in. The web tells a guest to sign in; the phone has no way to until phase 3, so it says nothing of it. */}
      {ranking !== 'yes' && canSignIn ? (
        <Notice bg="night-700" tone="ink-200" size={13}>
          {t('needsAccount')}
        </Notice>
      ) : null}
      {failed ? (
        <Notice role="alert" size={13} center>
          {lifeT('failed')}
        </Notice>
      ) : null}

      <View style={{ gap: 8 }}>
        <Button variant="secondary" wide disabled={starting} onPress={askToStart}>
          <Sprite id={CHALLENGE_ART.practice} />
          {t('practice')}
        </Button>
      </View>
      <ReadText size={12} tone="ink-300" lineHeight={12 * SNUG}>{t('practiceHint')}</ReadText>

      <Sheet open={asking && inProgress} onClose={() => setAsking(false)} title={lifeT('confirmTitle')} closeLabel={common('close')} back={false}>
        <ReadText lineHeight={15 * SNUG} tone="ink-200">{lifeT('confirmBody', { life: text.lives[living ?? '']?.name ?? '', age: ageAt(content, round) })}</ReadText>
        <View style={{ marginTop: 16, gap: 12 }}>
          <Button variant="primary" wide onPress={() => setAsking(false)}>
            {lifeT('confirmNo')}
          </Button>
          <Button variant="danger" wide disabled={starting} onPress={() => void begin(true)}>
            {lifeT('confirmYes')}
          </Button>
        </View>
      </Sheet>
    </Screen>
  );
}

export { WeeklyChallenge as Challenge };
