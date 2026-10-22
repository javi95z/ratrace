// @vitest-environment jsdom
import { content } from '@ratrace/content';
import { formatFor } from '@ratrace/core/lib/format';
import { quoteCareer } from '@ratrace/engine';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { memoryServices, renderGame } from '../../testing/render';
import { CareerPreview } from './CareerPreview';
import { PAY_DROP } from '../../ui/fonts';

afterEach(cleanup);

/** The sheet that is open, by its title. */
const sheetOf = async (title: string) => (await screen.findByRole('heading', { name: title })).closest('[aria-modal="true"]') as HTMLElement;

describe('a career a card offers', () => {
  it('shows every rung with its pay, the rung the player would start on, and what they leave behind', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    const law = content.careers.find((career) => career.id === 'law')!;
    renderGame(<CareerPreview careerId="law" startLevel={0} shown={session.view()} onClose={() => {}} />, services);
    const sheet = await sheetOf('Law');
    expect(within(sheet).getAllByRole('listitem')).toHaveLength(law.levels.length);
    expect(within(sheet).getByText('You start here')).toBeTruthy();
    expect(within(sheet).getByText(/^You start as .*, on .*\/yr\. At the very top, .*: .*\/yr\.$/)).toBeTruthy();
    expect(within(sheet).getByText(/you would leave that job and start again from no experience/)).toBeTruthy();
  });

  it('lists the rungs from the top down, each with its pay in the player\'s city today, and the rung the card starts on at the foot of a ladder started from the bottom', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('engineer');
    const shown = session.view();
    const quote = quoteCareer(content, shown, 'law');
    renderGame(<CareerPreview careerId="law" startLevel={0} shown={shown} onClose={() => {}} />, services);
    const sheet = await sheetOf('Law');
    const rungs = within(sheet).getAllByRole('listitem');
    expect(rungs).toHaveLength(quote.ladder.length);
    // The list is in the order of the career and drawn the other way up, as the web's `flex-col-reverse` list is: the top of the ladder at the top.
    expect(sheet.querySelector('[role="list"]')?.getAttribute('style')).toContain('flex-direction: column-reverse');
    expect(rungs[0].textContent).toContain('Paralegal');
    expect(rungs[0].textContent).toContain('You start here');
    expect(rungs[rungs.length - 1].textContent).toContain('Managing partner');
    expect(rungs.filter((rung) => rung.textContent?.includes('You start here'))).toHaveLength(1);
    // What each pays is the quote's, said in the words of the money, once each.
    for (const [i, rung] of rungs.entries()) expect(within(rung).getAllByText(/\/yr$/), String(i)).toHaveLength(1);
    expect(rungs[2].textContent).toContain(`${formatFor('en').money(quote.ladder[2].payAnnual)}/yr`);
  });

  it('marks the rung the card starts the player on, and says what the rungs above it ask', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    renderGame(<CareerPreview careerId="tech" startLevel={1} shown={session.view()} onClose={() => {}} />, services);
    const sheet = await sheetOf('Technology');
    const rungs = within(sheet).getAllByRole('listitem');
    const start = rungs.filter((rung) => rung.textContent?.includes('You start here'));
    expect(start).toHaveLength(1);
    // The rungs above need experience; those at or under the start do not.
    const needs = rungs.filter((rung) => /Needs \d+ experience/.test(rung.textContent ?? ''));
    expect(needs).toHaveLength(rungs.length - 2);
    expect(start[0].textContent).not.toMatch(/Needs/);
  });

  it('names the job the player has now, and what they would leave', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('engineer');
    renderGame(<CareerPreview careerId="law" startLevel={0} shown={session.view()} onClose={() => {}} />, services);
    const sheet = await sheetOf('Law');
    expect(sheet.textContent).toMatch(/^.*You are now .+ in .+: you would leave that job/);
  });

  it('draws the career\'s own picture, and closes when asked', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    const onClose = vi.fn();
    renderGame(<CareerPreview careerId="law" startLevel={0} shown={session.view()} onClose={onClose} />, services);
    const sheet = await sheetOf('Law');
    expect(sheet.querySelector('[data-sprite="icon.career_law"]')).not.toBeNull();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('says what each rung pays in the player\'s city, before anything of their own', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    renderGame(<CareerPreview careerId="law" startLevel={0} shown={session.view()} onClose={() => {}} />, services);
    const sheet = await sheetOf('Law');
    expect(sheet.textContent).toContain('Pay as it is today in Madrid, before anything of your own');
  });

  it('stands the pay a point lower than the title it shares a baseline with, in a row that is no taller for it', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    renderGame(<CareerPreview careerId="law" startLevel={0} shown={session.view()} onClose={() => {}} />, services);
    const sheet = await sheetOf('Law');
    const rung = within(sheet).getAllByRole('listitem')[0];
    expect(PAY_DROP).toBe(1);
    const pay = within(rung).getByText(/\/yr$/).parentElement?.parentElement as HTMLElement;
    expect(pay.style.marginTop).toBe(`${PAY_DROP}px`);
    // Aligned at the top: a native row cannot be asked for the baselines of the kit's texts, which are moved inside their boxes.
    expect(pay.parentElement?.style.alignItems).toBe('flex-start');
  });

  it('says which rung the card starts the player on to a screen reader, as the web\'s aria-current does', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    renderGame(<CareerPreview careerId="tech" startLevel={1} shown={session.view()} onClose={() => {}} />, services);
    const sheet = await sheetOf('Technology');
    const rungs = within(sheet).getAllByRole('listitem');
    expect(rungs.map((rung) => rung.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false', 'false', 'false']);
    expect(rungs[1].textContent).toContain('You start here');
  });
});
