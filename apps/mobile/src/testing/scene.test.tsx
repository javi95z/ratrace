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
  // The scene's screen, still phase 1's front door: its title.
  expect(await screen.findByText('THE RAT RACE', {}, WAIT)).toBeTruthy();
});
