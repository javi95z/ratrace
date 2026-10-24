// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { useContext } from 'react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import PlayRoute from '../app/[locale]/play';
import RecordsRoute from '../app/[locale]/records';
import { kvLanguage } from '../kvStore';
import type { Account, AccountState, Community } from '@ratrace/online/types';
import { pathname, routeMoved } from '../testing/fakes';
import { device, memoryServices, params, renderGame, router } from '../testing/render';
import { Language } from '../ui/text';
import { useSettings } from './context';
import { LanguagePick } from './screens/Settings';

/*
 * On the web the language of a page is its address's (`/es/play`), as the Next web's: the cookie the site keeps (NEXT_LOCALE) only chooses where `/`
 * leads. A language chosen in the settings is the same page in that language, the cookie written for the next visit.
 */

const cookie = () => document.cookie.split('; ').find((part) => part.startsWith('NEXT_LOCALE='))?.slice('NEXT_LOCALE='.length) ?? null;

beforeEach(() => {
  document.cookie = 'NEXT_LOCALE=; path=/; max-age=0';
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});
afterEach(cleanup);

/** The language the page is drawn in, as the kit's text reads it. */
function Speaks() {
  return <p data-testid="speaks">{useContext(Language)}</p>;
}

test('a page at /es/play draws in Spanish, whatever the cookie and the browser say', () => {
  document.cookie = 'NEXT_LOCALE=en; path=/';
  device.languages = ['ru'];
  params.locale = 'es';
  pathname.now = '/es/play';
  renderGame(
    <>
      <PlayRoute />
      <Speaks />
    </>,
    { ...memoryServices(), language: kvLanguage },
  );
  expect(screen.getByTestId('speaks').textContent).toBe('es');
  cleanup();
  pathname.now = '/es/records';
  renderGame(<RecordsRoute />, { ...memoryServices(), language: kvLanguage });
  expect(screen.getByRole('heading', { name: 'Historial' })).toBeTruthy();
  // The page opened in a language is the language the site remembers, as the Next web's middleware writes it for each page.
  expect(cookie()).toBe('es');
});

test('outside the pages of a language, the language is the cookie\'s, else the browser\'s, else English', () => {
  device.languages = ['ru', 'en'];
  renderGame(<Speaks />, { ...memoryServices(), language: kvLanguage });
  expect(screen.getByTestId('speaks').textContent).toBe('ru');
  cleanup();
  document.cookie = 'NEXT_LOCALE=es; path=/';
  renderGame(<Speaks />, { ...memoryServices(), language: kvLanguage });
  expect(screen.getByTestId('speaks').textContent).toBe('es');
  cleanup();
  document.cookie = 'NEXT_LOCALE=; path=/; max-age=0';
  device.languages = ['de'];
  renderGame(<Speaks />, { ...memoryServices(), language: kvLanguage });
  expect(screen.getByTestId('speaks').textContent).toBe('en');
});

test('a language chosen in the settings opens the same page in it, and the cookie keeps it', () => {
  params.locale = 'en';
  pathname.now = '/en/rankings';
  renderGame(<LanguagePick />, { ...memoryServices(), language: kvLanguage });
  act(() => fireEvent.click(screen.getByRole('radio', { name: 'Español' })));
  expect(router.push).toHaveBeenCalledWith('/es/rankings');
  expect(cookie()).toBe('es');
  router.push.mockClear();
  // The language of the address (still English here: the router stands in) opens nothing.
  act(() => fireEvent.click(screen.getByRole('radio', { name: 'English' })));
  expect(router.push).not.toHaveBeenCalled();
  cleanup();
  // The front door in Russian is /ru.
  pathname.now = '/en';
  renderGame(<LanguagePick />, { ...memoryServices(), language: kvLanguage });
  act(() => fireEvent.click(screen.getByRole('radio', { name: 'Русский' })));
  expect(router.push).toHaveBeenCalledWith('/ru');
});

test('the language\'s setter keeps its identity from page to page, and nothing that reads the settings is drawn again as the player moves', () => {
  params.locale = 'en';
  pathname.now = '/en/records';
  const held: Array<(next: 'en' | 'es' | 'ru') => void> = [];
  function Reads() {
    held.push(useSettings().setLocale);
    return null;
  }
  renderGame(<Reads />, { ...memoryServices(), language: kvLanguage });
  const drawn = held.length;
  act(() => {
    pathname.now = '/en/rankings';
    routeMoved();
  });
  act(() => {
    pathname.now = '/en/collection';
    routeMoved();
  });
  expect(held.length).toBe(drawn);
  expect(new Set(held).size).toBe(1);
  // And it still opens the page the player is on now, in the language chosen.
  act(() => held[0]('ru'));
  expect(router.push).toHaveBeenCalledWith('/ru/collection');
});

/** A member signing in on a browser that last showed a guest, whose account keeps `language`, told when `answer` is called. */
function memberWith(language: string) {
  let answer: () => void = () => undefined;
  const asked = new Promise<void>((resolve) => {
    answer = resolve;
  });
  const state: AccountState = { kind: 'member', userId: 'member-1', email: null };
  const account = {
    state: () => state,
    subscribe: () => () => undefined,
    start: async () => undefined,
    keepWithGoogle: async () => true,
    useExistingAccount: async () => true,
    dismissNotice: () => undefined,
    signOut: async () => true,
  } as unknown as Account;
  const community = { me: async () => (await asked, { language }) } as unknown as Community;
  return { account, community, answer: () => answer() };
}

test('the account\'s language, answered after the player has moved on, puts the page they are on now in it, in place of it, its query and hash kept', async () => {
  localStorage.setItem('ratrace.lastAccount', 'guest-1');
  params.locale = 'en';
  pathname.now = '/en/records';
  window.history.replaceState(null, '', '/en/records');
  const member = memberWith('es');
  renderGame(<Speaks />, { ...memoryServices(), language: kvLanguage, account: member.account, community: () => member.community });
  // The player moves on before the account answers.
  act(() => {
    window.history.pushState(null, '', '/en/room?code=ABC123#x');
    pathname.now = '/en/room';
    routeMoved();
  });
  const pages = window.history.length;
  await act(async () => {
    member.answer();
    await Promise.resolve();
  });
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/es/room?code=ABC123#x'));
  // In place of the page: Back does not lead to the language the account left.
  expect(router.push).not.toHaveBeenCalled();
  expect(window.history.length).toBe(pages);
  expect(cookie()).toBe('es');
  expect(localStorage.getItem('ratrace.lastAccount')).toBe('member-1');
});
