'use client';

import { CHALLENGE_ART, CHALLENGE_DEBT, challengeOf, lives, portraitArt, ruleArt, weekOf, weekStart } from '@ratrace/content';
import type { Challenge, ChallengeRule } from '@ratrace/content';
import { useEffect, useState } from 'react';
import { useCommunity, useRanking, useT, useWords } from '@/game/context';
import { Link } from '@/i18n/navigation';
import type { ChallengeChoice, ChallengeRanking, Community } from '@/online/types';
import { Button, Panel, Tag, Well } from '@/ui/kit';
import { Sheet } from '@/ui/overlay';
import { Sprite } from '@/ui/Sprite';

/** This week's challenge, by the device's clock. The server keeps its own, and the two agree but for a moment at midnight on Sunday. */
export function useThisWeek(): Challenge | null {
  // Read once: the same challenge for as long as the screen is open, and the same object, so that what depends on it is not asked again.
  const [week] = useState(() => challengeOf(weekOf(Date.now()), lives));
  return week;
}

/** A rule of a challenge in a line, and in a sentence that says what it forbids. */
export function useRuleText() {
  const t = useT('challenge');
  const { fmt } = useWords();
  return (rule: ChallengeRule) => ({ name: t(`rules.${rule}.name`), about: t(`rules.${rule}.about`, { amount: fmt.money(CHALLENGE_DEBT) }) });
}

/** The day a week's challenge closes: its Sunday. */
const lastDay = (week: string): number => (weekStart(week) ?? 0) + 6 * 86_400_000;

/** The places of a challenge's ranking that are in its best tenth: the first, at least. */
export const topTenth = (entrants: number): number => Math.max(1, Math.ceil(entrants / 10));

/**
 * The week's challenge, where a life is chosen: the life, the rule, and whether the player has had
 * their attempt. It opens a sheet with all of it and the two ways to play it: the one attempt that
 * counts, and practice, as often as wanted.
 */
export function WeeklyChallenge({ onStart, starting }: { onStart(challenge: Challenge, attempt: boolean): void; starting: boolean }) {
  const t = useT('challenge');
  const common = useT('common');
  const { text, fmt } = useWords();
  const week = useThisWeek();
  const ruleText = useRuleText();
  const community = useCommunity();
  const ranking = useRanking();
  const [open, setOpen] = useState(false);
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
  // An attempt is the server's to play: it needs someone signed in and a connection. One already had is not offered;
  // where the account cannot say, it is, and the server, which keeps the count, decides.
  const canAttempt = ranking === 'yes' && entry?.entered !== true;

  return (
    <>
      <button type="button" aria-haspopup="dialog" onClick={() => setOpen(true)} className="frame-raised frame-gold mb-3 flex w-full items-center gap-3 bg-night-600 p-2 text-left">
        <Well className="size-[52px]">
          <Sprite id={portraitArt(week.lifeId, 22)} fallback={{ w: 48, h: 48 }} />
        </Well>
        <span className="min-w-0 flex-1">
          <span className="pixel flex items-center gap-1 text-[12px] uppercase tracking-wider text-gold-500">
            <Sprite id={CHALLENGE_ART.icon} />
            {t('title')}
          </span>
          <span className="pixel block truncate text-[17px]">{lifeName}</span>
          <span className="flex items-center gap-1 truncate text-[12px] text-ink-200">
            <Sprite id={ruleArt[week.rule]} />
            {rule.name}
          </span>
        </span>
        {entry?.score !== null && entry?.score !== undefined ? <span className="pixel shrink-0 text-[15px] text-teal-300">{fmt.number(entry.score)}</span> : null}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={t('title')} closeLabel={common('close')}>
        <div className="flex flex-col gap-3">
          <div className="frame-double flex justify-center overflow-hidden bg-night-900 leading-[0]">
            <Sprite id={CHALLENGE_ART.scene} scale="art" fallback={{ w: 288, h: 120 }} className="max-w-none" />
          </div>
          <div className="flex items-center gap-3">
            <Well className="size-[68px]">
              <Sprite id={portraitArt(week.lifeId, 22)} fallback={{ w: 64, h: 64 }} />
            </Well>
            <div className="min-w-0">
              <p className="pixel text-[19px]">{lifeName}</p>
              <p className="text-[12px] text-ink-300">{t('ends', { day: fmt.day(lastDay(week.week)) })}</p>
            </div>
          </div>
          <section aria-label={t('rule')} className="border-l-4 border-gold-500 pl-3">
            <p className="pixel flex items-center gap-2 text-[16px] text-gold-200">
              <Sprite id={ruleArt[week.rule]} />
              {rule.name}
            </p>
            <p className="text-[13px] leading-snug text-ink-200">{rule.about}</p>
          </section>
          <p className="text-[13px] leading-snug">{t('about')}</p>
          {entry?.entered ? (
            <p role="status" className="text-[13px] text-teal-300">
              {entry.score !== null ? t('played', { score: fmt.number(entry.score) }) : t('entered')}
            </p>
          ) : ranking !== 'yes' ? (
            <p className="text-[13px] text-ink-300">{t('needsAccount')}</p>
          ) : null}
          <div className="flex flex-col gap-2">
            {canAttempt ? (
              <Button
                variant="primary"
                wide
                disabled={starting}
                onClick={() => {
                  setOpen(false);
                  onStart(week, true);
                }}
              >
                {t('attempt')}
              </Button>
            ) : null}
            <Button
              wide
              disabled={starting}
              onClick={() => {
                setOpen(false);
                onStart(week, false);
              }}
            >
              <Sprite id={CHALLENGE_ART.practice} />
              {t('practice')}
            </Button>
          </div>
          <p className="text-[12px] text-ink-300">{t('practiceHint')}</p>
          {community !== null ? (
            <Link href="/rankings?tab=challenge" className="text-center text-[13px] text-teal-300 underline">
              {t('rankingLink')}
            </Link>
          ) : null}
        </div>
      </Sheet>
    </>
  );
}

/**
 * The ranking of this week's challenge: every attempt, best first, the best tenth marked, and how
 * many took part. A line is a player and a score: the life and the rule are the same for all.
 */
export function ChallengeBoard({ community }: { community: Community }) {
  const t = useT('challenge');
  const common = useT('common');
  const { text, fmt } = useWords();
  const week = useThisWeek();
  const ruleText = useRuleText();
  /** `undefined` while the answer is on its way; null when it could not be read. */
  const [board, setBoard] = useState<ChallengeRanking | null | undefined>(undefined);
  useEffect(() => {
    if (week === null) return;
    let live = true;
    void community.challengeRanking(week.week).then((answer) => {
      if (live) setBoard(answer);
    });
    return () => {
      live = false;
    };
  }, [community, week]);
  if (week === null) return null;
  const top = board ? topTenth(board.entrants) : 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Well className="size-[52px]">
          <Sprite id={portraitArt(week.lifeId, 22)} fallback={{ w: 48, h: 48 }} />
        </Well>
        <div className="min-w-0">
          <p className="pixel truncate text-[17px]">{text.lives[week.lifeId]?.name ?? week.lifeId}</p>
          <p className="flex items-center gap-1 truncate text-[12px] text-ink-200">
            <Sprite id={ruleArt[week.rule]} />
            {ruleText(week.rule).name}
          </p>
        </div>
      </div>
      {board === undefined ? <p className="pixel animate-blink text-center text-ink-300">{common('loading')}</p> : null}
      {board === null ? (
        <p role="status" className="frame bg-wine-900 px-3 py-2 text-[14px]">
          {t('unreachable')}
        </p>
      ) : null}
      {board && board.rows.length === 0 ? <p className="frame bg-night-700 p-3 text-[14px] text-ink-200">{t('noEntries')}</p> : null}
      {board && board.rows.length > 0 ? (
        <>
          <p className="text-[12px] text-ink-300">{t('entrants', { n: board.entrants, top })}</p>
          <ol aria-label={t('rankingTitle')} className="flex flex-col gap-1.5">
            {board.rows.map((row) => (
              <li key={row.userId} aria-current={row.mine ? 'true' : undefined} className={`bevel flex items-center gap-3 px-3 py-2 ${row.mine ? 'frame-gold bg-night-600' : 'bg-night-700'}`}>
                <span className="pixel w-8 shrink-0 text-right text-[17px] text-ink-200">{row.place}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px]">{row.nickname ?? t('nameless')}</span>
                  <span className="block truncate text-[12px] text-ink-300">{fmt.day(row.finishedAt)}</span>
                </span>
                {row.place <= top ? (
                  <span className="flex shrink-0 items-center gap-1">
                    <Sprite id={CHALLENGE_ART.topTenth} />
                    <Tag tone="good">{t('topTenth')}</Tag>
                  </span>
                ) : null}
                <span className="pixel shrink-0 text-[18px]">{fmt.number(row.score)}</span>
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </div>
  );
}

/**
 * At the end of the week's attempt: where it stands in the week's ranking, and the choices the
 * player made that the fewest others made, with all of them in a sheet. Nothing until there is a
 * ranking to read; the choices only once the server has the attempt.
 */
export function ChallengeResult({ week }: { week: string }) {
  const t = useT('challenge');
  const common = useT('common');
  const { text, fmt } = useWords();
  const community = useCommunity();
  const [board, setBoard] = useState<ChallengeRanking | null>(null);
  const [choices, setChoices] = useState<ChallengeChoice[] | null>(null);
  const [all, setAll] = useState(false);
  useEffect(() => {
    if (community === null) return;
    let live = true;
    void Promise.all([community.challengeRanking(week), community.challengeChoices(week)]).then(([ranking, chosen]) => {
      if (!live) return;
      setBoard(ranking);
      setChoices(chosen);
    });
    return () => {
      live = false;
    };
  }, [community, week]);
  const mine = board?.rows.find((row) => row.mine) ?? null;
  const told = (choices ?? []).filter((choice) => choice.answered > 0 && text.cards[choice.cardId] !== undefined);
  if (mine === null && told.length === 0) return null;
  const share = (choice: ChallengeChoice) => Math.round((choice.same * 100) / choice.answered);
  const line = (choice: ChallengeChoice) =>
    t('choice', { card: text.cards[choice.cardId].title, option: text.cards[choice.cardId].options[choice.option]?.label ?? '', pct: share(choice), n: choice.answered });
  // The least followed first: what set this attempt apart.
  const rare = [...told].sort((a, b) => share(a) - share(b)).slice(0, 3);

  return (
    <Panel title={t('title')} label={t('title')}>
      <div className="flex flex-col gap-2">
        {mine && board ? (
          <p className="pixel flex items-center gap-2 text-[16px] text-gold-200">
            {mine.place <= topTenth(board.entrants) ? <Sprite id={CHALLENGE_ART.topTenth} /> : null}
            {t('place', { place: mine.place, n: board.entrants })}
            {mine.place <= topTenth(board.entrants) ? ` · ${t('topTenth')}` : ''}
          </p>
        ) : null}
        {rare.length > 0 ? (
          <>
            <p className="text-[12px] uppercase tracking-wider text-ink-300">{t('rareTitle')}</p>
            <ul className="flex flex-col gap-1 text-[13px] leading-snug">
              {rare.map((choice, i) => (
                <li key={i}>{line(choice)}</li>
              ))}
            </ul>
            <Button wide onClick={() => setAll(true)}>
              {t('allChoices', { n: told.length })}
            </Button>
          </>
        ) : null}
      </div>
      <Sheet open={all} onClose={() => setAll(false)} title={t('choicesTitle')} closeLabel={common('close')}>
        <ol className="flex flex-col gap-2 text-[13px] leading-snug">
          {told.map((choice, i) => (
            <li key={i} className="border-l-4 border-night-900 pl-2">
              {line(choice)}
              <span className="ml-1 text-ink-300">{fmt.number(choice.same)}/{fmt.number(choice.answered)}</span>
            </li>
          ))}
        </ol>
      </Sheet>
    </Panel>
  );
}
