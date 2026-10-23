import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { SCENE_NOW } from '@ratrace/core/testing/scenes';
import { compareShots, SCREEN, wrongPage } from './kitCompare';
import type { TextBox } from './kitCompare';
import { againstOf, APP_WEB, chooseScenes, differing, filesOf, isJudged, jsonOf, lineOf, mergeLines, movingAfter, PHONE, sceneAppRoute, sceneAppWebUrl, sceneWebUrl, SCENES_FOLDER, sideOf, unjudgedLine, webRules } from './sceneShots';
import type { Line } from './sceneShots';
import { changedWithin, fromWeb, LOOP_BOXES, NEXT_FRAME, openPage, QUIET_FOCUS, PORT, raw, READY_MS, READY_PORT, readyServer, root, routeTold, shootApp, STILL_MS, stillShot, TEXT_BOXES, withAppWebPage, withWebPage } from './shotDrivers';

/** What is used of sharp here: a picture's raw pixels. */
type SharpRaw = (input: Buffer) => { ensureAlpha(): { raw(): { toBuffer(): Promise<Buffer> } } };

/**
 * The scenes beside the web's, shot for shot: each named game state (packages/core/src/testing/scenes.ts), drawn by the
 * web on its scene page and by the app on its scene route, at the iPhone 16 Pro's size (the drivers are `shotDrivers.ts`,
 * the kit's too), then compared pixel by pixel as the kit is. Into docs/superpowers/reports/phase-2-parity/:
 * `<name>-web.png`, `<name>-app.png` and, for a scene that is compared, `<name>-diff.png`, and a line to each scene in
 * `phase-2-parity.json`: its verdict, and its numbers.
 *
 *   pnpm --filter @ratrace/web exec tsx ../mobile/scripts/scene-shots.ts [web] [app] [compare] [--only=name,name]
 *   pnpm --filter @ratrace/web exec tsx ../mobile/scripts/scene-shots.ts [web] appweb compare --against=appweb [--only=name,name]
 *
 * With no step named, the first three. The second line is phase 5a's: the app's own web (`appweb`, served by `npx expo start --web --port 8091`
 * in apps/mobile, started apart and in development, its `/scene` route being `__DEV__` only) shot in the same Chrome as the web's, shaped like the
 * same phone, each scene once it says it is ready, a frame after, and once it is still; then compared with the web's shots, and judged by its own
 * records (`APP_WEB` in sceneShots.ts), into its own folder (docs/superpowers/reports/phase-5a-web-parity/: `<name>-appweb.png`,
 * `<name>-appweb-diff.png`, `phase-5a-web-parity.json`), so the phone's are never written over. The web is served by its own `next dev` on port 3021, started and stopped here (a server
 * already answering there is refused), and its browser is kept from every host but this machine. The app is opened in Expo Go
 * from the Metro running on 8090 (`npx expo start --port 8090` in apps/mobile).
 *
 * Every scene is drawn on the same day (`SCENE_NOW`): the browser's clock is held at it, the app's services answer it. The web's pages are
 * given `webRules` (sceneShots.ts): what it draws that the phone does not is hidden (`WEB_ONLY`: on the challenge page, the line that tells a
 * guest to sign in). (A short page is as tall as the screen shows by the web's own `min-h-safe`.)
 * A scene of a screen ported and not shot yet (`PENDING_SHOTS`: the batch passes shoot those) is shot but not compared: its line is `unjudged`. A scene with lines
 * in the phone's own words (`PHONE_WORDS`, each named) is compared without them: they are reported and not judged, and its verdict says `phone words, ...`. A
 * compared scene whose app shot is more than half unlike the web's is the wrong page (a stand-in, a reload, a red box):
 * the run stops and exits 1, as the kit's does. A scene that differs and whose residual is explained in the parity report is `accepted` (`ACCEPTED` in
 * sceneShots.ts: the most shape pixels, lines in one shot only, and the lines named that may stand further apart than the point every other line is held to), and fails on any growth; the page of other words (`PAGE_BASELINE`)
 * on its drift from where it stood. When every scene is clean, accepted, in the phone's words within its bound or unjudged the run exits 0; a scene that
 * differs beyond that is listed and exits 1, as does a compared scene whose app shot never stood still (`stillShot`; its line says `moving`).
 */
const out = join(root, 'docs/superpowers/reports', SCENES_FOLDER);
const appWebOut = join(root, 'docs/superpowers/reports', APP_WEB.folder);

async function main() {
  const args = process.argv.slice(2);
  const only = args.find((a) => a.startsWith('--only='))?.slice('--only='.length).split(',');
  const scenes = chooseScenes(only);
  const steps = args.filter((a) => !a.startsWith('--'));
  const all = steps.length === 0;
  // Asked before anything is shot: a word that is neither stops the run at once.
  const side = sideOf(againstOf(args));
  mkdirSync(raw, { recursive: true });
  mkdirSync(out, { recursive: true });
  mkdirSync(appWebOut, { recursive: true });

  if (all || steps.includes('web')) {
    await withWebPage(sceneWebUrl(scenes[0], PORT), async (page) => {
      for (const scene of scenes) {
        // The day, before the page is loaded: the week's challenge and the days left of it are read from the browser's clock.
        await page.clock.setFixedTime(SCENE_NOW);
        // The page marks itself once the scene's store is built, its steps are taken and the game is drawn on it.
        await openPage(page, sceneWebUrl(scene, PORT), () => document.querySelector('[data-scene]') !== null, webRules(scene));
        const day = await page.evaluate(() => Date.now());
        if (day !== SCENE_NOW) throw new Error(`${scene.name}: the browser's clock is ${new Date(day).toISOString()}, not ${new Date(SCENE_NOW).toISOString()}`);
        await page.screenshot({ path: join(out, filesOf(scene.name).web) });
        // Where each line of text stands, so the comparison can tell a glyph's edge from a box's.
        writeFileSync(join(raw, `${scene.name}-text.json`), JSON.stringify(await page.evaluate(TEXT_BOXES)));
        console.log(`web ${scene.name}`);
      }
    });
  }

  // Which scenes' app shots never stood still, as the last app step (or app's web step) left them: the comparison fails those.
  const movingKept = (file: string) => (existsSync(join(raw, file)) ? (JSON.parse(readFileSync(join(raw, file), 'utf8')) as string[]) : []);

  // Expo Go is closed and opened once first: left running, it would show the bundle of the Metro it saw last.
  if (all || steps.includes('app')) {
    // Each scene says when it is ready to be shot (drawn, every picture of it read): the shot waits for that word.
    const moving = await shootApp(scenes.map((scene) => ({ route: sceneAppRoute(scene), png: join(out, filesOf(scene.name).app), name: scene.name })), { fresh: true });
    const names = scenes.filter((scene) => moving.includes(sceneAppRoute(scene))).map((scene) => scene.name);
    writeFileSync(join(raw, PHONE.moving), JSON.stringify(movingAfter(movingKept(PHONE.moving), scenes.map((scene) => scene.name), names)));
  }

  // The app's own web, from the server already serving it: in the same Chrome as the web's, shaped like the same phone.
  if (steps.includes('appweb')) {
    const told = await readyServer(READY_PORT);
    const moving: string[] = [];
    try {
      await withAppWebPage(async (page) => {
        for (const scene of scenes) {
          const png = join(appWebOut, filesOf(scene.name).appweb);
          // The day, before the page is loaded, as the web's.
          await page.clock.setFixedTime(SCENE_NOW);
          await page.goto(routeTold(sceneAppWebUrl(scene), told.port), { waitUntil: 'load' });
          if (!(await told.wait(scene.name, READY_MS))) {
            console.log(`appweb ${scene.name} (never said it was ready in ${READY_MS / 1000} s)`);
            moving.push(scene.name);
            await page.screenshot({ path: png });
            continue;
          }
          // As the web's shot is given (openPage): no focus ring on a sheet opened with no tap.
          await page.addStyleTag({ content: QUIET_FOCUS });
          // Ready once every picture is read; the last of them may be painted a frame later.
          await page.evaluate(NEXT_FRAME);
          await page.evaluate(() => document.fonts.ready);
          const { still } = await stillShot(
            async () => {
              await page.screenshot({ path: png });
              return readFileSync(png);
            },
            { ready: () => told.ready(scene.name) },
          );
          // A screen that never stood still may be still but for its loops (a workplace's screens turning): two shots apart, nothing but them changed.
          let looping = false;
          if (!still) {
            const boxes = await page.evaluate(LOOP_BOXES);
            const first = readFileSync(png);
            await sleep(STILL_MS);
            await page.screenshot({ path: png });
            const pixels = async (shot: Buffer) => new Uint8Array(await (fromWeb('sharp') as SharpRaw)(shot).ensureAlpha().raw().toBuffer());
            looping = boxes.length > 0 && changedWithin(await pixels(first), await pixels(readFileSync(png)), SCREEN.width * SCREEN.scale, boxes, SCREEN.scale);
          }
          console.log(`appweb ${scene.name}${still ? '' : looping ? ' (still but for its loops turning: one moment of them is kept)' : ' (still moving: the last shot is kept)'}`);
          if (!still && !looping) moving.push(scene.name);
        }
      });
    } finally {
      await told.close();
    }
    writeFileSync(join(raw, APP_WEB.moving), JSON.stringify(movingAfter(movingKept(APP_WEB.moving), scenes.map((scene) => scene.name), moving)));
  }

  if (all || steps.includes('compare')) {
    const sharp: unknown = fromWeb('sharp');
    const movingNow = movingKept(side.moving);
    // The other shot, its picture of what is unlike and its results: the phone's, or the app's web's (`--against=appweb`).
    const appWeb = side === APP_WEB;
    const sideOut = appWeb ? appWebOut : out;
    const lines: Line[] = [];
    for (const scene of scenes) {
      const files = filesOf(scene.name);
      const [a, b, text] = [join(out, files.web), join(sideOut, appWeb ? files.appweb : files.app), join(raw, `${scene.name}-text.json`)];
      if (!existsSync(a) || !existsSync(b)) throw new Error(`missing shots for ${scene.name}`);
      if (!isJudged(scene)) {
        // Not shot yet by a batch pass (`PENDING_SHOTS`): nothing to compare, and nothing that could be read as a result.
        lines.push(unjudgedLine(scene));
        continue;
      }
      if (!existsSync(text)) throw new Error(`missing shots for ${scene.name}`);
      const result = await compareShots(sharp, scene.name, readFileSync(a), readFileSync(b), JSON.parse(readFileSync(text, 'utf8')) as TextBox[], sideOut, appWeb ? files.appwebDiff : files.diff);
      // Half the screen unlike is not a difference to list: the app showed something else.
      const wrong = wrongPage(result, 'scene', b);
      if (wrong !== null) throw new Error(wrong);
      lines.push(lineOf(scene, result, movingNow.includes(scene.name), side));
    }
    // A run of some scenes keeps the lines of the others.
    const file = join(sideOut, side.file);
    const kept = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Line[]) : [];
    writeFileSync(file, jsonOf(mergeLines(kept, lines)));
    for (const line of lines) {
      if (line.verdict === 'unjudged') console.log(`${line.scene.padEnd(18)} unjudged: ${line.why}`);
      else {
        console.log(`${line.scene.padEnd(18)} ${line.verdict.padEnd(28)} raw ${line.rawPercent} %  beyond ${line.beyondPercent} %  a point away ${line.loose} px, not text ${line.shape} px  text lines ${line.textLines} (unmeasured ${line.unmeasured}, in one shot only ${line.oneSided}), worst ${line.worstPt} pt${line.phoneLines ? `, phone words ${line.phoneLines}` : ''}${line.moving ? '  NEVER STILL in the app' : ''}`);
        for (const far of line.far ?? []) console.log(`${''.padEnd(20)}${far.pt} pt  ${JSON.stringify(far.text)}`);
      }
    }
    const restless = lines.filter((line) => line.verdict !== 'unjudged' && line.moving === true);
    if (restless.length > 0) console.error(`never still in the app (one moment of something moving was compared): ${restless.map((line) => line.scene).join(', ')}`);
    const differ = differing(lines);
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
