import { requireOptionalNativeModule } from 'expo';

/*
 * The app's language as the phone's system keeps it: Android's per-app language, from Android 13 (Settings → Apps → The Rat Race → Language, which
 * lists the game's languages: expo-localization's `supportedLocales` in app.json). `modules/app-language` reads and writes it. None on an older
 * Android, on iOS, in Expo Go or in a test: the game keeps the player's choice alone there (`kvLanguage`).
 */

interface AppLanguageModule {
  kept(): boolean;
  read(): string | null;
  write(tag: string): Promise<void>;
}

/** The app's language as the system keeps it. */
export interface SystemLanguage {
  /** Its language (`es`, from `es-ES`), or null where the app follows the phone's own. */
  read(): string | null;
  /** Keeps `locale`: the system lists it in the app's settings and tells the app of the change (`useLocales`). */
  write(locale: string): void;
}

/** The system's keeping of the app's language, or null where it keeps none. */
export function systemLanguage(): SystemLanguage | null {
  const native = requireOptionalNativeModule<AppLanguageModule>('AppLanguage');
  if (native === null || !native.kept()) return null;
  return {
    read: () => native.read()?.split('-')[0] || null,
    write: (locale) => {
      // A system that will not keep it: the game's own choice stands, kept beside it.
      native.write(locale).catch(() => undefined);
    },
  };
}
