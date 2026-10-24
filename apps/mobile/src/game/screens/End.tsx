import { badgeArt, endingArt, GIFT_ART, lives, PERCENTILE_ART, portraitArt, rarityOf } from '@ratrace/content';
import { netWorth, realNetWorth, scoreBreakdown } from '@ratrace/engine';
import type { GameView } from '@ratrace/engine';
import { epilogue } from '@ratrace/core/game/epilogue';
import { ageAt, endingOf, escapeAge, prizedBadge } from '@ratrace/core/game/present';
import { obituary } from '@ratrace/core/game/quips';
import { bestsOf } from '@ratrace/core/game/records';
import type { Best } from '@ratrace/core/game/records';
import { shareCard } from '@ratrace/core/game/share';
import { createContext, memo, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useCountUp } from '../../ui/animations';
import { useDrawnFirst } from '../../ui/drawnFirst';
import { Framed } from '../../ui/Frame';
import { GOLD } from '../../ui/frames';
import { Button, Panel, pressDown, Raised, SrOnly, Tag, usePress, Well } from '../../ui/kit';
import { Sheet } from '../../ui/overlay';
import { PerfDrawn } from '../../ui/perf';
import { Rising } from '../../ui/Rising';
import { Screen } from '../../ui/Page';
import { Sprite } from '../../ui/Sprite';
import { PixelText, ReadText, SNUG, TIGHT } from '../../ui/text';
import { COLORS } from '../../ui/theme';
import { useCommunity, useGame, useProfile, useRanking, useRoom, useRuns, useT, useTrack, useWords } from '../context';
import { BackLink } from './BackLink';
import { ChallengeResult } from './Challenge';
import { LifeLine } from './LifeLine';
import { LifeMap, routeOf } from './LifeMap';
import { Loop } from './Loop';
import { Medal } from './Medal';
import { RankGain } from './RankCard';
import { RivalsBoard } from './Rivals';
import { ShareCard } from './ShareCard';
import { WorthGraph } from './WorthGraph';
import { useGo } from '../pages';

/*
 * The web's End.tsx, on the phone, in the web's phone layout (its desk's two columns are one). `extra` is a room's.
 */

/** Fewer lives than this to compare with say nothing yet: a share of three is not a standing. */
export const COMPARE_MIN = 5;

/**
 * Where a score stands among the lives other players finished from the same start, as a share of them that did worse. Nothing while it is being
 * asked, with nobody to ask, or with too few to tell.
 */
function useStanding(lifeId: string, score: number): { pct: number; total: number } | null {
  const community = useCommunity();
  const [standing, setStanding] = useState<{ pct: number; total: number } | null>(null);
  useEffect(() => {
    if (community === null || lifeId === '') return;
    let live = true;
    void community.compare({ lifeId, score }).then((found) => {
      if (live && found !== null && found.total >= COMPARE_MIN) setStanding({ pct: Math.floor((found.below * 100) / found.total), total: found.total });
    });
    return () => {
      live = false;
    };
  }, [community, lifeId, score]);
  return standing;
}

const BEST: Record<Best, string> = { score: 'bestScore', netWorth: 'bestNetWorth', escape: 'bestEscape', status: 'bestStatus' };

/**
 * What the end of a life has open from the start, where a scene says so (the phone's initial state, as Finance's `FinanceOpened` and the profile's
 * `ProfileOpened`; the web's scene page presses what opens it): the picture of the life to share.
 */
export const EndOpened = createContext<{ share?: boolean }>({});

/** The web's `leading-relaxed` (a paragraph of the life, told) and `tracking-wider` (a pixel title set in capitals). */
const RELAXED = 1.625;
const WIDER = 0.05;

/** One figure of a life, set in a tile: what it is, and a line under it. */
function Figure({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Framed kind="frame" style={{ flex: 1, backgroundColor: COLORS['night-900'], paddingHorizontal: 8, paddingVertical: 8, alignItems: 'center' }}>
      <PixelText size={18} tone="gold-500" style={{ textAlign: 'center' }}>{value}</PixelText>
      <ReadText size={11} tone="ink-200" lineHeight={11 * TIGHT} style={{ textAlign: 'center' }}>{label}</ReadText>
      {sub ? <ReadText size={11} tone="ink-300" lineHeight={11 * TIGHT} style={{ marginTop: 2, textAlign: 'center' }}>{sub}</ReadText> : null}
    </Framed>
  );
}

/** One of the three parts of the score. */
function Part({ label, value }: { label: string; value: string }) {
  return (
    <Framed kind="frame" style={{ flex: 1, backgroundColor: COLORS['night-900'], paddingHorizontal: 4, paddingVertical: 8, alignItems: 'center' }}>
      <PixelText size={20} style={{ textAlign: 'center' }}>{value}</PixelText>
      <ReadText size={11} tone="ink-300" lineHeight={11 * TIGHT} style={{ textAlign: 'center' }}>{label}</ReadText>
    </Framed>
  );
}

/**
 * The score, counting up from nothing as it is shown: a leaf of its own, so that the screen is not drawn again for every step of the count. A screen
 * reader reads the whole score at once (`Ended`'s words only it hears), not the figure counting.
 */
function Counting({ total }: { total: number }) {
  const { fmt } = useWords();
  const counted = useCountUp(total);
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants">
      <PixelText size={60} tone="gold-500" lineHeight={60} style={{ textAlign: 'center' }}>{fmt.number(counted)}</PixelText>
    </View>
  );
}

/** A life that is over is let go once its last screen is left, a moment later: a screen drawn again at once keeps it. */
let leaving: ReturnType<typeof setTimeout> | null = null;

/** How the life ended. Nothing to show until there is a life. `extra` comes first: in a room, the room's order. */
export function End({ extra }: { extra?: ReactNode } = {}) {
  const view = useGame((s) => s.view);
  const gameId = useGame((s) => s.gameId);
  const closeFinished = useGame((s) => s.closeFinished);
  useEffect(() => {
    if (leaving !== null) clearTimeout(leaving);
    leaving = null;
    return () => {
      if (gameId === null) return;
      leaving = setTimeout(() => {
        leaving = null;
        void closeFinished(gameId);
      });
    };
  }, [gameId, closeFinished]);
  return view ? <Ended view={view} extra={extra} /> : null;
}

/** The score and the three parts it is made of, what the life earned, the graph of a lifetime, and the way to another. */
function Ended({ view, extra }: { view: GameView; extra?: ReactNode }) {
  const t = useT('end');
  const tale = useT('epilogue');
  const share = useT('share');
  const meta = useT('meta');
  const words = useWords();
  const { content, text, names, fmt } = words;
  const go = useGo();
  // The panels under the first screen come once the first are on it.
  const rest = useDrawnFirst();
  const history = useGame((s) => s.history);
  const story = useGame((s) => s.story);
  const bankruptcies = useGame((s) => s.bankruptcies);
  const lifeId = useGame((s) => s.lifeId) ?? '';
  const gameId = useGame((s) => s.gameId);
  const ranked = useGame((s) => s.ranked);
  const challenge = useGame((s) => s.challenge);
  const earned = useGame((s) => s.badges);
  const profile = useProfile();
  const runs = useRuns();
  const opened = useContext(EndOpened);

  // What this life did for the first time, as the profile recorded it: nothing is judged here.
  const isNew = (id: string) => profile.badges[id]?.gameId === gameId;
  const unlocked = Object.keys(profile.unlocked).filter((id) => profile.unlocked[id].gameId === gameId);
  const run = runs?.find((candidate) => candidate.runId === gameId);
  const bests = run && runs ? bestsOf(run, runs) : [];

  const p = view.player;
  // The engine's own breakdown: nothing about the score is worked out here.
  const score = useMemo(() => scoreBreakdown(content, view), [content, view]);
  const escaped = score.multiplierPct > 100;
  const ending = endingOf(escaped, netWorth(p));
  const lifeName = text.lives[lifeId]?.name ?? lifeId;
  // The life in three paragraphs: where it began, what happened, how it ended.
  const life = lives.find((candidate) => candidate.id === lifeId);
  const told = useMemo(() => (life ? epilogue({ words, t: tale, life, view, story, score: score.total, bankruptcies }) : []), [life, words, tale, view, story, score.total, bankruptcies]);
  const dead = obituary(content, view, bankruptcies);
  const standing = useStanding(lifeId, score.total);
  const prized = prizedBadge(earned.filter(isNew));
  const outcome = p.escapedAtRound === null ? t('never') : t('escapedAt', { age: escapeAge(content, p.escapedAtRound) });
  // The picture to share says what this screen says, in the figures the engine gave. Worked out here, drawn only when the player asks for it.
  const picture = useMemo(
    () =>
      shareCard({
        title: meta('title').toUpperCase(),
        life: lifeName,
        where: `${t('age', { age: ageAt(content, view.round) })} · ${names.cities[p.cityId]}`,
        outcome: p.escapedAtRound === null ? share('never') : share('escapedAt', { age: escapeAge(content, p.escapedAtRound) }),
        escaped,
        portrait: portraitArt(lifeId, 58),
        scoreLabel: t('score'),
        score: fmt.number(score.total),
        parts: [
          { label: t('wealth'), value: fmt.number(score.wealth) },
          { label: t('status'), value: fmt.number(score.status) },
          { label: escaped ? t('bonus', { multiplier: fmt.factor(score.multiplierPct) }) : t('noBonus'), value: `×${fmt.factor(score.multiplierPct)}` },
        ],
        netWorthLabel: share('netWorth'),
        netWorth: fmt.money(realNetWorth(view)),
        history,
        badgesLabel: share('badges'),
        badges: earned.map(badgeArt),
      }),
    [meta, t, share, fmt, content, names, view, history, earned, lifeId, lifeName, p.escapedAtRound, escaped, score.total, score.wealth, score.status, score.multiplierPct, p.cityId],
  );

  // The richest the life ever was, at the prices of the start, and the age it was then.
  const peak = history.reduce((best, worth, round) => (worth > best.worth ? { worth, round } : best), { worth: history[0] ?? 0, round: 0 });
  const fresh = earned.filter(isNew).length;
  const route = routeOf(lifeId, story);

  return (
    // The web's `main mx-auto w-full max-w-md px-3 pb-8 pt-6`, its two columns one on a phone: everything in it 16 apart (the columns' `gap-4`).
    <Screen contentStyle={{ gap: 16, paddingTop: 24, paddingBottom: 32 }}>
      <PerfDrawn name="stage: end" />
      {extra ? <View>{extra}</View> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ marginVertical: 6, marginLeft: 6, flexShrink: 0 }}>
          <Framed kind="double" tone={{ ring: 'gold-500' }}>
            <Well style={{ width: 68, height: 68 }}>
              <Sprite id={portraitArt(lifeId, 58)} fallback={{ w: 64, h: 64 }} />
            </Well>
          </Framed>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View accessibilityRole="header">
            <PixelText size={30} tone="gold-500" lineHeight={30}>{t('title')}</PixelText>
          </View>
          <ReadText size={13} tone="ink-300" style={{ marginTop: 4 }}>{`${t('age', { age: ageAt(content, view.round) })} · ${lifeName} · ${names.cities[p.cityId]}`}</ReadText>
        </View>
        {/* A life looked back on from the front door is left the way it was come to. */}
        <BackLink place={{ flexShrink: 0, alignSelf: 'flex-start' }} />
      </View>

      {/* The last picture of the life, and the verdict on it under it: where it ended up, and how. */}
      <Framed kind="double" style={{ backgroundColor: COLORS['night-900'] }}>
        <View {...{ dataSet: { ending } }} style={{ overflow: 'hidden' }}>
          <View style={{ alignItems: 'center' }}>
            <Sprite id={endingArt(ending)} scale="art" fallback={{ w: 288, h: 120 }} />
          </View>
          <View style={{ borderTopWidth: 2, borderTopColor: COLORS['night-700'], paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' }}>
            <PixelText size={17} tone={escaped ? 'teal-300' : 'cream'} style={{ textAlign: 'center' }}>{outcome}</PixelText>
            <ReadText size={12} tone="ink-300" style={{ textAlign: 'center' }}>{t('bankruptcies', { count: bankruptcies })}</ReadText>
          </View>
        </View>
      </Framed>

      <Rising>
        <View role="group" aria-label={t('score')}>
          <Framed kind="bevel" tone={GOLD} style={{ backgroundColor: COLORS['night-700'], padding: 16, alignItems: 'center' }}>
            <PixelText size={15} tone="gold-200" style={{ letterSpacing: 15 * 0.1, textAlign: 'center' }}>{t('score').toUpperCase()}</PixelText>
            {/* The whole score is read from words only a screen reader hears, not the figure counting up. */}
            <View style={{ marginTop: 4, alignSelf: 'stretch' }}>
              <SrOnly>{fmt.number(score.total)}</SrOnly>
              <Counting total={score.total} />
            </View>
            <View style={{ marginTop: 16, flexDirection: 'row', gap: 8, alignSelf: 'stretch' }}>
              <Part label={t('wealth')} value={fmt.number(score.wealth)} />
              <Part label={t('status')} value={fmt.number(score.status)} />
              <Part label={escaped ? t('bonus', { multiplier: fmt.factor(score.multiplierPct) }) : t('noBonus')} value={`×${fmt.factor(score.multiplierPct)}`} />
            </View>
            <ReadText size={12} tone="ink-300" style={{ marginTop: 12, textAlign: 'center' }}>{t('statusHint')}</ReadText>
            {/* What was given to the children in life is counted in the wealth as the player's own. */}
            {p.life.legacy > 0 ? (
              <View style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <Sprite id={GIFT_ART} />
                <ReadText size={12} tone="teal-300" style={{ flexShrink: 1, textAlign: 'center' }}>{t('legacy', { amount: fmt.money(p.life.legacy) })}</ReadText>
              </View>
            ) : null}
            {standing ? (
              <View accessible role="status" style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Sprite id={PERCENTILE_ART} />
                <ReadText size={13} tone="teal-300" style={{ flexShrink: 1, textAlign: 'center' }}>{t('compare', { pct: standing.pct, life: lifeName, total: standing.total })}</ReadText>
              </View>
            ) : null}
            {ranked ? (
              <Raised
                role="link"
                bg="night-600"
                place={{ marginTop: 12, alignSelf: 'stretch' }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 }}
                onPress={() => go.push('rankings')}
              >
                <Sprite id="icon.trophy" />
                <PixelText size={15} tone="teal-300" style={{ flexShrink: 1, textAlign: 'center' }}>{t('rankedLink')}</PixelText>
              </Raised>
            ) : null}
          </Framed>
        </View>
      </Rising>

      {/* What the life did for the rat's rank, and the step up when it made one. */}
      {gameId !== null ? <RankGain gameId={gameId} /> : null}

      {/* A rare or legendary badge won for the first time is cheered, the rarest first. */}
      {prized ? (
        <Rising>
          <View accessible role="status">
            <Framed kind="frame" tone={GOLD} style={{ backgroundColor: COLORS['night-600'] }}>
              <View style={{ overflow: 'hidden', paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <Loop name="confetti" style={{ position: 'absolute', left: 8 }} />
                {/* The words are the row's one item that gives way, as the web's text in its flex row: a long badge name wraps between the confetti. */}
                <PixelText size={16} tone="gold-200" style={{ textAlign: 'center', flexShrink: 1 }}>
                  {t(rarityOf(prized.id) === 'legendary' ? 'legendaryBadge' : 'rareBadge', { name: text.badges[prized.id]?.name ?? prized.id })}
                </PixelText>
                <Loop name="confetti" style={{ position: 'absolute', right: 8 }} />
              </View>
            </Framed>
          </View>
        </Rising>
      ) : null}

      {bests.length > 0 || unlocked.length > 0 ? (
        <View style={{ gap: 8 }}>
          {bests.map((best) => (
            <Rising key={best}>
              <View accessible role="status">
                <Framed kind="frame" tone={GOLD} style={{ backgroundColor: COLORS['gold-500'], paddingHorizontal: 12, paddingVertical: 8 }}>
                  <PixelText size={16} tone="ink-900" style={{ textAlign: 'center' }}>{t(BEST[best])}</PixelText>
                </Framed>
              </View>
            </Rising>
          ))}
          {unlocked.map((id) => (
            <UnlockedLife key={id} lifeId={id} />
          ))}
        </View>
      ) : null}

      {/* The week's attempt, beside everyone else's: its place, and the choices that set it apart. */}
      {ranked && challenge !== null ? <ChallengeResult week={challenge} /> : null}

      {told.length > 0 ? (
        <Panel title={tale('title')} label={tale('title')}>
          {told.map((paragraph, i) => (
            <Rising key={i} delayMs={300 + i * 350} style={i > 0 ? { marginTop: 10 } : undefined}>
              <ReadText size={14} lineHeight={14 * RELAXED}>{paragraph}</ReadText>
            </Rising>
          ))}
          {/* The life in one dry line, as a newspaper would have it, set off by a rule. */}
          <Rising delayMs={300 + told.length * 350} style={{ marginTop: 12, borderTopWidth: 2, borderTopColor: COLORS['night-900'], paddingTop: 10 }}>
            <ReadText
              size={13}
              lineHeight={13 * SNUG}
              after={[
                { text: `${tale('obituary.title').toUpperCase()}: `, tone: 'ink-300', pixel: true, tracking: 13 * WIDER },
                { text: tale(`obituary.${dead.key}`, { n: dead.n ?? 0 }), italic: true },
              ]}
            >
              {''}
            </ReadText>
          </Rising>
        </Panel>
      ) : null}

      {/* The panels under the first screen, once the first are on it (ui/drawnFirst.ts): the figures, the map, the rivals, the line of the life and
          its badges are some thirty pictures and charts, and all of the page at once kept the end from the screen for them (measured, the parity
          report's performance part). The share card and the ways out under them come with them: put in before them, they would be pushed down
          by the panels put in above them, on a screen tall enough to show them at first. */}
      {rest ? (
        <>
          {/* The life in a few figures, and the line of its wealth from the first day to the last. */}
          <Panel title={t('figures')} label={t('figures')}>
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Figure label={t('netWorth')} value={fmt.compact(netWorth(p))} sub={t('realShort', { amount: fmt.compact(realNetWorth(view)) })} />
                <Figure label={t('peak')} value={fmt.compact(peak.worth)} sub={t('peakAge', { age: ageAt(content, peak.round) })} />
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Figure label={t('escapeAge')} value={p.escapedAtRound === null ? '—' : String(escapeAge(content, p.escapedAtRound))} />
                <Figure label={t('badgesCount')} value={String(earned.length)} sub={fresh > 0 ? t('badgesNew', { n: fresh }) : undefined} />
              </View>
            </View>
            <View style={{ marginTop: 12 }}>
              <WorthGraph history={history} label={t('graph')} />
            </View>
            <ReadText size={12} tone="ink-300" style={{ marginTop: 8, textAlign: 'center' }}>{t('graph')}</ReadText>
          </Panel>

          {/* Where the life went: the world at night, and the way across it. */}
          <Panel title={t('map')} label={t('map')}>
            <LifeMap route={route} label={t('mapLabel', { cities: route.map((city) => names.cities[city]).join(', ') })} />
          </Panel>
          <RivalsBoard history={history} />

          <LifeLine view={view} story={story} />

          <Panel title={t('badges')} label={t('badges')}>
            {earned.length === 0 ? <ReadText size={14} tone="ink-300">{t('noBadges')}</ReadText> : <EarnedBadges earned={earned} gameId={gameId} />}
            <Raised role="link" bg="night-600" place={{ marginTop: 12 }} style={{ paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }} onPress={() => go.push('collection')}>
              <PixelText size={15} tone="ink-200" style={{ textAlign: 'center' }}>{t('collection')}</PixelText>
            </Raised>
          </Panel>

          {/* A life alone that ends with an account and no game going offers one against others. In a room, the room says what is next. */}
          {extra ? null : <VersusOthers />}

          <View style={{ gap: 12, paddingTop: 8 }}>
            <ShareCard ops={picture} fileName={`rat-race-${lifeId.replace(/_/g, '-')}-${score.total}.png`} alt={share('alt', { life: lifeName, score: fmt.number(score.total) })} opened={opened.share === true} />
            {/* Another life takes the place of this screen; the front door is wherever it stands in the stack. */}
            <Raised role="link" tone={GOLD} bg="gold-500" style={{ minHeight: 48, paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' }} onPress={() => go.replace('new')}>
              <PixelText size={19} tone="ink-900" style={{ textAlign: 'center' }}>{t('again')}</PixelText>
            </Raised>
            <Raised role="link" bg="night-600" style={{ paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' }} onPress={() => go.home()}>
              <PixelText size={17} style={{ textAlign: 'center' }}>{t('home')}</PixelText>
            </Raised>
          </View>
        </>
      ) : null}
    </Screen>
  );
}

/**
 * The badges of a life, two a row and named only: what each asks is in its sheet, so a long life
 * does not make a long page. A badge won for the first time says so in its sheet.
 */
function EarnedBadges({ earned, gameId }: { earned: string[]; gameId: string | null }) {
  const { text } = useWords();
  const badges = useT('badges');
  const common = useT('common');
  const profile = useProfile();
  const [open, setOpen] = useState<string | null>(null);
  const isNew = (id: string) => profile.badges[id]?.gameId === gameId;
  const rows: string[][] = [];
  for (let i = 0; i < earned.length; i += 2) rows.push(earned.slice(i, i + 2));
  return (
    <>
      <View role="list" style={{ gap: 8 }}>
        {rows.map((row) => (
          <View key={row.join(' ')} style={{ flexDirection: 'row', gap: 8 }}>
            {row.map((id) => (
              <View role="listitem" key={id} style={{ flex: 1, minWidth: 0 }}>
                <EarnedBadge id={id} name={text.badges[id]?.name ?? id} fresh={isNew(id) ? badges('isNew') : null} onOpen={setOpen} />
              </View>
            ))}
            {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
          </View>
        ))}
      </View>
      {open !== null ? (
        <Sheet open onClose={() => setOpen(null)} title={text.badges[open]?.name ?? open} closeLabel={common('close')}>
          <View style={{ alignItems: 'center', gap: 12 }}>
            <Medal badgeId={open} />
            <ReadText size={14} tone="ink-200" lineHeight={14 * SNUG} style={{ textAlign: 'center' }}>{text.badges[open]?.how ?? ''}</ReadText>
            {isNew(open) ? <Tag tone="good">{badges('isNew')}</Tag> : null}
          </View>
        </Sheet>
      ) : null}
    </>
  );
}

/** One badge of the life, a button that opens its sheet: its medal, its name, and (for a screen reader) that it is new. */
const EarnedBadge = memo(function EarnedBadge({ id, name, fresh, onOpen }: { id: string; name: string; fresh: string | null; onOpen(id: string): void }) {
  const press = usePress({ onPress: () => onOpen(id) });
  return (
    <Pressable accessibilityRole="button" onPress={press} style={({ pressed }) => ({ ...pressDown(pressed), minHeight: 44, width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 })}>
      <Medal badgeId={id} size="sm" />
      <PixelText size={14} lineHeight={14 * TIGHT} style={{ flex: 1, minWidth: 0 }}>{name}</PixelText>
      {fresh ? <SrOnly>{fresh}</SrOnly> : null}
    </Pressable>
  );
});

/**
 * A life the one just finished opened: who it is, and a way to begin it at once, on this very screen (the round store opens it, and Play draws it). If it
 * cannot begin from here, the page where a life is chosen, where that is asked, takes this screen's place.
 */
function UnlockedLife({ lifeId }: { lifeId: string }) {
  const t = useT('end');
  const { text } = useWords();
  const go = useGo();
  const start = useGame((s) => s.start);
  const ranking = useRanking();
  const [starting, setStarting] = useState(false);
  const words = text.lives[lifeId];
  const tryIt = async () => {
    setStarting(true);
    try {
      // In place of this screen, as another life is begun from it: never a second Play on the stack.
      if (!(await start(lifeId, { ranked: ranking === 'yes' }))) go.replace('new');
    } catch (error) {
      console.error('the life could not be started:', error);
      go.replace('new');
    } finally {
      setStarting(false);
    }
  };
  return (
    <Rising>
      <Framed kind="frame" tone={GOLD} accessibilityLabel={t('unlockedTitle')} style={{ backgroundColor: COLORS['gold-500'], padding: 8 }}>
        <View accessible role="status">
          <PixelText size={16} tone="ink-900" style={{ textAlign: 'center' }}>{t('unlocked', { life: words?.name ?? lifeId })}</PixelText>
        </View>
        <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Well style={{ width: 68, height: 68 }}>
            <Sprite id={portraitArt(lifeId, 22)} fallback={{ w: 64, h: 64 }} />
          </Well>
          <ReadText size={13} tone="ink-900" lineHeight={13 * SNUG} style={{ flex: 1, minWidth: 0 }}>{t('unlockedBody', { life: words?.name ?? lifeId, perk: words?.perk ?? '' })}</ReadText>
        </View>
        <View style={{ marginTop: 8 }}>
          <Button variant="primary" wide disabled={starting} onPress={() => void tryIt()}>
            {t('tryNow')}
          </Button>
        </View>
      </Framed>
    </Rising>
  );
}

/** After a life alone, for a player with an account and no game going: the same kind of life, against others, in one press. */
function VersusOthers() {
  const t = useT('end');
  const track = useTrack();
  const go = useGo();
  const status = useRoom((s) => s.status);
  const busy = useRoom((s) => s.busy);
  const quick = useRoom((s) => s.quick);
  if (status !== 'none') return null;
  return (
    <Panel title={t('versusTitle')} label={t('versusTitle')}>
      <ReadText size={14} tone="ink-200" lineHeight={14 * SNUG}>{t('versusAbout')}</ReadText>
      <View style={{ marginTop: 12 }}>
        <Button
          variant="secondary"
          wide
          disabled={busy}
          onPress={() => {
            // Seated or not, the rooms' page says how it went: the lobby, or why not.
            void quick().then((joined) => {
              if (joined) track({ name: 'game_join', via: 'quick' });
              go.push('room');
            });
          }}
        >
          <Sprite id="icon.multiplayer" />
          {t('versusQuick')}
        </Button>
      </View>
    </Panel>
  );
}
