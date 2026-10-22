import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compareShots, judgedOf, reportFolder, SECTIONS, unjudgedSection, verdictOf, wrongPage, type Section, type TextBox } from './kitCompare';
import { fromWeb, openPage, PORT, raw, root, shootApp, TEXT_BOXES, withWebPage } from './shotDrivers';

/**
 * The kit beside the web's, shot for shot: every section of the kit page, on the web (Playwright, at the iPhone 16 Pro's
 * 402 × 874 pt at 3×, with its safe areas: 62 on top, 34 below) and in the app (Expo Go on the booted simulator), then
 * compared pixel by pixel into docs/superpowers/reports/phase-1-parity/, phase-2-parity/ or phase-3-parity/, by the phase that added the section.
 *
 *   pnpm --filter @ratrace/web exec tsx ../mobile/scripts/kit-shots.ts [web] [app] [compare] [--only=section,section]
 *
 * The web is served by its own `next dev` on port 3021, started and stopped here. The app is opened in Expo Go from the
 * Metro already running on 8090 (`npx expo start --port 8090` in apps/mobile). Playwright and sharp come from apps/web.
 * The two drivers are `shotDrivers.ts`, which `scene-shots.ts` shoots the scenes with.
 */

/** Where a section's picture and numbers go: the report of the phase that added it (phase 1's sections beside phase 1's, phase 2's beside phase 2's). */
const outOf = (section: Section) => join(root, 'docs/superpowers/reports', reportFolder(section));

/** The web page that shows a section: the Russian and Spanish texts in their own language, as a player would see them. */
const webUrl = (section: Section) => `http://localhost:${PORT}/${section === 'text-ru' ? 'ru' : section === 'text-es' ? 'es' : 'en'}/kit?section=${section}`;

async function shootWeb(sections: readonly Section[]): Promise<void> {
  await withWebPage(webUrl('buttons'), async (page) => {
    for (const section of sections) {
      await openPage(page, webUrl(section));
      await page.screenshot({ path: join(raw, `${section}-web.png`) });
      // Where each line of text stands, so the comparison can tell a glyph's edge from a box's.
      const boxes = await page.evaluate(TEXT_BOXES);
      writeFileSync(join(raw, `${section}-text.json`), JSON.stringify(boxes));
      console.log(`web ${section}`);
    }
  });
}

const shootAppSections = (sections: readonly Section[]) => shootApp(sections.map((section) => ({ route: `kit?section=${section}`, png: join(raw, `${section}-app.png`) })));

async function main() {
  const args = process.argv.slice(2);
  const only = args.find((a) => a.startsWith('--only='))?.slice('--only='.length).split(',') as Section[] | undefined;
  const sections = only ?? SECTIONS;
  const steps = args.filter((a) => !a.startsWith('--'));
  const all = steps.length === 0;
  mkdirSync(raw, { recursive: true });
  for (const section of sections) mkdirSync(outOf(section), { recursive: true });
  if (all || steps.includes('web')) await shootWeb(sections);
  if (all || steps.includes('app')) await shootAppSections(sections);
  if (all || steps.includes('compare')) {
    const sharp: unknown = fromWeb('sharp');
    const results: Array<Awaited<ReturnType<typeof compareShots>>> = [];
    // A section waiting for its batch pass (`PENDING_SECTIONS`) is shot and not compared, unless `--only` names it.
    const { judged, unjudged } = judgedOf(sections, only);
    for (const section of judged) {
      const a = join(raw, `${section}-web.png`);
      const b = join(raw, `${section}-app.png`);
      if (!existsSync(a) || !existsSync(b)) throw new Error(`missing shots for ${section}`);
      const boxes = JSON.parse(readFileSync(join(raw, `${section}-text.json`), 'utf8')) as TextBox[];
      const result = await compareShots(sharp, section, readFileSync(a), readFileSync(b), boxes, outOf(section));
      // Half the screen unlike is not a difference to list: the app showed something else (a red box, a reload). The scenes' shots stop at the same place (kitCompare.ts).
      const wrong = wrongPage(result, 'kit', b);
      if (wrong !== null) throw new Error(wrong);
      results.push(result);
    }
    // A run of some sections keeps the numbers of the others in the same report: each file always has every section that has been shot.
    for (const folder of new Set(results.map((r) => reportFolder(r.section as Section)))) {
      const file = join(root, 'docs/superpowers/reports', folder, 'numbers.json');
      const now = results.filter((r) => reportFolder(r.section as Section) === folder);
      const kept = (existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as typeof results) : []).filter((r) => !now.some((n) => n.section === r.section));
      const merged = [...kept, ...now].sort((x, y) => SECTIONS.indexOf(x.section as Section) - SECTIONS.indexOf(y.section as Section));
      writeFileSync(file, `${JSON.stringify(merged, null, 2)}\n`);
    }
    for (const section of unjudged) console.log(unjudgedSection(section));
    for (const r of results) {
      const worst = r.texts.reduce((m, t) => (t.unmeasured ? m : Math.max(m, t.apart)), 0);
      const unmeasured = r.texts.filter((t) => t.unmeasured).length;
      console.log(`${r.section.padEnd(11)} ${verdictOf(r).padEnd(7)} raw ${r.rawPercent.toFixed(2)} %  beyond ${r.beyondPercent.toFixed(3)} % (no dots rule ${r.beyondPlain} px)  a point away ${r.loose} px (no dots rule ${r.loosePlain}), not text ${r.shape} px  text lines ${r.texts.length} (unmeasured ${unmeasured}), worst ${worst.toFixed(2)} pt`);
    }
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
