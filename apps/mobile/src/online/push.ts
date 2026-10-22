import { messagesFor } from '@ratrace/i18n';
import type { Account, Community } from '@ratrace/online/types';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/*
 * The game's notices on the phone: the web's push subscription (apps/web/src/pwa/notifications.ts), through Expo's push service. The player is
 * asked once, the token Expo gives the phone is kept with the account in the language of the game (`Community.notifyMe`, the server's
 * `claim_push_token`), and kept again as the token, the account or the language changes. A tap on a notice opens the screen it names
 * (`theratrace://<page>`, `supabase/functions/_shared/notice.ts`), and nothing but the app's own screens. The only file of the app that names
 * expo-notifications (architecture.test.ts).
 *
 * Nothing of it is there where the phone cannot be told: a build with no Expo project (`EXPO_PUBLIC_EAS_PROJECT_ID`, until the game has one), a
 * simulator, Expo Go (which has no remote notices) or anything but a phone. Nothing in it throws: what the phone or the account cannot do is
 * answered, never raised.
 */

/** What the switch came to: on, refused by the player (now or before), or not to be had on this phone. */
export type PushOn = 'on' | 'refused' | 'unavailable';

/** What the app remembers of the notices, on the phone: turned on, turned off, or refused by the player (never asked again). */
export type PushNoted = 'on' | 'off' | 'refused';

/** Where the app keeps that: the phone's store, handed in by the game's context (`kvPush`), which is the only one to name it. */
export interface PushNote {
  read(): PushNoted | null;
  write(state: PushNoted): void;
}

/** The phone, as the server knows it. */
type Target = { expo: string };

export interface Push {
  /** True where the phone can be told at all. False, there is no switch to show. */
  available(): boolean;
  /** Whether the notices are on here: turned on, and still allowed by the phone. */
  isOn(): Promise<boolean>;
  /**
   * Asks the player (once, ever: a refusal is remembered), then the phone for its token. `refused` without asking where they said no before, or
   * the phone will not ask; `unavailable` where the phone cannot be told, or gives no token.
   */
  pushOn(): Promise<PushOn>;
  /** Keeps the phone's token with the account, in a language; noted as on if it was kept. */
  register(community: Community, locale: string): Promise<boolean>;
  /** Turns the notices off: noted, and the account forgets the phone. */
  pushOff(community: Community | null): Promise<void>;
  /** The phone, as the account knows it, while the notices are on; null otherwise. */
  target(): Promise<Target | null>;
  /**
   * Keeps the token with the account while the notices are on: at each start, and again for whoever signs in, for a new language of the game,
   * and for a new token from Expo. The channel the notices show in (Android) is named in the game's language. Returns how to stop.
   */
  follow(account: Account, community: () => Community | null, locale: string): () => void;
  /** Opens what a tap on a notice names (`open`, with the app's path): the tap that opened the app, and each one while it runs. Returns how to stop. */
  onTap(open: (path: string) => void): () => void;
}

/** The app's own scheme, which the server writes a phone's links in (`APP_LINK`). */
const SCHEME = 'theratrace://';
/** The screens a notice may open, each with what of its query it reads, and what that may be. */
const PAGES: Record<string, Record<string, RegExp>> = {
  challenge: {},
  play: {},
  room: { code: /^[A-Za-z0-9]{4,12}$/ },
  rankings: { tab: /^(all|week|friends|challenge)$/ },
};
/** Longer than any link the server sends. */
const LONGEST = 200;

/**
 * The path in the app a notice's link opens: the app's scheme, one of the screens a notice names, and only the query that screen reads, each
 * value as the server writes it. Null for anything else, which is not opened.
 */
export function pageOf(url: unknown): string | null {
  if (typeof url !== 'string' || url.length > LONGEST || !url.startsWith(SCHEME)) return null;
  const found = /^([a-z]+)\/?(?:\?([^#]*))?$/.exec(url.slice(SCHEME.length));
  if (found === null || !Object.hasOwn(PAGES, found[1])) return null;
  const page = found[1];
  const reads = PAGES[page];
  const kept: string[] = [];
  for (const pair of (found[2] ?? '').split('&')) {
    if (pair === '') continue;
    const [name, value = ''] = pair.split('=');
    if (!Object.hasOwn(reads, name)) continue;
    // Read as written: what the server writes needs no escape, and a value that does is not one of its.
    if (!reads[name].test(value)) return null;
    kept.push(`${name}=${value}`);
  }
  return kept.length > 0 ? `/${page}?${kept.join('&')}` : `/${page}`;
}

/** The Android channel the server's notices are shown in: Expo's own default, which a message with no channel goes to. */
const CHANNEL = 'default';
/** The name of the channel, as the player sees it in the phone's settings. */
const CHANNEL_WORDS = 'noticeChannel';

/** The game's Expo project, which Expo's tokens belong to: named in full, for Expo to write it into the build. Unset, there are no notices. */
const projectId = (): string => process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? '';

/** Whatever it is, never raised: a failure is the answer given. */
async function quietly<T>(work: () => Promise<T>, failed: T): Promise<T> {
  try {
    return await work();
  } catch {
    return failed;
  }
}

/** Who is signed in, for the token to follow: nobody, while offline. */
const whoIn = (account: Account): string | null => {
  const state = account.state();
  return state.kind === 'offline' ? null : state.userId;
};

/**
 * The game's notices on this phone, over the note the app keeps of them. `platform` is the phone's (a test's own, where it is not a phone).
 */
export function phonePush(note: PushNote, options: { platform?: string } = {}): Push {
  const platform = options.platform ?? Platform.OS;
  /** The language the channel is named in: the game's, as `follow` last heard it. */
  let speaking = 'en';
  /** The token Expo gave last, once asked. */
  let token: string | null = null;
  /** A question to the player under way: a second press waits for it, and asks nothing. */
  let asking: Promise<PushOn> | null = null;
  /** What the account was last told: the token, whose and in which language. Told the same again, nothing is sent. */
  let told: { token: string; userId: string | null; locale: string } | null = null;
  /** The taps opened already, by the notice's id: the tap that opened the app is heard again by the listener on Android. */
  const opened = new Set<string>();

  const available = (): boolean =>
    projectId() !== '' && (platform === 'ios' || platform === 'android') && Device.isDevice === true && String(Constants.executionEnvironment) !== 'storeClient';

  const allowed = (): Promise<boolean> => quietly(async () => (await Notifications.getPermissionsAsync()).status === 'granted', false);

  /** The channel, named in the language of the game: made before the player is asked, as Android 13 wants. Updated in place when it is there. */
  const channel = async (): Promise<void> => {
    if (platform !== 'android') return;
    await quietly(async () => {
      await Notifications.setNotificationChannelAsync(CHANNEL, { name: messagesFor(speaking).phone[CHANNEL_WORDS], importance: Notifications.AndroidImportance.DEFAULT });
    }, undefined);
  };

  /** The token Expo gives the phone (for a new device token, the one it turns into), or null where there is none. */
  const tokenFor = (devicePushToken?: Notifications.DevicePushToken): Promise<string | null> =>
    quietly(async () => {
      const given = await Notifications.getExpoPushTokenAsync(devicePushToken ? { projectId: projectId(), devicePushToken } : { projectId: projectId() });
      return typeof given.data === 'string' && given.data.startsWith('ExponentPushToken[') ? given.data : null;
    }, null);

  const ask = async (): Promise<PushOn> => {
    if (!available()) return 'unavailable';
    await channel();
    const now = await quietly(() => Notifications.getPermissionsAsync(), null);
    if (now === null) return 'unavailable';
    if (now.status !== 'granted') {
      // Asked once, ever: a no is the player's until they change it in the phone's settings.
      if (note.read() === 'refused' || !now.canAskAgain) {
        note.write('refused');
        return 'refused';
      }
      const answer = await quietly(() => Notifications.requestPermissionsAsync(), null);
      if (answer === null) return 'unavailable';
      if (answer.status !== 'granted') {
        note.write('refused');
        return 'refused';
      }
    }
    token = await tokenFor();
    return token === null ? 'unavailable' : 'on';
  };

  /** Tells the account of the phone, as `register` does, and remembers it was told. */
  const tell = async (community: Community, given: string, userId: string | null, locale: string): Promise<boolean> => {
    const kept = await quietly(() => community.notifyMe({ expo: given, platform: platform === 'android' ? 'android' : 'ios' }, locale), false);
    if (kept) told = { token: given, userId, locale };
    return kept;
  };

  /** The token as the account should have it now, where the notices are on and the phone still allows them. */
  const current = async (): Promise<string | null> => {
    if (!available() || note.read() !== 'on' || !(await allowed())) return null;
    token ??= await tokenFor();
    return token;
  };

  return {
    available,
    isOn: async () => (await current()) !== null,
    pushOn: () => {
      asking ??= ask().finally(() => {
        asking = null;
      });
      return asking;
    },
    register: async (community, locale) => {
      if (token === null) return false;
      const kept = await tell(community, token, null, locale);
      if (kept) note.write('on');
      return kept;
    },
    pushOff: async (community) => {
      note.write('off');
      told = null;
      const was = token ?? (available() && (await allowed()) ? await tokenFor() : null);
      if (was !== null && community !== null) await quietly(() => community.stopNotifying({ expo: was }), false);
    },
    target: async () => {
      const now = await current();
      return now === null ? null : { expo: now };
    },
    follow: (account, community, locale) => {
      speaking = locale;
      if (!available()) return () => undefined;
      let live = true;
      void channel();
      /** Tells the account again, where what it was told is not what is so now. */
      const keep = async () => {
        const userId = whoIn(account);
        const asked = community();
        if (userId === null || asked === null) return;
        const now = await current();
        if (!live || now === null) return;
        if (told !== null && told.token === now && told.userId === userId && told.locale === locale) return;
        await tell(asked, now, userId, locale);
      };
      void keep();
      const stopAccount = account.subscribe(() => void keep());
      // Expo may give the phone a new token (a new device token): the account is given it, with the market's choice of the old one, and forgets the old.
      const changed = Notifications.addPushTokenListener((device) => {
        void (async () => {
          const userId = whoIn(account);
          const asked = community();
          if (!live || userId === null || asked === null || note.read() !== 'on') return;
          const was = token;
          const given = await tokenFor(device);
          if (!live || given === null || given === was) return;
          token = given;
          if (!(await tell(asked, given, userId, locale)) || was === null) return;
          if ((await quietly(() => asked.marketNotice({ expo: was }), null)) === true) await quietly(() => asked.setMarketNotice({ expo: given }, true), false);
          await quietly(() => asked.stopNotifying({ expo: was }), false);
        })();
      });
      return () => {
        live = false;
        stopAccount();
        changed.remove();
      };
    },
    onTap: (open) => {
      if (!available()) return () => undefined;
      let live = true;
      const heard = (response: Notifications.NotificationResponse | null) => {
        const request = response?.notification?.request;
        if (!live || !request || opened.has(request.identifier)) return;
        opened.add(request.identifier);
        const path = pageOf(request.content?.data?.url);
        if (path !== null) open(path);
      };
      // The tap that opened the app, read once it is drawn (a cold start).
      void quietly(async () => heard(await Notifications.getLastNotificationResponseAsync()), undefined);
      const tapped = Notifications.addNotificationResponseReceivedListener((response) => {
        try {
          heard(response);
        } catch {
          // A notice the app cannot read opens nothing.
        }
      });
      return () => {
        live = false;
        tapped.remove();
      };
    },
  };
}
