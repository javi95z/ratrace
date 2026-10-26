package expo.modules.applanguage

import android.app.LocaleManager
import android.os.Build
import android.os.LocaleList
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The app's language as Android keeps it, from Android 13 (Settings → Apps → The Rat Race → Language, the languages app.json's expo-localization
 * lists): read, and written when the player chooses one in the game, so the two are one choice. Nothing before Android 13, which has no such setting.
 */
class AppLanguageModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AppLanguage")

    /** Whether the system keeps an app's language (Android 13 and later). */
    Function("kept") {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
    }

    /** The app's language as the system keeps it (a BCP 47 tag), or null where it follows the phone's own. */
    Function("read") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        val locales = appContext.reactContext?.getSystemService(LocaleManager::class.java)?.applicationLocales
        if (locales == null || locales.isEmpty) null else locales.get(0).toLanguageTag()
      } else {
        null
      }
    }

    /** Keeps `tag` as the app's language: the system tells the app of the change, and lists it in the app's settings. */
    AsyncFunction("write") { tag: String ->
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        appContext.reactContext?.getSystemService(LocaleManager::class.java)?.applicationLocales = LocaleList.forLanguageTags(tag)
      }
    }.runOnQueue(Queues.MAIN)
  }
}
