'use client';

import { focusArt } from '@ratrace/content';
import { quoteWork } from '@ratrace/engine';
import type { FinanceSkill, GameView, WorkQuote } from '@ratrace/engine';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useT, useWords } from '@/game/context';
import { Bar, Bare, Panel, Row, Tag } from '@/ui/kit';
import { Sheet } from '@/ui/overlay';
import { Sprite } from '@/ui/Sprite';

type About = 'career' | 'finance' | 'focus';
const TITLE: Record<About, string> = { career: 'careerTitle', finance: 'financeTitle', focus: 'focusTitle' };

const More = () => (
  <span aria-hidden className="ml-1.5 text-[11px] text-ink-300">
    ▸
  </span>
);

/** A line of the panel that opens what stands behind it. Tall enough for a thumb. */
function Opener({ onOpen, children }: { onOpen(): void; children: ReactNode }) {
  return (
    <button type="button" aria-haspopup="dialog" onClick={onOpen} className="flex min-h-11 w-full flex-col justify-center text-left">
      {children}
    </button>
  );
}

/**
 * The player's working life at a glance: the job and what it pays, how far the next rung is and
 * what it would pay, what they know about money and how much focus the round has left. Each line
 * opens the whole of what it sums up. Every figure is the engine's own.
 */
export function WorkPanel({ shown }: { shown: GameView }) {
  const t = useT('work');
  const common = useT('common');
  const { content, text, fmt } = useWords();
  const [about, setAbout] = useState<About | null>(null);
  const work = quoteWork(content, shown);
  const life = shown.player.life;
  const job = life.career;
  const titles = job ? text.careers[job.id].levels : [];
  const rung = work.level === null ? null : work.ladder[work.level];
  const next = work.level === null ? undefined : work.ladder[work.level + 1];
  const perYear = (cents: number) => common('perYear', { amount: fmt.money(cents) });

  return (
    <Panel title={t('title')} label={t('title')}>
      <Opener onOpen={() => setAbout('career')}>
        <div className="flex items-start justify-between gap-3 pt-1">
          <div className="min-w-0">
            <div className="pixel truncate text-[17px]">{job && rung ? titles[rung.level] : t('noJob')}</div>
            <div className="truncate text-[12px] text-ink-300">{job ? text.careers[job.id].name : t('noJobSub')}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="pixel text-[16px] text-gold-500">
              {perYear(work.payAnnual)}
              <More />
            </div>
            {rung && rung.status > 0 ? (
              <div className="mt-0.5">
                <Tag tone="good">{t('status', { n: rung.status })}</Tag>
              </div>
            ) : null}
          </div>
        </div>
        {rung ? (
          <div className="mt-2 pb-1.5">
            {next ? (
              <>
                <Bar value={work.skill - rung.minSkill} max={next.minSkill - rung.minSkill} label={t('toNext', { title: titles[next.level] })} tone="teal" />
                <div className="mt-1 flex items-baseline justify-between gap-3 text-[12px] text-ink-300">
                  <span>{t('skillOf', { skill: work.skill, need: next.minSkill })}</span>
                  <span className="truncate text-right">
                    {t('nextIs', { title: titles[next.level] })} · <span className="text-gold-500">{perYear(next.payAnnual)}</span>
                  </span>
                </div>
              </>
            ) : (
              <p className="text-[12px] text-ink-300">{t('top', { skill: work.skill })}</p>
            )}
          </div>
        ) : null}
      </Opener>
      <Opener onOpen={() => setAbout('finance')}>
        <Row className="border-t-2 border-night-900" left={t('finance')} sub={t('financeSub')} right={<>{`${life.financeSkill}/2`}<More /></>} />
      </Opener>
      <Opener onOpen={() => setAbout('focus')}>
        <Row className="border-t-2 border-night-900" left={t('focus')} sub={work.focus.bonus > 0 ? t('focusRested', { n: work.focus.bonus }) : t('focusSub')} right={<>{`${work.focus.left}/${work.focus.total}`}<More /></>} />
      </Opener>

      {about ? (
        <Sheet open onClose={() => setAbout(null)} title={t(TITLE[about])} closeLabel={common('close')}>
          <div className="flex flex-col gap-3">
            {about === 'career' ? <CareerLadder work={work} shown={shown} /> : about === 'finance' ? <FinanceLevels level={life.financeSkill} /> : <FocusUses work={work} />}
          </div>
        </Sheet>
      ) : null}
    </Panel>
  );
}

/** Every rung of the career, the highest on top as on a ladder: what it pays this player today, what it gives and what it asks. */
function CareerLadder({ work, shown }: { work: WorkQuote; shown: GameView }) {
  const t = useT('work');
  const common = useT('common');
  const { text, names, fmt } = useWords();
  const job = shown.player.life.career;
  if (!job || work.level === null) return <p className="text-[14px] leading-snug">{t('noJobAbout')}</p>;
  const titles = text.careers[job.id].levels;
  const level = work.level;

  return (
    <>
      <p className="text-[14px] leading-snug">{t('careerAbout', { career: text.careers[job.id].name, work: work.workSkill, study: work.studySkill })}</p>
      <ol reversed className="flex flex-col-reverse gap-2">
        {work.ladder.map((rung) => {
          const here = rung.level === level;
          const gap = rung.minSkill - work.skill;
          return (
            <li
              key={rung.level}
              aria-current={here ? 'step' : undefined}
              className={`px-2.5 py-2 ${here ? 'bevel frame-gold bg-night-600' : 'frame bg-night-700'} ${rung.level < level ? 'opacity-60' : ''}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="pixel text-[16px]">{titles[rung.level]}</span>
                <span className="pixel shrink-0 text-[15px] text-gold-500">{common('perYear', { amount: fmt.money(rung.payAnnual) })}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {here ? <Tag tone="good">{t('yourRung')}</Tag> : null}
                {rung.status > 0 ? <Tag tone="good">{t('status', { n: rung.status })}</Tag> : null}
                {rung.level > level ? <Tag>{gap > 0 ? t('needs', { skill: rung.minSkill, gap }) : t('reached')}</Tag> : null}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="text-[12px] text-ink-300">{t('ladderNote', { city: names.cities[shown.player.cityId] })}</p>
    </>
  );
}

/** What each level of knowing about money lets the player do on their own, and how the next is reached. */
function FinanceLevels({ level }: { level: FinanceSkill }) {
  const t = useT('work');
  const { content } = useWords();
  const years = content.life.financeExperienceRounds * content.yearsPerRound;

  return (
    <>
      <p className="text-[14px] leading-snug">{t('financeAbout')}</p>
      <ul className="flex flex-col gap-2">
        {([0, 1, 2] as const).map((at) => {
          const opens = content.assets.filter((asset) => (asset.minFinanceSkill ?? 0) === at).length;
          return (
            <li key={at} aria-current={at === level ? 'true' : undefined} className={`px-2.5 py-2 ${at === level ? 'bevel frame-gold bg-night-600' : 'frame bg-night-700'} ${at > level ? 'opacity-70' : ''}`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="pixel text-[16px]">{t('financeLevel', { level: at })}</span>
                {at === level ? <Tag tone="good">{t('yourLevel')}</Tag> : at > level ? <Tag>{t('locked')}</Tag> : null}
              </div>
              <p className="mt-1 text-[13px] leading-snug text-ink-200">{t(`financeOpens.${at}`, { n: opens })}</p>
              {content.life.rentOutMinFinanceSkill === at ? <p className="mt-0.5 text-[13px] leading-snug text-ink-200">{t('financeLandlord')}</p> : null}
            </li>
          );
        })}
      </ul>
      <p className="text-[12px] text-ink-300">{level < 2 ? t('financeHow', { years }) : t('financeTop')}</p>
    </>
  );
}

/** What a round's focus can be spent on, and what each use is worth to this player as they stand. */
function FocusUses({ work }: { work: WorkQuote }) {
  const t = useT('work');
  const uses: Array<{ icon: string; name: string; gives: string }> = [
    { icon: focusArt.overtime, name: t('overtime'), gives: t('overtimeGives', { pct: work.overtimePct }) },
    { icon: focusArt.studyCareer, name: t('study'), gives: t('studyGives', { n: work.studySkill }) },
    { icon: focusArt.jobHunt, name: t('hunt'), gives: t('huntGives', { pct: work.jobHuntChancePct, raise: work.jobHuntRaisePct }) },
  ];

  return (
    <>
      <p className="text-[14px] leading-snug">
        {t('focusAbout', { total: work.focus.total })} {work.focus.bonus > 0 ? t('focusBonus', { n: work.focus.bonus }) : ''}
      </p>
      <div className="frame bg-night-800 px-3 py-2 text-center">
        <span className="pixel text-[22px] text-gold-500">{`${work.focus.left}/${work.focus.total}`}</span>
        <p className="text-[12px] text-ink-300">{t('focusLeft')}</p>
      </div>
      {work.level === null ? (
        <p className="text-[14px] leading-snug text-ink-200">{t('focusNoJob')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {uses.map((use) => (
            <li key={use.name} className="frame flex items-start gap-3 bg-night-700 px-2.5 py-2">
              <Bare className="size-9">
                <Sprite id={use.icon} />
              </Bare>
              <div className="min-w-0">
                <div className="pixel text-[16px]">{use.name}</div>
                <p className="text-[13px] leading-snug text-ink-200">{use.gives}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[13px] leading-snug text-ink-200">{t('focusAlso')}</p>
      {work.perks.studySkill > 0 || work.perks.jobHuntPct > 0 ? <p className="text-[12px] text-teal-300">{t('focusThings')}</p> : null}
      <p className="text-center text-[12px] text-ink-300">{t('focusWhere')}</p>
    </>
  );
}
