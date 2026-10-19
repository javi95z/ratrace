'use client';

import { Explain } from './Explain';
import { ratOutfit } from '@ratrace/core/game/quips';
import { Loop } from './Loop';
import { FRAME_STATUS, frameArt, portraitArt, ratArt } from '@ratrace/content';
import { cashflow, cashflowLines, escapeMultiplier, escapeProgress, netWorth, scoreBreakdown, statusBreakdown } from '@ratrace/engine';
import type { GameView } from '@ratrace/engine';
import { useEffect, useRef, useState } from 'react';
import { characterName } from '@ratrace/core/game/characters';
import { useGame, useSettings, useT, useWords } from '@/game/context';
import { ageAt, cityLight, portraitAge } from '@ratrace/core/game/present';
import { Bar, Row, Stat, Tag, Well, KeyFigure } from '@/ui/kit';
import { Sheet } from '@/ui/overlay';
import { Sparks } from '@/ui/Sparks';
import { Sprite } from '@/ui/Sprite';
import { CityBanner } from './CityBanner';
import { CrisisBar } from './Crisis';
import { Headlines } from './News';
import { JailSheet } from './Jail';
import { SettingsSheet } from './Settings';

/**
 * The game as it stands for the screens: in the finance phase, the player as they will be once the
 * orders in the basket have run, so every figure on screen already counts them.
 */
export function useShown(): GameView {
  const view = useGame((s) => s.view);
  const preview = useGame((s) => s.preview);
  if (!view) throw new Error('no game on screen');
  return preview ? { ...view, player: preview.player } : view;
}

/**
 * What stands behind the portrait, by the frame it has earned: nothing at first, then a colour,
 * then stage lights, then a burst of gold. Status shows before a word is read.
 */
const BACKDROP: ReadonlyArray<string | undefined> = [
  undefined,
  'var(--color-teal-800)',
  'repeating-linear-gradient(90deg, var(--color-night-500) 0 4px, var(--color-sky-500) 4px 8px)',
  'repeating-conic-gradient(from 0deg at 50% 100%, var(--color-gold-700) 0 10deg, var(--color-gold-900) 10deg 20deg)',
];
const tierOf = (status: number): number => FRAME_STATUS.reduce((best, from, i) => (status >= from ? i : best), 0);

/** The frame the status has reached, and a moment of celebration each time it reaches a better one. */
function useTierUp(status: number): { tier: number; rose: number } {
  const tier = tierOf(status);
  const last = useRef(tier);
  const [rose, setRose] = useState(0);
  useEffect(() => {
    if (tier > last.current) setRose((n) => n + 1);
    last.current = tier;
  }, [tier]);
  return { tier, rose };
}

type Figure = 'cash' | 'flow' | 'status' | 'ratRace';

/**
 * What one figure of the HUD means, and what it is made of. Lines that are zero and say nothing
 * by being so are left out.
 */
function Details({ figure, shown }: { figure: Figure; shown: GameView }) {
  const t = useT('hud');
  const { content, fmt } = useWords();
  const p = shown.player;
  const total = 'mt-1 border-t-2 border-night-900 pt-2';
  const good = (cents: number) => <span className="text-teal-300">{fmt.signed(cents)}</span>;
  const bad = (cents: number) => <span className="text-wine-300">{fmt.signed(-cents)}</span>;
  const points = (value: number) => (value > 0 ? `+${fmt.number(value)}` : fmt.number(value));

  let rows;
  if (figure === 'cash') {
    rows = (
      <>
        <Row left={t('cash')} right={fmt.money(p.cash)} />
        <Row left={t('savings')} right={fmt.money(p.deposit)} />
        <Row className={total} left={t('netWorth')} sub={t('netWorthHint')} right={<span className="text-gold-500">{fmt.money(netWorth(p))}</span>} />
      </>
    );
  } else if (figure === 'flow') {
    const lines = cashflowLines(content, shown);
    const whole = cashflow(content, shown);
    rows = (
      <>
        <Row left={t('salary')} right={good(lines.salary)} />
        {lines.dividends > 0 ? <Row left={t('dividends')} right={good(lines.dividends)} /> : null}
        {lines.interest > 0 ? <Row left={t('interest')} right={good(lines.interest)} /> : null}
        {lines.rent > 0 ? <Row left={t('rent')} right={good(lines.rent)} /> : null}
        {lines.otherPassive > 0 ? <Row left={t('otherPassive')} right={good(lines.otherPassive)} /> : null}
        <Row left={t('living')} right={bad(lines.living)} />
        {lines.other > 0 ? <Row left={t('otherExpenses')} right={bad(lines.other)} /> : null}
        {lines.debt > 0 ? <Row left={t('debt')} right={bad(lines.debt)} /> : null}
        <Row className={total} left={t('perYear')} right={fmt.signed(whole.salaryAnnual + whole.passiveAnnual - whole.expensesAnnual)} />
      </>
    );
  } else if (figure === 'ratRace') {
    rows = <RatRace shown={shown} />;
  } else {
    const status = statusBreakdown(content, shown);
    rows = (
      <>
        <Row left={t('statusJob')} right={points(status.job)} />
        <Row left={t('statusHome')} right={points(status.home)} />
        {status.estates !== 0 ? <Row left={t('statusEstates')} sub={t('statusEstatesHint')} right={points(status.estates)} /> : null}
        <Row left={t('statusCity')} right={points(status.city)} />
        <Row left={t('statusLifestyle')} right={points(status.lifestyle)} />
        <Row left={t('statusItems')} right={points(status.items)} />
        {status.network !== 0 ? <Row left={t('statusNetwork')} right={points(status.network)} /> : null}
        {status.bonus !== 0 ? <Row left={t('statusBonus')} right={points(status.bonus)} /> : null}
        <Row className={total} left={t('statusNow')} right={fmt.number(status.total)} />
        <Row left={t('statusLived')} sub={t('statusLivedHint')} right={fmt.number(status.lived)} />
        <ScoreNow shown={shown} />
      </>
    );
  }

  return (
    <>
      <Explain className="mb-1">{t(`about.${figure}`)}</Explain>
      <div className="text-[14px]">{rows}</div>
    </>
  );
}

/**
 * The way out, laid bare: how much of the year's outgoings what comes in without working already
 * pays, where that comes from, what is left to cover, and what getting out is worth.
 */
function RatRace({ shown }: { shown: GameView }) {
  const t = useT('hud');
  const { content, fmt } = useWords();
  const preview = useGame((s) => s.preview);
  const p = shown.player;
  const years = content.yearsPerRound;
  const escape = preview ? preview.escape : escapeProgress(content, shown);
  const lines = cashflowLines(content, shown);
  const passive = Math.floor(escape.passiveAfterTax / years);
  const outgoings = Math.floor(escape.outgoings / years);
  const before = lines.dividends + lines.interest + lines.rent + lines.otherPassive;
  const tax = Math.max(0, before - passive);
  const gap = outgoings - passive;
  const pct = outgoings > 0 ? Math.min(100, Math.floor((passive * 100) / outgoings)) : 100;
  const escaped = p.escapedAtRound !== null;
  const good = (cents: number) => <span className="text-teal-300">{fmt.signed(cents)}</span>;
  const bad = (cents: number) => <span className="text-wine-300">{fmt.signed(-cents)}</span>;
  const total = 'mt-1 border-t-2 border-night-900 pt-2';
  const state = escaped
    ? t('wayOut.escaped', { age: ageAt(content, p.escapedAtRound ?? 0), multiplier: fmt.factor(escapeMultiplier(p.escapedAtRound, content.rounds, content.scoring)) })
    : gap <= 0 && p.passiveStreak >= 1
      ? t('wayOut.oneMore')
      : t('wayOut.worth', { multiplier: fmt.factor(escapeMultiplier(shown.round, content.rounds, content.scoring)) });

  return (
    <>
      {/* Still in the race: the rat runs in its wheel, the harder the less of the year its money pays. */}
      {/* Still in the race, the rat runs in its wheel, the harder the less it covers; out of it, it walks out of the door. */}
      <div aria-hidden className="mt-1 flex justify-center">
        {escaped ? <Sprite id={ratArt('exit')} fallback={{ w: 128, h: 128 }} /> : <Loop name="wheel" outfit={ratOutfit(shown)} scale={2} ms={Math.round(90 + pct * 1.4)} />}
      </div>
      <div className="my-2 flex items-baseline justify-between gap-3">
        <span className="pixel text-[13px] uppercase tracking-wider text-gold-200">{t('wayOut.covered')}</span>
        <KeyFigure tone={escaped ? 'teal' : 'gold'}>{pct}%</KeyFigure>
      </div>
      <Bar value={passive} max={outgoings} label={t('ratRace')} tone={escaped ? 'teal' : 'gold'} door />
      <div className="mt-3">
        {lines.dividends > 0 ? <Row left={t('dividends')} right={good(lines.dividends)} /> : null}
        {lines.interest > 0 ? <Row left={t('interest')} right={good(lines.interest)} /> : null}
        {lines.rent > 0 ? <Row left={t('rent')} right={good(lines.rent)} /> : null}
        {lines.otherPassive > 0 ? <Row left={t('otherPassive')} right={good(lines.otherPassive)} /> : null}
        {tax > 0 ? <Row left={t('wayOut.tax')} right={bad(tax)} /> : null}
        <Row className={total} left={t('wayOut.passive')} sub={t('perYearShort')} right={<span className="text-teal-300">{fmt.money(passive)}</span>} />
        <Row left={t('wayOut.outgoings')} sub={t('perYearShort')} right={<span className="text-wine-300">{fmt.money(outgoings)}</span>} />
        <Row className={total} left={gap > 0 ? t('wayOut.missing') : t('wayOut.spare')} right={<span className={gap > 0 ? 'text-gold-500' : 'text-teal-300'}>{fmt.money(Math.abs(gap))}</span>} />
      </div>
      <p className="mt-2 text-[13px] leading-snug text-ink-200">{state}</p>
    </>
  );
}

/**
 * What status is for: the score as it would stand today, and how much of it is money and how much
 * is status. The figures are the engine's own, the same the last screen of a life will show.
 */
function ScoreNow({ shown }: { shown: GameView }) {
  const t = useT('hud');
  const { content, fmt } = useWords();
  const score = scoreBreakdown(content, shown);
  const sum = Math.max(1, score.wealth + score.status);
  const share = Math.round((score.status * 100) / sum);
  return (
    <section aria-label={t('scoreNow')} className="frame mt-3 bg-night-800 px-3 py-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="pixel text-[13px] uppercase tracking-wider text-gold-200">{t('scoreNow')}</span>
        <KeyFigure>{fmt.number(score.total)}</KeyFigure>
      </div>
      <div aria-hidden className="sunk mt-2 flex h-3 bg-ink-900">
        <span className="bg-gold-500" style={{ width: `${100 - share}%` }} />
        <span className="bg-teal-300" style={{ width: `${share}%` }} />
      </div>
      <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-[13px]">
        <span className="text-gold-500">{t('scoreWealth', { n: fmt.number(score.wealth) })}</span>
        <span className="text-teal-300">{t('scoreStatus', { n: fmt.number(score.status) })}</span>
      </div>
      <p className="mt-1.5 text-[12px] leading-snug text-ink-300">
        {score.multiplierPct > 100 ? t('scoreEscaped', { multiplier: fmt.factor(score.multiplierPct) }) : t('scoreHint')}
      </p>
    </section>
  );
}

/**
 * Always in sight: who and where you are, cash, yearly cashflow, status, and how far passive income
 * is from covering your life. `compact` leaves the skyline out and shrinks the portrait, to give
 * the cards and the finance tabs room. A tap on a figure opens a sheet of what it means and what it is made of.
 */
export function Hud({ compact = false, skyline = !compact, flush = false, onProfile }: { compact?: boolean; skyline?: boolean; /** In a column that has its own margins: no padding at the sides, so it lines up with what is under it. */ flush?: boolean; onProfile?: () => void }) {
  const t = useT('hud');
  const common = useT('common');
  const { content, text, names, fmt } = useWords();
  const lifeId = useGame((s) => s.lifeId) ?? '';
  const { locale } = useSettings();
  const character = characterName(lifeId, locale);
  const preview = useGame((s) => s.preview);
  const shown = useShown();
  const stage = useGame((s) => s.stage);
  const [open, setOpen] = useState<Figure | null>(null);
  const [settings, setSettings] = useState(false);
  const [paper, setPaper] = useState(false);
  const [jail, setJail] = useState(false);
  // What sticks to the top tells the tabs under it how far down to stick.
  const stuck = useRef<HTMLDivElement>(null);
  // The row with the portrait, watched so that once it has scrolled away the strip that sticks says whose life and which round it is.
  const top = useRef<HTMLDivElement>(null);
  const [away, setAway] = useState(false);
  useEffect(() => {
    const el = top.current;
    if (!el || flush || typeof IntersectionObserver === 'undefined') return;
    const watch = new IntersectionObserver(([entry]) => setAway(!entry.isIntersecting), { threshold: 0 });
    watch.observe(el);
    return () => watch.disconnect();
  }, [flush]);
  useEffect(() => {
    const el = stuck.current;
    if (!el || flush) return;
    const root = document.documentElement;
    const measure = () => root.style.setProperty('--hud-stick', `${el.offsetHeight}px`);
    measure();
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    watch?.observe(el);
    return () => {
      watch?.disconnect();
      root.style.removeProperty('--hud-stick');
    };
  }, [flush]);
  const p = shown.player;
  const age = ageAt(content, shown.round);
  const years = content.yearsPerRound;

  const flow = cashflow(content, shown);
  const yearly = flow.salaryAnnual + flow.passiveAnnual - flow.expensesAnnual;
  const escape = preview ? preview.escape : escapeProgress(content, shown);
  const escaped = p.escapedAtRound !== null;
  const { tier, rose } = useTierUp(p.statusPoints);
  const backdrop = BACKDROP[tier];
  // Where the profile is already on screen, as on a wide one, the portrait opens nothing and is no button.
  const portrait = (
    // A sprite is never drawn at a fraction of its size: the small portrait is the face, cut out of the whole.
    <Well className={`relative ${compact ? 'size-11 items-start overflow-hidden' : 'size-16 overflow-hidden'}`}>
      {backdrop ? <span aria-hidden className="absolute inset-0" style={{ background: backdrop }} /> : null}
      <Sprite id={portraitArt(lifeId, portraitAge(age))} fallback={{ w: 64, h: 64 }} className={`relative ${compact ? '-mt-1 max-w-none' : ''}`} />
    </Well>
  );
  // At full size the portrait hangs in a frame, plain at first and richer as status grows. The small one keeps its gold line.
  const framed = compact ? (
    <span key={rose} className={`frame-double relative my-1.5 ml-1.5 inline-flex shrink-0 leading-[0] [--ring:var(--color-gold-500)] ${rose > 0 ? 'animate-pop' : ''}`}>
      {portrait}
      {rose > 0 ? <Sparks colours={['bg-gold-500', 'bg-gold-200', 'bg-cream']} count={10} reach={34} /> : null}
    </span>
  ) : (
    <span key={rose} className={`relative inline-flex size-20 shrink-0 items-center justify-center leading-[0] ${rose > 0 ? 'animate-pop' : ''}`} data-frame={frameArt(p.statusPoints)}>
      {portrait}
      <Sprite id={frameArt(p.statusPoints)} fallback={{ w: 80, h: 80 }} className="pointer-events-none absolute inset-0" />
      {rose > 0 ? <Sparks colours={['bg-gold-500', 'bg-gold-200', 'bg-cream']} count={14} reach={52} size={4} /> : null}
      {rose > 0 ? <span aria-hidden data-motion-only className="pointer-events-none absolute inset-0 overflow-hidden"><span className="absolute inset-y-0 left-0 w-1/4 animate-glint opacity-0 bg-white/40 [animation-iteration-count:1]" /></span> : null}
    </span>
  );

  return (
    // On a phone the header dissolves into the page, so the figures and the way-out bar can stick to the top for the whole of it.
    <header className={flush ? 'flex flex-col gap-2 pt-3' : 'contents'}>
      {/* A round opens in the first light and closes at night; a boom and a crisis each have a sky of their own. */}
      {skyline ? <div className={flush ? '' : 'mt-3 px-3'}><CityBanner cityId={p.cityId} light={cityLight(shown.timeline[shown.round], stage === 'news')} /></div> : null}

      <div ref={top} className={`flex items-center gap-3 ${flush ? '' : `px-3 ${skyline ? 'mt-2' : 'mt-3'}`}`}>
        {onProfile ? (
          <button type="button" onClick={onProfile} aria-label={t('openProfile')} className="shrink-0 leading-[0]">
            {framed}
          </button>
        ) : (
          framed
        )}
        <div className="min-w-0 flex-1">
          {/* Who lives this life, by name, above how old they are. */}
          {character ? <div className="pixel mb-1 truncate text-[15px] leading-none text-gold-500">{character}</div> : null}
          <div className="pixel text-[26px] leading-none">{common('age', { age })}</div>
          <div className="mt-1 truncate text-[13px] text-ink-200">
            {t('roundShort', { n: Math.min(shown.round + 1, content.rounds), total: content.rounds })} · {names.cities[p.cityId]}
          </div>
          {/* The job on a line of its own: a long title is not cut short by the city. */}
          {p.life.career ? <div className="truncate text-[12px] leading-tight text-ink-300">{text.careers[p.life.career.id].levels[p.life.career.level]}</div> : null}
          {/* Prison says so where the player always looks. */}
          {p.life.jailRounds > 0 ? (
            <button type="button" aria-haspopup="dialog" onClick={() => setJail(true)} className="mt-1 inline-flex">
              <Tag tone="bad">{t('inJail')} ›</Tag>
            </button>
          ) : null}
          <JailSheet open={jail && p.life.jailRounds > 0} onClose={() => setJail(false)} left={p.life.jailRounds} />
        </div>
        {/* The paper of the round, to read again once the round is under way. */}
        {stage !== 'news' ? (
          <button type="button" aria-haspopup="dialog" aria-label={t('openNews')} onClick={() => setPaper(true)} className="frame-raised flex size-11 shrink-0 items-center justify-center bg-night-700 transition-transform active:translate-y-[2px]">
            <Sprite id="icon.news" fallback={{ w: 32, h: 32 }} />
          </button>
        ) : null}
        <button type="button" aria-haspopup="dialog" aria-label={t('openSettings')} onClick={() => setSettings(true)} className="frame-raised flex size-11 shrink-0 items-center justify-center bg-night-700 transition-transform active:translate-y-[2px]">
          <Sprite id="icon.settings" fallback={{ w: 32, h: 32 }} />
        </button>
      </div>

      <div ref={stuck} className={flush ? 'flex flex-col gap-2' : 'sticky top-safe z-30 mt-2 flex flex-col gap-2 bg-night-800 px-3 pb-2 pt-1'}>
      {away ? (
        <div className="flex items-baseline justify-between gap-2 text-[13px] text-ink-200">
          <span className="pixel truncate">
            {character ? <span className="text-gold-500">{character} · </span> : null}
            {common('age', { age })}
          </span>
          <span className="shrink-0">{t('roundShort', { n: Math.min(shown.round + 1, content.rounds), total: content.rounds })}</span>
        </div>
      ) : null}
      <div className="@container">
        <div className="grid grid-cols-3 gap-1.5">
          {/* Where money that comes in lands: coins fly here from a card that paid. */}
          <div data-hud-cash className="contents">
            <Stat icon="icon.cash" value={fmt.compact(p.cash)} label={t('cash')} onOpen={() => setOpen('cash')} />
          </div>
          <Stat icon="icon.cashflow" value={fmt.compact(yearly).replace(/^(?=[^−])/, '+')} label={t('flow')} tone={yearly >= 0 ? 'good' : 'bad'} hint={t('flowHint')} onOpen={() => setOpen('flow')} />
          <Stat icon="icon.status" value={fmt.number(p.statusPoints)} label={t('status')} onOpen={() => setOpen('status')} />
        </div>
      </div>

      <button type="button" aria-haspopup="dialog" title={t('ratRaceHint')} onClick={() => setOpen('ratRace')} className="block min-h-11 w-full text-left">
        <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
          <span className="pixel">{escaped ? t('escaped', { age: ageAt(content, p.escapedAtRound ?? 0) }) : t('ratRace')}</span>
          <span className="pixel text-[14px] text-ink-200">
            {fmt.compact(Math.floor(escape.passiveAfterTax / years))} / {fmt.compact(Math.floor(escape.outgoings / years))}
          </span>
        </div>
        <Bar value={escape.passiveAfterTax} max={escape.outgoings} label={t('ratRace')} tone={escaped ? 'teal' : 'gold'} door />
      </button>
      </div>

      {/* Away from the news, where the bar of a crisis is whole, a strip says it is on. It scrolls away with the page: only the figures stay stuck. */}
      {compact ? (
        <div className={flush ? '' : 'mt-2 px-3'}>
          <CrisisBar crisis={shown.timeline[shown.round]?.crisis ?? null} compact />
        </div>
      ) : null}

      <Sheet open={open !== null} onClose={() => setOpen(null)} title={open ? t(open) : ''} closeLabel={common('close')}>
        {open ? <Details figure={open} shown={shown} /> : null}
      </Sheet>
      <SettingsSheet open={settings} onClose={() => setSettings(false)} shown={shown} />
      <Sheet open={paper} onClose={() => setPaper(false)} title={t('newsTitle')} closeLabel={common('close')}>
        {paper ? <Headlines /> : null}
      </Sheet>
    </header>
  );
}
