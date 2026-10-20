/*
 * What choosing a life does that is not drawing: where each life stands in the grid, and which one the dice picks. Pure, so
 * that they are tested without a screen (the web does both inline in `NewLife`, with the grid left to CSS).
 */

/**
 * The lives laid out as the web's `grid grid-cols-2 grid-flow-row-dense` lays them: in order, two to a row, the chosen one across a
 * whole row (`col-span-2`) and, being unable to sit in a row that already holds a life, leaving a gap there that the next life
 * fills (dense packing). A row is the ids that stand in it: one (the chosen life, or the last life alone) or two.
 */
export function lifeRows(ids: readonly string[], chosen: string): string[][] {
  const rows: string[][] = [];
  for (const id of ids) {
    if (id === chosen) {
      // Across both columns: only a row with nothing in it will do, which is a new one.
      rows.push([id]);
      continue;
    }
    // The first place in the grid with room, from the top: the gap beside a life, if one is left, else a new row.
    const room = rows.find((row) => row.length === 1 && row[0] !== chosen);
    if (room) room.push(id);
    else rows.push([id]);
  }
  return rows;
}

/**
 * One of the lives that is not `chosen`, picked by `random` (a number from 0 up to but not including 1: `Math.random` where none is
 * given). With no other life to pick, the one chosen.
 */
export function anotherLife(ids: readonly string[], chosen: string, random: () => number = Math.random): string {
  const others = ids.filter((id) => id !== chosen);
  if (others.length === 0) return chosen;
  return others[Math.min(others.length - 1, Math.floor(random() * others.length))];
}
