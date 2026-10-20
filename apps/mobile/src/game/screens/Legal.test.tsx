// @vitest-environment jsdom
import { messagesFor } from '@ratrace/i18n';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { memoryServices, renderGame, router } from '../../testing/render';
import { Legal } from './Legal';

// Who answers for the game is the build's to say (../site.ts): here it is whatever the test says.
const owner = vi.hoisted(() => ({ name: '', email: '' }));
vi.mock('../site', () => ({
  get LEGAL_NAME() {
    return owner.name;
  },
  get LEGAL_EMAIL() {
    return owner.email;
  },
}));

afterEach(() => {
  cleanup();
  owner.name = '';
  owner.email = '';
});

const en = messagesFor('en').phone.legal as Record<string, string>;
/** The sections of the phone's notice: those of the web's that are true of an app that keeps everything on the phone, and one that says it may change. */
const SECTIONS = ['notice', 'data', 'device', 'who', 'later'] as const;

describe('the legal notice', () => {
  it('says the privacy and legal notice in plain words: a title, the sections that are true of this app each under its own heading, in order, and the day it was updated', () => {
    renderGame(<Legal />, memoryServices());
    expect(screen.getByRole('heading', { name: en.title })).toBeTruthy();
    const headings = screen.getAllByRole('heading').map((heading) => heading.textContent);
    expect(headings).toEqual([en.title, ...SECTIONS.map((section) => en[`${section}Title`])]);
    for (const section of SECTIONS) expect(screen.getByText(en[`${section}Body`])).toBeTruthy();
    expect(screen.getByText(en.updated)).toBeTruthy();
  });

  it('says what is true of this app: everything is kept on the phone, nothing is sent, there is no account', () => {
    renderGame(<Legal />, memoryServices());
    const text = document.body.textContent ?? '';
    expect(text).toContain('sends nothing from your phone');
    expect(text).toContain('saved on this phone only');
    expect(text).toContain('talks to no server');
    // Nothing of the web's notice that is not true of it: no account with Google, no Supabase, no browser, no cookies kept.
    for (const web of [/Google/, /Supabase/, /Vercel/, /Turnstile/, /browser/, /friend code/, /nickname/]) expect(text, String(web)).not.toMatch(web);
  });

  it('names the owner and the contact under the legal notice when the build names them, and nothing when it does not', () => {
    renderGame(<Legal />, memoryServices());
    expect(document.body.textContent).not.toMatch(/Owner:|Contact:/);
    cleanup();
    owner.name = 'Rat Race Ltd';
    owner.email = 'hello@example.com';
    renderGame(<Legal />, memoryServices());
    expect(screen.getByText('Owner: Rat Race Ltd. Contact: hello@example.com.')).toBeTruthy();
    cleanup();
    owner.name = '';
    renderGame(<Legal />, memoryServices());
    expect(screen.getByText('Contact: hello@example.com.')).toBeTruthy();
    cleanup();
    owner.name = 'Rat Race Ltd';
    owner.email = '';
    renderGame(<Legal />, memoryServices());
    expect(screen.getByText('Owner: Rat Race Ltd.')).toBeTruthy();
  });

  it('puts the owner and the contact after the first section only', () => {
    owner.name = 'Rat Race Ltd';
    renderGame(<Legal />, memoryServices());
    const text = document.body.textContent ?? '';
    expect(text.indexOf('Owner: Rat Race Ltd.')).toBeGreaterThan(text.indexOf(en.noticeBody));
    expect(text.indexOf('Owner: Rat Race Ltd.')).toBeLessThan(text.indexOf(en.dataTitle));
  });

  it('leads back to the front door', () => {
    renderGame(<Legal />, memoryServices());
    fireEvent.click(screen.getByRole('link', { name: 'Back' }));
    expect(router.dismissTo).toHaveBeenCalledWith('/');
  });

  it('is written in Spanish and in Russian too, each with its own words', () => {
    for (const locale of ['es', 'ru'] as const) {
      const words = messagesFor(locale).phone.legal as Record<string, string>;
      renderGame(<Legal />, memoryServices(), locale);
      expect(screen.getAllByRole('heading').map((heading) => heading.textContent), locale).toEqual([words.title, ...SECTIONS.map((section) => words[`${section}Title`])]);
      // A text is cut into one piece for each typeface it needs, so it is read whole from the page.
      for (const section of SECTIONS) expect(document.body.textContent, `${locale} ${section}`).toContain(words[`${section}Body`]);
      cleanup();
    }
  });
});
