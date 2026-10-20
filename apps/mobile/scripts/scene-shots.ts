import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SCENE_NOW } from '@ratrace/core/testing/scenes';
import { compareShots, wrongPage } from './kitCompare';
import type { TextBox } from './kitCompare';
import { chooseScenes, filesOf, isJudged, jsonOf, lineOf, mergeLines, sceneAppRoute, sceneWebUrl, SCENES_FILE, SCENES_FOLDER, unjudgedLine } from './sceneShots';
import type { Line } from './sceneShots';
import { fromWeb, openPage, PORT, raw, root, shootApp, TEXT_BOXES, withWebPage } from './shotDrivers';

/**
 * The scenes beside the web's, shot for shot: each named game state (packages/core/src/testing/scenes.ts), drawn by the
 * web on its scene page and by the app on its scene route, at the iPhone 16 Pro's size (the drivers are `shotDrivers.ts`,
 * the kit's too), then compared pixel by pixel as the kit is. Into docs/superpowers/reports/phase-2-parity/:
 * `<name>-web.png`, `<name>-app.png` and, for a scene that is compared, `<name>-diff.png`, and a line to each scene in
 * `phase-2-parity.json`: its verdict, and its numbers.
 *
 *   pnpm --filter @ratrace/web exec tsx ../mobile/scripts/scene-shots.ts [web] [app] [compare] [--only=name,name]
 *
 * With no step named, all three. The web is served by its own `next dev` on port 3021, started and stopped here (a server
 * already answering there is refused), and its browser is kept from every host but this machine. The app is opened in Expo Go
 * from the Metro running on 8090 (`npx expo start --port 8090` in apps/mobile).
 *
 * Every scene is drawn on the same day (`SCENE_NOW`): the browser's clock is held at it, the app's services answer it.
 * A scene on a screen the app still draws as a stand-in (`STAND_INS`) is shot but not compared: its line is `unjudged`. A
 * compared scene whose app shot is more than half unlike the web's is the wrong page (a stand-in, a reload, a red box):
 * the run stops and exits 1, as the kit's does. When every scene compared is clean the run exits 0; a scene that differs
 * is listed and exits 1.
 */
const out = join(root, 'docs/superpowers/reports', SCENES_FOLDER);

async function main() {
  const args = process.argv.slice(2);
  const only = args.find((a) => a.startsWith('--only='))?.slice('--only='.length).split(',');
  const scenes = chooseScenes(only);
  const steps = args.filter((a) => !a.startsWith('--'));
  const all = steps.length === 0;
  mkdirSync(raw, { recursive: true });
  mkdirSync(out, { recursive: true });

  if (all || steps.includes('web')) {
    await withWebPage(sceneWebUrl(scenes[0], PORT), async (page) => {
      for (const scene of scenes) {
        // The day, before the page is loaded: the week's challenge and the days left of it are read from the browser's clock.
        await page.clock.setFixedTime(SCENE_NOW);
        // The page marks itself once the scene's store is built, its steps are taken and the game is drawn on it.
        await openPage(page, sceneWebUrl(scene, PORT), () => document.querySelector('[data-scene]') !== null);
        const day = await page.evaluate(() => Date.now());
        if (day !== SCENE_NOW) throw new Error(`${scene.name}: the browser's clock is ${new Date(day).toISOString()}, not ${new Date(SCENE_NOW).toISOString()}`);
        await page.screenshot({ path: join(out, filesOf(scene.name).web) });
        // Where each line of text stands, so the comparison can tell a glyph's edge from a box's.
        writeFileSync(join(raw, `${scene.name}-text.json`), JSON.stringify(await page.evaluate(TEXT_BOXES)));
        console.log(`web ${scene.name}`);
      }
    });
  }

  // Expo Go is closed and opened once first: left running, it would show the bundle of the Metro it saw last.
  if (all || steps.includes('app')) await shootApp(scenes.map((scene) => ({ route: sceneAppRoute(scene), png: join(out, filesOf(scene.name).app) })), { fresh: true });

  if (all || steps.includes('compare')) {
    const sharp: unknown = fromWeb('sharp');
    const lines: Line[] = [];
    for (const scene of scenes) {
      const files = filesOf(scene.name);
      const [a, b, text] = [join(out, files.web), join(out, files.app), join(raw, `${scene.name}-text.json`)];
      if (!existsSync(a) || !existsSync(b)) throw new Error(`missing shots for ${scene.name}`);
      if (!isJudged(scene)) {
        // The app draws a stand-in: nothing to compare, and nothing that could be read as a result.
        lines.push(unjudgedLine(scene));
        continue;
      }
      if (!existsSync(text)) throw new Error(`missing shots for ${scene.name}`);
      const result = await compareShots(sharp, scene.name, readFileSync(a), readFileSync(b), JSON.parse(readFileSync(text, 'utf8')) as TextBox[], out, files.diff);
      // Half the screen unlike is not a difference to list: the app showed something else.
      const wrong = wrongPage(result, 'scene', b);
      if (wrong !== null) throw new Error(wrong);
      lines.push(lineOf(scene, result));
    }
    // A run of some scenes keeps the lines of the others.
    const file = join(out, SCENES_FILE);
    const kept = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Line[]) : [];
    writeFileSync(file, jsonOf(mergeLines(kept, lines)));
    for (const line of lines) {
      if (line.verdict === 'unjudged') console.log(`${line.scene.padEnd(18)} unjudged: ${line.why}`);
      else console.log(`${line.scene.padEnd(18)} ${line.verdict.padEnd(7)} raw ${line.rawPercent} %  beyond ${line.beyondPercent} %  a point away ${line.loose} px, not text ${line.shape} px  text lines ${line.textLines} (unmeasured ${line.unmeasured}, in one shot only ${line.oneSided}), worst ${line.worstPt} pt`);
    }
    const differ = lines.filter((line) => line.verdict === 'differs');
    if (differ.length > 0) {
      console.error(`differs: ${differ.map((line) => line.scene).join(', ')}`);
      process.exitCode = 1;
    }
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
