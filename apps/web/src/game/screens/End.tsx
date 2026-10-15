'use client';

import { badgeArt, endingArt, GIFT_ART, lives, PERCENTILE_ART, portraitArt, rarityOf } from '@ratrace/content';
import { useEffect, useMemo, useState } from 'react';
import { netWorth, realNetWorth, scoreBreakdown } from '@ratrace/engine';
import type { GameView } from '@ratrace/engine';
import { useCommunity, useGame, useProfile, useRuns, useSettings, useT, useWords } from '@/game/context';
import { epilogue } from '@/game/epilogue';
import { obituary } from '@/game/quips';
import { ageAt, endingOf, prizedBadge } from '@/game/present';
import { bestsOf } from '@/game/records';
import { shareCard } from '@/game/share';
import type { Best } from '@/game/records';
import { Link } from '@/i18n/navigation';
import { Panel, Tag, Well } from '@/ui/kit';
import { Sheet } from '@/ui/overlay';
import { Sprite } from '@/ui/Sprite';
import { ChallengeResult } from './Challenge';
import { Loop } from './Loop';
import { Medal } from './Medal';
import { ShareCard } from './ShareCard';
import { WorthGraph } from './WorthGraph';

/** Fewer lives than this to compare with say nothing yet: a share of three is not a standing. */
export const COMPARE_MIN = 5;

/**
 * Where a score stands among the lives other players finished from the same start, as a share of
 * them that did worse. Nothing while it is being asked, with nobody to ask, or with too few to tell.
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

/** A figure that counts up to where it ends, once, as a score is read out. Still at once with motion reduced. */
function useCountUp(target: number, ms = 900): number {
  const { reducedMotion } = useSettings();
  const [shown, setShown] = useState(reducedMotion ? target : 0);
  useEffect(() => {
    if (reducedMotion) {
      setShown(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const done = Math.min(1, (now - start) / ms);
      // Fast at first, slowing to the last figure.
      setShown(Math.round(target * (1 - (1 - done) ** 3)));
      if (done < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, ms, reducedMotion]);
  return shown;
}

/** One figure of a life, set in a tile: what it is, and a line under it. */
function Figure({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="frame bg-night-900 px-2 py-2 text-center">
      <div className="pixel text-[18px] text-gold-500">{value}</div>
      <div className="text-[11px] leading-tight text-ink-200">{label}</div>
      {sub ? <div className="mt-0.5 text-[11px] leading-tight text-ink-300">{sub}</div> : null}
    </div>
  );
}

function Part({ label, value }: { label: string; value: string }) {
  return (
    <div className="frame bg-night-900 px-1 py-2">
      <div className="pixel text-[20px]">{value}</div>
      <div className="text-[11px] leading-tight text-ink-300">{label}</div>
    </div>
  );
}

/** How the life ended. Nothing to show until there is a life. */
export function End() {
  const view = useGame((s) => s.view);
  return view ? <Ended view={view} /> : null;
}

/** The score and the three parts it is made of, what the life earned, the graph of a lifetime, and the way to another. */
function Ended({ view }: { view: GameView }) {
  const t = useT('end');
  const tale = useT('epilogue');
  const words = useWords();
  const { content, text, names, fmt } = words;
  const history = useGame((s) => s.history);
  const story = useGame((s) => s.story);
  const bankruptcies = useGame((s) => s.bankruptcies);
  const lifeId = useGame((s) => s.lifeId) ?? '';
  const ranked = useGame((s) => s.ranked);
  const challenge = useGame((s) => s.challenge);
  const gameId = useGame((s) => s.gameId);
  const earned = useGame((s) => s.badges);
  const share = useT('share');
  const meta = useT('meta');
  const profile = useProfile();
  const runs = useRuns();

  // What this life did for the first time, as the profile recorded it: nothing is judged here.
  const isNew = (id: string) => profile.badges[id]?.gameId === gameId;
  const unlocked = Object.keys(profile.unlocked).filter((id) => profile.unlocked[id].gameId === gameId);
  const run = runs?.find((candidate) => candidate.runId === gameId);
  const bests = run && runs ? bestsOf(run, runs) : [];

  const p = view.player;
  // The engine's own breakdown: nothing about the score is worked out here.
  const score = scoreBreakdown(content, view);
  const escaped = score.multiplierPct > 100;
  const ending = endingOf(escaped, netWorth(p));
  const lifeName = text.lives[lifeId]?.name ?? lifeId;
  // The life in three paragraphs: where it began, what happened, how it ended.
  const life = lives.find((candidate) => candidate.id === lifeId);
  const told = life ? epilogue({ words, t: tale, life, view, story, score: score.total, bankruptcies }) : [];
  const dead = obituary(content, view, bankruptcies);
  const standing = useStanding(lifeId, score.total);
  const prized = prizedBadge(earned.filter(isNew));
  const outcome = p.escapedAtRound === null ? t('never') : t('escapedAt', { age: ageAt(content, p.escapedAtRound) });
  const counted = useCountUp(score.total);
  // The picture to share says what this screen says, in the figures the engine gave.
  const picture = useMemo(
    () =>
      shareCard({
        title: meta('title').toUpperCase(),
        life: lifeName,
        where: `${t('age', { age: ageAt(content, view.round) })} · ${names.cities[p.cityId]}`,
        outcome: p.escapedAtRound === null ? share('never') : share('escapedAt', { age: ageAt(content, p.escapedAtRound) }),
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

  return (
    <main className="mx-auto w-full max-w-md px-3 pb-8 pt-6 lg:max-w-5xl">
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-4">
          <header className="flex items-center gap-3">
            <span className="frame-double my-1.5 ml-1.5 shrink-0 leading-[0] [--ring:var(--color-gold-500)]">
              <Well className="size-[68px]">
                <Sprite id={portraitArt(lifeId, 58)} fallback={{ w: 64, h: 64 }} />
              </Well>
            </span>
            <div className="min-w-0">
              <h1 className="pixel text-[30px] leading-none text-gold-500">{t('title')}</h1>
              <p className="mt-1 text-[13px] text-ink-300">
                <span>{t('age', { age: ageAt(content, view.round) })}</span>
                {' · '}
                <span>
                  {lifeName} · {names.cities[p.cityId]}
                </span>
              </p>
            </div>
          </header>

          {/* The last picture of the life, and the verdict on it under it: where it ended up, and how. */}
          <figure data-ending={ending} className="frame-double overflow-hidden bg-night-900">
            <div className="flex justify-center leading-[0]">
              <Sprite id={endingArt(ending)} scale="art" fallback={{ w: 288, h: 120 }} className="max-w-none" />
            </div>
            <figcaption className="border-t-2 border-night-700 px-3 py-2 text-center">
              <p className={`pixel text-[17px] ${escaped ? 'text-teal-300' : 'text-cream'}`}>{outcome}</p>
              <p className="text-[12px] text-ink-300">{t('bankruptcies', { count: bankruptcies })}</p>
            </figcaption>
          </figure>

          <section role="group" aria-label={t('score')} className="bevel frame-gold animate-rise bg-night-700 p-4 text-center">
            <p className="pixel text-[15px] uppercase tracking-[0.1em] text-gold-200">{t('score')}</p>
            <p aria-label={fmt.number(score.total)} className="pixel mt-1 text-[60px] leading-none text-gold-500">
              <span aria-hidden>{fmt.number(counted)}</span>
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Part label={t('wealth')} value={fmt.number(score.wealth)} />
              <Part label={t('status')} value={fmt.number(score.status)} />
              <Part label={escaped ? t('bonus', { multiplier: fmt.factor(score.multiplierPct) }) : t('noBonus')} value={`×${fmt.factor(score.multiplierPct)}`} />
            </div>
            <p className="mt-3 text-[12px] text-ink-300">{t('statusHint')}</p>
            {/* What was given to the children in life is counted in the wealth as the player's own. */}
            {p.life.legacy > 0 ? (
              <p className="mt-1 flex items-center justify-center gap-1 text-[12px] text-teal-300">
                <Sprite id={GIFT_ART} />
                {t('legacy', { amount: fmt.money(p.life.legacy) })}
              </p>
            ) : null}
            {standing ? (
              <p role="status" className="mt-3 flex items-center justify-center gap-2 text-[13px] text-teal-300">
                <Sprite id={PERCENTILE_ART} />
                {t('compare', { pct: standing.pct, life: lifeName, total: standing.total })}
              </p>
            ) : null}
            {ranked ? (
              <Link href="/rankings" className="pixel frame-raised mt-3 flex min-h-11 items-center justify-center gap-2 bg-night-600 px-3 text-[15px] text-teal-300">
                <Sprite id="icon.trophy" />
                {t('rankedLink')}
              </Link>
            ) : null}
          </section>

          {/* A rare or legendary badge won for the first time is cheered, the rarest first. */}
          {prized ? (
            <p role="status" className="frame frame-gold pixel animate-rise relative flex items-center justify-center gap-2 overflow-hidden bg-night-600 px-3 py-2 text-center text-[16px] text-gold-200">
              <Loop name="confetti" className="absolute left-2" />
              {t(rarityOf(prized.id) === 'legendary' ? 'legendaryBadge' : 'rareBadge', { name: text.badges[prized.id]?.name ?? prized.id })}
              <Loop name="confetti" className="absolute right-2" />
            </p>
          ) : null}

          {bests.length > 0 || unlocked.length > 0 ? (
            <div className="flex flex-col gap-2">
              {bests.map((best) => (
                <p key={best} role="status" className="frame frame-gold pixel animate-rise bg-gold-500 px-3 py-2 text-center text-[16px] text-ink-900">
                  {t(BEST[best])}
                </p>
              ))}
              {unlocked.map((id) => (
                <p key={id} role="status" className="frame frame-gold pixel animate-rise bg-gold-500 px-3 py-2 text-center text-[16px] text-ink-900">
                  {t('unlocked', { life: text.lives[id]?.name ?? id })}
                </p>
              ))}
            </div>
          ) : null}

          {/* The week's attempt, beside everyone else's: its place, and the choices that set it apart. */}
          {ranked && challenge !== null ? <ChallengeResult week={challenge} /> : null}

          {told.length > 0 ? (
            <Panel title={tale('title')} label={tale('title')}>
              {told.map((paragraph, i) => (
                <p key={i} className="animate-rise text-[14px] leading-relaxed [&+p]:mt-2.5" style={{ animationDelay: `${300 + i * 350}ms` }}>
                  {paragraph}
                </p>
              ))}
              {/* The life in one dry line, as a newspaper would have it, set off by a rule. */}
              <p className="mt-3 animate-rise border-t-2 border-night-900 pt-2.5 text-[13px] leading-snug" style={{ animationDelay: `${300 + told.length * 350}ms` }}>
                <span className="pixel uppercase tracking-wider text-ink-300">{tale('obituary.title')}: </span>
                <span className="italic">{tale(`obituary.${dead.key}`, { n: dead.n ?? 0 })}</span>
              </p>
            </Panel>
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          {/* The life in a few figures, and the line of its wealth from the first day to the last. */}
          <Panel title={t('figures')} label={t('figures')}>
            <div className="grid grid-cols-2 gap-2">
              <Figure label={t('netWorth')} value={fmt.compact(netWorth(p))} sub={t('realShort', { amount: fmt.compact(realNetWorth(view)) })} />
              <Figure label={t('peak')} value={fmt.compact(peak.worth)} sub={t('peakAge', { age: ageAt(content, peak.round) })} />
              <Figure label={t('escapeAge')} value={p.escapedAtRound === null ? '—' : String(ageAt(content, p.escapedAtRound))} />
              <Figure label={t('badgesCount')} value={String(earned.length)} sub={fresh > 0 ? t('badgesNew', { n: fresh }) : undefined} />
            </div>
            <div className="mt-3">
              <WorthGraph history={history} label={t('graph')} />
            </div>
            <p className="mt-2 text-center text-[12px] text-ink-300">{t('graph')}</p>
          </Panel>

          <Panel title={t('badges')} label={t('badges')}>
            {earned.length === 0 ? <p className="text-[14px] text-ink-300">{t('noBadges')}</p> : <EarnedBadges earned={earned} isNew={isNew} />}
            <Link href="/collection" className="pixel frame-raised mt-3 flex min-h-11 items-center justify-center bg-night-600 px-3 text-[15px] text-ink-200">
              {t('collection')}
            </Link>
          </Panel>

          <div className="flex flex-col gap-3 pt-2">
            <ShareCard ops={picture} fileName={`rat-race-${lifeId.replace(/_/g, '-')}-${score.total}.png`} alt={share('alt', { life: lifeName, score: fmt.number(score.total) })} />
            <Link href="/new" className="pixel frame-raised frame-gold flex min-h-12 items-center justify-center bg-gold-500 px-4 py-2 text-center text-[19px] text-ink-900">
              {t('again')}
            </Link>
            <Link href="/" className="pixel frame-raised flex min-h-11 items-center justify-center bg-night-600 px-4 py-2 text-center text-[17px] text-cream">
              {t('home')}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

/**
 * The badges of a life, two a row and named only: what each asks is in its sheet, so a long life
 * does not make a long page. A badge won for the first time wears a gold dot.
 */
function EarnedBadges({ earned, isNew }: { earned: string[]; isNew(id: string): boolean }) {
  const { text } = useWords();
  const badges = useT('badges');
  const common = useT('common');
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <ul className="grid grid-cols-2 gap-2">
        {earned.map((id) => (
          <li key={id}>
            <button type="button" onClick={() => setOpen(id)} className="flex min-h-11 w-full items-center gap-2 py-1 text-left transition-transform active:translate-y-[2px]">
              <Medal badgeId={id} size="sm" />
              <span className="pixel min-w-0 flex-1 text-[14px] leading-tight">{text.badges[id]?.name ?? id}</span>
              {isNew(id) ? (
                <span className="size-2.5 shrink-0 bg-gold-500" title={badges('isNew')}>
                  <span className="sr-only">{badges('isNew')}</span>
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
      {open !== null ? (
        <Sheet open onClose={() => setOpen(null)} title={text.badges[open]?.name ?? open} closeLabel={common('close')}>
          <div className="flex flex-col items-center gap-3 text-center">
            <Medal badgeId={open} />
            <p className="text-[14px] leading-snug text-ink-200">{text.badges[open]?.how}</p>
            {isNew(open) ? <Tag tone="good">{badges('isNew')}</Tag> : null}
          </div>
        </Sheet>
      ) : null}
    </>
  );
}
