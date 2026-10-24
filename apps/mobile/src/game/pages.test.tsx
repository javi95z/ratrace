// @vitest-environment jsdom
import { act, cleanup } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { redirectSystemPath } from '../app/+native-intent';
import { device, kv, memoryServices, params, renderGame, router } from '../testing/render';
import { hrefOf, pageAt, useGo, type Go } from './pages';

afterEach(cleanup);

describe('the address of a page', () => {
  it('is the Next web\'s: the language first, then the page, its query and its hash', () => {
    expect(hrefOf('room', { query: { code: 'ABC123' }, locale: 'es' })).toBe('/es/room?code=ABC123');
    expect(hrefOf('', { locale: 'ru' })).toBe('/ru');
    expect(hrefOf('rankings', { hash: 'friends', locale: 'en' })).toBe('/en/rankings#friends');
    expect(hrefOf('rankings', { query: { tab: 'challenge' }, locale: 'en' })).toBe('/en/rankings?tab=challenge');
    expect(hrefOf('play', { locale: 'es' })).toBe('/es/play');
    // A value is written as an address carries it.
    expect(hrefOf('room', { query: { code: 'a b&c' }, locale: 'en' })).toBe('/en/room?code=a%20b%26c');
    // With no language named, English, as the web falls back to.
    expect(hrefOf('new')).toBe('/en/new');
  });

  it('is read back from the router\'s path: the page under the language, or nothing for a path outside them', () => {
    expect(pageAt('/es/room')).toBe('room');
    expect(pageAt('/en')).toBe('');
    expect(pageAt('/ru/rankings')).toBe('rankings');
    expect(pageAt('/scene')).toBeNull();
    expect(pageAt('/')).toBeNull();
    expect(pageAt('/de/play')).toBeNull();
    expect(pageAt('/en/nowhere')).toBeNull();
  });
});

describe('the way from page to page', () => {
  let go: Go | null = null;
  function Hold() {
    const now = useGo();
    useEffect(() => {
      go = now;
    }, [now]);
    return null;
  }

  it('goes to the page in the language of the address the player is on', () => {
    params.locale = 'es';
    renderGame(<Hold />, memoryServices());
    act(() => go?.push('new'));
    expect(router.push).toHaveBeenLastCalledWith('/es/new');
    act(() => go?.push('room', { query: { code: 'K7Q2XM' } }));
    expect(router.push).toHaveBeenLastCalledWith('/es/room?code=K7Q2XM');
    act(() => go?.replace('play'));
    expect(router.replace).toHaveBeenLastCalledWith('/es/play');
    // Home is the front page of that language, the screens over it dismissed (the kit's rule: `dismissTo`, never a second front page).
    act(() => go?.home());
    expect(router.dismissTo).toHaveBeenLastCalledWith('/es');
  });

  it('outside the pages of a language (a development route), goes in the language of the game', () => {
    renderGame(<Hold />, memoryServices(), 'ru');
    act(() => go?.push('records'));
    expect(router.push).toHaveBeenLastCalledWith('/ru/records');
    act(() => go?.home());
    expect(router.dismissTo).toHaveBeenLastCalledWith('/ru');
  });
});

describe('the phone\'s own links (`+native-intent`)', () => {
  it('opens a page of the game in the phone\'s language: the one the player chose, else the phone\'s', () => {
    expect(redirectSystemPath({ path: 'theratrace://room?code=ABC123', initial: true })).toBe('/en/room?code=ABC123');
    device.languages = ['es', 'en'];
    expect(redirectSystemPath({ path: 'theratrace://room?code=ABC123', initial: false })).toBe('/es/room?code=ABC123');
    kv.set('ratrace:locale', 'ru');
    expect(redirectSystemPath({ path: 'theratrace://challenge', initial: false })).toBe('/ru/challenge');
  });

  it('keeps the query and the hash a link carries: a notice of a friend request opens the friends', () => {
    expect(redirectSystemPath({ path: 'theratrace://rankings#friends', initial: true })).toBe('/en/rankings#friends');
    expect(redirectSystemPath({ path: 'theratrace://rankings?tab=friends', initial: true })).toBe('/en/rankings?tab=friends');
    expect(redirectSystemPath({ path: 'theratrace://room/?code=ABC123', initial: true })).toBe('/en/room?code=ABC123');
    expect(redirectSystemPath({ path: 'theratrace://play', initial: false })).toBe('/en/play');
  });

  it('opens the front page for the app\'s bare address, and in Expo Go, its own address of a page', () => {
    expect(redirectSystemPath({ path: 'theratrace://', initial: true })).toBe('/en');
    expect(redirectSystemPath({ path: 'exp://127.0.0.1:8090/--/room?code=ABC123', initial: false })).toBe('/en/room?code=ABC123');
    expect(redirectSystemPath({ path: 'exp://127.0.0.1:8090/--/rankings#friends', initial: false })).toBe('/en/rankings#friends');
  });

  it('leaves alone what is not a page of the game: Google\'s way back, the development routes, a page already in a language, anything else', () => {
    for (const path of ['theratrace://auth', 'theratrace://auth?code=c0de&state=x', 'theratrace:///perf?life=moment-escape', 'theratrace://scene?name=home', 'theratrace://kit', 'theratrace://dev', '/es/play', 'theratrace://es/room?code=ABC123', 'theratrace://nowhere', 'exp://127.0.0.1:8090']) {
      expect(redirectSystemPath({ path, initial: false }), path).toBe(path);
    }
  });
});
