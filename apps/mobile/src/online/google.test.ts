import { afterEach, beforeEach, expect, test, vi } from 'vitest';

// The platform, the app's surroundings and Google's library a test says: what it was configured with and asked.
const phone = vi.hoisted(() => ({
  OS: 'android',
  environment: 'standalone',
  answer: { type: 'success', data: { idToken: 'token-1' } } as unknown,
  throws: null as null | { code: string },
  play: true,
  asked: [] as string[],
}));
vi.mock('react-native', () => ({ Platform: { get OS() { return phone.OS; } } }));
vi.mock('expo-constants', () => ({ default: { get executionEnvironment() { return phone.environment; } } }));
vi.mock('@react-native-google-signin/google-signin', () => ({
  statusCodes: { SIGN_IN_CANCELLED: 'cancelled', IN_PROGRESS: 'in-progress' },
  isErrorWithCode: (error: unknown) => typeof error === 'object' && error !== null && 'code' in error,
  GoogleSignin: {
    configure: (options: object) => void phone.asked.push(`configure ${JSON.stringify(options)}`),
    signOut: async () => void phone.asked.push('sign-out'),
    hasPlayServices: async () => phone.play,
    signIn: async () => {
      phone.asked.push('sign-in');
      if (phone.throws) throw phone.throws;
      return phone.answer;
    },
  },
}));

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', 'web.apps.googleusercontent.com');
  vi.stubEnv('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID', '');
});
afterEach(() => {
  vi.unstubAllEnvs();
  Object.assign(phone, { OS: 'android', environment: 'standalone', answer: { type: 'success', data: { idToken: 'token-1' } }, throws: null, play: true, asked: [] });
});

test("on a phone with the build's Google client, the system's chooser is shown every time, and the chosen account's token is the answer", async () => {
  const { googleOnDevice } = await import('./google');
  const google = googleOnDevice()!;
  expect(await google()).toBe('token-1');
  expect(await google()).toBe('token-1');
  expect(phone.asked).toEqual(['configure {"webClientId":"web.apps.googleusercontent.com"}', 'sign-out', 'sign-in', 'sign-out', 'sign-in']);
});

test('a chooser closed is `cancelled`; no Google services, or any other failure, null (the browser then)', async () => {
  const { googleOnDevice } = await import('./google');
  const google = googleOnDevice()!;
  phone.answer = { type: 'cancelled', data: null };
  expect(await google()).toBe('cancelled');
  phone.throws = { code: 'cancelled' };
  expect(await google()).toBe('cancelled');
  phone.throws = { code: 'DEVELOPER_ERROR' };
  expect(await google()).toBeNull();
  phone.throws = null;
  phone.play = false;
  expect(await google()).toBeNull();
});

test('none where the build names no client, on an iPhone with no iOS client, or in Expo Go', async () => {
  vi.stubEnv('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', '');
  expect((await import('./google')).googleOnDevice()).toBeUndefined();
  vi.resetModules();
  vi.stubEnv('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', 'web.apps.googleusercontent.com');
  phone.OS = 'ios';
  expect((await import('./google')).googleOnDevice()).toBeUndefined();
  vi.resetModules();
  vi.stubEnv('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID', 'ios.apps.googleusercontent.com');
  expect((await import('./google')).googleOnDevice()).toBeTypeOf('function');
  vi.resetModules();
  phone.environment = 'storeClient';
  expect((await import('./google')).googleOnDevice()).toBeUndefined();
});
