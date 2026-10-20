// @vitest-environment jsdom
import { SCENES, sceneStore } from '@ratrace/core/testing/scenes';
import { MemoryStore } from '@ratrace/core/session/memory';
import type { SavedGame } from '@ratrace/core/session/types';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { useGame, useT } from '../game/context';
import SceneRoute from '../app/scene';
import { params } from './fakes';
import { memoryServices } from './memoryServices';
import { SCENE_SCREENS, SceneView, servicesOf } from './scene';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Stands for the screen a scene names: says which game the scene put it in, and in which words. */
function Probe() {
  const state = useGame((s) => `${s.status} ${s.lifeId ?? '-'} ${s.stage} round ${s.view === null ? '-' : s.view.round + 1}`);
  const title = useT('meta')('title');
  return <div>{`${title} | ${state}`}</div>;
}
const probes = { home: () => <Probe />, new: () => <Probe />, play: () => <Probe />, records: () => <Probe />, collection: () => <Probe /> };

test('draws nothing until the scene\'s store is built, and then the screen its name starts with, in the game the scene made', async () => {
  const { container } = render(<SceneView name="play-finance-r6" screens={probes} />);
  expect(container.textContent).toBe('');
  expect(await screen.findByText('The Rat Race | playing engineer finance round 6')).toBeTruthy();
});

test('a scene with no life is a game with no life in progress', async () => {
  render(<SceneView name="home-new" screens={probes} />);
  expect(await screen.findByText('The Rat Race | none - news round -')).toBeTruthy();
});

test('a life half played is opened where the scene left it', async () => {
  render(<SceneView name="play-cards-r1" screens={probes} />);
  expect(await screen.findByText('The Rat Race | playing engineer cards round 1')).toBeTruthy();
  cleanup();
  render(<SceneView name="home-continue" screens={probes} />);
  expect(await screen.findByText('The Rat Race | playing nurse news round 3')).toBeTruthy();
});

test('a name that is not a scene shows the scenes there are, instead of a screen', () => {
  render(<SceneView name="play-nowhere" screens={probes} />);
  expect(screen.getByText(/unknown scene: play-nowhere/)).toBeTruthy();
  for (const { name } of SCENES) expect(document.body.textContent).toContain(name);
  cleanup();
  render(<SceneView name={undefined} screens={probes} />);
  expect(screen.getByText(/unknown scene: -/)).toBeTruthy();
});

test('every scene has a screen to be drawn on, named by the first word of the scene', () => {
  for (const { name } of SCENES) expect(SCENE_SCREENS[name.split('-')[0]], name).toBeTypeOf('function');
});

test('a scene is drawn in the language it names, whatever the phone speaks', () => {
  const store = new MemoryStore();
  for (const locale of ['en', 'es', 'ru'] as const) expect(servicesOf({ name: 'home-new', locale }, store).language?.read()).toBe(locale);
  expect(servicesOf({ name: 'home-new', locale: 'es' }, store).store).toBe(store);
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
  expect(await screen.findByText('THE RAT RACE')).toBeTruthy();
});
