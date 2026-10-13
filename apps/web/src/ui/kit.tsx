import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { Tone } from '@/game/present';
import { Sprite } from './Sprite';

const join = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'quiet';

const BUTTON: Record<ButtonVariant, string> = {
  // Gold is kept for the one thing a screen most wants the player to do.
  primary: 'bg-gold-500 text-ink-900 frame-gold',
  secondary: 'bg-night-600 text-cream',
  danger: 'bg-wine-700 text-cream frame-wine',
  quiet: 'bg-night-700 text-ink-200',
};

/**
 * Something to buy, as a tile in a grid: the same navy as every other surface, lit and raised
 * because it can be pressed. The picture inside sits in a `Well`.
 */
export const TILE = 'frame-raised flex min-h-11 flex-col items-center gap-1 bg-night-600 p-2 text-center text-cream transition-transform active:translate-y-[2px]';

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

/** The title of a panel: a gold tab that hangs over its top edge. */
export function TabTitle({ children, as: Heading = 'h2' }: { children: ReactNode; as?: 'h2' | 'h3' }) {
  return (
    <Heading className="pixel tab absolute -top-3 left-2 max-w-[calc(100%-1rem)] truncate bg-gold-500 px-2 pb-0.5 pt-1 text-[14px] uppercase tracking-[0.1em] text-ink-900">
      {children}
    </Heading>
  );
}

/** The room a panel leaves above itself and inside its top for a tab. */
export const TABBED = 'relative mt-3 pt-5';

/** A navy panel with a lit pixel frame. With a title, the title hangs on a gold tab. `label` names the panel for a screen reader. */
export function Panel({ children, className, title, label }: { children: ReactNode; className?: string; title?: ReactNode; label?: string }) {
  return (
    <section aria-label={label} className={join('bevel bg-night-700 p-3', title ? TABBED : null, className)}>
      {title ? <TabTitle>{title}</TabTitle> : null}
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

/** A dark well, sunk into the page, that an icon or a sprite sits in. */
export function Well({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={join('sunk inline-flex shrink-0 items-center justify-center bg-ink-900', className)}>{children}</span>;
}

/**
 * One figure of the HUD: an icon, a number, and what the number is. Inside a container too narrow
 * for three of them side by side, the icon steps aside so the number is never cut short.
 * With `onOpen` it is a button that opens the sheet of what the figure means.
 */
export function Stat({ icon, value, label, tone, hint, onOpen }: { icon: string; value: string; label: string; tone?: 'good' | 'bad'; hint?: string; onOpen?: () => void }) {
  const body = (
    <>
      {/* The well is exactly the icon. On the narrowest phones three figures side by side leave it no room, and it steps aside. */}
      <Well className="size-8 @max-[340px]:hidden">
        <Sprite id={icon} />
      </Well>
      <div className="min-w-0">
        {/* Beside its icon the figure has least room on a mid-sized phone, so there it is set a size smaller; nowhere is it cut. */}
        <div className={join('pixel truncate text-[16px] tracking-normal @min-[341px]:@max-[357px]:text-[14px] @min-[358px]:@max-[371px]:text-[15px]', tone === 'good' && 'text-teal-300', tone === 'bad' && 'text-wine-300')}>
          {value}
        </div>
        <div className="truncate text-[11px] leading-tight text-ink-200">{label}</div>
      </div>
    </>
  );
  const box = 'flex min-w-0 items-center gap-1.5 bg-night-700 p-1 @max-[340px]:px-2';
  if (!onOpen) {
    return (
      <div className={join('bevel', box)} title={hint}>
        {body}
      </div>
    );
  }
  // One that opens something stands off the page like every other thing that can be pressed.
  return (
    <button type="button" aria-haspopup="dialog" onClick={onOpen} title={hint} className={join('frame-raised', box, 'relative min-h-11 text-left transition-transform active:translate-y-[2px]')}>
      {body}
      {/* Out of the flow, so it takes no width from the number. */}
      <span aria-hidden className="pixel absolute bottom-0.5 right-1 text-[10px] leading-none text-ink-300">
        ▸
      </span>
    </button>
  );
}

const LAMP = {
  gold: 'lamp bg-gold-500 [--hi:var(--color-gold-200)] [--lo:var(--color-gold-700)]',
  teal: 'lamp bg-teal-300 [--hi:var(--color-sky-100)] [--lo:var(--color-teal-600)]',
};

/**
 * A track of sixteen lamps that light from the left. With `door`, the track ends at a door: the
 * way out of the rat race, which stands open once the last lamp is lit.
 */
export function Bar({ value, max, label, tone = 'gold', door = false }: { value: number; max: number; label: string; tone?: 'gold' | 'teal'; door?: boolean }) {
  const cells = 16;
  const share = max <= 0 ? (value > 0 ? 1 : 0) : Math.max(0, Math.min(1, value / max));
  const filled = Math.floor(share * cells + 1e-9);
  const open = filled === cells;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(share * 100)}
      className="frame sunk grid items-center gap-[2px] bg-night-900 p-[3px]"
      style={{ gridTemplateColumns: `repeat(${cells}, minmax(0, 1fr))${door ? ' 14px' : ''}` }}
    >
      {Array.from({ length: cells }, (_, i) => (
        <span key={i} className={join('h-2.5', i < filled ? LAMP[tone] : 'bg-night-600')} />
      ))}
      {door ? (
        // A door drawn in six pixels: a leaf, its frame, and a gold handle. Open, it is all light.
        <span aria-hidden data-door={open ? 'open' : 'shut'} className={join('relative ml-[2px] h-3.5', open ? 'bg-gold-200' : 'bg-teal-600 shadow-[inset_0_0_0_2px_var(--color-teal-800)]')}>
          {open ? null : <span className="absolute right-[3px] top-[6px] size-[2px] bg-gold-200" />}
        </span>
      ) : null}
    </div>
  );
}

const BADGE: Record<string, string> = {
  bond: 'bg-sky-500 text-cream [--hi:var(--color-sky-300)] [--lo:var(--color-night-500)]',
  equity: 'bg-teal-800 text-cream [--hi:var(--color-teal-600)] [--lo:var(--color-night-800)]',
  crypto: 'bg-gold-700 text-ink-900 [--hi:var(--color-gold-500)] [--lo:var(--color-gold-900)]',
  gold: 'bg-gold-500 text-ink-900 [--hi:var(--color-gold-200)] [--lo:var(--color-gold-700)]',
};

/** An asset's ticker on a coloured plate. Assets have no sprite of their own. */
export function TickerBadge({ ticker, kind }: { ticker: string; kind: string }) {
  return (
    <span className={join('pixel lamp inline-flex h-9 w-14 shrink-0 items-center justify-center text-[14px]', BADGE[kind] ?? BADGE.equity)}>{ticker}</span>
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
  /** `icon` is a sprite drawn above the label. */
  options: Array<{ value: T; label: ReactNode; disabled?: boolean; hint?: ReactNode; icon?: string }>;
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
              'frame-raised flex min-h-11 flex-col items-center justify-center px-1 py-1.5 text-center disabled:opacity-40',
              on ? 'frame-cream bg-cream text-ink-900' : 'bg-night-600 text-ink-200',
            )}
          >
            {option.icon ? (
              <span className="mb-1 inline-flex size-9 shrink-0 items-center justify-center">
                <Sprite id={option.icon} />
              </span>
            ) : null}
            <span className="pixel text-[14px]">{option.label}</span>
            {option.hint ? <span className={join('text-[11px] leading-tight', on ? 'text-ink-500' : 'text-ink-200')}>{option.hint}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** An on/off switch with its label, the whole row tappable. `icon` is a sprite shown before the label. */
export function Toggle({ on, onChange, label, hint, disabled, icon }: { on: boolean; onChange(on: boolean): void; label: ReactNode; hint?: ReactNode; disabled?: boolean; icon?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={join('frame-raised flex min-h-11 w-full items-center gap-3 bg-night-600 py-2 pr-3 text-left disabled:opacity-40', icon ? 'pl-2' : 'pl-3')}
    >
      {icon ? (
        <span className="inline-flex size-9 shrink-0 items-center justify-center">
          <Sprite id={icon} />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="pixel block text-[15px]">{label}</span>
        {hint ? <span className="block text-[12px] leading-tight text-ink-200">{hint}</span> : null}
      </span>
      <span aria-hidden className={join('frame sunk relative h-5 w-10 shrink-0', on ? 'bg-teal-600' : 'bg-night-900')}>
        <span className={join('lamp absolute top-0 size-5 bg-cream transition-[left] [--hi:var(--color-white)] [--lo:var(--color-ink-200)]', on ? 'left-5' : 'left-0')} />
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
