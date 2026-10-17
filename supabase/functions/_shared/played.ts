import type { GameModule, LoggedRound, Replayed, ReplayedStep, RoomEvent } from './game/types.ts';

/** What a player chose on one card, in the order the life was played. */
export interface CardPick {
  cardId: string;
  option: number;
}

/** A life as it stands after a log: the life and its record, what its last step did, and every card answered in it. */
export interface Played extends Replayed {
  last: ReplayedStep | null;
  picks: CardPick[];
}

/** The event of a card answered, as far as the picks keep it. */
const isCardEvent = (x: unknown): x is { kind: 'card'; cardId: string; option: number } =>
  typeof x === 'object' && x !== null && (x as { kind?: unknown }).kind === 'card' && typeof (x as { cardId?: unknown }).cardId === 'string' && typeof (x as { option?: unknown }).option === 'number';

/** A value as text with its keys in order, so that two that say the same read the same, as the database hands back a log with its keys reordered. */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
}

/**
 * The lives this instance of a function played last, by game. A life is played again from its seed
 * at every step; kept here, its next step is taken from where it stood instead, which gives the very
 * same life (the engine is deterministic, and `stepLife` is tested against the whole replay). An
 * instance lives a while and serves many calls, so a player's next card usually finds their life
 * here; when it does not, the life is played from its seed as before. Nothing kept is ever changed.
 */
const KEEP = 64;
const kept = new Map<string, { key: string; played: Played }>();

/** Forgets every life kept. For tests. */
export function forgetPlayed(): void {
  kept.clear();
}

function keep(id: string, key: string, played: Played): Played {
  kept.delete(id);
  kept.set(id, { key, played });
  // The one used longest ago goes first: a Map keeps the order things were put in.
  while (kept.size > KEEP) kept.delete(kept.keys().next().value as string);
  return played;
}

/**
 * How to play one life of a game: to where a log leaves it, and one step further. `id` names the
 * life, and its versions, seed and start are part of what it is kept under, so nothing kept is ever
 * taken for another life.
 */
export function lifePlayer(game: GameModule, id: string, versions: string, start: unknown, seed: string) {
  const begins = canonical(start);
  const keyOf = (log: readonly LoggedRound[]) => `${versions}|${seed}|${begins}|${canonical(log)}`;
  const found = (log: readonly LoggedRound[]): Played | null => {
    const hit = kept.get(id);
    return hit && hit.key === keyOf(log) ? keep(id, hit.key, hit.played) : null;
  };

  /** The life as the log leaves it. Throws on a log that cannot have been played. */
  const play = (log: readonly LoggedRound[]): Played => {
    const hit = found(log);
    if (hit) return hit;
    let last: ReplayedStep | null = null;
    const picks: CardPick[] = [];
    const whole = game.replayLife(game.content, start, seed, log, (step) => {
      last = step;
      for (const event of step.events) if (isCardEvent(event)) picks.push({ cardId: event.cardId, option: event.option });
    });
    return keep(id, keyOf(log), { ...whole, last: last as ReplayedStep | null, picks });
  };

  /** The life after one more step: `next` is `log` with `choice` at its end. Throws on a step that cannot be taken. */
  const step = (log: readonly LoggedRound[], next: readonly LoggedRound[], choice: { card: number } | { orders: unknown[]; room?: RoomEvent[] }): Played => {
    const from = game.stepLife ? found(log) : null;
    if (!from || !game.stepLife) return play(next);
    let last: ReplayedStep | null = null;
    const after = game.stepLife(game.content, from, choice, (heard) => (last = heard));
    const picks = [...from.picks];
    for (const event of (last as ReplayedStep | null)?.events ?? []) if (isCardEvent(event)) picks.push({ cardId: event.cardId, option: event.option });
    return keep(id, keyOf(next), { ...after, last, picks });
  };

  return { play, step };
}
