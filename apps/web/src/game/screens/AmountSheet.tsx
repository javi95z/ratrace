'use client';

import { useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { useT, useWords } from '@/game/context';
import { Button } from '@/ui/kit';
import { Sheet } from '@/ui/overlay';
import { acceleratedRangeKey, KeyboardHint } from '@/ui/keyboard';

/** A step that gives the slider about two hundred stops, on a round number of dollars. */
export function sliderStep(max: number): number {
  const rough = max / 200;
  for (const step of [100, 500, 1_000, 5_000, 10_000, 50_000, 100_000, 500_000, 1_000_000, 5_000_000, 10_000_000]) {
    if (rough <= step) return step;
  }
  return 50_000_000;
}

interface Props {
  title: ReactNode;
  /** The most that can be chosen, in cents. */
  max: number;
  onClose(): void;
  /** Returns true if the amount was taken; the sheet then closes. */
  onConfirm(amount: number): boolean;
  /** Shown above the amount: what is being bought, at what price, and so on. */
  children?: ReactNode;
  /** The amount the sheet opens on, for something that already has one. Zero if absent. */
  start?: number;
  /** Shown under the button: another thing that can be done from here. */
  footer?: ReactNode;
}

/**
 * Picks an amount of money: a slider, chips for a quarter, a half and all of it, and one button.
 * It is mounted only while it is open, so it always starts from zero.
 */
export function AmountSheet({ title, max, onClose, onConfirm, children, start = 0, footer }: Props) {
  const t = useT('finance.amount');
  const common = useT('common');
  const { fmt } = useWords();
  const [amount, setAmount] = useState(Math.min(start, Math.max(0, max)));
  const step = sliderStep(max);
  const slider = useRef<HTMLInputElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);
  const availableId = useId();
  const helpId = useId();
  const setSafeAmount = (next: number) => setAmount(Math.max(0, Math.min(max, Number.isFinite(next) ? next : 0)));
  const submit = () => {
    if (amount > 0 && onConfirm(amount)) onClose();
  };
  const accelerated = (event: KeyboardEvent<HTMLInputElement>) => {
    const next = acceleratedRangeKey(event, amount, max, step);
    if (next === null) return;
    event.preventDefault();
    setSafeAmount(next);
  };

  return (
    <Sheet open onClose={onClose} title={title} closeLabel={common('close')} initialFocus={slider}>
      {children}
      {max <= 0 ? (
        <p className="py-4 text-center text-ink-300">{t('nothing')}</p>
      ) : (
        <div
          className="flex flex-col gap-3"
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !event.repeat && amount > 0) {
              event.preventDefault();
              confirm.current?.click();
            }
          }}
        >
          <output className="pixel block text-center text-[30px] text-gold-500" aria-live="polite">
            {fmt.money(amount)}
          </output>
          <input
            ref={slider}
            type="range"
            className="range"
            aria-label={t('amount')}
            aria-describedby={`${availableId} ${helpId}`}
            min={0}
            max={max}
            step={step}
            value={Math.min(amount, max)}
            onKeyDown={accelerated}
            onChange={(event) => setSafeAmount(Number(event.target.value))}
          />
          <div className="grid grid-cols-3 gap-2">
            {[25, 50, 100].map((pct) => (
              <button key={pct} type="button" onClick={() => setAmount(Math.floor((max * pct) / 100))} className="pixel frame-raised min-h-11 bg-night-600 text-[15px] text-ink-200">
                {pct}%
              </button>
            ))}
          </div>
          <p id={availableId} className="text-center text-[12px] text-ink-300">{t('available', { amount: fmt.money(max) })}</p>
          <p id={helpId} className="keyboard-hint justify-center text-center text-[12px] text-ink-300">{t('keyboardHelp')}</p>
          <Button
            ref={confirm}
            variant="primary"
            wide
            disabled={amount <= 0}
            aria-keyshortcuts="Control+Enter Meta+Enter"
            onClick={submit}
          >
            {t('confirm', { amount: fmt.money(amount) })}
            <KeyboardHint>Ctrl/⌘ ↵</KeyboardHint>
          </Button>
        </div>
      )}
      {footer}
    </Sheet>
  );
}
