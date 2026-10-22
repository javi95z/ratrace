import { CONTENT_VERSION } from '@ratrace/content';
import { ENGINE_VERSION } from '@ratrace/engine';
import { buildOf, errorWatch, watchPage } from '@ratrace/online/errors';
import type { ErrorWatch } from '@ratrace/online/errors';
import Constants from 'expo-constants';
import { usePathname } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import type { Online } from './index';

/*
 * The phone's errors, watched and sent as the web's page's are (the web's `watchErrors`, apps/web/src/online/index.ts; `docs/errors.md`): each
 * kind once, cleaned of anything that could say who the player is, as whoever is signed in. The watch and its cleaning are the package's own
 * (`errorWatch`, `watchPage`); what is the phone's is where it hears them, since React Native has no page with `error` and `unhandledrejection`
 * events: an error nobody caught reaches React Native's global handler (`ErrorUtils`), and a promise nobody handled is told by Hermes' rejection
 * tracker (`HermesInternal.enablePromiseRejectionTracker`, which React Native itself turns on only in development, for its own warnings).
 */

type Handler = (error: unknown, isFatal?: boolean) => void;

/** React Native's `ErrorUtils`: the one handler of every error nobody caught. */
export interface Uncaught {
  getGlobalHandler(): Handler;
  setGlobalHandler(handler: Handler): void;
}

/** Hermes' tracker of promises nobody handled, where the phone's JavaScript has one. */
export interface Rejections {
  enablePromiseRejectionTracker?(options: { allRejections: boolean; onUnhandled(id: number, reason: unknown): void; onHandled(id: number): void }): void;
}

/** The phone's log, of which the watch hears what is written as an error. */
interface Log {
  error(...args: unknown[]): void;
}

/** What the watch hears the phone through, and tells the time with. The phone's own in the app (`phoneErrors`); a test's in a test. */
export interface AppErrorParts {
  uncaught: Uncaught;
  rejections: Rejections | undefined;
  log: Log;
  schedule(run: () => void, ms: number): void;
  /** The path of the screen in front, as the router says it. */
  place(): string;
}

/** The path of the screen in front, as `usePlace` last heard it. */
let here = '/';
/** The path of the screen in front, for an error report: the router's, which only a component can read (`usePlace`). */
export const place = (): string => here;

/** Keeps the path of the screen in front for the error reports. Called once, by the game's provider (game/context.tsx), round every screen. */
export function usePlace(): void {
  const path = usePathname();
  useEffect(() => {
    here = path;
  }, [path]);
}

/** The build, by the game's versions and the app's own (app.json's `version`): '12/34 app 1.0.0'. */
export const appBuild = (version: string | undefined): string => [buildOf(ENGINE_VERSION, CONTENT_VERSION, undefined), 'app', version].filter(Boolean).join(' ');

const SYSTEMS: Record<string, string> = { ios: 'iOS', android: 'Android' };
/** The app, its system by name and major version (Android's is its API level), nothing finer: 'app iOS 18'. A browser's would be 'Safari 18 iOS'. */
export const appBrowser = (os: string, version: string | number | undefined): string =>
  ['app', SYSTEMS[os] ?? os, version === undefined ? undefined : String(version).split('.')[0]].filter(Boolean).join(' ');

/**
 * The phone's two kinds of uncaught error, as the events of a page, for the package's `watchPage` to hear as it hears a browser's: an error
 * nobody caught is an `error` with it, a promise nobody handled an `unhandledrejection` with its reason. The handler that was in place before is
 * still called with every error, after the watch has heard it (it shows the error in development, and ends the app on a fatal one); an error that
 * ends the app is sent at once, before it does. Returns how to stop, which puts the handler back.
 */
function hearApp(watch: Pick<ErrorWatch, 'report' | 'flush'>, parts: Pick<AppErrorParts, 'uncaught' | 'rejections' | 'log'>): () => void {
  const listeners = new Map<string, Set<(event: Event) => void>>();
  const page = {
    addEventListener: (type: string, listener: (event: Event) => void) => void (listeners.get(type) ?? listeners.set(type, new Set()).get(type))?.add(listener),
    removeEventListener: (type: string, listener: (event: Event) => void) => void listeners.get(type)?.delete(listener),
    dispatchEvent: () => true,
  } as unknown as EventTarget;
  const tell = (type: string, event: object) => {
    for (const listener of listeners.get(type) ?? []) listener(event as Event);
  };

  const stopHearing = watchPage(watch, page, parts.log);
  let stopped = false;
  const before = parts.uncaught.getGlobalHandler();
  const handler: Handler = (error, isFatal) => {
    try {
      if (!stopped) {
        tell('error', { error });
        if (isFatal) void watch.flush().catch(() => undefined);
      }
    } catch {
      // The watch is for the game's errors: one of its own never keeps the error from the app's handler.
    }
    before(error, isFatal);
  };
  parts.uncaught.setGlobalHandler(handler);
  parts.rejections?.enablePromiseRejectionTracker?.({
    allRejections: true,
    onUnhandled: (_id, reason) => {
      if (!stopped) tell('unhandledrejection', { reason });
    },
    onHandled: () => undefined,
  });
  return () => {
    stopped = true;
    stopHearing();
    if (parts.uncaught.getGlobalHandler() === handler) parts.uncaught.setGlobalHandler(before);
  };
}

/**
 * Watches what goes wrong on the phone and sends it, cleaned, as whoever is signed in: at once if someone is, and as soon as someone is if nobody
 * is yet. The place is the screen's, as `app:<path>` (`app:/play`), which the server keeps apart from the web's pages. Returns how to stop.
 */
export function watchErrors(online: Pick<Online, 'account' | 'reportErrors'>, parts: AppErrorParts): () => void {
  const watch = errorWatch({
    send: online.reportErrors,
    place: () => `app:${parts.place()}`,
    build: appBuild(Constants.expoConfig?.version),
    browser: appBrowser(Platform.OS, Platform.Version),
    schedule: parts.schedule,
  });
  const stopHearing = hearApp(watch, parts);
  const stopFollowing = online.account.subscribe(() => void watch.flush());
  return () => {
    stopHearing();
    stopFollowing();
  };
}

/** The phone's own: React Native's `ErrorUtils`, Hermes' tracker where it is there, the console, the timers, and the router's screen. */
export function phoneErrors(): AppErrorParts {
  const g = globalThis as { ErrorUtils?: Uncaught; HermesInternal?: Rejections };
  if (g.ErrorUtils === undefined) throw new Error('no ErrorUtils: not React Native');
  return { uncaught: g.ErrorUtils, rejections: g.HermesInternal, log: console, schedule: (run, ms) => void setTimeout(run, ms), place };
}
