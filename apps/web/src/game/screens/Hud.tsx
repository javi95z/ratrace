'use client';

import { cityArt, portraitArt } from '@ratrace/content';
import { cashflow, escapeProgress } from '@ratrace/engine';
import type { GameView } from '@ratrace/engine';
import { useGame, useT, useWords } from '@/game/context';
import { ageAt, portraitAge } from '@/game/present';
import { Bar, Stat, Well } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';

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
 * Always in sight: who and where you are, cash, yearly cashflow, status, and how far passive income
 * is from covering your life. `compact` leaves the skyline out and shrinks the portrait, to give
 * the cards and the finance tabs room.
 */
export function Hud({ compact = false, skyline = !compact, onProfile }: { compact?: boolean; skyline?: boolean; onProfile?: () => void }) {
  const t = useT('hud');
  const common = useT('common');
  const { content, text, names, fmt } = useWords();
  const lifeId = useGame((s) => s.lifeId) ?? '';
  const preview = useGame((s) => s.preview);
  const shown = useShown();
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
        <div className="frame mx-auto flex max-w-full justify-center overflow-hidden bg-night-900 leading-[0]" style={{ width: 'calc(312px * var(--art))' }}>
          <Sprite id={cityArt(p.cityId)} scale="art" alt={names.cities[p.cityId]} fallback={{ w: 312, h: 66 }} className="max-w-none" />
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        {onProfile ? (
          <button type="button" onClick={onProfile} aria-label={t('openProfile')} className="frame shrink-0 leading-[0]">
            {portrait}
          </button>
        ) : (
          <span className="frame shrink-0 leading-[0]">{portrait}</span>
        )}
        <div className="min-w-0 flex-1">
          <div className="pixel text-[20px]">{common('age', { age })}</div>
          <div className="truncate text-[13px] text-ink-300">
            {common('round', { n: Math.min(shown.round + 1, content.rounds), total: content.rounds })} · {names.cities[p.cityId]}
            {p.life.career ? ` · ${text.careers[p.life.career.id].levels[p.life.career.level]}` : ''}
          </div>
        </div>
      </div>

      <div className="@container">
        <div className="grid grid-cols-3 gap-1.5">
          <Stat icon="icon.cash" value={fmt.compact(p.cash)} label={t('cash')} />
          <Stat icon="icon.cashflow" value={fmt.compact(yearly).replace(/^(?=[^−])/, '+')} label={t('flow')} tone={yearly >= 0 ? 'good' : 'bad'} hint={t('flowHint')} />
          <Stat icon="icon.status" value={fmt.number(p.statusPoints)} label={t('status')} />
        </div>
      </div>

      <div title={t('ratRaceHint')}>
        <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
          <span className="pixel">{escaped ? t('escaped', { age: ageAt(content, p.escapedAtRound ?? 0) }) : t('ratRace')}</span>
          <span className="text-ink-300">
            {fmt.compact(Math.floor(escape.passiveAfterTax / years))} / {fmt.compact(Math.floor(escape.outgoings / years))}
          </span>
        </div>
        <Bar value={escape.passiveAfterTax} max={escape.outgoings} label={t('ratRace')} tone={escaped ? 'teal' : 'gold'} />
      </div>
    </header>
  );
}
