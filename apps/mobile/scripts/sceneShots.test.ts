import { readFileSync } from 'node:fs';
import { describe, expect, it, test } from 'vitest';
import { SCENES } from '@ratrace/core/testing/scenes';
import { MESSAGES } from '@ratrace/i18n';
import { TEXT_WITHIN_PT } from './kitCompare';
import type { Result } from './kitCompare';
import type { Accepted } from './sceneShots';
import { ACCEPTED, CALENDAR_COVERS, CELEBRATIONS_ONLY, chooseScenes, differing, filesOf, hasPhoneWords, HUD_ONLY, lineName, MOVING_FILE, movingAfter, WEB_ONLY, webRules, isJudged, jsonOf, lineOf, mergeLines, PAGE_BASELINE, PENDING_SHOTS, PHONE_PAGES, PHONE_WORDS, sceneAppRoute, sceneWebUrl, SCENES_FOLDER, unjudgedLine } from './sceneShots';

const [first, second] = SCENES;
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

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
    // The line beyond the point, by its words: what a record would name it by.
    far: [{ text: 'b', pt: 1.5 }],
  });
  expect(lineOf(first, result(first.name, { shape: 0, texts: [{ text: 'a', web: [0, 0, 1, 1], app: [0, 0, 1, 1], apart: 0.25 }] }))).not.toHaveProperty('far');
  expect(lineOf(first, result(first.name, { shape: 0, texts: [{ text: 'a', web: [0, 0, 1, 1], app: [0, 0, 1, 1], apart: 0.25 }] })).verdict).toBe('clean');
});

test('a line is named by its first forty letters, as the web\'s text check has it', () => {
  expect(read('./shotDrivers.ts').match(/text: text\.slice\(0, 40\)/g)).toHaveLength(4);
  expect(lineName('  short  ')).toBe('short');
  expect(lineName(MESSAGES.en.home.lostNewer)).toBe('Your saved life was written by a newer v');
});

test('a line of text found in one shot only is counted, not written as a number a file cannot hold', () => {
  const only = result('x', { texts: [{ text: 'd', web: [0, 0, 1, 1], app: null, apart: Infinity }] });
  expect(lineOf(first, only)).toMatchObject({ oneSided: 1, worstPt: 0 });
  expect(JSON.parse(jsonOf([lineOf(first, only)]))[0].worstPt).toBe(0);
});

test('a wrong page is not a line to keep: its numbers must never be read as a result', () => {
  expect(() => lineOf(first, result(first.name, { rawPercent: 70 }))).toThrow('home-new: a wrong page is not a result to keep');
});

test('every screen is the real one on the app (phase 1\'s stand-ins are retired): every scene is compared, but those waiting for the next batch pass', () => {
  expect(SCENES.filter(isJudged).map((scene) => scene.name)).toEqual(SCENES.filter((scene) => !PENDING_SHOTS.has(scene.name)).map((scene) => scene.name));
  for (const name of PENDING_SHOTS) expect(SCENES.map((scene) => scene.name), name).toContain(name);
  expect(isJudged({ name: 'hud-cash', locale: 'en' })).toBe(true);
  // The records and the collection were the last screens drawn as stand-ins (Task 19): shot since, and judged.
  for (const name of ['records-three', 'collection-badges']) expect(isJudged(SCENES.find((scene) => scene.name === name)!), name).toBe(true);
});

test('a scene of a screen ported but not shot yet is unjudged until a batch pass shoots it, and says so: after phase 2\'s exit, none of its scenes waits', () => {
  // The age a life left the rat race at, told at the round it got out in: the escape's moment and the ends of that life were shot again in Task 20.
  // Phase 2's scenes are those listed up to its last (`profile-financed`); what waits since is phase 3's, each registered by its screen's task.
  // Phase 3's tasks register theirs, and its batch pass (Task 14) shoots them.
  expect([...PENDING_SHOTS]).toEqual(expect.arrayContaining(['settings-account-guest', 'settings-account-member', 'home-offer', 'home-account-taken', 'rankings-all', 'rankings-week', 'rankings-friends', 'rankings-challenge', 'rankings-nickname']));
  const phase2 = SCENES.slice(0, SCENES.findIndex((scene) => scene.name === 'profile-financed') + 1).map((scene) => scene.name);
  expect(phase2.filter((name) => PENDING_SHOTS.has(name))).toEqual([]);
  for (const name of ['player-member', 'player-editor-body', 'player-editor-wear', 'player-editor-scene', 'player-friend-code']) expect(PENDING_SHOTS.has(name), name).toBe(true);
  for (const name of ['home-member', 'challenge-attempt', 'challenge-board', 'end-standing', 'new-ranked']) expect(PENDING_SHOTS.has(name), name).toBe(true);
  // The records that rested on what changed are gone: the glow's absence, the phone's words for the net worth, the savings cut short beside buttons of 17.
  for (const name of ['celebrate-earned', 'celebrate-legendary', 'balance-r6', 'finance-tabs-ru-360']) expect(Object.keys(ACCEPTED), name).not.toContain(name);
  for (const name of PENDING_SHOTS) expect(hasPhoneWords(name), name).toBe(false);
  // What such a scene says, should a later task register one before the next batch pass: that, and no numbers.
  const ledger = SCENES.find((scene) => scene.name === 'play-resolve-r6')!;
  expect(unjudgedLine(ledger)).toEqual({ scene: 'play-resolve-r6', locale: 'en', verdict: 'unjudged', why: 'ported and not shot yet: a batch pass shoots it and judges it' });
  expect(Object.keys(unjudgedLine(ledger))).toEqual(['scene', 'locale', 'verdict', 'why']);
  // Not judged, so it fails nothing, and its numbers are never read as a result.
  expect(differing([unjudgedLine(ledger)])).toEqual([]);
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

test('a web page is as tall as what is visible of the screen by its own rule, not taller by the safe area the body already clears: the shots add no rule of height', () => {
  // The web's pages are `min-h-safe` (100dvh less the top safe area the body is padded by) since d67284b, held by the web's own viewport test: the
  // foot of a short page stands where the phone's does. The shots' own rule that did the same is gone; a scene with nothing to hide is given nothing.
  expect(read('../../web/src/app/globals.css')).toMatch(/@utility min-h-safe \{\s*min-height: calc\(100dvh - env\(safe-area-inset-top\)\);/);
  expect(read('../../web/src/ui/viewport.test.ts')).toContain("it('is never the whole screen'");
  expect(webRules(SCENES[0])).toBe('');
});

test('what the web draws of a scene that the phone does not is hidden in the web\'s shot, by a rule that finds that line and no other', () => {
  const challenge = SCENES.find((scene) => scene.name === 'challenge-practice')!;
  expect(webRules(challenge)).toBe(WEB_ONLY['challenge-practice']);
  // A scene with nothing the phone leaves out is given no rule.
  expect(webRules(SCENES[0])).toBe('');
  // The rule's target is the one `p` of that frame the web draws a guest on the page: the line that tells to sign in (the other is the best of the week, shown to someone signed in).
  const web = readFileSync(new URL('../../web/src/game/screens/Challenge.tsx', import.meta.url), 'utf8');
  const page = web.slice(web.indexOf('export function WeeklyChallenge()'), web.indexOf('export function ChallengeBoard'));
  expect(page).toContain('<p className="frame bg-night-700 px-3 py-2 text-[13px] text-ink-200">{t(\'needsAccount\')}</p>');
  expect([...page.matchAll(/<p [^>]*className="frame bg-night-700[^"]*"/g)]).toHaveLength(2);
});

test('the picture\'s sheet is compared whole: the web\'s link that saves its file is the phone\'s button that saves it to the photos', () => {
  const share = SCENES.find((scene) => scene.name === 'end-share')!;
  expect(webRules(share)).toBe('');
  const web = readFileSync(new URL('../../web/src/game/screens/ShareCard.tsx', import.meta.url), 'utf8');
  expect([...web.matchAll(/download=\{/g)]).toHaveLength(1);
  expect(web).toContain("{t('save')}");
  expect(readFileSync(new URL('../src/game/screens/ShareCard.tsx', import.meta.url), 'utf8')).toContain("{t('save')}");
});

test('a scene of the Hud is the web\'s Play with all but its Hud taken out: the stage of the round and the bar of its next step', () => {
  // And the two whose sheet a screen not ported yet opens, drawn over the Hud alone: an amount moved to savings, a legendary badge.
  const huds = SCENES.filter((scene) => scene.name.startsWith('hud-') || ['amount-savings', 'celebrate-legendary'].includes(scene.name));
  expect(huds.length).toBeGreaterThan(0);
  for (const scene of huds) expect(webRules(scene), scene.name).toBe(HUD_ONLY);
  expect(HUD_ONLY).toBe('#round-stage, #round-actions { display: none !important; }');
  // The two are what the phone's Play stacks under its Hud, and nothing of the Hud is inside either.
  const play = readFileSync(new URL('../../web/src/game/screens/Play.tsx', import.meta.url), 'utf8');
  const phone = play.slice(play.lastIndexOf('<Hud compact='));
  expect(phone).toContain('<main id="round-stage"');
  expect(phone).toContain('<div id="round-actions"');
  expect(phone.indexOf('<Hud compact=')).toBeLessThan(phone.indexOf('<main id="round-stage"'));
  // No scene but those is given the rule.
  expect(SCENES.filter((scene) => webRules(scene).includes(HUD_ONLY)).map((scene) => scene.name)).toEqual(huds.map((scene) => scene.name));
});

test('the calendar of a turning round covers, in the web\'s text check, what it covers on the screen: in that scene\'s shot its pages take the pointer', () => {
  const turning = SCENES.find((scene) => scene.name === 'play-pageturn')!;
  expect(webRules(turning)).toBe(CALENDAR_COVERS);
  expect(CALENDAR_COVERS).toBe('[data-motion-only] > * { pointer-events: auto !important; }');
  // The check asks what is on top along a line (`elementFromPoint`), which passes through anything that takes no pointer, as the calendar takes none
  // (a tap goes through it). The rule gives the pointer to the calendar itself, the child of the layer over the whole screen, and not to that layer:
  // the lines round the calendar are not covered by it, and a line partly under it is measured where it shows (shotDrivers.test).
  const drivers = read('./shotDrivers.ts');
  expect(drivers).toContain('const at = document.elementFromPoint(x, y);');
  expect(drivers).toContain("at.closest('[data-motion-only]') !== null");
  const turn = read('../../web/src/game/screens/PageTurn.tsx');
  expect(turn).toContain('<div aria-hidden data-motion-only className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">');
  expect(turn).toContain('<div className="relative h-44 w-36 animate-page">');
  expect(SCENES.filter((scene) => webRules(scene).includes(CALENDAR_COVERS)).map((scene) => scene.name)).toEqual(['play-pageturn']);
});

test('a scene whose app shot never stood still fails the run, and its line says so', () => {
  const still = lineOf(first, result(first.name, { shape: 0, texts: [] }));
  expect(still).not.toHaveProperty('moving');
  const moving = lineOf(first, result(first.name, { shape: 0, texts: [] }), true);
  expect(moving).toMatchObject({ scene: first.name, verdict: 'clean', moving: true });
  expect(differing([still, moving]).map((line) => line.scene)).toEqual([first.name]);
  expect(differing([still])).toEqual([]);
  // Kept beside the raw shots from the app's step to the comparison; a run of some scenes keeps what it knew of the others.
  expect(MOVING_FILE).toBe('scenes-moving.json');
  expect(movingAfter(['a', 'b'], ['b', 'c', 'd'], ['c'])).toEqual(['a', 'c']);
  const run = read('./scene-shots.ts');
  expect(run).toContain('const moving = await shootApp(');
  expect(run).toContain('lines.push(lineOf(scene, result, movingNow.includes(scene.name)));');
});

describe('a scene with lines in the phone\'s own words', () => {
  const named = (name: string) => SCENES.find((scene) => scene.name === name)!;
  const lost = named('home-lost-newer');
  const legal = named('legal');
  const notice = lineName(MESSAGES.en.home.lostNewer);
  const at = (text: string, apart: number): Result['texts'][number] => ({ text, web: [0, 0, 1, 1], app: Number.isFinite(apart) ? [0, 0, 1, 1] : null, apart });
  /** What the comparison finds of the notice of a newer life: its two lines in other words stand 5.67 pt apart and one is found in one shot only; the lines round it in the web's words are where the web has them. */
  const otherWords = (over: Partial<Result> = {}, others: Result['texts'] = [at('Settings', 0.33), at('New life', 0.67)]) => result('x', { shape: 0, texts: [at(notice, 5.67), at(notice, Infinity), ...others], ...over });

  it('are listed, each with its lines in the phone\'s words by the web\'s words for them: the notice of a newer life, and the legal page from what it keeps down', () => {
    expect(Object.keys(PHONE_WORDS)).toEqual(['home-lost-newer', 'legal']);
    expect(PHONE_WORDS['home-lost-newer']).toEqual([MESSAGES.en.home.lostNewer]);
    const legalWords = MESSAGES.en.legal;
    expect(PHONE_WORDS.legal).toEqual([legalWords.dataBody, legalWords.whyTitle, legalWords.whyBody, legalWords.whoTitle, legalWords.whoBody, legalWords.deviceTitle, legalWords.deviceBody, legalWords.rightsTitle, legalWords.rightsBody, legalWords.updated]);
    // The title, the first section and the way back are the web's words on the phone too, and are judged.
    for (const judged of [legalWords.title, legalWords.noticeTitle, legalWords.noticeBody]) expect(PHONE_WORDS.legal, judged).not.toContain(judged);
    expect(MESSAGES.en.phone.legal.noticeBody).toBe(legalWords.noticeBody);
    expect(MESSAGES.en.phone.legal.title).toBe(legalWords.title);
    for (const [name, lines] of Object.entries(PHONE_WORDS)) {
      expect(SCENES.map((scene) => scene.name), name).toContain(name);
      expect(hasPhoneWords(name)).toBe(true);
      for (const line of lines) expect(typeof line, name).toBe('string');
    }
    expect(hasPhoneWords('home-new')).toBe(false);
    // Of those, a page whose every section from some line down is other words is held to where it stands.
    expect(PHONE_PAGES).toEqual(['legal']);
    for (const name of PHONE_PAGES) expect(Object.keys(PHONE_WORDS)).toContain(name);
    // They are drawn by the real screens, so they are judged: at once, or once a batch pass has shot them.
    expect(Object.keys(PHONE_WORDS).every((name) => isJudged(named(name)))).toBe(true);
    // The net worth's sheet is in the web's words on both sides since its key is back in the messages (`end.realNetWorth`): no phone words of its own.
    for (const side of ['../../web/src/game/screens/Balance.tsx', '../src/game/screens/Balance.tsx']) expect(readFileSync(new URL(side, import.meta.url), 'utf8'), side).toContain("<Row left={end('realNetWorth')}");
    for (const locale of ['en', 'es', 'ru']) {
      const messages = JSON.parse(readFileSync(new URL(`../../../packages/i18n/messages/${locale}.json`, import.meta.url), 'utf8')) as { end: Record<string, unknown>; phone: Record<string, unknown> };
      expect(messages.end.realNetWorth, locale).toEqual(expect.any(String));
      expect(messages.phone.realNetWorth, locale).toBeUndefined();
    }
  });

  it('leaves out only its lines in the phone\'s words: they are counted and not judged, and every other line is held to the point, and the verdict says so', () => {
    const line = lineOf(lost, otherWords());
    expect(line.verdict).toBe('phone words, layout clean');
    // The numbers are kept: the lines in the phone's words are counted, and the rest measured.
    expect(line).toMatchObject({ scene: 'home-lost-newer', shape: 0, textLines: 4, phoneLines: 2, oneSided: 0, worstPt: 0.67 });
    expect(line).not.toHaveProperty('far');
    // The same numbers on a scene with the web's words fail it on its text.
    expect(lineOf(named('home-new'), otherWords()).verdict).toBe('differs');
    // A line in the web's words that stands apart, or is found in one shot only, fails the scene as it would any scene.
    for (const others of [[at('Settings', 1.5)], [at('Settings', Infinity)]]) {
      const moved = lineOf(lost, otherWords({}, others));
      expect(moved.verdict, JSON.stringify(others)).toBe('phone words, layout differs');
      expect(differing([moved]).map((one) => one.scene)).toEqual(['home-lost-newer']);
    }
    expect(lineOf(lost, otherWords({}, [at('Settings', 1.5)]))).toMatchObject({ far: [{ text: 'Settings', pt: 1.5 }] });
  });

  it('still fails for a layout that differs: a shape that is not where the web draws it', () => {
    expect(lineOf(lost, otherWords({ shape: 3 })).verdict).toBe('phone words, layout differs');
  });

  it('is held to its baseline from where the other words begin, and its lines in the web\'s words above are judged', () => {
    const legalWords = MESSAGES.en.legal;
    const page = (shape: number, others: Result['texts']) =>
      lineOf(legal, result('legal', { shape, rawPercent: 14.16, texts: [at(lineName(legalWords.dataBody), 56.67), at(lineName(legalWords.whoTitle), 97.67), at(lineName(legalWords.whyBody), Infinity), ...others] }));
    const judged = [at('←', 0.33), at(legalWords.title, 0.67), at(legalWords.noticeTitle, 0.33), at(lineName(legalWords.noticeBody), 0.67)];
    const line = page(PAGE_BASELINE.legal.shape, judged);
    expect(line.verdict).toBe('phone words, not comparable');
    expect(line).toMatchObject({ scene: 'legal', phoneLines: 3, oneSided: 0, worstPt: 0.67 });
    // The title a point and a half off, or the way back drawn in one shot only, fails it.
    for (const moved of [at(legalWords.title, 1.5), at('←', Infinity)]) {
      const failed = page(PAGE_BASELINE.legal.shape, [...judged.filter((one) => one.text !== moved.text), moved]);
      expect(failed.verdict, moved.text).toBe('phone words, layout differs');
      expect(differing([failed]).map((one) => one.scene)).toEqual(['legal']);
    }
  });

  it('is a wrong page all the same when most of the screen is unlike: the app showed something else', () => {
    expect(() => lineOf(lost, otherWords({ rawPercent: 70 }))).toThrow('home-lost-newer: a wrong page is not a result to keep');
    expect(() => lineOf(legal, otherWords({ rawPercent: 70 }))).toThrow('legal: a wrong page is not a result to keep');
  });

  it('makes a run fail only for a scene that differs, or whose layout does, or a page of other words that has drifted: not for a clean one, other words, one not shot yet or a page that cannot be compared', () => {
    const lines = [
      lineOf(named('home-new'), result('a', { shape: 0, texts: [] })),
      lineOf(named('home-new'), result('b', { shape: 1, texts: [] })),
      lineOf(lost, otherWords()),
      lineOf(named('legal'), result('legal', { shape: PAGE_BASELINE.legal.shape, texts: [] })),
      unjudgedLine(named('play-cards-r1')),
      lineOf(named('challenge-practice'), result('c', { shape: 0, texts: [{ text: 'a', web: [0, 0, 1, 1], app: [0, 0, 1, 1], apart: 3 }] })),
    ];
    expect(differing(lines).map((line) => line.scene)).toEqual(['home-new', 'challenge-practice']);
    expect(differing([lineOf(lost, otherWords({ shape: 5 }))]).map((line) => line.scene)).toEqual(['home-lost-newer']);
    expect(differing([])).toEqual([]);
  });

  it('is written to the report with its verdict', () => {
    const text = jsonOf([lineOf(lost, otherWords()), lineOf(legal, result('legal', { shape: PAGE_BASELINE.legal.shape, texts: [] }))]);
    expect(JSON.parse(text).map((line: { verdict: string }) => line.verdict)).toEqual(['phone words, layout clean', 'phone words, not comparable']);
  });
});

describe('what is accepted of a scene, and no more', () => {
  const named = (name: string) => SCENES.find((scene) => scene.name === name)!;
  const report = readFileSync(new URL('../../../docs/superpowers/reports/2026-10-21-phase-2-parity.md', import.meta.url), 'utf8');
  /**
   * A scene's numbers as the record has them, and then some: its shape, each line it names at its bound, a line it does not name at the point every
   * line is held to, and its lines in one shot only.
   */
  const measured = (name: string, more: { shape?: number; named?: number; other?: number; oneSided?: number } = {}): Result => {
    const record = ACCEPTED[name];
    const texts: Result['texts'] = [{ text: 'a line the record does not name', web: [0, 0, 1, 1], app: [0, 0, 1, 1], apart: TEXT_WITHIN_PT + (more.other ?? 0) }];
    for (const [line, bound] of Object.entries(record.lines ?? {})) texts.push({ text: lineName(line), web: [0, 0, 1, 1], app: [0, 0, 1, 1], apart: bound + (more.named ?? 0) });
    for (let i = 0; i < record.oneSided + (more.oneSided ?? 0); i++) texts.push({ text: `only ${i}`, web: [0, 0, 1, 1], app: null, apart: Infinity });
    return result(name, { shape: record.shape + (more.shape ?? 0), texts });
  };

  it('is a record for each scene whose residual is explained: the most it may differ by, what it is, and where the parity report says so', () => {
    expect(Object.keys(ACCEPTED).sort()).toEqual([
      'end-bankrupt',
      'end-ru',
      'end-share',
      'finance-business',
      'finance-buy-stock',
      'finance-taxes',
      'home-continue',
      'new-first',
      'new-locked',
      'new-replace',
      'new-unlocked',
      'play-cards-legendary',
      'play-guide-r1',
      'play-news-r1',
      'play-news-r6',
      'play-pageturn',
      'profile-r6',
    ]);
    for (const [name, record] of Object.entries(ACCEPTED)) {
      expect(SCENES.map((scene) => scene.name), name).toContain(name);
      // A page of other words throughout has a baseline, not a record; a scene with a line of the phone's own words may have one (its shape only).
      expect(PHONE_PAGES, name).not.toContain(name);
      expect(record.reason.length, name).toBeGreaterThan(30);
      // The heading it names is in the report, which is where its measured cause is written.
      expect(report, name).toContain(`\n## ${record.report}\n`);
      expect(record.shape).toBeGreaterThanOrEqual(0);
      // A line named is one the tolerance does not cover, named as the text check names it.
      for (const [line, bound] of Object.entries(record.lines ?? {})) {
        expect(bound, `${name}: ${line}`).toBeGreaterThan(TEXT_WITHIN_PT);
        expect(lineName(line), `${name}: ${line}`).toBe(line);
      }
    }
    // The lines named, after batch pass 2 (a scene-wide bound let every line of a scene drift as far as its worst): the dice of a new life, and the
    // headline under the guide's note.
    expect(Object.fromEntries(Object.entries(ACCEPTED).filter(([, record]) => record.lines !== undefined).map(([name, record]) => [name, record.lines]))).toEqual({
      'new-first': { '🎲 At random': 2 },
      'new-unlocked': { '🎲 At random': 2 },
      'new-locked': { '🎲 At random': 2 },
      'play-guide-r1': { 'New regulator created to regulate the re': 4 / 3 },
    });
  });

  /** The records of scenes in the web's words (a scene with lines in the phone's own words: below). */
  const worded = () => Object.keys(ACCEPTED).filter((name) => !hasPhoneWords(name));

  it('holds every line a record does not name to the point: a residual of one line lets no other line of the scene drift', () => {
    const scene = named('new-first');
    const texts = (other: number): Result['texts'] => [
      { text: '🎲 At random', web: [0, 0, 1, 1], app: [0, 0, 1, 1], apart: 2 },
      { text: 'New life', web: [0, 0, 1, 1], app: [0, 0, 1, 1], apart: other },
    ];
    expect(lineOf(scene, result('new-first', { shape: 700, texts: texts(1) })).verdict).toBe('accepted');
    const drifted = lineOf(scene, result('new-first', { shape: 700, texts: texts(1.5) }));
    expect(drifted.verdict).toBe('differs');
    // A scene's bound was its worst line before: 1.5 under 2 passed then.
    expect(drifted).toMatchObject({ worstPt: 2, far: [{ text: '🎲 At random', pt: 2 }, { text: 'New life', pt: 1.5 }] });
  });

  it('passes a scene that differs as the record says it does, and as no more: the same shape and text, or less, is accepted', () => {
    for (const name of worded()) {
      const line = lineOf(named(name), measured(name));
      expect(line.verdict, name).toBe('accepted');
      expect(differing([line]), name).toEqual([]);
      // Fewer shape pixels, or a nearer text, is no harm.
      expect(['accepted', 'clean'], name).toContain(lineOf(named(name), measured(name, { shape: -1 })).verdict);
      expect(lineOf(named(name), measured(name, { named: -0.01, other: -0.01 })).verdict, name).toBe('accepted');
    }
  });

  it('fails a scene on any growth: one more shape pixel, a hundredth of a point more on a line it names or on any other, a line of text in one shot only', () => {
    for (const name of worded()) {
      const onNamed = ACCEPTED[name].lines === undefined ? [] : [{ named: 0.01 }];
      for (const more of [{ shape: 1 }, ...onNamed, { other: 0.01 }, { oneSided: 1 }]) {
        const line = lineOf(named(name), measured(name, more));
        expect([name, JSON.stringify(more), line.verdict]).toEqual([name, JSON.stringify(more), 'differs']);
        expect(differing([line]).map((one) => one.scene)).toEqual([name]);
      }
    }
  });

  it('holds a scene with lines in the phone\'s own words to its record without them: its shape, and its other lines, and a shape pixel more fails it', () => {
    // No scene of the phone's words has a record since `balance-r6` speaks the web's (the user's decisions after batch pass 1): one is lent to the
    // notice of a newer life for this test, as one would be written for such a scene.
    const lost = named('home-lost-newer');
    const record: Accepted = { shape: 40, oneSided: 0, reason: 'a record lent by this test, to hold how a scene of the phone\'s own words is judged', report: 'x' };
    const records = ACCEPTED as Record<string, Accepted>;
    expect(records[lost.name]).toBeUndefined();
    records[lost.name] = record;
    try {
      expect(lineOf(lost, result(lost.name, { shape: record.shape, texts: [] })).verdict).toBe('phone words, layout accepted');
      expect(differing([lineOf(lost, result(lost.name, { shape: record.shape, texts: [] }))])).toEqual([]);
      expect(lineOf(lost, result(lost.name, { shape: 0, texts: [] })).verdict).toBe('phone words, layout clean');
      const grown = lineOf(lost, result(lost.name, { shape: record.shape + 1, texts: [] }));
      expect(grown.verdict).toBe('phone words, layout differs');
      expect(differing([grown]).map((one) => one.scene)).toEqual([lost.name]);
      // Its lines in the phone's words say nothing; another line beyond the point fails it.
      const words = { text: lineName(MESSAGES.en.home.lostNewer), web: [0, 0, 1, 1] as [number, number, number, number], app: [0, 0, 1, 1] as [number, number, number, number], apart: 5.67 };
      expect(lineOf(lost, result(lost.name, { shape: record.shape, texts: [words] })).verdict).toBe('phone words, layout accepted');
      expect(lineOf(lost, result(lost.name, { shape: record.shape, texts: [words, { ...words, text: 'Settings', apart: 1.2 }] })).verdict).toBe('phone words, layout differs');
    } finally {
      delete records[lost.name];
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
    const lines = SCENES.map((scene) => (isJudged(scene) ? lineOf(scene, scene.name in ACCEPTED ? measured(scene.name) : hasPhoneWords(scene.name) ? result(scene.name, { shape: PAGE_BASELINE[scene.name]?.shape ?? 0, texts: [] }) : result(scene.name, { shape: 0, texts: [] })) : unjudgedLine(scene)));
    expect(differing(lines)).toEqual([]);
    expect(new Set(lines.map((line) => line.verdict))).toEqual(new Set(['clean', 'accepted', 'phone words, layout clean', 'phone words, not comparable', ...(PENDING_SHOTS.size > 0 ? ['unjudged'] : [])]));
  });
});

test('the small cards of a step that earned badges are the web\'s result of a card with all but them taken out, over the Hud: the bar of the next step, the guide, the title, the card itself', () => {
  const earned = SCENES.find((scene) => scene.name === 'celebrate-earned')!;
  expect(webRules(earned)).toBe(CELEBRATIONS_ONLY);
  expect(CELEBRATIONS_ONLY).toBe('#round-actions, #round-stage > :not(:has(> [role="status"])), #round-stage > * > :not([role="status"]) { display: none !important; }');
  // The cards are the result's own children, beside its title and the card answered; nothing else of the stage holds one.
  const cards = readFileSync(new URL('../../web/src/game/screens/Cards.tsx', import.meta.url), 'utf8');
  const outcome = cards.slice(cards.indexOf('export function Outcome()'));
  expect(outcome).toContain('<div ref={area} className="relative flex flex-col gap-3 px-3">');
  expect(outcome.indexOf('<Celebrations />')).toBeGreaterThan(outcome.indexOf('<div ref={area}'));
  const celebrations = readFileSync(new URL('../../web/src/game/screens/Celebrations.tsx', import.meta.url), 'utf8');
  expect([...celebrations.matchAll(/role="status"/g)]).toHaveLength(2);
  expect(SCENES.filter((scene) => webRules(scene).includes(CELEBRATIONS_ONLY)).map((scene) => scene.name)).toEqual(['celebrate-earned']);
});
