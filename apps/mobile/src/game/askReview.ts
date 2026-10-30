import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { askForReview, type ReviewMemory, type ReviewStore } from './reviewTimes';

/*
 * The store's own prompt to rate the game (expo-store-review: SKStoreReviewController on iOS, Google Play's in-app review), asked at the times
 * `reviewTimes.ts` allows, in a build for players only: never in development, nor in Expo Go, which has no such module, nor on the web
 * (`askReview.web.ts`). The library is loaded only when it is asked, and only there.
 */

/** The library, loaded once and only where it is there. Null anywhere else, or should it fail to load. */
let library: Promise<ReviewStore | null> | null = null;
const storeReview = (): Promise<ReviewStore | null> =>
  (library ??=
    (Platform.OS === 'ios' || Platform.OS === 'android') && String(Constants.executionEnvironment) !== 'storeClient'
      ? import('expo-store-review').then(
          (loaded) => loaded,
          () => null,
        )
      : Promise.resolve(null));

/** True in a release build: `__DEV__` is written in as `false` there. A test, which has no `__DEV__`, is development (online/track.ts). */
const isRelease = (): boolean => typeof __DEV__ !== 'undefined' && !__DEV__;

/** Asks for a rating where the game may, remembered in `memory` (the phone's, kvStore.ts). Never waits on it, never fails. */
export function askReview(memory: ReviewMemory): void {
  void askForReview({ store: storeReview, memory, now: Date.now, release: isRelease() });
}
