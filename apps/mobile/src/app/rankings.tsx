import { useLocalSearchParams } from 'expo-router';
import { Rankings, type Kind } from '../game/screens/Rankings';

/** The rankings a link can open on, by its `?tab=` (the web's `#friends` and `?tab=challenge`): a friend request's notice is `theratrace://rankings?tab=friends`. */
const TABS: readonly Kind[] = ['all', 'week', 'friends', 'challenge'];

export default function RankingsRoute() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  return <Rankings tab={TABS.find((one) => one === tab)} />;
}
