'use client';

import { careerArt, focusArt, skillArt, workArt } from '@ratrace/content';
import { quoteSkills, quoteWork, SKILLS } from '@ratrace/engine';
import type { Content, GameView, SkillId, SkillQuote, SkillsQuote, WorkQuote } from '@ratrace/engine';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useT, useWords } from '@/game/context';
import { ageAt } from '@/game/present';
import { Bar, Bare, Panel, Row, Tag } from '@/ui/kit';
import { Sheet } from '@/ui/overlay';
import { Sprite } from '@/ui/Sprite';

type About = 'career' | 'finance' | 'focus' | SkillId;
const TITLE: Record<'career' | 'finance' | 'focus', string> = { career: 'careerTitle', finance: 'financeTitle', focus: 'focusTitle' };
const isSkill = (about: About): about is SkillId => (SKILLS as readonly string[]).includes(about);

/** A level out of three, in squares: filled up to where the player is. */
function Pips({ level }: { level: number }) {
  return (
    <span aria-hidden className="flex shrink-0 gap-1">
      {[1, 2, 3].map((at) => (
        <span key={at} className={`size-2.5 ${at <= level ? 'bg-gold-500' : 'bg-night-900'}`} />
      ))}
    </span>
  );
}

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
  const skills = quoteSkills(content, shown);
  const life = shown.player.life;
  const job = life.career;
  const titles = job ? text.careers[job.id].levels : [];
  const rung = work.level === null ? null : work.ladder[work.level];
  const next = work.level === null ? undefined : work.ladder[work.level + 1];
  const perYear = (cents: number) => common('perYear', { amount: fmt.money(cents) });

  return (
    <Panel title={t('title')} label={t('title')}>
      <Opener onOpen={() => setAbout('career')}>
        {/* Where the player works, as it looks from the rung they are on. */}
        {job && rung ? (
          <div className="frame sunk mb-2 mt-1 flex justify-center overflow-hidden bg-night-900 leading-[0]">
            <Sprite id={workArt(job.id, rung.level, work.ladder.length)} fallback={{ w: 288, h: 120 }} className="max-w-none" />
          </div>
        ) : null}
        <div className="flex items-start justify-between gap-3 pt-1">
          <div className="flex min-w-0 items-center gap-2">
            {job ? (
              <Bare className="size-8">
                <Sprite id={careerArt(job.id)} />
              </Bare>
            ) : null}
            <div className="min-w-0">
              <div className="pixel truncate text-[17px]">{job && rung ? titles[rung.level] : t('noJob')}</div>
              <div className="truncate text-[12px] text-ink-300">{job ? text.careers[job.id].name : t('noJobSub')}</div>
            </div>
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
                {/* The count never wraps; the name of the next job gives way to it and is cut short if it must be. */}
                <div className="mt-1 flex items-baseline justify-between gap-3 text-[12px] text-ink-300">
                  <span className="shrink-0 whitespace-nowrap">{t('skillOf', { skill: work.skill, need: next.minSkill })}</span>
                  <span className="min-w-0 truncate text-right">
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
      <Opener onOpen={() => setAbout('focus')}>
        <Row className="border-t-2 border-night-900" left={t('focus')} sub={work.focus.bonus === 0 ? t('focusSub') : work.traits.focus === 0 ? t('focusRested', { n: work.focus.bonus }) : work.traits.focus === work.focus.bonus ? t('focusJob', { n: work.focus.bonus }) : t('focusExtra', { n: work.focus.bonus })} right={<>{`${work.focus.left}/${work.focus.total}`}<More /></>} />
      </Opener>

      {/* What the player knows besides the trade: set off by a rule, one line each, every line opening its levels. */}
      <section aria-label={t('skills')} className="border-t-2 border-night-900 pt-2">
        <p className="pixel text-[12px] uppercase tracking-wider text-gold-200">{t('skills')}</p>
        <ul className="flex flex-col">
          <li>
            <SkillLine icon={skillArt.finance} name={t('finance')} level={life.financeSkill} sub={t('financeLevel', { level: life.financeSkill })} onOpen={() => setAbout('finance')} />
          </li>
          {skills.skills.map((skill) => (
            <li key={skill.skill}>
              <SkillLine
                icon={skillArt[skill.skill]}
                name={text.skills[skill.skill]}
                level={skill.level}
                sub={skill.next === null ? t('skillTop') : t('skillPoints', { points: skill.points, next: skill.next })}
                onOpen={() => setAbout(skill.skill)}
              />
            </li>
          ))}
        </ul>
      </section>

      {about ? (
        <Sheet open onClose={() => setAbout(null)} title={isSkill(about) ? text.skills[about] : t(TITLE[about])} closeLabel={common('close')}>
          <div className="flex flex-col gap-3">
            {isSkill(about) ? (
              <SkillLevels skill={skills.skills.find((s) => s.skill === about) as SkillQuote} />
            ) : about === 'career' ? (
              <CareerLadder work={work} shown={shown} />
            ) : about === 'finance' ? (
              <FinanceLevels finance={skills.finance} />
            ) : (
              <FocusUses work={work} skills={skills} />
            )}
          </div>
        </Sheet>
      ) : null}
    </Panel>
  );
}

/** One skill in the list: its sign, its name, how far along it is, and its level in squares. */
function SkillLine({ icon, name, level, sub, onOpen }: { icon: string; name: string; level: number; sub: string; onOpen(): void }) {
  return (
    <Opener onOpen={onOpen}>
      <span className="flex items-center gap-2.5 py-1">
        <Bare className="size-8">
          <Sprite id={icon} />
        </Bare>
        <span className="min-w-0 flex-1">
          <span className="block truncate">{name}</span>
          <span className="block truncate text-[12px] text-ink-300">{sub}</span>
        </span>
        <Pips level={level} />
        <More />
      </span>
    </Opener>
  );
}

/** What each level of a skill gives, all of it counted at that level: the figures of the rules, times the level. */
function skillGives(t: ReturnType<typeof useT>, content: Content, skill: SkillId, level: number): string[] {
  const r = content.life.skills;
  switch (skill) {
    case 'negotiation':
      return [
        t('skillDoes.negotiation', { hunt: level * r.negotiationHuntRaisePct, promo: level * r.negotiationPromotionPct, sale: level * r.negotiationSalePct }),
        ...(level >= 2 ? [t('skillDoes.negotiationCards')] : []),
      ];
    case 'languages':
      return [
        t('skillDoes.languages', { off: level * r.languagesMoveOffPct }),
        ...(level >= r.languagesKeepRungFrom ? [t('skillDoes.languagesRung')] : []),
        ...(level >= r.languagesPartnerFrom ? [t('skillDoes.languagesPartner')] : []),
      ];
    case 'network':
      return [t('skillDoes.network', { hunt: level * r.networkHuntPct, status: level * r.networkStatus }), ...(level >= 2 ? [t('skillDoes.networkCards')] : [])];
    case 'management':
      return [
        t('skillDoes.management', { profit: level * r.managementProfitPct, off: level * r.managementManagerOffPct }),
        ...(level >= r.managementExtraFrom ? [t('skillDoes.managementExtra')] : []),
      ];
    case 'health':
      return [
        t('skillDoes.health', { off: level * r.healthPremiumOffPct }),
        ...(level >= 2 ? [t('skillDoes.healthCards')] : []),
        ...(level >= r.healthFocusFrom ? [t('skillDoes.healthFocus')] : []),
      ];
  }
}

/** A skill closely: how far it is to the next level, what every level gives, and how it is learnt, by study and by life. */
function SkillLevels({ skill }: { skill: SkillQuote }) {
  const t = useT('work');
  const { content, text } = useWords();
  return (
    <>
      <div className="flex items-center gap-3">
        <Bare className="size-12">
          <Sprite id={skillArt[skill.skill]} scale={2} />
        </Bare>
        <div className="min-w-0 flex-1">
          {skill.next === null ? (
            <p className="pixel text-[16px] text-gold-500">{t('skillTop')}</p>
          ) : (
            <>
              <Bar value={skill.points - skill.from} max={skill.next - skill.from} label={t('skillProgress', { level: skill.level + 1 })} tone="teal" />
              <p className="mt-1 text-[12px] text-ink-300">{skill.level === 0 && skill.points === 0 ? t('skillNone', { n: skill.next }) : t('skillPoints', { points: skill.points, next: skill.next })}</p>
            </>
          )}
        </div>
      </div>
      <ul className="flex flex-col gap-2">
        {([1, 2, 3] as const).map((at) => (
          <li key={at} aria-current={at === skill.level ? 'true' : undefined} className={`px-2.5 py-2 ${at === skill.level ? 'bevel frame-gold bg-night-600' : 'frame bg-night-700'} ${at > skill.level ? 'opacity-70' : ''}`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="pixel text-[16px]">{t('financeLevel', { level: at })}</span>
              {at === skill.level ? <Tag tone="good">{t('yourLevel')}</Tag> : at > skill.level ? <Tag>{t('locked')}</Tag> : null}
            </div>
            {skillGives(t, content, skill.skill, at).map((line) => (
              <p key={line} className="mt-1 text-[13px] leading-snug text-ink-200">
                {line}
              </p>
            ))}
          </li>
        ))}
      </ul>
      <p className="text-[13px] leading-snug">{t(`skillHow.${skill.skill}`)}</p>
      <p className="text-[12px] leading-snug text-ink-300">{t('skillsAbout')}</p>
      {skill.study ? <p className="text-[13px] leading-snug text-ink-200">{t('skillStudy', { action: text.focusActions[skill.study], n: skill.studyPoints })}</p> : null}
      <p className={`text-[12px] ${skill.practice > 0 ? 'text-teal-300' : 'text-ink-300'}`}>{skill.practice > 0 ? t('skillLiving', { n: skill.practice }) : t('skillNotLiving')}</p>
    </>
  );
}

/** Every rung of the career, the highest on top as on a ladder: what it pays this player today, what it gives and what it asks. */
function CareerLadder({ work, shown }: { work: WorkQuote; shown: GameView }) {
  const t = useT('work');
  const common = useT('common');
  const { content, text, names, fmt } = useWords();
  const job = shown.player.life.career;
  const traits = work.traits;
  if (!job || work.level === null) return <p className="text-[14px] leading-snug">{t('noJobAbout')}</p>;
  const titles = text.careers[job.id].levels;
  const level = work.level;

  return (
    <>
      <p className="text-[14px] leading-snug">{t('careerAbout', { career: text.careers[job.id].name, work: work.workSkill, study: work.studySkill })}</p>
      {/* What sets this career apart from the others, in the figures of this round. */}
      {traits.follows || traits.fade || traits.focus > 0 ? (
        <ul aria-label={t('traits')} className="flex flex-col gap-1 border-l-4 border-gold-500 pl-3 text-[13px] leading-snug">
          {traits.follows ? <li>{t(traits.cyclePct > 0 ? 'cycleUp' : traits.cyclePct < 0 ? 'cycleDown' : 'cycleFlat', { pct: Math.abs(traits.cyclePct) })}</li> : null}
          {traits.fade ? (
            <li>
              {traits.fadePct < 0
                ? t('fadeNow', { pct: -traits.fadePct, max: traits.fade.maxPct })
                : t('fadeLater', { age: ageAt(content, traits.fade.fromRound), pct: traits.fade.pctPerRound, max: traits.fade.maxPct })}
            </li>
          ) : null}
          {traits.focus > 0 ? <li>{t('jobFocus', { n: traits.focus })}</li> : null}
        </ul>
      ) : null}
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
function FinanceLevels({ finance }: { finance: SkillsQuote['finance'] }) {
  const t = useT('work');
  const { content } = useWords();
  const years = content.life.financeExperienceRounds * content.yearsPerRound;
  const level = finance.level;

  return (
    <>
      <p className="text-[14px] leading-snug">{t('financeAbout')}</p>
      {/* How far experience has taken it, in the years the player counts in. */}
      {finance.nextAt !== null ? (
        <div>
          <Bar value={finance.investedRounds} max={finance.nextAt} label={t('financeProgress')} tone="teal" />
          <p className="mt-1 text-[12px] text-ink-300">
            {t('financeProgress')}: {finance.investedRounds * content.yearsPerRound}/{finance.nextAt * content.yearsPerRound}
            {finance.investing ? '' : ` · ${t('financeIdle')}`}
          </p>
        </div>
      ) : level < 2 ? (
        <p className="text-[12px] text-ink-300">{t('financeStuck')}</p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {([0, 1, 2, 3] as const).map((at) => {
          const opens = content.assets.filter((asset) => (asset.minFinanceSkill ?? 0) === at).length;
          return (
            <li key={at} aria-current={at === level ? 'true' : undefined} className={`px-2.5 py-2 ${at === level ? 'bevel frame-gold bg-night-600' : 'frame bg-night-700'} ${at > level ? 'opacity-70' : ''}`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="pixel text-[16px]">{t('financeLevel', { level: at })}</span>
                {at === level ? <Tag tone="good">{t('yourLevel')}</Tag> : at > level ? <Tag>{t('locked')}</Tag> : null}
              </div>
              <p className="mt-1 text-[13px] leading-snug text-ink-200">{t(`financeOpens.${at}`, { n: opens })}</p>
              {content.debt.marginMinFinanceSkill === at ? <p className="mt-0.5 text-[13px] leading-snug text-ink-200">{t('financeMargin')}</p> : null}
              {content.life.rentOutMinFinanceSkill === at ? <p className="mt-0.5 text-[13px] leading-snug text-ink-200">{t('financeLandlord')}</p> : null}
            </li>
          );
        })}
      </ul>
      <p className="text-[12px] text-ink-300">
        {level < 2 ? t('financeHow', { years }) : level === 2 ? t('financeMaster', { years: content.life.financeMasterRounds * content.yearsPerRound }) : t('financeTop')}
      </p>
    </>
  );
}

/** What a round's focus can be spent on, and what each use is worth to this player as they stand. */
function FocusUses({ work, skills }: { work: WorkQuote; skills: SkillsQuote }) {
  const t = useT('work');
  const { text } = useWords();
  const job: Array<{ icon: string; name: string; gives: string }> = [
    { icon: focusArt.overtime, name: t('overtime'), gives: t('overtimeGives', { pct: work.overtimePct }) },
    { icon: focusArt.studyCareer, name: t('study'), gives: t('studyGives', { n: work.studySkill }) },
    { icon: focusArt.jobHunt, name: t('hunt'), gives: t('huntGives', { pct: work.jobHuntChancePct, raise: work.jobHuntRaisePct }) },
  ];
  // Learning needs no job: it is on the list whatever the player does for a living.
  const learning = skills.skills.flatMap((skill) =>
    skill.study === null ? [] : [{ icon: focusArt[skill.study], name: text.focusActions[skill.study], gives: t('learnGives', { n: skill.studyPoints, skill: text.skills[skill.skill] }) }],
  );
  const uses = [...(work.level === null ? [] : job), ...learning];

  return (
    <>
      <p className="text-[14px] leading-snug">
        {t('focusAbout', { total: work.focus.total })} {work.traits.focus > 0 ? t('focusFromJob', { n: work.traits.focus }) : ''}{' '}
        {work.focus.bonus > work.traits.focus ? t('focusBonus', { n: work.focus.bonus - work.traits.focus }) : ''}
      </p>
      <div className="frame bg-night-800 px-3 py-2 text-center">
        <span className="pixel text-[22px] text-gold-500">{`${work.focus.left}/${work.focus.total}`}</span>
        <p className="text-[12px] text-ink-300">{t('focusLeft')}</p>
      </div>
      {work.level === null ? <p className="text-[14px] leading-snug text-ink-200">{t('focusNoJob')}</p> : null}
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
      <p className="text-[13px] leading-snug text-ink-200">{t('focusAlso')}</p>
      {work.perks.studySkill > 0 || work.perks.jobHuntPct > 0 ? <p className="text-[12px] text-teal-300">{t('focusThings')}</p> : null}
      <p className="text-center text-[12px] text-ink-300">{t('focusWhere')}</p>
    </>
  );
}
