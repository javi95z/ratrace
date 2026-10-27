import { careerArt, focusArt, RETIRED_ART, RISK_ART, skillArt, workArt } from '@ratrace/content';
import { ageAt, jobFocusName } from '@ratrace/core/game/present';
import { quoteSkills, quoteWork, SKILLS } from '@ratrace/engine';
import type { Content, FocusAction, GameView, SkillId, SkillQuote, SkillsQuote, WorkQuote } from '@ratrace/engine';
import { memo, useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { webBaseline, webLine } from '../../ui/fonts';
import { Framed } from '../../ui/Frame';
import { GOLD } from '../../ui/frames';
import { Bar, Bare, KeyFigure, LineTag, Panel, Raised, Row, Tag, Toggle, usePress } from '../../ui/kit';
import { Sheet } from '../../ui/overlay';
import { Sprite } from '../../ui/Sprite';
import { bannerSize, spriteBox } from '../../ui/sprites';
import { PixelText, ReadText, SNUG } from '../../ui/text';
import { COLORS, TOUCH } from '../../ui/theme';
import type { ColorToken } from '../../ui/theme';
import { useGame, useKnows, useSettings, useT, useWords } from '../context';
import { useRoomSlice } from '../roomSlice';
import { CareerMoves } from './CareerMoves';
import { Explain } from './Explain';
import { splitMastered, useFocusNote } from './focusNote';

/*
 * The player's working life, as the web's Work.tsx draws it: the panel that sums it up (the profile's `WorkPanel`), the sheets each of its lines
 * opens, and the uses of focus the Lifestyle tab shares with them (`LifeUses`, `TeaseUse`, `MasteredLine`). Teasing a rival is for a game with
 * friends (`TeaseUse`: nothing in a life alone).
 *
 * A switch of focus is drawn again only when what it shows changes (`FocusSwitch`, memoised, with one stable callback): an order of another use, or
 * of anything else, leaves it as it is.
 */

type About = 'career' | 'finance' | 'focus' | SkillId;
const TITLE: Record<'career' | 'finance' | 'focus', string> = { career: 'careerTitle', finance: 'financeTitle', focus: 'focusTitle' };
const isSkill = (about: About): about is SkillId => (SKILLS as readonly string[]).includes(about);

/** The size the picture of a workplace is drawn at where it is missing (the web's fallback). */
const SCENE = { w: 288, h: 120 } as const;

/** A level out of three, in squares of 10, 4 apart: filled up to where the player is. */
function Pips({ level }: { level: number }) {
  return (
    <View aria-hidden style={{ flexDirection: 'row', flexShrink: 0, gap: 4 }}>
      {[1, 2, 3].map((at) => (
        <View key={at} testID={at <= level ? 'pip-on' : 'pip-off'} style={{ width: 10, height: 10, backgroundColor: COLORS[at <= level ? 'gold-500' : 'night-900'] }} />
      ))}
    </View>
  );
}

/**
 * The sign that a line opens more (the web's `ml-1.5 text-[11px] text-ink-300` ▸): in the face of the words it follows, the pixel one after a figure,
 * the reading one after a skill's line.
 */
function More({ pixel = false, top = 0, cell = 15 }: { pixel?: boolean; top?: number; cell?: number }) {
  // In a pixel box the mark takes the letter spacing of the box it is in (`cell`, the figure's size), as the web's span inherits it.
  return (
    <View aria-hidden style={{ marginLeft: 6, marginTop: top }}>
      {pixel ? <PixelText size={11} tone="ink-300" style={{ letterSpacing: cell * 0.03 }}>{'▸'}</PixelText> : <ReadText size={11} tone="ink-300">{'▸'}</ReadText>}
    </View>
  );
}

/**
 * A figure and the ▸ after it, inline in a pixel box of `size` (the web's `pixel text-[N]` box with the mark's `text-[11px]` span in it): on the
 * browser's baseline, and the line as tall as the box's own (a row of the phone aligned on its texts' baselines is as tall as their boxes' ascents and
 * descents together, and stood the rung's status 5 points lower than the web's under the pay).
 */
function Figured({ size, tone, children }: { size: number; tone?: ColorToken; children: string }) {
  const { locale } = useSettings();
  const line = webLine([['pixel', size, size * 1.1], ['pixel', size, size * 1.1], ['pixel', 11, 11 * 1.1]], locale);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', height: line.height }}>
      <PixelText size={size} tone={tone} style={{ marginTop: line.tops[1], textAlign: 'right' }}>{children}</PixelText>
      <More pixel top={line.tops[2]} cell={size} />
    </View>
  );
}

/** A line of the panel that opens what stands behind it. Tall enough for a thumb (the web's `flex min-h-11 w-full flex-col justify-center`). */
function Opener({ onOpen, children }: { onOpen(): void; children: ReactNode }) {
  const press = usePress({ onPress: onOpen });
  return (
    <Pressable accessibilityRole="button" onPress={press} style={{ minHeight: TOUCH, width: '100%', justifyContent: 'center' }}>
      {children}
    </Pressable>
  );
}

/**
 * Where the player works, as it looks from the rung they are on, as wide as the panel: no bands either side (the web's `frame sunk mb-2 mt-1 … bg-night-900`
 * round an image `!h-auto !w-full`). The picture is drawn into the width it is given, as tall as its art makes it.
 */
function Workplace({ id }: { id: string }) {
  const art = spriteBox(id, 1, 1, SCENE);
  const [width, setWidth] = useState<number | null>(null);
  return (
    <Framed kind="sunk" style={{ backgroundColor: COLORS['night-900'], marginTop: 4, marginBottom: 8, overflow: 'hidden' }}>
      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ width: '100%', aspectRatio: art.w / art.h, overflow: 'hidden' }}>
        {width === null ? null : <Sprite id={id} fallback={SCENE} size={bannerSize(width, art)} />}
      </View>
    </Framed>
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
  // Worked out once for the life as it stands, not again for each drawing.
  const work = useMemo(() => quoteWork(content, shown), [content, shown]);
  const skills = useMemo(() => quoteSkills(content, shown), [content, shown]);
  const job = shown.player.life.career;
  const titles = job ? text.careers[job.id].levels : [];
  const rung = work.level === null ? null : work.ladder[work.level];
  const next = work.level === null ? undefined : work.ladder[work.level + 1];
  const perYear = (cents: number) => common('perYear', { amount: fmt.money(cents) });

  return (
    <Panel title={t('title')} label={t('title')}>
      <Opener onOpen={() => setAbout('career')}>
        {/* Where the player works, as it looks from the rung they are on, as wide as the panel: no bands either side. */}
        {job && rung ? (
          <Workplace id={workArt(job.id, rung.level, work.ladder.length)} />
        ) : work.retirement.retired ? (
          // A life after work, where the workplace was.
          <Workplace id={RETIRED_ART.scene} />
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingTop: 4 }}>
          <View style={{ flexDirection: 'row', flexShrink: 1, minWidth: 0, alignItems: 'center', gap: 8 }}>
            {job ? (
              <Bare style={{ width: 32, height: 32 }}>
                <Sprite id={careerArt(job.id)} />
              </Bare>
            ) : work.retirement.retired ? (
              // The watering can is drawn to the edges of its square: a little room round it.
              <Bare style={{ width: 36, height: 36, padding: 2 }}>
                <Sprite id={RETIRED_ART.icon} />
              </Bare>
            ) : null}
            <View style={{ flexShrink: 1, minWidth: 0 }}>
              <PixelText size={17} numberOfLines={1}>{job && rung ? titles[rung.level] : work.retirement.retired ? t('retiredTitle') : t('noJob')}</PixelText>
              <ReadText size={12} tone="ink-300" numberOfLines={1}>
                {job ? text.careers[job.id].name : work.retirement.retired ? t('retiredSub', { focus: work.retirement.focus, status: work.retirement.status }) : t('noJobSub')}
              </ReadText>
            </View>
          </View>
          {/* The web's `shrink-0 text-right`: the pay, and under it the status of the rung. */}
          <View style={{ flexShrink: 0, alignItems: 'flex-end' }}>
            <Figured size={16} tone="gold-500">{perYear(work.payAnnual)}</Figured>
            {rung && rung.status > 0 ? (
              <View style={{ marginTop: 2 }}>
                <LineTag tone="good">{t('status', { n: rung.status })}</LineTag>
              </View>
            ) : null}
          </View>
        </View>
        {rung ? (
          <View style={{ marginTop: 8, paddingBottom: 6 }}>
            {next ? (
              <>
                <Bar value={work.skill - rung.minSkill} max={next.minSkill - rung.minSkill} label={t('toNext', { title: titles[next.level] })} tone="teal" />
                {/* The count never wraps; the name of the next job gives way to it and is cut short if it must be. */}
                <View style={{ marginTop: 4, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                  <ReadText size={12} tone="ink-300" numberOfLines={1} style={{ flexShrink: 0 }}>{t('skillOf', { skill: work.skill, need: next.minSkill })}</ReadText>
                  <ReadText size={12} tone="ink-300" numberOfLines={1} style={{ flexShrink: 1, minWidth: 0, textAlign: 'right' }} after={[{ text: perYear(next.payAnnual), tone: 'gold-500' }]}>
                    {`${t('nextIs', { title: titles[next.level] })} · `}
                  </ReadText>
                </View>
              </>
            ) : (
              <ReadText size={12} tone="ink-300">{t('top', { skill: work.skill })}</ReadText>
            )}
          </View>
        ) : null}
      </Opener>
      <Opener onOpen={() => setAbout('focus')}>
        <Row
          style={{ borderTopWidth: 2, borderTopColor: COLORS['night-900'] }}
          left={t('focus')}
          sub={work.focus.bonus === 0 ? t('focusSub') : work.traits.focus === 0 ? t('focusRested', { n: work.focus.bonus }) : work.traits.focus === work.focus.bonus ? t('focusJob', { n: work.focus.bonus }) : t('focusExtra', { n: work.focus.bonus })}
          right={
            <Figured size={15}>{`${work.focus.left}/${work.focus.total}`}</Figured>
          }
        />
      </Opener>

      {/* What the player knows besides the trade: set off by a rule, one line each, every line opening its levels. */}
      <View role="region" aria-label={t('skills')} style={{ borderTopWidth: 2, borderTopColor: COLORS['night-900'], paddingTop: 8 }}>
        <PixelText size={12} tone="gold-200" style={{ textTransform: 'uppercase', letterSpacing: 12 * 0.05 }}>{t('skills')}</PixelText>
        <View role="list">
          <View role="listitem">
            <SkillLine icon={skillArt.finance} name={t('finance')} step={skills.finance} onOpen={() => setAbout('finance')} />
          </View>
          {skills.skills.map((skill) => (
            <View key={skill.skill} role="listitem">
              <SkillLine icon={skillArt[skill.skill]} name={text.skills[skill.skill]} step={skill} onOpen={() => setAbout(skill.skill)} />
            </View>
          ))}
        </View>
      </View>

      {about ? (
        <Sheet open onClose={() => setAbout(null)} title={isSkill(about) ? text.skills[about] : t(TITLE[about])} closeLabel={common('close')}>
          <View style={{ gap: 12 }}>
            {isSkill(about) ? (
              <SkillLevels skill={skills.skills.find((s) => s.skill === about) as SkillQuote} />
            ) : about === 'career' ? (
              <>
                <CareerLadder work={work} shown={shown} />
                <Retirement shown={shown} />
              </>
            ) : about === 'finance' ? (
              <FinanceLevels finance={skills.finance} />
            ) : (
              <FocusUses work={work} skills={skills} />
            )}
          </View>
        </Sheet>
      ) : null}
    </Panel>
  );
}

/** Where a skill stands, the same for every one: its level, and its points counted within that level. */
interface Step {
  level: number;
  points: number;
  from: number;
  next: number | null;
}

/** "Level 2 · 1/3": the level, and how far into it, or that it is at the top. */
function useStepLine() {
  const t = useT('work');
  return (step: Step) => (step.next === null ? t('skillTop') : t('skillPoints', { level: step.level, points: step.points - step.from, next: step.next - step.from }));
}

/** One skill in the list: its sign, its name, its level and how far into it, and its level in squares (the web's `flex items-center gap-2.5 py-1`). */
function SkillLine({ icon, name, step, onOpen }: { icon: string; name: string; step: Step; onOpen(): void }) {
  const line = useStepLine();
  return (
    <Opener onOpen={onOpen}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
        <Bare style={{ width: 32, height: 32 }}>
          <Sprite id={icon} />
        </Bare>
        <View style={{ flex: 1, minWidth: 0 }}>
          <ReadText numberOfLines={1}>{name}</ReadText>
          <ReadText size={12} tone="ink-300" numberOfLines={1}>{line(step)}</ReadText>
        </View>
        <Pips level={step.level} />
        <More />
      </View>
    </Opener>
  );
}

/** The head of a skill's sheet, the same for every skill: a bar through the level the player is in. */
function StepBar({ icon, step }: { icon: string; step: Step }) {
  const t = useT('work');
  const line = useStepLine();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Bare style={{ width: 64, height: 64 }}>
        <Sprite id={icon} scale={2} />
      </Bare>
      <View style={{ flex: 1, minWidth: 0 }}>
        {step.next === null ? (
          <PixelText size={16} tone="gold-500">{line(step)}</PixelText>
        ) : (
          <>
            <Bar value={step.points - step.from} max={step.next - step.from} label={t('skillProgress', { level: step.level + 1 })} tone="teal" />
            <ReadText size={12} tone="ink-300" style={{ marginTop: 4 }}>{line(step)}</ReadText>
          </>
        )}
      </View>
    </View>
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

/**
 * A step of a list of levels or rungs (the web's `li px-2.5 py-2`): the one the player is on lit in gold (`bevel frame-gold bg-night-600`), the
 * others on a plain frame (`frame bg-night-700`), faded by `dim` (the web's `opacity-70`, `opacity-60`). The one the player is on is the step
 * they are on, as the web's `aria-current` says (the phone's `selected`, as the career a card offers marks its rung).
 */
function Level({ here, dim, children }: { here: boolean; dim: number; children: ReactNode }) {
  return (
    <View role="listitem" accessibilityState={{ selected: here }} aria-selected={here} style={dim < 1 ? { opacity: dim } : null}>
      <Framed kind={here ? 'bevel' : 'frame'} tone={here ? GOLD : {}} style={{ backgroundColor: COLORS[here ? 'night-600' : 'night-700'], paddingHorizontal: 10, paddingVertical: 8 }}>
        {children}
      </Framed>
    </View>
  );
}

/**
 * A level's name and where the player stands to it, on one line (the web's `flex items-baseline justify-between gap-2`): what stands on the right in a box
 * of its own, which the row sets on the name's baseline (a Tag places itself at the top of what holds it).
 */
function LevelHead({ name, tag }: { name: string; tag: ReactNode }) {
  // Placed from the browser's baselines: the name's (a pixel 16) and the tag's words' (its 2 of padding over a pixel 12 in a line of 15).
  const { locale } = useSettings();
  const named = webBaseline('pixel', 400, 16, 16 * 1.1, locale);
  const tagged = 2 + webBaseline('pixel', 400, 12, 12 * 1.25, locale);
  const above = tag ? Math.max(named, tagged) : named;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
      <PixelText size={16} style={{ flexShrink: 1, marginTop: above - named }}>{name}</PixelText>
      {tag ? <View style={{ flexShrink: 0, marginTop: above - tagged }}>{tag}</View> : null}
    </View>
  );
}

/** A skill closely: how far it is to the next level, what every level gives, and how it is learnt, by study and by life. */
function SkillLevels({ skill }: { skill: SkillQuote }) {
  const t = useT('work');
  const { content, text } = useWords();
  return (
    <>
      <StepBar icon={skillArt[skill.skill]} step={skill} />
      <View role="list" style={{ gap: 8 }}>
        {([1, 2, 3] as const).map((at) => (
          <Level key={at} here={at === skill.level} dim={at > skill.level ? 0.7 : 1}>
            <LevelHead name={t('financeLevel', { level: at })} tag={at === skill.level ? <Tag tone="good">{t('yourLevel')}</Tag> : at > skill.level ? <Tag>{t('locked')}</Tag> : null} />
            <ReadText size={13} lineHeight={13 * SNUG} tone="ink-200" style={{ marginTop: 4 }}>{skillGives(t, content, skill.skill, at).join(' · ')}</ReadText>
          </Level>
        ))}
      </View>
      {/* How it is learnt, in two lines: by study, and by living it. */}
      <View role="list" style={{ gap: 4 }}>
        {skill.study ? (
          <View role="listitem">
            <ReadText size={13} lineHeight={13 * SNUG}>{t('skillStudy', { action: text.focusActions[skill.study], n: skill.studyPoints })}</ReadText>
          </View>
        ) : null}
        <View role="listitem">
          <ReadText size={13} lineHeight={13 * SNUG}>{t(`skillHow.${skill.skill}`, { n: content.life.skills.practicePoints, study: skill.studyPoints })}</ReadText>
        </View>
      </View>
      {skill.practice > 0 ? <ReadText size={12} tone="teal-300">{t('skillLiving', { n: skill.practice })}</ReadText> : null}
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
  if (!job || work.level === null) {
    const since = shown.player.life.retiredAtRound;
    return (
      <ReadText size={14} lineHeight={14 * SNUG}>
        {since === null ? t('noJobAbout') : t('retiredAbout', { age: ageAt(content, since), focus: work.retirement.focus, status: work.retirement.status })}
      </ReadText>
    );
  }
  const titles = text.careers[job.id].levels;
  const level = work.level;

  return (
    <>
      <Explain>{t('careerAbout', { career: text.careers[job.id].name, work: work.workSkill, study: work.studySkill })}</Explain>
      {/* What sets this career apart from the others, in the figures of this round (the web's `border-l-4 border-gold-500 pl-3`). */}
      {traits.follows || traits.fade || traits.focus > 0 ? (
        <View role="list" aria-label={t('traits')} style={{ gap: 4, borderLeftWidth: 4, borderLeftColor: COLORS['gold-500'], paddingLeft: 12 }}>
          {traits.follows ? (
            <View role="listitem">
              <ReadText size={13} lineHeight={13 * SNUG}>{t(traits.cyclePct > 0 ? 'cycleUp' : traits.cyclePct < 0 ? 'cycleDown' : 'cycleFlat', { pct: Math.abs(traits.cyclePct) })}</ReadText>
            </View>
          ) : null}
          {traits.fade ? (
            <View role="listitem">
              <ReadText size={13} lineHeight={13 * SNUG}>
                {traits.fadePct < 0
                  ? t('fadeNow', { pct: -traits.fadePct, max: traits.fade.maxPct })
                  : t('fadeLater', { age: ageAt(content, traits.fade.fromRound), pct: traits.fade.pctPerRound, max: traits.fade.maxPct })}
              </ReadText>
            </View>
          ) : null}
          {traits.focus > 0 ? (
            <View role="listitem">
              <ReadText size={13} lineHeight={13 * SNUG}>{t('jobFocus', { n: traits.focus })}</ReadText>
            </View>
          ) : null}
        </View>
      ) : null}
      {/* The way up reads from the top down, as the web's reversed list does. */}
      <View role="list" style={{ flexDirection: 'column-reverse', gap: 8 }}>
        {work.ladder.map((rung) => {
          const here = rung.level === level;
          const gap = rung.minSkill - work.skill;
          return (
            <Level key={rung.level} here={here} dim={rung.level < level ? 0.6 : 1}>
              <LevelHead name={titles[rung.level]} tag={<PixelText size={15} tone="gold-500" style={{ flexShrink: 0 }}>{common('perYear', { amount: fmt.money(rung.payAnnual) })}</PixelText>} />
              <View style={{ marginTop: 4, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {here ? <Tag tone="good">{t('yourRung')}</Tag> : null}
                {rung.status > 0 ? <Tag tone="good">{t('status', { n: rung.status })}</Tag> : null}
                {rung.level > level ? <Tag>{gap > 0 ? t('needs', { skill: rung.minSkill, gap }) : t('reached')}</Tag> : null}
              </View>
            </Level>
          );
        })}
      </View>
      <ReadText size={12} tone="ink-300">{t('ladderNote', { city: names.cities[shown.player.cityId] })}</ReadText>
    </>
  );
}

/** A heading set off by a rule over it (the web's `section … border-t-2 border-night-900 pt-3` and its `pixel text-[12px] uppercase tracking-wider text-gold-200`). */
function Ruled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View role="region" aria-label={label} style={{ gap: 8, borderTopWidth: 2, borderTopColor: COLORS['night-900'], paddingTop: 12 }}>
      <PixelText size={12} tone="gold-200" style={{ textTransform: 'uppercase', letterSpacing: 12 * 0.05 }}>{label}</PixelText>
      {children}
    </View>
  );
}

/**
 * Retiring, below the ladder: when it opens, and what it gives while no career is taken up again.
 * While the finances are open it is a switch, an order like any other, and it can be taken back
 * until the round is played. Judged by the life as it stands, not by the round as ordered.
 */
function Retirement({ shown }: { shown: GameView }) {
  const t = useT('work');
  const { content } = useWords();
  const stage = useGame((s) => s.stage);
  const view = useGame((s) => s.view);
  const ordered = useGame((s) => s.orders.some((order) => order.type === 'retire'));
  const setOrder = useGame((s) => s.setOrder);
  const standing = view ?? shown;
  const plan = useMemo(() => quoteWork(content, standing).retirement, [content, standing]);
  if (standing.player.life.career === null) return null;
  const gives = t('retireGives', { focus: plan.focus, status: plan.status });
  return (
    <Ruled label={t('retireTitle')}>
      {!plan.open ? (
        <ReadText size={13} lineHeight={13 * SNUG} tone="ink-200">{`${t('retireLater', { age: ageAt(content, plan.fromRound) })} ${gives}`}</ReadText>
      ) : stage === 'finance' && view !== null ? (
        <Toggle on={ordered} onChange={(on) => setOrder((order) => order.type === 'retire', on ? { type: 'retire' } : null)} label={t('retire')} hint={gives} />
      ) : (
        <ReadText size={13} lineHeight={13 * SNUG} tone="ink-200">{`${t('retireOpen')} ${gives}`}</ReadText>
      )}
    </Ruled>
  );
}

/** What each level of knowing about money lets the player do on their own, and how the next is reached. */
function FinanceLevels({ finance }: { finance: SkillsQuote['finance'] }) {
  const t = useT('work');
  const { content, text } = useWords();
  const level = finance.level;

  return (
    <>
      <StepBar icon={skillArt.finance} step={finance} />
      <ReadText size={14} lineHeight={14 * SNUG}>{t('financeAbout')}</ReadText>
      <View role="list" style={{ gap: 8 }}>
        {([0, 1, 2, 3] as const).map((at) => {
          const opens = content.assets.filter((asset) => (asset.minFinanceSkill ?? 0) === at).length;
          return (
            <Level key={at} here={at === level} dim={at > level ? 0.7 : 1}>
              <LevelHead name={t('financeLevel', { level: at })} tag={at === level ? <Tag tone="good">{t('yourLevel')}</Tag> : at > level ? <Tag>{t('locked')}</Tag> : null} />
              <ReadText size={13} lineHeight={13 * SNUG} tone="ink-200" style={{ marginTop: 4 }}>{t(`financeOpens.${at}`, { n: opens })}</ReadText>
              {content.debt.marginMinFinanceSkill === at ? <ReadText size={13} lineHeight={13 * SNUG} tone="ink-200" style={{ marginTop: 2 }}>{t('financeMargin')}</ReadText> : null}
              {content.life.rentOutMinFinanceSkill === at ? <ReadText size={13} lineHeight={13 * SNUG} tone="ink-200" style={{ marginTop: 2 }}>{t('financeLandlord')}</ReadText> : null}
            </Level>
          );
        })}
      </View>
      <ReadText size={13} lineHeight={13 * SNUG}>{t('financeHow', { n: content.life.skills.investingPoints })}</ReadText>
      <ReadText size={13} lineHeight={13 * SNUG} tone="ink-200">{t('skillStudy', { action: text.focusActions[finance.study], n: finance.studyPoints })}</ReadText>
      <ReadText size={12} tone={finance.practice > 0 ? 'teal-300' : 'ink-300'}>{finance.practice > 0 ? t('financeLiving', { n: finance.practice }) : t('financeIdle')}</ReadText>
    </>
  );
}

/** The skills at their top, named on one line: nothing more to learn, so nothing to switch. */
export function MasteredLine({ names }: { names: string[] }) {
  const t = useT('finance.lifestyle');
  if (names.length === 0) return null;
  return <ReadText size={12} lineHeight={12 * SNUG} tone="teal-300">{`✓ ${t('masteredLine', { skills: names.join(' · ') })}`}</ReadText>;
}

/** The uses of focus ordered this round, by their action: the same list while they are the same, so only an order of focus draws again what reads it. */
export function useFocusOrdered(): readonly FocusAction[] {
  return useGame(useShallow((s) => s.orders.flatMap((order) => (order.type === 'focus' ? [order.action] : []))));
}

/** Orders a use of focus, or takes it back: the same for every switch and every drawing. */
export function useSetFocus(): (action: FocusAction, on: boolean) => void {
  const setOrder = useGame((s) => s.setOrder);
  return useCallback((action: FocusAction, on: boolean) => void setOrder((order) => order.type === 'focus' && order.action === action, on ? { type: 'focus', action } : null), [setOrder]);
}

/**
 * A use of focus as a switch, with its sign: drawn again only when what it shows changes (whether it is on, whether it can be pressed, its words),
 * so ordering another use, or anything else, leaves it as it is.
 */
export const FocusSwitch = memo(function FocusSwitch({ action, on, disabled, label, hint, burnout = false, onFocus }: { action: FocusAction; on: boolean; disabled: boolean; label: string; hint: string; burnout?: boolean; onFocus(action: FocusAction, on: boolean): void }) {
  // Overtime that may burn the player out wears the warning's icon, the risk its hint names.
  return <Toggle on={on} onChange={(next) => onFocus(action, next)} disabled={disabled} label={label} hint={hint} icon={burnout ? RISK_ART.burnout : focusArt[action]} />;
});

/**
 * Focus spent on the life rather than the job: time with the family, for whoever has one, and a rest.
 * With a `title`, it stands in a panel of its own. Nothing on rules that do not know them.
 */
export function LifeUses({ left, title }: { left: number; title: string }) {
  const t = useT('finance.lifestyle');
  const { content, text } = useWords();
  const knows = useKnows();
  const view = useGame((s) => s.view);
  const ordered = useFocusOrdered();
  const focus = useSetFocus();
  const work = useMemo(() => (view ? quoteWork(content, view) : null), [content, view]);
  if (!view || !work) return null;
  const uses = (
    [
      ['familyTime', t('familyHint', { n: work.familyTimeStatus })],
      ['unwind', t('unwindHint', { n: work.restHealthPoints })],
    ] as const
  ).filter(([action]) => knows(`focus:${action}`) && work.focusLocks[action] === null);
  if (uses.length === 0) return null;
  return (
    <Panel title={title} label={title}>
      <View style={{ gap: 8 }}>
        {uses.map(([action, hint]) => {
          const on = ordered.includes(action);
          return <FocusSwitch key={action} action={action} on={on} disabled={!on && left < 1} label={text.focusActions[action]} hint={hint} onFocus={focus} />;
        })}
      </View>
    </Panel>
  );
}

/**
 * What a round's focus can be spent on, and what each use is worth to this player as they stand.
 * While the finances are open each use is a switch, as in the Lifestyle tab: an order like any other.
 */
export function FocusUses({ work, skills }: { work: WorkQuote; skills: SkillsQuote }) {
  const t = useT('work');
  const words = useWords();
  const { text } = words;
  const stage = useGame((s) => s.stage);
  const hasView = useGame((s) => s.view !== null);
  const career = useGame((s) => s.view?.player.life.career?.id);
  const ordered = useFocusOrdered();
  const focus = useSetFocus();
  const open = stage === 'finance' && hasView;
  const note = useFocusNote();
  const knows = useKnows();
  const use = (action: FocusAction, name: string, gives: string) => ({ action, name, note: note(work, action, gives) });
  const job = [
    use('overtime', jobFocusName(words, career, 'overtime', t('overtime')), t('overtimeGives', { pct: work.overtimePct })),
    use('studyCareer', jobFocusName(words, career, 'studyCareer', t('study')), t('studyGives', { n: work.studySkill })),
    use('jobHunt', jobFocusName(words, career, 'jobHunt', t('hunt')), t('huntGives', { pct: work.jobHuntChancePct, raise: work.jobHuntRaisePct })),
  ];
  // Learning needs no job: it is on the list whatever the player does for a living. What is mastered is only named.
  const learning = splitMastered([
    use(skills.finance.study, text.focusActions[skills.finance.study], t('learnGives', { n: skills.finance.studyPoints, skill: t('finance') })),
    ...skills.skills.flatMap((skill) => (skill.study === null ? [] : [use(skill.study, text.focusActions[skill.study], t('learnGives', { n: skill.studyPoints, skill: text.skills[skill.skill] }))])),
  ]);
  const life = useT('finance.lifestyle');
  const lives = [
    use('familyTime', text.focusActions.familyTime, life('familyHint', { n: work.familyTimeStatus })),
    use('unwind', text.focusActions.unwind, life('unwindHint', { n: work.restHealthPoints })),
  ].filter((each) => knows(`focus:${each.action}`) && !each.note.locked);
  const uses = [...(work.level === null ? [] : job), ...learning.open, ...lives];
  const mastered = learning.mastered.map((each) => each.name);

  return (
    <>
      {/* The parts said, one space between each, as the web's page sets its words (where the spaces of a part left out run together). */}
      <ReadText size={14} lineHeight={14 * SNUG}>
        {[
          t('focusAbout', { total: work.focus.total }),
          work.traits.focus > 0 ? t('focusFromJob', { n: work.traits.focus }) : '',
          work.focus.bonus > work.traits.focus ? t('focusBonus', { n: work.focus.bonus - work.traits.focus }) : '',
          work.focus.lost > 0 ? t('focusBurnout', { n: work.focus.lost }) : '',
        ]
          .filter(Boolean)
          .join(' ')}
      </ReadText>
      {/* The web's `frame bg-night-800 px-3 py-2 text-center`. */}
      <Framed kind="frame" style={{ backgroundColor: COLORS['night-800'], paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' }}>
        <KeyFigure>{`${work.focus.left}/${work.focus.total}`}</KeyFigure>
        <ReadText size={12} tone="ink-300" style={{ textAlign: 'center' }}>{t('focusLeft')}</ReadText>
      </Framed>
      {work.level === null ? <ReadText size={14} lineHeight={14 * SNUG} tone="ink-200">{t('focusNoJob')}</ReadText> : null}
      {/* Before the finances the uses are only listed: when they can be chosen is said before them, not under the whole list. */}
      {open ? null : <ReadText size={14} lineHeight={14 * SNUG} tone="gold-200">{t('focusLater')}</ReadText>}
      {open ? (
        <View style={{ gap: 8 }}>
          {uses.map((each) => {
            const on = ordered.includes(each.action);
            // What cannot be had now is not shown; what the focus left does not reach is, off.
            if (each.note.locked && !on) return null;
            return <FocusSwitch key={each.action} action={each.action} on={on} disabled={!on && work.focus.left < 1} label={each.name} hint={each.note.hint} burnout={each.note.burnout} onFocus={focus} />;
          })}
          <MasteredLine names={mastered} />
          <CareerMoves work={work} left={work.focus.left} />
          <TeaseUse left={work.focus.left} />
        </View>
      ) : (
        <View role="list" style={{ gap: 8 }}>
          {uses.map((each) => (
            <View key={each.action} role="listitem">
              <Framed kind="frame" style={{ backgroundColor: COLORS['night-700'], flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 10, paddingVertical: 8 }}>
                <Bare style={{ width: 36, height: 36 }}>
                  <Sprite id={focusArt[each.action]} />
                </Bare>
                <View style={{ flexShrink: 1, minWidth: 0 }}>
                  <PixelText size={16}>{each.name}</PixelText>
                  <ReadText size={13} lineHeight={13 * SNUG} tone="ink-200">{each.note.hint}</ReadText>
                </View>
              </Framed>
            </View>
          ))}
        </View>
      )}
      {open ? null : <MasteredLine names={mastered} />}
      <Explain>{t('focusAlso')}</Explain>
      {open ? <ReadText size={12} tone="ink-300" style={{ textAlign: 'center' }}>{t('focusPick')}</ReadText> : null}
    </>
  );
}

/**
 * In a game with friends, the round's focus can also go on teasing a rival: one switch, and who it is aimed at. The teaser gains status this round;
 * the rival starts the next one with less, and reads who did it. Nothing here in a life alone, nor the round after a tease. With a `title`, it stands
 * in a panel of its own. The
 * rivals are read from the room by their names alone (`useRoomSlice`): a look at the room that changes neither draws nothing here.
 */
export function TeaseUse({ left, title }: { left: number; title?: string }) {
  const t = useT('work');
  const room = useT('room');
  const { text } = useWords();
  const inRoom = useGame((s) => (s.view ? Object.hasOwn(s.view.player.life.flags, 'in_room') : false));
  const aimed = useGame(useShallow((s) => s.orders.filter((order) => order.type === 'focus' && order.action === 'tease').map((order) => (order as { target?: string }).target ?? '')));
  const setOrder = useGame((s) => s.setOrder);
  const rivals = useRoomSlice(({ room: now }) => (now === null ? [] : now.members.filter((member) => !member.me && !member.left).map((member) => ({ userId: member.userId, name: member.name }))));
  // Never two rounds running: the round after a tease has none to offer.
  const resting = useGame((s) => (s.view?.player.life.teaseRest ?? 0) > 0);
  const known = useKnows()('focus:tease');
  const teasing = aimed.length > 0;
  if (!known || !inRoom || rivals.length === 0 || (resting && !teasing)) return null;
  const isTease = (order: { type: string; action?: string }) => order.type === 'focus' && order.action === 'tease';
  const target = rivals.some((rival) => rival.userId === aimed[0]) ? aimed[0] : undefined;
  const aim = (userId: string | null) => setOrder(isTease, userId === null ? null : { type: 'focus', action: 'tease', target: userId });
  const nameOf = (rival: (typeof rivals)[number]) => rival.name ?? room('nameless', { tag: rival.userId.slice(0, 4).toUpperCase() });

  const use = (
    <View style={{ gap: 6 }}>
      <Toggle
        on={teasing}
        onChange={(on) => aim(on ? (target ?? rivals[0].userId) : null)}
        disabled={!teasing && left < 1}
        label={text.focusActions.tease}
        hint={t('teaseGives')}
        icon={focusArt.tease}
      />
      {teasing ? (
        <View accessibilityRole="radiogroup" accessibilityLabel={t('teaseAt')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingLeft: 8 }}>
          {rivals.map((rival) => (
            <Raised
              key={rival.userId}
              role="radio"
              checked={rival.userId === target}
              bg={rival.userId === target ? 'gold-500' : 'night-600'}
              style={{ paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }}
              onPress={() => aim(rival.userId)}
            >
              <ReadText size={14} tone={rival.userId === target ? 'ink-900' : 'cream'}>{nameOf(rival)}</ReadText>
            </Raised>
          ))}
        </View>
      ) : null}
    </View>
  );
  return title === undefined ? (
    use
  ) : (
    <View role="region" aria-label={title}>
      <Panel title={title}>{use}</Panel>
    </View>
  );
}
