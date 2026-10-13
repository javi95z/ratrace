'use client';

import { badgeArt, lives, portraitArt } from '@ratrace/content';
import { useMemo } from 'react';
import { netWorth, realNetWorth, scoreBreakdown } from '@ratrace/engine';
import type { GameView } from '@ratrace/engine';
import { useGame, useProfile, useRuns, useT, useWords } from '@/game/context';
import { epilogue } from '@/game/epilogue';
import { ageAt } from '@/game/present';
import { bestsOf } from '@/game/records';
import { shareCard } from '@/game/share';
import type { Best } from '@/game/records';
import { Link } from '@/i18n/navigation';
import { Panel, Row, Tag, Well } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';
import { ShareCard } from './ShareCard';
import { WorthGraph } from './WorthGraph';

const BEST: Record<Best, string> = { score: 'bestScore', netWorth: 'bestNetWorth', escape: 'bestEscape', status: 'bestStatus' };

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
  const gameId = useGame((s) => s.gameId);
  const earned = useGame((s) => s.badges);
  const badges = useT('badges');
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
  const lifeName = text.lives[lifeId]?.name ?? lifeId;
  // The life in three paragraphs: where it began, what happened, how it ended.
  const life = lives.find((candidate) => candidate.id === lifeId);
  const told = life ? epilogue({ words, t: tale, life, view, story, score: score.total, bankruptcies }) : [];
  const outcome = p.escapedAtRound === null ? t('never') : t('escapedAt', { age: ageAt(content, p.escapedAtRound) });
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

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-3 pb-8 pt-6">
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

      <section role="group" aria-label={t('score')} className="bevel frame-gold animate-rise bg-night-700 p-4 text-center">
        <p className="pixel text-[15px] uppercase tracking-[0.1em] text-gold-200">{t('score')}</p>
        <p className="pixel mt-1 text-[60px] leading-none text-gold-500">{fmt.number(score.total)}</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Part label={t('wealth')} value={fmt.number(score.wealth)} />
          <Part label={t('status')} value={fmt.number(score.status)} />
          <Part label={escaped ? t('bonus', { multiplier: fmt.factor(score.multiplierPct) }) : t('noBonus')} value={`×${fmt.factor(score.multiplierPct)}`} />
        </div>
        <p className="mt-3 text-[12px] text-ink-300">{t('statusHint')}</p>
      </section>

      {told.length > 0 ? (
        <Panel title={tale('title')} label={tale('title')}>
          {told.map((paragraph, i) => (
            <p key={i} className="animate-rise text-[14px] leading-relaxed [&+p]:mt-2.5" style={{ animationDelay: `${300 + i * 350}ms` }}>
              {paragraph}
            </p>
          ))}
        </Panel>
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

      <Panel>
        <p className={`pixel text-[17px] ${escaped ? 'text-teal-300' : ''}`}>
          {outcome}
        </p>
        <p className="mt-1 text-[13px] text-ink-300">{t('bankruptcies', { count: bankruptcies })}</p>
      </Panel>

      <Panel title={t('netWorth')}>
        <Row left={t('netWorth')} right={<span className="text-[19px] text-gold-500">{fmt.money(netWorth(p))}</span>} />
        <Row left={t('realNetWorth')} right={fmt.money(realNetWorth(view))} />
        <div className="mt-3">
          <WorthGraph history={history} label={t('graph')} />
        </div>
        <p className="mt-2 text-center text-[12px] text-ink-300">{t('graph')}</p>
      </Panel>

      <Panel title={t('badges')} label={t('badges')}>
        {earned.length === 0 ? (
          <p className="text-[14px] text-ink-300">{t('noBadges')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {earned.map((id) => (
              <li key={id} className="flex items-center gap-3">
                <Sprite id={badgeArt(id)} fallback={{ w: 64, h: 64 }} />
                <div className="min-w-0 flex-1">
                  <p className="pixel text-[16px]">{text.badges[id]?.name ?? id}</p>
                  <p className="text-[12px] leading-snug text-ink-300">{text.badges[id]?.how}</p>
                </div>
                {isNew(id) ? <Tag tone="good">{badges('isNew')}</Tag> : null}
              </li>
            ))}
          </ul>
        )}
        <Link href="/collection" className="pixel frame-raised mt-3 flex min-h-11 items-center justify-center bg-night-600 px-3 text-[15px] text-ink-200">
          {t('collection')}
        </Link>
      </Panel>

      <div className="mt-auto flex flex-col gap-3 pt-2">
        <ShareCard ops={picture} fileName={`rat-race-${lifeId.replace(/_/g, '-')}-${score.total}.png`} alt={share('alt', { life: lifeName, score: fmt.number(score.total) })} />
        <Link href="/new" className="pixel frame-raised frame-gold flex min-h-12 items-center justify-center bg-gold-500 px-4 py-2 text-center text-[19px] text-ink-900">
          {t('again')}
        </Link>
        <Link href="/" className="pixel frame-raised flex min-h-11 items-center justify-center bg-night-600 px-4 py-2 text-center text-[17px] text-cream">
          {t('home')}
        </Link>
      </div>
    </main>
  );
}
