import { readFileSync } from 'node:fs';
import { describe, expect, it, test } from 'vitest';
import { SCENES } from '@ratrace/core/testing/scenes';
import type { Result } from './kitCompare';
import { ACCEPTED, chooseScenes, differing, filesOf, HUD_ONLY, VISIBLE_HEIGHT, WEB_ONLY, webRules, isJudged, jsonOf, lineOf, mergeLines, PAGE_BASELINE, PHONE_PAGES, PHONE_WORDS, sceneAppRoute, sceneWebUrl, SCENES_FOLDER, STAND_IN_SCENES, STAND_INS, unjudgedLine } from './sceneShots';

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
  expect(STAND_INS).toEqual(['records', 'collection']);
  // The screens that are ported are compared; the scenes of the stand-ins are only shot.
  expect(SCENES.filter(isJudged).map((scene) => scene.name)).toEqual([
    'home-new',
    'home-continue',
    'home-settings',
    'home-lost-newer',
    'new-first',
    'new-unlocked',
    'new-locked',
    'new-replace',
    'play-news-r1',
    'play-news-r6',
    'play-guide-r1',
    'play-fault',
    'play-pageturn',
    'hud-news-r1',
    'hud-cash',
    'hud-flow',
    'hud-race',
    'hud-status-ru',
    'hud-jailed',
    'hud-crisis',
    'hud-crisis-details',
    'challenge-practice',
    'legal',
  ]);
  expect(isJudged({ name: 'hud-cash', locale: 'en' })).toBe(true);
  const standIn = { name: 'records-best', locale: 'en' } as const;
  expect(unjudgedLine(standIn)).toEqual({ scene: 'records-best', locale: 'en', verdict: 'unjudged', why: 'the app still draws a stand-in for records: its numbers say nothing' });
  expect(Object.keys(unjudgedLine(standIn))).toEqual(['scene', 'locale', 'verdict', 'why']);
});

test('a scene of a ported screen at a part of it still to be ported (a stage of Play a later task brings) is unjudged as well, and says which part', () => {
  expect(Object.keys(STAND_IN_SCENES)).toEqual(['play-cards-r1', 'play-finance-r6', 'play-outcome-r1', 'play-resolve-r6']);
  for (const name of Object.keys(STAND_IN_SCENES)) expect(SCENES.map((scene) => scene.name), name).toContain(name);
  expect(SCENES.filter((scene) => !isJudged(scene)).map((scene) => scene.name)).toEqual(['play-cards-r1', 'play-finance-r6', 'play-outcome-r1', 'play-resolve-r6']);
  const cards = SCENES.find((scene) => scene.name === 'play-cards-r1')!;
  expect(unjudgedLine(cards)).toEqual({ scene: 'play-cards-r1', locale: 'en', verdict: 'unjudged', why: 'the app still draws a stand-in for the cards of play: its numbers say nothing' });
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

test('a scene of the Hud is the web\'s Play with all but its Hud taken out: the stage of the round and the bar of its next step', () => {
  const huds = SCENES.filter((scene) => scene.name.startsWith('hud-'));
  expect(huds.length).toBeGreaterThan(0);
  for (const scene of huds) expect(webRules(scene), scene.name).toBe(`${VISIBLE_HEIGHT} ${HUD_ONLY}`);
  expect(HUD_ONLY).toBe('#round-stage, #round-actions { display: none !important; }');
  // The two are what the phone's Play stacks under its Hud, and nothing of the Hud is inside either.
  const play = readFileSync(new URL('../../web/src/game/screens/Play.tsx', import.meta.url), 'utf8');
  const phone = play.slice(play.lastIndexOf('<Hud compact='));
  expect(phone).toContain('<main id="round-stage"');
  expect(phone).toContain('<div id="round-actions"');
  expect(phone.indexOf('<Hud compact=')).toBeLessThan(phone.indexOf('<main id="round-stage"'));
  // No scene but the Hud's is given the rule.
  expect(SCENES.filter((scene) => webRules(scene).includes(HUD_ONLY)).every((scene) => scene.name.startsWith('hud-'))).toBe(true);
});

describe('a scene whose words are the phone\'s own', () => {
  const named = (name: string) => SCENES.find((scene) => scene.name === name)!;
  const lost = named('home-lost-newer');
  const legal = named('legal');
  /** What the comparison finds of a notice in other words: its text stands 5.67 pt apart, and a line of it is found in one shot only. */
  const otherWords = (over: Partial<Result> = {}) =>
    result('x', { shape: 0, texts: [{ text: 'a', web: [0, 0, 1, 1], app: [0, 0, 1, 1], apart: 5.67 }, { text: 'Reload the page', web: [0, 0, 1, 1], app: null, apart: Infinity }], ...over });

  it('are listed beside the stand-ins: the notice of a newer life, and the legal page, which is a different text all through', () => {
    expect(PHONE_WORDS).toEqual(['home-lost-newer', 'legal']);
    for (const name of PHONE_WORDS) expect(SCENES.map((scene) => scene.name), name).toContain(name);
    // Of those, a page whose every paragraph is other words has no line to compare to a line.
    expect(PHONE_PAGES).toEqual(['legal']);
    for (const name of PHONE_PAGES) expect(PHONE_WORDS).toContain(name);
    // They are drawn by the real screens, so they are judged, and by their layout only.
    expect(PHONE_WORDS.every((name) => isJudged(named(name)))).toBe(true);
  });

  it('is judged by its layout alone: the shape is held to nothing, and the text rows are reported and not judged, and the verdict says so', () => {
    const line = lineOf(lost, otherWords());
    expect(line.verdict).toBe('phone words, layout clean');
    // The numbers are all kept: nothing is hidden by not being judged.
    expect(line).toMatchObject({ scene: 'home-lost-newer', shape: 0, textLines: 2, oneSided: 1, worstPt: 5.67 });
    // The same numbers on a scene with the web\'s words fail it on its text.
    expect(lineOf(named('home-new'), otherWords()).verdict).toBe('differs');
  });

  it('still fails for a layout that differs: a shape that is not where the web draws it', () => {
    expect(lineOf(lost, otherWords({ shape: 3 })).verdict).toBe('phone words, layout differs');
  });

  it('is not judged at all when the whole page is other words: its shapes are the length of other text, and say nothing of the layout', () => {
    const line = lineOf(legal, otherWords({ shape: 38_813, rawPercent: 14.16 }));
    expect(line.verdict).toBe('phone words, not comparable');
    expect(line).toMatchObject({ scene: 'legal', shape: 38_813 });
  });

  it('is a wrong page all the same when most of the screen is unlike: the app showed something else', () => {
    expect(() => lineOf(lost, otherWords({ rawPercent: 70 }))).toThrow('home-lost-newer: a wrong page is not a result to keep');
    expect(() => lineOf(legal, otherWords({ rawPercent: 70 }))).toThrow('legal: a wrong page is not a result to keep');
  });

  it('makes a run fail only for a scene that differs, or whose layout does, or a page of other words that has drifted: not for a clean one, other words, a stand-in or a page that cannot be compared', () => {
    const lines = [
      lineOf(named('home-new'), result('a', { shape: 0, texts: [] })),
      lineOf(named('home-new'), result('b', { shape: 1, texts: [] })),
      lineOf(lost, otherWords()),
      lineOf(named('legal'), otherWords({ shape: PAGE_BASELINE.legal.shape })),
      unjudgedLine(named('play-cards-r1')),
      lineOf(named('challenge-practice'), result('c', { shape: 0, texts: [{ text: 'a', web: [0, 0, 1, 1], app: [0, 0, 1, 1], apart: 3 }] })),
    ];
    expect(differing(lines).map((line) => line.scene)).toEqual(['home-new', 'challenge-practice']);
    expect(differing([lineOf(lost, otherWords({ shape: 5 }))]).map((line) => line.scene)).toEqual(['home-lost-newer']);
    expect(differing([])).toEqual([]);
  });

  it('is written to the report with its verdict', () => {
    const text = jsonOf([lineOf(lost, otherWords()), lineOf(legal, otherWords({ shape: PAGE_BASELINE.legal.shape }))]);
    expect(JSON.parse(text).map((line: { verdict: string }) => line.verdict)).toEqual(['phone words, layout clean', 'phone words, not comparable']);
  });
});

describe('what is accepted of a scene, and no more', () => {
  const named = (name: string) => SCENES.find((scene) => scene.name === name)!;
  const report = readFileSync(new URL('../../../docs/superpowers/reports/2026-10-21-phase-2-parity.md', import.meta.url), 'utf8');
  /** A scene's numbers as the record has them, and then some. */
  const measured = (name: string, more: { shape?: number; worstPt?: number; oneSided?: number } = {}): Result => {
    const record = ACCEPTED[name];
    const texts: Result['texts'] = [{ text: 'a', web: [0, 0, 1, 1], app: [0, 0, 1, 1], apart: record.worstPt + (more.worstPt ?? 0) }];
    for (let i = 0; i < record.oneSided + (more.oneSided ?? 0); i++) texts.push({ text: `only ${i}`, web: [0, 0, 1, 1], app: null, apart: Infinity });
    return result(name, { shape: record.shape + (more.shape ?? 0), texts });
  };

  it('is a record for each scene whose residual is explained: the most it may differ by, what it is, and where the parity report says so', () => {
    expect(Object.keys(ACCEPTED).sort()).toEqual(['home-continue', 'new-first', 'new-locked', 'new-replace', 'new-unlocked', 'play-guide-r1', 'play-news-r1', 'play-news-r6', 'play-pageturn']);
    for (const [name, record] of Object.entries(ACCEPTED)) {
      expect(SCENES.map((scene) => scene.name), name).toContain(name);
      expect(isJudged(named(name)), name).toBe(true);
      expect(PHONE_WORDS, name).not.toContain(name);
      expect(record.reason.length, name).toBeGreaterThan(30);
      // The heading it names is in the report, which is where its measured cause is written.
      expect(report, name).toContain(`\n## ${record.report}\n`);
      expect(record.shape).toBeGreaterThanOrEqual(0);
      expect(record.worstPt).toBeGreaterThan(0);
    }
  });

  it('passes a scene that differs as the record says it does, and as no more: the same shape and text, or less, is accepted', () => {
    for (const name of Object.keys(ACCEPTED)) {
      const line = lineOf(named(name), measured(name));
      expect(line.verdict, name).toBe('accepted');
      expect(differing([line]), name).toEqual([]);
      // Fewer shape pixels, or a nearer text, is no harm.
      expect(['accepted', 'clean'], name).toContain(lineOf(named(name), measured(name, { shape: -1 })).verdict);
      expect(lineOf(named(name), measured(name, { worstPt: -0.01 })).verdict, name).toBe('accepted');
    }
  });

  it('fails a scene on any growth: one more shape pixel, a hundredth of a point more, a line of text in one shot only', () => {
    for (const name of Object.keys(ACCEPTED)) {
      for (const more of [{ shape: 1 }, { worstPt: 0.01 }, { oneSided: 1 }]) {
        const line = lineOf(named(name), measured(name, more));
        expect([name, JSON.stringify(more), line.verdict]).toEqual([name, JSON.stringify(more), 'differs']);
        expect(differing([line]).map((one) => one.scene)).toEqual([name]);
      }
    }
  });

  it('is nothing for a scene that has no record: it differs, or it is clean', () => {
    expect(lineOf(named('home-new'), result('x', { shape: 1, texts: [] })).verdict).toBe('differs');
    expect(lineOf(named('home-new'), result('x', { shape: 0, texts: [] })).verdict).toBe('clean');
    // And a scene that is clean stays clean though it has a record: the record is what it may differ by, not what it does.
    expect(lineOf(named('home-continue'), result('x', { shape: 0, texts: [] })).verdict).toBe('clean');
  });

  it('holds the page of other words to where it stands: its shape is recorded, and a page that moves off it fails the run', () => {
    expect(PHONE_PAGES.slice().sort()).toEqual(Object.keys(PAGE_BASELINE).sort());
    const legal = named('legal');
    const base = PAGE_BASELINE.legal;
    expect(report).toContain(`\n## ${base.report}\n`);
    expect(base.reason.length).toBeGreaterThan(30);
    const at = (shape: number) => lineOf(legal, result('legal', { shape, texts: [] }));
    expect(at(base.shape).verdict).toBe('phone words, not comparable');
    expect(at(Math.floor(base.shape * (1 + base.drift))).verdict).toBe('phone words, not comparable');
    expect(at(Math.ceil(base.shape * (1 - base.drift))).verdict).toBe('phone words, not comparable');
    for (const shape of [Math.ceil(base.shape * (1 + base.drift)) + 1, Math.floor(base.shape * (1 - base.drift)) - 1, 0]) {
      const line = at(shape);
      expect(line.verdict, String(shape)).toBe('phone words, drifted');
      expect(differing([line]).map((one) => one.scene)).toEqual(['legal']);
    }
  });

  it('keeps a full run of the scenes there are as they are, to pass: every scene is clean, accepted, in the phone\'s words within their bounds, or not shot yet', () => {
    // The verdicts a run can end in, and which of them fail it.
    const lines = SCENES.map((scene) => (isJudged(scene) ? lineOf(scene, scene.name in ACCEPTED ? measured(scene.name) : PHONE_WORDS.includes(scene.name) ? result(scene.name, { shape: PAGE_BASELINE[scene.name]?.shape ?? 0, texts: [] }) : result(scene.name, { shape: 0, texts: [] })) : unjudgedLine(scene)));
    expect(differing(lines)).toEqual([]);
    expect(new Set(lines.map((line) => line.verdict))).toEqual(new Set(['clean', 'accepted', 'phone words, layout clean', 'phone words, not comparable', 'unjudged']));
  });
});
