import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import proxy, { localeOfPath } from './proxy';

const open = (path: string, headers: Record<string, string> = {}) => proxy(new NextRequest(new URL(path, 'https://ratrace.test'), { headers: { 'sec-fetch-dest': 'document', ...headers } }));

describe('the language the game opens in', () => {
  it('is the one last played, not the browser\'s, when the bare address is opened again', () => {
    const response = open('/', { 'accept-language': 'en-GB,en;q=0.9', cookie: 'NEXT_LOCALE=es' });
    expect(response.headers.get('location')).toMatch(/\/es$/);
  });

  it('follows the browser on a first visit', () => {
    const response = open('/', { 'accept-language': 'ru-RU,ru;q=0.9' });
    expect(response.headers.get('location')).toMatch(/\/ru$/);
  });

  it('is remembered for a year by every page opened in it, even one already remembered', () => {
    const cookie = open('/es/play', { 'accept-language': 'en', cookie: 'NEXT_LOCALE=es' }).headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/NEXT_LOCALE=es/);
    expect(cookie).toMatch(/Max-Age=31536000/i);
    expect(cookie).toMatch(/Path=\//i);
  });

  it('is not changed by what the router fetches in the background', () => {
    const cookie = open('/ru/play', { 'sec-fetch-dest': 'empty', cookie: 'NEXT_LOCALE=es' }).headers.get('set-cookie') ?? '';
    expect(cookie).not.toMatch(/NEXT_LOCALE=ru/);
  });

  it('is read from the start of an address', () => {
    expect(localeOfPath('/es/play')).toBe('es');
    expect(localeOfPath('/es')).toBe('es');
    expect(localeOfPath('/')).toBeNull();
    expect(localeOfPath('/esp')).toBeNull();
  });
});
