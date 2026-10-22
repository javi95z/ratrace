// @vitest-environment jsdom
import type { Account, Community } from '@ratrace/online/types';
import { cleanup, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Preferences } from '../game/screens/Settings';
import { expoConstants, expoDevice, notices } from '../testing/fakes';
import { memoryServices, renderGame } from '../testing/render';
import { phonePush } from './push';
import type { PushNoted } from './push';

/*
 * Where the phone cannot be told, the phone's notices (expo-notifications) are never loaded: in Expo Go the library warns as it loads, a banner
 * over every screen (and every scene's shot). The stand-in counts its loads (`notices.loads`, once a file of tests: the tests here run in order).
 */

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

const note = { now: { state: 'on', token: 'ExponentPushToken[phone-1]' } as PushNoted | null, read: () => note.now, write: (noted: PushNoted) => void (note.now = noted) };
const community = { notifyMe: async () => true, stopNotifying: async () => true, marketNotice: async () => true, me: async () => null } as unknown as Community;
const guest = { kind: 'guest', userId: 'guest-1', notice: null };
const account = { state: () => guest, subscribe: () => () => undefined, settled: () => true, start: async () => undefined } as unknown as Account;

/** Everything the push can be asked, as the app asks it, on a phone that cannot be told. */
async function everything(platform = 'ios') {
  const push = phonePush(note, { platform });
  renderGame(<Preferences />, { ...memoryServices(), account, community: () => community, push });
  await screen.findByRole('switch', { name: /^Sound/ });
  expect(push.available()).toBe(false);
  expect(await push.pushOn()).toBe('unavailable');
  expect(await push.isOn()).toBe(false);
  expect(await push.target()).toBeNull();
  await push.pushOff(community);
  await push.release(community);
  push.follow(account, () => community, 'en')();
  push.onTap(() => undefined)();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

it('is not loaded in Expo Go', async () => {
  vi.stubEnv('EXPO_PUBLIC_EAS_PROJECT_ID', 'project-1');
  (expoConstants.default as { executionEnvironment?: string }).executionEnvironment = 'storeClient';
  await everything();
  expect(notices.loads).toBe(0);
});

it('is not loaded with no Expo project in the build', async () => {
  vi.stubEnv('EXPO_PUBLIC_EAS_PROJECT_ID', '');
  await everything();
  expect(notices.loads).toBe(0);
});

it('is not loaded on a simulator', async () => {
  vi.stubEnv('EXPO_PUBLIC_EAS_PROJECT_ID', 'project-1');
  expoDevice.isDevice = false;
  await everything();
  expect(notices.loads).toBe(0);
});

it('is not loaded off a phone', async () => {
  vi.stubEnv('EXPO_PUBLIC_EAS_PROJECT_ID', 'project-1');
  await everything('web');
  expect(notices.loads).toBe(0);
});

it('is loaded where the phone can be told (the count does count)', async () => {
  vi.stubEnv('EXPO_PUBLIC_EAS_PROJECT_ID', 'project-1');
  note.now = { state: 'on', token: 'ExponentPushToken[phone-1]' };
  expect(await phonePush(note, { platform: 'ios' }).isOn()).toBe(false);
  expect(notices.loads).toBe(1);
});

