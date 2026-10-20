// @vitest-environment jsdom
import { challengeOf, lives, textFor, weekOf, weekStart } from '@ratrace/content';
import { messagesFor } from '@ratrace/i18n';
import { SCENE_NOW } from '@ratrace/core/testing/scenes';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SavedGame } from '@ratrace/core/session/types';
import { useGame } from '../context';
import { memoryServices, renderGame, router } from '../../testing/render';
import { bannerSize, useRuleText, useThisWeek, WeeklyChallenge, WeeklyChallengeCard } from './Challenge';

afterEach(cleanup);

// Whether the sheets are gone is the test's to say where it needs to (./back is the kit's; its own tests hold it to the Modals).
const sheets = vi.hoisted(() => ({ gone: Promise.resolve() as Promise<void> }));
vi.mock('../../ui/back', async (actual) => ({ ...(await actual<typeof import('../../ui/back')>()), sheetsGone: () => sheets.gone }));
afterEach(() => {
  sheets.gone = Promise.resolve();
});

const week = challengeOf(weekOf(Date.now()), lives);
if (!week) throw new Error('no challenge this week');
const lifeName = textFor('en').text.lives[week.lifeId].name;
const ruleName: Record<string, string> = { indexOnly: 'Index funds only', noLoans: 'No loans', noMoving: 'No moving', noProperty: 'No property', startInDebt: 'Start in debt' };
const saved = async (services: ReturnType<typeof memoryServices>) => (await services.store.loadGame()) as SavedGame | null;

/** The week's challenge as the phone shows it on a day: the services' clock is what the date is read by. */
const onDay = (now: number) => ({ ...memoryServices(), now: () => now });

describe('the weekly challenge page', () => {
  it('shows the life and rule on its own page and practises from there without an account', async () => {
    const services = memoryServices();
    renderGame(<WeeklyChallenge />, services);
    expect(screen.getByRole('heading', { name: 'Weekly challenge' })).toBeTruthy();
    expect(screen.getByText(lifeName)).toBeTruthy();
    expect(screen.getByText(ruleName[week.rule])).toBeTruthy();
    // Nobody is signed in and there is no way to be: there is no attempt that counts, and the page does not tell of one (nor to sign in).
    expect(screen.queryByRole('button', { name: "Play today's attempt" })).toBeNull();
    expect(screen.queryByText(/sign in/)).toBeNull();
    expect(document.body.textContent).not.toContain('To play the attempt that counts');
    fireEvent.click(screen.getByRole('button', { name: 'Practise' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/play'));
    expect(await saved(services)).toMatchObject({ lifeId: week.lifeId, challenge: week.week });
  });

  it('begins a practice of the week\'s challenge that is the player\'s own and counts for nothing: a life of the week, unranked', async () => {
    const services = memoryServices();
    const asked: unknown[] = [];
    const start = services.sessions.start.bind(services.sessions);
    services.sessions.start = (lifeId: string, options?: Parameters<typeof start>[1]) => {
      asked.push([lifeId, options]);
      return start(lifeId, options);
    };
    renderGame(<WeeklyChallenge />, services);
    fireEvent.click(screen.getByRole('button', { name: 'Practise' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/play'));
    expect(asked).toEqual([[week.lifeId, { challenge: week.week }]]);
    expect(((await saved(services)) as { ranked?: boolean }).ranked).toBeUndefined();
  });

  it('says the rule and what it forbids, the day the week closes, and what a practice is', async () => {
    renderGame(<WeeklyChallenge />, memoryServices());
    expect(screen.getByText(ruleName[week.rule])).toBeTruthy();
    expect(document.body.textContent).toContain('The same life, the same markets and the same cards for everyone all week.');
    expect(document.body.textContent).toContain('A practice is played on this device with the same life and rule, but other cards and markets.');
    expect(document.body.textContent).toMatch(/Ends on .+, at midnight UTC\./);
  });

  it('is read on the day the game says, not the day it is: the services\' clock', async () => {
    renderGame(<WeeklyChallenge />, onDay(SCENE_NOW));
    const scene = challengeOf(weekOf(SCENE_NOW), lives);
    if (!scene) throw new Error('no challenge on the scene day');
    expect(screen.getByText(textFor('en').text.lives[scene.lifeId].name)).toBeTruthy();
    // The week of Thursday 22 October 2026 ends on its Sunday, the 25th, at midnight UTC.
    expect(document.body.textContent).toContain('Ends on 25 Oct 2026, at midnight UTC.');
  });

  it('asks before it ends a life in progress, and starts the practice only when the answer is yes', async () => {
    const services = memoryServices();
    await services.sessions.start('engineer');
    const ask = messagesFor('en').newLife;
    function Status() {
      return <div data-testid="status">{useGame((s) => s.status)}</div>;
    }
    renderGame(<><WeeklyChallenge /><Status /></>, services);
    // The game on the device is opened as the page is: the page knows a life is in progress once it has.
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('playing'));
    fireEvent.click(screen.getByRole('button', { name: 'Practise' }));
    const title = await screen.findByRole('heading', { name: ask.confirmTitle });
    const sheet = title.closest('[aria-modal="true"]') as HTMLElement;
    expect(sheet.textContent).toContain('Software engineer, age 22. It ends here and is not recorded.');
    expect(router.replace).not.toHaveBeenCalled();
    fireEvent.click(within(sheet).getByRole('button', { name: ask.confirmNo }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: ask.confirmTitle })).toBeNull());
    expect(router.replace).not.toHaveBeenCalled();
    expect((await saved(services))?.lifeId).toBe('engineer');
    // And yes ends it, and begins the challenge.
    fireEvent.click(screen.getByRole('button', { name: 'Practise' }));
    fireEvent.click(within((await screen.findByRole('heading', { name: ask.confirmTitle })).closest('[aria-modal="true"]') as HTMLElement).getByRole('button', { name: ask.confirmYes }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/play'));
    expect(await saved(services)).toMatchObject({ lifeId: week.lifeId, challenge: week.week });
  });

  it('moves on to the life only once the question\'s sheet is gone, when the answer came from it; and at once when there was no sheet', async () => {
    let gone: () => void = () => undefined;
    const services = memoryServices();
    await services.sessions.start('engineer');
    const ask = messagesFor('en').newLife;
    function Status() {
      return <div data-testid="status">{useGame((s) => s.status)}</div>;
    }
    renderGame(<><WeeklyChallenge /><Status /></>, services);
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('playing'));
    fireEvent.click(screen.getByRole('button', { name: 'Practise' }));
    sheets.gone = new Promise<void>((done) => (gone = done));
    fireEvent.click(within((await screen.findByRole('heading', { name: ask.confirmTitle })).closest('[aria-modal="true"]') as HTMLElement).getByRole('button', { name: ask.confirmYes }));
    // The life is begun, and the screen waits for the sheet to leave before it changes under it.
    await waitFor(async () => expect((await saved(services))?.challenge).toBe(week.week));
    await new Promise((done) => setTimeout(done, 30));
    expect(router.replace).not.toHaveBeenCalled();
    gone();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/play'));
    cleanup();
    router.replace.mockClear();

    // With no life in progress there is no sheet: it goes on at once, whatever is said of sheets.
    sheets.gone = new Promise<void>(() => undefined);
    renderGame(<WeeklyChallenge />, memoryServices());
    fireEvent.click(screen.getByRole('button', { name: 'Practise' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/play'));
  });

  it('says so when the practice could not be begun, and lets the player try again', async () => {
    const services = memoryServices();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let fails = true;
    const start = services.sessions.start.bind(services.sessions);
    services.sessions.start = (lifeId: string, options?: Parameters<typeof start>[1]) => (fails ? Promise.reject(new Error('the device would not')) : start(lifeId, options));
    renderGame(<WeeklyChallenge />, services);
    fireEvent.click(screen.getByRole('button', { name: 'Practise' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
    fails = false;
    fireEvent.click(screen.getByRole('button', { name: 'Practise' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/play'));
    expect(screen.queryByRole('alert')).toBeNull();
    error.mockRestore();
  });

  it('leads back to the front door', () => {
    renderGame(<WeeklyChallenge />, memoryServices());
    fireEvent.click(screen.getByRole('link', { name: 'Back' }));
    expect(router.dismissTo).toHaveBeenCalledWith('/');
  });

  it('offers no ranking of the others: there is nobody to ask', () => {
    renderGame(<WeeklyChallenge />, memoryServices());
    expect(screen.queryByRole('link', { name: /ranking/i })).toBeNull();
  });
});

describe('the weekly challenge on the front door', () => {
  it('says what the week is, and how long it has left', async () => {
    renderGame(<WeeklyChallengeCard />, memoryServices());
    const card = screen.getByRole('link');
    expect(card.textContent).toContain('Weekly challenge');
    expect(card.textContent).toContain(`${lifeName} · ${ruleName[week.rule]}`);
    expect(screen.getByText(/^(Ends today|\d days? left)$/)).toBeTruthy();
    // It says nothing of an attempt: where nobody is signed in, there is none to have played.
    expect(card.textContent).not.toContain('Played today');
  });

  it('counts the days left of the week from the services\' clock, today not counted: three on the Thursday every scene is drawn on, none on the Sunday', () => {
    renderGame(<WeeklyChallengeCard />, onDay(SCENE_NOW));
    expect(screen.getByText('3 days left')).toBeTruthy();
    cleanup();
    const sunday = weekStart(weekOf(SCENE_NOW))! + 6 * 86_400_000 + 5 * 3_600_000;
    renderGame(<WeeklyChallengeCard />, onDay(sunday));
    expect(screen.getByText('Ends today')).toBeTruthy();
    cleanup();
    const saturday = sunday - 86_400_000;
    renderGame(<WeeklyChallengeCard />, onDay(saturday));
    expect(screen.getByText('1 day left')).toBeTruthy();
  });

  it('leads to the challenge', () => {
    renderGame(<WeeklyChallengeCard />, memoryServices());
    fireEvent.click(screen.getByRole('link'));
    expect(router.push).toHaveBeenCalledWith('/challenge');
  });
});

describe('the week\'s challenge, read once', () => {
  it('is the same challenge for as long as the screen is open, even as the clock moves past midnight of its Sunday', () => {
    let now = SCENE_NOW;
    const seen: unknown[] = [];
    function Probe() {
      const [, again] = useState(0);
      seen.push(useThisWeek());
      return <button onClick={() => again((n) => n + 1)}>again</button>;
    }
    renderGame(<Probe />, { ...memoryServices(), now: () => now });
    now = weekStart(weekOf(SCENE_NOW))! + 8 * 86_400_000;
    fireEvent.click(screen.getByText('again'));
    expect(seen).toHaveLength(2);
    expect(seen[1]).toBe(seen[0]);
  });

  it('tells a rule in a line, and in a sentence that says what it forbids', () => {
    let text: ReturnType<ReturnType<typeof useRuleText>> | null = null;
    function Probe() {
      text = useRuleText()('noLoans');
      return null;
    }
    renderGame(<Probe />, memoryServices());
    expect(text).toEqual({ name: 'No loans', about: 'No loans, mortgages, margin or instalments. The credit card still covers a shortfall.' });
  });
});

describe('the banner of the page', () => {
  it('fills the width it is given, and is drawn as tall as Chrome draws the web\'s: its height rounded to a whole point, for a picture to land on the same rows', () => {
    // The web's `!h-auto !w-full` image of 288 × 120 art is 378 wide here, 157.5 tall in layout and painted 158: Chrome snaps a box in CSS pixels.
    expect(bannerSize(378, { w: 288, h: 120 })).toEqual({ w: 378, h: 158 });
    expect(bannerSize(288, { w: 288, h: 120 })).toEqual({ w: 288, h: 120 });
    expect(bannerSize(448 - 24, { w: 288, h: 120 })).toEqual({ w: 424, h: 177 });
  });
});
