import { content as defaultContent, lives, textFor } from '@ratrace/content';
import type { Locale } from '@ratrace/content';
import { applyCard, applyRound, createGame, previewRound } from '@ratrace/engine';
import type { Content, GameState, Order } from '@ratrace/engine';
import { formatFor } from './format';
import { parse } from './parse';
import * as screens from './screens';
import type { Pen } from './screens';
import { ui as allUi } from './strings';

/** How the game talks to whoever is playing. `ask` resolves to null when there is nobody left to answer. */
export interface Io {
  ask(prompt: string): Promise<string | null>;
  print(line: string): void;
}

export interface Options {
  locale: Locale;
  /** A life id. Asked for when missing. */
  lifeId?: string;
  seed: string;
  /** Defaults to the v1 content. */
  content?: Content;
}

const say = (io: Io, lines: string[]) => {
  for (const line of lines) io.print(line);
};

async function chooseLife(io: Io, pen: Pen, wanted: string | undefined) {
  const found = lives.find((life) => life.id === wanted);
  if (found) return found;
  io.print(` ${pen.ui.chooseLife}`);
  lives.forEach((life, i) => {
    const written = pen.text.lives[life.id];
    io.print(`  ${i + 1}. ${written.name} — ${written.perk} ${written.handicap}`);
  });
  for (;;) {
    const typed = await io.ask(pen.ui.lifePrompt(lives.length));
    if (typed === null || typed.trim() === '') return lives[0];
    const chosen = lives[Number(typed.trim()) - 1] ?? lives.find((life) => life.id === typed.trim());
    if (chosen) return chosen;
  }
}

/**
 * Plays the hand one card at a time: each card is shown as the player stands now, answered, and
 * settled before the next one is shown, so what a card says it will do is what it does.
 * An empty or unreadable answer is the first option.
 */
async function answerHand(io: Io, pen: Pen, start: GameState): Promise<GameState> {
  let state = start;
  while (!state.finished && state.phase === 'cards') {
    const def = pen.content.cards.find((card) => card.id === state.hand[state.answered]);
    if (def) say(io, screens.card(pen, state, def, state.answered + 1, state.hand.length));
    const typed = def ? await io.ask(` ${pen.ui.pick(def.options.length)}`) : null;
    const choice = typed === null ? 1 : Number(typed.trim() || '1');
    const answered = applyCard(pen.content, state, Number.isInteger(choice) && choice >= 1 ? choice - 1 : 0);
    for (const event of answered.events) if (event.kind === 'card') say(io, screens.cardResult(pen, event));
    say(io, screens.ledger(pen, answered.events));
    state = answered.state;
  }
  return state;
}

/**
 * The finance phase: reads orders until the player is done. Each order is tried against the round
 * at once, so a refusal is explained on the spot and never reaches the round.
 * Returns null if the player quits.
 */
async function takeOrders(io: Io, pen: Pen, state: GameState): Promise<Order[] | null> {
  const { ui, text, fmt, content, names } = pen;
  const orders: Order[] = [];
  const typedOrders: string[] = [];
  io.print(screens.header(pen, state)[0]);
  io.print(` ${ui.finance} — ${ui.financeHint}`);

  for (;;) {
    const line = await io.ask(` ${ui.prompt}`);
    if (line === null) return orders;
    const preview = previewRound(content, state, { orders });
    const scene = { content, state: { ...state, player: preview.player }, names, text, locale: pen.locale };
    const command = parse(line, scene);
    switch (command.kind) {
      case 'empty':
        break;
      case 'done':
        return orders;
      case 'quit':
        return null;
      case 'error':
        io.print(`   ${ui.problems[command.problem]}`);
        break;
      case 'undo':
        if (orders.length === 0) io.print(`   ${ui.nothingToUndo}`);
        else {
          orders.pop();
          io.print(`   − ${typedOrders.pop()} (${ui.removed})`);
        }
        break;
      case 'order': {
        const tried = previewRound(content, state, { orders: [...orders, command.order] });
        const refusal = tried.rejected.find((r) => r.index === orders.length);
        if (refusal) {
          io.print(`   ${ui.refused}: ${text.reasons[refusal.reason]}`);
          break;
        }
        orders.push(command.order);
        typedOrders.push(screens.tidy(line));
        io.print(`   ✓ ${typedOrders[typedOrders.length - 1]} (${ui.added})   ${ui.cashAfterRound}: ${fmt.money(tried.cashAfter)}`);
        break;
      }
      case 'view': {
        const shown = { ...state, player: preview.player };
        const view = command.view;
        if (view === 'help') say(io, screens.help(pen));
        else if (view === 'me') say(io, screens.me(pen, shown));
        else if (view === 'news') say(io, screens.news(pen, state));
        else if (view === 'market') say(io, screens.market(pen, shown));
        else if (view === 'portfolio') say(io, screens.portfolio(pen, shown));
        else if (view === 'shop') say(io, screens.shop(pen, shown));
        else if (view === 'homes') say(io, screens.homes(pen, shown));
        else if (view === 'cities') say(io, screens.cities(pen, shown));
        else if (view === 'tax') say(io, screens.round(pen, preview));
        else say(io, screens.orderList(pen, typedOrders));
        break;
      }
    }
  }
}

/**
 * Plays a whole life in a terminal. Returns the final state, or null if the player quit.
 * Everything it knows about the game comes from the engine and the content package.
 */
export async function runGame(io: Io, options: Options): Promise<GameState | null> {
  const content = options.content ?? defaultContent;
  const { text, names } = textFor(options.locale);
  const pen: Pen = { content, text, names, locale: options.locale, ui: allUi[options.locale], fmt: formatFor(options.locale) };
  const { ui } = pen;

  io.print('');
  io.print(` ${ui.title}`);
  io.print(` ${ui.tagline}`);
  io.print('');
  const life = await chooseLife(io, pen, options.lifeId);
  let state = createGame({ content, start: life.start }, options.seed);

  while (!state.finished) {
    io.print('');
    say(io, screens.header(pen, state));
    say(io, screens.news(pen, state));
    say(io, screens.me(pen, state));

    state = await answerHand(io, pen, state);
    io.print('');

    const orders = await takeOrders(io, pen, state);
    if (orders === null) {
      io.print(` ${ui.goodbye}`);
      return null;
    }
    const before = state;
    const result = applyRound(content, state, { orders });
    io.print('');
    io.print(` ${ui.resolve} · ${ui.age} ${screens.ageAt(pen, before.round)} → ${screens.ageAt(pen, result.state.round)}`);
    say(io, screens.ledger(pen, result.events));
    state = result.state;
  }

  io.print('');
  say(io, screens.ending(pen, state));
  io.print(`  ${ui.replay}: pnpm play --life ${life.id} --seed ${options.seed} --lang ${options.locale}`);
  return state;
}
