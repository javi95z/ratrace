'use client';

import { cityArt, portraitArt } from '@ratrace/content';
import { cashflow, cashflowLines, escapeProgress, netWorth, statusBreakdown } from '@ratrace/engine';
import type { GameView } from '@ratrace/engine';
import { useState } from 'react';
import { useGame, useT, useWords } from '@/game/context';
import { ageAt, portraitAge } from '@/game/present';
import { Bar, Row, Stat, Well } from '@/ui/kit';
import { Sheet } from '@/ui/overlay';
import { Sprite } from '@/ui/Sprite';
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

type Figure = 'cash' | 'flow' | 'status';

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
 * Always in sight: who and where you are, cash, yearly cashflow, status, and how far passive income
 * is from covering your life. `compact` leaves the skyline out and shrinks the portrait, to give
 * the cards and the finance tabs room. A tap on a figure opens a sheet of what it means and what it is made of.
 */
export function Hud({ compact = false, skyline = !compact, onProfile }: { compact?: boolean; skyline?: boolean; onProfile?: () => void }) {
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
    <Well className={compact ? 'size-11 items-start overflow-hidden' : 'size-[68px]'}>
      <Sprite id={portraitArt(lifeId, portraitAge(age))} fallback={{ w: 64, h: 64 }} className={compact ? '-mt-1 max-w-none' : ''} />
    </Well>
  );

  return (
    <header className="flex flex-col gap-2 px-3 pt-3">
      {skyline ? (
        <div className="frame-double mx-auto mb-1.5 mt-1 flex max-w-[calc(100%-12px)] justify-center overflow-hidden bg-night-900 leading-[0]" style={{ width: 'calc(312px * var(--art))' }}>
          {/* A round opens in the first light and closes at night. */}
          <Sprite id={cityArt(p.cityId, stage === 'news' ? 'day' : 'night')} scale="art" alt={names.cities[p.cityId]} fallback={{ w: 312, h: 66 }} className="max-w-none" />
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        {onProfile ? (
          <button type="button" onClick={onProfile} aria-label={t('openProfile')} className="frame-double my-1.5 ml-1.5 shrink-0 leading-[0] [--ring:var(--color-gold-500)]">
            {portrait}
          </button>
        ) : (
          <span className="frame-double my-1.5 ml-1.5 shrink-0 leading-[0] [--ring:var(--color-gold-500)]">{portrait}</span>
        )}
        <div className="min-w-0 flex-1">
          <div className="pixel text-[26px] leading-none">{common('age', { age })}</div>
          <div className="mt-1 truncate text-[13px] text-ink-200">
            {common('round', { n: Math.min(shown.round + 1, content.rounds), total: content.rounds })} · {names.cities[p.cityId]}
            {p.life.career ? ` · ${text.careers[p.life.career.id].levels[p.life.career.level]}` : ''}
          </div>
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

      <div title={t('ratRaceHint')}>
        <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
          <span className="pixel">{escaped ? t('escaped', { age: ageAt(content, p.escapedAtRound ?? 0) }) : t('ratRace')}</span>
          <span className="pixel text-[14px] text-ink-200">
            {fmt.compact(Math.floor(escape.passiveAfterTax / years))} / {fmt.compact(Math.floor(escape.outgoings / years))}
          </span>
        </div>
        <Bar value={escape.passiveAfterTax} max={escape.outgoings} label={t('ratRace')} tone={escaped ? 'teal' : 'gold'} door />
      </div>

      <Sheet open={open !== null} onClose={() => setOpen(null)} title={open ? t(open) : ''} closeLabel={common('close')}>
        {open ? <Details figure={open} shown={shown} /> : null}
      </Sheet>
      <SettingsSheet open={settings} onClose={() => setSettings(false)} shown={shown} />
    </header>
  );
}
