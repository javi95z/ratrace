import { expect, test } from 'vitest';
import { SCENES } from '@ratrace/core/testing/scenes';
import type { Result } from './kitCompare';
import { chooseScenes, filesOf, isJudged, jsonOf, lineOf, mergeLines, sceneAppRoute, sceneWebUrl, SCENES_FOLDER, STAND_INS, unjudgedLine } from './sceneShots';

const [first, second] = SCENES;

test('the web page of a scene is in the scene\'s language, and the app\'s route names the scene', () => {
  expect(sceneWebUrl({ name: 'home-new', locale: 'en' }, 3021)).toBe('http://localhost:3021/en/kit/scene?name=home-new');
  expect(sceneWebUrl({ name: 'home-new', locale: 'ru' }, 3021)).toBe('http://localhost:3021/ru/kit/scene?name=home-new');
  expect(sceneAppRoute({ name: 'play-finance-r6', locale: 'es' })).toBe('scene?name=play-finance-r6');
});

test('each scene writes three pictures, in the report of phase 2', () => {
  expect(SCENES_FOLDER).toBe('phase-2-parity');
  expect(filesOf('play-news-r1')).toEqual({ web: 'play-news-r1-web.png', app: 'play-news-r1-app.png', diff: 'play-news-r1-diff.png' });
});

test('all the scenes are shot, or the ones named, in the order they are listed; a name that is not a scene stops the run', () => {
  expect(chooseScenes(undefined)).toEqual([...SCENES]);
  expect(chooseScenes([SCENES[3].name, SCENES[1].name]).map((scene) => scene.name)).toEqual([SCENES[1].name, SCENES[3].name]);
  expect(() => chooseScenes(['home-new', 'home-old', 'play-x'])).toThrow('unknown scene: home-old, play-x');
});

const result = (section: string, over: Partial<Result> = {}): Result => ({
  section,
  rawPercent: 12.3456,
  beyondPercent: 1.23456,
  beyond: 100,
  loosePercent: 0.5,
  loose: 40,
  beyondPlain: 150,
  loosePlain: 60,
  shape: 7,
  shapeBlended: 5,
  texts: [
    { text: 'a', web: [0, 0, 1, 1], app: [0, 0, 1, 1], apart: 0.25 },
    { text: 'b', web: [0, 0, 1, 1], app: [0, 0, 1, 1], apart: 1.5 },
    { text: 'c', web: null, app: null, apart: 0, unmeasured: true },
    { text: 'd', web: [0, 0, 1, 1], app: null, apart: Infinity },
  ],
  places: [],
  crop: [62, 400],
  ...over,
});

test('a scene\'s line says how far apart the two shots are: the verdict, the share unlike, the shapes, and the worst text', () => {
  expect(lineOf(first, result(first.name, { rawPercent: 12.3456 }))).toEqual({
    scene: first.name,
    locale: first.locale,
    verdict: 'differs',
    rawPercent: 12.35,
    beyondPercent: 1.235,
    loose: 40,
    shape: 7,
    shapeBlended: 5,
    textLines: 4,
    unmeasured: 1,
    oneSided: 1,
    worstPt: 1.5,
  });
  expect(lineOf(first, result(first.name, { shape: 0, texts: [{ text: 'a', web: [0, 0, 1, 1], app: [0, 0, 1, 1], apart: 0.25 }] })).verdict).toBe('clean');
});

test('a line of text found in one shot only is counted, not written as a number a file cannot hold', () => {
  const only = result('x', { texts: [{ text: 'd', web: [0, 0, 1, 1], app: null, apart: Infinity }] });
  expect(lineOf(first, only)).toMatchObject({ oneSided: 1, worstPt: 0 });
  expect(JSON.parse(jsonOf([lineOf(first, only)]))[0].worstPt).toBe(0);
});

test('a wrong page is not a line to keep: its numbers must never be read as a result', () => {
  expect(() => lineOf(first, result(first.name, { rawPercent: 70 }))).toThrow('home-new: a wrong page is not a result to keep');
});

test('a scene whose screen the app still draws as a stand-in is unjudged: no numbers, and why', () => {
  expect(STAND_INS).toEqual(['home', 'new', 'play', 'records', 'collection']);
  for (const scene of SCENES) expect(isJudged(scene), scene.name).toBe(false);
  expect(isJudged({ name: 'hud-cash', locale: 'en' })).toBe(true);
  expect(unjudgedLine(first)).toEqual({ scene: first.name, locale: first.locale, verdict: 'unjudged', why: 'the app still draws a stand-in for home: its numbers say nothing' });
  expect(Object.keys(unjudgedLine(first))).toEqual(['scene', 'locale', 'verdict', 'why']);
});

test('a run of some scenes keeps the lines of the others, and the file has every scene shot, in the list\'s order, a line to each', () => {
  const kept = [unjudgedLine(second), unjudgedLine(first)];
  const now = [lineOf(first, result(first.name, { shape: 1 }))];
  const merged = mergeLines(kept, now);
  expect(merged.map((line) => line.scene)).toEqual([first.name, second.name]);
  expect(merged[0].verdict).toBe('differs');
  expect(merged[1].verdict).toBe('unjudged');
  const text = jsonOf(merged);
  expect(JSON.parse(text)).toEqual(merged);
  expect(text.trim().split('\n')).toHaveLength(merged.length + 2);
  expect(text.endsWith('\n')).toBe(true);
});
