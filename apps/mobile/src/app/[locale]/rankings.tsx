import { useLocalSearchParams } from 'expo-router';
import { Rankings, type Kind } from '../../game/screens/Rankings';
import { InLanguage } from '../../game/screens/InLanguage';

/** Each page once in each language of the game, for the web export. */
export { generateStaticParams } from '../../game/pages';

/**
 * The rankings a link can open on: the web's `#friends` (the front door's link, and a phone's `theratrace://rankings#friends`) and `?tab=challenge`, and
 * any tab by `?tab=`, which the server writes a phone's notices in: a friend request's is `theratrace://rankings?tab=friends`.
 */
const TABS: readonly Kind[] = ['all', 'week', 'friends', 'challenge'];

export default function RankingsRoute() {
  // The hash, as the router hands it.
  const { tab, '#': hash } = useLocalSearchParams<{ tab?: string; '#'?: string }>();
  return (
    <InLanguage>
      <Rankings tab={TABS.find((one) => one === tab) ?? (hash === 'friends' ? 'friends' : undefined)} />
    </InLanguage>
  );
}
