import { useLocalSearchParams } from 'expo-router';
import { Room } from '../game/screens/Room';

/**
 * The games with others, opened with a game's code by the app's own link, `theratrace://room?code=K7Q2XM`, which the router takes to this route by
 * itself. The invitation the app shares is the web's link (`/<locale>/room?code=`), which opens the web's game, even on a phone with the app.
 */
export default function RoomRoute() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  return <Room code={typeof code === 'string' ? code : undefined} />;
}
