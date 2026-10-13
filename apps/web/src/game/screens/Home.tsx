'use client';

import { useState } from 'react';
import { useAccountSaves, useGame, useRanking, useSaving, useT, useWords } from '@/game/context';
import { ageAt } from '@/game/present';
import { Link, useRouter } from '@/i18n/navigation';
import { Button, Panel } from '@/ui/kit';
import { Sheet } from '@/ui/overlay';
import { Sprite } from '@/ui/Sprite';
import { HomePreferences } from './Settings';

/** The front door: carry on with the life in progress, or start another. */
export function Home() {
  const t = useT('home');
  const meta = useT('meta');
  const common = useT('common');
  const { content, text, names } = useWords();
  const status = useGame((s) => s.status);
  const lost = useGame((s) => s.lost);
  const view = useGame((s) => s.view);
  const lifeId = useGame((s) => s.lifeId);
  const stage = useGame((s) => s.stage);
  const moved = useGame((s) => s.moved);
  const saving = useSaving();
  // The rankings are the other players': there is a way to them only where someone is signed in to ask.
  const ranking = useRanking();
  const { offer, takeOffer, declineOffer } = useAccountSaves();
  // The life in the account the player has asked about, by its id: the question is never open for another one.
  const [asking, setAsking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const inProgress = status === 'playing' && view !== null && lifeId !== null && stage !== 'end';
  // A life that is over stays on the device until another begins, so its score can still be looked at.
  const over = status === 'playing' && view !== null && view.finished;

  // The life waiting in the account, lived on another device. It is taken or ended only when the player says so.
  const answer = (how: () => Promise<unknown>, then?: () => void) => () => {
    setBusy(true);
    void how()
      .then(then)
      .finally(() => {
        setBusy(false);
        setAsking(null);
      });
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center gap-5 px-4 pb-8 pt-10">
      <Sprite id="brand.mascot" alt="" className="-mb-2" fallback={{ w: 256, h: 256 }} />
      <div className="text-center">
        <h1 className="pixel text-[34px] leading-none text-gold-500">{meta('title')}</h1>
        <p className="mt-2 text-ink-200">{meta('description')}</p>
      </div>

      <div className="flex w-full flex-col gap-3">
        {status === 'booting' ? (
          <p className="pixel animate-blink text-center text-ink-300">{common('loading')}</p>
        ) : (
          <>
            {inProgress ? (
              <Link href="/play" className="pixel frame-raised frame-gold flex min-h-14 flex-col items-center justify-center bg-gold-500 px-4 py-2 text-center text-ink-900">
                <span className="text-[19px]">{t('continue')}</span>
                <span className="font-sans text-[13px] font-normal text-ink-700">
                  {t('continueDetail', { life: text.lives[lifeId].name, age: ageAt(content, view.round), city: names.cities[view.player.cityId] })}
                </span>
              </Link>
            ) : null}
            {offer ? (
              <button type="button" onClick={() => setAsking(offer.gameId)} className="pixel frame-raised flex min-h-12 flex-col items-center justify-center bg-night-600 px-4 py-2 text-center text-cream">
                <span className="text-[16px]">{t('accountLife')}</span>
                <span className="font-sans text-[13px] font-normal text-ink-200">
                  {t('continueDetail', { life: text.lives[offer.lifeId]?.name ?? '', age: ageAt(content, offer.round), city: names.cities[offer.cityId] ?? '' })}
                </span>
              </button>
            ) : null}
            <Link
              href="/new"
              className={`pixel frame-raised flex min-h-12 items-center justify-center px-4 py-2 text-center text-[19px] ${
                inProgress ? 'bg-night-600 text-cream' : 'frame-gold bg-gold-500 text-ink-900'
              }`}
            >
              {t('newLife')}
            </Link>
            {over ? (
              <Link href="/play" className="pixel frame-raised flex min-h-11 items-center justify-center bg-night-600 px-4 py-2 text-center text-[15px] text-cream">
                {t('lastLife')}
              </Link>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <Link href="/collection" className="pixel frame-raised flex min-h-11 items-center justify-center gap-2 bg-night-700 px-2 py-2 text-[15px] text-ink-200">
                <Sprite id="icon.star" />
                {t('collection')}
              </Link>
              <Link href="/records" className="pixel frame-raised flex min-h-11 items-center justify-center gap-2 bg-night-700 px-2 py-2 text-[15px] text-ink-200">
                <Sprite id="icon.trophy" />
                {t('records')}
              </Link>
              {ranking !== 'no' ? (
                <Link href="/rankings" className="pixel frame-raised col-span-2 flex min-h-11 items-center justify-center gap-2 bg-night-700 px-2 py-2 text-[15px] text-ink-200">
                  <Sprite id="icon.status" />
                  {t('rankings')}
                </Link>
              ) : null}
            </div>
            {lost ? <p role="status" className="frame bg-wine-900 px-3 py-2 text-[14px]">{t(lost === 'outdated' ? 'lostOutdated' : lost === 'newer' ? 'lostNewer' : 'lostDamaged')}</p> : null}
            {moved && status === 'none' ? <p role="status" className="frame bg-night-700 px-3 py-2 text-[14px]">{t('movedGone')}</p> : null}
          </>
        )}
      </div>

      <Panel className="mt-auto w-full" title={t('language')}>
        <HomePreferences />
        {saving ? (
          <p className="mt-3 text-[12px] text-ink-300">{t('savedHere')}</p>
        ) : (
          <p role="alert" className="frame mt-3 bg-wine-900 px-3 py-2 text-[13px]">
            {common('notSaved')}
          </p>
        )}
      </Panel>

      {/* Saying yes leaves this page for the game, so the sheet keeps no entry of its own in the history. */}
      <Sheet open={offer !== null && asking === offer.gameId} onClose={() => setAsking(null)} title={t('accountLifeTitle')} closeLabel={common('close')} back={false}>
        {offer ? (
          <>
            <p className="text-[15px] leading-snug text-ink-200">
              {t('accountLifeBody', { life: text.lives[offer.lifeId]?.name ?? '', age: ageAt(content, offer.round), city: names.cities[offer.cityId] ?? '' })}
            </p>
            {inProgress ? <p className="mt-2 text-[14px] leading-snug text-wine-300">{t('accountLifeEnds', { life: text.lives[lifeId].name, age: ageAt(content, view.round) })}</p> : null}
            <div className="mt-4 flex flex-col gap-3">
              <Button variant="primary" wide disabled={busy} onClick={answer(takeOffer, () => router.push('/play'))}>
                {t('accountLifeTake')}
              </Button>
              <Button variant="danger" wide disabled={busy} onClick={answer(declineOffer)}>
                {t('accountLifeEnd')}
              </Button>
            </div>
          </>
        ) : null}
      </Sheet>
    </main>
  );
}
