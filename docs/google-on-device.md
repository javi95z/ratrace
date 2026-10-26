# Google on the phone itself

The app signs in with Google through the phone's own chooser (no browser) when its build names its Google clients
(`apps/mobile/src/online/google.ts`); a build that names none goes through the browser as before. Nothing changes
on the server's side but the settings below.

## What has to be set up, once

1. **Google Cloud console**, in the project whose OAuth client Supabase's Google provider uses:
   - The **web client** Supabase already uses: its client ID is `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
   - An **Android client**: package `com.hackio.theratrace`, and the SHA-1 of the key that signs the app. Make one
     for the EAS upload key (`eas credentials`, Android) and one for Google Play's app signing key (Play Console →
     App integrity) once the app is on Play.
   - An **iOS client**: bundle ID `com.hackio.theratrace`. Its client ID is `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.
2. **Supabase** → Authentication → Providers → Google:
   - Authorized Client IDs: the web, Android and iOS client IDs, comma separated.
   - Skip nonce check: on (Google's iOS SDK puts a nonce in its token that the app does not see).
3. **EAS** environment (preview and production): `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and
   `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`. The iOS one also gives the build its URL scheme (`app.config.ts`).

None of these are secrets: client IDs are public. Then a new build.

## How it behaves

- Keep the game with Google (a guest): the chooser, then the guest's account is linked to that Google account.
  A Google account that already has a player: the guest is taken into it, as on the web.
- Use an existing account: the chooser, then signed in as that account's player.
- Chooser closed: nothing said. Any other failure: the usual "could not" notice.
- No Google services on the phone, or the library not loading: the browser, as before.
