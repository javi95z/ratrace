import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CONTENT_VERSION } from '@ratrace/content';
import { catalog, CATALOG_FILES, localeOf } from './catalog';
import type { CatalogLocale } from './catalogWords';
import { WORDS } from './catalogWords';

/**
 * The catalogue as a PDF to share, with its pictures: the markdown `pnpm catalog` writes, laid out as a
 * page and printed by a headless Chromium (the web's Playwright). A4, the sprites drawn at whole sizes
 * and never smoothed, a font that has Cyrillic (Exo 2 and Oswald, the game's own).
 *
 *   pnpm catalog:pdf --locale=ru --out=/some/where/catalogue.pdf
 *
 * The PDF is not kept in the repo.
 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const FONTS = path.join(ROOT, 'apps/mobile/node_modules/@expo-google-fonts');

const escapeHtml = (text: string): string => text.replace(/&(?![a-z]+;|#\d+;)/g, '&amp;');
/** An anchor as the markdown's contents link to it. */
const slug = (heading: string): string => heading.toLowerCase().replace(/[^\p{L}\p{N} -]/gu, '').replace(/ /g, '-');

/** The few marks the catalogue uses inside a line: bold, code, links to its own headings, escaped bars. */
function inline(text: string, docs: string): string {
  return escapeHtml(text)
    .replace(/src="([^"]+)"/g, (_, src: string) => `src="${pathToFileURL(path.resolve(docs, src)).href}"`)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((#[^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\\\|/g, '|');
}

/** A table's row split into its cells, minding the bars a cell escapes. */
const cells = (row: string): string[] => row.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((cell) => cell.trim());

/** The catalogue's markdown as HTML: headings, paragraphs and tables, which is all it writes. */
export function catalogHtml(markdown: string, docs: string): string {
  // Short anchors: a heading's own words, percent-encoded, run past what a PDF's names may hold.
  const ids = new Map<string, string>();
  const idOf = (words: string) => {
    if (!ids.has(slug(words))) ids.set(slug(words), `s${ids.size + 1}`);
    return ids.get(slug(words)) as string;
  };
  const html = markdown
    .trim()
    .split(/\n{2,}/)
    .map((block) => {
      const heading = /^(#{1,3}) (.*)$/.exec(block);
      if (heading) {
        const level = heading[1].length;
        return `<h${level} id="${idOf(heading[2].replace(/<img [^>]*>/g, '').trim())}">${inline(heading[2], docs)}</h${level}>`;
      }
      if (block.startsWith('|')) {
        const [head, , ...rows] = block.split('\n').map(cells);
        // A table led by a wide picture (a card, a rule, a way of life) lays each row out as the picture and its words beside it,
        // each figure after the name with its column's label, since such a table shows no head.
        if (rows.some((row) => /\/cards\//.test(row[0]))) {
          const row = (cells: string[]) =>
            cells.map((cell, i) => (i < 2 || !cell || /^1\. /.test(cell) ? `<td>${inline(cell, docs)}</td>` : `<td><span class="label">${inline(head[i], docs)}:</span> ${inline(cell, docs)}</td>`)).join('');
          return `<table class="wide"><tbody>${rows.map((cells) => `<tr>${row(cells)}</tr>`).join('\n')}</tbody></table>`;
        }
        const thead = head.some(Boolean) ? `<thead><tr>${head.map((cell) => `<th>${inline(cell, docs)}</th>`).join('')}</tr></thead>` : '';
        const body = rows.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell, docs)}</td>`).join('')}</tr>`).join('\n');
        return `<table class="${head.some(Boolean) ? 'grid' : 'facts'}">${thead}<tbody>${body}</tbody></table>`;
      }
      const pictures = /^(<img [^>]*>\s*)+$/.test(block);
      return `<p${pictures ? ' class="pictures"' : ''}>${inline(block, docs)}</p>`;
    })
    .join('\n')
    .replace(/href="#([^"]+)"/g, (_, target: string) => `href="#${idOf(decodeURIComponent(target))}"`);
  // A life or a city (a heading, its pictures and a table of facts) is kept on one page.
  return html.replace(/(<h3 [\s\S]*?)(?=<h[123] |$)/g, (entry: string) => (entry.includes('class="facts"') ? `<section class="keep">${entry}</section>` : entry));
}

const fontFace = (family: string, file: string, weight: number) =>
  `@font-face { font-family: '${family}'; src: url('${pathToFileURL(path.join(FONTS, file)).href}') format('truetype'); font-weight: ${weight}; }`;

/** The whole page: a title page, then the catalogue. */
export function catalogPage(locale: CatalogLocale): string {
  const docs = path.dirname(path.join(ROOT, CATALOG_FILES[locale]));
  const markdown = catalog(locale);
  // The title, what the catalogue is and its contents go on the title page; the sections follow.
  const W = WORDS[locale];
  const intro = W.intro(CONTENT_VERSION);
  const [, ...rest] = markdown.split('\n\n');
  const contents = rest[intro.length];
  const sections = rest.slice(intro.length + 1).join('\n\n');
  // The first sentence of the first line, without how the file is made, and the line on prices.
  const notes = [`${intro[0].split('. ')[0]}.`, ...intro.slice(1)];
  const mascot = pathToFileURL(path.join(ROOT, 'art/clean/brand/brand.mascot.png')).href;
  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<title>The Rat Race — ${W.title}</title>
<style>
${fontFace('Exo 2', 'exo-2/400Regular/Exo2_400Regular.ttf', 400)}
${fontFace('Exo 2', 'exo-2/600SemiBold/Exo2_600SemiBold.ttf', 600)}
${fontFace('Oswald', 'oswald/500Medium/Oswald_500Medium.ttf', 500)}
:root { --ink: #1d1b26; --soft: #5b5870; --line: #d9d5e6; --band: #f3f1f9; --accent: #6b3fd6; }
@page { size: A4; margin: 16mm 14mm 18mm; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font: 400 10.5pt/1.45 'Exo 2', sans-serif; color: var(--ink); background: #fff; }
img { image-rendering: pixelated; vertical-align: middle; }
h1, h2, h3 { font-family: 'Oswald', sans-serif; font-weight: 500; line-height: 1.2; break-after: avoid; page-break-after: avoid; }
h1 { font-size: 26pt; margin: 0 0 6mm; }
h2 { font-size: 19pt; margin: 0 0 4mm; padding-bottom: 2mm; border-bottom: 2px solid var(--accent); break-before: page; page-break-before: always; }
h3 { font-size: 13.5pt; margin: 6mm 0 2.5mm; }
h3 img { width: 32px; height: 32px; margin-right: 6px; }
p { margin: 0 0 3mm; orphans: 3; widows: 3; }
p.pictures { break-inside: avoid; display: flex; flex-wrap: wrap; gap: 6px; }
code { font-family: ui-monospace, Menlo, monospace; font-size: 9pt; background: var(--band); padding: 0 3px; border-radius: 3px; }
a { color: var(--accent); text-decoration: none; }
table { width: 100%; border-collapse: collapse; margin: 0 0 4mm; font-size: 9.5pt; }
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
th { text-align: left; font-weight: 600; color: var(--soft); border-bottom: 1.5px solid var(--ink); padding: 3px 5px; }
td { border-bottom: 1px solid var(--line); padding: 4px 5px; vertical-align: middle; }
table.facts { break-inside: avoid; }
table.facts td:first-child { width: 34%; color: var(--soft); }
/* Each row of a wide table: the picture at its own size, and its words beside it. */
table.wide thead { display: none; }
table.wide tr { display: grid; grid-template-columns: 288px 1fr; column-gap: 10px; border-bottom: 1px solid var(--line); padding: 5px 0; }
table.wide td { border: 0; padding: 0; }
table.wide td:first-child { grid-row: span 3; }
table.wide td:nth-child(n+2) { grid-column: 2; }
table.wide td:nth-child(2):not(:has(strong)) { font-weight: 600; }
table.wide .label { color: var(--soft); }
section.keep { break-inside: avoid; page-break-inside: avoid; }
table.wide td:nth-child(n+3) { margin-top: 2px; }
td img[src*="/portraits/"], p img[src*="/portraits/"] { width: 128px; }
td img[src*="/homes/"] { width: 96px; }
td img[src*="/icons/"] { width: 32px; }
/* Title page */
.cover { height: 255mm; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; break-after: page; page-break-after: always; }
.cover img { width: 256px; margin-bottom: 10mm; }
.cover .game { font: 500 40pt/1.1 'Oswald', sans-serif; margin: 0; }
.cover .what { font: 500 22pt/1.2 'Oswald', sans-serif; color: var(--accent); margin: 3mm 0 2mm; }
.cover .version { color: var(--soft); margin: 0 0 10mm; }
.cover .note { max-width: 130mm; color: var(--soft); }
.cover .contents { margin-top: 8mm; width: 110mm; text-align: left; }
.cover .contents table { font-size: 10pt; }
</style>
</head>
<body>
<section class="cover">
  <img src="${mascot}" alt="">
  <p class="game">The Rat Race</p>
  <p class="what">${W.title}</p>
  <p class="version">${W.version(CONTENT_VERSION)}</p>
  ${notes.map((line) => `<p class="note">${inline(line, docs)}</p>`).join('\n')}
  <div class="contents">${catalogHtml(contents, docs)}</div>
</section>
${catalogHtml(sections, docs)}
</body>
</html>
`;
}

interface Page {
  goto(url: string, options?: { waitUntil?: 'load' | 'networkidle' }): Promise<unknown>;
  evaluate<T>(expression: string): Promise<T>;
  pdf(options: Record<string, unknown>): Promise<Buffer>;
}
interface Browser {
  newPage(): Promise<Page>;
  close(): Promise<void>;
}

async function main() {
  const args = process.argv.slice(2);
  const locale = localeOf(args.some((arg) => arg.startsWith('--locale=')) ? args : ['--locale=ru']);
  const out = path.resolve(args.find((arg) => arg.startsWith('--out='))?.slice('--out='.length) ?? path.join(os.tmpdir(), `the-rat-race-catalog-${locale}.pdf`));
  const W = WORDS[locale];

  const scratch = mkdtempSync(path.join(os.tmpdir(), 'ratrace-catalog-'));
  const html = path.join(scratch, 'catalog.html');
  writeFileSync(html, catalogPage(locale));

  // Playwright is the web's, driving this machine's Chrome as the app's shots do (scripts/shotDrivers.ts): nothing to download.
  const fromWeb = createRequire(path.join(ROOT, 'apps/web/package.json'));
  const { chromium } = fromWeb('@playwright/test') as { chromium: { launch(options: { channel: string }): Promise<Browser> } };
  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(html).href, { waitUntil: 'load' });
    // Every typeface in and every picture found before printing (written as the page's own script: this package has no DOM types).
    const broken = await page.evaluate<string[]>(
      'document.fonts.ready.then(() => [...document.images].filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.src))',
    );
    if (broken.length > 0) throw new Error(`catalog:pdf: pictures not found: ${broken.slice(0, 5).join(', ')}`);
    const footer = `<div style="width:100%;font:8px Helvetica,Arial,sans-serif;color:#5b5870;padding:0 14mm;display:flex;justify-content:space-between"><span>The Rat Race · ${W.title} · ${W.version(CONTENT_VERSION)}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`;
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: footer,
      outline: true,
      tagged: true,
    });
    writeFileSync(out, pdf);
  } finally {
    await browser.close();
    rmSync(scratch, { recursive: true, force: true });
  }
  console.log(`catalog:pdf: ${out}, ${(statSync(out).size / 1024 / 1024).toFixed(1)} MB`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
