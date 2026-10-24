// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { useContext } from 'react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import PlayRoute from '../app/[locale]/play';
import RecordsRoute from '../app/[locale]/records';
import { kvLanguage } from '../kvStore';
import { pathname } from '../testing/fakes';
import { device, memoryServices, params, renderGame, router } from '../testing/render';
import { Language } from '../ui/text';
import { LanguagePick } from './screens/Settings';

/*
 * On the web the language of a page is its address's (`/es/play`), as the Next web's: the cookie the site keeps (NEXT_LOCALE) only chooses where `/`
 * leads. A language chosen in the settings is the same page in that language, the cookie written for the next visit.
 */

const cookie = () => document.cookie.split('; ').find((part) => part.startsWith('NEXT_LOCALE='))?.slice('NEXT_LOCALE='.length) ?? null;

beforeEach(() => {
  document.cookie = 'NEXT_LOCALE=; path=/; max-age=0';
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
  expect(screen.getByRole('heading', { name: 'Récords' })).toBeTruthy();
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
