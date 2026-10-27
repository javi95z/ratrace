import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Room, type Answering } from '../../game/screens/Room';
import { PageHead } from '../../game/pageHead';
import { InLanguage } from '../../game/screens/InLanguage';

/** Each page once in each language of the game, for the web export. */
export { generateStaticParams } from '../../game/pages';

/** A friend code, as the server makes them, in a friend's link (`?friend=`, their QR code). */
const FRIEND_CODE = /^[A-Za-z0-9]{8}$/;
/** An account's id, in a friend request's notice's buttons (`?accept=`, `?decline=`). */
const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One value of a query, or undefined. */
const one = (value: string | string[] | undefined): string | undefined => (typeof value === 'string' ? value : undefined);

/**
 * The games with others and the player's friends. Opened with a game's code by the invitation's link, the web's `/<locale>/room?code=K7Q2XM`, and on
 * the phone by the app's own, `theratrace://room?code=K7Q2XM`, which `+native-intent` makes that page in the phone's language; with a friend's code
 * by their link (`?friend=`, their QR code), written in for the player to send; and with a friend request's answer by its notice's buttons
 * (`?accept=<id>`, `?decline=<id>`).
 */
export default function RoomRoute() {
  const { code, friend, accept, decline } = useLocalSearchParams<{ code?: string; friend?: string; accept?: string; decline?: string }>();
  const friendCode = one(friend)?.toUpperCase();
  const asked = one(accept) ?? one(decline);
  const yes = one(accept) === asked;
  const answering = useMemo<Answering | undefined>(() => (asked !== undefined && USER_ID.test(asked) ? { userId: asked, yes } : undefined), [asked, yes]);
  return (
    <InLanguage>
      <PageHead page="room" />
      <Room code={one(code)} friend={friendCode !== undefined && FRIEND_CODE.test(friendCode) ? friendCode : undefined} answering={answering} />
    </InLanguage>
  );
}
