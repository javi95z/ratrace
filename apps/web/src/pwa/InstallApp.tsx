'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/game/context';
import { Button } from '@/ui/kit';
import { Sheet } from '@/ui/overlay';
import { usePwa } from './runtime';

const OFFER_KEY = 'ratrace.installOffer';

/**
 * Whether Home offers to install the game: from the second visit on, until the player says no. A
 * visit is a time the page is opened, counted once however often Home is shown in it. Nothing is
 * offered where the browser keeps nothing.
 */
export function useInstallOffer(): { shown: boolean; dismiss(): void } {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    try {
      const kept = JSON.parse(window.localStorage.getItem(OFFER_KEY) ?? '{}') as { visits?: number; dismissed?: boolean };
      let visits = kept.visits ?? 0;
      if (window.sessionStorage.getItem(OFFER_KEY) === null) {
        visits += 1;
        window.sessionStorage.setItem(OFFER_KEY, '1');
        window.localStorage.setItem(OFFER_KEY, JSON.stringify({ ...kept, visits }));
      }
      setShown(visits >= 2 && kept.dismissed !== true);
    } catch {
      setShown(false);
    }
  }, []);
  const dismiss = () => {
    setShown(false);
    try {
      const kept = JSON.parse(window.localStorage.getItem(OFFER_KEY) ?? '{}') as object;
      window.localStorage.setItem(OFFER_KEY, JSON.stringify({ ...kept, dismissed: true }));
    } catch {
      // Not kept: it is offered again next time, which is no harm.
    }
  };
  return { shown, dismiss };
}

/** A small invitation on Home and a useful fallback for browsers without a native install prompt. `onDismiss` adds a way to say no for good. */
export function InstallApp({ onDismiss }: { onDismiss?: () => void } = {}) {
  const t = useT('install');
  const common = useT('common');
  const { state, platform, install } = usePwa();
  const [instructions, setInstructions] = useState(false);

  if (state === 'checking' || state === 'installed') return null;

  const begin = () => {
    if (state === 'manual') {
      setInstructions(true);
      return;
    }
    void install().then((answer) => {
      if (answer === 'manual') setInstructions(true);
    });
  };

  const steps = platform === 'ios' ? (['iosShare', 'iosHome', 'iosAdd'] as const) : (['browserMenu', 'browserInstall', 'browserConfirm'] as const);
  return (
    <section aria-label={t('title')} className="frame flex w-full items-center gap-3 bg-night-700 p-3">
      <img src="/icons/icon-192.png" width="48" height="48" alt="" className="size-12 shrink-0 [image-rendering:pixelated]" />
      <div className="min-w-0 flex-1">
        <p className="pixel text-[16px] text-gold-500">{t('title')}</p>
        <p className="mt-0.5 text-[12px] leading-snug text-ink-200">{t('hint')}</p>
      </div>
      <Button variant="quiet" className="shrink-0 px-3 text-[14px]" aria-haspopup={state === 'manual' ? 'dialog' : undefined} onClick={begin}>
        {t('action')}
      </Button>
      {onDismiss ? (
        <button type="button" aria-label={t('dismiss')} onClick={onDismiss} className="-mr-1 flex size-11 shrink-0 items-center justify-center text-[18px] text-ink-300">
          ×
        </button>
      ) : null}

      <Sheet open={instructions} onClose={() => setInstructions(false)} title={t('howTitle')} closeLabel={common('close')}>
        <p className="text-[14px] leading-snug text-ink-200">{t(platform === 'ios' ? 'iosIntro' : 'browserIntro')}</p>
        <ol className="mt-4 flex flex-col gap-3">
          {steps.map((step, index) => (
            <li key={step} className="flex items-start gap-3">
              <span aria-hidden className="pixel frame flex size-7 shrink-0 items-center justify-center bg-gold-500 text-[15px] text-ink-900">
                {index + 1}
              </span>
              <span className="pt-0.5 text-[14px] leading-snug">{t(step)}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 border-t-2 border-night-700 pt-3 text-[12px] leading-snug text-ink-300">{t('offline')}</p>
      </Sheet>
    </section>
  );
}
