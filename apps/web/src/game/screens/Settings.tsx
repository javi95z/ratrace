'use client';

import { CONTENT_VERSION, portraitArt } from '@ratrace/content';
import { ENGINE_VERSION, netWorth, scoreBreakdown } from '@ratrace/engine';
import type { GameView } from '@ratrace/engine';
import { useEffect, useRef, useState } from 'react';
import { useAccount, useAccountSaves, useCommunity, useGame, useGuide, useSaving, useSettings, useT, useWords } from '@/game/context';
import { canNotify, currentSubscription, subscribe, unsubscribe } from '@/pwa/notifications';
import { ageAt, portraitAge } from '@ratrace/core/game/present';
import { Link, usePathname } from '@/i18n/navigation';
import { maskEmail } from '@ratrace/core/lib/mask';
import { GoogleMark } from '@/ui/GoogleMark';
import { routing } from '@/i18n/routing';
import { Bar, Button, Panel, Toggle, Well } from '@/ui/kit';
import { sheetsGone } from '@/ui/back';
import { Sheet } from '@/ui/overlay';
import { KeyboardGuide } from '@/ui/keyboard';
import { Sprite } from '@/ui/Sprite';

const LANGUAGES: Record<string, string> = { en: 'English', es: 'Español', ru: 'Русский' };
/**
 * The game's pixel typeface draws no Cyrillic. On a page of another language, what stands in for
 * it while it loads would draw a Cyrillic name in a system face: such a name asks for the
 * Cyrillic pixel typeface by itself first.
 */
const CYRILLIC = { fontFamily: 'var(--font-pixel-cyrillic-alone), var(--font-pixel)' };

/**
 * Who is playing, as the cloud knows them, and whether what they have is in their account yet. A
 * guest can keep the account with Google, and a guest on a second device can take up the account
 * their Google already has. Nothing is shown at all where the game has no cloud behind it, or
 * could not reach it.
 */
/** `signOut` offers to sign out: in the settings themselves, not on the panel of the home page. */
function AccountBlock({ compact = false, signOut: offerSignOut = false }: { compact?: boolean; signOut?: boolean }) {
  const t = useT('account');
  const { state, keepWithGoogle, dismissNotice, signOut } = useAccount();
  const common = useT('common');
  const [leavingAccount, setLeavingAccount] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { status } = useAccountSaves();
  const [leaving, setLeaving] = useState(false);
  // A page brought back from Google by the Back button is the page as it was left, button pressed and all.
  useEffect(() => {
    const back = () => setLeaving(false);
    window.addEventListener('pageshow', back);
    return () => window.removeEventListener('pageshow', back);
  }, []);
  if (state.kind === 'offline') return null;

  // The page is about to leave for Google. If it could not, the button is there to try again.
  const leaveWith = (go: () => Promise<boolean>) => () => {
    setLeaving(true);
    void go().then((begun) => {
      if (!begun) setLeaving(false);
    });
  };

  // The device always has everything. Saving to the account goes on unsaid, as it should; only an account out of
  // reach, with things kept on the device alone for now, is told.
  const saved =
    status !== 'waiting' ? null : (
      <p role="status" className="flex items-center gap-2 text-[12px] text-ink-200">
        <span aria-hidden className="size-2 shrink-0 bg-gold-500" />
        {t(status)}
      </p>
    );

  return (
    // A part of the panel it stands in, set off by a rule: never a box inside a box.
    <section aria-label={t('title')} className={compact ? 'flex flex-col gap-2' : 'flex flex-col gap-2 border-t-2 border-night-900 pt-3'}>
      {state.kind === 'member' ? (
        <>
          <p className="flex items-center gap-2">
            <GoogleMark size={18} />
            <span className="pixel text-[16px] text-teal-300">{t('member')}</span>
            {state.email ? <span className="min-w-0 truncate text-[13px] text-ink-300">{t('memberAs', { email: maskEmail(state.email) })}</span> : null}
          </p>
          {saved}
          {offerSignOut ? (
            <button type="button" onClick={() => setLeavingAccount(true)} className="min-h-11 self-start text-[13px] text-ink-300 underline underline-offset-4">
              {t('signOut')}
            </button>
          ) : null}
          <Sheet open={leavingAccount} onClose={() => setLeavingAccount(false)} title={t('signOutTitle')} closeLabel={common('close')}>
            <p className="text-[14px] leading-snug text-ink-200">{t('signOutAbout')}</p>
            {/* What has not reached the account yet would be lost with the device's copy: wait for it. */}
            {status === 'sending' || status === 'waiting' ? <p className="mt-2 text-[13px] leading-snug text-wine-300">{t('signOutUnsaved')}</p> : null}
            <div className="mt-4 flex flex-col gap-2">
              <Button wide onClick={() => setLeavingAccount(false)}>
                {common('cancel')}
              </Button>
              <Button
                variant="danger"
                wide
                disabled={signingOut || status === 'sending' || status === 'waiting'}
                onClick={() => {
                  setSigningOut(true);
                  void signOut().then((done) => {
                    if (!done) setSigningOut(false);
                  });
                }}
              >
                {t('signOut')}
              </Button>
            </div>
          </Sheet>
        </>
      ) : state.notice === 'joining' ? (
        // Not a fault but good news: the player is already known, and is being taken into their account.
        <p role="status" className="pixel animate-blink text-[15px] leading-snug text-gold-200">
          {t('joining')}
        </p>
      ) : (
        <>
          {state.notice ? (
            <div className="flex items-center gap-2">
              <p role="alert" className="min-w-0 flex-1 text-[13px] leading-snug text-wine-300">
                {t(state.notice)}
              </p>
              <Button variant="quiet" className="shrink-0 text-[14px]" onClick={dismissNotice}>
                {t('dismiss')}
              </Button>
            </div>
          ) : null}
          <Button variant="secondary" wide disabled={leaving} onClick={leaveWith(keepWithGoogle)}>
            <GoogleMark />
            {t('keep')}
          </Button>
          {saved}
        </>
      )}
    </section>
  );
}

/** The languages the game speaks, each under its own name, the one in use marked. */
function LanguagePick() {
  const home = useT('home');
  const { locale } = useSettings();
  const pathname = usePathname();
  const community = useCommunity();
  return (
    <div role="group" aria-label={home('language')} className="grid grid-cols-3 gap-2">
      {routing.locales.map((code) => (
        <Link
          key={code}
          href={pathname}
          locale={code}
          // Kept with the account too, so that the next device the player signs in on speaks it.
          onClick={() => {
            if (code !== locale) void community?.setLanguage?.(code);
          }}
          lang={code}
          style={/[\u0400-\u04ff]/.test(LANGUAGES[code]) ? CYRILLIC : undefined}
          aria-current={code === locale ? 'true' : undefined}
          className={`pixel frame-raised flex min-h-11 items-center justify-center text-[15px] ${code === locale ? 'frame-cream bg-cream text-ink-900' : 'bg-night-600 text-ink-200'}`}
        >
          {LANGUAGES[code]}
        </Link>
      ))}
    </div>
  );
}

/** The language from the corner of the front door: a square with its code, and the languages dropping from it. */
export function LanguageMenu() {
  const home = useT('home');
  const { locale } = useSettings();
  const pathname = usePathname();
  const community = useCommunity();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={home('language')}
        onClick={() => setOpen((was) => !was)}
        className="pixel frame-raised flex size-11 items-center justify-center bg-night-700 text-[15px] uppercase text-ink-200"
      >
        {locale}
      </button>
      {open ? (
        <div role="menu" className="frame-raised absolute right-0 top-full z-20 mt-2 flex w-36 flex-col bg-night-700 p-1">
          {routing.locales.map((code) => (
            <Link
              key={code}
              role="menuitem"
              href={pathname}
              locale={code}
              // Kept with the account too, so that the next device the player signs in on speaks it.
              onClick={() => {
                setOpen(false);
                if (code !== locale) void community?.setLanguage?.(code);
              }}
              lang={code}
              style={/[\u0400-\u04ff]/.test(LANGUAGES[code]) ? CYRILLIC : undefined}
              aria-current={code === locale ? 'true' : undefined}
              className={`pixel flex min-h-11 items-center px-3 text-[15px] ${code === locale ? 'bg-cream text-ink-900' : 'text-ink-200 hover:bg-night-600'}`}
            >
              {LANGUAGES[code]}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** What is switched on or off: sound, less motion, and the tips of the guide. */
function Switches() {
  const t = useT('settings');
  const home = useT('home');
  const { reducedMotion, setReducedMotion, sound, setSound } = useSettings();
  const guide = useGuide();
  return (
    <div className="flex flex-col gap-2">
      <Toggle on={sound} onChange={setSound} label={t('sound')} hint={t('soundHint')} />
      <Toggle on={reducedMotion} onChange={setReducedMotion} label={home('motion')} hint={home('motionHint')} />
      <Toggle on={!guide.off} onChange={(on) => guide.setOff(!on)} label={t('guide')} hint={t('guideHint')} />
      <WeeklyNotice />
    </div>
  );
}

/**
 * Being told when a new weekly challenge begins, even with the game closed. It is offered only
 * where the browser can show a notice and there is an account to keep the subscription in; a no
 * from the browser is said, since only the browser can undo it.
 */
function WeeklyNotice() {
  const t = useT('settings');
  const { locale } = useSettings();
  const community = useCommunity();
  const [on, setOn] = useState<boolean | null>(null);
  const [refused, setRefused] = useState(false);
  useEffect(() => {
    let live = true;
    if (canNotify()) void currentSubscription().then((held) => live && setOn(held !== null), () => live && setOn(false));
    return () => {
      live = false;
    };
  }, []);
  if (!canNotify() || community === null || on === null) return null;
  const change = async (want: boolean) => {
    if (want) {
      const keys = await subscribe();
      if (keys === null) return setRefused(Notification.permission === 'denied');
      setRefused(false);
      setOn(await community.notifyMe(keys, locale));
    } else {
      const endpoint = await unsubscribe();
      if (endpoint) await community.stopNotifying(endpoint);
      setOn(false);
    }
  };
  return (
    <>
      <Toggle on={on} onChange={(want) => void change(want)} label={t('weeklyNotice')} hint={refused ? t('weeklyNoticeBlocked') : t('weeklyNoticeHint')} />
      {on ? <MarketNotice /> : null}
    </>
  );
}

/**
 * The notice that something held in a ranked life moved, on its own: it can be turned off while the
 * rest are kept. Shown only while this browser is subscribed, and only once the server has said
 * what it is now, so the switch never shows a guess.
 */
function MarketNotice() {
  const t = useT('settings');
  const community = useCommunity();
  const [on, setOn] = useState<boolean | null>(null);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void currentSubscription().then(
      async (held) => {
        if (!held || community === null) return;
        const now = await community.marketNotice(held.endpoint);
        if (live) {
          setEndpoint(held.endpoint);
          setOn(now);
        }
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [community]);
  if (community === null || endpoint === null || on === null) return null;
  const change = async (want: boolean) => {
    if (await community.setMarketNotice(endpoint, want)) setOn(want);
  };
  return <Toggle on={on} onChange={(want) => void change(want)} label={t('marketNotice')} hint={t('marketNoticeHint')} />;
}

/** Everything the player can set, at once: the settings of a life in progress, already in a sheet of their own. */
export function Preferences() {
  return (
    <div className="flex flex-col gap-2">
      <LanguagePick />
      <Switches />
      <KeyboardGuide />
      <AccountBlock signOut />
    </div>
  );
}

/** Which game this is, for a report of something amiss: small, and out of the way at the foot. */
function Version() {
  const t = useT('settings');
  return <p className="text-center text-[11px] text-ink-300 opacity-70">{t('version', { content: CONTENT_VERSION, engine: ENGINE_VERSION })}</p>;
}

/** What the settings of the front door hold: the account, where things are kept, the language, the switches and the version. */
function HomeSettingsSheet({ open, onClose }: { open: boolean; onClose(): void }) {
  const t = useT('settings');
  const home = useT('home');
  const common = useT('common');
  const { state: account } = useAccount();
  return (
    <Sheet open={open} onClose={onClose} title={t('title')} closeLabel={common('close')}>
      <div className="flex flex-col gap-3">
        {/* The account first: whether the game is kept in it, and the way into one. */}
        <AccountBlock compact signOut />
        {account.kind === 'offline' ? <p className="text-[13px] text-ink-300">{home('savedHere')}</p> : null}
        <LanguagePick />
        <Switches />
        <Version />
      </div>
    </Sheet>
  );
}

/** The settings of the front door, from the corner: one button with a gear. */
export function HomePreferences() {
  const t = useT('settings');
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={t('title')}
        onClick={() => setOpen(true)}
        className="frame-raised flex size-11 items-center justify-center bg-night-700"
      >
        <Sprite id="icon.settings" />
      </button>
      <HomeSettingsSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** The foot of the front door: for a guest, the way into Google and what the account has to say; for a member, nothing. */
export function HomeAccount() {
  const { state } = useAccount();
  if (state.kind === 'member') return null;
  return <AccountBlock compact />;
}

/** Where the life stands: who, how far along, and what it is worth so far. */
function Standing({ shown }: { shown: GameView }) {
  const t = useT('settings');
  const common = useT('common');
  const { content, text, names, fmt } = useWords();
  const lifeId = useGame((s) => s.lifeId) ?? '';
  const ranked = useGame((s) => s.ranked);
  const challenge = useGame((s) => s.challenge);
  const saving = useSaving();
  const p = shown.player;
  const age = ageAt(content, shown.round);
  const left = (content.rounds - shown.round) * content.yearsPerRound;

  return (
    <section aria-label={t('game')} className="frame frame-gold bg-night-700 p-2.5">
      <div className="flex items-center gap-2.5">
        <span className="frame shrink-0 leading-[0]">
          <Well className="size-11 items-start overflow-hidden">
            <Sprite id={portraitArt(lifeId, portraitAge(age))} fallback={{ w: 64, h: 64 }} className="-mt-1 max-w-none" />
          </Well>
        </span>
        <div className="min-w-0 flex-1">
          <p className="pixel text-[11px] uppercase tracking-wider text-gold-500">{challenge !== null ? t(ranked ? 'challenge' : 'practice') : ranked ? t('ranked') : t('game')}</p>
          <p className="pixel truncate text-[17px] leading-tight">{text.lives[lifeId]?.name}</p>
          <p className="truncate text-[12px] text-ink-300">
            {common('age', { age })} · {names.cities[p.cityId]}
          </p>
        </div>
        {/* What it is worth so far, in two figures beside who is living it. */}
        <div className="shrink-0 text-right">
          <p className="pixel text-[16px] leading-tight text-gold-500">{t('points', { n: fmt.number(scoreBreakdown(content, shown).total) })}</p>
          <p className="pixel text-[13px] leading-tight text-ink-200">{fmt.compact(netWorth(p))}</p>
        </div>
      </div>

      <div className="mt-2">
        <div className="mb-1 flex items-baseline justify-between gap-2 text-[12px]">
          <span className="pixel">{common('round', { n: Math.min(shown.round + 1, content.rounds), total: content.rounds })}</span>
          <span className="text-ink-300">{left > 0 ? t('yearsLeft', { years: left }) : t('over')}</span>
        </div>
        <Bar value={shown.round} max={content.rounds} label={t('progress')} tone="teal" />
      </div>

      {/* Saving is said only when it fails: when it works, there is nothing to say. */}
      {saving ? null : (
        <p role="alert" className="frame mt-2 bg-wine-900 px-3 py-2 text-[13px]">
          {common('notSaved')}
        </p>
      )}
    </section>
  );
}

/**
 * Everything about the game rather than the life: where it stands, what can be set, and the way
 * back to the front door. Nothing is lost by leaving: the life is saved after every step.
 */
export function SettingsSheet({ open, onClose, shown }: { open: boolean; onClose(): void; shown: GameView }) {
  const t = useT('settings');
  const common = useT('common');
  return (
    <Sheet open={open} onClose={onClose} title={t('title')} closeLabel={common('close')}>
      <div className="flex flex-col gap-3">
        <Standing shown={shown} />
        <Panel title={t('preferences')}>
          <Preferences />
        </Panel>
        <div>
          <Link href="/" className="pixel frame-raised frame-gold flex min-h-12 items-center justify-center gap-2 bg-gold-500 px-4 text-[17px] text-ink-900">
            <span aria-hidden>←</span>
            {t('home')}
          </Link>
        </div>
        <EndLife shown={shown} onLeave={onClose} />
        <Version />
      </div>
    </Sheet>
  );
}

/**
 * Ends the life alone on screen, after asking; the game then goes back to the front door by itself.
 * Never a life in a game with friends: that has its own way out. The sheets close first, and the
 * life ends once their entry is out of the history, or that step back would land on the life again.
 */
function EndLife({ shown, onLeave }: { shown: GameView; onLeave(): void }) {
  const t = useT('settings');
  const common = useT('common');
  const { content, text } = useWords();
  const lifeId = useGame((s) => s.lifeId) ?? '';
  const ranked = useGame((s) => s.ranked);
  const challenge = useGame((s) => s.challenge);
  const abandon = useGame((s) => s.abandon);
  const [asking, setAsking] = useState(false);
  const [ending, setEnding] = useState(false);
  if (shown.finished || Object.hasOwn(shown.player.life.flags, 'in_room')) return null;
  return (
    <>
      <button type="button" onClick={() => setAsking(true)} className="pixel frame-raised frame-wine flex min-h-12 w-full items-center justify-center gap-2 bg-wine-700 px-4 text-[17px] text-cream">
        {t('endLife')}
      </button>
      <Sheet open={asking} onClose={() => setAsking(false)} title={t('endLifeTitle')} closeLabel={common('close')}>
        <p className="text-[14px] leading-snug text-ink-200">{t('endLifeBody', { life: text.lives[lifeId]?.name ?? '', age: common('age', { age: ageAt(content, shown.round) }) })}</p>
        {ranked ? <p className="mt-2 text-[13px] leading-snug text-wine-300">{t(challenge !== null ? 'endLifeChallenge' : 'endLifeRanked')}</p> : null}
        <div className="mt-4 flex flex-col gap-2">
          <Button wide onClick={() => setAsking(false)}>
            {common('cancel')}
          </Button>
          <Button
            variant="danger"
            wide
            disabled={ending}
            onClick={() => {
              setEnding(true);
              setAsking(false);
              onLeave();
              void sheetsGone()
                .then(abandon)
                .catch(() => setEnding(false));
            }}
          >
            {t('endLifeYes')}
          </Button>
        </div>
      </Sheet>
    </>
  );
}
