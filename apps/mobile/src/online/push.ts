import { messagesFor } from '@ratrace/i18n';
import type { Account, Community, PushTarget } from '@ratrace/online/types';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import type * as NotificationsModule from 'expo-notifications';
import { Platform } from 'react-native';
import type { Page } from '../game/pages';

/*
 * The game's notices on the phone: the web's push subscription (apps/web/src/pwa/notifications.ts), through Expo's push service. The player is
 * asked once, the token Expo gives the phone is kept with the account in the language of the game (`Community.notifyMe`, the server's
 * `claim_push_token`), and kept again as the token, the account or the language changes. A tap on a notice opens the screen it names
 * (`theratrace://<page>`, `supabase/functions/_shared/notice.ts`), and nothing but the app's own screens. The only file of the app that names
 * expo-notifications (architecture.test.ts).
 *
 * Nothing of it is there where the phone cannot be told: a build with no Expo project (until the game has one), a simulator, Expo Go (which has no
 * remote notices) or anything but a phone. There the library is not even loaded: it is loaded late (`notifications()`), only once the phone is known
 * to be one that can be told, so Expo Go's warning about it never shows (nor in a scene's shot). Nothing in it throws: what the phone or the account
 * cannot do is answered, never raised.
 */

type Notifications = typeof NotificationsModule;

/** What the switch came to: on, refused by the player (now or before), or not to be had on this phone. */
export type PushOn = 'on' | 'refused' | 'unavailable';

/**
 * What the app remembers of the notices, on the phone: turned on, turned off, or refused by the player (never asked again); and the token the account
 * was last given, to be forgotten by it (turned off, offline at start) and replaced (a new token while the app was closed).
 */
export interface PushNoted {
  state: 'on' | 'off' | 'refused';
  token: string | null;
}

/** Where the app keeps that: the phone's store, handed in by the game's context (`kvPush`), which is the only one to name it. */
export interface PushNote {
  read(): PushNoted | null;
  write(noted: PushNoted): void;
}

/** The phone, as the server knows it (its token; on the web, `push.web.ts`, the browser's address). */
type Target = PushTarget;

export interface Push {
  /** True where the phone can be told at all. False, there is no switch to show, and the library is never loaded. */
  available(): boolean;
  /** Whether the notices are on here: turned on, and still allowed by the phone. Asks nothing of the network. */
  isOn(): Promise<boolean>;
  /**
   * Asks the player (once, ever: a refusal is remembered), then the phone for its token. `refused` without asking where they said no before, or
   * the phone will not ask; `unavailable` where the phone cannot be told, or gives no token.
   */
  pushOn(): Promise<PushOn>;
  /** Keeps the phone's token with the account, in a language; noted as on if it was kept. */
  register(community: Community, locale: string): Promise<boolean>;
  /** Turns the notices off. True once the account has forgotten the phone (and only then is it noted off); false, they still come. */
  pushOff(community: Community): Promise<boolean>;
  /**
   * Takes the phone from the account about to be signed out of (`useAccount().signOut`), at most `patience` ms, never failing: the notices stay on,
   * for whoever signs in next. `resume` gives it back, where the sign-out did not happen after all.
   */
  release(community: Community | null, patience?: number): Promise<void>;
  resume(): void;
  /** The phone, as the account knows it, while the notices are on; null otherwise. */
  target(): Promise<Target | null>;
  /**
   * Keeps the token with the account while the notices are on: once at each start, and again for whoever else signs in, for a new language of the
   * game, and for a new token from Expo. The channel the notices show in (Android) is named in the game's language. Returns how to stop.
   */
  follow(account: Account, community: () => Community | null, locale: string): () => void;
  /** Opens what a tap on a notice names (`open`, with the page and its query): the tap that opened the app, and each one while it runs. Returns how to stop. */
  onTap(open: (to: NoticePage) => void): () => void;
}

/** A page a notice opens, and the query it opens it with: opened in the language of the address in front (`game/pages.ts`). */
export interface NoticePage {
  page: Page;
  query: Record<string, string>;
}

/** The app's own scheme, which the server writes a phone's links in (`APP_LINK`). */
const SCHEME = 'theratrace://';
/** The screens a notice may open, each with what of its query it reads, and what that may be. */
const PAGES: Partial<Record<Page, Record<string, RegExp>>> = {
  challenge: {},
  play: {},
  // A room's code: six letters and digits (Room.tsx's `codeOf`).
  room: { code: /^[A-Za-z0-9]{6}$/ },
  rankings: { tab: /^(all|week|friends|challenge)$/ },
};
/** Longer than any link the server sends. */
const LONGEST = 200;

/**
 * The page a notice's link opens: the app's scheme, one of the screens a notice names, and only the query that screen reads (each name once, the first
 * as written), each value as the server writes it. Null for anything else, which is not opened.
 */
export function pageOf(url: unknown): NoticePage | null {
  if (typeof url !== 'string' || url.length > LONGEST || !url.startsWith(SCHEME)) return null;
  const found = /^([a-z]+)\/?(?:\?([^#]*))?$/.exec(url.slice(SCHEME.length));
  if (found === null || !Object.hasOwn(PAGES, found[1])) return null;
  const page = found[1] as Page;
  const reads = PAGES[page] ?? {};
  const kept = new Map<string, string>();
  for (const pair of (found[2] ?? '').split('&')) {
    if (pair === '') continue;
    const [name, value = ''] = pair.split('=');
    if (!Object.hasOwn(reads, name) || kept.has(name)) continue;
    // Read as written: what the server writes needs no escape, and a value that does is not one of its.
    if (!reads[name].test(value)) return null;
    kept.set(name, value);
  }
  return { page, query: Object.fromEntries(kept) };
}

/** The Android channel the server's notices are shown in: Expo's own default, which a message with no channel goes to. */
const CHANNEL = 'default';
/** The name of the channel, as the player sees it in the phone's settings. */
const CHANNEL_WORDS = 'noticeChannel';

/**
 * The game's Expo project, which Expo's tokens belong to: the build's (named in full, for Expo to write it into the build), or the one `eas init`
 * writes into app.json, so the two never disagree. Neither, and there are no notices.
 */
const projectId = (): string => {
  const fromEas = (Constants.expoConfig?.extra as { eas?: { projectId?: unknown } } | undefined)?.eas?.projectId;
  return process.env.EXPO_PUBLIC_EAS_PROJECT_ID || (typeof fromEas === 'string' ? fromEas : '');
};

/** The library, loaded the first time the phone is known to be one that can be told; never before, never where it cannot. */
let library: Promise<Notifications> | null = null;
const notifications = (): Promise<Notifications> => (library ??= import('expo-notifications'));

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
  const kind = platform === 'android' ? 'android' : 'ios';
  /** The language the channel is named in: the game's, as `follow` last heard it. */
  let speaking = 'en';
  /** The token Expo gave in this start of the app, once asked (one question at a time). */
  let token: string | null = null;
  let fetching: Promise<string | null> | null = null;
  /** A question to the player under way: a second press waits for it, and asks nothing. */
  let asking: Promise<PushOn> | null = null;
  /** What the account was last told, or is being told: the token, whose and in which language. The same again is not sent. */
  let told: { token: string; userId: string | null; locale: string } | null = null;
  /** Keeps the token with the account, as the latest `follow` does: for `resume`. And the account it follows, for whose the token is. */
  let again: (() => void) | null = null;
  let following: Account | null = null;
  /**
   * The player's last word wins: each "off" is a new intent, and a claim begun before it (a start's, in flight) neither notes the notices on again
   * when it lands, nor is left to land after the account forgot the phone (the "off" waits for it). One "off" at a time: a second joins the one under
   * way, and while it is, nothing is claimed.
   */
  let intent = 0;
  let claiming: Promise<boolean> | null = null;
  let stopping: Promise<boolean> | null = null;
  /** The taps opened already, by the notice's id: the tap that opened the app is heard again by the listener on Android. */
  const opened = new Set<string>();

  const noted = (): PushNoted => note.read() ?? { state: 'off', token: null };
  const on = (): boolean => noted().state === 'on';

  const available = (): boolean =>
    projectId() !== '' && (platform === 'ios' || platform === 'android') && Device.isDevice === true && String(Constants.executionEnvironment) !== 'storeClient';

  const allowed = (): Promise<boolean> => quietly(async () => (await (await notifications()).getPermissionsAsync()).status === 'granted', false);

  /** The channel, named in the language of the game: made before the player is asked, as Android 13 wants. Updated in place when it is there. */
  const channel = async (): Promise<void> => {
    if (platform !== 'android') return;
    await quietly(async () => {
      const library = await notifications();
      await library.setNotificationChannelAsync(CHANNEL, { name: messagesFor(speaking).phone[CHANNEL_WORDS], importance: library.AndroidImportance.DEFAULT });
    }, undefined);
  };

  /** The token Expo gives the phone (for a new device token, the one it turns into), or null where there is none. */
  const tokenFor = (devicePushToken?: NotificationsModule.DevicePushToken): Promise<string | null> =>
    quietly(async () => {
      const library = await notifications();
      const given = await library.getExpoPushTokenAsync(devicePushToken ? { projectId: projectId(), devicePushToken } : { projectId: projectId() });
      return typeof given.data === 'string' && given.data.startsWith('ExponentPushToken[') ? given.data : null;
    }, null);

  /** The phone's token in this start of the app: asked of Expo once, however many ask for it together. */
  const fresh = (): Promise<string | null> => {
    if (token !== null) return Promise.resolve(token);
    fetching ??= tokenFor().then((given) => {
      fetching = null;
      if (given !== null) token = given;
      return given;
    });
    return fetching;
  };

  const ask = async (): Promise<PushOn> => {
    if (!available()) return 'unavailable';
    await channel();
    const now = await quietly(async () => (await notifications()).getPermissionsAsync(), null);
    if (now === null) return 'unavailable';
    if (now.status !== 'granted') {
      // Asked once, ever: a no is the player's until they change it in the phone's settings.
      if (noted().state === 'refused' || !now.canAskAgain) {
        note.write({ ...noted(), state: 'refused' });
        return 'refused';
      }
      const answer = await quietly(async () => (await notifications()).requestPermissionsAsync(), null);
      if (answer === null) return 'unavailable';
      if (answer.status !== 'granted') {
        note.write({ ...noted(), state: 'refused' });
        return 'refused';
      }
    }
    return (await fresh()) === null ? 'unavailable' : 'on';
  };

  /**
   * Tells the account of the phone's token, for whoever is signed in, in a language: once, however many ask together (what it is being told is
   * held as told while it is told, and let go if it was not kept). A token the account had before, under another (a new one from Expo), is replaced:
   * its market's choice goes to the new one, and the account forgets the old.
   */
  const tell = async (community: Community, given: string, userId: string | null, locale: string): Promise<boolean> => {
    if (told !== null && told.token === given && told.userId === userId && told.locale === locale) return true;
    if (stopping !== null) return false;
    const mine = intent;
    const before = told;
    told = { token: given, userId, locale };
    const claim = quietly(() => community.notifyMe({ expo: given, platform: kind }, locale), false);
    claiming = claim;
    const kept = (await claim) && intent === mine;
    if (claiming === claim) claiming = null;
    if (!kept) {
      if (told?.token === given && told.userId === userId && told.locale === locale) told = before;
      return false;
    }
    const old = noted().token;
    note.write({ state: 'on', token: given });
    if (old !== null && old !== given) {
      if ((await quietly(() => community.marketNotice({ expo: old }), null)) === true) await quietly(() => community.setMarketNotice({ expo: given }, true), false);
      await quietly(() => community.stopNotifying({ expo: old }), false);
    }
    return true;
  };

  return {
    available,
    isOn: async () => available() && on() && (await allowed()),
    pushOn: () => {
      asking ??= ask().finally(() => {
        asking = null;
      });
      return asking;
    },
    register: async (community, locale) => (token === null ? false : tell(community, token, following ? whoIn(following) : null, locale)),
    pushOff: (community) => {
      if (stopping !== null) return stopping;
      intent += 1;
      const off = (async () => {
        // A claim in flight lands first: the account forgets the phone after it, never before.
        if (claiming !== null) await claiming;
        // The token the account has: the one it was last given, or this phone's own.
        const held = noted().token ?? token ?? (available() && (await allowed()) ? await fresh() : null);
        if (held !== null && !(await quietly(() => community.stopNotifying({ expo: held }), false))) return false;
        told = null;
        note.write({ state: 'off', token: null });
        return true;
      })().finally(() => {
        if (stopping === off) stopping = null;
      });
      stopping = off;
      return off;
    },
    release: async (community, patience = 5_000) => {
      const held = noted().token;
      told = null;
      if (!available() || !on() || held === null || community === null) return;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const late = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, patience);
      });
      await Promise.race([quietly(() => community.stopNotifying({ expo: held }), false), late]);
      clearTimeout(timer);
    },
    resume: () => again?.(),
    target: async () => {
      if (!(available() && on() && (await allowed()))) return null;
      const now = noted().token ?? (await fresh());
      return now === null ? null : { expo: now };
    },
    follow: (account, community, locale) => {
      speaking = locale;
      following = account;
      if (!available()) return () => undefined;
      let live = true;
      void channel();
      /** Tells the account again, where what it was told is not what is so now: never more than once for the same. */
      const keep = async () => {
        const userId = whoIn(account);
        const asked = community();
        if (!live || userId === null || asked === null || !on() || !(await allowed())) return;
        const now = await fresh();
        if (!live || now === null) return;
        await tell(asked, now, userId, locale);
      };
      again = () => void keep();
      void keep();
      const stopAccount = account.subscribe(() => void keep());
      // Expo may give the phone a new token (a new device token): the account is given it. The first token of a start is `keep`'s own.
      let stopToken: (() => void) | null = null;
      void quietly(async () => {
        const library = await notifications();
        if (!live) return;
        const listening = library.addPushTokenListener((device) => {
          void (async () => {
            const userId = whoIn(account);
            const asked = community();
            if (!live || told === null || userId === null || asked === null || !on()) return;
            const given = await tokenFor(device);
            if (!live || given === null || given === token) return;
            token = given;
            await tell(asked, given, userId, locale);
          })();
        });
        stopToken = () => listening.remove();
      }, undefined);
      return () => {
        live = false;
        stopAccount();
        stopToken?.();
      };
    },
    onTap: (open) => {
      if (!available()) return () => undefined;
      let live = true;
      let stopTaps: (() => void) | null = null;
      const heard = (library: Notifications, response: NotificationsModule.NotificationResponse | null, first: boolean) => {
        const request = response?.notification?.request;
        if (!live || !request || opened.has(request.identifier)) return;
        opened.add(request.identifier);
        // The tap that opened the app is had: a reload of the app does not open it again.
        if (first) library.clearLastNotificationResponse();
        const to = pageOf(request.content?.data?.url);
        if (to !== null) open(to);
      };
      void quietly(async () => {
        const library = await notifications();
        if (!live) return;
        // The tap that opened the app (a cold start), once the game is drawn.
        heard(library, library.getLastNotificationResponse(), true);
        const tapped = library.addNotificationResponseReceivedListener((response) => {
          try {
            heard(library, response, false);
          } catch {
            // A notice the app cannot read opens nothing.
          }
        });
        stopTaps = () => tapped.remove();
      }, undefined);
      return () => {
        live = false;
        stopTaps?.();
      };
    },
  };
}
