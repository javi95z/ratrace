// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { messagesFor } from '@ratrace/i18n';
import { cleanup, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { memoryServices, renderGame } from '../testing/render';
import { RIVAL_NAMES, useRivals } from './useRivals';

/*
 * The phone's rivals are the web's (apps/web/src/game/useRivals.ts): the file cannot be shared, because the web's reads its own
 * game context. The copy is held to the original line for line, all but the one line that says where the context is; and what it
 * says is checked here, on the phone's game.
 */

afterEach(cleanup);

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('is the web\'s, line for line, but for where it reads the game from', () => {
  const web = read('../../../web/src/game/useRivals.ts');
  // Its note, that it is a copy, is its own.
  const phone = read('./useRivals.ts').replace(/^\/\*[\s\S]*?\*\/\n\n/, '');
  const asThePhone = web.replace("'use client';\n\n", '').replace("from '@/game/context';", "from './context';");
  expect(asThePhone).not.toBe(web);
  expect(phone).toBe(asThePhone);
});

/** Says who each rival is, in the words of the game. */
function Rivals() {
  const people = useRivals();
  if (people === null) return <span>none</span>;
  return <span>{people.rivals.map((rival) => people.who(rival)).join(' | ')}</span>;
}

test('names the three people the player grew up with, in the language played, the two men never by the same name', async () => {
  const services = memoryServices();
  await services.sessions.start('nurse');
  renderGame(<Rivals />, services);
  const said = (await screen.findByText(/\|/)).textContent ?? '';
  const who = said.split(' | ');
  expect(who).toHaveLength(3);
  const rivals = messagesFor('en').rivals as { names: { men: string; women: string } };
  const names = [...rivals.names.men.split('|'), ...rivals.names.women.split('|')];
  expect(rivals.names.men.split('|')).toHaveLength(RIVAL_NAMES);
  for (const one of who) expect(names.some((name) => one.includes(name)), one).toBe(true);
  // The nurse is drawn as a woman: her ex is a man, as the classmate is, and the two never share a name.
  const men = who.filter((one) => rivals.names.men.split('|').some((name) => one.includes(name)));
  expect(men).toHaveLength(2);
  expect(new Set(men.map((one) => rivals.names.men.split('|').find((name) => one.includes(name)))).size).toBe(men.length);
});

test('is nothing before a life is open', () => {
  renderGame(<Rivals />, memoryServices());
  expect(screen.getByText('none')).toBeTruthy();
});
