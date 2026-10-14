'use client';

import { useState } from 'react';
import { Sheet } from './overlay';
import { Sprite } from './Sprite';

export interface PickerOption<T> {
  value: T;
  label: string;
  /** A sprite beside the label. */
  icon?: string;
}

/**
 * A choice among many, in the game's own look: a raised button showing what is chosen, which opens
 * the whole list in a sheet. The list is a listbox; picking closes it. Used where a native select
 * would not match the game.
 */
export function Picker<T extends string | null>({ label, value, options, onChange, closeLabel }: { label: string; value: T; options: ReadonlyArray<PickerOption<T>>; onChange(value: T): void; closeLabel: string }) {
  const [open, setOpen] = useState(false);
  const chosen = options.find((option) => option.value === value) ?? options[0];
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[13px] text-ink-200">{label}</span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-label={`${label}: ${chosen.label}`}
        onClick={() => setOpen(true)}
        className="frame-raised flex min-h-11 w-full items-center gap-2 bg-night-600 px-3 text-left text-[16px] text-cream active:translate-y-[2px]"
      >
        {chosen.icon ? <Sprite id={chosen.icon} /> : null}
        <span className="min-w-0 flex-1 truncate">{chosen.label}</span>
        <span aria-hidden className="text-[12px] text-gold-500">
          ▼
        </span>
      </button>
      {open ? (
        <Sheet open onClose={() => setOpen(false)} title={label} closeLabel={closeLabel}>
          <ul role="listbox" aria-label={label} className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {options.map((option) => {
              const selected = option.value === value;
              return (
                <li key={String(option.value)} className="contents">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={`flex min-h-11 items-center gap-2 px-3 py-1.5 text-left text-[15px] ${selected ? 'bevel frame-gold bg-night-600 text-gold-200' : 'frame bg-night-700 text-cream'}`}
                  >
                    {option.icon ? <Sprite id={option.icon} /> : null}
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {selected ? <span aria-hidden className="text-gold-500">✓</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </Sheet>
      ) : null}
    </div>
  );
}
