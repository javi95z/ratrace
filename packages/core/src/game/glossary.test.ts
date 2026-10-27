import { describe, expect, it } from 'vitest';
import { marked, plain, TERMS, termsIn } from './glossary';

describe('the words of the glossary, marked in the guide', () => {
  it('cuts a text into its plain words and the terms marked in it', () => {
    expect(marked('Your [passive income](passive) against your [outgoings](flow).')).toEqual([
      { text: 'Your ' },
      { text: 'passive income', term: 'passive' },
      { text: ' against your ' },
      { text: 'outgoings', term: 'flow' },
      { text: '.' },
    ]);
    expect(marked('[Status](status) counts.')).toEqual([{ text: 'Status', term: 'status' }, { text: ' counts.' }]);
    expect(marked('Nothing marked.')).toEqual([{ text: 'Nothing marked.' }]);
  });

  it('reads a mark of a word it does not know as plain words, so nothing on screen is ever lost', () => {
    expect(marked('A [thing](nowhere) here.')).toEqual([{ text: 'A thing here.' }]);
    expect(marked('Brackets [alone] stay.')).toEqual([{ text: 'Brackets [alone] stay.' }]);
  });

  it('gives the words as they read, and the terms once each in the order they come', () => {
    expect(plain('Your [passive income](passive), your [flow](flow) and [passive](passive) again.')).toBe('Your passive income, your flow and passive again.');
    expect(termsIn('Your [passive income](passive), your [flow](flow) and [passive](passive) again.')).toEqual(['passive', 'flow']);
  });

  it('has each term once', () => {
    expect(new Set(TERMS).size).toBe(TERMS.length);
    expect(TERMS).toContain('inflation');
  });
});
