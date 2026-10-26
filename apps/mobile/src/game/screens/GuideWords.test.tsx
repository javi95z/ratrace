// @vitest-environment jsdom
import type { Term } from '@ratrace/core/game/glossary';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { memoryServices, renderGame } from '../../testing/render';
import { HowToPlay, MarkedText, TermSheet } from './GuideWords';

afterEach(cleanup);

/** A sentence of the guide as its note holds it: the words, and the sheet of the term pressed. */
function Note({ text }: { text: string }) {
  const [term, setTerm] = useState<Term | null>(null);
  return (
    <>
      <MarkedText text={text} size={14} onTerm={setTerm} />
      <TermSheet term={term} onClose={() => setTerm(null)} />
    </>
  );
}

const sheetTitled = (title: string) => screen.getByRole('heading', { name: title }).closest('[aria-modal="true"]') as HTMLElement;

describe('a word of the glossary in a tip', () => {
  it('is read as part of the sentence, with no mark, and is a button of its own under it', () => {
    renderGame(<Note text="The bar is your [passive income](passive) against your [flow](flow)." />, memoryServices());
    // One text, read whole: the words of the terms run on in it.
    let text: HTMLElement | null = screen.getByText(/The bar is your/);
    while (text && text.textContent?.startsWith('The bar is your passive income') !== true) text = text.parentElement;
    expect(text?.textContent).toBe('The bar is your passive income against your flow.');
    expect(screen.getByRole('button', { name: 'What is "passive income"?' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'What is "flow"?' })).toBeTruthy();
  });

  it('opens what it means in a sheet, and the sheet closes', async () => {
    renderGame(<Note text="Your [passive income](passive) grows." />, memoryServices());
    fireEvent.click(screen.getByRole('button', { name: 'What is "passive income"?' }));
    const sheet = await waitFor(() => sheetTitled('Passive income'));
    expect(within(sheet).getByText(/What you earn without working/)).toBeTruthy();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Passive income' })).toBeNull());
  });

  it('is said in the language of the game, the figures of the rules filled in', async () => {
    renderGame(<Note text="Tu [tarjeta](creditCard)." />, memoryServices(), 'es');
    fireEvent.click(screen.getByRole('button', { name: '¿Qué es «tarjeta»?' }));
    const sheet = await waitFor(() => sheetTitled('Tarjeta de crédito'));
    expect(within(sheet).getByText(/al 22,0% al año/)).toBeTruthy();
  });

  it('a sentence with no word marked has no links under it', () => {
    renderGame(<Note text="Nothing to explain here." />, memoryServices());
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('how to play', () => {
  it('opens from its button and holds the goal, a round, the score, every tip, the first times and every word, none of them marked', async () => {
    renderGame(<HowToPlay />, memoryServices());
    fireEvent.click(screen.getByRole('button', { name: 'How to play' }));
    const sheet = await waitFor(() => sheetTitled('How to play'));
    for (const heading of ['The goal', 'A round', 'The score', 'The tips', 'First times', 'The words of the game']) expect(within(sheet).getByRole('heading', { name: heading })).toBeTruthy();
    expect(within(sheet).getByText(/You live a life of 20 rounds of two years, from 22 to 62/)).toBeTruthy();
    expect(within(sheet).getByText(/40 for ten rounds and 10 for ten more make 25/)).toBeTruthy();
    // A tip of each kind: one of a stage, one that waits, a first time.
    expect(within(sheet).getByText(/Every round opens with the paper/)).toBeTruthy();
    expect(within(sheet).getByText(/With inflation, prices and pay tend to rise/)).toBeTruthy();
    expect(within(sheet).getByText(/You worked overtime last round/)).toBeTruthy();
    expect(within(sheet).getByText('Index fund')).toBeTruthy();
    expect(sheet.textContent).not.toMatch(/\]\(/);
  });
});
