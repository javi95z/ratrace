import { CHALLENGE_ART, CHALLENGE_DEBT, HEIR_CASH, challengeOf, lives, portraitArt, ruleArt, weekOf, weekStart } from '@ratrace/content';
import type { Challenge, ChallengeRule } from '@ratrace/content';
import { ageAt } from '@ratrace/core/game/present';
import type { ChallengeChoice, ChallengeRanking, Community } from '@ratrace/online/types';
import { useRouter } from 'expo-router';
import { memo, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { sheetsGone } from '../../ui/back';
import { Framed } from '../../ui/Frame';
import { GOLD } from '../../ui/frames';
import { Button, Notice, Panel, Raised, reach, Tag, usePress, Well } from '../../ui/kit';
import { LinkText } from '../../ui/LinkText';
import { Loading } from '../../ui/Loading';
import { Screen } from '../../ui/Page';
import { Sheet } from '../../ui/overlay';
import { Sprite } from '../../ui/Sprite';
import { bannerSize, spriteBox } from '../../ui/sprites';
import { PixelText, ReadText, SNUG } from '../../ui/text';
import { COLORS } from '../../ui/theme';
import { useCanSignIn, useClock, useCommunity, useGame, useRanking, useWords } from '../context';
import { useT } from '../words';
import { BackLink } from './BackLink';
import { ElsewhereSheet } from './NewLife';

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

/** The places of a challenge's ranking that are in its best tenth: the first, at least. */
export const topTenth = (entrants: number): number => Math.max(1, Math.ceil(entrants / 10));

/** The challenge on the front door, built from the same raised card, portrait well and type hierarchy as the rest of the game. */
export function WeeklyChallengeCard() {
  const t = useT('challenge');
  const { text } = useWords();
  const week = useThisWeek();
  const now = useClock();
  const ruleText = useRuleText();
  const router = useRouter();
  const community = useCommunity();
  // Whether the player has had today's attempt: not asked where nobody is signed in, and said only once known.
  const [entered, setEntered] = useState<boolean | null>(null);
  useEffect(() => {
    if (week === null || community === null) return;
    let live = true;
    void community.challengeEntry(week.week).then((entry) => {
      if (live && entry !== null) setEntered(entry.entered);
    });
    return () => {
      live = false;
    };
  }, [community, week]);
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
      <ReadText size={12} tone={entered ? 'teal-300' : 'gold-200'} style={{ textAlign: 'right', flexShrink: 0 }}>{entered ? t('cardPlayed') : t('cardPending', { days })}</ReadText>
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
 * The week's challenge has a page of its own: the common life and rule, the attempt of the day that counts (the ranking keeps the week's best), and
 * practice as often as wanted.
 */
export function WeeklyChallenge() {
  const t = useT('challenge');
  const lifeT = useT('newLife');
  const common = useT('common');
  const { content, text, fmt } = useWords();
  const week = useThisWeek();
  const ruleText = useRuleText();
  const community = useCommunity();
  const ranking = useRanking();
  const canSignIn = useCanSignIn();
  const router = useRouter();
  const start = useGame((s) => s.start);
  const continueElsewhere = useGame((s) => s.continueElsewhere);
  const inProgress = useGame((s) => s.status === 'playing' && s.stage !== 'end');
  const living = useGame((s) => s.lifeId);
  const round = useGame((s) => s.view?.round ?? 0);
  const [starting, setStarting] = useState(false);
  const [asking, setAsking] = useState(false);
  const [failed, setFailed] = useState(false);
  const [away, setAway] = useState(false);
  /** The button whose start is being confirmed or is waiting for a ranked life elsewhere: the attempt, or a practice. */
  const [attempt, setAttempt] = useState(false);
  const [entry, setEntry] = useState<{ entered: boolean; score: number | null } | null>(null);
  useEffect(() => {
    if (week === null || community === null) return;
    let live = true;
    void community.challengeEntry(week.week).then((answer) => {
      if (live) setEntry(answer);
    });
    return () => {
      live = false;
    };
  }, [community, week]);
  if (week === null) return null;
  const rule = ruleText(week.rule);
  const lifeName = text.lives[week.lifeId]?.name ?? week.lifeId;
  // An attempt is the server's to play: it needs someone signed in and a connection. One a day: today's, once had, is not offered; where the account
  // cannot say, it is, and the server, which keeps the count, decides.
  const canAttempt = ranking === 'yes' && entry?.entered !== true;

  /**
   * Start after any warning has been answered. `replace` names the ranked life in progress elsewhere that the player has said may end for it. An
   * answer that came from a sheet waits for the sheets to be gone before the page changes under them (`sheetsGone`: a Modal still leaving on iOS
   * holds the screen that is changing); one that came from a button has no sheet to wait for.
   */
  const begin = async (rankedAttempt: boolean, replace?: string, fromSheet = false) => {
    setAsking(false);
    setFailed(false);
    setAway(false);
    setStarting(true);
    try {
      if (await start(week.lifeId, { ranked: rankedAttempt && ranking === 'yes', challenge: week.week, replace })) {
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
  const askToStart = (rankedAttempt: boolean) => {
    setAttempt(rankedAttempt);
    if (inProgress) setAsking(true);
    else void begin(rankedAttempt);
  };
  /** Goes on with the ranked life in progress elsewhere, in place of starting one: from its sheet, once the sheet has gone. */
  const takeUp = async () => {
    setAway(false);
    setStarting(true);
    try {
      const answer = await continueElsewhere();
      if (answer === 'taken') {
        await sheetsGone();
        router.replace('/play');
      } else if (answer === 'away') setAway(true);
    } catch (error) {
      console.error('the life could not be taken up:', error);
      setFailed(true);
    } finally {
      setStarting(false);
    }
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

      {entry?.entered ? (
        <Notice role="status" bg="teal-800" size={13}>
          {entry.score !== null ? t('played', { score: fmt.number(entry.score) }) : t('entered')}
        </Notice>
      ) : ranking === 'yes' && entry?.score != null ? (
        <Notice role="status" bg="night-700" size={13}>
          {t('best', { score: fmt.number(entry.score) })}
        </Notice>
      ) : ranking !== 'yes' && canSignIn ? (
        // The web tells a guest to sign in; a phone with no project to sign in to says nothing of it.
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
        {canAttempt ? (
          <Button variant="primary" wide disabled={starting} onPress={() => askToStart(true)}>
            {t('attempt')}
          </Button>
        ) : null}
        <Button variant="secondary" wide disabled={starting} onPress={() => askToStart(false)}>
          <Sprite id={CHALLENGE_ART.practice} />
          {t('practice')}
        </Button>
      </View>
      <ReadText size={12} tone="ink-300" lineHeight={12 * SNUG}>{t('practiceHint')}</ReadText>
      {community !== null ? <RankingLink label={t('rankingLink')} onPress={() => router.push('/rankings?tab=challenge')} /> : null}

      <Sheet open={asking && inProgress} onClose={() => setAsking(false)} title={lifeT('confirmTitle')} closeLabel={common('close')} back={false}>
        <ReadText lineHeight={15 * SNUG} tone="ink-200">{lifeT('confirmBody', { life: text.lives[living ?? '']?.name ?? '', age: ageAt(content, round) })}</ReadText>
        <View style={{ marginTop: 16, gap: 12 }}>
          <Button variant="primary" wide onPress={() => setAsking(false)}>
            {lifeT('confirmNo')}
          </Button>
          <Button variant="danger" wide disabled={starting} onPress={() => void begin(attempt, undefined, true)}>
            {lifeT('confirmYes')}
          </Button>
        </View>
      </Sheet>

      <ElsewhereSheet starting={starting} away={away} onTake={() => void takeUp()} onEnd={(gameId) => void begin(attempt, gameId, true)} />
    </Screen>
  );
}

/**
 * The way to the week's ranking among the rankings: a line of words, underlined, in the middle of the page (the web's `text-center text-[13px]
 * text-teal-300 underline`). Its touch is the 44 a thumb needs, reaching into the page's gap above it and its foot under it.
 */
function RankingLink({ label, onPress }: { label: string; onPress(): void }) {
  const press = usePress({ onPress });
  return (
    <Pressable accessibilityRole="link" onPress={press} style={[reach(13 * 1.45, { above: 12, below: 32 }).style, { alignSelf: 'center' }]}>
      <LinkText size={13} offset={2} tone="teal-300">{label}</LinkText>
    </Pressable>
  );
}

export { WeeklyChallenge as Challenge };

/**
 * The ranking of this week's challenge, as the cloud answers it, while it is `open` (its tab is the one on screen): `undefined` while the answer is
 * on its way, null where it could not be read. Each opening asks again, from nothing, as the web's board is drawn anew each time its tab is opened;
 * nobody is asked while it is shut, or where there is nobody to ask.
 */
export function useChallengeBoard(community: Community | null, open = true): ChallengeRanking | null | undefined {
  const week = useThisWeek();
  const [opening, setOpening] = useState({ open, n: 0 });
  let now = opening;
  if (open !== opening.open) {
    now = { open, n: opening.n + (open ? 1 : 0) };
    setOpening(now);
  }
  const n = now.n;
  const [answer, setAnswer] = useState<{ to: number; board: ChallengeRanking | null } | null>(null);
  useEffect(() => {
    if (!open || community === null || week === null) return;
    let live = true;
    void community.challengeRanking(week.week).then((board) => {
      if (live) setAnswer({ to: n, board });
    });
    return () => {
      live = false;
    };
  }, [community, week, open, n]);
  return answer?.to === n ? answer.board : undefined;
}

/**
 * The head of the ranking of this week's challenge (the web's `ChallengeBoard` down to its list): the week's life and rule, and what the ranking
 * came to: on its way, unreadable, empty, or how many took part and how many of them are its best tenth. Its lines are a list's rows of their own
 * (`ChallengeEntry`), under it: a screen draws them in its windowed list, as it draws any list that can pass thirty lines.
 */
export function ChallengeBoard({ board }: { board: ChallengeRanking | null | undefined }) {
  const t = useT('challenge');
  const common = useT('common');
  const { text } = useWords();
  const week = useThisWeek();
  const ruleText = useRuleText();
  if (week === null) return null;
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Well style={{ width: 52, height: 52 }}>
          <Sprite id={portraitArt(week.lifeId, 22)} fallback={{ w: 48, h: 48 }} />
        </Well>
        <View style={{ minWidth: 0, flexShrink: 1 }}>
          <PixelText size={17} numberOfLines={1}>{text.lives[week.lifeId]?.name ?? week.lifeId}</PixelText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Sprite id={ruleArt[week.rule]} />
            <ReadText size={12} tone="ink-200" numberOfLines={1} style={{ flexShrink: 1 }}>{ruleText(week.rule).name}</ReadText>
          </View>
        </View>
      </View>
      {board === undefined ? <Loading>{common('loading')}</Loading> : null}
      {board === null ? <Notice role="status">{t('unreachable')}</Notice> : null}
      {board && board.rows.length === 0 ? (
        <Framed kind="frame" style={{ backgroundColor: COLORS['night-700'], padding: 12 }}>
          <ReadText size={14} tone="ink-200">{t('noEntries')}</ReadText>
        </Framed>
      ) : null}
      {board && board.rows.length > 0 ? <ReadText size={12} tone="ink-300">{t('entrants', { n: board.entrants, top: topTenth(board.entrants) })}</ReadText> : null}
    </View>
  );
}

/**
 * A player's best attempt, a line of the challenge's ranking: the place, the name, the day, the mark of the best tenth, the score. The player's own
 * is lit gold, and is the line they are on (the web's `aria-current`). Drawn again only when one of these changes.
 */
export const ChallengeEntry = memo(function ChallengeEntry({ place, name, day, score, top, mine }: { place: number; name: string; day: string; score: string; top: boolean; mine: boolean }) {
  const t = useT('challenge');
  return (
    // One element for a screen reader, which says it is the player's own (the web's `aria-current`), not each of its words apart.
    <View role="listitem" accessible accessibilityState={{ selected: mine }} aria-selected={mine}>
      <Framed kind="bevel" tone={mine ? GOLD : undefined} style={{ backgroundColor: COLORS[mine ? 'night-600' : 'night-700'], flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 8 }}>
        <PixelText size={17} tone="ink-200" style={{ width: 32, flexShrink: 0, textAlign: 'right' }}>{String(place)}</PixelText>
        <View style={{ flex: 1, minWidth: 0 }}>
          <ReadText numberOfLines={1}>{name}</ReadText>
          <ReadText size={12} tone="ink-300" numberOfLines={1}>{day}</ReadText>
        </View>
        {top ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <Sprite id={CHALLENGE_ART.topTenth} />
            <Tag tone="good">{t('topTenth')}</Tag>
          </View>
        ) : null}
        <PixelText size={18} style={{ flexShrink: 0 }}>{score}</PixelText>
      </Framed>
    </View>
  );
});

/**
 * At the end of an attempt of the week: where the player's best stands in the week's ranking, and the choices of that best attempt that the fewest
 * others made, with all of them in a sheet. Nothing until there is a ranking to read; the choices only once the week is over, when the server tells
 * how others chose.
 */
export function ChallengeResult({ week }: { week: string }) {
  const t = useT('challenge');
  const common = useT('common');
  const { text, fmt } = useWords();
  const community = useCommunity();
  const [read, setRead] = useState<{ board: ChallengeRanking | null; choices: ChallengeChoice[] | null } | null>(null);
  const [all, setAll] = useState(false);
  useEffect(() => {
    if (community === null) return;
    let live = true;
    void Promise.all([community.challengeRanking(week), community.challengeChoices(week)]).then(([board, choices]) => {
      if (live) setRead({ board, choices });
    });
    return () => {
      live = false;
    };
  }, [community, week]);
  const board = read?.board ?? null;
  const mine = board?.rows.find((row) => row.mine) ?? null;
  const told = (read?.choices ?? []).filter((choice) => choice.answered > 0 && text.cards[choice.cardId] !== undefined);
  if (mine === null && told.length === 0) return null;
  const share = (choice: ChallengeChoice) => Math.round((choice.same * 100) / choice.answered);
  const line = (choice: ChallengeChoice) =>
    t('choice', { card: text.cards[choice.cardId].title, option: text.cards[choice.cardId].options[choice.option]?.label ?? '', pct: share(choice), n: choice.answered });
  // The least followed first: what set this attempt apart.
  const rare = [...told].sort((a, b) => share(a) - share(b)).slice(0, 3);
  const top = mine !== null && board !== null && mine.place <= topTenth(board.entrants);

  return (
    <Panel title={t('title')} label={t('title')}>
      <View style={{ gap: 8 }}>
        {mine && board ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {top ? <Sprite id={CHALLENGE_ART.topTenth} /> : null}
            <PixelText size={16} tone="gold-200" style={{ flexShrink: 1 }}>{`${t('place', { place: mine.place, n: board.entrants })}${top ? ` · ${t('topTenth')}` : ''}`}</PixelText>
          </View>
        ) : null}
        {rare.length > 0 ? (
          <>
            <ReadText size={12} tone="ink-300" style={{ letterSpacing: 12 * 0.05, textTransform: 'uppercase' }}>{t('rareTitle')}</ReadText>
            <View role="list" style={{ gap: 4 }}>
              {rare.map((choice, i) => (
                <View key={i} role="listitem">
                  <ReadText size={13} lineHeight={13 * SNUG}>{line(choice)}</ReadText>
                </View>
              ))}
            </View>
            <Button variant="secondary" wide onPress={() => setAll(true)}>
              {t('allChoices', { n: told.length })}
            </Button>
          </>
        ) : null}
      </View>
      <Sheet open={all} onClose={() => setAll(false)} title={t('choicesTitle')} closeLabel={common('close')}>
        <View role="list" style={{ gap: 8 }}>
          {told.map((choice, i) => (
            // The web's `border-l-4 border-night-900 pl-2`: a rule down the side of each choice.
            <View key={i} role="listitem" style={{ borderLeftWidth: 4, borderLeftColor: COLORS['night-900'], paddingLeft: 8 }}>
              <ReadText size={13} lineHeight={13 * SNUG} after={[{ text: ` ${fmt.number(choice.same)}/${fmt.number(choice.answered)}`, tone: 'ink-300' }]}>
                {line(choice)}
              </ReadText>
            </View>
          ))}
        </View>
      </Sheet>
    </Panel>
  );
}
