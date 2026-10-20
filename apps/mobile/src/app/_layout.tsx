// The phone's JavaScript is given what the game's packages use before any of them load.
import '../polyfills';
import { SplashScreen, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GameProvider } from '../game/context';
import { useGameFonts } from '../ui/fonts';
import { GROUND_THEME, SCREENS } from '../ui/navigation';
import { Page } from '../ui/Page';

// The splash stays until the game's typefaces are in, so nothing is drawn in the system font first; if they fail to
// load, it lifts all the same (useGameFonts tells why), and the game goes on in the system font.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

/**
 * The shell of every screen, as the web's [locale]/layout.tsx: the typefaces, the game (session, store,
 * words, sound, motion) and the ground. Screens change at once, as a web page does, over the one ground.
 */
export default function RootLayout() {
  const fonts = useGameFonts();
  useEffect(() => {
    if (fonts) void SplashScreen.hideAsync().catch(() => undefined);
  }, [fonts]);
  if (!fonts) return null;
  return (
    <GameProvider>
      <StatusBar style="light" />
      <Page>
        <ThemeProvider value={GROUND_THEME}>
          <Stack screenOptions={SCREENS} />
        </ThemeProvider>
      </Page>
    </GameProvider>
  );
}
