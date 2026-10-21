import { SCENES, screenOf } from '@ratrace/core/testing/scenes';
import type { Scene } from '@ratrace/core/testing/scenes';
import { textSummary, verdictOf } from './kitCompare';
import type { Result } from './kitCompare';

/*
 * What `scene-shots.ts` decides before it opens a browser or a simulator: which scenes, where each is shown on either
 * side, what files come of it, and what the report says of each. Apart, so it can be tested.
 */

/** The folder under `docs/superpowers/reports` that has the scenes' pictures and their numbers: scenes are phase 2's. */
export const SCENES_FOLDER = 'phase-2-parity';
/** The numbers of the scenes shot, in that folder: a line to each. */
export const SCENES_FILE = 'phase-2-parity.json';

/**
 * A scene of the Hud (`hud-*`) is drawn by the web's Play, which is the Hud's only page, and by the phone's Hud alone (Play is Task 9's): what
 * Play draws besides the Hud, the stage of the round (`main#round-stage`: the guide, the news, the finances) and the bar of its next step
 * (`#round-actions`), is taken out of the web's shot (`display: none`: nothing of it is drawn, and none of its text is measured, as hidden
 * text would be), so that the Hud is compared over the page's ground on both sides. Nothing of the Hud is under either, and nothing of it moves.
 */
export const HUD_ONLY = '#round-stage, #round-actions { display: none !important; }';

/**
 * The calendar of a turning round (`play-pageturn`) takes no pointer, so a tap goes through it; and the web's text check, which asks what is on top
 * along each line (`elementFromPoint` in `TEXT_BOXES`), went through it too, and measured a line of the paper under it with the calendar's ink
 * (4.33 pt). In that scene's shot the calendar itself, the child of the layer over the whole screen and not that layer, takes the pointer: a line
 * it covers in part is measured where it shows either side of it, and the lines round it are not covered by it.
 */
export const CALENDAR_COVERS = '[data-motion-only] > * { pointer-events: auto !important; }';

/**
 * The small cards of what a step earned (`celebrate-earned`) are the result of a card's own children, beside its title and the card answered (Cards.tsx,
 * Task 11): in that scene's shot everything of the stage but them is taken out, and the bar of the next step, so the page is the Hud and the cards under
 * it, 12 below its figures (the stage's `pt-3`) and 12 apart (the result's `gap-3`), as the phone draws them beside its Hud.
 */
export const CELEBRATIONS_ONLY = '#round-actions, #round-stage > :not(:has(> [role="status"])), #round-stage > * > :not([role="status"]) { display: none !important; }';

/**
 * The screens of the scenes drawn over the Hud alone (`HUD_ONLY`): the Hud's own, and two whose sheet is a part of Play's stage, compared over the Hud
 * alone (the sheet that moves cash to savings, Finance's, as recorded in Task 10 before Finance was on the phone; a legendary badge, a card's result's:
 * its scene compares the sheet, the result and the finances have scenes of their own), which both sides draw beside the Hud.
 */
export const SHEETS_OVER_THE_HUD: readonly string[] = ['hud', 'amount', 'celebrate'];

/**
 * What the web draws of a scene that the phone does not, hidden in the web's shot so that what is left can be compared: on the challenge page the
 * line that tells a guest to sign in (`challenge.needsAccount`), which the phone does not draw while it has no way to sign in. Each is a rule for
 * the web's page: the line is the only `p` of that frame on the page of a guest. And on the scenes of the Hud, and of a sheet drawn over it, everything of Play
 * but the Hud (`HUD_ONLY`); of the badges a step earned, everything of Play but the Hud and the cards (`CELEBRATIONS_ONLY`).
 * And one rule that hides nothing, for the text check alone: the calendar covers what it covers (`CALENDAR_COVERS`).
 */
export const WEB_ONLY: Readonly<Record<string, string>> = {
  'challenge-practice': 'main > p.frame.bg-night-700 { display: none !important; }',
  'play-pageturn': CALENDAR_COVERS,
  ...Object.fromEntries(SCENES.filter((scene) => SHEETS_OVER_THE_HUD.includes(screenOf(scene))).map((scene) => [scene.name, HUD_ONLY])),
  'celebrate-earned': CELEBRATIONS_ONLY,
};

/**
 * Every rule the web's page is given for a scene's shot: what it draws that the phone does not, and nothing else. (Its pages are as tall as the screen
 * under the notch by their own rule since the web's d67284b, `min-h-safe`, which the web's viewport.test holds: the shots' own height rule of Task 6,
 * `VISIBLE_HEIGHT`, which did the same, is gone.)
 */
export const webRules = (scene: Scene): string => WEB_ONLY[scene.name] ?? '';

/** The web's page for a scene, in the scene's language (the web's pages are all under their language). */
export const sceneWebUrl = (scene: Scene, port: number): string => `http://localhost:${port}/${scene.locale}/kit/scene?name=${scene.name}`;

/** The app's route for a scene, as Expo Go is opened on it. */
export const sceneAppRoute = (scene: Scene): string => `scene?name=${scene.name}`;

/** What a scene writes: the web's shot, the app's shot, and the picture of what is unlike in them. */
export const filesOf = (name: string): { web: string; app: string; diff: string } => ({ web: `${name}-web.png`, app: `${name}-app.png`, diff: `${name}-diff.png` });

/** The scenes named, in the order they are listed (not the order they were named in), or all of them. A name that is none stops the run. */
export function chooseScenes(only: readonly string[] | undefined): Scene[] {
  if (only === undefined) return [...SCENES];
  const unknown = only.filter((name) => !SCENES.some((scene) => scene.name === name));
  if (unknown.length > 0) throw new Error(`unknown scene: ${unknown.join(', ')}`);
  return SCENES.filter((scene) => only.includes(scene.name));
}

/*
 * Phase 1's stand-ins are gone: every screen a scene is drawn on is the real one on the app. Until Task 19 a screen the app still drew as a
 * stand-in (`STAND_INS`: the records and the collection were the last) and a stage of Play a later task brought (`STAND_IN_SCENES`: the ledger
 * was the last, in Task 16) were not compared, their numbers saying nothing; both lists were emptied and are retired. A scene is now unjudged only
 * while it waits for a batch pass to shoot it (`PENDING_SHOTS`).
 */

/**
 * The scenes of a screen that is ported and not shot yet. From Task 11 on, a screen's task registers its scenes and does not shoot them (the user's
 * call, 2026-10-21): two batch passes, after Task 15 and in Task 20, shoot every one of these, compare them and fix what differs, and take each out
 * of this list as it is judged. Until then a scene here is unjudged, as a stand-in's was: no numbers, and nothing that could fail a run or pass for a
 * result.
 */
export const PENDING_SHOTS: ReadonlySet<string> = new Set([
  // Task 11: the cards and what came of them.
  'play-cards-r1',
  'play-cards-legendary',
  'play-cards-three',
  'play-cards-ru-360',
  'play-outcome-r1',
  // Task 12: the finances (their portfolio, the basket, the pension, the row of tabs in Russian on a narrow phone).
  'play-finance-r6',
  'finance-basket',
  'finance-pension',
  'finance-tabs-ru-360',
  // Task 13: the market, the sheet that buys a share (with its chart), the property tab and the debt tab.
  'finance-market',
  'finance-buy-stock',
  'finance-property',
  'finance-debt',
  // Task 14: the way of life, the sheet of every city, the city a card offers, and the work panel of the profile.
  'finance-lifestyle',
  'finance-move',
  'play-cards-city',
  'work-panel',
  // Task 15: the shop, a thing's sheet, the taxes and the businesses.
  'finance-shop',
  'finance-item',
  'finance-taxes',
  'finance-business',
  // Task 17: the player's profile (over Play, as the portrait opens it), a thing owned, the net worth's line with its graph, and the rivals' board.
  'profile-r6',
  'profile-owned',
  'balance-r6',
  'rivals-r6',
  // Task 18: the end of a life (out of the rat race, bankrupt, its picture to share open, in Russian).
  'end-escaped',
  'end-bankrupt',
  'end-share',
  'end-ru',
  // Task 16: the ledger of a round, every line risen, and the moments of a life over it (or over the news, for a crisis).
  'play-resolve-r6',
  'moment-escape',
  'moment-bankrupt',
  'moment-crisis',
  // Task 19: the records of past lives (none, three lives lived, the latest's sheet) and the collection (its things, its badges).
  'records-empty',
  'records-three',
  'records-detail',
  'collection-items',
  'collection-badges',
  // The merge of the lanes: a thing bought on instalments, its sheet over the profile with what is still owed on it (ItemCost's owed line).
  'profile-financed',
]);

/**
 * The scenes whose words are the phone's own (`phone.*` in the messages, where the web's words tell a phone player something false or impossible:
 * "reload the page"; or where the web shows no words at all, but a key that is not in the messages: the net worth after inflation in `balance-r6`,
 * which the web writes `end.realNetWorth` and the phone `phone.realNetWorth`). The two shots cannot agree on their text, whatever the app does, so these
 * are compared for their layout and shape only: the text rows are reported (they are in the line) and not judged, and the verdict says so.
 */
export const PHONE_WORDS: readonly string[] = [
  'home-lost-newer',
  'legal',
  'balance-r6',
];

/**
 * Of those, the scenes whose whole page is other words (the legal notice: other sections, other paragraphs, other lengths), where every box
 * stands where the length of its text puts it. Their shapes are not a layout to judge either, so they are reported and never fail a run; the
 * layout of such a page is judged once, by drawing the phone's page with the web's own words (the parity report says how it was done for `legal`).
 */
export const PHONE_PAGES: readonly string[] = ['legal'];

/**
 * What a scene's two shots are accepted to differ by, for a scene that does and whose residual is explained in the parity report (with its measured cause): a run
 * passes when the scene's numbers stay within the record, and fails on any growth (a pixel more, a hundredth of a point more, a line of text in one shot only). The
 * numbers are those of the last shoot; a residual that grows, or a new one, is a difference to look at, and one that is mended is a record to tighten.
 */
export interface Accepted {
  /** The most shape pixels (what differs and is not text) accepted. */
  shape: number;
  /** The most any line of text may stand apart, in points. */
  worstPt: number;
  /** The most lines of text found in one shot only. */
  oneSided: number;
  /** What the residual is. */
  reason: string;
  /** The heading (`## ...`) of the parity report that explains it, with its cause. */
  report: string;
}

export const ACCEPTED: Readonly<Record<string, Accepted>> = {
  'home-continue': {
    shape: 1,
    worstPt: 0.67,
    oneSided: 0,
    reason: 'One pixel at the edge of a glyph the text check\'s windows did not cover (the descender of the "y" of "your" in the continue button\'s title); nothing is out of place.',
    report: 'Task 6: the front door, its settings, the week\'s challenge and the legal notice',
  },
  'new-first': {
    shape: 738,
    worstPt: 2,
    oneSided: 0,
    reason: 'The dice emoji (Apple Color Emoji sits 2 pt lower on iOS than on macOS Chrome), the arrow of the folded list (macOS\'s system sign against iOS\'s), and whole CSS pixels against device pixels.',
    report: 'Task 7: choosing a new life',
  },
  'new-unlocked': {
    shape: 738,
    worstPt: 2,
    oneSided: 0,
    reason: 'The same as new-first: the dice emoji, the arrow of the folded list, and whole CSS pixels against device pixels.',
    report: 'Task 7: choosing a new life',
  },
  'new-locked': {
    shape: 1267,
    worstPt: 2,
    oneSided: 0,
    reason: 'The same as new-first (the dice emoji, the arrow, whole CSS pixels against device pixels), over the rows of the locked lives.',
    report: 'Task 7: choosing a new life',
  },
  'play-news-r1': {
    shape: 1446,
    worstPt: 1,
    oneSided: 0,
    reason: 'The paper\'s masthead, centred, stands a device pixel left of the web\'s (a sub-pixel centring), and is not measured as text: the paper\'s rules of the same ink lie within its window, so its glyphs\' edges count as shape.',
    report: 'Task 9: play, round by round, from the news',
  },
  'play-news-r6': {
    shape: 1518,
    worstPt: 1,
    oneSided: 0,
    reason: 'The masthead as in play-news-r1, and the label of the bar\'s button two device pixels higher than the web\'s (whole CSS pixels against device pixels, as the kit\'s buttons of Task 7).',
    report: 'Task 9: play, round by round, from the news',
  },
  'play-guide-r1': {
    shape: 3504,
    // Four device pixels.
    worstPt: 4 / 3,
    oneSided: 0,
    reason: 'The masthead as in play-news-r1, and everything under the guide\'s note two device pixels lower: the web paints the note\'s foot at a whole CSS pixel (564.48 to 564), the phone at a device pixel (564.67).',
    report: 'Task 9: play, round by round, from the news',
  },
  'play-pageturn': {
    shape: 4309,
    // Three device pixels: the ▸ of the HUD's figures, as in every scene of the HUD.
    worstPt: 1,
    oneSided: 0,
    reason: 'The torn page, turned, has antialiased edges the other shot draws hard (phase 2\'s exception), all along them now that the lines of the paper it covers are measured only where they show (CALENDAR_COVERS), and the masthead as in play-news-r1.',
    report: 'Task 9: play, round by round, from the news',
  },
  'celebrate-earned': {
    shape: 44,
    // Two device pixels.
    worstPt: 1,
    oneSided: 0,
    reason: 'The lines of the badges\' cards each stand where the phone lays them on its device pixels (within 2/3 pt of the web\'s): the 12 pt gold "BADGE EARNED" two device pixels lower, its bottom row of glyphs one row past the text check\'s window (21 px a card), and two pixels of the "y" of the legendary card\'s name.',
    report: 'Task 10: amounts on a slider, celebrations, flying coins and medals',
  },
  'new-replace': {
    shape: 1159,
    worstPt: 1,
    oneSided: 0,
    reason: 'The dice emoji under the backdrop, the labels of the sheet\'s two buttons 2 device pixels higher, and whole CSS pixels against device pixels.',
    report: 'Task 7: choosing a new life',
  },
};

/**
 * A page of the phone's own words from top to bottom (`PHONE_PAGES`) has no shape that says anything of its layout, but it does not move: where it stood when its
 * words were last written is the baseline, and a shape that is more than `drift` (a share of it) away from it, either way, fails the run. A change of the words is
 * a new baseline, written here by whoever changes them (the parity report says how the layout was judged).
 */
export interface PageBaseline {
  shape: number;
  drift: number;
  reason: string;
  report: string;
}

export const PAGE_BASELINE: Readonly<Record<string, PageBaseline>> = {
  legal: {
    shape: 39721,
    drift: 0.1,
    reason: 'The phone\'s notice has other sections and other lengths than the web\'s, so every box under the first heading stands where its own text puts it: the shape is that of the text.',
    report: 'Task 6: the front door, its settings, the week\'s challenge and the legal notice',
  },
};

/** Whether a scene is compared: every screen is the real one on the app, so every scene is, once a batch pass has shot it. */
export const isJudged = (scene: Scene): boolean => !PENDING_SHOTS.has(scene.name);

/** What the report keeps of a scene: its verdict, and for a scene that is judged how much of the two shots differs and how far apart the text stands. */
export type Line =
  | { scene: string; locale: string; verdict: 'unjudged'; why: string }
  | {
      scene: string;
      locale: string;
      /** A scene of the phone's own words (`PHONE_WORDS`) is judged by its layout alone, and says so. */
      verdict: 'clean' | 'differs' | 'accepted' | 'phone words, layout clean' | 'phone words, layout differs' | 'phone words, not comparable' | 'phone words, drifted';
      rawPercent: number;
      beyondPercent: number;
      loose: number;
      shape: number;
      shapeBlended: number;
      textLines: number;
      unmeasured: number;
      /** Lines of text found in one shot and not the other: text the app does not draw, or draws elsewhere altogether. */
      oneSided: number;
      /** The most any line's ink stands apart in the two shots, of those found in both. */
      worstPt: number;
      /** The app's screen never stood still while it was shot (`stillShot`): what was compared is one moment of something moving, and the run fails for it. */
      moving?: true;
    };

const round = (value: number, places: number) => Math.round(value * 10 ** places) / 10 ** places;

/** A scene that is not compared, and why: no numbers. The only one is a scene still to be shot. */
export const unjudgedLine = (scene: Scene): Line => ({
  scene: scene.name,
  locale: scene.locale,
  verdict: 'unjudged',
  why: 'ported and not shot yet: a batch pass shoots it and judges it',
});

/** What a scene of the phone's own words comes to: its layout, by its shape alone, or nothing where the whole page is other words. */
function phoneVerdict(scene: Scene, result: Result): 'phone words, layout clean' | 'phone words, layout differs' | 'phone words, not comparable' | 'phone words, drifted' {
  if (PHONE_PAGES.includes(scene.name)) {
    const base = PAGE_BASELINE[scene.name];
    return base === undefined || Math.abs(result.shape - base.shape) <= base.shape * base.drift ? 'phone words, not comparable' : 'phone words, drifted';
  }
  return result.shape === 0 ? 'phone words, layout clean' : 'phone words, layout differs';
}

/** Whether a scene that differs differs by no more than its record says. */
function withinRecord(scene: Scene, result: Result): boolean {
  const record = ACCEPTED[scene.name];
  const text = textSummary(result);
  return record !== undefined && result.shape <= record.shape && text.worstPt <= record.worstPt && text.oneSided <= record.oneSided;
}

/** A compared scene's line. A shot of the wrong page is stopped before this (`wrongPage`); if one gets here it is not kept. `moving`: the app's shot never stood still. */
export function lineOf(scene: Scene, result: Result, moving = false): Line {
  const plain = verdictOf(result);
  if (plain === 'wrong page') throw new Error(`${scene.name}: a wrong page is not a result to keep`);
  const verdict = PHONE_WORDS.includes(scene.name) ? phoneVerdict(scene, result) : plain === 'differs' && withinRecord(scene, result) ? 'accepted' : plain;
  const text = textSummary(result);
  return {
    scene: scene.name,
    locale: scene.locale,
    verdict,
    rawPercent: round(result.rawPercent, 2),
    beyondPercent: round(result.beyondPercent, 3),
    loose: result.loose,
    shape: result.shape,
    shapeBlended: result.shapeBlended ?? 0,
    textLines: text.lines,
    unmeasured: text.unmeasured,
    oneSided: text.oneSided,
    worstPt: round(text.worstPt, 2),
    ...(moving ? { moving: true as const } : {}),
  };
}

/**
 * The lines that fail a run: a scene that differs (beyond what is accepted of it), or whose layout does, or a page of other words that has drifted from its baseline,
 * or whose app shot never stood still, whatever it came to. A clean one, one accepted, one in the phone's own words, a page that cannot be compared and one not shot yet do not.
 */
export const differing = (lines: readonly Line[]): Line[] =>
  lines.filter((line) => line.verdict === 'differs' || line.verdict === 'phone words, layout differs' || line.verdict === 'phone words, drifted' || (line.verdict !== 'unjudged' && line.moving === true));

/** The scenes whose app shot never stood still, kept beside the raw shots from the app's step to the comparison (which may be run apart). */
export const MOVING_FILE = 'scenes-moving.json';

/** The scenes left moving after an app step: those of the scenes not shot this time as they were, and of those shot now the ones that never stood still. */
export const movingAfter = (kept: readonly string[], shot: readonly string[], moving: readonly string[]): string[] => [...kept.filter((name) => !shot.includes(name)), ...moving];

/** The lines of the report after a run: those kept of scenes not shot this time, and the new ones, in the order the scenes are listed. */
export function mergeLines(kept: readonly Line[], now: readonly Line[]): Line[] {
  const order = (line: Line) => SCENES.findIndex((scene) => scene.name === line.scene);
  return [...kept.filter((line) => !now.some((fresh) => fresh.scene === line.scene)), ...now].sort((a, b) => order(a) - order(b));
}

/** The report as a file: a list with a line to each scene. */
export const jsonOf = (lines: readonly Line[]): string => `[\n${lines.map((line) => `  ${JSON.stringify(line)}`).join(',\n')}\n]\n`;
