import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline';
import type { Locale } from '@ratrace/content';
import { runGame } from './game';
import type { Io } from './game';

/**
 * The Rat Race in a terminal.
 *
 *   pnpm play [--lang en|es] [--life nurse|engineer|civil_servant|rider|heir|newcomer] [--seed text]
 *
 * Answers can also be piped in, one per line: the game plays itself on first options once they run out.
 */
function flag(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

const locale: Locale = flag('lang') === 'es' ? 'es' : 'en';
const seed = flag('seed') ?? randomBytes(4).toString('hex');

const reader = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY === true });
const waiting: Array<(line: string | null) => void> = [];
const buffered: string[] = [];
let closed = false;
const piped = process.stdin.isTTY !== true;
reader.on('line', (line) => {
  const next = waiting.shift();
  if (!next) {
    buffered.push(line);
    return;
  }
  // A terminal has already shown what was typed. Piped answers are shown here, so the transcript reads like a game.
  if (piped) console.log(line);
  next(line);
});
reader.on('close', () => {
  closed = true;
  for (const next of waiting.splice(0)) next(null);
});

const io: Io = {
  print: (line) => console.log(line),
  ask: (prompt) => {
    process.stdout.write(prompt);
    const ready = buffered.shift();
    if (ready !== undefined) {
      if (piped) console.log(ready);
      return Promise.resolve(ready);
    }
    if (closed) {
      console.log('');
      return Promise.resolve(null);
    }
    return new Promise((resolve) => waiting.push(resolve));
  },
};

runGame(io, { locale, lifeId: flag('life'), seed })
  .then(() => reader.close())
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
    reader.close();
  });
