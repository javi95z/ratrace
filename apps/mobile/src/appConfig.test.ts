import { readFileSync } from 'node:fs';
import type { ExpoConfig } from 'expo/config';
import { describe, expect, test } from 'vitest';
import { serverProblem, withGoogleOnDevice, withServerCheck } from '../app.config';

/*
 * The app's config (app.json): what it asks of the phone. Saving the picture of a life to the photos (`expo-media-library`) is the only thing it
 * asks of the phone's storage, and it only adds: the plugin declares on Android, whatever it is given, the permissions to read the storage and the
 * photos a player picked, which the app never asks for. They are blocked, and the one it asks for on Android 10 to 12 to write is kept.
 */
const config = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')) as {
  expo: { android: { blockedPermissions?: string[]; permissions?: string[] }; plugins: Array<string | [string, Record<string, unknown>]> };
};

test('declares on Android no permission to read what the app never reads: the storage and the photos a player picked are blocked, writing kept', () => {
  expect(config.expo.android.blockedPermissions?.slice(0, 2)).toEqual(['android.permission.READ_EXTERNAL_STORAGE', 'android.permission.READ_MEDIA_VISUAL_USER_SELECTED']);
  expect(config.expo.android.blockedPermissions).not.toContain('android.permission.WRITE_EXTERNAL_STORAGE');
  expect(config.expo.android.permissions ?? []).not.toContain('android.permission.READ_EXTERNAL_STORAGE');
});

test('declares on Android nothing else it never uses: no drawing over other apps (the template\'s, for development), no reading the Wi-Fi (online/page.ts asks only whether the phone is online)', () => {
  expect(config.expo.android.blockedPermissions?.slice(2)).toEqual(['android.permission.SYSTEM_ALERT_WINDOW', 'android.permission.ACCESS_WIFI_STATE']);
  expect(readFileSync(new URL('./online/page.ts', import.meta.url), 'utf8')).not.toMatch(/getIpAddressAsync|getMacAddressAsync/);
});

test('asks the photos only to add to them: no description of reading them, no place of a picture, no kind of media to read', () => {
  const media = config.expo.plugins.find((plugin): plugin is [string, Record<string, unknown>] => Array.isArray(plugin) && plugin[0] === 'expo-media-library');
  expect(media?.[1]).toEqual({
    photosPermission: false,
    savePhotosPermission: 'The Rat Race saves the picture of your life to your photos.',
    isAccessMediaLocationEnabled: false,
    granularPermissions: [],
  });
});

test('plays its sounds and asks for nothing more: no microphone (no description of it on iOS, no permission to record on Android), no playing in the background', () => {
  // The game's sounds are short cues played while it is open (ui/sound.tsx), never recorded and never heard with the app away: expo-audio's plugin
  // would otherwise describe the microphone to iOS, declare RECORD_AUDIO, and keep a background audio mode and its foreground service.
  const audio = config.expo.plugins.find((plugin): plugin is [string, Record<string, unknown>] => Array.isArray(plugin) && plugin[0] === 'expo-audio');
  expect(audio?.[1]).toEqual({ microphonePermission: false, recordAudioAndroid: false, enableBackgroundPlayback: false });
  expect(config.expo.plugins).not.toContain('expo-audio');
});

test('shows the game\'s notices in the channel the app names (online/push.ts), with no work in the background: a tap opens the app, nothing more', () => {
  const notifications = config.expo.plugins.find((plugin): plugin is [string, Record<string, unknown>] => Array.isArray(plugin) && plugin[0] === 'expo-notifications');
  expect(notifications?.[1]).toEqual({ defaultChannel: 'default', enableBackgroundRemoteNotifications: false });
  expect(readFileSync(new URL('./online/push.ts', import.meta.url), 'utf8')).toContain("const CHANNEL = 'default';");
});

describe('a store build (EAS preview or production) carries the live project, never none and never a project on this machine', () => {
  const live = { EXPO_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_live' };

  test('a development build, or a build made here outside EAS, is not held to it: the device checks run on the fake project', () => {
    expect(serverProblem({})).toBeNull();
    expect(serverProblem({ EAS_BUILD_PROFILE: 'development' })).toBeNull();
    expect(serverProblem({ EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:1' })).toBeNull();
  });

  test('a preview or production build with the live project passes', () => {
    expect(serverProblem({ ...live, EAS_BUILD_PROFILE: 'preview' })).toBeNull();
    expect(serverProblem({ ...live, EAS_BUILD_PROFILE: 'production' })).toBeNull();
  });

  test('refuses one with no project, which would play offline and say nothing', () => {
    expect(serverProblem({ EAS_BUILD_PROFILE: 'preview' })).toMatch(/EXPO_PUBLIC_SUPABASE_URL/);
    expect(serverProblem({ EAS_BUILD_PROFILE: 'production', EXPO_PUBLIC_SUPABASE_URL: live.EXPO_PUBLIC_SUPABASE_URL })).toMatch(/EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  });

  test('refuses one pointed at a project that is not on https or lives on this machine or network, or with a fake key', () => {
    for (const url of ['http://abc.supabase.co', 'https://127.0.0.1:54321', 'https://localhost', 'https://192.168.1.4', 'https://10.0.2.2:8000', 'not a url']) {
      expect(serverProblem({ ...live, EXPO_PUBLIC_SUPABASE_URL: url, EAS_BUILD_PROFILE: 'production' })).not.toBeNull();
    }
    expect(serverProblem({ ...live, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fake_x', EAS_BUILD_PROFILE: 'preview' })).not.toBeNull();
  });

  test('the config throws for such a build, and leaves app.json as it is otherwise', () => {
    const base = config.expo as unknown as ExpoConfig;
    expect(() => withServerCheck(base, { EAS_BUILD_PROFILE: 'production' })).toThrow(/EXPO_PUBLIC_SUPABASE_URL/);
    expect(withServerCheck(base, {})).toBe(base);
  });
});

describe('a Vercel build of the web (preview or production) carries the live project too, and everything else the live web needs', () => {
  const live = { EXPO_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_live' };
  /** The rest of the live web's settings, as the Next web's NEXT_PUBLIC_*: the notices' key, who answers for the game, and where it lives. */
  const site = {
    EXPO_PUBLIC_VAPID_PUBLIC_KEY: 'BPublicVapidKeyOfTheLiveWeb',
    EXPO_PUBLIC_LEGAL_NAME: 'Someone',
    EXPO_PUBLIC_LEGAL_EMAIL: 'someone@example.com',
    EXPO_PUBLIC_SITE_URL: 'https://ratrace.example',
  };
  const web = { ...live, ...site };

  test('a preview or production deployment with the live project and the live web\'s settings passes; a development one, or a build here (no VERCEL), is not held', () => {
    expect(serverProblem({ ...web, VERCEL: '1', VERCEL_ENV: 'preview' })).toBeNull();
    expect(serverProblem({ ...web, VERCEL: '1', VERCEL_ENV: 'production' })).toBeNull();
    expect(serverProblem({ VERCEL: '1', VERCEL_ENV: 'development' })).toBeNull();
    expect(serverProblem({ EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54399', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fake_local_only' })).toBeNull();
  });

  test('refuses one with no project, the fake one of this machine, or a fake key: an offline or a fake site would be deployed', () => {
    expect(serverProblem({ ...site, VERCEL_ENV: 'preview' })).toMatch(/Vercel's preview build has no EXPO_PUBLIC_SUPABASE_URL/);
    expect(serverProblem({ ...site, VERCEL_ENV: 'production', EXPO_PUBLIC_SUPABASE_URL: live.EXPO_PUBLIC_SUPABASE_URL })).toMatch(/EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
    expect(serverProblem({ ...site, VERCEL_ENV: 'preview', EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54399', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fake_local_only' })).not.toBeNull();
    expect(serverProblem({ ...web, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fake_x', VERCEL_ENV: 'production' })).toMatch(/fake/);
    expect(() => withServerCheck(config.expo as unknown as ExpoConfig, { VERCEL_ENV: 'production' })).toThrow(/EXPO_PUBLIC_SUPABASE_URL/);
  });

  test.each(['preview', 'production'])('refuses a %s one without the notices\' key, who answers for the game, or the site\'s https address', (env) => {
    // With no VAPID key the notices' switch is gone for every player who turned notices on, and they cannot turn them off; with no operator the
    // legal page names nobody; with no address of its own the site is drawn for another one (its canonical, its sitemap, its links).
    for (const name of ['EXPO_PUBLIC_VAPID_PUBLIC_KEY', 'EXPO_PUBLIC_LEGAL_NAME', 'EXPO_PUBLIC_LEGAL_EMAIL', 'EXPO_PUBLIC_SITE_URL'] as const) {
      expect(serverProblem({ ...web, VERCEL: '1', VERCEL_ENV: env, [name]: undefined }), name).toMatch(new RegExp(`Vercel's ${env} build has no ${name}`));
      expect(serverProblem({ ...web, VERCEL: '1', VERCEL_ENV: env, [name]: '   ' }), `${name} blank`).toMatch(new RegExp(name));
    }
    for (const url of ['http://ratrace.example', 'not a url', 'https://localhost:8091', 'https://127.0.0.1']) {
      expect(serverProblem({ ...web, VERCEL_ENV: env, EXPO_PUBLIC_SITE_URL: url }), url).toMatch(/EXPO_PUBLIC_SITE_URL/);
    }
  });

  test('refuses a build on Vercel that cannot tell which: VERCEL with no VERCEL_ENV (the system variables not exposed) is never let through unchecked', () => {
    expect(serverProblem({ VERCEL: '1' })).toMatch(/VERCEL_ENV/);
    expect(serverProblem({ ...web, VERCEL: '1' })).toMatch(/VERCEL_ENV/);
    expect(() => withServerCheck(config.expo as unknown as ExpoConfig, { VERCEL: '1' })).toThrow(/VERCEL_ENV/);
  });

  test('holds the phone\'s store builds to the project only: the web\'s settings are the web\'s', () => {
    expect(serverProblem({ ...live, EAS_BUILD_PROFILE: 'production' })).toBeNull();
  });
});

test('a build that names its iOS Google client gets the library\'s URL scheme for Google\'s sheet to come back to; one that names none, nothing of it', () => {
  const base = { name: 'x', slug: 'x', plugins: ['expo-router'] } as ExpoConfig;
  expect(withGoogleOnDevice(base, {})).toBe(base);
  expect(withGoogleOnDevice(base, { EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: '1234-abcd.apps.googleusercontent.com' }).plugins).toEqual([
    'expo-router',
    ['@react-native-google-signin/google-signin', { iosUrlScheme: 'com.googleusercontent.apps.1234-abcd' }],
  ]);
});
