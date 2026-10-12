'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Link } from '@/i18n/navigation';

/**
 * What a visitor sees if a screen cannot be drawn. The game is saved after every step, so the
 * life is where it was; this offers another try, a new life, and the way home, instead of a blank page.
 */
export default function LocaleError({ error, reset }: { error: Error & { digest?: string }; reset(): void }) {
  const t = useTranslations('play');
  useEffect(() => {
    console.error('a screen could not be drawn:', error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-4 px-4">
      <div role="alert" className="frame bg-wine-900 p-4">
        <h1 className="pixel text-[20px]">{t('faultTitle')}</h1>
        <p className="mt-2 text-[14px] leading-snug">{t('faultBody')}</p>
      </div>
      <button type="button" onClick={reset} className="pixel frame-raised frame-gold min-h-12 bg-gold-500 px-4 text-[17px] text-ink-900">
        {t('retry')}
      </button>
      <Link href="/new" className="pixel frame-raised flex min-h-11 items-center justify-center bg-night-600 px-4 text-[15px] text-cream">
        {t('newLife')}
      </Link>
      <Link href="/" className="pixel frame-raised flex min-h-11 items-center justify-center bg-night-600 px-4 text-[15px] text-cream">
        {t('home')}
      </Link>
    </main>
  );
}
