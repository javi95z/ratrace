/*
 * Who answers for the game, named in the legal notice: the web's own two constants (apps/web/src/lib/site.ts, which a test holds this file
 * to), read from the build's variables, never from the code. Where the web is deployed they are `NEXT_PUBLIC_LEGAL_NAME` and `..._EMAIL`; here
 * they are `EXPO_PUBLIC_LEGAL_NAME` and `..._EMAIL`, which Expo puts into the app as it is built (named in full, or it cannot).
 */
export const LEGAL_NAME = process.env.EXPO_PUBLIC_LEGAL_NAME?.trim() ?? '';
export const LEGAL_EMAIL = process.env.EXPO_PUBLIC_LEGAL_EMAIL?.trim() ?? '';
