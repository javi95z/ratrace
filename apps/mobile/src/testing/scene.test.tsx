// @vitest-environment jsdom
import { SCENE_NOW, SCENES, sceneStore, screenOf } from '@ratrace/core/testing/scenes';
import type { Scene } from '@ratrace/core/testing/scenes';
import { MemoryStore } from '@ratrace/core/session/memory';
import type { SavedGame } from '@ratrace/core/session/types';
import { cleanup, render, screen } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { useClock, useGame, useT } from '../game/context';
import SceneRoute from '../app/scene';
import { params } from './fakes';
import { memoryServices } from './memoryServices';
import { SCENE_SCREENS, SceneView, servicesOf } from './scene';

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
  expect(mounted).toEqual(['outcome']);
  cleanup();
  mounted.length = 0;
  render(<SceneView name="play-resolve-r6" screens={probes} />);
  // The sixth round is played: the life is at its seventh.
  expect(await screen.findByText(/playing engineer resolve round 7 \|/, {}, WAIT)).toBeTruthy();
  expect(mounted).toEqual(['resolve']);
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

test('the route is for development only: anywhere else it goes home', () => {
  params.name = 'home-new';
  vi.stubGlobal('__DEV__', false);
  const { container } = render(<SceneRoute />);
  expect(container.querySelector('[data-redirect]')?.getAttribute('data-redirect')).toBe('/');
});

test('the route shows the scene its address names', async () => {
  vi.stubGlobal('__DEV__', true);
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

test('the scene of a fault is the play screen\'s way out, and the one line its game writes to the log is the one the scene route lets pass unseen', async () => {
  const told = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  render(<SceneView name="play-fault" />);
  expect((await screen.findByRole('alert', {}, WAIT)).textContent).toContain('Something went wrong');
  expect(screen.getByRole('link', { name: 'New life' })).toBeTruthy();
  expect(told.mock.calls.map((call) => call[0])).toContain('the round could not be previewed:');
  told.mockRestore();
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
