import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Rankings, type Answering, type Kind } from '../../game/screens/Rankings';
import { PageHead } from '../../game/pageHead';
import { InLanguage } from '../../game/screens/InLanguage';

/** Each page once in each language of the game, for the web export. */
export { generateStaticParams } from '../../game/pages';

/**
 * The rankings a link can open on: the web's `#friends` (the front door's link, and a phone's `theratrace://rankings#friends`) and `?tab=challenge`, and
 * any tab by `?tab=`, which the server writes a phone's notices in: a friend request's is `theratrace://rankings?tab=friends`. A friend's link (their QR
 * code) brings their code for the player to send (`?friend=`), and a friend request's notice's buttons the answer (`?accept=<id>`, `?decline=<id>`).
 */
const TABS: readonly Kind[] = ['all', 'week', 'friends', 'challenge'];
/** A friend code, as the server makes them, in a friend's link (`?friend=`, their QR code). */
const FRIEND_CODE = /^[A-Za-z0-9]{8}$/;
/** An account's id, in a friend request's notice's buttons (`?accept=`, `?decline=`). */
const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One value of a query, or undefined. */
const one = (value: string | string[] | undefined): string | undefined => (typeof value === 'string' ? value : undefined);

export default function RankingsRoute() {
  // The hash, as the router hands it.
  const { tab, '#': hash, friend, accept, decline } = useLocalSearchParams<{ tab?: string; '#'?: string; friend?: string; accept?: string; decline?: string }>();
  const code = one(friend)?.toUpperCase();
  const asked = one(accept) ?? one(decline);
  const answering = useMemo<Answering | undefined>(() => (asked !== undefined && USER_ID.test(asked) ? { userId: asked, yes: one(accept) === asked } : undefined), [asked, accept]);
  return (
    <InLanguage>
      <PageHead page="rankings" />
      <Rankings
        tab={TABS.find((kind) => kind === tab) ?? (hash === 'friends' || code !== undefined || answering !== undefined ? 'friends' : undefined)}
        friend={code !== undefined && FRIEND_CODE.test(code) ? code : undefined}
        answering={answering}
      />
    </InLanguage>
  );
}
