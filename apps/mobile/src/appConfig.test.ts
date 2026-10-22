import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

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
