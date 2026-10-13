'use client';

import { portraitArt } from '@ratrace/content';
import { netWorth, scoreBreakdown } from '@ratrace/engine';
import type { GameView } from '@ratrace/engine';
import { useEffect, useState } from 'react';
import { useAccount, useAccountSaves, useGame, useGuide, useSaving, useSettings, useT, useWords } from '@/game/context';
import { ageAt, portraitAge } from '@/game/present';
import { Link, usePathname } from '@/i18n/navigation';
import { maskEmail } from '@/lib/mask';
import { routing } from '@/i18n/routing';
import { Bar, Button, Panel, Stat, Toggle, Well } from '@/ui/kit';
import { Sheet } from '@/ui/overlay';
import { Sprite } from '@/ui/Sprite';

const LANGUAGES: Record<string, string> = { en: 'English', es: 'Español' };

/**
 * Who is playing, as the cloud knows them, and whether what they have is in their account yet. A
 * guest can keep the account with Google, and a guest on a second device can take up the account
 * their Google already has. Nothing is shown at all where the game has no cloud behind it, or
 * could not reach it.
 */
function AccountBlock() {
  const t = useT('account');
  const { state, keepWithGoogle, useExistingAccount, dismissNotice } = useAccount();
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
  const saved =
    status === 'off' ? null : (
      <p role="status" className="flex items-center gap-2 text-[12px] text-ink-200">
        <span aria-hidden className={`size-2 shrink-0 ${status === 'saved' ? 'bg-teal-300' : status === 'waiting' ? 'bg-gold-500' : 'bg-ink-300'}`} />
        {t(status)}
      </p>
    );

  return (
    // A part of the panel it stands in, set off by a rule: never a box inside a box.
    <section aria-label={t('title')} className="flex flex-col gap-2 border-t-2 border-night-900 pt-3">
      <p className="pixel text-[14px] uppercase tracking-[0.1em] text-gold-500">{t('title')}</p>
      {state.kind === 'member' ? (
        <>
          <p className="pixel text-[16px] text-teal-300">{t('member')}</p>
          {state.email ? <p className="break-all text-[13px] text-ink-200">{t('memberAs', { email: maskEmail(state.email) })}</p> : null}
          {saved}
        </>
      ) : (
        <>
          {state.notice === 'taken' ? (
            // Not a fault but good news: the player is already known. It takes the place of everything a guest is told, so one thing is asked at a time.
            <div role="alert" className="flex flex-col gap-2">
              <p className="pixel text-[16px] leading-tight text-gold-200">{t('takenTitle')}</p>
              <p className="text-[13px] leading-snug">{t('taken')}</p>
              <Button variant="primary" wide disabled={leaving} onClick={leaveWith(useExistingAccount)}>
                {t('useExisting')}
              </Button>
              <Button variant="quiet" wide className="text-[14px]" onClick={dismissNotice}>
                {t('notNow')}
              </Button>
            </div>
          ) : (
            <>
              <p className="text-[14px] leading-snug">{t('guest')}</p>
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
              <Button variant="primary" wide disabled={leaving} onClick={leaveWith(keepWithGoogle)}>
                {t('keep')}
              </Button>
              <p className="text-[12px] leading-snug text-ink-200">{t('keepHint')}</p>
            </>
          )}
          {saved}
        </>
      )}
    </section>
  );
}

/** The two languages, the one in use marked. */
function LanguagePick() {
  const home = useT('home');
  const { locale } = useSettings();
  const pathname = usePathname();
  return (
    <div role="group" aria-label={home('language')} className="grid grid-cols-2 gap-2">
      {routing.locales.map((code) => (
        <Link
          key={code}
          href={pathname}
          locale={code}
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
    </div>
  );
}

/** Everything the player can set, at once: the settings of a life in progress, already in a sheet of their own. */
export function Preferences() {
  return (
    <div className="flex flex-col gap-2">
      <LanguagePick />
      <Switches />
      <AccountBlock />
    </div>
  );
}

/**
 * The same on the front door, where there is a game to get to: the language and the account in
 * sight, and the switches a tap away behind one button.
 */
export function HomePreferences() {
  const t = useT('settings');
  const common = useT('common');
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <LanguagePick />
      <Button wide aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Sprite id="icon.settings" />
        {t('title')}
      </Button>
      <AccountBlock />
      <Sheet open={open} onClose={() => setOpen(false)} title={t('title')} closeLabel={common('close')}>
        <Switches />
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
  const saving = useSaving();
  const p = shown.player;
  const age = ageAt(content, shown.round);
  const left = (content.rounds - shown.round) * content.yearsPerRound;

  return (
    <section aria-label={t('game')} className="frame frame-gold bg-night-700 p-3">
      <div className="flex items-center gap-3">
        <span className="frame shrink-0 leading-[0]">
          <Well className="size-[68px]">
            <Sprite id={portraitArt(lifeId, portraitAge(age))} fallback={{ w: 64, h: 64 }} />
          </Well>
        </span>
        <div className="min-w-0">
          <p className="pixel text-[12px] uppercase tracking-wider text-gold-500">{t('game')}</p>
          <p className="pixel truncate text-[19px]">{text.lives[lifeId]?.name}</p>
          <p className="truncate text-[13px] text-ink-300">
            {common('age', { age })} · {names.cities[p.cityId]}
            {p.life.career ? ` · ${text.careers[p.life.career.id].levels[p.life.career.level]}` : ''}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
          <span className="pixel">{common('round', { n: Math.min(shown.round + 1, content.rounds), total: content.rounds })}</span>
          <span className="text-ink-300">{left > 0 ? t('yearsLeft', { years: left }) : t('over')}</span>
        </div>
        <Bar value={shown.round} max={content.rounds} label={t('progress')} tone="teal" />
      </div>

      <div className="@container mt-3">
        <div className="grid grid-cols-2 gap-1.5">
          <Stat icon="icon.account" value={fmt.compact(netWorth(p))} label={t('netWorth')} />
          <Stat icon="icon.trophy" value={fmt.number(scoreBreakdown(content, shown).total)} label={t('score')} />
        </div>
      </div>

      {saving ? (
        <p className="mt-3 flex items-center gap-2 text-[12px] text-ink-300">
          <span aria-hidden className="size-2 shrink-0 bg-teal-300" />
          {t('saved')}
        </p>
      ) : (
        <p role="alert" className="frame mt-3 bg-wine-900 px-3 py-2 text-[13px]">
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
          <p className="mt-1.5 text-center text-[12px] text-ink-300">{t('homeHint')}</p>
        </div>
      </div>
    </Sheet>
  );
}
