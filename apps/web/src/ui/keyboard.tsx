'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from './kit';
import { Sheet } from './overlay';

export type KeyboardContextName = 'general' | 'new-life' | 'cards' | 'finance' | 'play';

type Shortcut = (event: KeyboardEvent) => boolean | void;
type Scope = { active: boolean; priority: number; shortcut: Shortcut };

interface KeyboardState {
  keyboard: boolean;
  openHelp(): void;
  register(id: symbol, scope: Scope): void;
  unregister(id: symbol): void;
  setContext(context: KeyboardContextName): void;
}

const KeyboardContext = createContext<KeyboardState | null>(null);

/** Inputs keep every key for editing. Custom shortcuts never steal browser or assistive-technology chords. */
export function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'));
}

/** A concise, localised reference. `?` opens it anywhere outside another dialog. */
function KeyboardHelp({ open, onClose, context }: { open: boolean; onClose(): void; context: KeyboardContextName }) {
  const t = useTranslations('keyboard');
  const common = useTranslations('common');
  const rows: Array<[string, string]> = [
    ['Tab', t('help.tab')],
    ['Shift + Tab', t('help.shiftTab')],
    ['Esc', t('help.escape')],
    ['?', t('help.question')],
  ];
  if (context === 'new-life') rows.push(['↑ / ↓ · Home / End', t('help.life')]);
  if (context === 'cards') rows.push(['↑ / ↓ · 1–4', t('help.cards')]);
  if (context === 'finance') {
    rows.push(['← / → · Home / End', t('help.tabs')]);
    rows.push(['[ / ]', t('help.switchTab')]);
    rows.push(['Shift + ← / → · PgUp / PgDn', t('help.amount')]);
  }
  if (context === 'play' || context === 'finance') rows.push(['Ctrl/⌘ + Enter', t('help.primary')]);

  return (
    <Sheet open={open} onClose={onClose} title={t('title')} closeLabel={common('close')} initialFocus="close">
      <p className="mb-3 text-[14px] leading-snug text-ink-200">{t('intro')}</p>
      <dl className="flex flex-col gap-2">
        {rows.map(([keys, description]) => (
          <div key={keys} className="grid grid-cols-[minmax(7.5rem,auto)_1fr] items-start gap-3 border-t-2 border-night-900 pt-2 first:border-0 first:pt-0">
            <dt><kbd className="keycap">{keys}</kbd></dt>
            <dd className="text-[13px] leading-snug text-ink-200">{description}</dd>
          </div>
        ))}
      </dl>
    </Sheet>
  );
}

/**
 * Owns keyboard modality, the shortcut priority stack and the global help sheet. A handler returns
 * true only when it consumed a key; lower-priority scopes then never see it.
 */
export function KeyboardProvider({ children }: { children: ReactNode }) {
  const [keyboard, setKeyboard] = useState(false);
  const [help, setHelp] = useState(false);
  const [context, setContext] = useState<KeyboardContextName>('general');
  const scopes = useRef(new Map<symbol, Scope>());

  useEffect(() => {
    const mode = (usingKeyboard: boolean) => {
      setKeyboard(usingKeyboard);
      document.documentElement.dataset.input = usingKeyboard ? 'keyboard' : 'pointer';
    };
    const onPointer = () => mode(false);
    const onKey = (event: KeyboardEvent) => {
      if (!['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) mode(true);
      if (event.defaultPrevented || isEditableTarget(event.target)) return;

      for (const scope of [...scopes.current.values()].filter((entry) => entry.active).sort((a, b) => b.priority - a.priority)) {
        if (scope.shortcut(event)) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }

      if (event.key === '?' && !event.ctrlKey && !event.metaKey && !event.altKey && !document.querySelector('[role="dialog"]')) {
        event.preventDefault();
        setHelp(true);
      }
    };
    document.documentElement.dataset.input = 'pointer';
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey);
      delete document.documentElement.dataset.input;
    };
  }, []);

  const value = useMemo<KeyboardState>(
    () => ({
      keyboard,
      openHelp: () => setHelp(true),
      register: (id, scope) => scopes.current.set(id, scope),
      unregister: (id) => scopes.current.delete(id),
      setContext,
    }),
    [keyboard],
  );

  return (
    <KeyboardContext.Provider value={value}>
      {children}
      <KeyboardHelp open={help} onClose={() => setHelp(false)} context={context} />
    </KeyboardContext.Provider>
  );
}

export function useKeyboard() {
  const value = useContext(KeyboardContext);
  if (!value) throw new Error('this component must be inside a KeyboardProvider');
  return value;
}

/** Registers a shortcut without replacing the document listener or closing over stale screen state. */
export function useKeyboardScope(shortcut: Shortcut, { active = true, priority = 0 }: { active?: boolean; priority?: number } = {}) {
  const { register, unregister } = useKeyboard();
  const id = useRef(Symbol('keyboard-scope'));
  const latest = useRef(shortcut);
  latest.current = shortcut;
  useEffect(() => {
    const key = id.current;
    register(key, { active, priority, shortcut: (event) => latest.current(event) });
    return () => unregister(key);
  }, [active, priority, register, unregister]);
}

/** Announces which shortcuts are useful on the current screen without making routing own game state. */
export function useKeyboardContext(context: KeyboardContextName) {
  const { setContext } = useKeyboard();
  useEffect(() => {
    setContext(context);
    return () => setContext('general');
  }, [context, setContext]);
}

/** A hint is visible only after the player uses a keyboard. */
export function KeyboardHint({ children }: { children: ReactNode }) {
  return <kbd className="keyboard-hint keycap pointer-events-none absolute right-1 top-1 z-[2]" aria-hidden>{children}</kbd>;
}

/** The settings entry expands in place, so it never stacks one modal over another. */
export function KeyboardGuide() {
  const t = useTranslations('keyboard');
  const [open, setOpen] = useState(false);
  return (
    <section className="border-t-2 border-night-900 pt-3">
      <Button wide onClick={() => setOpen((shown) => !shown)} aria-expanded={open}>
        {t('open')}
        <KeyboardHint>?</KeyboardHint>
      </Button>
      {open ? (
        <dl className="mt-3 flex flex-col gap-2">
          {([['Tab', 'tab'], ['Shift + Tab', 'shiftTab'], ['Esc', 'escape'], ['?', 'question']] as const).map(([keys, message]) => (
            <div key={keys} className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-3 border-t-2 border-night-900 pt-2">
              <dt><kbd className="keycap">{keys}</kbd></dt>
              <dd className="text-[13px] text-ink-200">{t(`help.${message}`)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}

/** Shared range behaviour; kept here so every money control has identical acceleration. */
export function acceleratedRangeKey(event: ReactKeyboardEvent<HTMLInputElement>, value: number, max: number, step: number): number | null {
  const direction = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 0;
  if (direction && event.shiftKey) return Math.max(0, Math.min(max, value + direction * step * 10));
  if (event.key === 'PageUp' || event.key === 'PageDown') {
    const page = Math.max(step, Math.round(max / 10 / step) * step);
    return Math.max(0, Math.min(max, value + (event.key === 'PageUp' ? page : -page)));
  }
  if (event.key === 'Home') return 0;
  if (event.key === 'End') return max;
  return null;
}
