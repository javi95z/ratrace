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
 * The one rule the web's pages are given in a shot. The web's body is padded by the safe area at the top and its `main` is `min-h-dvh`, so a short
 * page is taller than the screen by that area (62 pt on the iPhone 16 Pro): its foot, the settings and the small print, stands below the fold. The
 * phone's page scrolls inside the screen under the safe area and is as tall as the part that shows. The shot takes that one difference away from the
 * web, so what it measures is what is drawn, not where a short page ends.
 */
export const VISIBLE_HEIGHT = 'main { min-height: calc(100dvh - env(safe-area-inset-top)) !important; }';

/**
 * What the web draws of a scene that the phone does not, hidden in the web's shot so that what is left can be compared: on the challenge page the
 * line that tells a guest to sign in (`challenge.needsAccount`), which the phone does not draw while it has no way to sign in. Each is a rule for
 * the web's page: the line is the only `p` of that frame on the page of a guest.
 */
export const WEB_ONLY: Readonly<Record<string, string>> = {
  'challenge-practice': 'main > p.frame.bg-night-700 { display: none !important; }',
};

/** Every rule the web's page is given for a scene's shot: the height of its pages, and what it draws that the phone does not. */
export const webRules = (scene: Scene): string => [VISIBLE_HEIGHT, WEB_ONLY[scene.name]].filter((rule) => rule !== undefined).join(' ');

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

/**
 * The screens the app still draws as phase 1's stand-ins (`SCENE_SCREENS` in apps/mobile/src/testing/scene.tsx; a test holds the two
 * the same). A scene on one of them is not compared: web screen against stand-in, its numbers say nothing, and must not be read as
 * results. The task that ports a screen takes its word out of this list.
 */
export const STAND_INS: readonly string[] = ['play', 'records', 'collection'];

/**
 * The scenes whose words are the phone's own (`phone.*` in the messages, where the web's words tell a phone player something false or impossible:
 * "reload the page"). The two shots cannot agree on their text, whatever the app does, so these are compared for their layout and shape only: the
 * text rows are reported (they are in the line) and not judged, and the verdict says so.
 */
export const PHONE_WORDS: readonly string[] = ['home-lost-newer', 'legal'];

/**
 * Of those, the scenes whose whole page is other words (the legal notice: other sections, other paragraphs, other lengths), where every box
 * stands where the length of its text puts it. Their shapes are not a layout to judge either, so they are reported and never fail a run; the
 * layout of such a page is judged once, by drawing the phone's page with the web's own words (the parity report says how it was done for `legal`).
 */
export const PHONE_PAGES: readonly string[] = ['legal'];

/** Whether a scene is compared: its screen is the real one on the app. */
export const isJudged = (scene: Scene): boolean => !STAND_INS.includes(screenOf(scene));

/** What the report keeps of a scene: its verdict, and for a scene that is judged how much of the two shots differs and how far apart the text stands. */
export type Line =
  | { scene: string; locale: string; verdict: 'unjudged'; why: string }
  | {
      scene: string;
      locale: string;
      /** A scene of the phone's own words (`PHONE_WORDS`) is judged by its layout alone, and says so. */
      verdict: 'clean' | 'differs' | 'phone words, layout clean' | 'phone words, layout differs' | 'phone words, not comparable';
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
    };

const round = (value: number, places: number) => Math.round(value * 10 ** places) / 10 ** places;

/** A scene that is not compared, and why: no numbers. */
export const unjudgedLine = (scene: Scene): Line => ({ scene: scene.name, locale: scene.locale, verdict: 'unjudged', why: `the app still draws a stand-in for ${screenOf(scene)}: its numbers say nothing` });

/** What a scene of the phone's own words comes to: its layout, by its shape alone, or nothing where the whole page is other words. */
function phoneVerdict(scene: Scene, result: Result): 'phone words, layout clean' | 'phone words, layout differs' | 'phone words, not comparable' {
  if (PHONE_PAGES.includes(scene.name)) return 'phone words, not comparable';
  return result.shape === 0 ? 'phone words, layout clean' : 'phone words, layout differs';
}

/** A compared scene's line. A shot of the wrong page is stopped before this (`wrongPage`); if one gets here it is not kept. */
export function lineOf(scene: Scene, result: Result): Line {
  const plain = verdictOf(result);
  if (plain === 'wrong page') throw new Error(`${scene.name}: a wrong page is not a result to keep`);
  const verdict = PHONE_WORDS.includes(scene.name) ? phoneVerdict(scene, result) : plain;
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
  };
}

/** The lines that fail a run: a scene that differs, or whose layout does. A clean one, one in the phone's own words, a page that cannot be compared and a stand-in do not. */
export const differing = (lines: readonly Line[]): Line[] => lines.filter((line) => line.verdict === 'differs' || line.verdict === 'phone words, layout differs');

/** The lines of the report after a run: those kept of scenes not shot this time, and the new ones, in the order the scenes are listed. */
export function mergeLines(kept: readonly Line[], now: readonly Line[]): Line[] {
  const order = (line: Line) => SCENES.findIndex((scene) => scene.name === line.scene);
  return [...kept.filter((line) => !now.some((fresh) => fresh.scene === line.scene)), ...now].sort((a, b) => order(a) - order(b));
}

/** The report as a file: a list with a line to each scene. */
export const jsonOf = (lines: readonly Line[]): string => `[\n${lines.map((line) => `  ${JSON.stringify(line)}`).join(',\n')}\n]\n`;
