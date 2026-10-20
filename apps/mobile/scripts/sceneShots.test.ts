import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { SCENES } from '@ratrace/core/testing/scenes';
import type { Result } from './kitCompare';
import { chooseScenes, filesOf, VISIBLE_HEIGHT, WEB_ONLY, webRules, isJudged, jsonOf, lineOf, mergeLines, sceneAppRoute, sceneWebUrl, SCENES_FOLDER, STAND_INS, unjudgedLine } from './sceneShots';

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
  expect(STAND_INS).toEqual(['new', 'play', 'records', 'collection']);
  // The screens that are ported are compared; the scenes of the stand-ins are only shot.
  expect(SCENES.filter(isJudged).map((scene) => scene.name)).toEqual(['home-new', 'home-continue', 'home-settings', 'home-lost-newer', 'challenge-practice', 'legal']);
  expect(SCENES.filter((scene) => !isJudged(scene)).every((scene) => scene.name.startsWith('play-'))).toBe(true);
  expect(isJudged({ name: 'hud-cash', locale: 'en' })).toBe(true);
  const standIn = SCENES.find((scene) => scene.name === 'play-news-r1')!;
  expect(unjudgedLine(standIn)).toEqual({ scene: standIn.name, locale: standIn.locale, verdict: 'unjudged', why: 'the app still draws a stand-in for play: its numbers say nothing' });
  expect(Object.keys(unjudgedLine(standIn))).toEqual(['scene', 'locale', 'verdict', 'why']);
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

test('a web page is as tall as what is visible of the screen, not taller by the safe area the body already clears (the one rule the web\'s shots are given)', () => {
  // The web's `min-h-dvh` page inside a body that is padded by the safe area at the top is taller than the screen by that area, so the
  // foot of a short page stands below the fold; the phone's page is as tall as the screen it scrolls in. Taken away in the shot, nothing else is.
  expect(VISIBLE_HEIGHT).toBe('main { min-height: calc(100dvh - env(safe-area-inset-top)) !important; }');
});

test('what the web draws of a scene that the phone does not is hidden in the web\'s shot, by a rule that finds that line and no other', () => {
  const challenge = SCENES.find((scene) => scene.name === 'challenge-practice')!;
  expect(webRules(challenge)).toBe(`${VISIBLE_HEIGHT} ${WEB_ONLY['challenge-practice']}`);
  // A scene with nothing the phone leaves out is given the height rule alone.
  expect(webRules(SCENES[0])).toBe(VISIBLE_HEIGHT);
  // The rule's target is the one `p` of that frame the web draws a guest on the page: the line that tells to sign in (the other is the best of the week, shown to someone signed in).
  const web = readFileSync(new URL('../../web/src/game/screens/Challenge.tsx', import.meta.url), 'utf8');
  const page = web.slice(web.indexOf('export function WeeklyChallenge()'), web.indexOf('export function ChallengeBoard'));
  expect(page).toContain('<p className="frame bg-night-700 px-3 py-2 text-[13px] text-ink-200">{t(\'needsAccount\')}</p>');
  expect([...page.matchAll(/<p [^>]*className="frame bg-night-700[^"]*"/g)]).toHaveLength(2);
});
