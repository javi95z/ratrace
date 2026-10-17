import { useRoom, useT } from '@/game/context';

/**
 * How the page names another player of the room the life is played in, by the id the server gave
 * them: the name they chose, or the rat and tag the room shows for one with none.
 */
export function usePeerName(): (userId: string) => string {
  const t = useT('room');
  const members = useRoom((s) => s.room?.members);
  return (userId) => members?.find((member) => member.userId === userId)?.name ?? t('nameless', { tag: userId.slice(0, 4).toUpperCase() });
}
