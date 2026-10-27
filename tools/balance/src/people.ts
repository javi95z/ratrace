import { bots, cardPeople, content, endingOf, lives, metFlag, PEOPLE, personEndings } from '@ratrace/content';
import type { Bot, PersonId } from '@ratrace/content';
import { applyCard, applyRound, createGame, viewOf } from '@ratrace/engine';
import type { Content, StartConfig } from '@ratrace/engine';
import { fileURLToPath } from 'node:url';
import { seedsFor } from './simulate';

/**
 * How often lives meet the people who come back (`@ratrace/content`'s `people.ts`), and how far their stories go: for each person,
 * the share of lives that meet them; how many a life meets; and for each later card of a story, how often it is dealt in the lives
 * where what it waits for (the flags it needs, and the one it counts from) was held two rounds running, early enough to come.
 */
export interface PeopleReport {
  lives: number;
  /** Share of lives that met each person, in percent. */
  met: Record<PersonId, number>;
  /** People met in a life: the mean, and the share of lives that met none, one, two, three, four or more. */
  perLife: { mean: number; spread: number[] };
  /** Each later card of a story: the lives that could have reached it, and the share of those that did, in percent. */
  followUps: Record<string, { could: number; reachedPct: number }>;
  /** How many lives ended each person's story each way (`<who>.<ending>`), every ending of `personEndings` listed, nought where none did. */
  endings: Record<string, number>;
}

/** The flags a later card waits on: those it needs (but that the person was met) and the one it counts its rounds from. None for a story's first card. */
function awaited(cardId: string): string[] {
  const when = content.cards.find((card) => card.id === cardId)?.when ?? {};
  const needs = (when.flags ?? []).filter((flag) => !flag.endsWith('_met'));
  return [...new Set([...needs, ...(when.notRecentFlag ? [when.notRecentFlag.flag] : [])])];
}

export function peopleReport(rules: Content, starting: ReadonlyArray<{ id: string; start: StartConfig }>, seeds: readonly string[], playing: readonly Bot[]): PeopleReport {
  const met = Object.fromEntries(PEOPLE.map((who) => [who, 0])) as Record<PersonId, number>;
  const counts: number[] = [];
  const later = Object.keys(cardPeople).filter((id) => awaited(id).length > 0);
  const followUps: Record<string, { could: number; reached: number }> = Object.fromEntries(later.map((id) => [id, { could: 0, reached: 0 }]));
  const endings: Record<string, number> = Object.fromEntries(PEOPLE.flatMap((who) => personEndings[who].map((ending) => [`${who}.${ending.id}`, 0])));
  for (const life of starting)
    for (const seed of seeds)
      for (const bot of playing) {
        let state = createGame({ content: rules, start: life.start }, seed);
        // The round each flag was first set in, and every card dealt.
        const first: Record<string, number> = {};
        // The flags held at the end of each round's cards: a flag may be let go of (a move lets a city's go).
        const held: Array<Set<string>> = [];
        const dealt = new Set<string>();
        while (!state.finished) {
          for (const id of state.phase === 'cards' ? state.hand : []) dealt.add(id);
          while (state.phase === 'cards') state = applyCard(rules, state, bot.pick(rules, viewOf(state))).state;
          for (const flag of Object.keys(state.player.life.flags)) first[flag] ??= state.round;
          held[state.round] = new Set(Object.keys(state.player.life.flags));
          state = applyRound(rules, state, { orders: bot.orders(rules, viewOf(state)) }).state;
        }
        const people = PEOPLE.filter((who) => Object.hasOwn(first, metFlag(who)));
        for (const who of people) {
          met[who] += 1;
          endings[`${who}.${endingOf(who, state.player.life.flags).id}`] += 1;
        }
        counts.push(people.length);
        for (const id of later) {
          const flags = awaited(id);
          // It could come where what it waits for was held two rounds running, early enough in the life.
          const due = held.some((now, round) => round <= rules.rounds - 3 && flags.every((flag) => now.has(flag) && (held[round + 1]?.has(flag) ?? false)));
          if (!due) continue;
          followUps[id].could += 1;
          if (dealt.has(id)) followUps[id].reached += 1;
        }
      }
  const n = counts.length;
  const pct = (x: number, of: number) => (of === 0 ? 0 : Math.round((1000 * x) / of) / 10);
  const spread = [0, 1, 2, 3, 4].map((k) => pct(counts.filter((c) => (k === 4 ? c >= 4 : c === k)).length, n));
  return {
    lives: n,
    met: Object.fromEntries(PEOPLE.map((who) => [who, pct(met[who], n)])) as Record<PersonId, number>,
    perLife: { mean: Math.round((100 * counts.reduce((a, b) => a + b, 0)) / n) / 100, spread },
    followUps: Object.fromEntries(Object.entries(followUps).map(([id, f]) => [id, { could: f.could, reachedPct: pct(f.reached, f.could) }])),
    endings,
  };
}

/** Prints the report. Usage: tsx src/people.ts [seeds per life] */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const count = Number(process.argv[2] ?? 30);
  const starting = lives.filter((life) => ['nurse', 'engineer', 'civil_servant'].includes(life.id));
  const report = peopleReport(content, starting, seedsFor(count), bots);
  console.log(`${report.lives} lives (${count} seeds, three lives, every bot)`);
  console.log(`people met per life: mean ${report.perLife.mean}; none/1/2/3/4+: ${report.perLife.spread.join('% / ')}%`);
  for (const who of PEOPLE) console.log(`  ${who.padEnd(9)} met in ${report.met[who]}%`);
  for (const [id, f] of Object.entries(report.followUps)) console.log(`  ${id.padEnd(20)} reached in ${String(f.reachedPct).padStart(5)}% of ${f.could} lives that could`);
  console.log(`endings: ${Object.entries(report.endings).map(([id, n]) => `${id} ${n}`).join(', ')}`);
}
