import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { useGo } from '../../game/pages';
import { Rankings, type Kind } from '../../game/screens/Rankings';
import { PageHead } from '../../game/pageHead';
import { InLanguage } from '../../game/screens/InLanguage';

/** Each page once in each language of the game, for the web export. */
export { generateStaticParams } from '../../game/pages';

/**
 * The rankings a link can open on: the web's `#friends` (the front door's link, and a phone's `theratrace://rankings#friends`) and `?tab=challenge`, and
 * any tab by `?tab=`. The player's friends are on the games with others' page: a link that brings a friend's code or a friend request's answer here
 * (`?friend=`, `?accept=`, `?decline=`: a QR code or a notice from before they moved) is led there, its query kept.
 */
const TABS: readonly Kind[] = ['all', 'week', 'friends', 'challenge'];
const FRIENDS: readonly string[] = ['friend', 'accept', 'decline'];

export default function RankingsRoute() {
  // The hash, as the router hands it.
  const params = useLocalSearchParams<{ tab?: string; '#'?: string; friend?: string; accept?: string; decline?: string }>();
  const go = useGo();
  const moved = Object.fromEntries(FRIENDS.flatMap((name) => (typeof params[name as 'friend'] === 'string' ? [[name, params[name as 'friend'] as string]] : [])));
  const leads = Object.keys(moved).length > 0;
  const where = JSON.stringify(moved);
  useEffect(() => {
    if (leads) go.replace('room', { query: JSON.parse(where) as Record<string, string> });
  }, [leads, where, go]);
  if (leads) return null;
  return (
    <InLanguage>
      <PageHead page="rankings" />
      <Rankings tab={TABS.find((kind) => kind === params.tab) ?? (params['#'] === 'friends' ? 'friends' : undefined)} />
    </InLanguage>
  );
}
