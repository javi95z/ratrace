// @vitest-environment jsdom
import { challengeOf, content, CONTENT_VERSION, lives, textFor, weekOf, weekStart } from '@ratrace/content';
import { messagesFor } from '@ratrace/i18n';
import { LocalSessions } from '@ratrace/core/session/local';
import { MemoryStore } from '@ratrace/core/session/memory';
import { RankedSessions } from '@ratrace/core/session/ranked';
import { GameSessions } from '@ratrace/core/session/sessions';
import { SCENE_NOW } from '@ratrace/core/testing/scenes';
import { ENGINE_VERSION } from '@ratrace/engine';
import type { Account, AccountState, ChallengeChoice, ChallengeRanking, Community } from '@ratrace/online/types';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RankedGame, SavedGame } from '@ratrace/core/session/types';
import { rankedServer } from '../../../../web/src/testing/rankedServer';
import { GameProvider, useGame } from '../context';
import type { Services } from '../context';
import { focus, network } from '../../testing/fakes';
import { speaking } from '../../testing/memoryServices';
import { memoryServices, renderGame, router } from '../../testing/render';
import { Counted, settled, steady } from '../../testing/renders';
import type { Renders } from '../../testing/renders';
import { ChallengeResult, useRuleText, useThisWeek, WeeklyChallenge, WeeklyChallengeCard } from './Challenge';
import { bannerSize } from '../../ui/sprites';

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
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/en/play'));
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
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/en/play'));
    expect(asked).toEqual([[week.lifeId, { ranked: false, challenge: week.week, replace: undefined }]]);
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
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/en/play'));
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
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/en/play'));
    cleanup();
    router.replace.mockClear();

    // With no life in progress there is no sheet: it goes on at once, whatever is said of sheets.
    sheets.gone = new Promise<void>(() => undefined);
    renderGame(<WeeklyChallenge />, memoryServices());
    fireEvent.click(screen.getByRole('button', { name: 'Practise' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/en/play'));
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
    // Pressed again once the button is free (the failed start has let it go), and the life given the time a loaded machine takes to begin.
    const practise = screen.getByRole('button', { name: 'Practise' });
    await waitFor(() => expect(practise.getAttribute('aria-disabled')).not.toBe('true'));
    fireEvent.click(practise);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/en/play'), { timeout: 10_000 });
    expect(screen.queryByRole('alert')).toBeNull();
    error.mockRestore();
  });

  it('leads back to the front door', () => {
    renderGame(<WeeklyChallenge />, memoryServices());
    fireEvent.click(screen.getByRole('link', { name: 'Back' }));
    expect(router.dismissTo).toHaveBeenCalledWith('/en');
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
    expect(router.push).toHaveBeenCalledWith('/en/challenge');
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

describe('the weekly challenge page, for a player signed in', () => {
  const guest: AccountState = { kind: 'guest', userId: 'u', notice: null };
  const accountAs = (state: AccountState): Account => ({ state: () => state, subscribe: () => () => {}, start: async () => {}, keepWithGoogle: async () => true, useExistingAccount: async () => true, dismissNotice: () => {}, signOut: async () => false });

  /** A signed-in player and what the account says of today's ranked attempt and the week's best. */
  function withAccount(entry: { entered: boolean; score: number | null } | null) {
    const services = memoryServices();
    const asked: unknown[] = [];
    const start = services.sessions.start.bind(services.sessions);
    services.sessions.start = (lifeId: string, options?: Parameters<typeof start>[1]) => {
      asked.push({ lifeId, ...options });
      // There is no server in this test of the page: the same challenge begins on the phone, once the request is remembered.
      return start(lifeId, options?.challenge ? { challenge: options.challenge } : undefined);
    };
    const community = { challengeEntry: async () => entry } as unknown as Community;
    return { services: { ...services, account: accountAs(guest), community: () => community }, asked };
  }

  it('offers the day\'s ranked attempt to a signed-in player who has not had it today, and begins it ranked', async () => {
    const { services, asked } = withAccount({ entered: false, score: null });
    renderGame(<WeeklyChallenge />, services);
    fireEvent.click(await screen.findByRole('button', { name: "Play today's attempt" }));
    await waitFor(() => expect(asked).toEqual([{ lifeId: week.lifeId, ranked: true, challenge: week.week, replace: undefined }]));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/en/play'));
    // Nobody is told to sign in who is.
    expect(document.body.textContent).not.toContain('To play the attempt that counts');
  });

  it('practises unranked beside the attempt', async () => {
    const { services, asked } = withAccount({ entered: false, score: null });
    renderGame(<WeeklyChallenge />, services);
    await screen.findByRole('button', { name: "Play today's attempt" });
    fireEvent.click(screen.getByRole('button', { name: 'Practise' }));
    await waitFor(() => expect(asked).toEqual([{ lifeId: week.lifeId, ranked: false, challenge: week.week, replace: undefined }]));
  });

  it('offers today\'s attempt again to a player who played on another day, with their best of the week', async () => {
    const { services } = withAccount({ entered: false, score: 640 });
    renderGame(<WeeklyChallenge />, services);
    expect(await screen.findByText('Your best this week: 640 points.')).toBeTruthy();
    expect(screen.getByRole('button', { name: "Play today's attempt" })).toBeTruthy();
  });

  it('shows today\'s attempt had, the best of the week, and leaves practice available', async () => {
    const { services } = withAccount({ entered: true, score: 777 });
    renderGame(<WeeklyChallenge />, services);
    expect(await screen.findByText("You have played today's attempt. Your best this week: 777 points.")).toBeTruthy();
    expect(screen.queryByRole('button', { name: "Play today's attempt" })).toBeNull();
    expect(screen.getByRole('button', { name: 'Practise' })).toBeTruthy();
  });

  it('leads to the week\'s ranking, among the rankings', async () => {
    const { services } = withAccount(null);
    renderGame(<WeeklyChallenge />, services);
    fireEvent.click(await screen.findByRole('link', { name: "See the challenge ranking" }));
    expect(router.push).toHaveBeenCalledWith('/en/rankings?tab=challenge');
  });

  it('offers no attempt with no connection, and says what the web says to anyone who cannot have it: to sign in', async () => {
    network.connected = false;
    const { services } = withAccount({ entered: false, score: null });
    renderGame(<WeeklyChallenge />, services);
    await screen.findByRole('link', { name: "See the challenge ranking" });
    await waitFor(() => expect(screen.queryByRole('button', { name: "Play today's attempt" })).toBeNull());
    expect(screen.getByRole('button', { name: 'Practise' })).toBeTruthy();
    // The web's words, for a player who is signed in all the same: a question of words for the user, kept as the web has them.
    expect(screen.getByText('To play the attempt that counts, sign in. You can still practise.')).toBeTruthy();
  });

  it('begins the attempt asked for as a practice when the connection went while its question was open, as the web does', async () => {
    const { services, asked } = withAccount({ entered: false, score: null });
    await services.sessions.start('engineer');
    renderGame(<WeeklyChallenge />, services);
    asked.length = 0;
    fireEvent.click(await screen.findByRole('button', { name: "Play today's attempt" }));
    const sheet = (await screen.findByRole('heading', { name: 'End the life you are living?' })).closest('[aria-modal="true"]') as HTMLElement;
    act(() => network.set(false));
    await waitFor(() => expect(screen.queryByRole('button', { name: "Play today's attempt" })).toBeNull());
    fireEvent.click(within(sheet).getByRole('button', { name: 'End it and start this one' }));
    await waitFor(() => expect(asked).toEqual([{ lifeId: week.lifeId, ranked: false, challenge: week.week, replace: undefined }]));
  });

  it('asks again whether today\'s attempt is had each time the page is shown again: it stays drawn under the rankings opened from it', async () => {
    let entry = { entered: false, score: null as number | null };
    const services = memoryServices();
    const community = { challengeEntry: async () => entry } as unknown as Community;
    renderGame(<WeeklyChallenge />, { ...services, account: accountAs(guest), community: () => community });
    await screen.findByRole('button', { name: "Play today's attempt" });
    entry = { entered: true, score: 512 };
    await act(async () => focus.again());
    expect(await screen.findByText("You have played today's attempt. Your best this week: 512 points.")).toBeTruthy();
    expect(screen.queryByRole('button', { name: "Play today's attempt" })).toBeNull();
  });

  it('keeps today\'s attempt as had when the account, asked again, cannot say: the attempt is not offered again', async () => {
    let entry: { entered: boolean; score: number | null } | null = { entered: true, score: 512 };
    const services = memoryServices();
    const community = { challengeEntry: async () => entry } as unknown as Community;
    renderGame(<WeeklyChallenge />, { ...services, account: accountAs(guest), community: () => community });
    await screen.findByText("You have played today's attempt. Your best this week: 512 points.");
    entry = null;
    await act(async () => focus.again());
    expect(screen.getByText("You have played today's attempt. Your best this week: 512 points.")).toBeTruthy();
    expect(screen.queryByRole('button', { name: "Play today's attempt" })).toBeNull();
  });
});

describe('a ranked attempt with a ranked life in progress on another device', { timeout: 60_000 }, () => {
  const guest: AccountState = { kind: 'guest', userId: 'u', notice: null };
  const account: Account = { state: () => guest, subscribe: () => () => {}, start: async () => {}, keepWithGoogle: async () => true, useExistingAccount: async () => true, dismissNotice: () => {}, signOut: async () => false };
  /** A button of a sheet once it can be pressed: the sheet opens as the start that asked it ends, a moment before its buttons are free. */
  async function ready(sheet: HTMLElement, name: string) {
    const button = within(sheet).getByRole('button', { name });
    await waitFor(() => expect(button.getAttribute('aria-disabled')).not.toBe('true'));
    return button;
  }
  /** A device of the player, over a server of ranked lives several devices share. */
  function deviceOf(server: ReturnType<typeof rankedServer>) {
    const store = new MemoryStore();
    let ids = 0;
    let clock = 0;
    const versions = { engine: ENGINE_VERSION, content: CONTENT_VERSION };
    const deps = { newId: () => `local-${(ids += 1)}`, newSeed: () => `seed-${ids}`, now: () => (clock += 1) };
    const sessions = new GameSessions(store, new LocalSessions(store, content, lives, deps), new RankedSessions(() => server.api, store, content, lives, versions, deps), versions);
    // The day the server says it is (testing/rankedServer.ts): its week is the one it plays.
    return { sessions, store, account, tapGuardMs: 0, now: () => SERVER_NOW };
  }
  const SERVER_NOW = Date.UTC(2026, 9, 13, 12);
  const served = challengeOf(weekOf(SERVER_NOW), lives);
  if (!served) throw new Error('no challenge the server\'s week');

  it('asks first, and begins the attempt in its place only once the player says so and the question has gone', async () => {
    const server = rankedServer();
    const there = await deviceOf(server).sessions.start('nurse', { ranked: true });
    const phone = deviceOf(server);
    let gone: () => void = () => undefined;
    renderGame(<WeeklyChallenge />, phone);
    fireEvent.click(await screen.findByRole('button', { name: "Play today's attempt" }));
    const sheet = (await screen.findByRole('heading', { name: 'A ranked life in progress' })).closest('[aria-modal="true"]') as HTMLElement;
    expect(sheet.textContent).toContain('Nurse, round 1 of 20.');
    expect(router.replace).not.toHaveBeenCalled();
    expect(server.games.get(there.gameId)?.status).toBe('playing');
    sheets.gone = new Promise<void>((done) => (gone = done));
    fireEvent.click(await ready(sheet, 'End it and start this one'));
    await waitFor(() => expect(server.games.get(there.gameId)?.status).toBe('abandoned'));
    await waitFor(async () => expect((await phone.store.loadGame()) as RankedGame).toMatchObject({ ranked: true, lifeId: served.lifeId, challenge: served.week }));
    await new Promise((done) => setTimeout(done, 30));
    expect(router.replace).not.toHaveBeenCalled();
    gone();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/en/play'));
  });

  it('is taken up in place of the attempt when the player would rather go on with it, once the sheet has gone', async () => {
    const server = rankedServer();
    const there = await deviceOf(server).sessions.start('nurse', { ranked: true });
    const phone = deviceOf(server);
    renderGame(<WeeklyChallenge />, phone);
    fireEvent.click(await screen.findByRole('button', { name: "Play today's attempt" }));
    const sheet = (await screen.findByRole('heading', { name: 'A ranked life in progress' })).closest('[aria-modal="true"]') as HTMLElement;
    let gone: () => void = () => undefined;
    sheets.gone = new Promise<void>((done) => (gone = done));
    fireEvent.click(await ready(sheet, 'Continue that life'));
    await waitFor(async () => expect(((await phone.store.loadGame()) as RankedGame | null)?.gameId).toBe(there.gameId));
    // Taken up, the page waits for the sheet to leave before it changes under it.
    await new Promise((done) => setTimeout(done, 30));
    expect(router.replace).not.toHaveBeenCalled();
    gone();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/en/play'));
  });
});

describe('the result of the week\'s attempt', () => {
  const cards = textFor('en').text.cards;
  const show = (ranking: ChallengeRanking | null, choices: ChallengeChoice[] | null) => {
    const community = { challengeRanking: async () => ranking, challengeChoices: async () => choices } as unknown as Community;
    return renderGame(<ChallengeResult week="2026-W42" />, { ...memoryServices(), community: () => community });
  };

  it('says where it stands, and the three choices fewest others made, the least followed first, with all of them in a sheet', async () => {
    show(
      { rows: [{ place: 2, userId: 'me', nickname: null, score: 900, finishedAt: 0, mine: true }], entrants: 30 },
      [
        { cardId: 'health_illness', option: 0, same: 9, answered: 10 },
        { cardId: 'tax_advisor', option: 1, same: 3, answered: 10 },
        { cardId: 'career_raise', option: 1, same: 1, answered: 4 },
        { cardId: 'late_will', option: 1, same: 5, answered: 10 },
        // A card this build does not know is left out, rather than shown with no name.
        { cardId: 'gone_card', option: 0, same: 1, answered: 100 },
      ],
    );
    expect(await screen.findByText('Place 2 of 30 · Top 10%')).toBeTruthy();
    expect(document.querySelector('[data-sprite="icon.top_tenth"]')).not.toBeNull();
    const rare = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(rare).toEqual([
      `"${cards.career_raise.title}": you chose "${cards.career_raise.options[1].label}", like 25% of 4.`,
      `"${cards.tax_advisor.title}": you chose "${cards.tax_advisor.options[1].label}", like 30% of 10.`,
      `"${cards.late_will.title}": you chose "${cards.late_will.options[1].label}", like 50% of 10.`,
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'See all your choices (4)' }));
    const sheet = (await screen.findByRole('heading', { name: "Your choices, beside everyone's" })).closest('[aria-modal="true"]') as HTMLElement;
    expect(within(sheet).getAllByRole('listitem')).toHaveLength(4);
    expect(within(sheet).getAllByRole('listitem')[0].textContent).toContain(cards.health_illness.title);
    expect(within(sheet).getAllByRole('listitem')[0].textContent).toContain('9/10');
  });

  it('says where it stands alone before the week is over, when nobody has been told how others chose', async () => {
    show({ rows: [{ place: 7, userId: 'me', nickname: null, score: 900, finishedAt: 0, mine: true }], entrants: 30 }, []);
    expect(await screen.findByText('Place 7 of 30')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /See all your choices/ })).toBeNull();
  });

  it('shows nothing while there is nothing to say', async () => {
    const { container } = show(null, null);
    await settled();
    expect(container.textContent).toBe('');
  });
});

describe('the weekly challenge on the front door, for a player signed in', () => {
  const draw = (community: Partial<Community> | null) => renderGame(<WeeklyChallengeCard />, { ...memoryServices(), community: () => community as Community | null });

  it('says the attempt is still to play, and how long the week has left', async () => {
    draw({ challengeEntry: async () => ({ entered: false, score: null }) });
    expect(await screen.findByText(/^(Ends today|\d days? left)$/)).toBeTruthy();
  });

  it('says only that today\'s is played, once it is', async () => {
    draw({ challengeEntry: async () => ({ entered: true, score: 300 }) });
    expect(await screen.findByText('Played today')).toBeTruthy();
    expect(screen.queryByText(/^(Ends today|\d days? left)$/)).toBeNull();
  });
});

describe('what the challenge\'s page is drawn again for', () => {
  /** The page in a counter, beside a hand on the game, with a life in progress that is not the week's. */
  async function counted(extra: Partial<Services> = {}) {
    const services = memoryServices();
    await services.sessions.start('engineer');
    const renders: Renders = { count: 0 };
    let leave: (() => void) | null = null;
    function Hand() {
      leave = useGame((s) => s.leaveNews);
      return null;
    }
    render(
      <GameProvider services={speaking({ ...services, ...extra }, 'en')}>
        <Counted into={renders}>
          <WeeklyChallenge />
        </Counted>
        <Hand />
      </GameProvider>,
    );
    return { renders, leave: () => leave!() };
  }

  it('is not drawn again for a change of the game it does not show, nor for the connection where nobody is signed in', async () => {
    const { renders, leave } = await counted();
    await screen.findByRole('button', { name: 'Practise' });
    await steady(() => renders.count);
    const before = renders.count;
    await settled(() => leave());
    await settled(() => network.set(false));
    await settled(() => network.set(true));
    expect(renders.count).toBe(before);
  });

  it('is not drawn again for a change of the game it does not show once today\'s attempt is known', async () => {
    const community = { challengeEntry: async () => ({ entered: true, score: 777 }) } as unknown as Community;
    const guest: AccountState = { kind: 'guest', userId: 'u', notice: null };
    const account: Account = { state: () => guest, subscribe: () => () => {}, start: async () => {}, keepWithGoogle: async () => true, useExistingAccount: async () => true, dismissNotice: () => {}, signOut: async () => false };
    const { renders, leave } = await counted({ account, community: () => community });
    await screen.findByText("You have played today's attempt. Your best this week: 777 points.");
    await steady(() => renders.count);
    const before = renders.count;
    await settled(() => leave());
    expect(renders.count).toBe(before);
  });
});
