const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/**
 * A life as a server on older rules shows it, made whole for the rules of this page: what those
 * rules know of that the older ones did not is given the value it would have had. Only fills in;
 * nothing the server said is changed.
 */
export function upToDateView<T>(view: T): T {
  if (!isRecord(view) || !isRecord(view.player) || !isRecord(view.player.life)) return view;
  const player = view.player;
  const life = player.life as Record<string, unknown>;
  // Engine 0.37: where a remote job is based. Before it, always where the player lives.
  if (typeof life.workCityId !== 'string' && typeof player.cityId === 'string') return { ...view, player: { ...player, life: { ...life, workCityId: player.cityId } } } as T;
  return view;
}

