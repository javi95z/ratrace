import { content, lives } from '@ratrace/content';
import { bots } from './bots';
import { compare, seedsFor } from './simulate';

/**
 * Prints how each bot does. Usage: pnpm balance [seeds per life] [life ids, comma separated]
 * The default is 300 seeds for each of the three starting lives.
 *
 * Columns: escaped the rat race; median age at escape; went bankrupt at least once; ended with less
 * than half the saver's net worth; ended richest of all; had the top score; then medians.
 */
const count = Number(process.argv[2] ?? 300);
const wanted = (process.argv[3] ?? 'nurse,engineer,civil_servant').split(',');
const chosen = lives.filter((life) => wanted.includes(life.id));

const money = (cents: number) => `$${Math.round(cents / 100).toLocaleString('en-US')}`;
const pad = (text: string | number, width: number) => String(text).padStart(width);

for (const group of [chosen, ...chosen.map((life) => [life])]) {
  const started = Date.now();
  const { summaries } = compare(content, group, seedsFor(count), bots);
  console.log(`\n${group.map((life) => life.id).join(' + ')}: ${count} seeds each, ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log(
    `${'bot'.padEnd(10)}${pad('escaped', 9)}${pad('age', 5)}${pad('bankrupt', 10)}${pad('ruined', 8)}${pad('richest', 9)}${pad('top', 7)}` +
      `${pad('score', 7)}${pad('status', 8)}${pad('net worth', 14)}`,
  );
  for (const s of summaries) {
    console.log(
      `${s.bot.padEnd(10)}${pad(`${s.escapedPct}%`, 9)}${pad(s.medianEscapeAge ?? '-', 5)}${pad(`${s.bankruptPct}%`, 10)}${pad(`${s.ruinedPct}%`, 8)}` +
        `${pad(`${s.richestPct}%`, 9)}${pad(`${s.topScorePct}%`, 7)}${pad(s.medianScore, 7)}${pad(s.medianStatus, 8)}${pad(money(s.medianNetWorth), 14)}`,
    );
  }
  if (group.length === 1 && chosen.length === 1) break;
}
