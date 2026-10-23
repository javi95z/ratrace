import { readFileSync } from 'node:fs';
import type { ExpoConfig } from 'expo/config';
import { describe, expect, test } from 'vitest';
import { serverProblem, withServerCheck } from '../app.config';

/*
 * The app's config (app.json): what it asks of the phone. Saving the picture of a life to the photos (`expo-media-library`) is the only thing it
 * asks of the phone's storage, and it only adds: the plugin declares on Android, whatever it is given, the permissions to read the storage and the
 * photos a player picked, which the app never asks for. They are blocked, and the one it asks for on Android 10 to 12 to write is kept.
 */
const config = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')) as {
  expo: { android: { blockedPermissions?: string[]; permissions?: string[] }; plugins: Array<string | [string, Record<string, unknown>]> };
};

test('declares on Android no permission to read what the app never reads: the storage and the photos a player picked are blocked, writing kept', () => {
  expect(config.expo.android.blockedPermissions).toEqual(['android.permission.READ_EXTERNAL_STORAGE', 'android.permission.READ_MEDIA_VISUAL_USER_SELECTED']);
  expect(config.expo.android.blockedPermissions).not.toContain('android.permission.WRITE_EXTERNAL_STORAGE');
  expect(config.expo.android.permissions ?? []).not.toContain('android.permission.READ_EXTERNAL_STORAGE');
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
