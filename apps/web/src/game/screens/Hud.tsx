'use client';

import { frameArt, portraitArt } from '@ratrace/content';
import { cashflow, cashflowLines, escapeMultiplier, escapeProgress, netWorth, scoreBreakdown, statusBreakdown } from '@ratrace/engine';
import type { GameView } from '@ratrace/engine';
import { useState } from 'react';
import { useGame, useT, useWords } from '@/game/context';
import { ageAt, cityLight, portraitAge } from '@/game/present';
import { Bar, Row, Stat, Tag, Well } from '@/ui/kit';
import { Sheet } from '@/ui/overlay';
import { Sprite } from '@/ui/Sprite';
import { CityBanner } from './CityBanner';
import { CrisisBar } from './Crisis';
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
        <Row left={t('statusCity')} right={points(status.city)} />
        <Row left={t('statusLifestyle')} right={points(status.lifestyle)} />
        <Row left={t('statusItems')} right={points(status.items)} />
        {status.bonus !== 0 ? <Row left={t('statusBonus')} right={points(status.bonus)} /> : null}
        <Row className={total} left={t('statusNow')} right={fmt.number(status.total)} />
        <Row left={t('statusLived')} sub={t('statusLivedHint')} right={fmt.number(status.lived)} />
        <ScoreNow shown={shown} />
      </>
    );
  }

  return (
    <>
      <p className="mb-1 text-[13px] leading-snug text-ink-200">{t(`about.${figure}`)}</p>
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
      <div className="my-2 flex items-baseline justify-between gap-3">
        <span className="pixel text-[13px] uppercase tracking-wider text-gold-200">{t('wayOut.covered')}</span>
        <span className={`pixel text-[26px] leading-none ${escaped ? 'text-teal-300' : 'text-gold-500'}`}>{pct}%</span>
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
        <span className="pixel text-[22px] leading-none text-gold-500">{fmt.number(score.total)}</span>
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
  const preview = useGame((s) => s.preview);
  const shown = useShown();
  const stage = useGame((s) => s.stage);
  const [open, setOpen] = useState<Figure | null>(null);
  const [settings, setSettings] = useState(false);
  const p = shown.player;
  const age = ageAt(content, shown.round);
  const years = content.yearsPerRound;

  const flow = cashflow(content, shown);
  const yearly = flow.salaryAnnual + flow.passiveAnnual - flow.expensesAnnual;
  const escape = preview ? preview.escape : escapeProgress(content, shown);
  const escaped = p.escapedAtRound !== null;
  // Where the profile is already on screen, as on a wide one, the portrait opens nothing and is no button.
  const portrait = (
    // A sprite is never drawn at a fraction of its size: the small portrait is the face, cut out of the whole.
    <Well className={compact ? 'size-11 items-start overflow-hidden' : 'size-16'}>
      <Sprite id={portraitArt(lifeId, portraitAge(age))} fallback={{ w: 64, h: 64 }} className={compact ? '-mt-1 max-w-none' : ''} />
    </Well>
  );
  // At full size the portrait hangs in a frame, plain at first and richer as status grows. The small one keeps its gold line.
  const framed = compact ? (
    <span className="frame-double my-1.5 ml-1.5 inline-flex shrink-0 leading-[0] [--ring:var(--color-gold-500)]">{portrait}</span>
  ) : (
    <span className="relative inline-flex size-20 shrink-0 items-center justify-center leading-[0]" data-frame={frameArt(p.statusPoints)}>
      {portrait}
      <Sprite id={frameArt(p.statusPoints)} fallback={{ w: 80, h: 80 }} className="pointer-events-none absolute inset-0" />
    </span>
  );

  return (
    <header className={`flex flex-col gap-2 pt-3 ${flush ? '' : 'px-3'}`}>
      {/* A round opens in the first light and closes at night; a boom and a crisis each have a sky of their own. */}
      {skyline ? <CityBanner cityId={p.cityId} light={cityLight(shown.timeline[shown.round], stage === 'news')} /> : null}

      <div className="flex items-center gap-3">
        {onProfile ? (
          <button type="button" onClick={onProfile} aria-label={t('openProfile')} className="shrink-0 leading-[0]">
            {framed}
          </button>
        ) : (
          framed
        )}
        <div className="min-w-0 flex-1">
          <div className="pixel text-[26px] leading-none">{common('age', { age })}</div>
          <div className="mt-1 truncate text-[13px] text-ink-200">
            {common('round', { n: Math.min(shown.round + 1, content.rounds), total: content.rounds })} · {names.cities[p.cityId]}
            {p.life.career ? ` · ${text.careers[p.life.career.id].levels[p.life.career.level]}` : ''}
          </div>
          {/* Prison says so where the player always looks. */}
          {p.life.jailRounds > 0 ? (
            <span className="mt-1 inline-flex">
              <Tag tone="bad">{t('inJail')}</Tag>
            </span>
          ) : null}
        </div>
        <button type="button" aria-haspopup="dialog" aria-label={t('openSettings')} onClick={() => setSettings(true)} className="frame-raised flex size-11 shrink-0 items-center justify-center bg-night-700 transition-transform active:translate-y-[2px]">
          <Sprite id="icon.settings" fallback={{ w: 32, h: 32 }} />
        </button>
      </div>

      <div className="@container">
        <div className="grid grid-cols-3 gap-1.5">
          <Stat icon="icon.cash" value={fmt.compact(p.cash)} label={t('cash')} onOpen={() => setOpen('cash')} />
          <Stat icon="icon.cashflow" value={fmt.compact(yearly).replace(/^(?=[^−])/, '+')} label={t('flow')} tone={yearly >= 0 ? 'good' : 'bad'} hint={t('flowHint')} onOpen={() => setOpen('flow')} />
          <Stat icon="icon.status" value={fmt.number(p.statusPoints)} label={t('status')} onOpen={() => setOpen('status')} />
        </div>
      </div>

      {/* Away from the news, where the bar of a crisis is whole, a strip keeps it in sight. */}
      {compact ? <CrisisBar crisis={shown.timeline[shown.round]?.crisis ?? null} compact /> : null}

      <button type="button" aria-haspopup="dialog" title={t('ratRaceHint')} onClick={() => setOpen('ratRace')} className="block w-full text-left">
        <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
          <span className="pixel">{escaped ? t('escaped', { age: ageAt(content, p.escapedAtRound ?? 0) }) : t('ratRace')}</span>
          <span className="pixel text-[14px] text-ink-200">
            {fmt.compact(Math.floor(escape.passiveAfterTax / years))} / {fmt.compact(Math.floor(escape.outgoings / years))}
          </span>
        </div>
        <Bar value={escape.passiveAfterTax} max={escape.outgoings} label={t('ratRace')} tone={escaped ? 'teal' : 'gold'} door />
      </button>

      <Sheet open={open !== null} onClose={() => setOpen(null)} title={open ? t(open) : ''} closeLabel={common('close')}>
        {open ? <Details figure={open} shown={shown} /> : null}
      </Sheet>
      <SettingsSheet open={settings} onClose={() => setSettings(false)} shown={shown} />
    </header>
  );
}
