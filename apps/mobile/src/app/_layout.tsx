import { SplashScreen, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Suspense, useEffect } from 'react';
import { GameProvider } from '../game/context';
import { KeyboardControls } from '../game/KeyboardHelp';
import { InstallProvider, ViewportSync } from '../pwa/install';
import { useServiceWorker } from '../pwa/register';
import { Visits } from '../pwa/visits';
import { useGameFonts } from '../ui/gameFonts';
import { GestureRoot } from '../ui/GestureRoot';
import { GROUND_THEME, SCREENS } from '../ui/navigation';
import { Page } from '../ui/Page';
import { SafeArea } from '../ui/SafeArea';
import { PerfFrames, perfTouched, perfTouchStarted } from '../ui/perf';

/**
 * On the web, a page of the game that cannot be drawn shows the Next web's error page in its place (`game/PageFault.web.tsx`): another try, a new
 * life, home, in the page's language, a language whose words could not be had among such faults. On the phone, nothing: it does what it did.
 */
export { ErrorBoundary } from '../game/PageFault';

// The splash stays until the game's typefaces are in, so nothing is drawn in the system font first; if they fail to
// load, it lifts all the same (useGameFonts tells why), and the game goes on in the system font.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

/**
 * The shell of every screen, as the web's [locale]/layout.tsx: the typefaces, the game (session, store,
 * words, sound, motion) and the ground. Screens change at once, as a web page does, over the one ground.
 */
export default function RootLayout() {
  const fonts = useGameFonts();
  // The site's worker, so the web opens offline (the web: pwa/register.web.ts); nothing on the phone.
  useServiceWorker();
  useEffect(() => {
    if (fonts) void SplashScreen.hideAsync().catch(() => undefined);
  }, [fonts]);
  if (!fonts) return null;
  // One gesture root round everything, so a drag can be read anywhere (phase 2's card swipe).
  return (
    <GestureRoot style={{ flex: 1 }} onTouchStart={perfTouchStarted} onTouchEnd={perfTouched}>
      {/* The timing probe's frames (a build made with EXPO_PUBLIC_PERF=1 only: nothing in any other, ui/perf.ts). */}
      <PerfFrames />
      {/* The web's count of visits, with no query in the address (pwa/visits.web.tsx); nothing on the phone. */}
      <Visits />
      {/* The game waits here for its language's words where they are fetched (the web: game/languageWords.web.ts); the page the build drew stays
          as it is meanwhile. Nothing waits on the phone. */}
      <Suspense fallback={null}>
        {/* The safe areas, measured where the router does not (the web: ui/SafeArea.web.tsx); nothing more on the phone. Inside the wait, so they
            change only once the page the build drew has been taken over: measured outside it, the page was taken over with them already, and its
            HTML, drawn with none, was left under the status bar. */}
        <SafeArea>
          <GameProvider>
            <StatusBar style="light" />
            {/* The web's offer to install the game (pwa/install.web.tsx), inside the game to count the install; nothing on the phone. */}
            <InstallProvider>
              <ViewportSync />
              {/* The keyboard on the page and its reference, `?` (game/KeyboardHelp.tsx, the web's ui/keyboard.web.tsx); nothing on the phone. */}
              <KeyboardControls />
              <Page>
                <ThemeProvider value={GROUND_THEME}>
                  <Stack screenOptions={SCREENS} />
                </ThemeProvider>
              </Page>
            </InstallProvider>
          </GameProvider>
        </SafeArea>
      </Suspense>
    </GestureRoot>
  );
}
