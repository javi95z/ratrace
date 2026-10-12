import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { Tone } from '@/game/present';
import { Sprite } from './Sprite';

const join = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'quiet';

const BUTTON: Record<ButtonVariant, string> = {
  // Gold is kept for the one thing a screen most wants the player to do.
  primary: 'bg-gold-500 text-ink-900 frame-gold',
  secondary: 'bg-night-600 text-cream',
  danger: 'bg-wine-700 text-cream',
  quiet: 'bg-night-700 text-ink-200',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Fills the width it is given. */
  wide?: boolean;
}

/** A pixel button. Never smaller than 44px, so a thumb can hit it. */
export function Button({ variant = 'secondary', wide = false, className, type = 'button', children, ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={join(
        'pixel frame-raised inline-flex min-h-11 select-none items-center justify-center gap-2 px-4 py-2 text-center text-[17px]',
        'transition-transform active:translate-y-[2px] disabled:pointer-events-none disabled:opacity-45',
        BUTTON[variant],
        wide && 'w-full',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** A navy panel with a pixel frame. */
export function Panel({ children, className, title }: { children: ReactNode; className?: string; title?: ReactNode }) {
  return (
    <section className={join('frame bg-night-700 p-3', className)}>
      {title ? <h2 className="pixel mb-2 text-[13px] uppercase tracking-wider text-ink-300">{title}</h2> : null}
      {children}
    </section>
  );
}

const TONE: Record<Tone, string> = {
  good: 'bg-teal-800 text-cream',
  bad: 'bg-wine-700 text-cream',
  plain: 'bg-night-600 text-ink-200',
};

/** A small label that says what something does. Green helps, red costs. */
export function Tag({ tone = 'plain', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={join('pixel inline-block px-1.5 py-0.5 text-[12px] leading-tight', TONE[tone])}>{children}</span>;
}

/** A dark well that an icon or a sprite sits in. */
export function Well({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={join('inline-flex shrink-0 items-center justify-center bg-ink-900', className)}>{children}</span>;
}

/** One figure of the HUD: an icon, a number, and what the number is. */
export function Stat({ icon, value, label, tone, hint }: { icon: string; value: string; label: string; tone?: 'good' | 'bad'; hint?: string }) {
  return (
    <div className="frame flex min-w-0 items-center gap-2 bg-night-700 p-1" title={hint}>
      <Well className="size-9">
        <Sprite id={icon} />
      </Well>
      <div className="min-w-0">
        <div className={join('pixel truncate text-[15px]', tone === 'good' && 'text-teal-300', tone === 'bad' && 'text-wine-300')}>{value}</div>
        <div className="truncate text-[11px] leading-tight text-ink-300">{label}</div>
      </div>
    </div>
  );
}

/** A bar of sixteen pixels that fill from the left. */
export function Bar({ value, max, label, tone = 'gold' }: { value: number; max: number; label: string; tone?: 'gold' | 'teal' }) {
  const cells = 16;
  const share = max <= 0 ? (value > 0 ? 1 : 0) : Math.max(0, Math.min(1, value / max));
  const filled = Math.floor(share * cells + 1e-9);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(share * 100)}
      className="frame grid gap-[2px] bg-night-900 p-[2px]"
      style={{ gridTemplateColumns: `repeat(${cells}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: cells }, (_, i) => (
        <span key={i} className={join('h-2', i < filled ? (tone === 'teal' ? 'bg-teal-300' : 'bg-gold-500') : 'bg-night-600')} />
      ))}
    </div>
  );
}

const BADGE: Record<string, string> = {
  bond: 'bg-sky-500 text-cream',
  equity: 'bg-teal-800 text-cream',
  crypto: 'bg-gold-700 text-ink-900',
  gold: 'bg-gold-500 text-ink-900',
};

/** An asset's ticker on a coloured plate. Assets have no sprite of their own. */
export function TickerBadge({ ticker, kind }: { ticker: string; kind: string }) {
  return (
    <span className={join('pixel inline-flex h-9 w-14 shrink-0 items-center justify-center text-[13px]', BADGE[kind] ?? BADGE.equity)}>{ticker}</span>
  );
}

/** A row of choices of which exactly one is on. */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: T; label: ReactNode; disabled?: boolean; hint?: ReactNode }>;
  value: T;
  onChange(value: T): void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={join(
              'frame flex min-h-11 flex-col items-center justify-center px-1 py-1.5 text-center disabled:opacity-40',
              on ? 'bg-cream text-ink-900' : 'bg-night-600 text-ink-200',
            )}
          >
            <span className="pixel text-[14px]">{option.label}</span>
            {option.hint ? <span className={join('text-[11px] leading-tight', on ? 'text-ink-500' : 'text-ink-300')}>{option.hint}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** An on/off switch with its label, the whole row tappable. */
export function Toggle({ on, onChange, label, hint, disabled }: { on: boolean; onChange(on: boolean): void; label: ReactNode; hint?: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="frame flex min-h-11 w-full items-center justify-between gap-3 bg-night-600 px-3 py-2 text-left disabled:opacity-40"
    >
      <span className="min-w-0">
        <span className="pixel block text-[15px]">{label}</span>
        {hint ? <span className="block text-[12px] leading-tight text-ink-300">{hint}</span> : null}
      </span>
      <span aria-hidden className={join('frame relative h-5 w-10 shrink-0', on ? 'bg-teal-600' : 'bg-night-900')}>
        <span className={join('absolute top-0 size-5 bg-cream transition-[left]', on ? 'left-5' : 'left-0')} />
      </span>
    </button>
  );
}

/** A line of a list: something on the left, something on the right. */
export function Row({ left, right, sub, className }: { left: ReactNode; right?: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={join('flex items-center justify-between gap-3 py-1.5', className)}>
      <div className="min-w-0">
        <div className="truncate">{left}</div>
        {sub ? <div className="truncate text-[12px] text-ink-300">{sub}</div> : null}
      </div>
      {right !== undefined ? <div className="pixel shrink-0 text-right">{right}</div> : null}
    </div>
  );
}
