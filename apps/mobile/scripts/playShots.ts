import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALES } from '@ratrace/i18n/locales';
import { SCENES } from '@ratrace/core/testing/scenes';
import type { ShotScreen } from './kitCompare';
import { sceneAppWebUrl } from './sceneShots';
import { APP_WEB_STILL_SHOTS, NEXT_FRAME, openPage, READY_MS, READY_PORT, readyServer, routeTold, stillShot, withAppWebPage } from './shotDrivers';

/**
 * The phone's pictures for the Google Play listing (docs/play/listing.md), in each of the game's languages: the scenes below, drawn by the app's own
 * web on its scene route in the language asked (`&locale=`), at Play's 9:16 (360 by 640 at density 3: 1080 by 1920), each once it says it is ready
 * and is still. Into docs/play/graphics/<language>/phone-<n>-<scene>.png.
 *
 *   cd apps/mobile && EXPO_NO_METRO_LAZY=1 npx expo start --web --port 8091      (apart, in development: /scene is __DEV__ only)
 *   pnpm --filter @ratrace/web exec tsx ../mobile/scripts/playShots.ts [--only=en] [--scenes=a,b]   (other scenes, to try them: numbered as given)
 */
const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '../../../docs/play/graphics');
const PLAY_PHONE: ShotScreen = { width: 360, height: 640, scale: 3, top: 0, bottom: 0 };

/** What the listing shows, in its order: a life's choice, its cards, its money, its news, the rankings, a game with others won, the collection, the way out. */
const SHOWN = ['new-unlocked', 'play-cards-legendary', 'finance-market', 'play-news-r6', 'rankings-week', 'room-end', 'collection-badges', 'moment-escape'];

async function main(): Promise<void> {
  const only = process.argv.find((arg) => arg.startsWith('--only='))?.slice('--only='.length).split(',');
  const locales = LOCALES.filter((locale) => !only || only.includes(locale));
  const named = process.argv.find((arg) => arg.startsWith('--scenes='))?.slice('--scenes='.length).split(',');
  const scenes = (named ?? SHOWN).map((name) => {
    const scene = SCENES.find((candidate) => candidate.name === name);
    if (!scene) throw new Error(`no scene ${name}`);
    return scene;
  });
  const failed: string[] = [];
  await withAppWebPage(async (page) => {
    for (const locale of locales) {
      // A server of its own for each language: a scene says it is ready once a run (numbered from its page's start), and each is shot once in each.
      const ready = await readyServer(READY_PORT);
      try {
        mkdirSync(join(OUT, locale), { recursive: true });
        for (const [index, scene] of scenes.entries()) {
          const name = `${scene.name}:${locale}`;
          await openPage(page, `${routeTold(sceneAppWebUrl(scene), ready.port)}&locale=${locale}`);
          if (!(await ready.wait(scene.name, READY_MS))) failed.push(`${name} never said it was ready`);
          // As the parity shots wait (scene-shots.ts): the last picture may be painted a frame after the scene says it is ready.
          await page.evaluate(NEXT_FRAME);
          await page.evaluate(() => document.fonts.ready);
          const file = join(OUT, locale, `phone-${index + 1}-${scene.name}.png`);
          const { still } = await stillShot(
            async () => {
              await page.screenshot({ path: file });
              return readFileSync(file);
            },
            { ready: () => ready.ready(scene.name), shots: APP_WEB_STILL_SHOTS },
          );
          if (!still) failed.push(`${name} never stood still`);
          console.log(`${still ? 'shot' : 'MOVING'} ${file}`);
        }
      } finally {
        await ready.close();
      }
    }
  }, PLAY_PHONE);
  if (failed.length > 0) {
    console.error(failed.join('\n'));
    process.exitCode = 1;
  }
}

void main();
