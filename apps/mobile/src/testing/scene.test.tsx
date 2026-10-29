// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { content } from '@ratrace/content';
import { SCENE_NOW, SCENES, sceneStore, screenOf } from '@ratrace/core/testing/scenes';
import type { Scene } from '@ratrace/core/testing/scenes';
import { textFor } from '@ratrace/content';
import { MemoryStore } from '@ratrace/core/session/memory';
import type { SavedGame } from '@ratrace/core/session/types';
import { formatFor } from '@ratrace/core/lib/format';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { useClock, useGame, useT } from '../game/context';
import { rea } from '../ui/testing/reanimated';
import { params } from './fakes';
import { memoryServices } from './memoryServices';
import { settled } from './renders';
import { FAULT_LINE, SCENE_SCREENS, SceneRoute, SceneView, servicesOf } from './scene';

/** A scene's store is built and its steps are taken on a machine that may be busy: waited for as long as a test is allowed, not the second a screen's test gives. */
const WAIT = { timeout: 15_000 };

/** The stages the screens of a test were first drawn at. */
const mounted: string[] = [];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  mounted.length = 0;
});

/** Stands for the screen a scene names: says which scene it was given, which game the scene put it in, what day it is there, and in which words. */
function Probe({ scene }: { scene: Scene }) {
  const state = useGame((s) => `${s.status} ${s.lifeId ?? '-'} ${s.stage} round ${s.view === null ? '-' : s.view.round + 1}`);
  const stage = useGame((s) => s.stage);
  const first = useRef(stage);
  useEffect(() => {
    mounted.push(first.current);
  }, []);
  const title = useT('meta')('title');
  const now = useClock()();
  return <div>{`${title} | ${state} | ${now} | ${scene.name}`}</div>;
}
const probes = Object.fromEntries(['home', 'new', 'play', 'records', 'collection'].map((word) => [word, (scene: Scene) => <Probe scene={scene} />]));

test('draws nothing until the scene\'s store is built, and then the screen its name starts with, given the scene, in the game the scene made', async () => {
  const { container } = render(<SceneView name="play-finance-r6" screens={probes} />);
  expect(container.textContent).toBe('');
  expect(await screen.findByText(`The Rat Race | playing engineer finance round 6 | ${SCENE_NOW} | play-finance-r6`, {}, WAIT)).toBeTruthy();
});

test('a scene with no life is a game with no life in progress', async () => {
  render(<SceneView name="home-new" screens={probes} />);
  expect(await screen.findByText(`The Rat Race | none - news round - | ${SCENE_NOW} | home-new`, {}, WAIT)).toBeTruthy();
});

test('a life half played is opened where the scene left it', async () => {
  render(<SceneView name="play-cards-r1" screens={probes} />);
  expect(await screen.findByText(/playing engineer cards round 1 \|/, {}, WAIT)).toBeTruthy();
  cleanup();
  render(<SceneView name="home-continue" screens={probes} />);
  expect(await screen.findByText(/playing nurse news round 3 \|/, {}, WAIT)).toBeTruthy();
});

test('a scene that goes on once the game is open is drawn after it has: the screen is first drawn at the stage the scene ends on', async () => {
  render(<SceneView name="play-outcome-r1" screens={probes} />);
  expect(await screen.findByText(/playing engineer outcome round 1 \|/, {}, WAIT)).toBeTruthy();
  // The probe says where it was first drawn from its mount's effect, which React runs after the page shows its text: waited for, not read at once.
  await waitFor(() => expect(mounted).toEqual(['outcome']), WAIT);
  cleanup();
  mounted.length = 0;
  render(<SceneView name="play-resolve-r6" screens={probes} />);
  // The sixth round is played: the life is at its seventh.
  expect(await screen.findByText(/playing engineer resolve round 7 \|/, {}, WAIT)).toBeTruthy();
  await waitFor(() => expect(mounted).toEqual(['resolve']), WAIT);
});

test('a script that cannot be taken is told, and no screen is drawn on a game that is not where the scene says', async () => {
  const told = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  // The ledger's script on a scene's game that is at the news.
  const services = servicesOf({ name: 'play-resolve-r6', locale: 'en' }, await sceneStore('play-news-r1'));
  const { SceneGame } = await import('./scene');
  render(<SceneGame scene={{ name: 'play-resolve-r6', locale: 'en' }} services={services} screens={probes} />);
  await vi.waitFor(() => expect(told).toHaveBeenCalled(), WAIT);
  expect(String(told.mock.calls[0][0])).toContain('scene play-resolve-r6');
  expect(mounted).toEqual([]);
  expect(screen.queryByText(/The Rat Race/)).toBeNull();
  told.mockRestore();
});

test('a name that is not a scene shows the scenes there are, instead of a screen', () => {
  render(<SceneView name="play-nowhere" screens={probes} />);
  expect(screen.getByText(/unknown scene: play-nowhere/)).toBeTruthy();
  for (const { name } of SCENES) expect(document.body.textContent).toContain(name);
  cleanup();
  render(<SceneView name={undefined} screens={probes} />);
  expect(screen.getByText(/unknown scene: -/)).toBeTruthy();
});

test('every scene has a screen to be drawn on, which takes the scene (a sheet is the scene\'s to say)', () => {
  for (const scene of SCENES) expect(SCENE_SCREENS[screenOf(scene)], scene.name).toBeTypeOf('function');
});

test('a scene is drawn in the language it names, on the day every scene is drawn on, whatever the phone speaks and whatever the day is', () => {
  const store = new MemoryStore();
  for (const locale of ['en', 'es', 'ru'] as const) expect(servicesOf({ name: 'home-new', locale }, store).language?.read()).toBe(locale);
  expect(servicesOf({ name: 'home-new', locale: 'es' }, store).store).toBe(store);
  const clock = servicesOf({ name: 'home-new', locale: 'en' }, store).now;
  expect(clock?.()).toBe(SCENE_NOW);
  expect(new Date(SCENE_NOW).toISOString()).toBe('2026-10-22T12:00:00.000Z');
});

test('the life of a scene is the life the screens\' tests begin: same id, same seed, same clock', async () => {
  const fromScene = (await (await sceneStore('play-news-r1')).loadGame()) as SavedGame;
  const services = memoryServices();
  await services.sessions.start('engineer');
  expect(fromScene).toEqual(await services.store.loadGame());
  expect(fromScene).toMatchObject({ gameId: 'id-1', seed: 'screen-seed-1' });
});

test('the route shows the scene its address names', async () => {
  params.name = 'home-new';
  render(<SceneRoute />);
  // The scene's screen, the front door: the name of the game, and the way to a new life.
  expect(await screen.findByRole('link', { name: 'New life' }, WAIT)).toBeTruthy();
  expect(screen.getByText('The Rat Race')).toBeTruthy();
});

test('the front door of a scene that names its settings is drawn with the sheet open, without a tap', async () => {
  render(<SceneView name="home-settings" />);
  expect(await screen.findByRole('heading', { name: 'Settings' }, WAIT)).toBeTruthy();
  // The page under the sheet is the front door of a life in progress.
  expect(screen.getByRole('link', { name: /Continue your life/ })).toBeTruthy();
  cleanup();
  // A scene that names no sheet has none open.
  render(<SceneView name="home-continue" />);
  expect(await screen.findByRole('link', { name: /Continue your life/ }, WAIT)).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Settings' })).toBeNull();
});

test('the scenes of the account are drawn over the account each names, which stays so: the settings of the door for a guest and a member, the account\'s life with its question open, a guest being taken in', async () => {
  render(<SceneView name="settings-account-guest" />);
  const guest = (await screen.findByRole('heading', { name: 'Settings' }, WAIT)).closest('[aria-modal="true"]') as HTMLElement;
  expect(within(within(guest).getByRole('region', { name: 'Account' })).getByRole('button', { name: 'Sign in with Google' })).toBeTruthy();
  expect(within(guest).queryByText('Your life saves itself after every step.')).toBeNull();
  cleanup();
  render(<SceneView name="settings-account-member" />);
  const member = (await screen.findByRole('heading', { name: 'Settings' }, WAIT)).closest('[aria-modal="true"]') as HTMLElement;
  expect(within(member).getByRole('region', { name: 'Account' }).textContent).toContain('Linked to Google');
  expect(within(member).getByRole('region', { name: 'Account' }).textContent).toContain('an•••@example.com');
  expect(within(member).getByRole('button', { name: 'Sign out' })).toBeTruthy();
  cleanup();
  render(<SceneView name="home-offer" />);
  const offer = (await screen.findByRole('heading', { name: 'A life on another device' }, WAIT)).closest('[aria-modal="true"]') as HTMLElement;
  expect(offer.textContent).toContain('Software engineer, age 30, in Madrid.');
  expect(offer.textContent).toContain('Picking it up here ends the life on this device: Nurse, age 26.');
  expect(screen.getByRole('button', { name: /Pick up the life from your other device/ })).toBeTruthy();
  cleanup();
  render(<SceneView name="home-account-taken" />);
  expect((await screen.findByRole('status', {}, WAIT)).textContent).toBe('You already have an account. Signing you in…');
  expect(screen.getByRole('link', { name: /Continue your life/ })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Sign in with Google' })).toBeNull();
});

test('a life a newer version of the game wrote is told on the front door of its scene, and the front door has no life to continue', async () => {
  render(<SceneView name="home-lost-newer" />);
  expect((await screen.findByRole('status', {}, WAIT)).textContent).toContain('newer version of the game');
  expect(screen.queryByRole('link', { name: /Continue your life/ })).toBeNull();
});

test('the pages with a scene of their own are drawn on the day every scene is: the week\'s challenge ends on its Sunday, and the legal notice is the notice', async () => {
  render(<SceneView name="challenge-practice" />);
  expect(await screen.findByRole('heading', { name: 'Weekly challenge' }, WAIT)).toBeTruthy();
  expect(document.body.textContent).toContain('Ends on 25 Oct 2026, at midnight UTC.');
  cleanup();
  render(<SceneView name="legal" />);
  expect((await screen.findAllByRole('heading', {}, WAIT))[0].textContent).toBe('Privacy and legal notice');
});

test('a scene of the Hud is drawn as Play will draw it, with the sheet it names open without a tap, and none where it names none', async () => {
  render(<SceneView name="hud-cash" />);
  expect(await screen.findByRole('heading', { name: 'Cash' }, WAIT)).toBeTruthy();
  // Under it, the Hud of the engineer's first round.
  expect(screen.getByText('Age 22')).toBeTruthy();
  cleanup();
  render(<SceneView name="hud-jailed" />);
  expect(await screen.findByRole('heading', { name: 'Prison' }, WAIT)).toBeTruthy();
  expect(screen.getByText('1 round left to serve')).toBeTruthy();
  cleanup();
  render(<SceneView name="hud-news-r1" />);
  expect(await screen.findByText('Age 22', {}, WAIT)).toBeTruthy();
  expect(screen.queryByRole('heading')).toBeNull();
});

test('a scene for a narrower phone is drawn in a box that wide, in the middle of the screen', async () => {
  render(<SceneView name="hud-status-ru" />);
  await screen.findByRole('heading', { name: 'Статус' }, WAIT);
  const box = [...document.querySelectorAll<HTMLElement>('div')].find((el) => el.style.width === '360px');
  expect(box?.style.alignSelf).toBe('center');
  expect(box?.textContent).toContain('22');
  cleanup();
  render(<SceneView name="hud-news-r1" />);
  await screen.findByText('Age 22', {}, WAIT);
  expect([...document.querySelectorAll<HTMLElement>('div')].some((el) => el.style.width === '360px')).toBe(false);
});

test('a scene of the play screen is drawn by Play itself: the news with no tip for a player who has read them, the first tip for someone new', async () => {
  render(<SceneView name="play-news-r1" />);
  expect(await screen.findByRole('heading', { name: 'News' }, WAIT)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'See what life brings' })).toBeTruthy();
  expect(screen.queryByRole('note', { name: 'Guide' })).toBeNull();
  cleanup();
  render(<SceneView name="play-guide-r1" />);
  expect((await screen.findByRole('note', { name: 'Guide' }, WAIT)).textContent).toContain('Every round opens with the paper');
});

test('the scene of a fault is the play screen\'s way out; the one line its game writes to the log is kept from the log while that scene is drawn, and only then', async () => {
  const told = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    render(<SceneView name="play-fault" />);
    expect((await screen.findByRole('alert', {}, WAIT)).textContent).toContain('Something went wrong');
    expect(screen.getByRole('link', { name: 'New life' })).toBeTruthy();
    // The game says it, in these words (core's scenes.test hears it), and the log was not told: in development it would be drawn over the shot.
    // (Read by path: the app's route brings in a `URL` of its own, which does not resolve against a file's address.)
    expect(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../../packages/core/src/game/store.ts'), 'utf8')).toContain(`console.error('${FAULT_LINE}', error);`);
    expect(told.mock.calls.map((call) => call[0])).not.toContain(FAULT_LINE);
    // Any other line still is.
    console.error('something else');
    expect(told).toHaveBeenLastCalledWith('something else');
    cleanup();
    // The scene gone, the same line from anywhere else is an error the log shows, as it always is.
    console.error(FAULT_LINE, new Error('elsewhere'));
    expect(told).toHaveBeenLastCalledWith(FAULT_LINE, new Error('elsewhere'));
    // And a scene of a game that goes on keeps nothing from the log.
    render(<SceneView name="play-news-r1" />);
    await screen.findByRole('heading', { name: 'News' }, WAIT);
    console.error(FAULT_LINE, 'here');
    expect(told).toHaveBeenLastCalledWith(FAULT_LINE, 'here');
  } finally {
    told.mockRestore();
  }
});

test('the scene of the calendar is the news of the second round with its page turning over it, held at one moment of its run', async () => {
  render(<SceneView name="play-pageturn" />);
  expect(await screen.findByRole('heading', { name: 'News' }, WAIT)).toBeTruthy();
  const calendar = document.querySelector('[data-motion-only]') as HTMLElement;
  expect(calendar.querySelector('[data-page="torn"]')?.textContent).toContain('22');
  expect(calendar.querySelector('[data-page="new"]')?.textContent).toContain('24');
  // Held: the torn page is part way down, and stays.
  const torn = calendar.querySelector('[data-page="torn"]') as HTMLElement;
  expect(Number(torn.style.opacity)).toBeGreaterThan(0);
  expect(Number(torn.style.opacity)).toBeLessThan(1);
});

test('a scene opened for a shot says when it is ready, to the driver on this machine: once drawn and every picture of it read; opened for nothing else, it says nothing', async () => {
  const said = vi.fn<(url: string) => Promise<Response>>(async () => new Response('ok'));
  vi.stubGlobal('fetch', said);
  render(<SceneView name="play-news-r6" readyPort={8093} />);
  await screen.findByRole('heading', { name: 'News' }, WAIT);
  // Not ready while it is built, then ready, in that order.
  await waitFor(() => expect(said).toHaveBeenLastCalledWith(expect.stringMatching(/^http:\/\/127\.0\.0\.1:8093\/ready\?name=play-news-r6&ready=1&n=\d+$/)));
  const words = said.mock.calls.map(([url]) => /ready=(\d)&n=(\d+)$/.exec(url)!.slice(1).map(Number));
  expect(words[0][0]).toBe(0);
  // Numbered in the order said, one count for the app (a scene drawn again speaks after).
  expect(words.map(([, n]) => n - words[0][1])).toEqual(words.map((_, i) => i));
  cleanup();
  said.mockClear();
  render(<SceneView name="play-news-r1" />);
  await screen.findByRole('heading', { name: 'News' }, WAIT);
  await settled();
  expect(said).not.toHaveBeenCalled();
  cleanup();
  // The route takes the port from its address (`&ready=`), as the driver opens it.
  params.name = 'play-news-r6';
  params.ready = '8093';
  render(<SceneRoute />);
  await screen.findByRole('heading', { name: 'News' }, WAIT);
  await waitFor(() => expect(said).toHaveBeenLastCalledWith(expect.stringMatching(/ready\?name=play-news-r6&ready=1&n=\d+$/)));
});

test('the scene of an amount is the sheet that moves cash to savings, open over the Hud of the finances (as recorded before the phone had Finance): all the cash there is to move', async () => {
  render(<SceneView name="amount-savings" />);
  const sheet = (await screen.findByRole('heading', { name: 'Move cash to savings' }, WAIT)).closest('[aria-modal="true"]') as HTMLElement;
  // The figures of the Hud under it, at the finances: its cash is the most that can be moved.
  const cash = screen.getByRole('button', { name: /Cash/ });
  expect(sheet.contains(cash)).toBe(false);
  expect(sheet.textContent).toMatch(/Up to \$[\d,]+/);
  expect(screen.getByRole('slider', { name: 'Amount' })).toBeTruthy();
  // Nothing of the stage is drawn under it: the web's shot shows the Hud alone (sceneShots.ts).
  expect(screen.queryByRole('main')).toBeNull();
});

test('the scene of a legendary badge is the reward sheet over the Hud of the card that earned it, the rarest of the step\'s two first: the stage it belongs to is mounted (as the web\'s, hidden) and draws nothing in the page', async () => {
  render(<SceneView name="celebrate-legendary" />);
  const sheet = (await screen.findByRole('heading', { name: 'Viral by mistake' }, WAIT)).closest('[aria-modal="true"]') as HTMLElement;
  expect(sheet.textContent).toContain('Legendary badge');
  expect(sheet.textContent).toContain('1 of 2');
  expect(sheet.querySelector('[data-sprite="rim.gem"]')).toBeTruthy();
  expect(within(sheet).getByRole('button', { name: 'Accept' })).toBeTruthy();
  expect(screen.getByRole('button', { name: /Cash/ })).toBeTruthy();
  // No small card of a badge anywhere in the page.
  expect(screen.queryAllByRole('status')).toEqual([]);
});

test('the scene of the badges a step earned, once accepted, leaves nothing of them under the Hud', async () => {
  render(<SceneView name="celebrate-earned" />);
  expect(await screen.findByRole('button', { name: /Cash/ }, WAIT)).toBeTruthy();
  expect(screen.queryAllByRole('status')).toEqual([]);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.queryByText('Viral by mistake')).toBeNull();
});

test('the scene of a milestone reached for the first time ever is the first step of the round\'s one sheet, the step\'s badges after it, the rarest first: one headline, its scene, no portrait', async () => {
  render(<SceneView name="celebrate-milestone" />);
  const sheet = (await screen.findByRole('heading', { name: '100k net worth at 26!' }, WAIT)).closest('[aria-modal="true"]') as HTMLElement;
  expect(sheet.textContent).toContain('1 of 3');
  expect(sheet.textContent).toContain('First time ever!');
  expect(sheet.textContent).toContain('Six figures to your name.');
  // The headline said once, as the sheet's title; the name alone nowhere else.
  expect(within(sheet).getAllByText((_, el) => el?.textContent === '100k net worth at 26!' && el.children.length === 0)).toHaveLength(1);
  expect(sheet.textContent?.split('100k net worth').length).toBe(2);
  // The milestone's scene, and no portrait of the life.
  expect(sheet.querySelector('[data-reward="milestone.worth100k"]')).toBeTruthy();
  expect(sheet.querySelector('[data-sprite^="portrait."]')).toBeNull();
  expect(within(sheet).getByRole('button', { name: 'Onwards!' })).toBeTruthy();
  // One sheet: the badges are its next steps, not inside the milestone, the rarest first.
  expect(sheet.textContent).not.toContain('Viral by mistake');
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  fireEvent.click(within(sheet).getByRole('button', { name: 'Onwards!' }));
  const legendary = screen.getByRole('heading', { name: 'Viral by mistake' }).closest('[aria-modal="true"]') as HTMLElement;
  expect(legendary.textContent).toContain('2 of 3');
  expect(legendary.textContent).toContain('Legendary badge');
  fireEvent.click(within(legendary).getByRole('button', { name: 'Accept' }));
  expect(screen.getByRole('dialog').textContent).toContain('3 of 3');
});

test('the scene of a milestone in a later life is its banner under the Hud, the step\'s badges left to their reward sheet (accepted in the scene)', async () => {
  render(<SceneView name="celebrate-milestone-banner" />);
  const [banner, ...rest] = await screen.findAllByRole('status', {}, WAIT);
  expect(rest).toEqual([]);
  expect(banner.textContent).toContain('100k net worth');
  expect(banner.textContent).toContain('At 26');
  expect(banner.textContent).not.toContain('New record');
  expect(banner.textContent).not.toContain('Viral by mistake');
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('the scenes of the cards are drawn by the card stage itself, each at its card, nothing taken', async () => {
  const cards = [
    { name: 'play-cards-r1', choices: /^Your choices: The betting app$/, count: 3, swipe: false, tip: true },
    { name: 'play-cards-legendary', choices: /^Your choices: The appointment$/, count: 2, swipe: true, tip: false },
    { name: 'play-cards-three', choices: /^Your choices: Ask for a raise$/, count: 3, swipe: false, tip: false },
  ];
  for (const card of cards) {
    render(<SceneView name={card.name} />);
    const group = await screen.findByRole('group', { name: card.choices }, WAIT);
    const choices = within(group).getAllByRole('button');
    expect(choices, card.name).toHaveLength(card.count);
    for (const choice of choices) expect(choice.getAttribute('aria-selected'), card.name).not.toBe('true');
    expect(screen.queryByText('Swipe the card, or tap a choice') !== null, card.name).toBe(card.swipe);
    // The first card scene keeps the tip of the guide under the choices; the others are for a player who has read it.
    expect(screen.queryByRole('note', { name: 'Guide' }) !== null, card.name).toBe(card.tip);
    cleanup();
  }
});

test('the Russian card is drawn on a phone 360 wide: its three long choices, the one the trade opens tagged', async () => {
  render(<SceneView name="play-cards-ru-360" />);
  const group = await screen.findByRole('group', { name: 'Твои варианты: Бум ИИ' }, WAIT);
  const choices = within(group).getAllByRole('button');
  expect(choices).toHaveLength(3);
  expect(choices[2].textContent).toContain('Благодаря профессии');
  const box = [...document.querySelectorAll<HTMLElement>('div')].find((el) => el.style.width === '360px');
  expect(box?.contains(group)).toBe(true);
});

test('a scene of a legendary card holds its shine still where the web\'s page holds it: no rainbow or light runs, and its sparks are gone', async () => {
  rea.assigned.length = 0;
  render(<SceneView name="play-cards-legendary" />);
  await screen.findByRole('group', { name: /^Your choices: The appointment$/ }, WAIT);
  const card = screen.getByRole('article');
  // The rainbow drawn in the picture, and the band of light over it, each at one moment of its run: no loop runs anywhere on the page.
  expect(card.querySelector('[data-sprite] [data-skia="Group"]')).not.toBeNull();
  expect(rea.assigned.filter((one) => one.kind === 'repeat')).toEqual([]);
  const sparks = [...card.querySelectorAll<HTMLElement>('[aria-hidden="true"] > div')];
  expect(sparks).toHaveLength(16);
  for (const spark of sparks) expect(spark.style.opacity).toBe('0');
});

test('the scene of a card\'s result is drawn by the result itself: the card answered, the choice made and what it changed', async () => {
  render(<SceneView name="play-outcome-r1" />);
  expect(await screen.findByRole('heading', { name: 'What happened' }, WAIT)).toBeTruthy();
  const card = screen.getByRole('article');
  expect(within(card).getByText('You chose: Take it')).toBeTruthy();
  expect(card.querySelector('[data-sprite^="card."]')).not.toBeNull();
  expect(within(screen.getByRole('region', { name: 'What changes' })).getByText(formatFor('en').briefSigned(250_000))).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Next card' })).toBeTruthy();
});

test('a scene\'s screen takes no touch, and a scene whose game moves on all the same stops saying it is ready: it is never shot as a picture it is not', async () => {
  const said = vi.fn<(url: string) => Promise<Response>>(async () => new Response('ok'));
  vi.stubGlobal('fetch', said);
  render(<SceneView name="play-cards-r1" readyPort={8093} />);
  const group = await screen.findByRole('group', { name: /^Your choices/ }, WAIT);
  // No touch reaches the screen: the box it is drawn in takes none, and holds all of it.
  let box: HTMLElement | null = group;
  while (box && box.style.pointerEvents !== 'none') box = box.parentElement;
  expect(box?.contains(screen.getByRole('main'))).toBe(true);
  await waitFor(() => expect(said).toHaveBeenLastCalledWith(expect.stringMatching(/ready=1&n=\d+$/)));
  // A choice taken all the same (here by the test, as a tap the box let through would): the scene is no longer the picture it was, and says so.
  fireEvent.click(within(group).getAllByRole('button')[0]);
  await waitFor(() => expect(said).toHaveBeenLastCalledWith(expect.stringMatching(/ready=0&n=\d+$/)));
});

test('the finances of a scene are drawn by Finance itself in Play: the portfolio under its tab, and for someone new the guide\'s first tip over the tabs', async () => {
  render(<SceneView name="play-finance-r6" />);
  expect(await screen.findByRole('tab', { name: 'Portfolio' }, WAIT)).toBeTruthy();
  expect(screen.getByRole('tabpanel', { name: 'Portfolio' })).toBeTruthy();
  expect(screen.getByLabelText('At a glance')).toBeTruthy();
  const tip = screen.getByRole('note', { name: 'Guide' });
  expect(tip.compareDocumentPosition(screen.getByRole('tablist')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.queryByText('🚧')).toBeNull();
});

test('the scene of the basket is its sheet open over the finances, beside Play as the web\'s page draws it, listing the saver\'s orders of the round', async () => {
  render(<SceneView name="finance-basket" />);
  const sheet = (await screen.findByRole('heading', { name: "This round's orders" }, WAIT)).closest('[aria-modal="true"]') as HTMLElement;
  expect(within(sheet).getAllByRole('listitem')).toHaveLength(3);
  expect(within(sheet).getByText(/^Save /)).toBeTruthy();
  expect(screen.getByRole('button', { name: '3 orders' })).toBeTruthy();
  // For a player who has read the guide: nothing of it under the sheet.
  expect(screen.queryByRole('note', { name: 'Guide' })).toBeNull();
});

test('the scene of the pension is its sheet open over the finances, given to Finance as its initial state, without a tap', async () => {
  render(<SceneView name="finance-pension" />);
  const sheet = (await screen.findByRole('heading', { name: 'Pension plan' }, WAIT)).closest('[aria-modal="true"]') as HTMLElement;
  expect(within(sheet).getByText(/^Money set aside for retirement/)).toBeTruthy();
  expect(within(sheet).getByRole('button', { name: /^Confirm/ })).toBeTruthy();
  expect(screen.getByRole('tabpanel', { name: 'Portfolio' })).toBeTruthy();
});

test('the Russian tabs are drawn on a phone 360 wide, in their row under the Hud', async () => {
  render(<SceneView name="finance-tabs-ru-360" />);
  const strip = await screen.findByRole('tablist', { name: 'Твои финансы' }, WAIT);
  const box = [...document.querySelectorAll<HTMLElement>('div')].find((el) => el.style.width === '360px');
  expect(box?.contains(strip)).toBe(true);
  expect(within(strip).getByRole('tab', { name: 'Портфель' }).getAttribute('aria-selected')).toBe('true');
});

test('the scenes of the market, property and debts are drawn by Finance on the tab each names, given as its initial state, without a tap', async () => {
  render(<SceneView name="finance-market" />);
  const market = await screen.findByRole('tabpanel', { name: 'Market' }, WAIT);
  expect(screen.getByRole('tab', { name: 'Market' }).getAttribute('aria-selected')).toBe('true');
  expect(within(market).getByText('Apple')).toBeTruthy();
  // For a player who has read the guide: the market itself, and nothing open over it.
  expect(screen.queryByRole('note', { name: 'Guide' })).toBeNull();
  expect(document.querySelector('[aria-modal="true"]')).toBeNull();
  cleanup();

  render(<SceneView name="finance-property" />);
  const property = await screen.findByRole('tabpanel', { name: 'Property' }, WAIT);
  expect(within(property).getByText('You own no property.')).toBeTruthy();
  expect(within(property).getByLabelText('Homes in London')).toBeTruthy();
  cleanup();

  render(<SceneView name="finance-debt" />);
  const debt = await screen.findByRole('tabpanel', { name: 'Debt' }, WAIT);
  expect(within(debt).getByText('Personal loan')).toBeTruthy();
  expect(within(debt).getByRole('button', { name: 'Repay' })).toBeTruthy();
  expect(within(debt).getByRole('button', { name: 'Take a personal loan' })).toBeTruthy();
});

test('the scene of a stock to buy is the market with Apple\'s sheet open, its price since the start of the life drawn in it', async () => {
  render(<SceneView name="finance-buy-stock" />);
  const sheet = (await screen.findByRole('heading', { name: 'Buy Apple' }, WAIT)).closest('[aria-modal="true"]') as HTMLElement;
  expect(within(sheet).getByRole('radio', { name: /^Once/ }).getAttribute('aria-checked')).toBe('true');
  expect(within(sheet).getByText('Price since the start')).toBeTruthy();
  expect(within(sheet).getByRole('img', { name: 'Price history' })).toBeTruthy();
  expect(screen.getByRole('tabpanel', { name: 'Market' })).toBeTruthy();
});

test('the scenes of the way of life are drawn by Finance on its tab, given as its initial state: the tab itself, and the sheet of every city open over it', async () => {
  render(<SceneView name="finance-lifestyle" />);
  const tab = await screen.findByRole('tabpanel', { name: 'Lifestyle' }, WAIT);
  expect(screen.getByRole('tab', { name: 'Lifestyle' }).getAttribute('aria-selected')).toBe('true');
  // The panels under the first screen come once the first are on it (ui/drawnFirst.ts).
  expect(await within(tab).findByRole('radiogroup', { name: 'How you live' }, WAIT)).toBeTruthy();
  expect(within(tab).getByRole('button', { name: 'Move to another city' })).toBeTruthy();
  // For a player who has read the guide: the tab itself, and nothing open over it.
  expect(screen.queryByRole('note', { name: 'Guide' })).toBeNull();
  expect(document.querySelector('[aria-modal="true"]')).toBeNull();
  cleanup();

  render(<SceneView name="finance-move" />);
  const sheet = (await screen.findByRole('heading', { name: 'Move to another city' }, WAIT)).closest('[aria-modal="true"]') as HTMLElement;
  expect(within(sheet).getAllByRole('listitem')).toHaveLength(content.cities.length);
  expect(screen.getByRole('tabpanel', { name: 'Lifestyle' })).toBeTruthy();
});

test('the scene of a city a card offers is its sheet open beside the cards, as the card\'s link opens it: London beside the engineer\'s city, nothing to order', async () => {
  render(<SceneView name="play-cards-city" />);
  const sheet = (await screen.findByRole('heading', { name: 'London' }, WAIT)).closest('[aria-modal="true"]') as HTMLElement;
  expect(within(sheet).getByRole('region', { name: 'London' }).textContent).toContain('Left over a year');
  expect(within(sheet).queryByRole('button', { name: 'Move here' })).toBeNull();
  // Over the card that offers it, whose link says so.
  expect(screen.getByRole('button', { name: 'See London beside your city' })).toBeTruthy();
});

test('the scene of the work panel is the profile\'s panel on a page of its own, for the life as it stands', async () => {
  render(<SceneView name="work-panel" />);
  const panel = await screen.findByLabelText('Work', {}, WAIT);
  expect(within(panel).getByRole('region', { name: 'Skills' })).toBeTruthy();
  expect(within(panel).getByRole('progressbar')).toBeTruthy();
  expect(screen.queryByRole('tablist')).toBeNull();
});

test('the scenes of the shop are drawn by Finance on its tab, given as its initial state: the shelves in reach, and a watch\'s sheet open over them', async () => {
  render(<SceneView name="finance-shop" />);
  const shop = await screen.findByRole('tabpanel', { name: 'Shop' }, WAIT);
  expect(screen.getByRole('tab', { name: 'Shop' }).getAttribute('aria-selected')).toBe('true');
  expect(within(shop).getByRole('radio', { name: 'In reach' }).getAttribute('aria-checked')).toBe('true');
  expect(await within(shop).findByRole('button', { name: /Omega Speedmaster/ }, WAIT)).toBeTruthy();
  expect(document.querySelector('[aria-modal="true"]')).toBeNull();
  cleanup();

  render(<SceneView name="finance-item" />);
  const sheet = (await screen.findByRole('heading', { name: 'Omega Speedmaster' }, WAIT)).closest('[aria-modal="true"]') as HTMLElement;
  expect(within(sheet).getByRole('button', { name: /^Buy for / })).toBeTruthy();
  expect(within(sheet).getByRole('button', { name: /^On instalments/ })).toBeTruthy();
  expect(within(sheet).getByRole('region', { name: 'Second hand' })).toBeTruthy();
  expect(within(sheet).getByRole('region', { name: 'Without an invoice' })).toBeTruthy();
  expect(screen.getByRole('tabpanel', { name: 'Shop' })).toBeTruthy();
});

test('the scene of the taxes is the tab of the round as it will resolve, what is not declared among it', async () => {
  render(<SceneView name="finance-taxes" />);
  const taxes = await screen.findByRole('tabpanel', { name: 'Taxes' }, WAIT);
  expect(within(taxes).getByLabelText('What you do not declare')).toBeTruthy();
  expect(within(taxes).getByRole('progressbar', { name: 'Escape test' })).toBeTruthy();
});

test('the scene of the businesses is the founder\'s first round at the tab: her shop on its line, its two switches, and what she could open', async () => {
  render(<SceneView name="finance-business" />);
  const tab = await screen.findByRole('tabpanel', { name: 'Business' }, WAIT);
  const mine = within(tab).getByLabelText('Your businesses');
  expect(within(mine).getByRole('button', { name: /Online shop/ })).toBeTruthy();
  expect(within(mine).getByRole('button', { name: /Run it yourself/ })).toBeTruthy();
  expect(within(within(tab).getByLabelText('Open a business')).getAllByRole('listitem').length).toBeGreaterThan(0);
  expect(screen.queryByRole('note', { name: 'Guide' })).toBeNull();
});

test('the scenes of the profile are its sheet open over Play, as the portrait opens it, with a thing or a line of its balance open over it from the start', async () => {
  const sheetOf = async (title: string) => (await screen.findByRole('heading', { name: title }, WAIT)).closest('[aria-modal="true"]') as HTMLElement;
  render(<SceneView name="profile-r6" />);
  const profile = await sheetOf('Your life');
  expect(within(profile).getByText('BALANCE SHEET')).toBeTruthy();
  // Under it, the news of the sixth round.
  expect(screen.getByRole('heading', { name: 'News' })).toBeTruthy();
  cleanup();
  render(<SceneView name="profile-owned" />);
  const watch = await sheetOf('Casio F-91W');
  expect(within(watch).getByText(/^Would sell for /)).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Your life' })).toBeTruthy();
  cleanup();
  render(<SceneView name="balance-r6" />);
  const worth = await sheetOf('Net worth');
  // The graph of the five rounds played, and the start: six bars.
  expect(within(worth).getByRole('img').style.width).toBe(`${6 * 14 - 4}px`);
  expect(screen.getByRole('heading', { name: 'Your life' })).toBeTruthy();
});

test('the scene of a thing bought on instalments is its sheet over the profile, with what is still owed on it beside its figure', async () => {
  render(<SceneView name="profile-financed" />);
  const car = (await screen.findByRole('heading', { name: 'SEAT Ibiza' }, WAIT)).closest('[aria-modal="true"]') as HTMLElement;
  const owed = within(car).getByRole('note');
  expect(within(owed).getByText('Still owed on the loan')).toBeTruthy();
  expect(owed.textContent).toMatch(/\$[\d,]+/);
  expect(screen.getByRole('heading', { name: 'Your life' })).toBeTruthy();
});

test('the scene of the rivals is their board alone on a page, where the engineer stands among them', async () => {
  render(<SceneView name="rivals-r6" />);
  const board = await screen.findByLabelText('Your rivals', {}, WAIT);
  expect(within(board).getByText(/^You are #\d of 4$/)).toBeTruthy();
  expect(within(board).getAllByRole('listitem')).toHaveLength(4);
  expect(screen.queryByRole('heading', { name: 'Your life' })).toBeNull();
});

test('the scenes of the end of a life are its end screen, Play\'s last stage, with the picture to share open over it where the scene names it', async () => {
  render(<SceneView name="end-escaped" />);
  expect(await screen.findByRole('heading', { name: 'The end' }, WAIT)).toBeTruthy();
  expect(screen.getByText('You left the rat race at 54.')).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'A picture of this life' })).toBeNull();
  cleanup();
  render(<SceneView name="end-share" />);
  const sheet = (await screen.findByRole('heading', { name: 'A picture of this life' }, WAIT)).closest('[aria-modal="true"]') as HTMLElement;
  expect(await within(sheet).findByRole('img', { name: new RegExp(`^${textFor('en').text.lives.engineer.name}: score `) }, WAIT)).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'The end' })).toBeTruthy();
  cleanup();
  render(<SceneView name="end-bankrupt" />);
  expect(await screen.findByText('Bankrupt once', {}, WAIT)).toBeTruthy();
  expect(screen.getByText('You never left the rat race.')).toBeTruthy();
  cleanup();
  render(<SceneView name="end-ru" />);
  expect(await screen.findByRole('heading', { name: 'Конец' }, WAIT)).toBeTruthy();
});

test('the scene of the ledger is drawn by the ledger itself, every line risen and every figure where it ends: no loop turns, and nothing is left to fly', async () => {
  rea.assigned.length = 0;
  render(<SceneView name="play-resolve-r6" />);
  const ledger = await screen.findByRole('table', { name: 'What came in and went out' }, WAIT);
  const rows = within(ledger).getAllByRole('row');
  expect(rows.length).toBeGreaterThan(2);
  for (const row of rows) expect((row.parentElement as HTMLElement).style.opacity).toBe('1');
  // The cash stands where it ends: the figure is what a screen reader is told (under the ledger, once it is on screen: ui/drawnFirst.ts).
  await screen.findByText('Cash now', {}, WAIT);
  const counted = document.querySelector<HTMLElement>('[data-coin-to]') as HTMLElement;
  const [said, shown] = [...counted.children].map((part) => part.textContent);
  expect(shown).toBe(said);
  expect(rea.assigned.filter((one) => one.kind === 'repeat')).toEqual([]);
  expect(document.querySelectorAll('[data-testid="coin-layer"] > div')).toHaveLength(0);
  expect(screen.queryByText('🚧')).toBeNull();
  expect(screen.getByRole('button', { name: 'Next round' })).toBeTruthy();
});

test('the scenes of the moments of a life are their sheets over Play, open without a tap: the escape and the bankruptcy over the ledger, the crash over the news', async () => {
  const moments = [
    { name: 'moment-escape', title: 'Out of the rat race!', under: 'Two years later' },
    { name: 'moment-bankrupt', title: 'Bankrupt', under: 'Two years later' },
    { name: 'moment-crisis', title: 'The Great Crash', under: 'News' },
  ];
  for (const moment of moments) {
    render(<SceneView name={moment.name} />);
    const sheet = (await screen.findByRole('heading', { name: moment.title }, WAIT)).closest('[aria-modal="true"]');
    expect(sheet, moment.name).not.toBeNull();
    expect(screen.getByRole('heading', { name: moment.under }), moment.name).toBeTruthy();
    // Drawn with motion left out: no confetti falls over the good news, the picture stands uncovered.
    expect(sheet?.querySelector('[data-confetti]'), moment.name).toBeNull();
    cleanup();
  }
});

test('the scenes of the records are the records themselves: none yet, three lives lived (the latest first), and the sheet of the latest open without a tap', async () => {
  render(<SceneView name="records-empty" />);
  expect(await screen.findByText('No life finished yet. Your first one will appear here.', {}, WAIT)).toBeTruthy();
  cleanup();
  render(<SceneView name="records-three" />);
  expect(await screen.findByRole('heading', { name: 'Past lives' }, WAIT)).toBeTruthy();
  const bests = screen.getByRole('region', { name: 'Personal bests' });
  const lives = screen.getAllByRole('listitem').filter((item) => !bests.contains(item));
  expect(lives.map((life) => within(life).getAllByText(/^(Software engineer|Civil servant|Nurse)$/)[0].textContent)).toEqual(['Software engineer', 'Civil servant', 'Nurse']);
  // Each ended on a day of the scene's week, the latest the day before it.
  expect(lives.map((life) => life.textContent?.match(/\d+ Oct 2026/)?.[0])).toEqual(['21 Oct 2026', '20 Oct 2026', '19 Oct 2026']);
  expect(screen.getByText('3 lives lived')).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Software engineer' })).toBeNull();
  cleanup();
  render(<SceneView name="records-detail" />);
  const sheet = (await screen.findByRole('heading', { name: 'Software engineer' }, WAIT)).closest('[aria-modal="true"]') as HTMLElement;
  expect(sheet).not.toBeNull();
  expect(sheet.textContent).toContain('Out at 54');
  // The day it ended and the one city she lived in (she never moved).
  expect(sheet.textContent).toContain('21 Oct 2026 · TokyoOut at 54');
});

test('the scenes of the collection are the collection itself, open on its badges or on its things without a tap: what three lives earned and owned', async () => {
  render(<SceneView name="collection-badges" />);
  const badgesTab = await screen.findByRole('tab', { name: 'Badges' }, WAIT);
  expect(badgesTab.getAttribute('aria-selected')).toBe('true');
  expect(await screen.findByText(/^\d+ of \d+ earned$/, {}, WAIT)).toBeTruthy();
  expect(screen.getByText(/^\d+ of \d+ earned$/).textContent).not.toMatch(/^0 of/);
  cleanup();
  render(<SceneView name="collection-items" />);
  expect((await screen.findByRole('tab', { name: 'Things' }, WAIT)).getAttribute('aria-selected')).toBe('true');
  const owned = await screen.findByText(/^\d+ of \d+ owned$/, {}, WAIT);
  expect(owned.textContent).not.toMatch(/^0 of/);
});

test('the scenes of the rankings are the rankings themselves, told of the scene\'s other players (no cloud), each open on the ranking its name says without a tap', async () => {
  render(<SceneView name="rankings-all" />);
  const all = await screen.findByRole('list', { name: 'All time' }, WAIT);
  const lines = within(all).getAllByRole('listitem').filter((item) => item.parentElement?.closest('[role="list"]') === all);
  expect(lines).toHaveLength(8);
  expect(lines[0].textContent).toContain('Queso_Grande');
  // The scene's player is the sixth, lit as their own.
  expect(lines[5].getAttribute('aria-selected')).toBe('true');
  expect(screen.queryByRole('textbox')).toBeNull();
  cleanup();
  render(<SceneView name="rankings-week" />);
  expect(await screen.findByRole('list', { name: 'Best this week' }, WAIT)).toBeTruthy();
  cleanup();
  // Among friends: their ranking, and the way to the friends themselves, on the games with others' page.
  render(<SceneView name="rankings-friends" />);
  expect(await screen.findByRole('list', { name: 'Friends' }, WAIT)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Your friends and their requests' })).toBeTruthy();
  cleanup();
  render(<SceneView name="rankings-challenge" />);
  expect(await screen.findByText('40 players · the best 4 are in the top 10%', {}, WAIT)).toBeTruthy();
  cleanup();
  // The name is changed on the profile now: this scene is the rankings as they are.
  render(<SceneView name="rankings-nickname" />);
  expect(await screen.findByRole('list', { name: 'All time' }, WAIT)).toBeTruthy();
  expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull();
});

test('the scenes of the player\'s own profile are drawn signed in: the profile itself, and its rat a tab at a time on a page of its own', async () => {
  render(<SceneView name="player-member" />);
  expect(await screen.findByText('Rata_Uno', {}, WAIT)).toBeTruthy();
  // The friend code is with the friends: none here.
  expect(screen.queryByRole('button', { name: /ABCD2345/ })).toBeNull();
  // The three lives of the scene's device, at a glance.
  expect(screen.getByLabelText('Your figures').textContent).toMatch(/^3Lives/);
  expect(screen.queryByText('Code copied')).toBeNull();
  cleanup();
  for (const [name, tab, groups] of [
    ['player-editor-body', 'Body', ['Fur', 'Face']],
    ['player-editor-wear', 'Clothes', ['Clothes', 'Headwear', 'Eyes']],
    ['player-editor-scene', 'Backdrop', ['Backdrop', 'Colour']],
  ] as const) {
    render(<SceneView name={name} />);
    expect((await screen.findByRole('tab', { name: tab }, WAIT)).getAttribute('aria-selected')).toBe('true');
    expect(screen.getAllByRole('radiogroup').map((group) => group.getAttribute('aria-label'))).toEqual(groups);
    // The panel alone: none of the rest of the profile.
    expect(screen.queryByText('Rata_Uno')).toBeNull();
    cleanup();
  }
  render(<SceneView name="player-friend-code" />);
  expect(await screen.findByText('Rata_Uno', {}, WAIT)).toBeTruthy();
});

test('the scenes of the game online beside the game alone are drawn for a member, told of the scene\'s other players: the door, the challenge, an end, a new life', async () => {
  render(<SceneView name="home-member" />);
  expect(await screen.findByRole('link', { name: '1 friend request' }, WAIT)).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Rankings' })).toBeTruthy();
  expect(await screen.findByRole('link', { name: 'Your profile' }, WAIT)).toBeTruthy();
  expect(screen.getByRole('link', { name: /Continue your life/ })).toBeTruthy();
  expect(screen.getByText('3 days left')).toBeTruthy();
  cleanup();
  render(<SceneView name="challenge-attempt" />);
  expect(await screen.findByRole('button', { name: "Play today's attempt" }, WAIT)).toBeTruthy();
  expect(await screen.findByText('Your best this week: 8,105 points.', {}, WAIT)).toBeTruthy();
  cleanup();
  render(<SceneView name="challenge-played" />);
  expect(await screen.findByText("You have played today's attempt. Your best this week: 8,105 points.", {}, WAIT)).toBeTruthy();
  expect(screen.queryByRole('button', { name: "Play today's attempt" })).toBeNull();
  expect(screen.getByRole('link', { name: 'See the challenge ranking' })).toBeTruthy();
  cleanup();
  render(<SceneView name="end-standing" />);
  expect(await screen.findByText('Better than 77% of the Software engineer lives others have played (40).', {}, WAIT)).toBeTruthy();
  cleanup();
  render(<SceneView name="new-ranked" />);
  const mode = await screen.findByRole('radiogroup', { name: 'How to play' }, WAIT);
  expect(within(mode).getByRole('radio', { name: /^Ranked/ }).getAttribute('aria-checked')).toBe('true');
});

test('a scene of the game alone is drawn with nobody signed in, and one of the game online with its member', () => {
  const store = new MemoryStore();
  expect(servicesOf(SCENES.find((scene) => scene.name === 'records-three')!, store).account).toBeUndefined();
  const online = servicesOf(SCENES.find((scene) => scene.name === 'player-member')!, store);
  expect(online.account?.state()).toEqual({ kind: 'member', userId: 'u-scene', email: null });
  expect(online.community?.()).not.toBeNull();
});

test('the scenes of the games with others are drawn signed in, at the scene\'s table: the door, a lobby among friends, a public one counting down, an invitation', async () => {
  render(<SceneView name="room-door" />);
  expect(await screen.findByText('2 games are looking for players right now', {}, WAIT)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Play now' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Have a game code?' })).toBeTruthy();
  // The player's friends beside the ways to play: their code, and none yet.
  expect(await screen.findByRole('button', { name: /Your friend code: / }, WAIT)).toBeTruthy();
  cleanup();
  render(<SceneView name="room-lobby-friends" />);
  const members = await screen.findByRole('region', { name: 'In the game: 3 of 6' }, WAIT);
  // Each other player may be asked to be friends from here, before the game begins.
  expect(within(members).getAllByRole('listitem').map((seat) => seat.textContent)).toEqual([expect.stringMatching(/^Rata_UnoHostYou/), 'Bea_7Add friend', 'Rat C3D4Add friend']);
  expect(within(screen.getByRole('region', { name: 'Game code' })).getByText('K7Q2XM')).toBeTruthy();
  expect(screen.getByText('Software engineer')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Start' }).getAttribute('aria-disabled')).not.toBe('true');
  cleanup();
  render(<SceneView name="room-lobby-public" />);
  const clock = await screen.findByRole('region', { name: 'Looking for players' }, WAIT);
  // A minute and thirty-five seconds by the server's clock, whatever the phone's says: counted down from there.
  expect(within(clock).getByRole('timer').textContent).toMatch(/^Starts in 1:3[0-5]$/);
  expect(screen.queryByText('Host')).toBeNull();
  cleanup();
  render(<SceneView name="room-join-code" />);
  const invitation = await screen.findByRole('region', { name: 'You are invited to the game' }, WAIT);
  expect(within(invitation).getByText('K7Q2XM')).toBeTruthy();
});

test('the scenes of a game with others in play are drawn on the life in the room, the engine\'s: the news under its bar, its loans, its order under a ledger, its end, its games among the records', async () => {
  render(<SceneView name="room-playing" />);
  // Bea and Moe have played; two minutes and a half of the round by the server's clock, counted down from there.
  expect(await screen.findByRole('button', { name: /^The game: 2:(30|2\d) left, 2 of 4 have played$/ }, WAIT)).toBeTruthy();
  // The paper tells of Bea's coup at the top, with her rat.
  expect(within(screen.getByRole('region', { name: 'News' })).getByText('YOUR GAME')).toBeTruthy();
  cleanup();
  render(<SceneView name="room-loans" />);
  expect(await screen.findByRole('region', { name: 'Moe_Money offers you a loan' }, WAIT)).toBeTruthy();
  expect(screen.getByText('You offer Bea_7 a loan: waiting for an answer', { exact: false })).toBeTruthy();
  cleanup();
  render(<SceneView name="room-resolved" />);
  const order = await screen.findByRole('region', { name: 'After round 6' }, WAIT);
  expect(within(order).getAllByRole('listitem')).toHaveLength(4);
  expect(screen.getByRole('heading', { name: 'Two years later' })).toBeTruthy();
  cleanup();
  render(<SceneView name="room-end" />);
  const final = await screen.findByRole('region', { name: 'How the game ended' }, WAIT);
  expect(within(final).getByText('Place 1 of 3')).toBeTruthy();
  expect(within(final).getByRole('button', { name: 'Rematch' })).toBeTruthy();
  cleanup();
  render(<SceneView name="room-history" />);
  const sheet = (await screen.findByRole('heading', { name: 'Software engineer' }, WAIT)).closest('[aria-modal="true"]') as HTMLElement;
  expect(within(within(sheet).getAllByRole('list')[0]).getAllByRole('listitem')).toHaveLength(3);
}, 120_000);
