import { createContext, useContext } from 'react';
import type { RoomMember } from '@ratrace/core/session/room';

/**
 * The story of a game with friends the round's newspaper prints, in place of the made-up people of
 * a life alone: what the last round did to the order of the players. `me` says whether it is about
 * the player, who is told of in the second person.
 */
export type RoomStory =
  | { kind: 'lead'; who: RoomMember; me: boolean }
  | { kind: 'passed'; who: RoomMember }
  | { kind: 'passedBy'; who: RoomMember }
  | { kind: 'jump'; who: RoomMember; me: boolean; points: number }
  | { kind: 'drop'; who: RoomMember; me: boolean; points: number }
  | { kind: 'neck'; who: RoomMember; other: RoomMember }
  | { kind: 'last'; who: RoomMember; me: boolean };

/** A round's gain worth a story: this many points, and this share of what the player had. */
const JUMP_POINTS = 30;
const JUMP_SHARE = 0.15;
/** Two leaders this close, as a share of the score, are neck and neck. */
const NECK_SHARE = 0.02;
/** The last of three or more, under this share of the leader's score, is far enough behind to be teased. */
const LAST_SHARE = 0.6;

/**
 * The one story worth printing about the round that turned last, or null after the first round, in
 * a quiet one, or for a player no longer in the game. In order: a new leader, the player
 * overtaking someone or overtaken, a big gain, a big loss, two leaders neck and neck, and one left
 * far behind.
 */
export function roomStory(members: readonly RoomMember[]): RoomStory | null {
  const stayed = members.filter((member) => !member.left && member.standing !== null);
  const me = stayed.find((member) => member.me);
  if (!me || stayed.length < 2 || stayed.every((member) => member.standing?.before == null)) return null;
  const score = (member: RoomMember) => member.standing?.score ?? 0;
  const order = [...stayed].sort((a, b) => score(b) - score(a));
  const placeNow = (member: RoomMember) => order.indexOf(member) + 1;
  const placeBefore = (member: RoomMember) => member.standing?.before?.place ?? placeNow(member);
  const gain = (member: RoomMember) => score(member) - (member.standing?.before?.score ?? score(member));

  const leader = order[0];
  // A leader alone at the top, who was not there before.
  if (score(leader) > score(order[1]) && placeBefore(leader) > 1) return { kind: 'lead', who: leader, me: leader.me };

  const passed = stayed.find((other) => other !== me && placeBefore(other) < placeBefore(me) && placeNow(other) > placeNow(me));
  if (passed) return { kind: 'passed', who: passed };
  const by = stayed.find((other) => other !== me && placeBefore(other) > placeBefore(me) && placeNow(other) < placeNow(me));
  if (by) return { kind: 'passedBy', who: by };

  const big = (points: number, member: RoomMember) => Math.abs(points) >= JUMP_POINTS && Math.abs(points) >= JUMP_SHARE * Math.max(1, score(member) - points);
  const jumper = [...stayed].sort((a, b) => gain(b) - gain(a))[0];
  if (gain(jumper) > 0 && big(gain(jumper), jumper)) return { kind: 'jump', who: jumper, me: jumper.me, points: gain(jumper) };
  const faller = [...stayed].sort((a, b) => gain(a) - gain(b))[0];
  if (gain(faller) < 0 && big(gain(faller), faller)) return { kind: 'drop', who: faller, me: faller.me, points: -gain(faller) };

  const second = order[1];
  if (score(leader) > 0 && score(leader) - score(second) <= NECK_SHARE * score(leader)) return { kind: 'neck', who: leader, other: second };
  const last = order[order.length - 1];
  if (order.length >= 3 && score(leader) > 0 && score(last) < LAST_SHARE * score(leader)) return { kind: 'last', who: last, me: last.me };
  return null;
}

/** The members of the game a life is played in, for its newspaper. Null for a life alone. */
export const RoomPaper = createContext<readonly RoomMember[] | null>(null);
export const useRoomPaper = () => useContext(RoomPaper);
