'use client';

import { useEffect, useId, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { closeOnBack } from './back';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A sheet that rises from the bottom of a phone, and sits in the middle of a wide screen.
 * Whatever a tap opens to say more about something goes in one of these, over a dimmed page:
 * details are never unfolded in place, where they would push the game about.
 * It takes the focus while it is open, keeps Tab inside it, closes on Escape, a tap outside or
 * the Back button of a phone, and gives the focus back to whatever opened it.
 *
 * `tone` frames it in gold or in wine, for a sheet that carries news and not a choice.
 *
 * `back={false}` leaves the history alone. It is for a sheet whose answer replaces the page: an
 * entry of its own would be the one replaced, and the page it meant to leave would stay behind.
 */
export function Sheet({ open, onClose, title, closeLabel, back = true, tone, children }: { open: boolean; onClose(): void; title: ReactNode; closeLabel: string; back?: boolean; tone?: 'gold' | 'wine'; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // The latest `onClose`, so that a parent which makes a new one on every draw does not reopen the effect below.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const box = panel.current;
    if (!box) return;
    const opener = document.activeElement as HTMLElement | null;
    box.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // The keys are heard on the whole page, not on the sheet: the focus can leave the sheet without
    // the player doing anything, and a sheet that no longer hears Escape is a trap.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const stops = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const active = document.activeElement;
      const first = stops.at(0);
      const last = stops.at(-1);
      if (!first || !last) {
        event.preventDefault();
        box.focus();
      } else if (!box.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && (active === first || active === box)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    const forgetBack = back ? closeOnBack(() => close.current()) : () => {};

    // When the thing that had the focus is taken out of the sheet (an order removed from a list),
    // the browser drops the focus on the page behind. Bring it back.
    const watcher = new MutationObserver(() => {
      if (!box.contains(document.activeElement)) box.focus();
    });
    watcher.observe(box, { childList: true, subtree: true });

    return () => {
      forgetBack();
      watcher.disconnect();
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, [open, back]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center desk:items-center desk:p-6">
      <div aria-hidden data-sheet-backdrop className="absolute inset-0 bg-night-900/80" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-tone={tone}
        className={`bevel pb-safe relative max-h-[88dvh] w-full max-w-md animate-rise overflow-y-auto bg-night-800 p-4 outline-none ${tone === 'gold' ? 'frame-gold' : tone === 'wine' ? 'frame-wine' : ''}`}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id={titleId} className="pixel pt-1 text-[19px]">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label={closeLabel} className="pixel -mr-2 -mt-2 flex size-11 shrink-0 items-center justify-center text-[20px] text-ink-300">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/**
 * A strip of tabs that scrolls sideways on a phone. Arrow keys move between them.
 * With `idPrefix`, each tab gets the id `<prefix>-tab-<id>` and points at the panel `<prefix>-panel-<id>`,
 * so the panel can be named by its tab.
 */
export function Tabs<T extends string>({ label, tabs, value, onChange, idPrefix }: { label: string; tabs: Array<{ id: T; label: ReactNode }>; value: T; onChange(id: T): void; idPrefix?: string }) {
  const strip = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const at = tabs.findIndex((tab) => tab.id === value);
    const next = tabs[(at + step + tabs.length) % tabs.length];
    onChange(next.id);
    strip.current?.querySelector<HTMLElement>(`[data-tab="${next.id}"]`)?.focus();
  };

  return (
    <div ref={strip} role="tablist" aria-label={label} onKeyDown={onKeyDown} className="no-scrollbar flex gap-2 overflow-x-auto px-3 py-2">
      {tabs.map((tab) => {
        const on = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={idPrefix ? `${idPrefix}-tab-${tab.id}` : undefined}
            aria-controls={idPrefix ? `${idPrefix}-panel-${tab.id}` : undefined}
            data-tab={tab.id}
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={`pixel frame-raised min-h-11 shrink-0 px-3 text-[15px] ${on ? 'frame-cream bg-cream text-ink-900' : 'bg-night-700 text-ink-200'}`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/** A short message that shows itself out. */
export function Toast({ message, onDone, ms = 2600 }: { message: ReactNode | null; onDone(): void; ms?: number }) {
  useEffect(() => {
    if (message === null) return;
    const timer = setTimeout(onDone, ms);
    return () => clearTimeout(timer);
  }, [message, onDone, ms]);

  if (message === null) return null;
  return (
    <div role="alert" className="pointer-events-none fixed inset-x-0 bottom-28 z-[60] flex justify-center px-4">
      <div className="frame animate-rise bg-wine-700 px-3 py-2 text-center text-[14px] text-cream">{message}</div>
    </div>
  );
}
