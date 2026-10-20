import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compareShots } from './kitCompare';
import type { TextBox } from './kitCompare';
import { chooseScenes, filesOf, jsonOf, lineOf, mergeLines, sceneAppRoute, sceneWebUrl, SCENES_FILE, SCENES_FOLDER } from './sceneShots';
import type { Line } from './sceneShots';
import { fromWeb, openPage, PORT, raw, root, shootApp, TEXT_BOXES, withWebPage } from './shotDrivers';

/**
 * The scenes beside the web's, shot for shot: each named game state (packages/core/src/testing/scenes.ts), drawn by the
 * web on its scene page and by the app on its scene route, at the iPhone 16 Pro's size (the drivers are `shotDrivers.ts`,
 * the kit's too), then compared pixel by pixel as the kit is. Into docs/superpowers/reports/phase-2-parity/:
 * `<name>-web.png`, `<name>-app.png` and `<name>-diff.png`, and a line to each scene in `phase-2-parity.json`.
 *
 *   pnpm --filter @ratrace/web exec tsx ../mobile/scripts/scene-shots.ts [web] [app] [compare] [--only=name,name]
 *
 * With no step named, all three. The web is served by its own `next dev` on port 3021, started and stopped here. The app
 * is opened in Expo Go from the Metro running on 8090 (`npx expo start --port 8090` in apps/mobile).
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
        // The page marks itself once the scene's store is built and the game is drawn on it.
        await openPage(page, sceneWebUrl(scene, PORT), () => document.querySelector('[data-scene]') !== null);
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
      if (!existsSync(a) || !existsSync(b) || !existsSync(text)) throw new Error(`missing shots for ${scene.name}`);
      const result = await compareShots(sharp, scene.name, readFileSync(a), readFileSync(b), JSON.parse(readFileSync(text, 'utf8')) as TextBox[], out, files.diff);
      lines.push(lineOf(scene, result));
    }
    // A run of some scenes keeps the lines of the others.
    const file = join(out, SCENES_FILE);
    const kept = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Line[]) : [];
    writeFileSync(file, jsonOf(mergeLines(kept, lines)));
    for (const line of lines) {
      // Not judged here: a screen not yet ported is drawn by the app as a stand-in, and the two are then nothing alike.
      console.log(`${line.scene.padEnd(18)} raw ${line.rawPercent} %  beyond ${line.beyondPercent} %  a point away ${line.loose} px, not text ${line.shape} px  text lines ${line.textLines} (unmeasured ${line.unmeasured}, in one shot only ${line.oneSided}), worst ${line.worstPt} pt`);
    }
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
