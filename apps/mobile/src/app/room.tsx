import { useLocalSearchParams } from 'expo-router';
import { Room } from '../game/screens/Room';

/**
 * The games with others. An invitation's link opens it with the game's code (`?code=`): the app's own, `theratrace://room?code=K7Q2XM`, which the
 * router takes to this route by itself, and the web's, `/<locale>/room?code=`, where the phone hands that link to the app.
 */
export default function RoomRoute() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  return <Room code={typeof code === 'string' ? code : undefined} />;
}
