import { SCENES } from '@ratrace/core/testing/scenes';
import type { Scene } from '@ratrace/core/testing/scenes';
import type { Result } from './kitCompare';

/*
 * What `scene-shots.ts` decides before it opens a browser or a simulator: which scenes, where each is shown on either
 * side, what files come of it, and what the report says of each. Apart, so it can be tested.
 */

/** The folder under `docs/superpowers/reports` that has the scenes' pictures and their numbers: scenes are phase 2's. */
export const SCENES_FOLDER = 'phase-2-parity';
/** The numbers of the scenes shot, in that folder: a line to each. */
export const SCENES_FILE = 'phase-2-parity.json';

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

/** What the report keeps of a scene: how much of the two shots differs, and how far apart the text stands. */
export interface Line {
  scene: string;
  locale: string;
  rawPercent: number;
  beyondPercent: number;
  loose: number;
  shape: number;
  shapeBlended: number;
  textLines: number;
  unmeasured: number;
  /** Lines of text whose ink is found in one shot and not the other: text the app does not draw, or draws elsewhere altogether. */
  oneSided: number;
  /** The most any line's ink stands apart in the two shots, of those found in both. */
  worstPt: number;
}

const round = (value: number, places: number) => Math.round(value * 10 ** places) / 10 ** places;

export function lineOf(scene: Scene, result: Result): Line {
  const measured = result.texts.filter((text) => !text.unmeasured);
  const both = measured.filter((text) => Number.isFinite(text.apart));
  return {
    scene: scene.name,
    locale: scene.locale,
    rawPercent: round(result.rawPercent, 2),
    beyondPercent: round(result.beyondPercent, 3),
    loose: result.loose,
    shape: result.shape,
    shapeBlended: result.shapeBlended ?? 0,
    textLines: result.texts.length,
    unmeasured: result.texts.length - measured.length,
    oneSided: measured.length - both.length,
    worstPt: round(both.reduce((worst, text) => Math.max(worst, text.apart), 0), 2),
  };
}

/** The lines of the report after a run: those kept of scenes not shot this time, and the new ones, in the order the scenes are listed. */
export function mergeLines(kept: readonly Line[], now: readonly Line[]): Line[] {
  const order = (line: Line) => SCENES.findIndex((scene) => scene.name === line.scene);
  return [...kept.filter((line) => !now.some((fresh) => fresh.scene === line.scene)), ...now].sort((a, b) => order(a) - order(b));
}

/** The report as a file: a list with a line to each scene. */
export const jsonOf = (lines: readonly Line[]): string => `[\n${lines.map((line) => `  ${JSON.stringify(line)}`).join(',\n')}\n]\n`;
