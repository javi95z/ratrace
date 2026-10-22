import { useRef } from 'react';
import type { RoomActions, RoomStoreState } from '@ratrace/core/game/room';
import { useRoom } from './context';

/**
 * A slice of the room that a piece of a screen draws, taken again only when what it holds has changed (its JSON): every look at the room brings the
 * whole room anew from the server (another player's shout, a loan between two others, a seat that played), and a piece that draws none of what
 * changed is not drawn again for it. `select` returns plain data only (no functions), small enough to compare.
 */
export function useRoomSlice<T>(select: (state: RoomStoreState & RoomActions) => T): T {
  const last = useRef<{ json: string; value: T } | null>(null);
  return useRoom((state) => {
    const value = select(state);
    const json = JSON.stringify(value) ?? 'undefined';
    if (last.current !== null && last.current.json === json) return last.current.value;
    last.current = { json, value };
    return value;
  });
}
