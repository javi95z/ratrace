'use client';

import { ratArt } from '@ratrace/content';
import { CHALLENGE_ART } from '@ratrace/content';
import { useEffect, useState } from 'react';
import { useAccount, useAccountSaves, useCommunity, useGame, useRanking, useRuns, useSaving, useT, useWords } from '@/game/context';
import { ratLookOf } from '@ratrace/core/game/avatar';
import { RatAvatar } from '@/ui/RatAvatar';
import { ageAt } from '@ratrace/core/game/present';
import { Link, useRouter } from '@/i18n/navigation';
import { InstallApp, useInstallOffer } from '@/pwa/InstallApp';
import { Button, Panel } from '@/ui/kit';
import { Sheet } from '@/ui/overlay';
import { Sprite } from '@/ui/Sprite';
import { useThisWeek, WeeklyChallengeCard } from './Challenge';
import { RoomCard, useRoomLive } from './Room';
import { HomePreferences, HomeSettingsPanel, LanguageMenu } from './Settings';

/** The front door: carry on with the life in progress, or start another. */
export function Home() {
  const t = useT('home');
  const meta = useT('meta');
  const common = useT('common');
  const settings = useT('settings');
  const legal = useT('legal');
  const { content, text, names } = useWords();
  const status = useGame((s) => s.status);
  const lost = useGame((s) => s.lost);
  const view = useGame((s) => s.view);
  const lifeId = useGame((s) => s.lifeId);
  const stage = useGame((s) => s.stage);
  const moved = useGame((s) => s.moved);
  const ranked = useGame((s) => s.ranked);
  const challenge = useGame((s) => s.challenge);
  const saving = useSaving();
  // The rankings are the other players': there is a way to them only where someone is signed in to ask.
  const ranking = useRanking();
  const { offer, takeOffer, declineOffer } = useAccountSaves();
  // The life in the account the player has asked about, by its id: the question is never open for another one.
  const [asking, setAsking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const inProgress = status === 'playing' && view !== null && lifeId !== null && stage !== 'end';
  // A game with friends that is not over comes before everything else, in gold.
  const turn = useRoomLive();
  // Whoever has played before knows the game: the rat and its line make way for what they came for.
  const runs = useRuns();
  const returning = inProgress || (runs !== null && runs.length > 0);
  const install = useInstallOffer();
  // A life that is over stays on the device until another begins, so its score can still be looked at.
  const over = status === 'playing' && view !== null && view.finished;
  // The week's challenge has one button: carrying on with a life of it stands for it, attempt or practice.
  const week = useThisWeek();
  const challengeInProgress = inProgress && challenge !== null && challenge === week?.week;

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
    <main className={`relative mx-auto flex min-h-dvh w-full max-w-md flex-col items-center px-3 pb-8 ${returning ? 'gap-4 pt-6' : 'gap-5 pt-10'}`}>
      <div className="absolute right-3 top-4 flex gap-2">
        <LanguageMenu />
        <HomePreferences />
      </div>
      {/* A first visit meets the mascot; someone coming back is waved at. */}
      {returning ? <Sprite id={ratArt('wave')} alt="" className="-mb-1" fallback={{ w: 128, h: 128 }} /> : <Sprite id="brand.mascot" alt="" className="-mb-2" fallback={{ w: 256, h: 256 }} />}
      <div className="text-center">
        <h1 className={`pixel leading-none text-gold-500 ${returning ? 'text-[28px]' : 'text-[34px]'}`}>{meta('title')}</h1>
        {returning ? null : <p className="mt-2 text-ink-200">{meta('description')}</p>}
      </div>

      <div className="flex w-full flex-col gap-3">
        {status === 'booting' ? (
          <p className="pixel animate-blink text-center text-ink-300">{common('loading')}</p>
        ) : (
          <>
            {turn ? <RoomCard primary /> : null}
            {inProgress ? (
              <Link
                href="/play"
                className={`pixel frame-raised flex min-h-14 flex-col items-center justify-center px-4 py-2 text-center ${turn ? 'bg-night-600 text-cream' : 'frame-gold bg-gold-500 text-ink-900'}`}
              >
                {challenge !== null ? (
                  // A life of the weekly challenge says so before anything else: the attempt that counts, or a practice.
                  <span className={`flex items-center gap-1 text-[11px] uppercase leading-none tracking-wider ${turn ? 'text-gold-500' : 'text-ink-700'}`}>
                    <Sprite id={CHALLENGE_ART.icon} className="!h-4 !w-4" />
                    {t(ranked ? 'continueChallenge' : 'continuePractice')}
                  </span>
                ) : null}
                <span className="text-[19px]">{t('continue')}</span>
                <span className={`font-sans text-[13px] font-normal ${turn ? 'text-ink-200' : 'text-ink-700'}`}>
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
                inProgress || turn ? 'bg-night-600 text-cream' : 'frame-gold bg-gold-500 text-ink-900'
              }`}
            >
              {t('newLife')}
            </Link>
            {challengeInProgress ? null : <WeeklyChallengeCard />}
            {turn ? null : <RoomCard />}
            <FriendRequests />
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
            {lost ? <p role="status" className="frame bg-wine-900 px-3 py-2 text-[14px]">{t(lost === 'outdated' ? 'lostOutdated' : lost === 'newer' ? 'lostNewer' : lost === 'waiting' ? 'lostWaiting' : 'lostDamaged')}</p> : null}
            {moved && status === 'none' ? <p role="status" className="frame bg-night-700 px-3 py-2 text-[14px]">{t('movedGone')}</p> : null}
          </>
        )}
      </div>

      {/* At the foot, as it always was: the account and the settings, also behind the gear above. */}
      <Panel className="mt-auto w-full" label={settings('title')}>
        <HomeSettingsPanel profile={<ProfileLink />} />
      </Panel>
      {/* What could not be kept is said where it is seen; where things are kept is said in the settings. */}
      {saving ? null : (
        <p role="alert" className="frame w-full bg-wine-900 px-3 py-2 text-[13px]">
          {common('notSaved')}
        </p>
      )}

      {/* At the foot, from the second visit on, until the player says no: an offer, not something the page is for. */}
      {install.shown ? (
        <div className="w-full">
          <InstallApp onDismiss={install.dismiss} />
        </div>
      ) : null}

      {/* The small print, out of the way: only here, at the very foot. */}
      <Link href="/legal" className="text-[12px] text-ink-300 underline-offset-2 hover:underline">
        {legal('link')}
      </Link>

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

/**
 * Friend requests waiting on the player, as a line that leads to them: there only when there are
 * any, for someone signed in. Asked once as the front door opens.
 */
function FriendRequests() {
  const t = useT('home');
  const { state } = useAccount();
  const community = useCommunity();
  const [waiting, setWaiting] = useState(0);
  const userId = state.kind === 'member' || state.kind === 'guest' ? state.userId : null;
  useEffect(() => {
    if (userId === null || community === null) return;
    let live = true;
    void community.friends().then((found) => live && setWaiting(found?.incoming.length ?? 0));
    return () => {
      live = false;
    };
  }, [userId, community]);
  if (waiting === 0) return null;
  return (
    <Link href="/rankings#friends" className="pixel frame-raised frame-gold flex min-h-11 items-center justify-center gap-2 bg-night-600 px-3 py-2 text-[15px] text-gold-500">
      <Sprite id="icon.multiplayer" />
      {t('friendRequests', { n: waiting })}
    </Link>
  );
}

/**
 * The way to the player's profile, with their rat on it: there for someone signed in with Google,
 * whose profile the others see, and for nobody else.
 */
function ProfileLink() {
  const t = useT('home');
  const { state } = useAccount();
  const community = useCommunity();
  const [avatar, setAvatar] = useState<string | null>(null);
  const userId = state.kind === 'member' ? state.userId : null;
  useEffect(() => {
    if (userId === null || community === null) return;
    let live = true;
    void community.me().then((me) => live && setAvatar(me?.avatar ?? null));
    return () => {
      live = false;
    };
  }, [userId, community]);
  if (userId === null) return null;
  return (
    <Link href="/player" className="pixel frame-raised flex min-h-11 w-full items-center justify-center gap-2 bg-night-700 px-2 py-2 text-[15px] text-ink-200">
      <RatAvatar look={ratLookOf(avatar, userId)} size="sm" />
      {t('profile')}
    </Link>
  );
}
