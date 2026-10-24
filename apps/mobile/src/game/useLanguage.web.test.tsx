// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { useContext, useState } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import PlayRoute from '../app/[locale]/play';
import RecordsRoute from '../app/[locale]/records';
import { kvLanguage } from '../kvStore';
import type { Account, AccountState, Community } from '@ratrace/online/types';
import { pathname, routeMoved } from '../testing/fakes';
import { speaking } from '../testing/memoryServices';
import { device, memoryServices, params, renderGame, router } from '../testing/render';
import { Sheet } from '../ui/overlay';
import { Language } from '../ui/text';
import { GameProvider, useSettings } from './context';
import { LanguagePick } from './screens/Settings';

/*
 * On the web the language of a page is its address's (`/es/play`), as the Next web's: the cookie the site keeps (NEXT_LOCALE) only chooses where `/`
 * leads. A language chosen in the settings is the same page in that language, the cookie written for the next visit.
 */

/** The words of a language held back from the page until the test lets them in (`held`), as a chunk not fetched yet; every other language is in. */
const words = vi.hoisted(() => ({ held: null as string | null, failing: false, waiting: null as Promise<void> | null, release: () => undefined as void }));
vi.mock('./languageWords', async (original) => {
  const real = await original<typeof import('./languageWords')>();
  return {
    ...real,
    languageReady: (locale: 'en' | 'es' | 'ru') => locale !== words.held && real.languageReady(locale),
    loadLanguageWords: (locale: 'en' | 'es' | 'ru') =>
      locale === words.held && words.failing
        ? Promise.reject(new Error('offline: the chunk cannot be had'))
        : locale === words.held
        ? // One load for a language, however often it is asked for, as the real one's.
          (words.waiting ??= new Promise<void>((resolve) => {
            words.release = () => {
              words.held = null;
              words.waiting = null;
              resolve();
            };
          }))
        : real.loadLanguageWords(locale),
  };
});

/**
 * The documents the page opens (`openDocument`), each with whether a sheet was still open over the page as it left: a test's browser goes nowhere, so
 * the page stays drawn after.
 */
const opened = vi.hoisted(() => [] as Array<{ address: string; how: 'push' | 'replace'; sheetOpen: boolean }>);
vi.mock('./openDocument', () => ({
  openDocument: (address: string, how: 'push' | 'replace') => opened.push({ address, how, sheetOpen: document.querySelector('[role="dialog"]') !== null }),
}));
/** The addresses opened by a push, as a link the browser follows. */
const pushed = () => opened.filter((one) => one.how === 'push').map((one) => one.address);

const cookie = () => document.cookie.split('; ').find((part) => part.startsWith('NEXT_LOCALE='))?.slice('NEXT_LOCALE='.length) ?? null;

beforeEach(() => {
  document.cookie = 'NEXT_LOCALE=; path=/; max-age=0';
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});
afterEach(() => {
  cleanup();
  words.held = null;
  words.failing = false;
  words.waiting = null;
  opened.length = 0;
});

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

test('each page opened in a language writes the cookie again, with the Next web\'s attributes, so a returning player keeps the language', () => {
  const services = { ...memoryServices(), language: kvLanguage };
  const page = (locale: 'en' | 'es') => <GameProvider services={speaking(services, locale)}><Speaks /></GameProvider>;
  const set = vi.spyOn(document, 'cookie', 'set');
  params.locale = 'en';
  pathname.now = '/en/play';
  const view = renderGame(<Speaks />, services);
  expect(set).toHaveBeenLastCalledWith('NEXT_LOCALE=en; path=/; max-age=31536000; samesite=lax');
  // The same language, another page, the cookie gone meanwhile (a browser that keeps a script's cookies a week at most): written again.
  document.cookie = 'NEXT_LOCALE=; path=/; max-age=0';
  set.mockClear();
  pathname.now = '/en/rankings';
  view.rerender(page('en'));
  expect(set).toHaveBeenCalledWith('NEXT_LOCALE=en; path=/; max-age=31536000; samesite=lax');
  expect(cookie()).toBe('en');
  // Another language: that page's is the one kept.
  set.mockClear();
  params.locale = 'es';
  pathname.now = '/es/rankings';
  view.rerender(page('es'));
  expect(set).toHaveBeenCalledWith('NEXT_LOCALE=es; path=/; max-age=31536000; samesite=lax');
  expect(cookie()).toBe('es');
  set.mockRestore();
});

test('a language chosen, then a page opened before its words arrive: the cookie is the language of the page the player ends on', async () => {
  const services = { ...memoryServices(), language: kvLanguage };
  const page = (locale: 'en' | 'es' | 'ru') => (
    <GameProvider services={speaking(services, locale)}>
      <LanguagePick />
    </GameProvider>
  );
  params.locale = 'en';
  pathname.now = '/en/rankings';
  words.held = 'ru';
  const view = renderGame(<LanguagePick />, services);
  act(() => fireEvent.click(screen.getByRole('radio', { name: 'Русский' })));
  expect(cookie()).toBe('ru');
  // Before Russian's words are in, the player opens a Spanish page (a link, Back): that is the page they are on, and the language kept.
  params.locale = 'es';
  pathname.now = '/es/records';
  view.rerender(page('es'));
  expect(cookie()).toBe('es');
  // The words come in: the choice opens its page, and the page the player ends on is the one that keeps its language.
  await act(async () => words.release());
  await waitFor(() => expect(pushed()).toEqual(['/ru/records']));
  params.locale = 'ru';
  pathname.now = '/ru/records';
  view.rerender(page('ru'));
  expect(cookie()).toBe('ru');
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

test('a language chosen in the settings opens the same page in it, as a new document Back leads from, and the cookie keeps it', async () => {
  params.locale = 'en';
  pathname.now = '/en/rankings';
  renderGame(<LanguagePick />, { ...memoryServices(), language: kvLanguage });
  act(() => fireEvent.click(screen.getByRole('radio', { name: 'Español' })));
  await waitFor(() => expect(opened).toEqual([{ address: '/es/rankings', how: 'push', sheetOpen: false }]));
  expect(cookie()).toBe('es');
  // Not a screen of the router's stacked over this one: the page in English goes with its document.
  expect(router.push).not.toHaveBeenCalled();
  expect(router.replace).not.toHaveBeenCalled();
  opened.length = 0;
  // The language of the address (still English here: the test's browser goes nowhere) opens nothing.
  act(() => fireEvent.click(screen.getByRole('radio', { name: 'English' })));
  await act(async () => undefined);
  expect(opened).toEqual([]);
  cleanup();
  // The front door in Russian is /ru.
  pathname.now = '/en';
  renderGame(<LanguagePick />, { ...memoryServices(), language: kvLanguage });
  act(() => fireEvent.click(screen.getByRole('radio', { name: 'Русский' })));
  await waitFor(() => expect(pushed()).toEqual(['/ru']));
});

test('a language chosen from a sheet closes the sheet first, as the player would, and opens its page once the sheet is gone', async () => {
  params.locale = 'en';
  pathname.now = '/en';
  const closed = vi.fn();
  function SettingsSheet() {
    const [open, setOpen] = useState(true);
    return (
      <Sheet
        open={open}
        onClose={() => {
          closed();
          setOpen(false);
        }}
        title="Settings"
        closeLabel="Close"
      >
        <LanguagePick />
      </Sheet>
    );
  }
  renderGame(<SettingsSheet />, { ...memoryServices(), language: kvLanguage });
  expect(screen.getByRole('dialog')).toBeTruthy();
  act(() => fireEvent.click(screen.getByRole('radio', { name: 'Español' })));
  await waitFor(() => expect(pushed()).toEqual(['/es']));
  expect(closed).toHaveBeenCalledTimes(1);
  // Gone before the page left: no sheet of the old page over the new, nor its entry of the history for Back to land on.
  expect(opened[0].sheetOpen).toBe(false);
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('a language whose words are not in yet opens its page once they are: the page in front stays as it is until then', async () => {
  params.locale = 'en';
  pathname.now = '/en/rankings';
  words.held = 'ru';
  renderGame(<LanguagePick />, { ...memoryServices(), language: kvLanguage });
  act(() => fireEvent.click(screen.getByRole('radio', { name: 'Русский' })));
  await act(async () => undefined);
  expect(opened).toEqual([]);
  // The choice is kept for the next visit at once, whatever comes of its words.
  expect(cookie()).toBe('ru');
  await act(async () => words.release());
  await waitFor(() => expect(pushed()).toEqual(['/ru/rankings']));
});

test('the same language picked twice before its words are in opens its page once', async () => {
  params.locale = 'en';
  pathname.now = '/en/rankings';
  words.held = 'ru';
  renderGame(<LanguagePick />, { ...memoryServices(), language: kvLanguage });
  act(() => fireEvent.click(screen.getByRole('radio', { name: 'Русский' })));
  act(() => fireEvent.click(screen.getByRole('radio', { name: 'Русский' })));
  await act(async () => words.release());
  await waitFor(() => expect(pushed()).toEqual(['/ru/rankings']));
  await act(async () => new Promise((settled) => setTimeout(settled, 20)));
  expect(pushed()).toEqual(['/ru/rankings']);
});

test('a language whose words cannot be had opens nothing, and can be asked for again', async () => {
  params.locale = 'en';
  pathname.now = '/en/rankings';
  words.held = 'ru';
  words.failing = true;
  renderGame(<LanguagePick />, { ...memoryServices(), language: kvLanguage });
  // Offline, its chunk not fetched before: the page stays in English.
  act(() => fireEvent.click(screen.getByRole('radio', { name: 'Русский' })));
  await act(async () => new Promise((settled) => setTimeout(settled, 20)));
  expect(opened).toEqual([]);
  // Asked for again once it can be had: opened.
  words.failing = false;
  act(() => fireEvent.click(screen.getByRole('radio', { name: 'Русский' })));
  await act(async () => words.release());
  await waitFor(() => expect(pushed()).toEqual(['/ru/rankings']));
});

test('of two languages picked one after the other, the last is the one opened, whichever\'s words come in first', async () => {
  params.locale = 'en';
  pathname.now = '/en/rankings';
  words.held = 'ru';
  renderGame(<LanguagePick />, { ...memoryServices(), language: kvLanguage });
  act(() => fireEvent.click(screen.getByRole('radio', { name: 'Русский' })));
  act(() => fireEvent.click(screen.getByRole('radio', { name: 'Español' })));
  await waitFor(() => expect(pushed()).toEqual(['/es/rankings']));
  await act(async () => words.release());
  await act(async () => new Promise((settled) => setTimeout(settled, 20)));
  expect(pushed()).toEqual(['/es/rankings']);
  expect(cookie()).toBe('es');
});

test('the page\'s lang is the language it speaks, where that changes in place', () => {
  // A page with no language in its address (a development route) speaks the one chosen, and says so.
  pathname.now = '/scene';
  document.documentElement.lang = 'en';
  renderGame(<LanguagePick />, { ...memoryServices(), language: kvLanguage });
  act(() => fireEvent.click(screen.getByRole('radio', { name: 'Español' })));
  expect(document.documentElement.lang).toBe('es');
  expect(opened).toEqual([]);
});

test('the language\'s setter keeps its identity from page to page, and nothing that reads the settings is drawn again as the player moves', async () => {
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
  await waitFor(() => expect(pushed()).toEqual(['/ru/collection']));
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
  await waitFor(() => expect(opened).toEqual([{ address: '/es/room?code=ABC123#x', how: 'replace', sheetOpen: false }]));
  // In place of the page, as the Next web's `location.replace`: Back does not lead to the language the account left.
  expect(router.push).not.toHaveBeenCalled();
  expect(router.replace).not.toHaveBeenCalled();
  expect(window.history.length).toBe(pages);
  expect(cookie()).toBe('es');
  expect(localStorage.getItem('ratrace.lastAccount')).toBe('member-1');
});
