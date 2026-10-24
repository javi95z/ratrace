import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useTrack } from '../game/context';
import { useT } from '../game/words';
import { kvInstallOffer } from '../kvStore.web';
import { Framed } from '../ui/Frame';
import { Button, usePress } from '../ui/kit';
import { Sheet } from '../ui/overlay';
import { PixelText, ReadText, SNUG } from '../ui/text';
import { COLORS, TOUCH } from '../ui/theme';

/*
 * The web export's twin of `install.tsx` (Metro picks it for the web), and the Next web's offer to install the game as an app in the app's own parts:
 * `apps/web/src/pwa/runtime.tsx` (the provider: Chrome's install prompt, the install counted, standalone and iOS), `InstallApp.tsx` (the invitation on
 * Home, and its steps in a sheet) and `ViewportSync.tsx` (the installed iPhone page put right when the status bar changes). The logic is theirs; the
 * counting goes through the game's `useTrack`, to the project's own `track`, where the Next web's goes to Vercel.
 */

/** The install event is deliberately absent from lib.dom: Chromium exposes it before standardisation. */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type InstallState = 'checking' | 'available' | 'manual' | 'installed';
export type InstallPlatform = 'ios' | 'browser';

interface PwaState {
  state: InstallState;
  platform: InstallPlatform;
  install(): Promise<'accepted' | 'dismissed' | 'manual'>;
}

// A screen drawn alone (a test) should not grow an installation control by accident.
const PwaContext = createContext<PwaState>({ state: 'installed', platform: 'browser', install: async () => 'manual' });

const standalone = () => {
  const iosNavigator = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches === true || iosNavigator.standalone === true;
};

/** iPadOS presents itself as a Mac, but unlike a Mac it has several touch points. */
export const installPlatform = (agent: Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'>): InstallPlatform =>
  /iPad|iPhone|iPod/.test(agent.userAgent) || (agent.platform === 'MacIntel' && agent.maxTouchPoints > 1) ? 'ios' : 'browser';

/**
 * Chromium gives its install event once, as soon as the page may be installed, and the game can take a while to open (its typefaces, its language's
 * words): an event that comes before the provider stands is kept here until it does, and taken by it. The Next web's provider is mounted by the page's
 * layout, which is drawn at once; the app's waits for the game.
 */
let early: BeforeInstallPromptEvent | null = null;
/** How many providers stand: while one does, it listens itself, and nothing is kept here. */
let standing = 0;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    if (standing > 0) return;
    event.preventDefault();
    early = event as BeforeInstallPromptEvent;
  });
}

/**
 * Owns the install state for the whole app. It is mounted inside the game above every route, so Chromium's one-shot `beforeinstallprompt` event is not
 * lost when the player is somewhere other than Home, and the install is counted. It decides in an effect, once the browser has it: the page the build
 * draws (no window there) offers nothing, and the browser's first draw is the same.
 */
export function InstallProvider({ children }: { children: ReactNode }) {
  const track = useTrack();
  const counting = useRef(track);
  counting.current = track;
  const prompt = useRef<BeforeInstallPromptEvent | null>(null);
  const counted = useRef(false);
  const [state, setState] = useState<InstallState>('checking');
  const [platform, setPlatform] = useState<InstallPlatform>('browser');

  useEffect(() => {
    standing += 1;
    if (early) {
      prompt.current = early;
      early = null;
    }
    setPlatform(installPlatform(navigator));
    setState(standalone() ? 'installed' : prompt.current ? 'available' : 'manual');

    const offered = (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent;
      installEvent.preventDefault();
      prompt.current = installEvent;
      setState('available');
    };
    // Counted here alone: every install ends here, from the game's own button or the browser's menu. Once, however often the browser says it.
    const installed = () => {
      prompt.current = null;
      setState('installed');
      if (counted.current) return;
      counted.current = true;
      counting.current({ name: 'app_installed' });
    };
    window.addEventListener('beforeinstallprompt', offered);
    window.addEventListener('appinstalled', installed);
    return () => {
      standing -= 1;
      window.removeEventListener('beforeinstallprompt', offered);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  const install = useCallback(async (): Promise<'accepted' | 'dismissed' | 'manual'> => {
    const offered = prompt.current;
    if (!offered) return 'manual';
    prompt.current = null;
    await offered.prompt();
    const choice = await offered.userChoice;
    setState(choice.outcome === 'accepted' ? 'installed' : 'manual');
    return choice.outcome;
  }, []);

  const value = useMemo(() => ({ state, platform, install }), [state, platform, install]);
  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}

const usePwa = () => useContext(PwaContext);

/**
 * Whether Home offers to install the game: from the second visit on, until the player says no. A visit is a time the page is opened, counted once
 * however often Home is shown in it. Nothing is offered where the browser keeps nothing, and nothing is decided before the browser has it (the page
 * the build draws offers none). What is kept is the browser's, under the Next web's key (`kvInstallOffer`).
 */
export function useInstallOffer(): { shown: boolean; dismiss(): void } {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const kept = kvInstallOffer.visit();
    setShown(kept !== null && kept.visits >= 2 && !kept.dismissed);
  }, []);
  const dismiss = () => {
    setShown(false);
    kvInstallOffer.dismiss();
  };
  return { shown, dismiss };
}

/** A small invitation on Home and a useful fallback for browsers without a native install prompt. `onDismiss` adds a way to say no for good. */
export function InstallApp({ onDismiss }: { onDismiss?: () => void } = {}) {
  const t = useT('install');
  const common = useT('common');
  const { state, platform, install } = usePwa();
  const [instructions, setInstructions] = useState(false);
  const say = usePress({ onPress: () => onDismiss?.() });

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
    <>
      <View role="region" aria-label={t('title')} style={{ width: '100%' }}>
        <Framed kind="frame" style={{ backgroundColor: COLORS['night-700'], padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <img src="/icons/icon-192.png" width={48} height={48} alt="" style={{ flexShrink: 0, imageRendering: 'pixelated' }} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <PixelText size={16} tone="gold-500">{t('title')}</PixelText>
            <ReadText size={12} tone="ink-200" lineHeight={12 * SNUG} style={{ marginTop: 2 }}>{t('hint')}</ReadText>
          </View>
          <View style={{ flexShrink: 0 }}>
            <Button variant="quiet" size={14} padX={12} onPress={begin}>
              {t('action')}
            </Button>
          </View>
          {onDismiss ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('dismiss')}
              onPress={say}
              style={{ width: TOUCH, height: TOUCH, marginRight: -4, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}
            >
              <ReadText size={18} tone="ink-300">×</ReadText>
            </Pressable>
          ) : null}
        </Framed>
      </View>

      <Sheet open={instructions} onClose={() => setInstructions(false)} title={t('howTitle')} closeLabel={common('close')}>
        <ReadText size={14} tone="ink-200" lineHeight={14 * SNUG}>{t(platform === 'ios' ? 'iosIntro' : 'browserIntro')}</ReadText>
        <View role="list" style={{ marginTop: 16, gap: 12 }}>
          {steps.map((step, index) => (
            <View key={step} role="listitem" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <Framed kind="frame" style={{ backgroundColor: COLORS['gold-500'], width: 28, height: 28, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}>
                <PixelText size={15} tone="ink-900">{String(index + 1)}</PixelText>
              </Framed>
              <ReadText size={14} tone="cream" lineHeight={14 * SNUG} style={{ flex: 1, paddingTop: 2 }}>{t(step)}</ReadText>
            </View>
          ))}
        </View>
        <View style={{ marginTop: 16, paddingTop: 12, borderTopWidth: 2, borderTopColor: COLORS['night-700'] }}>
          <ReadText size={12} tone="ink-300" lineHeight={12 * SNUG}>{t('offline')}</ReadText>
        </View>
      </Sheet>
    </>
  );
}

/**
 * An installed iPhone page can be left shifted when the status bar changes under it (a call, a recording, a hotspot, the island's media pill): the page
 * sits a little off the screen, the bar at the foot floats mid-page and the cover of the status bar is not at the top. The browser puts it right on the
 * next scroll, so on every change of the visible area the page is scrolled by nothing and the layout is measured again.
 */
export function ViewportSync() {
  useEffect(() => {
    const view = window.visualViewport;
    let frame = 0;
    const settle = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // Only when the page is out of place: the visible area is not where the layout puts it.
        if (view && Math.abs(view.offsetTop) < 1 && Math.abs(view.offsetLeft) < 1) return;
        window.scrollTo?.({ top: window.scrollY, left: 0 });
        document.documentElement.style.setProperty('--viewport-nudge', String(Date.now() % 2));
      });
    };
    const listened: Array<[EventTarget, string]> = [
      [window, 'orientationchange'],
      [window, 'pageshow'],
      [document, 'visibilitychange'],
    ];
    if (view) listened.push([view, 'resize'], [view, 'scroll']);
    for (const [target, type] of listened) target.addEventListener(type, settle);
    return () => {
      cancelAnimationFrame(frame);
      for (const [target, type] of listened) target.removeEventListener(type, settle);
    };
  }, []);
  return null;
}
