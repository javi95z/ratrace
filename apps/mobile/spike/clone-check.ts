// Phase 0 spike: is a JSON clone as good as structuredClone for the game? The same life, same seed, both ways.
import { bots, content, lives } from '@ratrace/content';
import { stateHash } from '@ratrace/engine';
import { LocalSessions } from '@ratrace/core/session/local';
import { MemoryStore } from '@ratrace/core/session/memory';

async function play(seed: string): Promise<string> {
  let n = 0;
  const sessions = new LocalSessions(new MemoryStore(), content, lives, { newId: () => `id-${(n += 1)}`, newSeed: () => seed, now: () => 0 });
  const bot = bots.find((b) => b.id === 'saver')!;
  const s = await sessions.start('nurse');
  while (!s.view().finished) {
    while (s.view().phase === 'cards') await s.answerCard(bot.pick(content, s.view()));
    await s.playRound({ orders: bot.orders(content, s.view()) });
  }
  const resumed = await sessions.resume();
  return `${stateHash(s.view() as never)}|${resumed.session ? 'resumed' : resumed.lost}`;
}

async function main() {
  const seeds = ['a'.repeat(64), 'b1'.repeat(32), '0f'.repeat(32)];
  const native = await Promise.all(seeds.map(play));
  const real = globalThis.structuredClone;
  globalThis.structuredClone = ((v: unknown) => (v === undefined ? v : JSON.parse(JSON.stringify(v)))) as typeof structuredClone;
  const json = await Promise.all(seeds.map(play));
  globalThis.structuredClone = real;
  console.log(native.map((h, i) => `${h === json[i] ? 'SAME' : 'DIFF'} ${h} ${json[i]}`).join('\n'));
}
void main();
