import { CONTENT_VERSION, portraitArt } from '@ratrace/content';
import { ageAt, portraitAge } from '@ratrace/core/game/present';
import { maskEmail } from '@ratrace/core/lib/mask';
import { ENGINE_VERSION, netWorth, scoreBreakdown } from '@ratrace/engine';
import type { GameView } from '@ratrace/engine';
import { LOCALES } from '@ratrace/i18n';
import type { Locale } from '@ratrace/i18n';
import { useRouter } from 'expo-router';
import type { CloudSaving } from '@ratrace/online/types';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AccessibilityInfo, Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useBlink } from '../../ui/animations';
import type { HostInstance } from 'react-native';
import { sheetsGone } from '../../ui/back';
import { Framed } from '../../ui/Frame';
import { GoogleMark } from '../../ui/GoogleMark';
import { LinkText } from '../../ui/LinkText';
import { CREAM, GOLD, WINE } from '../../ui/frames';
import { Bar, Button, Notice, Panel, pressDown, Raised, Toggle, usePress, Well } from '../../ui/kit';
import { Sheet } from '../../ui/overlay';
import { CYRILLIC_ALONE } from '../../ui/fonts';
import { Sprite } from '../../ui/Sprite';
import { Language, PixelText, ReadText, SNUG, TIGHT } from '../../ui/text';
import { COLORS, TOUCH } from '../../ui/theme';
import { useAccount, useAccountSaving, useCommunity, useGame, useGuide, usePush, useSaving, useSettings, useWords } from '../context';
import { useT } from '../words';

/** The languages the game speaks, each under its own name. */
const LANGUAGES: Record<Locale, string> = { en: 'English', es: 'Español', ru: 'Русский' };

/**
 * A language's name, set as a page in that language sets it: the game's pixel typeface draws no Cyrillic, so the name of
 * Russian asks for the Cyrillic pixel face by itself, whatever language the page is in (the web's `--font-pixel-cyrillic-alone`).
 */
function Name({ code, size, tone }: { code: Locale; size: number; tone: 'ink-900' | 'ink-200' }) {
  return (
    <Language.Provider value={code === 'ru' ? CYRILLIC_ALONE : code}>
      <PixelText size={size} tone={tone}>{LANGUAGES[code]}</PixelText>
    </Language.Provider>
  );
}

/** The languages the game speaks, each under its own name, the one in use marked. Choosing one is speaking it from then on. */
export function LanguagePick() {
  const home = useT('home');
  const { locale, setLocale } = useSettings();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={home('language')} style={{ flexDirection: 'row', gap: 8 }}>
      {LOCALES.map((code) => {
        const on = code === locale;
        return (
          <Raised
            key={code}
            role="radio"
            checked={on}
            language={code}
            tone={on ? CREAM : {}}
            bg={on ? 'cream' : 'night-600'}
            place={{ flex: 1, minWidth: 0 }}
            style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => setLocale(code)}
          >
            <Name code={code} size={15} tone={on ? 'ink-900' : 'ink-200'} />
          </Raised>
        );
      })}
    </View>
  );
}

/** One language of the menu: a line, the one in use on cream. */
function Choice({ code, on, onPress }: { code: Locale; on: boolean; onPress: () => void }) {
  const press = usePress({ onPress });
  return (
    <Pressable
      accessibilityRole="menuitem"
      accessibilityState={{ selected: on }}
      aria-selected={on}
      accessibilityLanguage={code}
      onPress={press}
      style={({ pressed }) => ({ ...pressDown(pressed), minHeight: TOUCH, paddingHorizontal: 12, justifyContent: 'center', ...(on ? { backgroundColor: COLORS.cream } : null) })}
    >
      <Name code={code} size={15} tone={on ? 'ink-900' : 'ink-200'} />
    </Pressable>
  );
}

/** The width of the menu that drops from the language button (the web's `w-36`). */
const MENU_WIDTH = 144;

/**
 * The language from the corner of the front door: a square with its code, and the languages dropping from it. The menu
 * hangs under the square over everything else, and is shut by choosing, by pressing outside it or by Back.
 */
export function LanguageMenu() {
  const home = useT('home');
  const { locale, setLocale } = useSettings();
  const { width } = useWindowDimensions();
  const square = useRef<HostInstance>(null);
  /** Where the menu hangs while it is open: under the square, its right edge at the square's. */
  const [hangs, setHangs] = useState<{ top: number; right: number } | null>(null);
  const shut = () => setHangs(null);
  const toggle = () => {
    if (hangs !== null) return shut();
    square.current?.measureInWindow((x, y, w, h) => setHangs({ top: y + h + 8, right: width - (x + w) }));
  };
  return (
    <>
      <View ref={square} collapsable={false}>
        <Raised
          role="button"
          label={home('language')}
          expanded={hangs !== null}
          bg="night-700"
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          onPress={toggle}
        >
          <PixelText size={15} tone="ink-200" style={{ textTransform: 'uppercase' }}>{locale}</PixelText>
        </Raised>
      </View>
      {hangs !== null ? (
        <Modal transparent animationType="none" visible statusBarTranslucent navigationBarTranslucent onRequestClose={shut}>
          <Pressable testID="menu-backdrop" accessible={false} importantForAccessibility="no" onPress={shut} style={StyleSheet.absoluteFill} />
          <View accessibilityRole="menu" style={{ position: 'absolute', top: hangs.top, right: hangs.right, width: MENU_WIDTH }}>
            <Framed kind="raised" style={{ backgroundColor: COLORS['night-700'], padding: 4 }}>
              {LOCALES.map((code) => (
                <Choice
                  key={code}
                  code={code}
                  on={code === locale}
                  onPress={() => {
                    shut();
                    setLocale(code);
                  }}
                />
              ))}
            </Framed>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

/** What is switched on or off: sound, less motion, and the tips of the guide. */
export function Switches() {
  const t = useT('settings');
  const home = useT('home');
  const { reducedMotion, setReducedMotion, sound, setSound } = useSettings();
  const guide = useGuide();
  return (
    <View style={{ gap: 8 }}>
      <Toggle on={sound} onChange={setSound} label={t('sound')} hint={t('soundHint')} />
      <Toggle on={reducedMotion} onChange={setReducedMotion} label={home('motion')} hint={home('motionHint')} />
      <Toggle on={!guide.off} onChange={(on) => guide.setOff(!on)} label={t('guide')} hint={t('guideHint')} />
      <WeeklyNotice />
    </View>
  );
}

/**
 * Being told when a new weekly challenge begins, even with the game closed (the web's `WeeklyNotice`). It is offered only where the phone can be
 * told (`usePush().available()`: a phone with the app built for the game's Expo project) and there is an account to keep the token in; a no from the
 * player is said, since only the phone's settings can undo it, and they are never asked twice.
 */
function WeeklyNotice() {
  const t = useT('settings');
  const phone = useT('phone');
  const rankings = useT('rankings');
  const { locale } = useSettings();
  const community = useCommunity();
  const push = usePush();
  const [on, setOn] = useState<boolean | null>(null);
  const [refused, setRefused] = useState(false);
  // Turning them off did not reach the account: they still come, and the switch says so.
  const [stuck, setStuck] = useState(false);
  // The phone gave no token after all: there is nothing to turn on here.
  const [gone, setGone] = useState(false);
  useEffect(() => {
    let live = true;
    if (push.available()) void push.isOn().then((held) => live && setOn(held));
    return () => {
      live = false;
    };
  }, [push]);
  if (gone || !push.available() || community === null || on === null) return null;
  const change = async (want: boolean) => {
    setStuck(false);
    if (want) {
      const got = await push.pushOn();
      if (got === 'unavailable') return setGone(true);
      if (got === 'refused') return setRefused(true);
      setRefused(false);
      setOn(await push.register(community, locale));
    } else {
      // Off only once the account has forgotten the phone: until then the notices still come, and the switch stays on.
      const off = await push.pushOff(community);
      setStuck(!off);
      setOn(!off);
    }
  };
  const hint = stuck ? rankings('followFailed') : refused ? phone('noticesBlocked') : t('weeklyNoticeHint');
  return (
    <>
      <Toggle on={on} onChange={(want) => void change(want)} label={t('weeklyNotice')} hint={hint} />
      {on ? <MarketNotice /> : null}
    </>
  );
}

/**
 * The notice that something held in a ranked life moved, on its own (the web's `MarketNotice`): it can be turned off while the rest are kept. Shown
 * only while this phone is told, and only once the server has said what it is now, so the switch never shows a guess.
 */
function MarketNotice() {
  const t = useT('settings');
  const community = useCommunity();
  const push = usePush();
  const [on, setOn] = useState<boolean | null>(null);
  const [target, setTarget] = useState<{ expo: string } | null>(null);
  useEffect(() => {
    let live = true;
    void push.target().then(async (held) => {
      if (!held || community === null) return;
      const now = await community.marketNotice(held);
      if (live) {
        setTarget(held);
        setOn(now);
      }
    });
    return () => {
      live = false;
    };
  }, [community, push]);
  if (community === null || target === null || on === null) return null;
  const change = async (want: boolean) => {
    if (await community.setMarketNotice(target, want)) setOn(want);
  };
  return <Toggle on={on} onChange={(want) => void change(want)} label={t('marketNotice')} hint={t('marketNoticeHint')} />;
}

/** The account's copy out of reach, with what is played kept on the phone alone for now: the one thing of saving the block says. */
const outOfReach = (status: CloudSaving): boolean => status === 'waiting';
/** Something not yet in the account, which signing out would take off the phone with the rest. */
const unsaved = (status: CloudSaving): boolean => status === 'sending' || status === 'waiting';

/** What was last announced, and when: the block is drawn twice on the front door (at its foot, and in the settings over it), and says a thing once. */
let lastSaid = { words: '', at: 0 };

/**
 * What the block comes to say of keeping the account (being taken into one, or that it did not work), told to VoiceOver as it comes: iOS has no live
 * regions (TalkBack hears the block's own).
 */
function useAnnounced(words: string | null) {
  useEffect(() => {
    if (words === null || Platform.OS !== 'ios') return;
    const now = Date.now();
    if (lastSaid.words === words && now - lastSaid.at < 1_000) return;
    lastSaid = { words, at: now };
    AccessibilityInfo.announceForAccessibility(words);
  }, [words]);
}

/**
 * Who is playing, as the cloud knows them, and whether what they have is in their account yet (the web's `AccountBlock`). A guest can keep the account
 * with Google, opened over the app (`online/browser.ts`): the button waits while the browser is open, and is back when it comes back with nothing. A
 * Google account that is already a player's is taken, with a second trip to Google the player is told of. Nothing is shown at all where the game has
 * no cloud behind it, or could not reach it. `signOut` offers to sign out: in the settings themselves, not at the foot of the front door.
 */
function AccountBlock({ compact = false, signOut: offerSignOut = false }: { compact?: boolean; signOut?: boolean }) {
  const t = useT('account');
  const { state, keepWithGoogle, dismissNotice } = useAccount();
  const waiting = useAccountSaving(outOfReach);
  const [leavingAccount, setLeavingAccount] = useState(false);
  // A trip to Google under way: the browser is open over the app, and a second press must not start a second one.
  const [travelling, setTravelling] = useState(false);
  const notice = state.kind === 'guest' ? state.notice : null;
  useAnnounced(notice === null ? null : t(notice));
  if (state.kind === 'offline') return null;

  const travel = () => {
    setTravelling(true);
    // Kept, the player is a member and the button is gone; anything else (closed, refused, broken on the way) and it is there to try again.
    void keepWithGoogle().then(
      (kept) => {
        if (!kept) setTravelling(false);
      },
      () => setTravelling(false),
    );
  };

  // The device always has everything. Saving to the account goes on unsaid, as it should; only an account out of reach, with things kept on the
  // phone alone for now, is told.
  const saved = waiting ? (
    <View accessible role="status" accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View aria-hidden style={{ width: 8, height: 8, flexShrink: 0, backgroundColor: COLORS['gold-500'] }} />
      <ReadText size={12} tone="ink-200">{t('waiting')}</ReadText>
    </View>
  ) : null;

  return (
    // A part of the panel it stands in, set off by a rule: never a box inside a box.
    <View role="region" aria-label={t('title')} style={compact ? { gap: 8 } : { gap: 8, borderTopWidth: 2, borderTopColor: COLORS['night-900'], paddingTop: 12 }}>
      {state.kind === 'member' ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <GoogleMark size={18} />
            <PixelText size={16} tone="teal-300">{t('member')}</PixelText>
            {state.email ? (
              <ReadText size={13} tone="ink-300" numberOfLines={1} style={{ flexShrink: 1, minWidth: 0 }}>
                {t('memberAs', { email: maskEmail(state.email) })}
              </ReadText>
            ) : null}
          </View>
          {saved}
          {offerSignOut ? <SignOutLink onPress={() => setLeavingAccount(true)} /> : null}
          <SignOutSheet open={leavingAccount} onClose={() => setLeavingAccount(false)} />
        </>
      ) : notice === 'joining' ? (
        // Not a fault but good news: the player is already known, and is being taken into their account (Google opens again, for them).
        <Joining words={t('joining')} />
      ) : (
        <>
          {notice ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View accessible role="alert" accessibilityLiveRegion="assertive" style={{ flex: 1, minWidth: 0 }}>
                <ReadText size={13} tone="wine-300" lineHeight={13 * SNUG}>{t(notice)}</ReadText>
              </View>
              <Button variant="quiet" size={14} onPress={dismissNotice}>
                {t('dismiss')}
              </Button>
            </View>
          ) : null}
          <Button variant="secondary" wide disabled={travelling} onPress={travel}>
            <GoogleMark />
            {t('keep')}
          </Button>
          {saved}
        </>
      )}
    </View>
  );
}

/** Being taken into the account the player's Google already has: said, blinking, while Google opens again. */
function Joining({ words }: { words: string }) {
  const blink = useBlink();
  return (
    <View accessible role="status" accessibilityLiveRegion="polite">
      <Animated.View style={blink}>
        <PixelText size={15} tone="gold-200" lineHeight={15 * SNUG}>{words}</PixelText>
      </Animated.View>
    </View>
  );
}

/** The way out of the account, small and plain, under it (the web's underlined `min-h-11` button): 44 high for a thumb. */
function SignOutLink({ onPress }: { onPress: () => void }) {
  const t = useT('account');
  const press = usePress({ onPress });
  return (
    <Pressable accessibilityRole="button" onPress={press} style={({ pressed }) => ({ ...pressDown(pressed), minHeight: TOUCH, alignSelf: 'flex-start', justifyContent: 'center' })}>
      <LinkText size={13} offset={4} tone="ink-300">{t('signOut')}</LinkText>
    </Pressable>
  );
}

/**
 * Signing out, asked first. What has not reached the account yet would be lost with the phone's copy: the player is told to wait for it, and cannot
 * sign out until it has. Signed out, the game starts again with a new guest, on the front door (`useAccount().signOut`).
 */
function SignOutSheet({ open, onClose }: { open: boolean; onClose(): void }) {
  const t = useT('account');
  const common = useT('common');
  return (
    <Sheet open={open} onClose={onClose} title={t('signOutTitle')} closeLabel={common('close')}>
      <SignOutAsk onCancel={onClose} />
    </Sheet>
  );
}
function SignOutAsk({ onCancel }: { onCancel(): void }) {
  const t = useT('account');
  const common = useT('common');
  const { signOut } = useAccount();
  const pending = useAccountSaving(unsaved);
  const [signingOut, setSigningOut] = useState(false);
  return (
    <>
      <ReadText size={14} tone="ink-200" lineHeight={14 * SNUG}>{t('signOutAbout')}</ReadText>
      {pending ? (
        <ReadText size={13} tone="wine-300" lineHeight={13 * SNUG} style={{ marginTop: 8 }}>
          {t('signOutUnsaved')}
        </ReadText>
      ) : null}
      <View style={{ marginTop: 16, gap: 8 }}>
        <Button variant="secondary" wide onPress={onCancel}>
          {common('cancel')}
        </Button>
        <Button
          variant="danger"
          wide
          disabled={signingOut || pending}
          onPress={() => {
            setSigningOut(true);
            void signOut().then(
              (done) => {
                if (!done) setSigningOut(false);
              },
              () => setSigningOut(false),
            );
          }}
        >
          {t('signOut')}
        </Button>
      </View>
    </>
  );
}

/** Everything the player can set, at once: the settings of a life in progress, already in a sheet of their own. */
export function Preferences() {
  return (
    <View style={{ gap: 8 }}>
      <LanguagePick />
      <Switches />
      <AccountBlock signOut />
    </View>
  );
}

/** Which game this is, for a report of something amiss: small, and out of the way at the foot. */
export function Version() {
  const t = useT('settings');
  return (
    <ReadText size={11} tone="ink-300" style={{ textAlign: 'center', opacity: 0.7 }}>
      {t('version', { content: CONTENT_VERSION, engine: ENGINE_VERSION })}
    </ReadText>
  );
}

/** What the settings of the front door hold: the account, where things are kept, the language, the switches and the version. */
export function HomeSettingsSheet({ open, onClose }: { open: boolean; onClose(): void }) {
  const t = useT('settings');
  const common = useT('common');
  return (
    <Sheet open={open} onClose={onClose} title={t('title')} closeLabel={common('close')}>
      <HomeSettings />
    </Sheet>
  );
}
function HomeSettings() {
  const home = useT('home');
  const { state: account } = useAccount();
  return (
    <View style={{ gap: 12 }}>
      {/* The account first: whether the game is kept in it, and the way into one. */}
      <AccountBlock compact signOut />
      {account.kind === 'offline' ? <ReadText size={13} tone="ink-300">{home('savedHere')}</ReadText> : null}
      <LanguagePick />
      <Switches />
      <Version />
    </View>
  );
}

/** The settings of the front door, from the corner: one button with a gear. */
export function HomePreferences() {
  const t = useT('settings');
  const [open, setOpen] = useState(false);
  return (
    <>
      <Raised role="button" label={t('title')} bg="night-700" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }} onPress={() => setOpen(true)}>
        <Sprite id="icon.settings" />
      </Raised>
      <HomeSettingsSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/**
 * The same at the foot of the front door, as it always was: the account in sight, with the way into Google, the player's profile where there is one,
 * and the settings a button below.
 */
export function HomeSettingsPanel({ profile = null }: { profile?: ReactNode }) {
  const t = useT('settings');
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <AccountBlock compact />
      {/* The player's profile, next to the account it belongs to. */}
      {profile}
      <Button variant="secondary" wide onPress={() => setOpen(true)}>
        <Sprite id="icon.settings" />
        {t('title')}
      </Button>
      <HomeSettingsSheet open={open} onClose={() => setOpen(false)} />
    </View>
  );
}

/** Where the life stands: who, how far along, and what it is worth so far. */
export function Standing({ shown }: { shown: GameView }) {
  const t = useT('settings');
  const common = useT('common');
  const phone = useT('phone');
  const { content, text, names, fmt } = useWords();
  const lifeId = useGame((s) => s.lifeId) ?? '';
  const ranked = useGame((s) => s.ranked);
  const challenge = useGame((s) => s.challenge);
  const saving = useSaving();
  const p = shown.player;
  const age = ageAt(content, shown.round);
  const left = (content.rounds - shown.round) * content.yearsPerRound;
  const points = useMemo(() => scoreBreakdown(content, shown).total, [content, shown]);
  const kind = challenge !== null ? t(ranked ? 'challenge' : 'practice') : ranked ? t('ranked') : t('game');

  return (
    <Framed kind="frame" tone={GOLD} accessibilityLabel={t('game')} style={{ backgroundColor: COLORS['night-700'], padding: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Framed kind="frame" style={{ flexShrink: 0 }}>
          {/* The face of the portrait, cut out of it: its top four points are the hat. */}
          <Well style={{ width: 44, height: 44, overflow: 'hidden', justifyContent: 'flex-start' }}>
            <Sprite id={portraitArt(lifeId, portraitAge(age))} fallback={{ w: 64, h: 64 }} style={{ marginTop: -4 }} />
          </Well>
        </Framed>
        <View style={{ flex: 1, minWidth: 0 }}>
          <PixelText size={11} tone="gold-500" style={{ letterSpacing: 11 * 0.05, textTransform: 'uppercase' }}>{kind}</PixelText>
          <PixelText size={17} lineHeight={17 * TIGHT} numberOfLines={1}>{text.lives[lifeId]?.name ?? ''}</PixelText>
          <ReadText size={12} tone="ink-300" numberOfLines={1}>{`${common('age', { age })} · ${names.cities[p.cityId]}`}</ReadText>
        </View>
        {/* What it is worth so far, in two figures beside who is living it. */}
        <View style={{ flexShrink: 0 }}>
          <PixelText size={16} tone="gold-500" lineHeight={16 * TIGHT} style={{ textAlign: 'right' }}>{t('points', { n: fmt.number(points) })}</PixelText>
          <PixelText size={13} tone="ink-200" lineHeight={13 * TIGHT} style={{ textAlign: 'right' }}>{fmt.compact(netWorth(p))}</PixelText>
        </View>
      </View>

      <View style={{ marginTop: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
          <PixelText size={12}>{common('round', { n: Math.min(shown.round + 1, content.rounds), total: content.rounds })}</PixelText>
          <ReadText size={12} tone="ink-300">{left > 0 ? t('yearsLeft', { years: left }) : t('over')}</ReadText>
        </View>
        <Bar value={shown.round} max={content.rounds} label={t('progress')} tone="teal" />
      </View>

      {/* Saving is said only when it fails: when it works, there is nothing to say. */}
      {saving ? null : (
        <Notice role="alert" size={13} style={{ marginTop: 8 }}>
          {phone('notSaved')}
        </Notice>
      )}
    </Framed>
  );
}

/**
 * Everything about the game rather than the life: where it stands, what can be set, and the way
 * back to the front door. Nothing is lost by leaving: the life is saved after every step.
 */
export function SettingsSheet({ open, onClose, shown }: { open: boolean; onClose(): void; shown: GameView }) {
  const t = useT('settings');
  const common = useT('common');
  const router = useRouter();
  return (
    <Sheet open={open} onClose={onClose} title={t('title')} closeLabel={common('close')}>
      <View style={{ gap: 12 }}>
        <Standing shown={shown} />
        <Panel title={t('preferences')}>
          <Preferences />
        </Panel>
        <View>
          {/* The sheet closes first, and the page moves on when it is gone: a page changed under a sheet that is still leaving is left with it. */}
          <Raised
            role="link"
            label={t('home')}
            tone={GOLD}
            bg="gold-500"
            style={{ minHeight: 48, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            onPress={() => {
              onClose();
              void sheetsGone().then(() => router.dismissTo('/'));
            }}
          >
            <PixelText size={17} tone="ink-900">{'←'}</PixelText>
            <PixelText size={17} tone="ink-900">{t('home')}</PixelText>
          </Raised>
        </View>
        <EndLife shown={shown} onLeave={onClose} />
        <Version />
      </View>
    </Sheet>
  );
}

/**
 * Ends the life alone on screen, after asking; the game then goes back to the front door by itself.
 * Never a life in a game with friends: that has its own way out. The sheets close first, and the
 * life ends once they are gone, or the screen would change under a sheet that is still leaving.
 */
export function EndLife({ shown, onLeave }: { shown: GameView; onLeave(): void }) {
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
      <Raised
        role="button"
        tone={WINE}
        bg="wine-700"
        style={{ minHeight: 48, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }}
        onPress={() => setAsking(true)}
      >
        <PixelText size={17} tone="cream">{t('endLife')}</PixelText>
      </Raised>
      <Sheet open={asking} onClose={() => setAsking(false)} title={t('endLifeTitle')} closeLabel={common('close')}>
        <ReadText size={14} tone="ink-200" lineHeight={14 * SNUG}>
          {t('endLifeBody', { life: text.lives[lifeId]?.name ?? '', age: common('age', { age: ageAt(content, shown.round) }) })}
        </ReadText>
        {ranked ? (
          <ReadText size={13} tone="wine-300" lineHeight={13 * SNUG} style={{ marginTop: 8 }}>
            {t(challenge !== null ? 'endLifeChallenge' : 'endLifeRanked')}
          </ReadText>
        ) : null}
        <View style={{ marginTop: 16, gap: 8 }}>
          <Button variant="secondary" wide onPress={() => setAsking(false)}>
            {common('cancel')}
          </Button>
          <Button
            variant="danger"
            wide
            disabled={ending}
            onPress={() => {
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
        </View>
      </Sheet>
    </>
  );
}
