'use client';

import { CONTENT_VERSION, portraitArt } from '@ratrace/content';
import { ENGINE_VERSION, netWorth, scoreBreakdown } from '@ratrace/engine';
import type { GameView } from '@ratrace/engine';
import { useEffect, useState } from 'react';
import { useAccount, useAccountSaves, useCommunity, useGame, useGuide, useSaving, useSettings, useT, useWords } from '@/game/context';
import { canNotify, currentSubscription, subscribe, unsubscribe } from '@/pwa/notifications';
import { ageAt, portraitAge } from '@/game/present';
import { Link, usePathname } from '@/i18n/navigation';
import { maskEmail } from '@/lib/mask';
import { GoogleMark } from '@/ui/GoogleMark';
import { routing } from '@/i18n/routing';
import { Bar, Button, Panel, Toggle, Well } from '@/ui/kit';
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
function AccountBlock({ compact = false }: { compact?: boolean }) {
  const t = useT('account');
  const { state, keepWithGoogle, dismissNotice } = useAccount();
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

  // One line of truth about saving. The device always has everything; this says whether the account does too.
  // Saved is how things should be, and goes unsaid: only saving, or saving on the device alone, is told.
  const saved =
    status === 'off' || status === 'saved' ? null : (
      <p role="status" className="flex items-center gap-2 text-[12px] text-ink-200">
        <span aria-hidden className={`size-2 shrink-0 ${status === 'waiting' ? 'bg-gold-500' : 'bg-ink-300'}`} />
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
  return (
    <div role="group" aria-label={home('language')} className="grid grid-cols-3 gap-2">
      {routing.locales.map((code) => (
        <Link
          key={code}
          href={pathname}
          locale={code}
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
  return <Toggle on={on} onChange={(want) => void change(want)} label={t('weeklyNotice')} hint={refused ? t('weeklyNoticeBlocked') : t('weeklyNoticeHint')} />;
}

/** Everything the player can set, at once: the settings of a life in progress, already in a sheet of their own. */
export function Preferences() {
  return (
    <div className="flex flex-col gap-2">
      <LanguagePick />
      <Switches />
      <KeyboardGuide />
      <AccountBlock />
    </div>
  );
}

/** Which game this is, for a report of something amiss: small, and out of the way at the foot. */
function Version() {
  const t = useT('settings');
  return <p className="text-center text-[11px] text-ink-300 opacity-70">{t('version', { content: CONTENT_VERSION, engine: ENGINE_VERSION })}</p>;
}

/**
 * The same on the front door, where there is a game to get to: the account in sight, and the
 * language and the switches a tap away behind one button.
 */
export function HomePreferences() {
  const t = useT('settings');
  const common = useT('common');
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      {/* The way into an account first, the same size as the settings below it. */}
      <AccountBlock compact />
      <Button wide aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Sprite id="icon.settings" />
        {t('title')}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('title')} closeLabel={common('close')}>
        <div className="flex flex-col gap-2">
          <LanguagePick />
          <Switches />
          <Version />
        </div>
      </Sheet>
    </div>
  );
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
        <Version />
      </div>
    </Sheet>
  );
}
